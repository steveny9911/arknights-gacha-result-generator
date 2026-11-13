// SLICE 4: compose the ten-pull image with sharp.
// Each column is drawn bottom to top: glow, portrait panel, portrait, stars, class icon.
// Pure function of (operators, image bytes) -> encoded image bytes; no network.
import sharp, { type OverlayOptions } from "sharp";
import type { Operator, Tier } from "../types.ts";
import { renderGlow, renderPanelBackground } from "./column-background.ts";

export interface MontageEntry {
  operator: Operator;
  portrait: Uint8Array;
  /** Class icon: black glyph on a white tile (source is ~108x109, scaled by ICON_SCALE). */
  classIcon: Uint8Array;
  /** White star row for the operator's tier (source is at most 175x47, drawn at native size). */
  stars: Uint8Array;
}

export interface MontageOptions {
  /** Output format. Default "png". */
  format?: "png" | "webp";
  /** Halftone dot mask for the 6-star backgrounds. Without it that tier gets plain gradients. */
  halftoneMask?: Uint8Array;
}

/**
 * Layout constants, in pixels. With 10 columns the canvas is 1920x1080, like the in-game result screen.
 * Each column: a full-height glow, with a portrait panel in the middle. The stars straddle the panel's
 * top edge and the class icon straddles its bottom edge.
 */
export const COLUMN_WIDTH = 183;
export const PADDING_X = 45;
export const CANVAS_HEIGHT = 1080;
export const PANEL_TOP = 250;
export const PANEL_HEIGHT = 550;
export const PANEL_BOTTOM = PANEL_TOP + PANEL_HEIGHT;
export const BACKGROUND = "#141414";

/** The icon image is 108x109 with a 90x90 white tile at (9, 0) and a shadow; scale it up to a ~134px tile. */
export const ICON_SCALE = 1.5;
const ICON_SOURCE_SIZE = { width: 108, height: 109 };
const ICON_TILE_CENTRE = { x: 53.5, y: 44.5 }; // centre of the white tile inside the source image

export const MONTAGE_WIDTH_FOR = (count: number) => PADDING_X * 2 + COLUMN_WIDTH * count;

const COLUMN = { width: COLUMN_WIDTH, height: CANVAS_HEIGHT, panelTop: PANEL_TOP, panelHeight: PANEL_HEIGHT };

/** Compute `make(tier)` once per tier and share the result. */
function memoByTier<T>(make: (tier: Tier) => Promise<T>): (tier: Tier) => Promise<T> {
  const cache = new Map<Tier, Promise<T>>();
  return (tier) => {
    let value = cache.get(tier);
    if (!value) cache.set(tier, (value = make(tier)));
    return value;
  };
}

export async function renderMontage(
  entries: readonly MontageEntry[],
  opts: MontageOptions = {},
): Promise<Uint8Array> {
  if (entries.length === 0) throw new RangeError("entries must not be empty");

  const glowFor = memoByTier((tier) => renderGlow(tier, COLUMN, opts.halftoneMask));
  const panelFor = memoByTier((tier) =>
    renderPanelBackground(tier, COLUMN_WIDTH, PANEL_HEIGHT, opts.halftoneMask),
  );

  const layers: OverlayOptions[] = [];
  for (const [i, entry] of entries.entries()) {
    const left = PADDING_X + i * COLUMN_WIDTH;
    const tier = entry.operator.rarity;

    layers.push({ input: await glowFor(tier), left, top: 0 });
    layers.push({ input: await panelFor(tier), left, top: PANEL_TOP });
    layers.push(await portraitLayer(entry.portrait, left));
    layers.push(await starsLayer(entry.stars, left));
    layers.push(await iconLayer(entry.classIcon, left));
  }

  const canvas = sharp({
    create: {
      width: MONTAGE_WIDTH_FOR(entries.length),
      height: CANVAS_HEIGHT,
      channels: 3,
      background: BACKGROUND,
    },
  }).composite(layers);

  const encoded = opts.format === "webp" ? canvas.webp() : canvas.png();
  return new Uint8Array(await encoded.toBuffer());
}

/** The portrait fills the panel: scaled up and cropped to the panel's shape. */
async function portraitLayer(portrait: Uint8Array, left: number): Promise<OverlayOptions> {
  const input = await sharp(portrait).resize(COLUMN_WIDTH, PANEL_HEIGHT, { fit: "cover" }).toBuffer();
  return { input, left, top: PANEL_TOP };
}

/** Stars at native size, centred on the panel's top edge. */
async function starsLayer(stars: Uint8Array, left: number): Promise<OverlayOptions> {
  const { data, info } = await sharp(stars).toBuffer({ resolveWithObject: true });
  return {
    input: data,
    left: left + Math.round((COLUMN_WIDTH - info.width) / 2),
    top: PANEL_TOP - Math.round(info.height / 2),
  };
}

/** Class icon, scaled up, with its white tile centred on the panel's bottom edge. */
async function iconLayer(icon: Uint8Array, left: number): Promise<OverlayOptions> {
  const input = await sharp(icon)
    .resize(
      Math.round(ICON_SOURCE_SIZE.width * ICON_SCALE),
      Math.round(ICON_SOURCE_SIZE.height * ICON_SCALE),
      { fit: "fill" },
    )
    .toBuffer();
  return {
    input,
    left: left + Math.round(COLUMN_WIDTH / 2 - ICON_TILE_CENTRE.x * ICON_SCALE),
    top: Math.round(PANEL_BOTTOM - ICON_TILE_CENTRE.y * ICON_SCALE),
  };
}

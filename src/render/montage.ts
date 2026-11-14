// Compose the ten-pull image with sharp.
// The canvas gradient and the sparkles are random, so pass a seeded `rng` for a reproducible image.
// No network: it only turns operators and image bytes into encoded image bytes.
import sharp, { type OverlayOptions } from "sharp";
import type { Operator, Rng, Tier } from "../types.ts";
import { renderBackground } from "./background.ts";
import { renderGlow, renderPanelBackground, renderSparkles } from "./column-background.ts";

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
  /** The game's portrait-panel images by tier. A tier without one gets a drawn gradient panel. */
  panelImages?: Partial<Record<Tier, Uint8Array>>;
  /** Randomness for the background gradient and sparkles. Default Math.random. */
  rng?: Rng;
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
/** Glows are narrower than their column, so a seam of the canvas shows between neighbours. */
export const GLOW_GAP = 3;

/** The icon image is 108x109 with a 90x90 white tile at (9, 0) and a shadow; scale it up to a ~134px tile. */
export const ICON_SCALE = 1.5;
const ICON_SOURCE_SIZE = { width: 108, height: 109 };
const ICON_TILE_CENTRE = { x: 53.5, y: 44.5 }; // centre of the white tile inside the source image

export const montageWidthFor = (count: number) => PADDING_X * 2 + COLUMN_WIDTH * count;

/** Geometry shared by every column's glow and sparkles: as tall as the canvas, panel in the middle. */
const COLUMN_GEOMETRY = { width: COLUMN_WIDTH - GLOW_GAP, height: CANVAS_HEIGHT, panelTop: PANEL_TOP, panelHeight: PANEL_HEIGHT };

/** Compute `make(tier)` once per tier and share the result. */
function memoByTier<T>(make: (tier: Tier) => Promise<T>): (tier: Tier) => Promise<T> {
  const cache = new Map<Tier, Promise<T>>();
  return (tier) => {
    let value = cache.get(tier);
    if (!value) cache.set(tier, (value = make(tier)));
    return value;
  };
}

/** What every column shares: per-tier images made once, and the one source of randomness. */
interface ColumnContext {
  glowFor: (tier: Tier) => Promise<Buffer>;
  panelFor: (tier: Tier) => Promise<Buffer>;
  rng: Rng;
}

/** One column's layers, bottom to top: glow, sparkles, panel, portrait, stars, class icon. */
async function columnLayers(entry: MontageEntry, index: number, ctx: ColumnContext): Promise<OverlayOptions[]> {
  const left = PADDING_X + index * COLUMN_WIDTH;
  const glowLeft = left + Math.floor(GLOW_GAP / 2);
  const tier = entry.operator.rarity;
  return [
    { input: await ctx.glowFor(tier), left: glowLeft, top: 0 },
    { input: await renderSparkles(tier, COLUMN_GEOMETRY, ctx.rng), left: glowLeft, top: 0 },
    { input: await ctx.panelFor(tier), left, top: PANEL_TOP },
    await portraitLayer(entry.portrait, left),
    await starsLayer(entry.stars, left),
    await iconLayer(entry.classIcon, left),
  ];
}

export async function renderMontage(
  entries: readonly MontageEntry[],
  opts: MontageOptions = {},
): Promise<Uint8Array> {
  if (entries.length === 0) throw new RangeError("entries must not be empty");

  const ctx: ColumnContext = {
    glowFor: memoByTier((tier) => renderGlow(tier, COLUMN_GEOMETRY, opts.halftoneMask)),
    panelFor: memoByTier((tier) =>
      renderPanelBackground(tier, COLUMN_WIDTH, PANEL_HEIGHT, {
        image: opts.panelImages?.[tier],
        halftoneMask: opts.halftoneMask,
      }),
    ),
    rng: opts.rng ?? Math.random,
  };

  // One column at a time, so the rng is drawn in a fixed order and a seed reproduces the image.
  const layers: OverlayOptions[] = [];
  for (const [i, entry] of entries.entries()) layers.push(...(await columnLayers(entry, i, ctx)));

  const background = await renderBackground(montageWidthFor(entries.length), CANVAS_HEIGHT, ctx.rng);
  const canvas = sharp(background).composite(layers).removeAlpha(); // the picture is fully opaque
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

// SLICE 4: compose the ten-pull image with sharp.
// Layout per column (top to bottom): white stars, portrait, class icon tile. Columns are flush.
// Pure function of (operators, image bytes) -> encoded image bytes; no network.
import sharp, { type OverlayOptions } from "sharp";
import type { Operator } from "../types.ts";

export interface MontageEntry {
  operator: Operator;
  portrait: Uint8Array;
  /** Class icon: black glyph on a white tile (source is ~108x109, drawn at native size). */
  classIcon: Uint8Array;
  /** White star row for the operator's tier (source is at most 175x47, drawn at native size). */
  stars: Uint8Array;
}

export interface MontageOptions {
  /** Output format. Default "png". */
  format?: "png" | "webp";
}

/** Layout constants, in pixels. Portraits are 180x360 in the source assets. */
export const PORTRAIT_WIDTH = 180;
export const PORTRAIT_HEIGHT = 360;
export const STARS_HEIGHT = 47;
export const STARS_GAP = 8;
export const ICON_SIZE = 108;
export const ICON_GAP = 12;
export const PADDING = 32;
export const BACKGROUND = "#141414";

export const PORTRAIT_TOP = PADDING + STARS_HEIGHT + STARS_GAP;
export const ICON_TOP = PORTRAIT_TOP + PORTRAIT_HEIGHT + ICON_GAP;

export const MONTAGE_WIDTH_FOR = (count: number) => PADDING * 2 + PORTRAIT_WIDTH * count;
export const MONTAGE_HEIGHT = ICON_TOP + ICON_SIZE + PADDING;

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

export async function renderMontage(
  entries: readonly MontageEntry[],
  opts: MontageOptions = {},
): Promise<Uint8Array> {
  if (entries.length === 0) throw new RangeError("entries must not be empty");

  const layers: OverlayOptions[] = [];
  for (const [i, entry] of entries.entries()) {
    const left = PADDING + i * PORTRAIT_WIDTH;
    const centred = (width: number) => left + Math.floor((PORTRAIT_WIDTH - width) / 2);

    const portrait = await sharp(entry.portrait)
      .resize(PORTRAIT_WIDTH, PORTRAIT_HEIGHT, { fit: "cover" })
      .toBuffer();
    layers.push({ input: portrait, left, top: PORTRAIT_TOP });

    // `inside` never enlarges past the box, so oversized sources shrink and native ones stay sharp.
    const stars = await sharp(entry.stars)
      .resize(PORTRAIT_WIDTH, STARS_HEIGHT, { fit: "inside", withoutEnlargement: true })
      .toBuffer({ resolveWithObject: true });
    layers.push({
      input: stars.data,
      left: centred(stars.info.width),
      top: PADDING + STARS_HEIGHT - stars.info.height,
    });

    const icon = await sharp(entry.classIcon)
      .resize(ICON_SIZE, ICON_SIZE, { fit: "inside", withoutEnlargement: true, background: TRANSPARENT })
      .toBuffer({ resolveWithObject: true });
    layers.push({ input: icon.data, left: centred(icon.info.width), top: ICON_TOP });
  }

  const canvas = sharp({
    create: {
      width: MONTAGE_WIDTH_FOR(entries.length),
      height: MONTAGE_HEIGHT,
      channels: 3,
      background: BACKGROUND,
    },
  }).composite(layers);

  const encoded = opts.format === "webp" ? canvas.webp() : canvas.png();
  return new Uint8Array(await encoded.toBuffer());
}

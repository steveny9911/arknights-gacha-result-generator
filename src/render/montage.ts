// SLICE 4: compose the ten-pull image with sharp.
// Layout: a row of portraits (flush, no gaps) with each operator's class icon centred below.
// Pure function of (operators, image bytes) -> encoded image bytes; no network.
import sharp, { type OverlayOptions } from "sharp";
import type { Operator } from "../types.ts";

export interface MontageEntry {
  operator: Operator;
  portrait: Uint8Array;
  classIcon: Uint8Array;
}

export interface MontageOptions {
  /** Output format. Default "png". */
  format?: "png" | "webp";
}

/** Layout constants, in pixels. Portraits are 180x360 in the source assets. */
export const PORTRAIT_WIDTH = 180;
export const PORTRAIT_HEIGHT = 360;
export const ICON_SIZE = 64;
export const ICON_GAP = 16;
export const PADDING = 32;
export const BACKGROUND = "#141414";

export const MONTAGE_WIDTH_FOR = (count: number) => PADDING * 2 + PORTRAIT_WIDTH * count;
export const MONTAGE_HEIGHT = PADDING * 2 + PORTRAIT_HEIGHT + ICON_GAP + ICON_SIZE;

export async function renderMontage(
  entries: readonly MontageEntry[],
  opts: MontageOptions = {},
): Promise<Uint8Array> {
  if (entries.length === 0) throw new RangeError("entries must not be empty");

  const layers: OverlayOptions[] = [];
  for (const [i, entry] of entries.entries()) {
    const left = PADDING + i * PORTRAIT_WIDTH;
    const portrait = await sharp(entry.portrait)
      .resize(PORTRAIT_WIDTH, PORTRAIT_HEIGHT, { fit: "cover" })
      .toBuffer();
    // The source icons are 26x26, so they are upscaled; contain keeps them undistorted.
    const icon = await sharp(entry.classIcon)
      .resize(ICON_SIZE, ICON_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    layers.push(
      { input: portrait, left, top: PADDING },
      {
        input: icon,
        left: left + (PORTRAIT_WIDTH - ICON_SIZE) / 2,
        top: PADDING + PORTRAIT_HEIGHT + ICON_GAP,
      },
    );
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

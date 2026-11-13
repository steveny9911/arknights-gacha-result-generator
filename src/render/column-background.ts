// Tier-coloured background for one result column: a vertical gradient, plus a halftone dot
// pattern on top for tiers that have one. Returns encoded PNG bytes; no network.
import sharp from "sharp";
import type { Tier } from "../types.ts";

interface TierStyle {
  /** Tint colour. */
  color: string;
  /** Peak opacity of the gradient, 0 to 1. */
  strength: number;
  /** Draw the halftone dot pattern (needs a mask image). */
  halftone: boolean;
}

/** Colours are sampled from the in-game result screen; 5-star is a guess (not in the sample). */
export const TIER_STYLES: Readonly<Record<Tier, TierStyle>> = {
  3: { color: "#9a9a9a", strength: 0.15, halftone: false },
  4: { color: "#7b68d6", strength: 0.6, halftone: false },
  5: { color: "#e8c04a", strength: 0.65, halftone: false },
  6: { color: "#f0961e", strength: 0.8, halftone: true },
};

/** Where the gradient reaches full strength, as a fraction of the column height. */
const GLOW_PEAK = 0.2;
/** Strength at the bottom of the column, relative to the peak. */
const BOTTOM_FADE = 0.3;
/** Where the halftone square starts, as a fraction of the column height. */
const HALFTONE_TOP = 0.1;

function gradientSvg(style: TierStyle, width: number, height: number): Buffer {
  const { color, strength } = style;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
       <defs>
         <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0" stop-color="${color}" stop-opacity="0"/>
           <stop offset="${GLOW_PEAK}" stop-color="${color}" stop-opacity="${strength}"/>
           <stop offset="1" stop-color="${color}" stop-opacity="${strength * BOTTOM_FADE}"/>
         </linearGradient>
       </defs>
       <rect width="100%" height="100%" fill="url(#g)"/>
     </svg>`,
  );
}

/** A square of the tint colour whose opacity follows the mask's brightness. */
async function halftoneLayer(color: string, mask: Uint8Array, size: number): Promise<Buffer> {
  const alpha = await sharp(mask).resize(size, size).extractChannel(0).raw().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background: color } })
    .joinChannel(alpha, { raw: { width: size, height: size, channels: 1 } })
    .png()
    .toBuffer();
}

/**
 * @param halftoneMask White-dots-on-black image. Without it, halftone tiers get the gradient only.
 */
export async function renderColumnBackground(
  tier: Tier,
  width: number,
  height: number,
  halftoneMask?: Uint8Array,
): Promise<Buffer> {
  const style = TIER_STYLES[tier];
  const base = sharp(gradientSvg(style, width, height));
  if (!style.halftone || !halftoneMask) return base.png().toBuffer();

  const dots = await halftoneLayer(style.color, halftoneMask, width);
  return base.composite([{ input: dots, left: 0, top: Math.round(height * HALFTONE_TOP) }]).png().toBuffer();
}

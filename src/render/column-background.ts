// Tier-coloured backgrounds for one result column, in two parts:
//   glow  - full-height gradient that peaks at the panel's top and bottom edges
//   panel - the backdrop directly behind the portrait: the game's panel image if given, else drawn in code
// Tiers with `halftone` also get a dot pattern, which needs a mask image. Returns PNG bytes; no network.
import sharp from "sharp";
import type { Rng, Tier } from "../types.ts";

interface TierStyle {
  /** Glow colour. */
  glow: string;
  /** Glow opacity at the panel edges, 0 to 1. */
  glowStrength: number;
  /** Fallback panel gradient colours, top to bottom, used when there is no panel image. */
  panelTop: string;
  panelBottom: string;
  /** Multiply a panel image by this colour (the 5-star image is white and needs tinting). */
  panelTint?: string;
  /** Overlay a halftone dot pattern on the glow and the panel. */
  halftone: boolean;
  /** How many sparkles to scatter in one column's glow. */
  sparkles: number;
}

/** Colours are sampled from the in-game result screen; 5-star is a guess (not in the sample). */
export const TIER_STYLES: Readonly<Record<Tier, TierStyle>> = {
  3: { glow: "#9a9a9a", glowStrength: 0.12, panelTop: "#313131", panelBottom: "#313131", halftone: false, sparkles: 0 },
  4: { glow: "#9c8aee", glowStrength: 0.9, panelTop: "#b9bac0", panelBottom: "#4a4a52", halftone: false, sparkles: 22 },
  5: { glow: "#ffd23c", glowStrength: 0.9, panelTop: "#b9bac0", panelBottom: "#4a4a52", panelTint: "#ffd23c", halftone: false, sparkles: 36 },
  6: { glow: "#ffb52e", glowStrength: 0.95, panelTop: "#38392a", panelBottom: "#26261f", halftone: true, sparkles: 60 },
};

/**
 * How the glow fades, as [distance, opacity] pairs. Distance is 0 at the panel edge and 1 at the canvas
 * edge; opacity is a fraction of the tier's glowStrength. Shaped to match the in-game screen: dark far
 * from the panel, then a quick rise to full strength right at its edge.
 */
const GLOW_ABOVE: ReadonlyArray<readonly [number, number]> = [[1, 0], [0.55, 0.15], [0.2, 0.75], [0, 1]];
const GLOW_BELOW: ReadonlyArray<readonly [number, number]> = [[0, 1], [0.35, 0.8], [0.75, 0.2], [1, 0.05]];
/** Sparkle size (radius) and brightness ranges, in pixels and opacity. */
const SPARKLE_RADIUS = { min: 1, max: 3 };
const SPARKLE_OPACITY = { min: 0.4, max: 0.95 };
/** Size of one repeat of the halftone mask over the glow, in pixels. */
const GLOW_DOT_TILE = 24;
/** Dots over the glow are fainter than the glow itself. */
const GLOW_DOT_OPACITY = 0.5;

export interface ColumnGeometry {
  width: number;
  height: number;
  /** Panel position inside the column. */
  panelTop: number;
  panelHeight: number;
}

const verticalGradient = (width: number, height: number, stops: Array<[number, string, number]>) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
       <defs>
         <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
           ${stops.map(([at, color, opacity]) => `<stop offset="${at}" stop-color="${color}" stop-opacity="${opacity}"/>`).join("")}
         </linearGradient>
       </defs>
       <rect width="100%" height="100%" fill="url(#g)"/>
     </svg>`,
  );

/** A square of `color` whose opacity follows the mask's brightness (white = opaque). */
async function dotLayer(color: string, mask: Uint8Array, size: number, opacity = 1): Promise<Buffer> {
  const alpha = await sharp(mask)
    .resize(size, size)
    .extractChannel(0)
    .linear(opacity)
    .raw()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background: color } })
    .joinChannel(alpha, { raw: { width: size, height: size, channels: 1 } })
    .png()
    .toBuffer();
}

/** Full-height glow: transparent at the top, strongest along the panel's edges, faint at the bottom. */
export async function renderGlow(
  tier: Tier,
  { width, height, panelTop, panelHeight }: ColumnGeometry,
  halftoneMask?: Uint8Array,
): Promise<Buffer> {
  const style = TIER_STYLES[tier];
  const { glow, glowStrength } = style;
  const panelBottom = panelTop + panelHeight;
  const stops: Array<[number, string, number]> = [
    ...GLOW_ABOVE.map(([distance, opacity]): [number, string, number] => [
      (panelTop - distance * panelTop) / height,
      glow,
      opacity * glowStrength,
    ]),
    ...GLOW_BELOW.map(([distance, opacity]): [number, string, number] => [
      (panelBottom + distance * (height - panelBottom)) / height,
      glow,
      opacity * glowStrength,
    ]),
  ];
  const gradient = await sharp(verticalGradient(width, height, stops)).png().toBuffer();
  if (!style.halftone || !halftoneMask) return gradient;

  // Repeat the dots over the whole column, then keep them only where the glow is (dest-in = multiply alpha).
  const tile = await dotLayer(glow, halftoneMask, GLOW_DOT_TILE, GLOW_DOT_OPACITY);
  const dots = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: tile, tile: true }, { input: gradient, blend: "dest-in" }])
    .png()
    .toBuffer();
  return sharp(gradient).composite([{ input: dots }]).png().toBuffer();
}

/**
 * The game's panel images are 140x388, but the panel itself is only the 122x369 area at (9, 0);
 * the rest is a transparent margin holding the drop shadow. Crop to the panel before stretching.
 */
const PANEL_IMAGE_AREA = { left: 9, top: 0, width: 122, height: 369 };

export interface PanelSources {
  /** The game's panel image (140x388), stretched to fit. Without it the panel is a drawn gradient. */
  image?: Uint8Array;
  /** Halftone dot mask, for tiers that use dots. */
  halftoneMask?: Uint8Array;
}

/** The backdrop behind a portrait. */
export async function renderPanelBackground(
  tier: Tier,
  width: number,
  height: number,
  { image, halftoneMask }: PanelSources = {},
): Promise<Buffer> {
  const style = TIER_STYLES[tier];
  if (image) return panelFromImage(style, image, width, height);

  // Drawn gradient, plus one halftone square at the top for dotted tiers.
  const base = sharp(
    verticalGradient(width, height, [
      [0, style.panelTop, 1],
      [1, style.panelBottom, 1],
    ]),
  );
  if (!style.halftone || !halftoneMask) return base.png().toBuffer();

  const dots = await dotLayer(style.glow, halftoneMask, width);
  return base.composite([{ input: dots, left: 0, top: 0 }]).png().toBuffer();
}

async function panelFromImage(style: TierStyle, image: Uint8Array, width: number, height: number): Promise<Buffer> {
  const panel = sharp(image).extract(PANEL_IMAGE_AREA).resize(width, height, { fit: "fill" });
  if (!style.panelTint) return panel.png().toBuffer();
  const tint = { create: { width, height, channels: 3 as const, background: style.panelTint } };
  return panel
    .composite([{ input: await sharp(tint).png().toBuffer(), blend: "multiply" }])
    .png()
    .toBuffer();
}

/**
 * Small bright specks scattered through the glow (never over the panel), denser near the panel's edges.
 * Positions are random, so call this once per column with the render's `rng`.
 */
export async function renderSparkles(
  tier: Tier,
  { width, height, panelTop, panelHeight }: ColumnGeometry,
  rng: Rng,
): Promise<Buffer> {
  const panelBottom = panelTop + panelHeight;
  const between = (range: { min: number; max: number }) => range.min + rng() * (range.max - range.min);

  const specks = Array.from({ length: TIER_STYLES[tier].sparkles }, () => {
    const above = rng() < 0.5;
    const distance = rng() ** 2 * (above ? panelTop : height - panelBottom); // squared: bunched near the panel
    const y = above ? panelTop - distance : panelBottom + distance;
    return `<circle cx="${(rng() * width).toFixed(1)}" cy="${y.toFixed(1)}" r="${between(SPARKLE_RADIUS).toFixed(2)}"` +
      ` fill="#fff" fill-opacity="${between(SPARKLE_OPACITY).toFixed(2)}"/>`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><filter id="soft"><feGaussianBlur stdDeviation="0.6"/></filter></defs>
    <g filter="url(#soft)">${specks.join("")}</g>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

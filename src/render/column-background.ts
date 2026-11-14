// Tier-coloured backgrounds for one result column, in two parts:
//   glow  - full-height gradient that peaks at the panel's top and bottom edges
//   panel - the backdrop directly behind the portrait: the game's panel image if given, else drawn in code
// Tiers with `halftone` also get a dot pattern, which needs a mask image. Returns PNG bytes; no network.
import sharp from "sharp";
import type { Rng, Tier } from "../types.ts";
import { verticalGradient, type GradientStop } from "./svg.ts";

interface TierStyle {
  /** Glow colour. */
  glow: string;
  /** How white the glow turns right at the panel's edge (0 = not at all, 1 = white): a bright halo. */
  rim: number;
  /** Glow opacity at the panel edges, 0 to 1. */
  glowStrength: number;
  /** Fallback panel gradient colours, top to bottom, used when there is no panel image. */
  panelTop: string;
  panelBottom: string;
  /** Overlay a halftone dot pattern on the glow and the panel. */
  halftone: boolean;
  /** How many sparkles to scatter in one column's glow. */
  sparkles: number;
}

/** Colours are sampled from two in-game result screenshots. */
export const TIER_STYLES: Readonly<Record<Tier, TierStyle>> = {
  3: { glow: "#9a9a9a", rim: 0, glowStrength: 0.12, panelTop: "#313131", panelBottom: "#313131", halftone: false, sparkles: 0 },
  4: { glow: "#9c8aee", rim: 0.7, glowStrength: 0.9, panelTop: "#b9bac0", panelBottom: "#4a4a52", halftone: false, sparkles: 22 },
  5: { glow: "#f0dcb8", rim: 0, glowStrength: 0.95, panelTop: "#fdfdfd", panelBottom: "#8f8f8f", halftone: false, sparkles: 36 },
  6: { glow: "#ffb52e", rim: 0, glowStrength: 0.95, panelTop: "#38392a", panelBottom: "#26261f", halftone: true, sparkles: 60 },
};

/**
 * How the glow fades, as [distance, opacity, whiteness] triples. Distance is 0 at the panel edge and 1 at the
 * canvas edge; opacity is a fraction of the tier's glowStrength; whiteness is a fraction of the tier's `rim`.
 * Shaped to match the in-game screen: dark far from the panel, then a quick rise to full strength right at its
 * edge, where some tiers also turn whitish.
 */
type RampStop = readonly [distance: number, opacity: number, whiteness: number];
const GLOW_ABOVE: readonly RampStop[] = [[1, 0, 0], [0.55, 0.15, 0], [0.2, 0.75, 0.15], [0, 1, 1]];
const GLOW_BELOW: readonly RampStop[] = [[0, 1, 1], [0.35, 0.8, 0.1], [0.75, 0.2, 0], [1, 0.05, 0]];
/** Sparkle size (radius) and brightness ranges, in pixels and opacity. */
const SPARKLE_RADIUS = { min: 1, max: 3 };
const SPARKLE_OPACITY = { min: 0.4, max: 0.95 };

interface ColumnGeometry {
  width: number;
  height: number;
  /** Panel position inside the column. */
  panelTop: number;
  panelHeight: number;
}

/** `#rrggbb` moved toward white by `amount` (0 = unchanged, 1 = white). */
function lighten(color: string, amount: number): string {
  const channel = (offset: number) => {
    const value = parseInt(color.slice(offset, offset + 2), 16);
    return Math.round(value + (255 - value) * amount).toString(16).padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

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
  const colourAt = (whiteness: number) => lighten(glow, whiteness * style.rim);
  const stops: GradientStop[] = [
    ...GLOW_ABOVE.map(([distance, opacity, whiteness]): GradientStop => [
      (panelTop - distance * panelTop) / height,
      colourAt(whiteness),
      opacity * glowStrength,
    ]),
    ...GLOW_BELOW.map(([distance, opacity, whiteness]): GradientStop => [
      (panelBottom + distance * (height - panelBottom)) / height,
      colourAt(whiteness),
      opacity * glowStrength,
    ]),
  ];
  const gradient = await sharp(verticalGradient(width, height, stops)).png().toBuffer();
  if (!style.halftone || !halftoneMask) return gradient;

  // Repeat the dots over the whole column, then keep them only where the glow is (dest-in = multiply alpha).
  const tile = await dotLayer(glow, halftoneMask, 24, 0.5); // 24px repeat, fainter than the glow itself
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

interface PanelSources {
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
  if (image) return sharp(image).extract(PANEL_IMAGE_AREA).resize(width, height, { fit: "fill" }).png().toBuffer();

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

/**
 * Small bright specks scattered through the glow, denser near the panel's edges. Their centres are never over the
 * panel (the blur may spill a pixel or two).
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
    const room = above ? panelTop : height - panelBottom;
    const distance = rng() ** 2 * room; // squared, so most sit close to the panel
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

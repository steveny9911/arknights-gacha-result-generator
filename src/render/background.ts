// Canvas background: a dark vertical gradient with a random hue. Returns PNG bytes; no network.
import sharp from "sharp";
import type { Rng } from "../types.ts";

/** Lightness range, in percent: nearly black at the top, a little lighter at the bottom. */
const TOP_LIGHTNESS = 4;
const BOTTOM_LIGHTNESS = 13;
const SATURATION = 28;
/** How far the bottom hue may drift from the top hue, in degrees (either direction). */
const HUE_DRIFT = 25;

/** CSS-style HSL (hue in degrees, s and l in percent) to a `#rrggbb` string. */
function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

export async function renderBackground(width: number, height: number, rng: Rng): Promise<Buffer> {
  const hue = rng() * 360;
  const bottomHue = (hue + (rng() * 2 - 1) * HUE_DRIFT + 360) % 360;
  const top = hslToHex(hue, SATURATION, TOP_LIGHTNESS);
  const bottom = hslToHex(bottomHue, SATURATION, BOTTOM_LIGHTNESS);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${top}"/>
        <stop offset="1" stop-color="${bottom}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

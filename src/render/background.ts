// Canvas background: a neutral grey vertical gradient like the in-game stage: black at the top, a bright
// floor reflection near the bottom, dark again at the very bottom. Returns PNG bytes; no network.
import sharp from "sharp";
import type { Rng } from "../types.ts";

/**
 * Grey level (0-255) at a height (0 = top, 1 = bottom), shaped after the in-game result screen. The 0.787 stop is
 * the floor reflection. The screen's padding strip reaches ~230 there, but inside the open columns it is far dimmer,
 * and a bright band pulls the eye off the portraits, so the peak is kept low.
 */
const PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.14, 1],
  [0.28, 8],
  [0.46, 12],
  [0.65, 26],
  [0.787, 100],
  [0.88, 80],
  [0.926, 52],
  [1, 28],
];

/** The random part: the whole profile is brightened or dimmed, and its middle stops slide up or down. */
const BRIGHTNESS = { min: 0.7, max: 1.1 };
const MAX_SHIFT = 0.03;

const hexGrey = (level: number) => {
  const channel = Math.round(Math.min(255, Math.max(0, level))).toString(16).padStart(2, "0");
  return `#${channel}${channel}${channel}`;
};

export async function renderBackground(width: number, height: number, rng: Rng): Promise<Buffer> {
  const brightness = BRIGHTNESS.min + rng() * (BRIGHTNESS.max - BRIGHTNESS.min);
  const shift = (rng() * 2 - 1) * MAX_SHIFT;
  const last = PROFILE.length - 1;

  const stops = PROFILE.map(([at, level], i) => {
    const offset = i === 0 || i === last ? at : at + shift; // the ends stay at the canvas edges
    return `<stop offset="${offset.toFixed(4)}" stop-color="${hexGrey(level * brightness)}"/>`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">${stops.join("")}</linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { TIER_STYLES, renderColumnBackground } from "../src/render/column-background.ts";

const W = 60;
const H = 200;

/** 8x8 mask: white dot in one corner, black elsewhere. */
const mask = async () =>
  new Uint8Array(
    await sharp({ create: { width: 8, height: 8, channels: 3, background: "#000" } })
      .composite([{ input: await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } }).png().toBuffer(), left: 0, top: 0 }])
      .png()
      .toBuffer(),
  );

const raw = (png: Buffer) => sharp(png).raw().toBuffer({ resolveWithObject: true });

describe("renderColumnBackground", () => {
  test("has the requested size", async () => {
    const meta = await sharp(await renderColumnBackground(4, W, H)).metadata();
    expect([meta.width, meta.height]).toEqual([W, H]);
  });

  test("fades in from a transparent top", async () => {
    const { data, info } = await raw(await renderColumnBackground(4, W, H));
    const alphaAt = (y: number) => data[(y * info.width + 5) * info.channels + 3]!;
    expect(alphaAt(0)).toBeLessThan(10); // gradient is sampled at pixel centres, so not exactly 0
    expect(alphaAt(Math.round(H * 0.2))).toBeGreaterThan(alphaAt(H - 1)); // peak is stronger than the bottom
    expect(alphaAt(H - 1)).toBeGreaterThan(0);
  });

  test("tiers have different colours", async () => {
    const colours = await Promise.all(
      ([3, 4, 5, 6] as const).map(async (tier) => {
        const { data, info } = await raw(await renderColumnBackground(tier, W, H));
        const i = (Math.round(H * 0.2) * info.width + 5) * info.channels;
        return [data[i], data[i + 1], data[i + 2]].join(",");
      }),
    );
    expect(new Set(colours).size).toBe(4);
  });

  test("the halftone mask changes only tiers that use it", async () => {
    const m = await mask();
    for (const tier of [3, 4, 5, 6] as const) {
      const without = (await raw(await renderColumnBackground(tier, W, H))).data;
      const withMask = (await raw(await renderColumnBackground(tier, W, H, m))).data;
      expect(without.equals(withMask)).toBe(!TIER_STYLES[tier].halftone);
    }
  });
});

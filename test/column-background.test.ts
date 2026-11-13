import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { TIER_STYLES, renderGlow, renderPanelBackground } from "../src/render/column-background.ts";

const GEOMETRY = { width: 60, height: 400, panelTop: 100, panelHeight: 200 };
const PANEL_BOTTOM = GEOMETRY.panelTop + GEOMETRY.panelHeight;
const TIERS = [3, 4, 5, 6] as const;

/** 8x8 mask: white dots in one corner, black elsewhere. */
const mask = async () =>
  new Uint8Array(
    await sharp({ create: { width: 8, height: 8, channels: 3, background: "#000" } })
      .composite([{ input: await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } }).png().toBuffer(), left: 0, top: 0 }])
      .png()
      .toBuffer(),
  );

const raw = async (png: Buffer) => {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number) => Array.from(data.slice((y * info.width + x) * 4, (y * info.width + x) * 4 + 4));
  return { data, info, at };
};

describe("renderGlow", () => {
  test("has the requested size", async () => {
    const meta = await sharp(await renderGlow(4, GEOMETRY)).metadata();
    expect([meta.width, meta.height]).toEqual([GEOMETRY.width, GEOMETRY.height]);
  });

  test("is strongest along the panel's edges and fades away from them", async () => {
    const { at } = await raw(await renderGlow(4, GEOMETRY));
    const alpha = (y: number) => at(5, y)[3]!;
    expect(alpha(0)).toBeLessThan(10); // dark at the top (sampled at pixel centres, so not exactly 0)
    expect(alpha(GEOMETRY.panelTop - 1)).toBeGreaterThan(alpha(GEOMETRY.panelTop - 40));
    expect(alpha(GEOMETRY.panelTop - 40)).toBeGreaterThan(alpha(0));
    expect(alpha(PANEL_BOTTOM)).toBeGreaterThan(alpha(PANEL_BOTTOM + 50));
    expect(alpha(PANEL_BOTTOM + 50)).toBeGreaterThan(alpha(GEOMETRY.height - 1));
  });

  test("tiers have different colours", async () => {
    const colours = await Promise.all(
      TIERS.map(async (tier) => (await raw(await renderGlow(tier, GEOMETRY))).at(5, GEOMETRY.panelTop - 1).join(",")),
    );
    expect(new Set(colours).size).toBe(4);
  });

  test("the halftone mask changes only tiers that use it", async () => {
    const m = await mask();
    for (const tier of TIERS) {
      const without = (await raw(await renderGlow(tier, GEOMETRY))).data;
      const withMask = (await raw(await renderGlow(tier, GEOMETRY, m))).data;
      expect(without.equals(withMask)).toBe(!TIER_STYLES[tier].halftone);
    }
  });
});

describe("renderPanelBackground", () => {
  test("has the requested size and is opaque", async () => {
    const { info, at } = await raw(await renderPanelBackground(4, 60, 200));
    expect([info.width, info.height]).toEqual([60, 200]);
    expect(at(5, 5)[3]).toBe(255);
  });

  test("runs from the top colour to the bottom colour", async () => {
    const { at } = await raw(await renderPanelBackground(4, 60, 200));
    expect(at(5, 0)[0]).toBeGreaterThan(at(5, 199)[0]!); // light grey fading darker
  });

  test("uses the game's panel image, stretched to fit", async () => {
    const red = new Uint8Array(await sharp({ create: { width: 140, height: 388, channels: 3, background: "#ff0000" } }).png().toBuffer());
    const { info, at } = await raw(await renderPanelBackground(4, 60, 200, { image: red }));
    expect([info.width, info.height]).toEqual([60, 200]);
    expect(at(30, 100)).toEqual([255, 0, 0, 255]);
  });

  test("tints the 5-star panel image (it is white) but not the others", async () => {
    const white = new Uint8Array(await sharp({ create: { width: 140, height: 388, channels: 3, background: "#ffffff" } }).png().toBuffer());
    expect((await raw(await renderPanelBackground(4, 20, 20, { image: white }))).at(5, 5)).toEqual([255, 255, 255, 255]);
    expect((await raw(await renderPanelBackground(5, 20, 20, { image: white }))).at(5, 5)).toEqual([255, 210, 60, 255]);
  });

  test("the halftone mask changes only tiers that use it", async () => {
    const m = await mask();
    for (const tier of TIERS) {
      const without = (await raw(await renderPanelBackground(tier, 60, 200))).data;
      const withMask = (await raw(await renderPanelBackground(tier, 60, 200, { halftoneMask: m }))).data;
      expect(without.equals(withMask)).toBe(!TIER_STYLES[tier].halftone);
    }
  });
});

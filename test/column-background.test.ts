import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { seededRng } from "../src/gacha/seeded-rng.ts";
import { TIER_STYLES, renderGlow, renderPanelBackground, renderSparkles } from "../src/render/column-background.ts";

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

describe("renderSparkles", () => {
  const opaquePixels = async (png: Buffer) => {
    const { data, info } = await raw(png);
    const rows = new Set<number>();
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) rows.add(Math.floor(i / 4 / info.width));
    return rows;
  };

  test("has the column's size", async () => {
    const meta = await sharp(await renderSparkles(6, GEOMETRY, seededRng(1))).metadata();
    expect([meta.width, meta.height]).toEqual([GEOMETRY.width, GEOMETRY.height]);
  });

  test("3-star has none, higher tiers have some", async () => {
    expect((await opaquePixels(await renderSparkles(3, GEOMETRY, seededRng(1)))).size).toBe(0);
    for (const tier of [4, 5, 6] as const) {
      expect((await opaquePixels(await renderSparkles(tier, GEOMETRY, seededRng(1)))).size).toBeGreaterThan(0);
    }
  });

  test("stay out of the panel's middle", async () => {
    const rows = await opaquePixels(await renderSparkles(6, GEOMETRY, seededRng(1)));
    const margin = 5; // the soft edge of a sparkle on the boundary can spill a few pixels
    for (const y of rows) {
      expect(y < GEOMETRY.panelTop + margin || y >= PANEL_BOTTOM - margin).toBe(true);
    }
  });

  test("the same seed gives the same sparkles, another seed different ones", async () => {
    const a = await renderSparkles(6, GEOMETRY, seededRng(1));
    expect(a.equals(await renderSparkles(6, GEOMETRY, seededRng(1)))).toBe(true);
    expect(a.equals(await renderSparkles(6, GEOMETRY, seededRng(2)))).toBe(false);
  });
});

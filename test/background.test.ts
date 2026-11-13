import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { seededRng } from "../src/gacha/seeded-rng.ts";
import { renderBackground } from "../src/render/background.ts";

const H = 1000;

const rgb = async (png: Buffer, x: number, y: number) => {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i]!, data[i + 1]!, data[i + 2]!];
};

describe("renderBackground", () => {
  test("has the requested size", async () => {
    const meta = await sharp(await renderBackground(120, 80, seededRng(1))).metadata();
    expect([meta.width, meta.height]).toEqual([120, 80]);
  });

  test("is neutral grey, with no colour tint", async () => {
    const png = await renderBackground(60, H, seededRng(1));
    for (const y of [0, 200, 500, 800, 900, 999]) {
      const [r, g, b] = await rgb(png, 10, y);
      expect([r, g]).toEqual([b, b]);
    }
  });

  test("is black at the top, brightest near the floor line, and darker again at the bottom", async () => {
    const png = await renderBackground(60, H, seededRng(1));
    const level = async (y: number) => (await rgb(png, 10, y))[0]!;
    const floor = Math.max(...(await Promise.all([760, 790, 820, 850].map(level))));
    expect(await level(0)).toBeLessThan(5);
    expect(floor).toBeGreaterThan(150);
    expect(await level(H - 1)).toBeLessThan(floor / 2);
    expect(await level(500)).toBeLessThan(floor / 4); // the middle stays dark
  });

  test("varies only by row, not by column", async () => {
    const png = await renderBackground(120, 80, seededRng(1));
    expect(await rgb(png, 5, 40)).toEqual(await rgb(png, 110, 40));
  });

  test("the same seed gives the same background, another seed a different one", async () => {
    const a = await renderBackground(60, 40, seededRng(1));
    expect(a.equals(await renderBackground(60, 40, seededRng(1)))).toBe(true);
    expect(a.equals(await renderBackground(60, 40, seededRng(3)))).toBe(false);
  });
});

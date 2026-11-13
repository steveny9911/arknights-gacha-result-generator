import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { seededRng } from "../src/gacha/seeded-rng.ts";
import { renderBackground } from "../src/render/background.ts";

const rgb = async (png: Buffer, x: number, y: number) => {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i]!, data[i + 1]!, data[i + 2]!];
};
const brightness = (c: number[]) => c[0]! + c[1]! + c[2]!;

describe("renderBackground", () => {
  test("has the requested size", async () => {
    const meta = await sharp(await renderBackground(120, 80, seededRng(1))).metadata();
    expect([meta.width, meta.height]).toEqual([120, 80]);
  });

  test("is dark, and a little lighter at the bottom", async () => {
    const png = await renderBackground(120, 80, seededRng(1));
    const top = await rgb(png, 10, 0);
    const bottom = await rgb(png, 10, 79);
    expect(brightness(bottom)).toBeGreaterThan(brightness(top));
    expect(Math.max(...bottom)).toBeLessThan(80);
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

import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import {
  ICON_SIZE,
  ICON_TOP,
  MONTAGE_HEIGHT,
  MONTAGE_WIDTH_FOR,
  PADDING,
  PORTRAIT_HEIGHT,
  PORTRAIT_TOP,
  PORTRAIT_WIDTH,
  STARS_HEIGHT,
  renderMontage,
  type MontageEntry,
} from "../src/render/montage.ts";

type Rgb = [number, number, number];

const solid = async (w: number, h: number, rgb: Rgb) =>
  new Uint8Array(
    await sharp({ create: { width: w, height: h, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } })
      .png()
      .toBuffer(),
  );

const STARS_RGB: Rgb = [250, 250, 0];
const ICON_RGB: Rgb = [255, 255, 255];

const entry = async (portraitRgb: Rgb): Promise<MontageEntry> => ({
  operator: { id: "char_x", name: "x", rarity: 4, profession: "CASTER", inHeadhunting: true },
  portrait: await solid(PORTRAIT_WIDTH, PORTRAIT_HEIGHT, portraitRgb),
  classIcon: await solid(ICON_SIZE, ICON_SIZE, ICON_RGB),
  stars: await solid(100, 30, STARS_RGB),
});

/** RGB of one pixel of an encoded image. */
async function pixel(image: Uint8Array, x: number, y: number): Promise<number[]> {
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i]!, data[i + 1]!, data[i + 2]!];
}

describe("renderMontage", () => {
  test("output has the expected dimensions", async () => {
    const entries = await Promise.all(Array.from({ length: 10 }, () => entry([200, 0, 0])));
    const meta = await sharp(await renderMontage(entries)).metadata();
    expect(meta.width).toBe(MONTAGE_WIDTH_FOR(10));
    expect(meta.height).toBe(MONTAGE_HEIGHT);
    expect(meta.format).toBe("png");
  });

  test("portraits sit in order and flush", async () => {
    const entries = [await entry([255, 0, 0]), await entry([0, 255, 0]), await entry([0, 0, 255])];
    const image = await renderMontage(entries);
    const midY = PORTRAIT_TOP + PORTRAIT_HEIGHT / 2;
    expect(await pixel(image, PADDING + 10, midY)).toEqual([255, 0, 0]);
    expect(await pixel(image, PADDING + PORTRAIT_WIDTH + 10, midY)).toEqual([0, 255, 0]);
    expect(await pixel(image, PADDING + 2 * PORTRAIT_WIDTH + 10, midY)).toEqual([0, 0, 255]);
    expect(await pixel(image, PADDING + PORTRAIT_WIDTH - 1, midY)).toEqual([255, 0, 0]);
    expect(await pixel(image, PADDING + PORTRAIT_WIDTH, midY)).toEqual([0, 255, 0]);
  });

  test("stars are centred above the portrait, bottom-aligned to the star row", async () => {
    const image = await renderMontage([await entry([255, 0, 0])]);
    const centreX = PADDING + PORTRAIT_WIDTH / 2;
    const bottom = PADDING + STARS_HEIGHT - 1; // last row of the star band
    expect(await pixel(image, centreX, bottom)).toEqual(STARS_RGB);
    expect(await pixel(image, centreX, bottom - 29)).toEqual(STARS_RGB); // 30px tall
    expect(await pixel(image, centreX, bottom - 30)).toEqual(await pixel(image, 2, 2)); // above: background
    expect(await pixel(image, PADDING + 5, bottom)).toEqual(await pixel(image, 2, 2)); // 100px wide: edges empty
  });

  test("class icon tile is centred below the portrait", async () => {
    const image = await renderMontage([await entry([255, 0, 0])]);
    const centreX = PADDING + PORTRAIT_WIDTH / 2;
    expect(await pixel(image, centreX, ICON_TOP + ICON_SIZE / 2)).toEqual(ICON_RGB);
    expect(await pixel(image, centreX, ICON_TOP - 2)).toEqual(await pixel(image, 2, 2)); // gap is background
  });

  test("resizes portraits that are not 180x360", async () => {
    const odd = { ...(await entry([9, 9, 9])), portrait: await solid(90, 90, [9, 9, 9]) };
    const meta = await sharp(await renderMontage([odd])).metadata();
    expect(meta.width).toBe(MONTAGE_WIDTH_FOR(1));
  });

  test("webp output", async () => {
    const meta = await sharp(await renderMontage([await entry([1, 2, 3])], { format: "webp" })).metadata();
    expect(meta.format).toBe("webp");
  });

  test("empty input throws", async () => {
    expect(renderMontage([])).rejects.toThrow(RangeError);
  });
});

import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import {
  BACKGROUND,
  ICON_GAP,
  ICON_SIZE,
  MONTAGE_HEIGHT,
  MONTAGE_WIDTH_FOR,
  PADDING,
  PORTRAIT_HEIGHT,
  PORTRAIT_WIDTH,
  renderMontage,
  type MontageEntry,
} from "../src/render/montage.ts";

const solid = async (w: number, h: number, rgb: [number, number, number]) =>
  new Uint8Array(
    await sharp({ create: { width: w, height: h, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } })
      .png()
      .toBuffer(),
  );

const entry = async (rgb: [number, number, number]): Promise<MontageEntry> => ({
  operator: { id: "char_x", name: "x", rarity: 4, profession: "CASTER", inHeadhunting: true },
  portrait: await solid(PORTRAIT_WIDTH, PORTRAIT_HEIGHT, rgb),
  classIcon: await solid(26, 26, [255, 255, 255]),
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

  test("portraits sit in order, flush, with the icon centred below", async () => {
    const entries = [await entry([255, 0, 0]), await entry([0, 255, 0]), await entry([0, 0, 255])];
    const image = await renderMontage(entries);
    const midY = PADDING + PORTRAIT_HEIGHT / 2;
    expect(await pixel(image, PADDING + 10, midY)).toEqual([255, 0, 0]);
    expect(await pixel(image, PADDING + PORTRAIT_WIDTH + 10, midY)).toEqual([0, 255, 0]);
    expect(await pixel(image, PADDING + 2 * PORTRAIT_WIDTH + 10, midY)).toEqual([0, 0, 255]);
    // Last column of one portrait and first of the next touch: no gap.
    expect(await pixel(image, PADDING + PORTRAIT_WIDTH - 1, midY)).toEqual([255, 0, 0]);
    expect(await pixel(image, PADDING + PORTRAIT_WIDTH, midY)).toEqual([0, 255, 0]);

    const iconY = PADDING + PORTRAIT_HEIGHT + ICON_GAP + ICON_SIZE / 2;
    expect(await pixel(image, PADDING + PORTRAIT_WIDTH / 2, iconY)).toEqual([255, 255, 255]);
    // Gap between portrait and icon, and the margin, show the background.
    expect(await pixel(image, PADDING + PORTRAIT_WIDTH / 2, PADDING + PORTRAIT_HEIGHT + 2)).toEqual(
      await pixel(image, 2, 2),
    );
    expect(BACKGROUND).toBe("#141414");
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

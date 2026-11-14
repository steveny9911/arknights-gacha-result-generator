import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { seededRng } from "../src/gacha/seeded-rng.ts";
import {
  CANVAS_HEIGHT,
  COLUMN_WIDTH,
  GLOW_GAP,
  ICON_SCALE,
  montageWidthFor,
  PADDING_X,
  PANEL_BOTTOM,
  PANEL_HEIGHT,
  PANEL_TOP,
  renderMontage as render,
  type MontageEntry,
  type MontageOptions,
} from "../src/render/montage.ts";
import type { Tier } from "../src/types.ts";

type Rgb = [number, number, number];

/** renderMontage with a fixed seed, so the random background and sparkles are the same every run. */
const renderMontage = (entries: readonly MontageEntry[], opts: MontageOptions = {}) =>
  render(entries, { rng: seededRng(7), ...opts });

const solid = async (w: number, h: number, rgb: Rgb) =>
  new Uint8Array(
    await sharp({ create: { width: w, height: h, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } })
      .png()
      .toBuffer(),
  );

const STARS_RGB: Rgb = [250, 250, 0];
const ICON_RGB: Rgb = [255, 255, 255];
const STARS_HEIGHT = 30;

const entry = async (portraitRgb: Rgb, rarity: Tier = 4): Promise<MontageEntry> => ({
  operator: { id: "char_x", name: "x", rarity, profession: "CASTER", inHeadhunting: true },
  portrait: await solid(180, 360, portraitRgb),
  classIcon: await solid(108, 109, ICON_RGB),
  stars: await solid(100, STARS_HEIGHT, STARS_RGB),
});

/** RGB of one pixel of an encoded image. */
async function pixel(image: Uint8Array, x: number, y: number): Promise<number[]> {
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i]!, data[i + 1]!, data[i + 2]!];
}

const columnLeft = (i: number) => PADDING_X + i * COLUMN_WIDTH;
const columnCentre = (i: number) => columnLeft(i) + Math.floor(COLUMN_WIDTH / 2);

describe("renderMontage", () => {
  test("ten columns make a 1920x1080 canvas", async () => {
    const entries = await Promise.all(Array.from({ length: 10 }, () => entry([200, 0, 0])));
    const meta = await sharp(await renderMontage(entries)).metadata();
    expect([meta.width, meta.height]).toEqual([1920, 1080]);
    expect(meta.width).toBe(montageWidthFor(10));
    expect(meta.height).toBe(CANVAS_HEIGHT);
    expect(meta.format).toBe("png");
  });

  test("portraits fill their panels, in order and flush", async () => {
    const entries = [await entry([255, 0, 0]), await entry([0, 255, 0]), await entry([0, 0, 255])];
    const image = await renderMontage(entries);
    const midY = PANEL_TOP + PANEL_HEIGHT / 2; // between the stars and the icon
    expect(await pixel(image, columnLeft(0) + 10, midY)).toEqual([255, 0, 0]);
    expect(await pixel(image, columnLeft(1) + 10, midY)).toEqual([0, 255, 0]);
    expect(await pixel(image, columnLeft(2) + 10, midY)).toEqual([0, 0, 255]);
    expect(await pixel(image, columnLeft(1) - 1, midY)).toEqual([255, 0, 0]); // no gap
    expect(await pixel(image, columnLeft(1), midY)).toEqual([0, 255, 0]);
  });

  test("stars straddle the panel's top edge", async () => {
    const image = await renderMontage([await entry([255, 0, 0])]);
    const x = columnCentre(0);
    expect(await pixel(image, x, PANEL_TOP - 5)).toEqual(STARS_RGB); // above the panel
    expect(await pixel(image, x, PANEL_TOP + 5)).toEqual(STARS_RGB); // over the portrait
    // Past the 30px-tall star image, in either direction, it's just glow or portrait.
    expect(await pixel(image, x, PANEL_TOP - STARS_HEIGHT)).toEqual(await pixel(image, columnLeft(0) + 5, PANEL_TOP - STARS_HEIGHT));
    expect(await pixel(image, x, PANEL_TOP + STARS_HEIGHT)).toEqual([255, 0, 0]);
  });

  test("the icon's white tile is centred on the column and on the panel's bottom edge", async () => {
    // Like the game's icons: a 90x90 white tile at (9, 0) in a 108x109 image, black elsewhere.
    const tile = await sharp({ create: { width: 90, height: 90, channels: 3, background: "#ffffff" } }).png().toBuffer();
    const classIcon = new Uint8Array(
      await sharp({ create: { width: 108, height: 109, channels: 3, background: "#000000" } })
        .composite([{ input: tile, left: 9, top: 0 }])
        .png()
        .toBuffer(),
    );
    const image = await renderMontage([{ ...(await entry([255, 0, 0])), classIcon }]);
    const x = columnCentre(0);
    const half = (90 * ICON_SCALE) / 2; // 67.5px
    for (const dx of [-half + 3, half - 3]) expect(await pixel(image, Math.round(x + dx), PANEL_BOTTOM)).toEqual(ICON_RGB);
    for (const dx of [-half - 3, half + 3]) expect(await pixel(image, Math.round(x + dx), PANEL_BOTTOM)).not.toEqual(ICON_RGB);
    for (const dy of [-half + 3, half - 3]) expect(await pixel(image, x, Math.round(PANEL_BOTTOM + dy))).toEqual(ICON_RGB);
    for (const dy of [-half - 3, half + 3]) expect(await pixel(image, x, Math.round(PANEL_BOTTOM + dy))).not.toEqual(ICON_RGB);
  });

  test("each column is tinted by its operator's tier", async () => {
    const tiers = [3, 4, 5, 6] as const;
    const entries = await Promise.all(tiers.map((tier) => entry([0, 0, 0], tier)));
    const image = await renderMontage(entries);
    const y = PANEL_BOTTOM + 110; // below the icon, so only the glow is visible
    const colours = await Promise.all(tiers.map((_, i) => pixel(image, columnLeft(i) + 4, y)));
    expect(new Set(colours.map((c) => c.join(","))).size).toBe(4);
    expect(await pixel(image, 2, y)).toEqual(await pixel(image, PADDING_X - 3, y)); // padding is just the canvas
  });

  test("a seam of canvas shows between neighbouring glows", async () => {
    const image = await renderMontage([await entry([0, 0, 0], 4), await entry([0, 0, 0], 4)]);
    const y = PANEL_TOP - 20; // glow is strong here
    const canvas = await pixel(image, 2, y); // the gradient only varies with y, so this is the canvas at the seam's row
    const seam = Array.from({ length: GLOW_GAP }, (_, i) => columnLeft(1) - GLOW_GAP + 1 + i);
    for (const x of seam) expect(await pixel(image, x, y)).toEqual(canvas);
    expect(await pixel(image, seam[0]! - 1, y)).not.toEqual(canvas); // glow right up to the seam
    expect(await pixel(image, seam.at(-1)! + 1, y)).not.toEqual(canvas);
  });

  test("the same seed gives the same image and another seed a different one", async () => {
    const entries = [await entry([0, 0, 0], 6), await entry([0, 0, 0], 4)];
    const a = await render(entries, { rng: seededRng(1) });
    const b = await render(entries, { rng: seededRng(1) });
    const c = await render(entries, { rng: seededRng(2) });
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    expect(Buffer.from(a).equals(Buffer.from(c))).toBe(false);
  });

  test("resizes portraits that are not 180x360", async () => {
    const odd = { ...(await entry([9, 9, 9])), portrait: await solid(90, 90, [9, 9, 9]) };
    const image = await renderMontage([odd]);
    expect((await sharp(image).metadata()).width).toBe(montageWidthFor(1));
    expect(await pixel(image, columnCentre(0), PANEL_TOP + PANEL_HEIGHT / 2)).toEqual([9, 9, 9]); // still fills the panel
  });

  test("the output is opaque (no alpha channel)", async () => {
    const meta = await sharp(await renderMontage([await entry([1, 2, 3])])).metadata();
    expect([meta.channels, meta.hasAlpha]).toEqual([3, false]);
  });

  test("webp output", async () => {
    const meta = await sharp(await renderMontage([await entry([1, 2, 3])], { format: "webp" })).metadata();
    expect(meta.format).toBe("webp");
  });

  test("empty input throws", async () => {
    await expect(renderMontage([])).rejects.toThrow(RangeError);
  });
});

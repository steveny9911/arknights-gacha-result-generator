import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { generateTenPullImage, seededRng, type DataProvider, type Operator, type Tier } from "../src/index.ts";

const png = async (w: number, h: number) =>
  new Uint8Array(
    await sharp({ create: { width: w, height: h, channels: 3, background: "#888" } }).png().toBuffer(),
  );

const tiers: Tier[] = [3, 4, 5, 6];
const operators: Record<string, Operator> = Object.fromEntries(
  tiers.map((rarity) => [
    `char_${rarity}`,
    { id: `char_${rarity}`, name: `op${rarity}`, nameEn: `op${rarity}`, rarity, profession: "CASTER", inHeadhunting: true },
  ]),
);

/** A provider that never touches the network. */
const fakeProvider: DataProvider = {
  getOperators: async () => operators,
  getPortrait: () => png(180, 360),
  getClassIcon: () => png(108, 109),
  getStars: () => png(100, 30),
  getPanelImage: async () => undefined,
  getHalftoneMask: () => png(64, 64),
};

describe("generateTenPullImage", () => {
  test("returns a 1920x1080 PNG, ten operators and their details in pull order", async () => {
    const { image, pulls, result } = await generateTenPullImage({ provider: fakeProvider, rng: seededRng(1) });
    const meta = await sharp(image).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["png", 1920, 1080]);
    expect(result.operators).toHaveLength(10);
    expect(pulls.map((op) => op.id)).toEqual(result.operators);
    for (const op of pulls) expect(op).toEqual(operators[op.id]!);
  });

  test("the same seed gives the same pull and the same image", async () => {
    const a = await generateTenPullImage({ provider: fakeProvider, rng: seededRng(5) });
    const b = await generateTenPullImage({ provider: fakeProvider, rng: seededRng(5) });
    expect(a.result).toEqual(b.result);
    expect(Buffer.from(a.image).equals(Buffer.from(b.image))).toBe(true);
  });

  test("startPity is honoured", async () => {
    const { result } = await generateTenPullImage({ provider: fakeProvider, startPity: 98, rng: seededRng(1) });
    expect(result.operators[0]).toBe("char_6");
  });

  test("a custom banner limits who can be pulled", async () => {
    const banner = { pool: { 3: ["char_3"], 4: ["char_3"], 5: ["char_5"], 6: ["char_5"] } };
    const { result } = await generateTenPullImage({ provider: fakeProvider, banner, rng: seededRng(3) });
    for (const id of result.operators) expect(["char_3", "char_5"]).toContain(id);
  });

  test("a bad startPity is rejected", async () => {
    for (const startPity of [NaN, 1.5, -1, 99]) {
      await expect(generateTenPullImage({ provider: fakeProvider, startPity })).rejects.toThrow(RangeError);
    }
  });

  test("an operator id missing from the table is an error", async () => {
    const banner = { pool: { 3: ["ghost"], 4: ["ghost"], 5: ["ghost"], 6: ["ghost"] } };
    await expect(generateTenPullImage({ provider: fakeProvider, banner })).rejects.toThrow("Unknown operator id: ghost");
  });

  test("a provider failure rejects the call", async () => {
    const broken = { ...fakeProvider, getPortrait: () => Promise.reject(new Error("no portrait")) };
    await expect(generateTenPullImage({ provider: broken, rng: seededRng(1) })).rejects.toThrow("no portrait");
  });
});

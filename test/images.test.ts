import { expect, test } from "bun:test";
import { pickPortraitFile, starsFile } from "../src/data/images.ts";

test("pickPortraitFile prefers _2, falls back to _1 and never picks a skin", () => {
  const files = new Set([
    "char_002_amiya_1.png",
    "char_002_amiya_2.png",
    "char_002_amiya_epoque#4.png",
    "char_999_low_1.png",
    "char_998_skinonly_sale#1.png",
  ]);
  expect(pickPortraitFile("char_002_amiya", files)).toBe("char_002_amiya_2.png");
  expect(pickPortraitFile("char_999_low", files)).toBe("char_999_low_1.png");
  expect(() => pickPortraitFile("char_998_skinonly", files)).toThrow();
});

test("starsFile is indexed from zero", () => {
  expect(starsFile(3)).toBe("rarity_2.png");
  expect(starsFile(6)).toBe("rarity_5.png");
});

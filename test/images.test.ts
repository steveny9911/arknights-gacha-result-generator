import { describe, expect, test } from "bun:test";
import { classIconFile, panelImageFile, pickPortraitFile, starsFile } from "../src/data/images.ts";

describe("pickPortraitFile", () => {
  const files = new Set([
    "char_002_amiya_1.png",
    "char_002_amiya_2.png",
    "char_002_amiya_epoque#4.png",
    "char_999_low_1.png",
    "char_998_skinonly_sale#1.png",
  ]);

  test("prefers _2", () => {
    expect(pickPortraitFile("char_002_amiya", files)).toBe("char_002_amiya_2.png");
  });

  test("falls back to _1", () => {
    expect(pickPortraitFile("char_999_low", files)).toBe("char_999_low_1.png");
  });

  test("never picks a skin", () => {
    expect(() => pickPortraitFile("char_998_skinonly", files)).toThrow();
  });
});

test("classIconFile lowercases the profession and picks the white-tile variant", () => {
  expect(classIconFile("CASTER")).toBe("icon_profession_caster_large_white.png");
  expect(classIconFile("PIONEER")).toBe("icon_profession_pioneer_large_white.png");
});

test("panelImageFile has art for 3-5 star only", () => {
  expect(panelImageFile(3)).toBe("back_low_1_3.png");
  expect(panelImageFile(4)).toBe("back_four.png");
  expect(panelImageFile(5)).toBe("back_five.png");
  expect(panelImageFile(6)).toBeUndefined();
});

test("starsFile is indexed from zero", () => {
  expect(starsFile(3)).toBe("rarity_2.png");
  expect(starsFile(6)).toBe("rarity_5.png");
});

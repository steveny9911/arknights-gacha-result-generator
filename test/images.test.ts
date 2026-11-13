import { describe, expect, test } from "bun:test";
import { classIconFile, pickPortraitFile } from "../src/data/images.ts";

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

test("classIconFile lowercases the profession", () => {
  expect(classIconFile("CASTER")).toBe("icon_profession_caster.png");
  expect(classIconFile("PIONEER")).toBe("icon_profession_pioneer.png");
});

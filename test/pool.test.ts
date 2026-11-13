import { describe, expect, test } from "bun:test";
import { parseCharacterTable } from "../src/data/character-table.ts";
import { buildBanner } from "../src/data/pool.ts";

const char = (over: Record<string, unknown>) => ({
  name: "x",
  rarity: "TIER_4",
  profession: "CASTER",
  isNotObtainable: false,
  itemObtainApproach: "招募寻访",
  ...over,
});

const RAW = {
  char_6: char({ rarity: "TIER_6" }),
  char_5: char({ rarity: "TIER_5" }),
  char_4: char({ rarity: "TIER_4" }),
  char_3: char({ rarity: "TIER_3", itemObtainApproach: "招募寻访、见习任务" }),
  char_event6: char({ rarity: "TIER_6", itemObtainApproach: "活动获得" }),
  char_shop4: char({ rarity: "TIER_4", itemObtainApproach: "信用交易所" }),
  char_nullapproach: char({ itemObtainApproach: null }),
  char_trainee: char({ rarity: "TIER_3", isNotObtainable: true }),
  char_tier2: char({ rarity: "TIER_2" }),
  char_badprofession: char({ profession: "TOKEN" }),
  token_summon: char({ rarity: "TIER_1" }),
  trap_001: char({}),
};

describe("parseCharacterTable", () => {
  const ops = parseCharacterTable(RAW);

  test("keeps only playable char_ operators of tier 3-6", () => {
    expect(Object.keys(ops).sort()).toEqual(
      ["char_3", "char_4", "char_5", "char_6", "char_event6", "char_nullapproach", "char_shop4"].sort(),
    );
  });

  test("converts TIER_n to a number and keeps the profession", () => {
    expect(ops.char_6).toMatchObject({ id: "char_6", rarity: 6, profession: "CASTER" });
  });

  test("flags headhunting by itemObtainApproach prefix", () => {
    expect(ops.char_6!.inHeadhunting).toBe(true);
    expect(ops.char_3!.inHeadhunting).toBe(true); // compound value 招募寻访、见习任务
    expect(ops.char_event6!.inHeadhunting).toBe(false);
    expect(ops.char_shop4!.inHeadhunting).toBe(false);
    expect(ops.char_nullapproach!.inHeadhunting).toBe(false);
  });
});

describe("buildBanner", () => {
  test("groups headhunting operators by tier and drops event/shop ones", () => {
    const { pool } = buildBanner(parseCharacterTable(RAW));
    expect(pool[6]).toEqual(["char_6"]);
    expect(pool[5]).toEqual(["char_5"]);
    expect(pool[4]).toEqual(["char_4"]);
    expect(pool[3]).toEqual(["char_3"]);
  });

  test("throws when a tier is empty", () => {
    const { char_6: _drop, ...rest } = RAW;
    expect(() => buildBanner(parseCharacterTable(rest))).toThrow(RangeError);
  });
});

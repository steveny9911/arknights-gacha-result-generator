import { describe, expect, test } from "bun:test";
import { pickOperator, rollRarity, sixStarRate, tenPull, weightedPick } from "../src/gacha/gacha.ts";
import { seededRng } from "../src/gacha/seeded-rng.ts";
import type { Banner, Rng, Tier } from "../src/types.ts";

/** A fake rng that returns the given numbers in order. */
const seq = (...values: number[]): Rng => {
  let i = 0;
  return () => values[i++]!;
};

/** A fake rng that always returns the same number. */
const constant = (value: number): Rng => () => value;

const BANNER: Banner = {
  pool: {
    6: ["six_a", "six_b", "six_c"],
    5: ["five_a", "five_b"],
    4: ["four_a", "four_b"],
    3: ["three_a", "three_b"],
  },
};

const TIER_OF = new Map<string, Tier>();
for (const tier of [6, 5, 4, 3] as const) {
  for (const op of BANNER.pool[tier]) TIER_OF.set(op, tier);
}
const tierOf = (op: string): Tier => TIER_OF.get(op)!;

describe("weightedPick", () => {
  test("number line rolls", () => {
    const options: Array<[Tier, number]> = [[6, 0.02], [5, 0.08], [4, 0.5], [3, 0.4]];
    for (const [roll, expected] of [[0.015, 6], [0.05, 5], [0.37, 4], [0.95, 3]] as const) {
      expect(weightedPick(options, constant(roll))).toBe(expected);
    }
  });

  test("weights need not add to one", () => {
    const options: Array<[string, number]> = [["A", 1], ["B", 3]];
    expect(weightedPick(options, constant(0.24))).toBe("A");
    expect(weightedPick(options, constant(0.26))).toBe("B");
  });

  test("a roll near one returns the last item", () => {
    expect(weightedPick([["A", 1], ["B", 1]], constant(0.9999999))).toBe("B");
  });

  test("invalid input throws", () => {
    expect(() => weightedPick([])).toThrow(RangeError);
    expect(() => weightedPick([["A", -1]])).toThrow(RangeError);
    expect(() => weightedPick([["A", 0]])).toThrow(RangeError);
  });
});

describe("sixStarRate", () => {
  test("pity table", () => {
    const table: Array<[number, number]> = [[0, 0.02], [49, 0.02], [50, 0.04], [51, 0.06], [60, 0.24], [98, 1.0]];
    for (const [pity, expected] of table) {
      expect(sixStarRate(pity)).toBeCloseTo(expected, 10);
    }
  });

  test("capped at one", () => {
    expect(sixStarRate(150)).toBe(1.0);
  });

  test("negative pity throws", () => {
    expect(() => sixStarRate(-1)).toThrow(RangeError);
  });
});

describe("input validation", () => {
  test("sixStarRate rejects NaN and fractions", () => {
    expect(() => sixStarRate(NaN)).toThrow(RangeError);
    expect(() => sixStarRate(1.5)).toThrow(RangeError);
  });

  test("tenPull rejects a bad startPity", () => {
    for (const bad of [NaN, 1.5, -1, 99, 200]) expect(() => tenPull(BANNER, bad)).toThrow(RangeError);
  });

  test("tenPull accepts the whole 0 to 98 range", () => {
    expect(() => tenPull(BANNER, 0, seededRng(1))).not.toThrow();
    expect(() => tenPull(BANNER, 98, seededRng(1))).not.toThrow();
  });

  test("seededRng rejects non-integer seeds", () => {
    for (const bad of [NaN, 1.5, Infinity]) expect(() => seededRng(bad)).toThrow(RangeError);
  });
});

describe("rollRarity", () => {
  test("fresh pity boundaries", () => {
    for (const [roll, expected] of [[0.015, 6], [0.05, 5], [0.37, 4], [0.95, 3]] as const) {
      expect(rollRarity(0, constant(roll))).toBe(expected);
    }
  });

  test("pity 60 boundaries", () => {
    // 6-star 0-24%, 5-star to ~30.2%, 4-star to ~69.0%, then 3-star.
    for (const [roll, expected] of [[0.239, 6], [0.241, 5], [0.31, 4], [0.7, 3]] as const) {
      expect(rollRarity(60, constant(roll))).toBe(expected);
    }
  });

  test("a 6-star is certain at pity 98", () => {
    for (const roll of [0.0, 0.5, 0.999999]) {
      expect(rollRarity(98, constant(roll))).toBe(6);
    }
  });

  test("minRarity returns only 5 or 6", () => {
    // At pity 9: 6-star 0.02 and 5-star 0.08, so 20% / 80% once filtered.
    expect(rollRarity(9, constant(0.19), 5)).toBe(6);
    expect(rollRarity(9, constant(0.21), 5)).toBe(5);
    expect(rollRarity(9, constant(0.999), 5)).toBe(5);
  });
});

describe("pickOperator", () => {
  test("is uniform within the tier with a single rng call", () => {
    expect(pickOperator(6, BANNER, seq(0.0))).toBe("six_a");
    expect(pickOperator(6, BANNER, seq(0.34))).toBe("six_b");
    expect(pickOperator(6, BANNER, seq(0.99))).toBe("six_c");
  });

  test("a roll of exactly 1 stays in range", () => {
    expect(pickOperator(4, BANNER, constant(1))).toBe("four_b");
  });

  test("an empty tier throws", () => {
    const empty: Banner = { pool: { 6: [], 5: [], 4: [], 3: [] } };
    expect(() => pickOperator(6, empty)).toThrow(RangeError);
  });
});

describe("tenPull", () => {
  test("ten results and the guarantee fires", () => {
    // rng 0.5 rolls a 4-star every time; the last pull is forced to 5-star+.
    const result = tenPull(BANNER, 0, constant(0.5));
    expect(result.operators).toHaveLength(10);
    const tiers = result.operators.map(tierOf);
    expect(tiers.slice(0, 9)).toEqual(Array(9).fill(4));
    expect(tiers[9]).toBeGreaterThanOrEqual(5);
    expect(result.finalPity).toBe(10);
  });

  test("all six-stars reset pity", () => {
    const result = tenPull(BANNER, 0, constant(0.0));
    expect(result.operators.every((op) => tierOf(op) === 6)).toBe(true);
    expect(result.finalPity).toBe(0);
  });

  test("start pity 98 gives a six-star first", () => {
    const result = tenPull(BANNER, 98, constant(0.999));
    expect(tierOf(result.operators[0]!)).toBe(6);
  });

  test("statistics match the expected shares", () => {
    const rng = seededRng(1234);
    const counts: Record<Tier, number> = { 6: 0, 5: 0, 4: 0, 3: 0 };
    const runs = 20_000;
    for (let i = 0; i < runs; i++) {
      const tiers = tenPull(BANNER, 0, rng).operators.map(tierOf);
      expect(tiers.some((t) => t >= 5)).toBe(true); // guarantee holds
      for (const t of tiers) counts[t]++;
    }
    const total = runs * 10;
    // Expected with the guarantee on a fresh account: ~2.7 / 10.8 / 48.0 / 38.5 %.
    expect(Math.abs(counts[6] / total - 0.027)).toBeLessThan(0.003);
    expect(Math.abs(counts[5] / total - 0.108)).toBeLessThan(0.005);
    expect(Math.abs(counts[4] / total - 0.48)).toBeLessThan(0.008);
    expect(Math.abs(counts[3] / total - 0.385)).toBeLessThan(0.008);
  });
});

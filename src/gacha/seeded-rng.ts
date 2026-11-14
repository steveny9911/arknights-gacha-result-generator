import type { Rng } from "../types.ts";

/**
 * Small deterministic generator (mulberry32): the same seed always gives the same sequence.
 * @throws {RangeError} If `seed` is not an integer.
 */
export function seededRng(seed: number): Rng {
  if (!Number.isInteger(seed)) throw new RangeError("seed must be an integer");
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// SLICE 2: turn the operator table into a Banner pool.
// Filter: id starts with `char_`, not isNotObtainable, rarity TIER_3..TIER_6.
import type { Banner, Operator, Tier } from "../types.ts";

export function buildBanner(_operators: Record<string, Operator>): Banner {
  throw new Error("Slice 2: buildBanner not implemented");
}

export type { Tier };

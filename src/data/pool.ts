// SLICE 2: turn the operator table into a Banner pool.
// No rate-up: every operator in a tier is equally likely.
import type { Banner, Operator, Tier } from "../types.ts";

const TIERS: readonly Tier[] = [6, 5, 4, 3];

/**
 * Standard banner pool: every operator flagged `inHeadhunting` (limited-banner operators included), grouped by tier.
 * @throws {RangeError} If a tier ends up empty (the table is broken or filtered wrongly).
 */
export function buildBanner(operators: Record<string, Operator>): Banner {
  const pool: Record<Tier, string[]> = { 6: [], 5: [], 4: [], 3: [] };
  for (const op of Object.values(operators)) {
    if (op.inHeadhunting) pool[op.rarity].push(op.id);
  }
  for (const tier of TIERS) {
    if (pool[tier].length === 0) throw new RangeError(`no headhunting operators of tier ${tier}`);
  }
  return { pool };
}

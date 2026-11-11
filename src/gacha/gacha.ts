// SLICE 1: the gacha algorithm. Pure functions, no I/O.
// Pipeline for one pull: sixStarRate -> rollRarity -> pickOperator.
// tenPull repeats it ten times with a "5-star or better" guarantee.
// No rate-up: every operator in a tier is equally likely.
import type { Banner, Rng, TenPullResult, Tier } from "../types.ts";
import {
  LOWEST_RARITY,
  MAX_PROBABILITY,
  MIN_GUARANTEED_RARITY,
  NON_SIX_TOTAL,
  PITY_STEP,
  PITY_THRESHOLD,
  RATE_3,
  RATE_4,
  RATE_5,
  RATE_6,
  TEN_PULL_SIZE,
} from "./constants.ts";

/** Base rate per tier, highest tier first. */
const BASE_RATES: ReadonlyArray<readonly [Tier, number]> = [
  [6, RATE_6],
  [5, RATE_5],
  [4, RATE_4],
  [3, RATE_3],
];

/**
 * Pick one item with probability proportional to its weight.
 * Weights need not add up to 1, but at least one must be above zero.
 * @throws {RangeError} On empty options, a negative weight, or a zero total.
 */
export function weightedPick<T>(
  options: ReadonlyArray<readonly [T, number]>,
  rng: Rng = Math.random,
): T {
  if (options.length === 0) throw new RangeError("options must not be empty");
  if (options.some(([, weight]) => weight < 0)) {
    throw new RangeError("weights must not be negative");
  }
  const total = options.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) throw new RangeError("weights must add up to more than zero");

  // Stretch the roll over the whole weight range, then walk the number line.
  let roll = rng() * total;
  for (const [item, weight] of options) {
    if (roll < weight) return item;
    roll -= weight;
  }
  // Rounding error can leave the roll just past the last slice.
  return options[options.length - 1]![0];
}

/**
 * Chance that the next pull is a 6-star: 2% until PITY_THRESHOLD misses, then
 * +2 points per pull, capped at 1.
 * @param pity Misses in a row so far (0 right after a 6-star).
 * @throws {RangeError} If `pity` is negative.
 */
export function sixStarRate(pity: number): number {
  if (pity < 0) throw new RangeError("pity must not be negative");
  if (pity < PITY_THRESHOLD) return RATE_6;
  const boostedPulls = pity - PITY_THRESHOLD + 1; // first boosted pull counts as 1
  return Math.min(MAX_PROBABILITY, RATE_6 + PITY_STEP * boostedPulls);
}

/**
 * Roll the star tier of one pull.
 * @param minRarity Lowest tier allowed. With 5 only 5 and 6 can result, with the
 *   same relative odds as re-rolling until a 5-star or better (ten-pull guarantee).
 */
export function rollRarity(
  pity: number,
  rng: Rng = Math.random,
  minRarity: number = LOWEST_RARITY,
): Tier {
  const p6 = sixStarRate(pity);
  const remaining = MAX_PROBABILITY - p6;
  // ASSUMPTION: lower tiers shrink in proportion to their base rates while the
  // 6-star rate climbs. No source confirms how the game does it.
  const options: Array<readonly [Tier, number]> = [[6, p6]];
  for (const [tier, base] of BASE_RATES.slice(1)) {
    options.push([tier, (remaining * base) / NON_SIX_TOTAL]);
  }
  const allowed = options.filter(([tier]) => tier >= minRarity);
  return weightedPick(allowed, rng);
}

/**
 * Pick which operator of a tier appears; all operators in the tier are equally likely.
 * @throws {RangeError} If the banner has no operators in that tier.
 */
export function pickOperator(rarity: Tier, banner: Banner, rng: Rng = Math.random): string {
  const tierPool = banner.pool[rarity] ?? [];
  if (tierPool.length === 0) {
    throw new RangeError(`banner has no operators of tier ${rarity}`);
  }
  return tierPool[Math.min(Math.floor(rng() * tierPool.length), tierPool.length - 1)]!;
}

/**
 * Simulate ten pulls with the "5-star or better" guarantee.
 * ASSUMPTION: the guarantee is applied to every call (the game applies it to the
 * first ten pulls on a banner only).
 * @param startPity Misses already counted before the first pull.
 */
export function tenPull(
  banner: Banner,
  startPity: number = 0,
  rng: Rng = Math.random,
): TenPullResult {
  let pity = startPity;
  const operators: string[] = [];
  let gotGuaranteed = false;

  for (let pullNumber = 1; pullNumber <= TEN_PULL_SIZE; pullNumber++) {
    // On the last pull, if the guarantee is unmet, only roll tiers that satisfy it.
    const needsGuarantee = pullNumber === TEN_PULL_SIZE && !gotGuaranteed;
    const rarity = rollRarity(pity, rng, needsGuarantee ? MIN_GUARANTEED_RARITY : LOWEST_RARITY);

    pity = rarity === 6 ? 0 : pity + 1;
    if (rarity >= MIN_GUARANTEED_RARITY) gotGuaranteed = true;

    operators.push(pickOperator(rarity, banner, rng));
  }

  return { operators, finalPity: pity };
}

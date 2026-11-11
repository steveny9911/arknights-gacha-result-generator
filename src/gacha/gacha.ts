// SLICE 1: the gacha algorithm. Pure functions, no I/O, no dependencies.
// Reference implementation: "Arknights 10-pull gacha simulator" doc, gacha.ts.
// Pipeline: sixStarRate -> rollRarity -> pickOperator, repeated by tenPull.
import type { Banner, Rng, Tier, TenPullResult } from "../types.ts";

const todo = (name: string): never => {
  throw new Error(`Slice 1: ${name} not implemented`);
};

export function weightedPick<T>(
  _options: ReadonlyArray<readonly [T, number]>,
  _rng: Rng = Math.random,
): T {
  return todo("weightedPick");
}

export function sixStarRate(_pity: number): number {
  return todo("sixStarRate");
}

export function rollRarity(_pity: number, _rng: Rng = Math.random, _minRarity = 3): Tier {
  return todo("rollRarity");
}

export function pickOperator(_rarity: Tier, _banner: Banner, _rng: Rng = Math.random): string {
  return todo("pickOperator");
}

export function tenPull(
  _banner: Banner,
  _startPity = 0,
  _rng: Rng = Math.random,
): TenPullResult {
  return todo("tenPull");
}

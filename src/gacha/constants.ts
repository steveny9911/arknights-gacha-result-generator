// Every number in the algorithm, declared once. See docs/SLICES.md (slice 1).
export const RATE_6 = 0.02;
export const RATE_5 = 0.08;
export const RATE_4 = 0.5;
export const RATE_3 = 0.4;
export const NON_SIX_TOTAL = RATE_5 + RATE_4 + RATE_3;

export const PITY_THRESHOLD = 50;
export const PITY_STEP = 0.02;
export const MAX_PROBABILITY = 1.0;
/** From this many misses the next 6-star is certain (2% + 2% x 49 boosted pulls = 100%). */
export const MAX_PITY = 98;

export const TEN_PULL_SIZE = 10;
export const MIN_GUARANTEED_RARITY = 5;
export const LOWEST_RARITY = 3;

/** A star tier that can appear in a headhunting pull. */
export type Tier = 6 | 5 | 4 | 3;

/** A source of randomness: each call returns a number in [0, 1). */
export type Rng = () => number;

/** Operator classes, as named in character_table.json `profession`. */
export const PROFESSIONS = ["PIONEER", "WARRIOR", "TANK", "SNIPER", "CASTER", "SUPPORT", "MEDIC", "SPECIAL"] as const;
export type Profession = (typeof PROFESSIONS)[number];

/** The slice of operator data this project needs. */
export interface Operator {
  /** e.g. `char_002_amiya` */
  id: string;
  /** Chinese name (zh_CN table). */
  name: string;
  /** English name: the EN client's name, else the zh_CN `appellation`, else `name`. */
  nameEn: string;
  rarity: Tier;
  profession: Profession;
  /** True if the operator is in the standard headhunting pool (not event/shop-only). */
  inHeadhunting: boolean;
}

/** Operator ids available in each tier. No rate-up: every operator in a tier is equally likely. */
export interface Banner {
  pool: Readonly<Record<Tier, readonly string[]>>;
}

export interface TenPullResult {
  /** Ten operator ids in pull order. */
  operators: string[];
  /** Misses in a row after the last pull. */
  finalPity: number;
}

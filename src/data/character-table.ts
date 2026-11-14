// SLICE 2: parse Kengxxiao's zh_CN character_table.json into Operator records.
import { PROFESSIONS, type Operator, type Profession, type Tier } from "../types.ts";

/** The fields we read from one character_table.json entry. */
interface RawCharacter {
  name: string;
  rarity: string; // "TIER_1" .. "TIER_6"
  profession: string;
  isNotObtainable: boolean;
  itemObtainApproach: string | null;
}

const KNOWN_PROFESSIONS: ReadonlySet<string> = new Set(PROFESSIONS);

/** `itemObtainApproach` text for headhunting ("recruit"); one entry also appends "、见习任务". */
const HEADHUNTING_APPROACH = "招募寻访";

const TIER_PREFIX = "TIER_";

/** `TIER_6` -> 6, or undefined for tiers headhunting can't give (1, 2) or bad input. */
function parseTier(rarity: string): Tier | undefined {
  if (!rarity.startsWith(TIER_PREFIX)) return undefined;
  const n = Number(rarity.slice(TIER_PREFIX.length));
  return n >= 3 && n <= 6 ? (n as Tier) : undefined;
}

/**
 * Keep playable operators (`char_` ids, `isNotObtainable` false, tier 3-6) and flag
 * which of them are in standard headhunting via `itemObtainApproach`.
 * Limited-banner operators are still flagged `inHeadhunting` (their approach is also 招募寻访).
 */
export function parseCharacterTable(raw: Record<string, RawCharacter>): Record<string, Operator> {
  const operators: Record<string, Operator> = {};
  for (const [id, c] of Object.entries(raw)) {
    if (!id.startsWith("char_") || c.isNotObtainable) continue;
    const rarity = parseTier(c.rarity);
    if (rarity === undefined || !KNOWN_PROFESSIONS.has(c.profession)) continue;
    operators[id] = {
      id,
      name: c.name,
      rarity,
      profession: c.profession as Profession,
      inHeadhunting: c.itemObtainApproach?.startsWith(HEADHUNTING_APPROACH) ?? false,
    };
  }
  return operators;
}

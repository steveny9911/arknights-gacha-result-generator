// SLICE 3: pure helpers that map operator ids / professions to ArknightsAssets2 file names.
import type { Profession, Tier } from "../types.ts";

/**
 * Portrait file for an operator: `<id>_2.png` (elite 2 art) if it exists, else `<id>_1.png`.
 * Skins (`<id>_name#N.png`) are never chosen because the names are built, not matched.
 * @param files File names in the charportraits folder.
 * @throws {Error} If neither variant exists.
 */
export function pickPortraitFile(id: string, files: ReadonlySet<string>): string {
  for (const variant of [`${id}_2.png`, `${id}_1.png`]) {
    if (files.has(variant)) return variant;
  }
  throw new Error(`No portrait found for ${id}`);
}

/** Class icon file (black glyph on a white tile), e.g. CASTER -> `icon_profession_caster_large_white.png`. */
export function classIconFile(profession: Profession): string {
  return `icon_profession_${profession.toLowerCase()}_large_white.png`;
}

/**
 * The game's portrait-panel art for a tier, or undefined where we don't have it.
 * `back_low_1_3` is the dark panel for 3-star and below. There is no panel image for 6-star: the game
 * draws it from a Spine texture page that isn't exported in any of the asset repos.
 */
export function panelImageFile(tier: Tier): string | undefined {
  const files: Partial<Record<Tier, string>> = { 3: "back_low_1_3.png", 4: "back_four.png", 5: "back_five.png" };
  return files[tier];
}

/** White star row for a tier. The files are indexed from 0, so `rarity_5.png` is six stars. */
export function starsFile(tier: Tier): string {
  return `rarity_${tier - 1}.png`;
}

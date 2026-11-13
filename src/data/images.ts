// SLICE 3: pure helpers that map operator ids / professions to ArknightsAssets2 file names.
import type { Profession } from "../types.ts";

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

/** Class icon file, e.g. CASTER -> `icon_profession_caster.png`. */
export function classIconFile(profession: Profession): string {
  return `icon_profession_${profession.toLowerCase()}.png`;
}

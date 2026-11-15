// Default DataProvider.
//   tables : Kengxxiao/ArknightsGameData  zh_CN/gamedata/excel/character_table.json
//   English names : ArknightsAssets/ArknightsGamedata  en/gamedata/excel/character_table.json (optional)
//   images : ArknightsAssets2 (cn branch) assets/dyn/arts/charportraits/
//                                         assets/dyn/arts/profession_large_hub/
//                                         assets/dyn/arts/rarity_hub/
//                                         assets/dyn/arts/[pack]cmgachapool/rgba/
//                                         assets/dyn/ui/recruit/gacha_result/
// Downloads are cached on disk under `cacheDir`, so only the first run needs the network.
// The operator table and portrait listing refresh after 7 days; images are kept for good.
import type { Profession, Tier } from "../types.ts";
import { parseCharacterTable } from "./character-table.ts";
import { fetchCached } from "./fetch-cache.ts";
import { classIconFile, PANEL_FILES, pickPortraitFile, starsFile } from "./images.ts";
import type { DataProvider } from "./provider.ts";

const CHARACTER_TABLE_URL =
  "https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/character_table.json";

const EN_CHARACTER_TABLE_URL =
  "https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master/en/gamedata/excel/character_table.json";

const ASSETS_REPO = "ArknightsAssets/ArknightsAssets2";
const ASSETS_BRANCH = "cn";
const PORTRAIT_DIR = "assets/dyn/arts/charportraits";
const ICON_DIR = "assets/dyn/arts/profession_large_hub";
const STARS_DIR = "assets/dyn/arts/rarity_hub";
const RESULT_DIR = "assets/dyn/ui/recruit/gacha_result";
const EFFECTS_DIR = "assets/dyn/arts/[pack]cmgachapool/rgba";
const HALFTONE_FILE = "light_halftone_mask.png";

const rawUrl = (dir: string, file: string) =>
  `https://raw.githubusercontent.com/${ASSETS_REPO}/${ASSETS_BRANCH}/${encodeURI(dir)}/${encodeURIComponent(file)}`;

/** One request lists a whole folder (up to 100k entries, unlike the 1000-entry contents API). */
const portraitListingUrl = `https://api.github.com/repos/${ASSETS_REPO}/git/trees/${ASSETS_BRANCH}:${PORTRAIT_DIR}`;

/** The character table and portrait listing are re-downloaded after this long. Images never change, so they never expire. */
const TABLE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** After the English names fail to load, don't try again for this long, so an offline run isn't slowed on every call. */
const ENGLISH_NAMES_RETRY_MS = 60 * 1000;

/** Run `make` once and share the result for `ttlMs`. A failure isn't remembered, so the next call retries. */
function memoFor<T>(ttlMs: number, make: () => Promise<T>): () => Promise<T> {
  let value: Promise<T> | undefined;
  let expiresAt = 0;
  return () => {
    if (!value || Date.now() >= expiresAt) {
      const current = (value = make());
      expiresAt = Date.now() + ttlMs;
      current.catch(() => {
        if (value === current) value = undefined;
      });
    }
    return value;
  };
}

export interface GithubProviderOptions {
  /** Where downloads are cached. Default `./cache`. */
  cacheDir?: string;
}

export function createGithubProvider(opts: GithubProviderOptions = {}): DataProvider {
  const cacheDir = opts.cacheDir ?? "cache";
  const tableOptions = { maxAgeMs: TABLE_MAX_AGE_MS };

  const loadOperators = memoFor(TABLE_MAX_AGE_MS, async () => {
    const bytes = await fetchCached(CHARACTER_TABLE_URL, `${cacheDir}/character_table.json`, tableOptions);
    return parseCharacterTable(JSON.parse(new TextDecoder().decode(bytes)));
  });

  /** id -> EN client name. The 20 MB table is cached as just this small map. */
  const loadEnglishNames = memoFor(TABLE_MAX_AGE_MS, async () => {
    const bytes = await fetchCached(EN_CHARACTER_TABLE_URL, `${cacheDir}/character_names_en.json`, {
      ...tableOptions,
      transform: (body) => {
        const table = JSON.parse(new TextDecoder().decode(body)) as Record<string, { name?: string } | null>;
        const names = Object.entries(table).flatMap(([id, c]) => (id.startsWith("char_") && c?.name ? [[id, c.name]] : []));
        return new TextEncoder().encode(JSON.stringify(Object.fromEntries(names)));
      },
    });
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, string>;
  });

  /** English names are optional: if they can't be loaded, `nameEn` stays the zh_CN `appellation` until the retry delay passes. */
  let retryNamesAt = 0;
  const loadEnglishNamesOrNone = async (): Promise<Record<string, string>> => {
    if (Date.now() < retryNamesAt) return {};
    try {
      return await loadEnglishNames();
    } catch {
      retryNamesAt = Date.now() + ENGLISH_NAMES_RETRY_MS;
      return {};
    }
  };

  const loadPortraitFiles = memoFor(TABLE_MAX_AGE_MS, async () => {
    const bytes = await fetchCached(portraitListingUrl, `${cacheDir}/charportraits.json`, tableOptions);
    const listing = JSON.parse(new TextDecoder().decode(bytes)) as { tree: Array<{ path: string }>; truncated?: boolean };
    if (listing.truncated) throw new Error("GitHub returned a truncated portrait listing");
    return new Set(listing.tree.map((entry) => entry.path));
  });

  return {
    async getOperators() {
      const [operators, names] = await Promise.all([loadOperators(), loadEnglishNamesOrNone()]);
      return Object.fromEntries(Object.entries(operators).map(([id, op]) => [id, { ...op, nameEn: names[id] ?? op.nameEn }]));
    },
    async getPortrait(id) {
      const file = pickPortraitFile(id, await loadPortraitFiles());
      return fetchCached(rawUrl(PORTRAIT_DIR, file), `${cacheDir}/portraits/${file}`);
    },
    getClassIcon(profession: Profession) {
      const file = classIconFile(profession);
      return fetchCached(rawUrl(ICON_DIR, file), `${cacheDir}/icons/${file}`);
    },
    getStars(tier: Tier) {
      const file = starsFile(tier);
      return fetchCached(rawUrl(STARS_DIR, file), `${cacheDir}/stars/${file}`);
    },
    async getPanelImage(tier: Tier) {
      const file = PANEL_FILES[tier];
      if (!file) return undefined;
      return fetchCached(rawUrl(RESULT_DIR, file), `${cacheDir}/panels/${file}`);
    },
    getHalftoneMask() {
      return fetchCached(rawUrl(EFFECTS_DIR, HALFTONE_FILE), `${cacheDir}/effects/${HALFTONE_FILE}`);
    },
  };
}

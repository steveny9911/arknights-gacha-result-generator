// Default DataProvider.
//   tables : Kengxxiao/ArknightsGameData  zh_CN/gamedata/excel/character_table.json
//   images : ArknightsAssets2 (cn branch) assets/dyn/arts/charportraits/
//                                         assets/dyn/arts/profession_large_hub/
//                                         assets/dyn/arts/rarity_hub/
//                                         assets/dyn/arts/[pack]cmgachapool/rgba/
//                                         assets/dyn/ui/recruit/gacha_result/
// Downloads are cached on disk under `cacheDir`, so only the first run needs the network.
// The operator table and portrait listing refresh after 7 days; images are kept for good.
import type { Operator, Profession, Tier } from "../types.ts";
import { parseCharacterTable } from "./character-table.ts";
import { fetchCached } from "./fetch-cache.ts";
import { classIconFile, panelImageFile, pickPortraitFile, starsFile } from "./images.ts";
import type { DataProvider } from "./provider.ts";

const CHARACTER_TABLE_URL =
  "https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/character_table.json";

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

  const loadPortraitFiles = memoFor(TABLE_MAX_AGE_MS, async () => {
    const bytes = await fetchCached(portraitListingUrl, `${cacheDir}/charportraits.json`, tableOptions);
    const listing = JSON.parse(new TextDecoder().decode(bytes)) as { tree: Array<{ path: string }>; truncated?: boolean };
    if (listing.truncated) throw new Error("GitHub returned a truncated portrait listing");
    return new Set(listing.tree.map((entry) => entry.path));
  });

  return {
    getOperators: loadOperators,
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
      const file = panelImageFile(tier);
      if (!file) return undefined;
      return fetchCached(rawUrl(RESULT_DIR, file), `${cacheDir}/panels/${file}`);
    },
    getHalftoneMask() {
      return fetchCached(rawUrl(EFFECTS_DIR, HALFTONE_FILE), `${cacheDir}/effects/${HALFTONE_FILE}`);
    },
  };
}

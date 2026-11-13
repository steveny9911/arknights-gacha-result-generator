// Default DataProvider.
//   tables : Kengxxiao/ArknightsGameData  zh_CN/gamedata/excel/character_table.json
//   images : ArknightsAssets2 (cn branch) assets/dyn/arts/charportraits/
//                                         assets/dyn/arts/misc/profession_icons_v2_hub/
// Downloads are cached on disk under `cacheDir` so repeat runs are offline.
import type { Operator, Profession } from "../types.ts";
import { parseCharacterTable } from "./character-table.ts";
import { fetchCached } from "./fetch-cache.ts";
import { classIconFile, pickPortraitFile } from "./images.ts";
import type { DataProvider } from "./provider.ts";

const CHARACTER_TABLE_URL =
  "https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/character_table.json";

const ASSETS_REPO = "ArknightsAssets/ArknightsAssets2";
const ASSETS_BRANCH = "cn";
const PORTRAIT_DIR = "assets/dyn/arts/charportraits";
const ICON_DIR = "assets/dyn/arts/misc/profession_icons_v2_hub";

const rawUrl = (dir: string, file: string) =>
  `https://raw.githubusercontent.com/${ASSETS_REPO}/${ASSETS_BRANCH}/${dir}/${encodeURIComponent(file)}`;

/** One request lists a whole folder (up to 100k entries, unlike the 1000-entry contents API). */
const portraitListingUrl = `https://api.github.com/repos/${ASSETS_REPO}/git/trees/${ASSETS_BRANCH}:${PORTRAIT_DIR}`;

export interface GithubProviderOptions {
  /** Where downloads are cached. Default `./cache`. */
  cacheDir?: string;
}

export function createGithubProvider(opts: GithubProviderOptions = {}): DataProvider {
  const cacheDir = opts.cacheDir ?? "cache";
  let operators: Promise<Record<string, Operator>> | undefined;
  let portraitFiles: Promise<Set<string>> | undefined;

  const loadOperators = () =>
    (operators ??= fetchCached(CHARACTER_TABLE_URL, `${cacheDir}/character_table.json`).then(
      (bytes) => parseCharacterTable(JSON.parse(new TextDecoder().decode(bytes))),
    ));

  const loadPortraitFiles = () =>
    (portraitFiles ??= fetchCached(portraitListingUrl, `${cacheDir}/charportraits.json`).then(
      (bytes) => {
        const tree = JSON.parse(new TextDecoder().decode(bytes)) as { tree: Array<{ path: string }> };
        return new Set(tree.tree.map((entry) => entry.path));
      },
    ));

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
  };
}

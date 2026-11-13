// Default DataProvider.
//   tables (slice 2): Kengxxiao/ArknightsGameData  zh_CN/gamedata/excel/character_table.json
//   images (slice 3): ArknightsAssets2 (cn branch) assets/dyn/arts/charportraits/
//                                                  assets/dyn/arts/misc/profession_icons_hub/
// Downloads are cached on disk under `cacheDir` so repeat runs are offline.
import type { Operator, Profession } from "../types.ts";
import { parseCharacterTable } from "./character-table.ts";
import { fetchCached } from "./fetch-cache.ts";
import type { DataProvider } from "./provider.ts";

const CHARACTER_TABLE_URL =
  "https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/character_table.json";

export interface GithubProviderOptions {
  /** Where downloads are cached. Default `./cache`. */
  cacheDir?: string;
}

export function createGithubProvider(opts: GithubProviderOptions = {}): DataProvider {
  const cacheDir = opts.cacheDir ?? "cache";
  let operators: Promise<Record<string, Operator>> | undefined;

  const todo = (name: string): never => {
    throw new Error(`Slice 3: ${name} not implemented`);
  };

  return {
    getOperators: () =>
      (operators ??= fetchCached(CHARACTER_TABLE_URL, `${cacheDir}/character_table.json`).then(
        (bytes) => parseCharacterTable(JSON.parse(new TextDecoder().decode(bytes))),
      )),
    getPortrait: async (_id: string): Promise<Uint8Array> => todo("getPortrait"),
    getClassIcon: async (_p: Profession): Promise<Uint8Array> => todo("getClassIcon"),
  };
}

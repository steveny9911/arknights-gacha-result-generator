// SLICE 2 (tables) + SLICE 3 (images): default DataProvider.
//   tables  : Kengxxiao/ArknightsGameData  zh_CN/gamedata/excel/character_table.json
//   images  : ArknightsAssets2 (cn branch) assets/dyn/arts/charportraits/
//                                          assets/dyn/arts/misc/profession_icons_hub/
// Downloads are cached on disk under `cacheDir` so repeat runs are offline.
import type { Operator, Profession } from "../types.ts";
import type { DataProvider } from "./provider.ts";

export interface GithubProviderOptions {
  cacheDir?: string;
}

export function createGithubProvider(_opts: GithubProviderOptions = {}): DataProvider {
  const todo = (name: string): never => {
    throw new Error(`Slice 2/3: ${name} not implemented`);
  };
  return {
    getOperators: async (): Promise<Record<string, Operator>> => todo("getOperators"),
    getPortrait: async (_id: string): Promise<Uint8Array> => todo("getPortrait"),
    getClassIcon: async (_p: Profession): Promise<Uint8Array> => todo("getClassIcon"),
  };
}

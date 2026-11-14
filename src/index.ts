// Public API. This is the entry point other Bun projects import.
// Stable surface: generateTenPullImage and its types, seededRng, and the DataProvider interface.
// The rest (tenPull, buildBanner, createGithubProvider) is exported for building your own provider or banner.
//   import { generateTenPullImage } from "arknights-gacha-result-generator";
import { tenPull } from "./gacha/gacha.ts";
import { buildBanner } from "./data/pool.ts";
import { createGithubProvider } from "./data/github.ts";
import type { DataProvider } from "./data/provider.ts";
import { renderMontage } from "./render/montage.ts";
import type { Banner, Operator, Rng, TenPullResult, Tier } from "./types.ts";

export interface GenerateOptions {
  /** Defaults to a standard banner built from the provider's operator table. */
  banner?: Banner;
  /** Pulls since the last 6-star, 0 to 98. Default 0. */
  startPity?: number;
  /** One source of randomness for the pull and the visuals. Pass `seededRng(n)` to reproduce an image. */
  rng?: Rng;
  /** Output format. Default "png". */
  format?: "png" | "webp";
  /** Where the default provider caches downloads. Default `./cache`. Ignored when `provider` is set. */
  cacheDir?: string;
  /** Defaults to the GitHub-backed, disk-cached provider. */
  provider?: DataProvider;
}

export interface GenerateResult {
  image: Uint8Array;
  /** The ten operators in pull order, with name, rarity and profession. */
  pulls: Operator[];
  /** The raw pull: operator ids and the pity left after the last pull. */
  result: TenPullResult;
}

/** One default provider per cache folder, so repeated calls (a long-running bot) reuse the parsed table and listing. */
const defaultProviders = new Map<string, DataProvider>();

function defaultProvider(cacheDir: string | undefined): DataProvider {
  const key = cacheDir ?? "";
  let provider = defaultProviders.get(key);
  if (!provider) defaultProviders.set(key, (provider = createGithubProvider({ cacheDir })));
  return provider;
}

export async function generateTenPullImage(opts: GenerateOptions = {}): Promise<GenerateResult> {
  const provider = opts.provider ?? defaultProvider(opts.cacheDir);
  const operators = await provider.getOperators();
  const banner = opts.banner ?? buildBanner(operators);

  const result = tenPull(banner, opts.startPity ?? 0, opts.rng);

  const pulls = result.operators.map((id) => {
    const operator = operators[id];
    if (!operator) throw new Error(`Unknown operator id: ${id}`);
    return operator;
  });

  const entries = await Promise.all(
    pulls.map(async (operator) => {
      const id = operator.id;
      const [portrait, classIcon, stars] = await Promise.all([
        provider.getPortrait(id),
        provider.getClassIcon(operator.profession),
        provider.getStars(operator.rarity),
      ]);
      return { operator, portrait, classIcon, stars };
    }),
  );

  const tiers: Tier[] = [3, 4, 5, 6];
  const [halftoneMask, ...panels] = await Promise.all([provider.getHalftoneMask(), ...tiers.map((tier) => provider.getPanelImage(tier))]);
  const panelImages = Object.fromEntries(tiers.flatMap((tier, i) => (panels[i] ? [[tier, panels[i]]] : [])));
  const image = await renderMontage(entries, { format: opts.format, halftoneMask, panelImages, rng: opts.rng });
  return { image, pulls, result };
}

export { tenPull } from "./gacha/gacha.ts";
export { seededRng } from "./gacha/seeded-rng.ts";
export { buildBanner } from "./data/pool.ts";
export { createGithubProvider, type GithubProviderOptions } from "./data/github.ts";
export type { DataProvider } from "./data/provider.ts";
export type { Banner, Operator, Profession, Rng, TenPullResult, Tier } from "./types.ts";

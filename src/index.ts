// SLICE 5: public API. This is the entry point other Bun projects import.
//   import { generateTenPullImage } from "arknights-gacha-result-generator";
import { tenPull } from "./gacha/gacha.ts";
import { buildBanner } from "./data/pool.ts";
import { createGithubProvider } from "./data/github.ts";
import type { DataProvider } from "./data/provider.ts";
import { renderMontage } from "./render/montage.ts";
import type { Banner, Rng, TenPullResult, Tier } from "./types.ts";

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
  result: TenPullResult;
}

/** Panel images for every tier that has one. */
async function loadPanelImages(provider: DataProvider): Promise<Partial<Record<Tier, Uint8Array>>> {
  const tiers: Tier[] = [3, 4, 5, 6];
  const images = await Promise.all(tiers.map((tier) => provider.getPanelImage(tier)));
  return Object.fromEntries(tiers.flatMap((tier, i) => (images[i] ? [[tier, images[i]]] : [])));
}

export async function generateTenPullImage(opts: GenerateOptions = {}): Promise<GenerateResult> {
  const provider = opts.provider ?? createGithubProvider({ cacheDir: opts.cacheDir });
  const operators = await provider.getOperators();
  const banner = opts.banner ?? buildBanner(operators);

  const result = tenPull(banner, opts.startPity ?? 0, opts.rng);

  const entries = await Promise.all(
    result.operators.map(async (id) => {
      const operator = operators[id];
      if (!operator) throw new Error(`Unknown operator id: ${id}`);
      const [portrait, classIcon, stars] = await Promise.all([
        provider.getPortrait(id),
        provider.getClassIcon(operator.profession),
        provider.getStars(operator.rarity),
      ]);
      return { operator, portrait, classIcon, stars };
    }),
  );

  const [halftoneMask, panelImages] = await Promise.all([provider.getHalftoneMask(), loadPanelImages(provider)]);
  const image = await renderMontage(entries, { format: opts.format, halftoneMask, panelImages, rng: opts.rng });
  return { image, result };
}

export { tenPull } from "./gacha/gacha.ts";
export { seededRng } from "./gacha/seeded-rng.ts";
export { buildBanner } from "./data/pool.ts";
export { createGithubProvider } from "./data/github.ts";
export type { DataProvider } from "./data/provider.ts";
export type { Banner, Operator, Profession, Rng, TenPullResult, Tier } from "./types.ts";

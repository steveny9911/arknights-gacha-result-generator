// SLICE 5: public API. This is the entry point other Bun projects import.
//   import { generateTenPullImage } from "arknights-gacha-result-generator";
import { tenPull } from "./gacha/gacha.ts";
import { buildBanner } from "./data/pool.ts";
import { createGithubProvider } from "./data/github.ts";
import type { DataProvider } from "./data/provider.ts";
import { renderMontage, type MontageOptions } from "./render/montage.ts";
import type { Banner, Rng, TenPullResult, Tier } from "./types.ts";

export interface GenerateOptions extends MontageOptions {
  /** Defaults to a standard banner built from the provider's operator table. */
  banner?: Banner;
  startPity?: number;
  /** Inject for reproducible results. */
  rng?: Rng;
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
  const provider = opts.provider ?? createGithubProvider();
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

  const halftoneMask = opts.halftoneMask ?? (await provider.getHalftoneMask());
  const panelImages = opts.panelImages ?? (await loadPanelImages(provider));
  const image = await renderMontage(entries, { ...opts, halftoneMask, panelImages });
  return { image, result };
}

export { tenPull } from "./gacha/gacha.ts";
export { buildBanner } from "./data/pool.ts";
export { createGithubProvider } from "./data/github.ts";
export type { DataProvider } from "./data/provider.ts";
export type { Banner, Operator, Profession, Rng, TenPullResult, Tier } from "./types.ts";

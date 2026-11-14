// Prints headhunting pool counts from the live (cached) table.
//   bun scripts/pool-stats.ts
import { buildBanner } from "../src/data/pool.ts";
import { createGithubProvider } from "../src/data/github.ts";

const operators = await createGithubProvider().getOperators();
const banner = buildBanner(operators);
console.log(`playable operators (tier 3-6): ${Object.keys(operators).length}`);
for (const tier of [6, 5, 4, 3] as const) {
  console.log(`tier ${tier}: ${banner.pool[tier].length} in pool`);
}

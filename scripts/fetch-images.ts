// Downloads every headhunting portrait + class icon into cache/ and prints sizes.
//   bun scripts/fetch-images.ts [--all]    (default: a few samples only)
import { buildBanner } from "../src/data/pool.ts";
import { createGithubProvider } from "../src/data/github.ts";
import type { Profession } from "../src/types.ts";

const provider = createGithubProvider();
const operators = await provider.getOperators();
const banner = buildBanner(operators);

const ids = Object.values(banner.pool).flat();
const sample = process.argv.includes("--all") ? ids : ["char_002_amiya", "char_103_angel", ...ids.slice(0, 3)];

const dims = new Map<string, number>();
for (const id of sample) {
  const meta = await new Bun.Image(await provider.getPortrait(id)).metadata();
  dims.set(`${meta.width}x${meta.height}`, (dims.get(`${meta.width}x${meta.height}`) ?? 0) + 1);
}
console.log("portrait sizes:", Object.fromEntries(dims));

const professions: Profession[] = ["PIONEER", "WARRIOR", "TANK", "SNIPER", "CASTER", "SUPPORT", "MEDIC", "SPECIAL"];
for (const p of professions) {
  const meta = await new Bun.Image(await provider.getClassIcon(p)).metadata();
  console.log(p, `${meta.width}x${meta.height}`);
}

#!/usr/bin/env bun
// SLICE 5: CLI wrapper over the public API.
//   bun run cli -- [--out out/pull.png] [--pity 0] [--seed 123]
import { parseArgs } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { seededRng } from "./gacha/seeded-rng.ts";
import { generateTenPullImage } from "./index.ts";

const { values } = parseArgs({
  options: {
    out: { type: "string", short: "o", default: "out/pull.png" },
    pity: { type: "string", default: "0" },
    seed: { type: "string" },
  },
});

const out = values.out ?? "out/pull.png";
const { image, pulls, result } = await generateTenPullImage({
  startPity: Number(values.pity),
  rng: values.seed === undefined ? undefined : seededRng(Number(values.seed)),
});

await mkdir(dirname(out), { recursive: true });
await writeFile(out, image);
console.log(`Wrote ${out} (final pity ${result.finalPity})`);
for (const op of pulls) console.log(`${op.rarity}★ ${op.profession.padEnd(8)} ${op.name} (${op.id})`);

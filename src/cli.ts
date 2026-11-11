#!/usr/bin/env bun
// SLICE 5: CLI wrapper over the public API.
//   bun run cli -- [--out out/pull.png] [--pity 0]
import { parseArgs } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { generateTenPullImage } from "./index.ts";

const { values } = parseArgs({
  options: {
    out: { type: "string", short: "o", default: "out/pull.png" },
    pity: { type: "string", default: "0" },
  },
});

const out = values.out ?? "out/pull.png";
const { image, result } = await generateTenPullImage({ startPity: Number(values.pity) });

await mkdir(dirname(out), { recursive: true });
await writeFile(out, image);
console.log(`Wrote ${out} (final pity ${result.finalPity})`);
console.log(result.operators.join("\n"));

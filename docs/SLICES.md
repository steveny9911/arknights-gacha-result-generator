# Slices

Work top to bottom. Each slice has a clear "done" check and only depends on earlier slices.
Stubs throw `Slice N: ... not implemented`, so you can see which slice a failure belongs to.

## Slice 1: gacha algorithm (`src/gacha/`, `test/gacha.test.ts`)
Pure functions, no I/O. Port `gacha.ts` and `gacha.test.ts` from the walkthrough doc into
`src/gacha/gacha.ts` (constants already in `constants.ts`).
**Done when:** `bun test` passes, including the 20k-run statistics test.

## Slice 2: operator data and banner pool (`src/data/`) — DONE
`fetchCached` downloads `character_table.json` (Kengxxiao, zh_CN) once into `cache/`.
`parseCharacterTable` keeps `char_` ids with `isNotObtainable` false and tier 3-6, and flags
`inHeadhunting` when `itemObtainApproach` starts with `招募寻访`. `buildBanner` groups flagged operators by tier.
No rate-up: every operator in a tier is equally likely.
Result on the 2026-11 table: 421 playable operators; pool 128 / 128 / 49 / 17 for tiers 6 / 5 / 4 / 3.
`bun scripts/pool-stats.ts` prints these counts.
Known limitation: limited-banner operators are in the pool (their approach is also `招募寻访`).
Open check: compare the 5-star and 4-star lists against a banner you know.

## Slice 3: images (`src/data/images.ts`, `src/data/github.ts`) — DONE
Portraits: `<id>_2.png` if it exists, else `<id>_1.png` (skins use `#` and are never matched).
The charportraits folder listing is fetched once (git trees API, one request) and cached in
`cache/charportraits.json`; files are then cached under `cache/portraits/` and `cache/icons/`.
Verified: all 322 headhunting operators resolve (305 use `_2`, 17 only `_1`) and every portrait is 180x360.
Class icons use `profession_icons_v2_hub`: white glyph on transparent, 26x26. The older
`profession_icons_hub` set has an opaque dark tile baked in, so it can't sit on a tier colour.
Icons are small; slice 4 will upscale them or draw them small. Switching sets is a one-line change (`ICON_DIR`).
`bun scripts/fetch-images.ts [--all]` downloads and prints sizes.
Open check: confirm 180x360 busts match the game's result cards.

## Slice 4: montage renderer (`src/render/montage.ts`)
`renderMontage(entries) -> PNG bytes` using sharp. Take images as bytes only (no network),
so it is testable with fixture images. Tier-coloured border or stars, class icon under each portrait.
**Done when:** a test renders 10 fixture entries and the output has the expected dimensions.

## Slice 5: public API + CLI (`src/index.ts`, `src/cli.ts`)
Glue is written; make it work end to end and finalise the option surface
(`rng`, `provider`, `format`). This is the contract for embedding.
**Done when:** `bun run cli` writes `out/pull.png`, and `generateTenPullImage()` works from a separate Bun project via `bun link` or a path dependency.

## Slice 6: web page (`web/`)
Already stubbed: `bun run web`, button calls `/api/pull`, shows the PNG.
**Done when:** clicking Pull shows a new result. Later: seed input, pity field, download button.

## Slice 7: packaging
Decide: publish TS source (works for Bun consumers today) or add a build step with `.d.ts`.
Move `sharp` to the right dependency type, add `files`, drop `"private": true`, document the API in README.
Consider an offline provider (bundled snapshot) so consumers need no network.

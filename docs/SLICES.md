# Slices

Work top to bottom. Each slice has a clear "done" check and only depends on earlier slices.
Stubs throw `Slice N: ... not implemented`, so you can see which slice a failure belongs to.

## Slice 1: gacha algorithm (`src/gacha/`, `test/gacha.test.ts`)
Pure functions, no I/O. Port `gacha.ts` and `gacha.test.ts` from the walkthrough doc into
`src/gacha/gacha.ts` (constants already in `constants.ts`).
**Done when:** `bun test` passes, including the 20k-run statistics test.

## Slice 2: operator data and banner pool (`src/data/pool.ts`, `src/data/github.ts`)
Fetch `character_table.json` (Kengxxiao, zh_CN), cache it on disk, map `TIER_6` to 6,
build `Operator` records and a `Banner` pool (`char_` prefix, not `isNotObtainable`).
No rate-up: every operator in a tier is equally likely (out of scope for now).
**Done when:** a script prints tier counts close to 141/201/62/17 and `buildBanner` returns all four tiers non-empty.
Open check from the doc: validate the pool against a banner you know (event/shop-only operators leak in).

## Slice 3: images (`src/data/github.ts`)
`getPortrait` and `getClassIcon` from ArknightsAssets2 (cn). Pick one variant rule
(`_2` if present, else `_1`; skip `#` skins), disk-cache downloads, normalise `#` vs `_` ids.
**Done when:** you can fetch Amiya's portrait and a caster icon to `cache/` and open them.
Open check: confirm 180x360 busts match the game's result cards, and pick one of the four class-icon sets.

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

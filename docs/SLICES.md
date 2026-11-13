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

## Slice 4: montage renderer (`src/render/`) — DONE (matches the in-game layout)
`renderMontage(entries, { format, halftoneMask })` -> PNG/WebP bytes with sharp. Takes image bytes only (no network).
With 10 entries the canvas is 1920x1080, like the in-game result screen. Per column, bottom to top:
glow, portrait panel, portrait (scaled up and cropped to the panel), white stars, class icon.
The stars straddle the panel's top edge and the icon tile straddles its bottom edge, as in the game.
All layout numbers are exported constants at the top of `montage.ts`, measured from the reference screenshot.

Files: `montage.ts` (layout and compositing, one small helper per layer), `column-background.ts`
(`renderGlow`, `renderPanelBackground`, and the `TIER_STYLES` table).
To restyle a tier, edit `TIER_STYLES`; to change how the glow fades, edit `GLOW_ABOVE` / `GLOW_BELOW`.
Colours for 3/4/6-star are sampled from the screenshot; 5-star (gold glow, grey panel) is a guess.

Assets (all from ArknightsAssets2 `cn`, under `assets/dyn/arts/`):
- **Stars:** `rarity_hub/rarity_N.png`, white with a drop shadow, N = tier - 1 (so `rarity_5` is six stars; 175x47).
- **Class icon tile:** `profession_large_hub/icon_profession_<class>_large_white.png`, 108x109 (a 90x90 white tile plus
  shadow), drawn at 1.5x.
- **Halftone mask:** `[pack]cmgachapool/rgba/light_halftone_mask.png` (128x128). Used as the opacity of an orange layer:
  once over the 6-star panel, and tiled finely over the 6-star glow.
- The grey portrait panel and the glow gradients are drawn in code; no single image for them exists in the repos.

Known differences from the game: no sparkle particles, no bright glow blob, the glow is a plain gradient plus dots,
and portraits are upscaled 1.5x from 180x360 so they are a little soft.
Unused assets that might help later: `rgba/light_effect_flow.png` (flowing noise), `light_effect_solid.png`,
`pack3/light_effect.png` (orange dotted blob), `pack2/addtive_back.png` (horizontal flare).
`bun run cli -- --seed 52` gives a reproducible pull with 6-, 5-, 4- and 3-star operators for checking looks.

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

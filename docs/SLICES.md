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

Assets (all from ArknightsAssets2 `cn`):
- **Stars:** `arts/rarity_hub/rarity_N.png`, white with a drop shadow, N = tier - 1 (`rarity_5` is six stars; 175x47).
  Visible size matches the screenshot at 1:1. The result screen's own `ui/recruit/gacha_result/star_N.png` (36-127 x 34)
  is also white; it is smaller, so it would need ~1.25x scaling. Not used.
- **Class icon tile:** `arts/profession_large_hub/icon_profession_<class>_large_white.png`, 108x109 (a 90x90 tile plus
  shadow), drawn at 1.5x.
- **Portrait panels (the game's own art):** `ui/recruit/gacha_result/back_low_1_3.png` (3-star and below, dark),
  `back_four.png` (4-star, grey to lavender with sparkles), `back_five.png` (white sparkle gradient; we multiply it by
  gold for 5-star, which is a guess). All are 140x388 with the real 122x369 panel at (9, 0) and a drop-shadow margin;
  we crop to the panel, then stretch to the column (1:3, like the screenshot).
- **6-star panel and all glows:** NOT available as images (see below), so they are drawn in code, using
  `arts/[pack]cmgachapool/rgba/light_halftone_mask.png` for the dots.
- Each glow is 3px narrower than its column (`GLOW_GAP`), leaving the seam between glows seen in the game.

What the search found (a path-only clone of every repo, then grep; nothing was downloaded in bulk):
- The result screen is `ArknightsAssets2/assets/dyn/ui/recruit/gacha_result/` (older repo: `.../recruit_ten_result_state/`).
- The glow columns and 6-star panel are almost certainly `sprite_rare_1/4/5/6` (337x473) in the Spine atlas
  `assets/dyn/prefabs/gacha/gacha_phase_0/gacha.atlas` (+ `gacha.skel`). The atlas page `gacha.png` (1024x1024) is
  not exported in ArknightsAssets2 (cn or en), ArknightsAssets, fexli, yuanyan3060, Aceship or Arknights-Base.
  If someone has it, we can cut the regions out using the coordinates in the atlas file.
- The stage background behind the columns (dark floor with reflections and silhouettes) is not an image in any repo; it
  looks like part of the Spine/3D scene. We draw a grey gradient with a floor reflection instead (no silhouettes).

Randomness (stand-ins, because the exact glow and background art isn't available):
- **Sparkles:** small soft specks scattered in each column's glow, never over the panel, denser near the panel edges.
  Count per tier is `sparkles` in `TIER_STYLES` (0 / 22 / 36 / 60 for 3-6 star). Drawn per column so no two repeat.
- **Background:** `render/background.ts`, a neutral grey vertical gradient (black at the top, a bright floor reflection
  near the bottom). The shape follows the screenshot's padding strip, with the floor peak lowered (~100 vs ~230 there) so it doesn't
  dominate. Random part: overall
  brightness and the height of the floor line. (An earlier version used a random hue; the screenshot has no colour tint.)
- Both use the `rng` option of `renderMontage`; `generateTenPullImage` passes the pull's `rng` on, so one seed
  (`--seed N`) reproduces the pull and the whole image. Tests always pass a seeded rng.

Known differences from the game: no bright glow blob, no 6-star panel art, no stage scene behind the columns,
and portraits are upscaled 1.5x from 180x360 so they are a little soft.
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

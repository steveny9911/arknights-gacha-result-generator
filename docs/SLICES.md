# Slices and status

Work top to bottom. Each slice has a clear "done" check and only depends on earlier slices.

| # | Slice | Status |
| --- | --- | --- |
| 1 | Gacha algorithm | Done |
| 2 | Operator data and banner pool | Done |
| 3 | Portrait, icon and panel images | Done |
| 4 | Montage renderer | Done, with visual gaps (see "Known issues and ideas for later") |
| 5 | Public API + CLI | Done; verified from a separate Bun project via a `file:` dependency |
| 6 | Web page | Done; API verified with curl, page JS not tried in a browser |
| 7 | Packaging | Skipped: the only consumer is `~/weabot` via a local `file:` dependency, and it always runs online. To publish later: add `files`, drop `"private": true`, decide between TS source and a build with `.d.ts` |

`bun test`, `bun run typecheck` and `bun run cli -- --seed 52` are the quick health checks.

## Decisions made

- **No rate-up banners.** Every operator in a tier is equally likely (`pickOperator`).
- **Guarantee scope:** the "5-star or better in ten" guarantee is applied to every ten-pull (the game applies it to the first
  ten on a banner only). Fine for a stateless generator; a flag could be added.
- **Operator pool:** `itemObtainApproach` starts with `招募寻访` (headhunting). This drops event, shop and Integrated Strategies operators.
- **Image library:** `sharp`. Bun's built-in `Bun.Image` (1.4.4) can resize and convert but has no compositing.
- **Data access:** plain HTTPS to `raw.githubusercontent.com` with an on-disk cache in `cache/` (gitignored). No git clones at runtime.
- **Embedding:** the public function is `generateTenPullImage(opts)`; CLI and web are thin wrappers. A `DataProvider` interface
  separates data and image fetching from rendering, so a host project can supply its own. `renderMontage` takes bytes only.
- **Randomness is injectable.** One `rng` drives the pull, the sparkles and the background, so `--seed N` reproduces an image exactly.
  Tests always use a seeded rng.
- **Output format:** PNG by default (exact, works everywhere), tuned with zlib level 9 and adaptive filtering: 2.1 MB to 1.5 MB with
  identical pixels, for about 0.5 s more. `format: "webp"` is lossy at quality 95: about 0.4 MB, edge pixels differ by a few levels
  (nothing visible at 1:1). Lossless WebP (1.1 MB, 2 s) and sharp's PNG `effort: 10` (silently palette-quantises, so not lossless) were
  tried and rejected. Whether weabot's chat platform shows WebP properly is unchecked.
- **Reference look:** two in-game result screenshots supplied by the user (1920x1080). Layout numbers and colours are measured
  from them, not guessed, wherever possible.

## Slice 1: gacha algorithm (`src/gacha/`, `test/gacha.test.ts`) — DONE
Port of the walkthrough doc's TypeScript reference, minus rate-up. Pure functions, no I/O:
`weightedPick`, `sixStarRate`, `rollRarity`, `pickOperator`, `tenPull`; constants in `constants.ts`; `seeded-rng.ts` (mulberry32).
Assumptions carried from the doc (marked `ASSUMPTION` in code): the lower tiers shrink proportionally while the 6-star
rate climbs under pity, and the guarantee applies to every ten-pull.
A 20,000-run statistics test checks the rates (about 2.7 / 10.8 / 48.0 / 38.5 % for 6/5/4/3-star).

## Slice 2: operator data and banner pool (`src/data/`) — DONE
`fetchCached` downloads once into `cache/` (concurrent callers share one download; temp file then rename).
`parseCharacterTable` keeps `char_` ids with `isNotObtainable` false and tier 3-6, and flags `inHeadhunting`.
`buildBanner` groups flagged operators by tier.
Result on the 2026-11 table: 421 playable operators; pool 128 / 128 / 49 / 17 for tiers 6 / 5 / 4 / 3.
What the fields mean (checked against the live table): `isNotObtainable` is a boolean that is true for 30 non-playable entries
(trainee operators). `itemObtainApproach` is free Chinese text: 招募寻访 headhunting (334), 活动获得 event reward (77),
凭证交易所 certificate shop (14), 集成战略获得 Integrated Strategies (6), 信用交易所 credit shop (3), and a few singles.

## Slice 3: images (`src/data/images.ts`, `src/data/github.ts`) — DONE
- **Portraits:** `<id>_2.png` if it exists, else `<id>_1.png` (skins use `#` and are never matched). The charportraits folder
  listing is fetched once (git trees API; the contents API caps at 1000 entries) and cached in `cache/charportraits.json`.
  All 322 headhunting operators resolve (305 use `_2`, 17 only `_1`); every portrait is 180x360.
- **Class icons, stars, panels, halftone mask:** see the asset list under slice 4. Cache folders: `cache/portraits`, `icons`,
  `stars`, `panels`, `effects`.
- `bun scripts/fetch-images.ts [--all]` downloads portraits and icons and prints sizes (the one manual check against live data).

## Slice 4: montage renderer (`src/render/`) — DONE for now
`renderMontage(entries, { format, halftoneMask, panelImages, rng })` -> PNG/WebP bytes. Takes image bytes only (no network).
With 10 entries the canvas is 1920x1080, like the game. Per column, bottom to top: glow, sparkles, portrait panel, portrait
(scaled up and cropped to the panel), white stars, class icon. The stars straddle the panel's top edge and the icon tile
straddles its bottom edge, as in the game. Layout numbers are exported constants at the top of `montage.ts`.

Files:
- `montage.ts`: layout and compositing, one small helper per layer.
- `column-background.ts`: `renderGlow`, `renderPanelBackground`, `renderSparkles`, and the `TIER_STYLES` table.
  To restyle a tier edit `TIER_STYLES`; to change how glows fade edit `GLOW_ABOVE` / `GLOW_BELOW`.
- `background.ts`: the canvas gradient.

Assets (all from `ArknightsAssets/ArknightsAssets2`, branch `cn`):
- **Stars:** `assets/dyn/arts/rarity_hub/rarity_N.png`, white with a drop shadow, N = tier - 1 (`rarity_5` is six stars; 175x47). Visible size
  matches the screenshot at 1:1. The result screen's own `ui/recruit/gacha_result/star_N.png` (36-127 x 34) is smaller; not used.
- **Class icon tile:** `arts/profession_large_hub/icon_profession_<class>_large_white.png`, 108x109 (a 90x90 white tile plus shadow),
  drawn at 1.5x. (Earlier tried `profession_icons_v2_hub`, 26x26 white glyph on transparent, and `profession_icons_hub`, which has an
  opaque tile baked in; both unused now.)
- **Portrait panels, the game's own art:** `ui/recruit/gacha_result/back_low_1_3.png` (3-star and below, dark), `back_four.png`
  (4-star, grey to lavender with sparkles), `back_five.png` (5-star, near white). Each is 140x388 with the real 122x369 panel at (9, 0)
  and a drop-shadow margin; we crop to the panel, then stretch to the column (1:3).
- **Halftone mask:** `arts/[pack]cmgachapool/rgba/light_halftone_mask.png` (128x128). Its brightness is the opacity of a coloured layer:
  once over the 6-star panel, and tiled finely over the 6-star glow.
- Drawn in code because no image exists: all glows, the 6-star panel, the sparkles, the canvas background.

Colours come from the two screenshots. 5-star is a pale cream glow over the untinted white panel; the 4-star glow turns whitish
at the panel edge (`rim`). Each glow is 3px narrower than its column (`GLOW_GAP`), leaving the seam seen in the game.

Randomness (stand-ins for art we could not find):
- **Sparkles:** small soft specks in each column's glow, never over the panel, denser near its edges. Count per tier is `sparkles`
  in `TIER_STYLES` (0 / 22 / 36 / 60 for 3-6 star). Drawn per column so no two repeat.
- **Background:** a neutral grey gradient: black at the top, a dim floor reflection near the bottom. Random part: overall brightness
  and the height of the floor line. Its shape follows the screenshot's padding strip, but the peak is deliberately much lower
  (about 70 vs about 230 in the game) because the user found a bright band distracting; it was lowered twice on request.

### What the asset search found
The result screen's art is `ArknightsAssets2/assets/dyn/ui/recruit/gacha_result/`. The glow columns and the 6-star panel are almost certainly
`sprite_rare_1/4/5/6` in the Spine atlas `assets/dyn/prefabs/gacha/gacha_phase_0/gacha.atlas`, but its page `gacha.png` is not exported in any
asset repo we checked (ArknightsAssets2 cn and en, ArknightsAssets, fexli/ArknightsResource, yuanyan3060/ArknightsGameResource,
Aceship/Arknight-Images, kiraio-moe/Arknights-Base). The stage behind the columns is not an image in any repo either.

## Slice 5: public API + CLI (`src/index.ts`, `src/cli.ts`)
`bun run cli -- [--out path] [--pity N] [--seed N]` works end to end and `generateTenPullImage()` wires provider, pull, and renderer.
Option surface is final: `banner`, `startPity`, `rng`, `format`, `cacheDir`, `provider`. `halftoneMask` and `panelImages` are no longer public;
they always come from the provider. `seededRng` is exported. `test/index.test.ts` covers the API with a fake provider (no network).
`generateTenPullImage` returns `{ image, pulls, result }`; `pulls` is the ten `Operator` objects (name, rarity, profession) in pull order.
Verified from a scratch project with a `file:` dependency: it imports the TS source and renders a seeded pull.

## Slice 6: web page (`web/`)
Done: `bun run web` serves one page with pity and seed fields, a Pull button and a Download link. `/api/pull?pity=N&seed=N` returns a PNG
(400 for a bad pity or seed, 500 with the error message if rendering fails). Binds to 127.0.0.1 only: it is a demo page, so renders are not queued or rate limited. Verified with curl: 200 PNG, same seed gives identical bytes. The page's JavaScript was not exercised in a browser.

## Known issues and ideas for later

### Visual differences from the game (slice 4)
Ordered roughly by how visible they are.
1. **No stage scene.** The game has silhouettes of figures and a checkered floor behind the columns, plus faint dust specks in the dark
   upper area. Not reproducible without the asset; we only draw a gradient.
2. **No bloom.** The 4-star halo bleeds sideways past its column near the top of the panel; ours is clipped to the column.
3. **Glows are flatter and dimmer** than the real 5-star and 6-star glows, which look luminous. The real 5-star glow also has thin
   vertical light streaks.
4. **Glow fall-off below the tile is one shape for all tiers.** In the game 4-star fades to dark grey by about y=980 while 5- and
   6-star stay bright longer.
5. **6-star panel art missing.** We draw a dark panel with orange halftone dots; the real one is richer (orange-red dots, a glow blob).
   Needs the missing atlas page.
6. **No bright glow blob** (the soft orange disc near the top of some 6-star columns).
7. **Soft portraits.** The 180x360 source is scaled 1.5x to fill the 183x550 panel. A higher-resolution portrait set would fix it;
   none found.
8. **Sparkle look** (count, size, brightness) is a judgment call from two screenshots; the purple 4-star columns can look starry.
9. **Floor reflection strength** is a judgment call (see above). It is one table in `background.ts` (`PROFILE`).
10. **Only the left padding of the screenshot was sampled** for the background; the right padding differs (for example 64,58,65 vs
    8,8,8 at y=300) because of scene lighting we don't model.

### Data and algorithm
- Limited-banner operators are in the pool (their `itemObtainApproach` is also headhunting), so they can appear in a normal pull.
- The 5-star and 4-star pool lists have not been checked against a real banner (only the 6-star count was spot-checked).
- Guarantee scope and the lower-tier shrinking under pity are unconfirmed assumptions (see slice 1).
- The operator table and portrait listing refresh after 7 days; images are kept forever (they don't change). Delete `cache/` to force a refresh.
- The GitHub trees API call is unauthenticated (60 requests per hour); it runs once and is cached.

### Open checks carried over from the research docs
- Confirm 180x360 portraits match the game's result cards (they look right, but this was never compared to the same operator in-game).
- The doc's operator counts (438 pool, 141/201/62/17 per tier) are older than the table we use; ours are 421 and 128/128/49/17.

## Process notes
- Provider tests use a pre-seeded cache folder; no test touches the network.
- Check visuals against the reference screenshots by measuring pixels, not by eye. Two mistakes came from skipping this: an invented
  random hue for the background, and a guessed gold tint for the 5-star panel.

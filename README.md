# arknights-gacha-result-generator

Generates an image of an Arknights 10-pull headhunting result: 10 operator portraits with class icons.

```
bun install
bun run cli -- --out out/pull.png   # add --seed N for a reproducible pull and image
bun run web                         # slice 6
bun test
```

Planned library use:

```ts
import { generateTenPullImage } from "arknights-gacha-result-generator";
const { image, result } = await generateTenPullImage();
await Bun.write("pull.png", image);
```

See [docs/SLICES.md](docs/SLICES.md) for the build order.

## Layout

| Path | Role |
| --- | --- |
| `src/gacha/` | Pure algorithm (slice 1) |
| `src/data/` | `DataProvider` interface, GitHub provider with disk cache, banner pool (slices 2-3) |
| `src/render/` | sharp montage: layout, tier glows and panels, sparkles, background (slice 4) |
| `src/index.ts` | Public API (slice 5) |
| `src/cli.ts`, `web/` | Frontends over the public API |
| `scripts/` | Manual checks against live data |
| `docs/SLICES.md` | Status, decisions, asset findings, known issues |

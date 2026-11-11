// SLICE 4: compose the ten-pull image with sharp.
// Layout: 10 columns of 180x360 portraits, class icon under each, tier-coloured
// border/stars. Pure function of (operators, images) -> PNG bytes.
import type { Operator } from "../types.ts";

export interface MontageEntry {
  operator: Operator;
  portrait: Uint8Array;
  classIcon: Uint8Array;
}

export interface MontageOptions {
  /** Output format. Default "png". */
  format?: "png" | "webp";
}

export async function renderMontage(
  _entries: readonly MontageEntry[],
  _opts: MontageOptions = {},
): Promise<Uint8Array> {
  throw new Error("Slice 4: renderMontage not implemented");
}

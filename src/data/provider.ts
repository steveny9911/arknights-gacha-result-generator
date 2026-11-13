import type { Operator, Profession, Tier } from "../types.ts";

/**
 * Where operator data and images come from. The renderer and public API only
 * depend on this interface, so a consuming project can supply its own
 * (local files, a bundled snapshot, a different mirror).
 */
export interface DataProvider {
  /** All operators keyed by id. */
  getOperators(): Promise<Record<string, Operator>>;
  /** Portrait image bytes (PNG) for an operator id. */
  getPortrait(operatorId: string): Promise<Uint8Array>;
  /** Class icon image bytes (PNG) for a profession: black glyph on a white tile. */
  getClassIcon(profession: Profession): Promise<Uint8Array>;
  /** Row of white stars (PNG, transparent) for a tier. */
  getStars(tier: Tier): Promise<Uint8Array>;
}

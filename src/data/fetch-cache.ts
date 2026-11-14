import { mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";

/** Give up on a download after this long, so a stalled connection can't hang a render. */
const DOWNLOAD_TIMEOUT_MS = 30_000;

/** Downloads in progress, so concurrent callers for one file share a single request and temp file. */
const inFlight = new Map<string, Promise<Uint8Array>>();

export interface FetchCachedOptions {
  /** Refresh a cached file older than this. Default: cached files never expire. */
  maxAgeMs?: number;
}

/**
 * Return the bytes at `url`, using the file at `cachePath` if it exists and is fresh enough.
 * If a refresh of an expired file fails (offline, GitHub down), the expired copy is used instead.
 * Downloads are written to a temp file first so a failed run can't leave a half-written cache.
 */
export async function fetchCached(
  url: string,
  cachePath: string,
  { maxAgeMs }: FetchCachedOptions = {},
): Promise<Uint8Array> {
  const cached = Bun.file(cachePath);
  const info = (await cached.exists()) ? await stat(cachePath) : undefined;
  const isFresh = info !== undefined && (maxAgeMs === undefined || Date.now() - info.mtimeMs < maxAgeMs);
  if (isFresh) return cached.bytes();

  let pending = inFlight.get(cachePath);
  if (!pending) {
    pending = download(url, cachePath).finally(() => inFlight.delete(cachePath));
    inFlight.set(cachePath, pending);
  }
  try {
    return await pending;
  } catch (error) {
    if (info) return cached.bytes(); // expired but better than nothing
    throw error;
  }
}

async function download(url: string, cachePath: string): Promise<Uint8Array> {
  const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0) throw new Error(`GET ${url} returned an empty body`);

  await mkdir(dirname(cachePath), { recursive: true });
  const tmp = `${cachePath}.${process.pid}.tmp`;
  try {
    await Bun.write(tmp, bytes);
    await rename(tmp, cachePath);
  } catch (error) {
    await rm(tmp, { force: true });
    throw error;
  }
  return bytes;
}

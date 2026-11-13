import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";

/** Downloads in progress, so concurrent callers for one file share a single request and temp file. */
const inFlight = new Map<string, Promise<Uint8Array>>();

/**
 * Return the bytes at `url`, using the file at `cachePath` if it exists.
 * Downloads are written to a temp file first so a failed run can't leave a half-written cache.
 */
export async function fetchCached(url: string, cachePath: string): Promise<Uint8Array> {
  const cached = Bun.file(cachePath);
  if (await cached.exists()) return cached.bytes();

  let pending = inFlight.get(cachePath);
  if (!pending) {
    pending = download(url, cachePath).finally(() => inFlight.delete(cachePath));
    inFlight.set(cachePath, pending);
  }
  return pending;
}

async function download(url: string, cachePath: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  const bytes = new Uint8Array(await res.arrayBuffer());

  await mkdir(dirname(cachePath), { recursive: true });
  const tmp = `${cachePath}.${process.pid}.tmp`;
  await Bun.write(tmp, bytes);
  await rename(tmp, cachePath);
  return bytes;
}

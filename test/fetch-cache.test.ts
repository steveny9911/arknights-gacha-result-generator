import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchCached } from "../src/data/fetch-cache.ts";

let server: ReturnType<typeof Bun.serve>;
let dir: string;
let hits = 0;
let failFlaky = true;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "fetch-cache-"));
  server = Bun.serve({
    port: 0,
    async fetch(req) {
      const { pathname } = new URL(req.url);
      if (pathname === "/missing") return new Response("nope", { status: 404 });
      if (pathname === "/empty") return new Response("");
      if (pathname === "/flaky" && failFlaky) return new Response("nope", { status: 503 });
      if (pathname === "/new") return new Response("fresh");
      hits++;
      await Bun.sleep(30); // keep concurrent callers overlapping
      return new Response("hello");
    },
  });
});

afterAll(async () => {
  await server.stop(true);
  await rm(dir, { recursive: true, force: true });
});

test("concurrent calls for one file share a single download", async () => {
  const path = join(dir, "sub", "a.txt");
  const results = await Promise.all(
    Array.from({ length: 5 }, () => fetchCached(`${server.url}a`, path)),
  );
  expect(results.map((b) => new TextDecoder().decode(b))).toEqual(Array(5).fill("hello"));
  expect(hits).toBe(1);
  expect(await readdir(join(dir, "sub"))).toEqual(["a.txt"]); // no temp file left behind
});

test("a cached file is served without a request", async () => {
  const before = hits;
  const bytes = await fetchCached(`${server.url}a`, join(dir, "sub", "a.txt"));
  expect(new TextDecoder().decode(bytes)).toBe("hello");
  expect(hits).toBe(before);
});

test("an HTTP error rejects and caches nothing", async () => {
  const path = join(dir, "missing.txt");
  await expect(fetchCached(`${server.url}missing`, path)).rejects.toThrow("404");
  expect(await Bun.file(path).exists()).toBe(false);
});

test("an empty body is rejected, not cached", async () => {
  const path = join(dir, "empty.txt");
  await expect(fetchCached(`${server.url}empty`, path)).rejects.toThrow("empty body");
  expect(await Bun.file(path).exists()).toBe(false);
});

test("a failed download can be retried", async () => {
  const path = join(dir, "flaky.txt");
  await expect(fetchCached(`${server.url}flaky`, path)).rejects.toThrow("503");
  failFlaky = false;
  expect(new TextDecoder().decode(await fetchCached(`${server.url}flaky`, path))).toBe("hello");
});

describe("maxAgeMs", () => {
  const stale = async (name: string) => {
    const path = join(dir, name);
    await Bun.write(path, "old");
    const longAgo = new Date(Date.now() - 10_000);
    await utimes(path, longAgo, longAgo);
    return path;
  };

  test("a file within its age is served from disk", async () => {
    const path = await stale("young.txt");
    const bytes = await fetchCached(`${server.url}new`, path, { maxAgeMs: 60_000 });
    expect(new TextDecoder().decode(bytes)).toBe("old");
  });

  test("an expired file is downloaded again", async () => {
    const path = await stale("expired.txt");
    const bytes = await fetchCached(`${server.url}new`, path, { maxAgeMs: 1_000 });
    expect(new TextDecoder().decode(bytes)).toBe("fresh");
    expect(await Bun.file(path).text()).toBe("fresh");
  });

  test("an expired file is still used when the refresh fails", async () => {
    const path = await stale("fallback.txt");
    const bytes = await fetchCached(`${server.url}missing`, path, { maxAgeMs: 1_000 });
    expect(new TextDecoder().decode(bytes)).toBe("old");
  });
});

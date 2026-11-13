import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchCached } from "../src/data/fetch-cache.ts";

let server: ReturnType<typeof Bun.serve>;
let dir: string;
let hits = 0;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "fetch-cache-"));
  server = Bun.serve({
    port: 0,
    async fetch(req) {
      if (new URL(req.url).pathname === "/missing") return new Response("nope", { status: 404 });
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
  expect(fetchCached(`${server.url}missing`, path)).rejects.toThrow("404");
  await Bun.sleep(50);
  expect(await Bun.file(path).exists()).toBe(false);
});

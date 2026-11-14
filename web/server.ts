// Super simple frontend. One page, one button, GET /api/pull?pity=N&seed=N -> PNG.
import { generateTenPullImage, seededRng } from "../src/index.ts";

const page = await Bun.file(new URL("./index.html", import.meta.url)).text();

const server = Bun.serve({
  hostname: "127.0.0.1", // a demo page: local only
  port: Number(process.env.PORT ?? 3000),
  async fetch(req) {
    const { pathname, searchParams } = new URL(req.url);
    if (pathname === "/") return new Response(page, { headers: { "content-type": "text/html" } });
    if (pathname === "/api/pull") {
      try {
        const seed = searchParams.get("seed");
        const { image } = await generateTenPullImage({
          startPity: Number(searchParams.get("pity") || 0),
          rng: seed ? seededRng(Number(seed)) : undefined,
        });
        return new Response(Buffer.from(image), { headers: { "content-type": "image/png", "cache-control": "no-store" } });
      } catch (error) {
        const bad = error instanceof RangeError; // bad pity or seed
        return new Response(error instanceof Error ? error.message : String(error), { status: bad ? 400 : 500 });
      }
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`http://localhost:${server.port}`);

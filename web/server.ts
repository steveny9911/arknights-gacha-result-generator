// SLICE 6: super simple frontend. One page, one button, GET /api/pull?pity=N&seed=N -> PNG.
import { generateTenPullImage, seededRng } from "../src/index.ts";

const page = await Bun.file(new URL("./index.html", import.meta.url)).text();

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(req) {
    const { pathname, searchParams } = new URL(req.url);
    if (pathname === "/") return new Response(page, { headers: { "content-type": "text/html" } });
    if (pathname === "/api/pull") {
      const pity = Number(searchParams.get("pity") || 0);
      if (!Number.isInteger(pity) || pity < 0 || pity > 98) return new Response("pity must be 0 to 98", { status: 400 });
      const seed = searchParams.get("seed");
      const { image } = await generateTenPullImage({ startPity: pity, rng: seed ? seededRng(Number(seed)) : undefined });
      return new Response(Buffer.from(image), { headers: { "content-type": "image/png", "cache-control": "no-store" } });
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`http://localhost:${server.port}`);

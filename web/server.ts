// SLICE 6: super simple frontend. One page, one button, GET /api/pull -> PNG.
import { generateTenPullImage } from "../src/index.ts";

const page = await Bun.file(new URL("./index.html", import.meta.url)).text();

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(req) {
    const { pathname } = new URL(req.url);
    if (pathname === "/") return new Response(page, { headers: { "content-type": "text/html" } });
    if (pathname === "/api/pull") {
      const { image } = await generateTenPullImage();
      return new Response(Buffer.from(image), { headers: { "content-type": "image/png", "cache-control": "no-store" } });
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`http://localhost:${server.port}`);

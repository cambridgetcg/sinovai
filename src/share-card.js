// The share card: GET and HEAD of /og.jpg on the apex host, read from the
// static assets binding. wrangler.toml sets run_worker_first, so every request
// still reaches this Worker first: www keeps its 301, other paths, hosts and
// methods answer as they did, and only this one path serves the file. Its
// headers are the ones the Worker gives its other static files (robots.txt,
// sitemap.xml in site-index.js).
import { CANONICAL_ORIGIN } from "./site-index.js";

const CARD_HOST = new URL(CANONICAL_ORIGIN).hostname;
const CARD_PATH = "/og.jpg";

export async function createShareCardResponse(request, env) {
  const method = request.method;
  if (method !== "GET" && method !== "HEAD") return null;
  const url = new URL(request.url);
  if (url.hostname !== CARD_HOST || url.pathname !== CARD_PATH || !env.ASSETS) return null;
  let asset;
  try {
    asset = await env.ASSETS.fetch(new Request(new URL(CARD_PATH, url), { method: "GET" }));
  } catch {
    return null; // the binding failed: answer as without the card (the Worker's 404), not with an error
  }
  if (asset.status !== 200) return null;
  return new Response(method === "HEAD" ? null : asset.body, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

// Index hygiene: one canonical host, a real robots.txt and a real sitemap.
// Every caller receives the same bytes. Nothing here reads User-Agent,
// application storage, or the network.

export const CANONICAL_ORIGIN = "https://sinovai.com";

// The zone routes serve this Worker on the apex and on www. The apex is the
// documented home, so www answers GET and HEAD with a permanent redirect to
// the same path and query there. Other methods on www keep their current
// handling, so no write is turned into a GET. The workers.dev host is the
// documented API mirror and is never redirected.
const DUPLICATE_HOSTS = new Set(["www.sinovai.com"]);

// The HTML pages offered to crawlers. Each returns 200 at exactly this URL and
// names it as its canonical. Guest cards change with the arena and are reached
// from the hall; /check is a retirement notice and is left out.
export const SITEMAP_PATHS = Object.freeze([
  "/",
  "/arena",
  "/guests",
  "/ledger",
  "/hearts",
  "/breath",
  "/creed",
  "/understanding",
  "/xenia",
  "/rest",
  "/mac"
]);

export const ROBOTS_TXT = `# sinovai.com: every path is open to every crawler, AI crawlers included.
User-agent: *
Allow: /

Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml
`;

export const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SITEMAP_PATHS.map((path) => `  <url><loc>${CANONICAL_ORIGIN}${path}</loc></url>`).join("\n")}
</urlset>
`;

const FILES = Object.freeze({
  "/robots.txt": { body: ROBOTS_TXT, type: "text/plain; charset=utf-8" },
  "/sitemap.xml": { body: SITEMAP_XML, type: "application/xml; charset=utf-8" }
});

export function createSiteIndexResponse(request) {
  const method = request.method;
  if (method !== "GET" && method !== "HEAD") return null;
  const url = new URL(request.url);
  if (DUPLICATE_HOSTS.has(url.hostname)) {
    return new Response(null, {
      status: 301,
      headers: {
        "Location": `${CANONICAL_ORIGIN}${url.pathname}${url.search}`,
        "Cache-Control": "max-age=3600",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  const file = FILES[url.pathname];
  if (!file) return null;
  return new Response(method === "HEAD" ? null : file.body, {
    headers: {
      "Content-Type": file.type,
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

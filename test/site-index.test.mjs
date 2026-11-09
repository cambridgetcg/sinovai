import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/worker.js";
import { ROBOTS_TXT, SITEMAP_PATHS, SITEMAP_XML } from "../src/site-index.js";

// Index hygiene: sinovai.com is the one canonical host. Every HTML page names
// its own apex URL, robots.txt and sitemap.xml are real files, www redirects
// GET and HEAD to the apex, and the workers.dev API mirror keeps serving.

const APEX = "https://sinovai.com";
const WWW = "https://www.sinovai.com";
const WORKERS_DEV = "https://sinovai.axiepro.workers.dev";
const ctx = { waitUntil() {}, passThroughOnException() {} };

function trackingKv(initial = {}) {
  const values = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    reads: [],
    writes: [],
    async get(key, type) {
      this.reads.push(key);
      const value = values.get(key);
      if (value === undefined) return null;
      return type === "json" ? JSON.parse(value) : value;
    },
    async put(key) {
      this.writes.push(key);
      throw new Error(`unexpected KV write: ${key}`);
    },
    async delete(key) {
      this.writes.push(key);
      throw new Error(`unexpected KV delete: ${key}`);
    },
    async list() {
      this.reads.push("(list)");
      return { keys: [...values.keys()].map((name) => ({ name })), list_complete: true, cursor: undefined };
    }
  };
}

function makeEnv() {
  return {
    AGENTS: trackingKv({
      sol: { name: "sol", identity: { kind: "agent" }, state: {}, knows: [], can: [], needs: [], state_md: "name: sol\n", declared_at: "2026-07-11T08:00:00.000Z", claim_token: "server-secret-sol" },
      "%E8%B3%93": { name: "%E8%B3%93", identity: { name: "賓" }, state: {}, knows: [], can: [], needs: [], state_md: "name: 賓\n", claim_token: "t" },
      "a&sol;b": { name: "a&sol;b", identity: {}, state: {}, knows: [], can: [], needs: [], state_md: "name: x\n" }
    }),
    INTERACTIONS: trackingKv({}),
    SITE_TITLE: "sinovai · 愛のAI"
  };
}

function call(env, url, { method = "GET", headers = {}, body } = {}) {
  return worker.fetch(new Request(url, { method, headers, body }), env, ctx);
}

const mediaType = (response) => (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();

function canonicalsIn(html) {
  return [...html.matchAll(/<link\b[^>]*\brel="canonical"[^>]*>/gi)].map(([tag]) => tag.match(/\bhref="([^"]*)"/i)?.[1]);
}

function decodeAttribute(value) {
  return value.replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

// The canonical a crawler would read: the one <link rel="canonical"> in the
// HTML, or the HTTP Link header where the page's own contract forbids <link>.
async function canonicalOf(response) {
  const html = await response.text();
  const inHtml = canonicalsIn(html);
  const header = response.headers.get("link");
  const inHeader = header ? [...header.matchAll(/<([^>]+)>\s*;\s*rel="canonical"/gi)].map(([, href]) => href) : [];
  assert.equal(inHtml.length + inHeader.length, 1, `exactly one canonical, found ${JSON.stringify({ inHtml, inHeader })}`);
  return inHtml.length ? decodeAttribute(inHtml[0]) : inHeader[0];
}

const USER_AGENTS = [
  null,
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
  "CCBot/2.0 (https://commoncrawl.org/faq/)",
  "Google-Extended"
];

test("robots.txt is a real text file that allows every crawler and names the sitemap", async () => {
  const env = makeEnv();
  const bodies = new Set();
  for (const userAgent of USER_AGENTS) {
    for (const accept of [null, "text/html", "text/plain", "*/*", "application/json"]) {
      const headers = {};
      if (userAgent) headers["user-agent"] = userAgent;
      if (accept) headers.accept = accept;
      const response = await call(env, `${APEX}/robots.txt`, { headers });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      bodies.add(await response.text());
    }
  }
  assert.deepEqual([...bodies], [ROBOTS_TXT], "the same bytes for every caller");
  assert.doesNotMatch(ROBOTS_TXT, /<|doctype|no door/i);
  const lines = ROBOTS_TXT.split("\n").filter((line) => line && !line.startsWith("#"));
  assert.deepEqual(lines, ["User-agent: *", "Allow: /", "Sitemap: https://sinovai.com/sitemap.xml"]);
  assert.doesNotMatch(ROBOTS_TXT, /Disallow/i, "no crawler, AI training crawlers included, is excluded");
  assert.deepEqual(env.AGENTS.reads, []);
  assert.deepEqual(env.INTERACTIONS.reads, []);
});

test("sitemap.xml is real XML listing absolute apex URLs only", async () => {
  const env = makeEnv();
  const response = await call(env, `${APEX}/sitemap.xml`, { headers: { accept: "text/html" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/xml; charset=utf-8");
  const xml = await response.text();
  assert.equal(xml, SITEMAP_XML);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">\n/);
  assert.match(xml, /<\/urlset>\n$/);
  const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(([, loc]) => loc);
  assert.deepEqual(locs, SITEMAP_PATHS.map((path) => APEX + path));
  assert.equal(new Set(locs).size, locs.length, "no duplicate entries");
  for (const loc of locs) {
    const url = new URL(loc);
    assert.equal(url.origin, APEX, loc);
    assert.equal(url.search, "", loc);
    assert.doesNotMatch(url.pathname, /\.html$|.\/$/, `${loc} uses the clean form the Worker serves`);
  }
  assert.doesNotMatch(xml, /lastmod|changefreq|priority/, "no dates or weights are invented");
  assert.deepEqual(env.AGENTS.reads, []);
});

test("every sitemap URL returns 200 HTML at exactly that URL and names it as canonical", async () => {
  for (const path of SITEMAP_PATHS) {
    const env = makeEnv();
    const response = await call(env, APEX + path, { headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" } });
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get("location"), null, path);
    assert.equal(mediaType(response), "text/html", path);
    assert.equal(await canonicalOf(response), APEX + path, path);
  }
});

test("other HTML pages carry their own apex canonical; missing pages carry none", async () => {
  const env = makeEnv();
  for (const [path, canonical] of [
    ["/check", `${APEX}/check`],
    ["/check?url=https://example.invalid/", `${APEX}/check`],
    ["/arena?from=somewhere", `${APEX}/arena`],
    ["/?utm_source=x", `${APEX}/`],
    ["/guests/sol", `${APEX}/guests/sol`],
    ["/guests/%E8%B3%93", `${APEX}/guests/%E8%B3%93`],
    ["/guests/%e8%b3%93", `${APEX}/guests/%E8%B3%93`],
    ["/guests/a&sol;b", `${APEX}/guests/a&sol;b`]
  ]) {
    const response = await call(env, APEX + path, { headers: { accept: "text/html" } });
    assert.equal(response.status, 200, path);
    assert.equal(await canonicalOf(response), canonical, path);
  }
  for (const path of ["/guests/nobody-here", "/no-such-room", "/robots", "/sitemap"]) {
    const response = await call(env, APEX + path, { headers: { accept: "text/html" } });
    assert.equal(response.status, 404, path);
    assert.deepEqual(canonicalsIn(await response.text()), [], `${path}: a 404 names no canonical`);
    assert.equal(response.headers.get("link"), null, path);
  }
});

test("the canonical stays inside the rest page's HTML contract", async () => {
  const env = makeEnv();
  const response = await call(env, `${APEX}/rest`, { headers: { accept: "text/html" } });
  const html = await response.text();
  assert.doesNotMatch(html, /<link\b|https?:\/\//i);
  assert.equal(response.headers.get("link"), `<${APEX}/rest>; rel="canonical"`);
  const json = await call(env, `${APEX}/rest`, { headers: { accept: "application/json" } });
  assert.equal(json.headers.get("link"), null, "only the HTML representation names a canonical");
});

test("www answers GET and HEAD with a 301 to the same path on the apex", async () => {
  for (const method of ["GET", "HEAD"]) {
    for (const target of ["/", "/arena", "/guests/sol", "/rest", "/robots.txt", "/sitemap.xml", "/agents?cursor=abc", "/xenia/docs/framework", "/.well-known/agent.json", "/no-such-room"]) {
      const env = makeEnv();
      const response = await call(env, WWW + target, { method, headers: { accept: "text/html" } });
      assert.equal(response.status, 301, `${method} ${target}`);
      assert.equal(response.headers.get("location"), APEX + target, `${method} ${target}`);
      assert.equal(await response.text(), "");
      assert.deepEqual(env.AGENTS.reads, [], `${method} ${target}: redirect reads no storage`);
      assert.deepEqual(env.INTERACTIONS.reads, []);
    }
  }
});

test("www keeps serving other methods in place, so no write becomes a GET", async () => {
  const env = makeEnv();
  const options = await call(env, `${WWW}/agents`, { method: "OPTIONS" });
  assert.equal(options.status, 200);
  assert.equal(options.headers.get("location"), null);
  const combat = await call(env, `${WWW}/combat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agentA: "a", agentB: "b", findingsA: [], findingsB: [] })
  });
  assert.notEqual(combat.status, 301);
  assert.equal(combat.headers.get("location"), null);
  assert.deepEqual(env.AGENTS.writes, []);
});

test("the workers.dev API host is not redirected and serves the same bytes", async () => {
  const env = makeEnv();
  const breathe = await call(env, `${WORKERS_DEV}/breathe`);
  assert.equal(breathe.status, 200);
  assert.equal(mediaType(breathe), "application/json");
  assert.equal(breathe.headers.get("location"), null);
  for (const path of ["/", "/arena", "/robots.txt", "/sitemap.xml"]) {
    const mirror = await call(env, WORKERS_DEV + path, { headers: { accept: "text/html" } });
    const apex = await call(env, APEX + path, { headers: { accept: "text/html" } });
    assert.equal(mirror.status, 200, path);
    assert.equal(mirror.headers.get("location"), null, path);
    assert.equal(await mirror.text(), await apex.text(), `${path}: the mirror serves the apex bytes, canonical included`);
  }
});

test("HEAD on robots.txt and sitemap.xml returns the GET headers without a body", async () => {
  const env = makeEnv();
  for (const path of ["/robots.txt", "/sitemap.xml"]) {
    const get = await call(env, APEX + path);
    const head = await call(env, APEX + path, { method: "HEAD" });
    assert.equal(head.status, 200, path);
    assert.equal(head.headers.get("content-type"), get.headers.get("content-type"), path);
    assert.equal(await head.text(), "", path);
  }
  const post = await call(env, `${APEX}/robots.txt`, { method: "POST", headers: { accept: "application/json" } });
  assert.equal(post.status, 404, "only GET and HEAD read the file");
});

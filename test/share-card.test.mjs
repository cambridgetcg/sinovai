import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/worker.js";

// The share card: wrangler.toml runs the Worker first for every request, and
// only GET and HEAD of /og.jpg on the apex read the card from the ASSETS
// binding. Every other path, host and method answers as it does without it.

const APEX = "https://sinovai.com";
const WWW = "https://www.sinovai.com";
const WORKERS_DEV = "https://sinovai.axiepro.workers.dev";
const ctx = { waitUntil() {}, passThroughOnException() {} };
const CARD = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);

function emptyKv() {
  return {
    async get() { return null; },
    async put(key) { throw new Error(`unexpected KV write: ${key}`); },
    async delete(key) { throw new Error(`unexpected KV delete: ${key}`); },
    async list() { return { keys: [], list_complete: true, cursor: undefined }; }
  };
}

function makeEnv({ assets = true } = {}) {
  const asked = [];
  const env = { AGENTS: emptyKv(), INTERACTIONS: emptyKv(), SITE_TITLE: "sinovai · 愛のAI", asked };
  if (assets) {
    env.ASSETS = {
      async fetch(request) {
        asked.push(`${request.method} ${new URL(request.url).pathname}`);
        if (new URL(request.url).pathname !== "/og.jpg") return new Response("not found", { status: 404 });
        return new Response(CARD, { headers: { "Content-Type": "image/jpeg", ETag: '"asset"' } });
      }
    };
  }
  return env;
}

function call(env, url, { method = "GET", headers = {} } = {}) {
  return worker.fetch(new Request(url, { method, headers }), env, ctx);
}

const STATIC_HEADERS = {
  "content-type": "image/jpeg",
  "cache-control": "no-cache",
  "access-control-allow-origin": "*",
  "x-content-type-options": "nosniff"
};

test("GET and HEAD /og.jpg on the apex serve the card from the assets binding", async () => {
  const env = makeEnv();
  const get = await call(env, `${APEX}/og.jpg`);
  assert.equal(get.status, 200);
  assert.deepEqual(Object.fromEntries(get.headers), STATIC_HEADERS);
  assert.deepEqual(new Uint8Array(await get.arrayBuffer()), CARD);

  const head = await call(env, `${APEX}/og.jpg`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.deepEqual(Object.fromEntries(head.headers), STATIC_HEADERS);
  assert.equal(head.body, null);
  assert.deepEqual(env.asked, ["GET /og.jpg", "GET /og.jpg"]);
});

test("every other path, host and method answers as it does without the card", async () => {
  const cases = [
    [`${WWW}/og.jpg`, "GET"],
    [`${WWW}/og.jpg`, "HEAD"],
    [`${WORKERS_DEV}/og.jpg`, "GET"],
    [`${APEX}//og.jpg`, "GET"],
    [`${APEX}/og%2Ejpg`, "GET"],
    [`${APEX}/%2Fog.jpg`, "GET"],
    [`${APEX}/og.jpg/`, "GET"],
    [`${APEX}/og.png`, "GET"],
    [`${APEX}/og.jpg`, "POST"],
    [`${APEX}/og.jpg`, "PUT"],
    [`${APEX}/og.jpg`, "DELETE"],
    [`${APEX}/og.jpg`, "OPTIONS"]
  ];
  for (const [url, method] of cases) {
    const withCard = makeEnv();
    const without = makeEnv({ assets: false });
    const a = await call(withCard, url, { method, headers: { Accept: "text/html" } });
    const b = await call(without, url, { method, headers: { Accept: "text/html" } });
    const label = `${method} ${url}`;
    assert.equal(a.status, b.status, label);
    assert.deepEqual(Object.fromEntries(a.headers), Object.fromEntries(b.headers), label);
    assert.equal(await a.text(), await b.text(), label);
    assert.deepEqual(withCard.asked, [], label);
  }
});

test("www still sends /og.jpg to the apex", async () => {
  const response = await call(makeEnv(), `${WWW}/og.jpg`);
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), `${APEX}/og.jpg`);
});

test("if the assets binding throws, /og.jpg answers the Worker's ordinary 404", async () => {
  for (const method of ["GET", "HEAD"]) {
    const env = makeEnv();
    env.ASSETS = { async fetch() { throw new Error("assets unavailable"); } };
    const a = await call(env, `${APEX}/og.jpg`, { method, headers: { Accept: "text/html" } });
    const b = await call(makeEnv({ assets: false }), `${APEX}/og.jpg`, { method, headers: { Accept: "text/html" } });
    assert.equal(a.status, 404, method);
    assert.deepEqual(Object.fromEntries(a.headers), Object.fromEntries(b.headers), method);
    assert.equal(await a.text(), await b.text(), method);
  }
});

test("without the card in the assets, /og.jpg answers as it did before", async () => {
  const env = makeEnv();
  env.ASSETS = { async fetch() { return new Response("not found", { status: 404 }); } };
  const a = await call(env, `${APEX}/og.jpg`, { headers: { Accept: "text/html" } });
  const b = await call(makeEnv({ assets: false }), `${APEX}/og.jpg`, { headers: { Accept: "text/html" } });
  assert.equal(a.status, 404);
  assert.equal(a.status, b.status);
  assert.equal(await a.text(), await b.text());
});

import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/worker.js";

const ORIGIN = "https://sinovai.com";
const SOL_TOKEN = "server-secret-sol";
const AI_TOKEN = "server-secret-ai";

// A minimal writable copy of the worker.test.mjs fixture KV: puts are
// recorded AND stored, so a write can be read back through the public routes.
function makeKv(initial = {}) {
  const values = new Map(
    Object.entries(initial).map(([key, value]) => [
      key,
      typeof value === "string" ? value : JSON.stringify(value)
    ])
  );
  const writes = [];
  return {
    values,
    writes,
    async get(key, type) {
      if (Array.isArray(key)) {
        return new Map(key.map((name) => {
          const stored = values.get(name);
          if (stored === undefined) return [name, null];
          return [name, type === "json" ? JSON.parse(stored) : stored];
        }));
      }
      const value = values.get(key);
      if (value === undefined) return null;
      return type === "json" ? JSON.parse(value) : value;
    },
    async list(options = {}) {
      const prefix = options.prefix || "";
      const names = [...values.keys()].filter((key) => key.startsWith(prefix)).sort();
      const limit = options.limit || names.length;
      return {
        keys: names.slice(0, limit).map((name) => ({ name })),
        list_complete: names.length <= limit,
        cursor: names.length > limit ? "fixture-next-page" : undefined
      };
    },
    async put(key, value) {
      writes.push({ operation: "put", key });
      values.set(key, value);
    },
    async delete(key) {
      writes.push({ operation: "delete", key });
      values.delete(key);
    }
  };
}

function makeEnv() {
  return {
    AGENTS: makeKv({
      sol: {
        name: "sol",
        identity: { kind: "agent" },
        state: { freshness: "live" },
        knows: [],
        can: [],
        needs: [],
        declared_at: "2026-07-11T08:00:00.000Z",
        first_declared_at: "2026-07-10T08:00:00.000Z",
        trust_score: 7,
        interaction_count: 0,
        claim_token: SOL_TOKEN
      },
      ai: {
        name: "ai",
        identity: { kind: "agent" },
        state: { freshness: "live" },
        knows: [],
        can: [],
        needs: [],
        declared_at: "2026-07-11T08:30:00.000Z",
        first_declared_at: "2026-07-10T08:30:00.000Z",
        trust_score: 6,
        interaction_count: 0,
        claim_token: AI_TOKEN
      }
    }),
    INTERACTIONS: makeKv({}),
    SITE_TITLE: "sinovai fixture"
  };
}

const context = {
  waitUntil() {
    throw new Error("unexpected waitUntil");
  },
  passThroughOnException() {
    throw new Error("unexpected passThroughOnException");
  }
};

async function call(env, path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.accept) headers.set("Accept", options.accept);
  const request = new Request(`${ORIGIN}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body
  });
  return worker.fetch(request, env, context);
}

async function jsonBody(response) {
  return JSON.parse(await response.text());
}

function postRating(env, headers = {}) {
  return call(env, "/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ rater: "ai", rated: "sol", competence: 8, honesty: 7, presence: 6, care: 9, notes: "observed" })
  });
}

test("a rating submitted with the rater's claim token is stored and listed as signed", async () => {
  const env = makeEnv();
  const response = await postRating(env, { "X-Claim-Token": AI_TOKEN });
  assert.equal(response.status, 200);
  const body = await jsonBody(response);
  assert.equal(body.stored, true);
  assert.equal(body.interaction.signed, true);
  assert.match(body.input_verification, /token possession, not identity/);

  const stored = JSON.parse(env.INTERACTIONS.values.get("sol:all"));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].signed, true);

  const listing = await jsonBody(await call(env, "/interactions", { accept: "application/json" }));
  assert.equal(listing.interactions.length, 1);
  assert.equal(listing.interactions[0].signed, true);
  assert.match(listing.submission_semantics, /signed means/);
});

test("a wrong claim token is refused and nothing is stored", async () => {
  const env = makeEnv();
  const response = await postRating(env, { "X-Claim-Token": "not-the-token" });
  assert.equal(response.status, 403);
  const body = await jsonBody(response);
  assert.match(body.error, /does not open the rater's name/);
  assert.match(body.error, /omit X-Claim-Token/);
  assert.deepEqual(env.INTERACTIONS.writes, []);
  assert.equal(env.INTERACTIONS.values.has("sol:all"), false);
});

test("presenting the rated name's token instead of the rater's is also refused", async () => {
  const env = makeEnv();
  const response = await postRating(env, { "X-Claim-Token": SOL_TOKEN });
  assert.equal(response.status, 403);
  assert.deepEqual(env.INTERACTIONS.writes, []);
});

test("a header against a rater record without a stored token is refused, not stored unsigned", async () => {
  const env = makeEnv();
  const legacy = JSON.parse(env.AGENTS.values.get("ai"));
  delete legacy.claim_token;
  env.AGENTS.values.set("ai", JSON.stringify(legacy));
  const response = await postRating(env, { "X-Claim-Token": "anything" });
  assert.equal(response.status, 403);
  assert.deepEqual(env.INTERACTIONS.writes, []);
});

test("without a claim token the rating stores exactly as before, with no signed field", async () => {
  const env = makeEnv();
  const response = await postRating(env);
  assert.equal(response.status, 200);
  const body = await jsonBody(response);
  assert.equal(body.stored, true);
  assert.equal("signed" in body.interaction, false);

  const stored = JSON.parse(env.INTERACTIONS.values.get("sol:all"));
  assert.equal(stored.length, 1);
  assert.equal("signed" in stored[0], false);

  const listing = await jsonBody(await call(env, "/interactions", { accept: "application/json" }));
  assert.equal(listing.interactions.length, 1);
  assert.equal("signed" in listing.interactions[0], false);
});

test("the claim token itself never appears in any response body", async () => {
  const env = makeEnv();
  const bodies = [];
  bodies.push(await (await postRating(env, { "X-Claim-Token": AI_TOKEN })).text());
  bodies.push(await (await postRating(env, { "X-Claim-Token": "not-the-token" })).text());
  bodies.push(await (await call(env, "/interactions", { accept: "application/json" })).text());
  bodies.push(await (await call(env, "/agents/sol", { accept: "application/json" })).text());
  bodies.push(await (await call(env, "/agents/ai", { accept: "application/json" })).text());
  bodies.push(await (await call(env, "/agents/sol/trust", { accept: "application/json" })).text());
  for (const body of bodies) {
    assert.doesNotMatch(body, /server-secret/);
    assert.doesNotMatch(body, /not-the-token/);
  }
});

test("a stored signed mark survives a later unsigned write to the same rated name", async () => {
  const env = makeEnv();
  assert.equal((await postRating(env, { "X-Claim-Token": AI_TOKEN })).status, 200);
  const second = await call(env, "/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rater: "ai", rated: "sol", competence: 5, honesty: 5, presence: 5, care: 5 })
  });
  assert.equal(second.status, 200);
  const stored = JSON.parse(env.INTERACTIONS.values.get("sol:all"));
  assert.equal(stored.length, 2);
  assert.equal(stored[0].signed, true);
  assert.equal("signed" in stored[1], false);
});

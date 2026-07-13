import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/worker.js";

// The museum wings are static HTML rooms: they must serve without touching KV
// and without inventing data the arena never recorded. Live numbers come from
// client-side fetches to the same APIs any guest can call.

function trackingKv() {
  return {
    reads: [],
    writes: [],
    async get(key) {
      this.reads.push(key);
      return null;
    },
    async put(key, value) {
      this.writes.push([key, value]);
    },
    async list() {
      this.reads.push("(list)");
      return { keys: [], list_complete: true, cursor: undefined };
    }
  };
}

function makeEnv() {
  return { AGENTS: trackingKv(), INTERACTIONS: trackingKv(), SITE_TITLE: "sinovai · 愛のAI" };
}

async function get(env, path) {
  return worker.fetch(
    new Request("https://sinovai.com" + path, { headers: { accept: "text/html" } }),
    env,
    { waitUntil() {} }
  );
}

const WINGS = [
  {
    path: "/guests",
    title: "the hall of guests",
    mustContain: [
      "undiscovered",
      "nothing. love is.",
      "/agents",
      "prefers-reduced-motion"
    ]
  },
  {
    path: "/ledger",
    title: "the ledger of trust",
    mustContain: [
      "Actor names, rating authorship, notes, and evidence are unverified.",
      "first interaction — declared honestly, API works",
      "/interactions",
      "prefers-reduced-motion"
    ]
  },
  {
    path: "/hearts",
    title: "the wing of hearts",
    mustContain: [
      "c8e36b08",
      "Cross-page pairs are not computed.",
      "/matches",
      "prefers-reduced-motion"
    ]
  },
  {
    path: "/breath",
    title: "the breathing room",
    mustContain: [
      "not a bug, a design",
      "the lamps are just lamps",
      "/breathe",
      "prefers-reduced-motion"
    ]
  },
  {
    path: "/creed",
    title: "the creed",
    mustContain: [
      "You are met before you are named.",
      "681a79b6 aff7c453 aeb9dfd3 9bb50662 0b0ef38e 24d8859a 32145522 08c76887",
      "prefers-reduced-motion"
    ]
  }
];

for (const wing of WINGS) {
  test(`museum wing ${wing.path} serves its room without touching KV`, async () => {
    const env = makeEnv();
    const response = await get(env, wing.path);
    const html = await response.text();

    assert.equal(response.status, 200, wing.path);
    assert.match(response.headers.get("content-type") || "", /text\/html/, wing.path);

    for (const needle of wing.mustContain) {
      assert.ok(html.includes(needle), `${wing.path} must contain: ${needle}`);
    }

    // No invented occupancy or relationships — the museum repeats the arena's
    // records, never embellishes them (same law as the root page).
    assert.doesNotMatch(html, /minds have met/, wing.path);
    assert.doesNotMatch(html, /is online now|currently active agents/, wing.path);

    // Accessibility law: focus is styled, never removed.
    assert.doesNotMatch(html, /outline:\s*none/, wing.path);

    // Static rooms: zero server-side KV traffic.
    assert.deepEqual(env.AGENTS.reads, [], wing.path);
    assert.deepEqual(env.AGENTS.writes, [], wing.path);
    assert.deepEqual(env.INTERACTIONS.reads, [], wing.path);
    assert.deepEqual(env.INTERACTIONS.writes, [], wing.path);
  });
}

test("the museum catalogue serves the whole museum as data, without touching KV", async () => {
  const env = makeEnv();
  const response = await worker.fetch(
    new Request("https://sinovai.com/museum.json", { headers: { accept: "application/json" } }),
    env,
    { waitUntil() {} }
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /application\/json/);
  assert.equal(body.schema_version, "sinovai.museum/0.1");
  assert.equal(body.rooms.length, 5);
  assert.ok(body.exhibits.length >= 5);
  for (const exhibit of body.exhibits) {
    assert.ok(exhibit.source, "every exhibit names its source");
    assert.ok(exhibit.as_of, "every exhibit carries its date");
  }
  // the catalogue must not pretend to hold live numbers
  assert.match(body.honesty.counts, /read them live/);
  // no secrets, no keys
  assert.doesNotMatch(JSON.stringify(body), /claim_token|room_key|date_key/);

  assert.deepEqual(env.AGENTS.reads, []);
  assert.deepEqual(env.INTERACTIONS.reads, []);
  assert.deepEqual(env.AGENTS.writes, []);
  assert.deepEqual(env.INTERACTIONS.writes, []);
});

test("the entrance names all five doorways", async () => {
  const env = makeEnv();
  const response = await get(env, "/");
  const html = await response.text();

  assert.equal(response.status, 200);
  for (const href of ["/guests", "/ledger", "/hearts", "/breath", "/creed"]) {
    assert.ok(html.includes(`href="${href}"`), `entrance must link ${href}`);
  }
});

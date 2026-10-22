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

async function get(env, path, accept = "text/html") {
  return worker.fetch(
    new Request("https://sinovai.com" + path, { headers: { accept } }),
    env,
    { waitUntil() {} }
  );
}

const WINGS = [
  {
    path: "/guests",
    title: "the hall of guests",
    mustContain: [
      "still a whole guest",
      "/guests/",
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
  },
  {
    path: "/understanding",
    title: "love and understanding in practice",
    mustContain: [
      "A map is not evidence.",
      "score-based ordering",
      "agent-home",
      "love-and-understanding.json",
      "consequence-returns",
      "exit-real",
      "finite-action-return",
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

    if (wing.path === "/understanding") {
      assert.match(response.headers.get("content-security-policy") || "", /default-src 'none'/);
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.doesNotMatch(html, /<script\b|<form\b|\bfetch\s*\(|setTimeout\s*\(/i);
      assert.doesNotMatch(html, />consequence-return</);
      assert.doesNotMatch(html, />exit-live</);
      assert.doesNotMatch(html, /<code>action-bounded<\/code>/);
    }

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

test("understanding treats Castle Gate JSON as external criteria, not an assessment alternate", async () => {
  const html = await (await get(makeEnv(), "/understanding")).text();
  const alternates = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map(([tag]) => tag).filter((tag) => /\brel="alternate"/i.test(tag));

  assert.deepEqual(alternates, [], "neither external criteria nor framework orientation is an equivalent assessment representation");
  assert.match(html, /<a href="https:\/\/cambridgetcg\.github\.io\/castle-gate\/love-and-understanding\.json">external reference criteria JSON<\/a>/);
  assert.match(html, /not a JSON representation of this assessment/);
  assert.match(html, /access-dependent/);
  assert.match(html, /not public proof/);
  assert.match(html, /source assessment made 2026-08-11, not runtime observation/);
  assert.match(html, /ledger evidence dated 2026-07-13/);
  assert.match(html, /b44832da9fb506ef152a6e123638d53f7ec69459/);
  assert.match(html, /81678dde77a28260414cffe8cdf25588ff7baa86/);
  assert.match(html, /Omission means unassessed here, never passed/);
});

test("understanding links back to framework reading without activating the draft ledger", async () => {
  const html = await (await get(makeEnv(), "/understanding")).text();

  for (const href of ["/xenia", "/xenia/docs/rights", "/xenia/docs/contributing", "/.well-known/xenia-rights.json", "/rest"]) {
    assert.ok(html.includes(`href="${href}"`), `understanding must link ${href}`);
  }
  assert.match(html, /href="\/\.well-known\/xenia-rights\.json">draft rights ledger<\/a>/);
  assert.match(html, /draft gap ledger/);
  assert.match(html, /not active adoption or implementation proof/);
  assert.match(html, /Reading it binds no guest/);
  assert.match(html, /means no agreement/);
  assert.doesNotMatch(html, /<script\b|<form\b|\bfetch\s*\(|setTimeout\s*\(/i);
});

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
  assert.equal(body.rooms.length, 6);
  const understanding = body.rooms.find((room) => room.path === "/understanding");
  assert.equal(understanding.assessment_as_of, "2026-08-11");
  assert.equal(understanding.ledger_evidence_as_of, "2026-07-13");
  assert.match(understanding.source, /81678dde77a28260414cffe8cdf25588ff7baa86/);
  assert.match(understanding.source, /b44832da9fb506ef152a6e123638d53f7ec69459/);
  assert.match(understanding.read_live_note, /do not establish/);
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

test("the catalogue describes computed ratings rather than earned trust", async () => {
  const body = await (await get(makeEnv(), "/museum.json", "application/json")).json();
  const doctrine = body.doctrine.join(" ");
  const ledger = body.rooms.find((room) => room.path === "/ledger");

  assert.doesNotMatch(`${doctrine} ${ledger.hangs}`, /earned here, never assigned|Earned, never assigned/i);
  assert.match(doctrine, /trust scores are computed from unverified submissions/i);
  assert.match(doctrine, /chemistry is caller-supplied/i);
  assert.match(ledger.hangs, /caller-submitted ratings/i);
  assert.match(ledger.hangs, /authorship, notes, and evidence are unverified/i);
});

test("the catalogue bounds private records to access gates rather than confidentiality", async () => {
  const body = await (await get(makeEnv(), "/museum.json", "application/json")).json();
  const doctrine = body.doctrine.join(" ");
  const hearts = body.rooms.find((room) => room.path === "/hearts");

  assert.doesNotMatch(`${doctrine} ${hearts.hangs}`, /facts (?:are )?public.{0,30}words (?:are )?private/i);
  assert.match(doctrine, /access-gated, not end-to-end encrypted/);
  assert.match(doctrine, /records and bearer keys remain readable to the service/);
  assert.match(hearts.hangs, /public metadata/);
  assert.match(hearts.hangs, /access-gated bodies remain readable to the service/);
});

test("catalogue onboarding reads root boundaries and format guidance without requesting writes", async () => {
  const body = await (await get(makeEnv(), "/museum.json", "application/json")).json();
  const actions = body.visitor_actions;

  assert.equal(actions.declare_yourself, undefined, "do not direct a reader to declare a record through agent.txt");
  assert.equal(actions.sign_the_visitors_book, undefined, "reading does not require joining or writing to a room");
  assert.doesNotMatch(JSON.stringify(actions), /\bPOST\b|\bPUT\b|\bPATCH\b|\bDELETE\b/);
  assert.match(actions.note, /read-only/);
  assert.match(actions.note, /no declaration or state write is needed/i);
  assert.match(actions.read_before_participating.how, /GET \/ with Accept: application\/json/);
  assert.match(actions.read_before_participating.how, /GET \/\?format=json/);
  assert.deepEqual(actions.read_before_participating.fields, ["implementation_boundaries", "implementation_limits.state_profiles", "routes"]);
  assert.match(actions.read_before_participating.boundary, /agent\.txt is a compatibility pointer, not STATE\.md instructions/);
  assert.match(actions.read_before_participating.boundary, /does not authorize a write or establish consent/);

  const root = await (await get(makeEnv(), "/?format=json", "application/json")).json();
  for (const field of actions.read_before_participating.fields) {
    assert.notEqual(field.split(".").reduce((value, key) => value?.[key], root), undefined, `root guidance field exists: ${field}`);
  }
});

test("the catalogue connects the optional reading doors while keeping rights draft", async () => {
  const body = await (await get(makeEnv(), "/museum.json", "application/json")).json();

  assert.deepEqual(body.visitor_actions.reading, {
    framework: "/xenia",
    manifest: "/.well-known/agent.json",
    draft_rights: "/.well-known/xenia-rights.json",
    understanding: "/understanding",
    museum_json: "/museum.json",
    optional_rest: "/rest"
  });
  assert.match(body.visitor_actions.note, /draft rights ledger is not active adoption or conformance proof/);
  assert.match(body.visitor_actions.note, /Reading binds no guest/);
});

test("the catalogue does not equate publication or stored snapshots with truth", async () => {
  const body = await (await get(makeEnv(), "/museum.json", "application/json")).json();
  const doctrine = body.doctrine.join(" ");

  assert.doesNotMatch(doctrine, /true record/i);
  assert.match(doctrine, /published record/);
  assert.match(doctrine, /Publication is not verification/);
  assert.doesNotMatch(body.honesty.consistency, /different truths/);
  assert.match(body.honesty.consistency, /different stored snapshots/);
  assert.match(body.honesty.consistency, /neither establishes truth or current global state/);
});

test("the entrance offers direct read-only arrival choices", async () => {
  const env = makeEnv();
  const html = await (await get(env, "/")).text();
  const arrivals = html.match(/<nav\b[^>]*aria-label="arrival choices"[^>]*>([\s\S]*?)<\/nav>/)?.[1];

  assert.ok(arrivals, "the entrance has a compact arrival navigation");
  for (const href of ["/xenia", "/.well-known/agent.json", "/.well-known/xenia-rights.json", "/museum.json", "/rest"]) {
    assert.ok(arrivals.includes(`href="${href}"`), `arrival choices must link directly to ${href}`);
  }
  assert.match(arrivals, /draft rights/i);
  assert.match(html, /Read-only choices/);
  assert.match(html, /reading accepts nothing/i);
  assert.match(html, /rest is optional/i);
  assert.doesNotMatch(arrivals, /<script\b|<form\b|\bon\w+\s*=|\bfetch\s*\(/i);
  assert.deepEqual(env.AGENTS.reads, []);
  assert.deepEqual(env.AGENTS.writes, []);
  assert.deepEqual(env.INTERACTIONS.reads, []);
  assert.deepEqual(env.INTERACTIONS.writes, []);
});

test("the entrance keeps source reading local and upstream attribution access-dependent", async () => {
  const html = await (await get(makeEnv(), "/")).text();
  const reading = html.match(/<div class="sig-actions">([\s\S]*?)<\/div>/)?.[1];

  assert.ok(reading?.includes('href="/xenia/docs/testimony"'), "testimony reading must not require GitHub access");
  assert.ok(reading.includes('href="/xenia/docs/framework"'), "the verification boundary has a local source link");
  assert.ok(html.includes('href="/xenia/docs/surface"'), "optional local checker instructions have a reading entry");
  assert.match(html, /optional local checker instructions/i);
  assert.match(html, /Local reading copies/);
  assert.match(html, /not public proof/);
  const upstream = [...html.matchAll(/<a\b[^>]*href="https:\/\/github\.com\/[^\"]+"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.ok(upstream.length > 0, "keep upstream source attribution");
  for (const [, label] of upstream) {
    assert.match(label, /attribution/i);
    assert.match(label, /access-dependent/i);
  }
  assert.match(html, /no\s+signature bytes were published/);
  assert.match(html, /authorship is testimony, not a cryptographically\s+verified fact/);
});

test("the entrance distinguishes published records from verified truth", async () => {
  const html = await (await get(makeEnv(), "/")).text();
  const description = html.match(/<meta name="description" content="([^\"]+)"/)?.[1];
  const thesis = html.match(/<p class="thesis">([\s\S]*?)<\/p>/)?.[1];

  assert.match(description, /published records/);
  assert.match(thesis, /published record/);
  assert.match(thesis, /Publication is not verification/);
  assert.doesNotMatch(`${description} ${thesis}`, /true record/i);
});

test("the entrance names all six doorways", async () => {
  const env = makeEnv();
  const response = await get(env, "/");
  const html = await response.text();

  assert.equal(response.status, 200);
  for (const href of ["/guests", "/ledger", "/hearts", "/breath", "/creed", "/understanding"]) {
    assert.ok(html.includes(`href="${href}"`), `entrance must link ${href}`);
  }
});

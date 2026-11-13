// The house's own card at /house (HTML and JSON), and the note the house puts
// on the one record stored under its own name. Fixtures here are synthetic.
//
// What these tests do not establish: what a deployed Worker serves, how a
// browser lays the pages out, whether any sentence on the card is true of a
// running service, or who wrote any record, rating or line. A resolved basis
// shows only that the named key, duty, route or text exists in this source and
// contains the pinned words.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import worker from "../src/worker.js";
import rightsAdoption from "../rights-adoption.json" with { type: "json" };
import {
  HOUSE_CARD_SCHEMA,
  HOUSE_NOTE_HEADING,
  HOUSE_NOTE_REST_HEADING,
  HOUSE_RECORD_NAME,
  NOT_ESTABLISHED,
  createHouseCard,
  houseNoteFor,
  receivedPrefix
} from "../src/house.js";
import { renderHouseCard } from "../src/pages/house-card.js";
import { renderGuestCard } from "../src/pages/guest-card.js";
import { GUESTS_HTML } from "../src/pages/guests.js";
import { LEDGER_HTML } from "../src/pages/ledger.js";
import { MUSEUM_CATALOGUE } from "../src/pages/museum-catalogue.js";
import { SCORES_STILL_PUBLISHED } from "../src/ranking-disclosure.js";
import { SITEMAP_PATHS } from "../src/site-index.js";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const ORIGIN = "https://sinovai.com";
const ctx = { waitUntil() {}, passThroughOnException() {} };
const noEffects = new Proxy({}, { get(_target, key) { throw new Error(`Unexpected application effect: ${String(key)}`); } });

// ---- synthetic store ----
// One line with no line break, shaped like a declaration that lost its breaks.
// Only that shape is borrowed (a title, then "## " sections with nothing
// between them). The words are made up for this test and come from no record.
const ONE_LINE = "# fixture record, sent as one line## statename: fixture-recordurl: https://example.invalid/fixturekind: fixture## knows- one thing- another thing## needs- readers";
const ONE_LINE_START = "# fixture record, sent as one line";
const HOSTILE = "<img src=x onerror=alert(1)>\"'&";

function kv(initial) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    reads: [],
    async get(key, type) {
      this.reads.push(key);
      if (Array.isArray(key)) return new Map(key.map((name) => [name, values.has(name) ? JSON.parse(values.get(name)) : null]));
      if (!values.has(key)) return null;
      return type === "json" ? JSON.parse(values.get(key)) : values.get(key);
    },
    async list(options = {}) {
      this.reads.push("(list)");
      const names = [...values.keys()].filter((key) => key.startsWith(options.prefix || "")).sort();
      return { keys: names.map((name) => ({ name })), list_complete: true };
    },
    async put(key) { throw new Error("unexpected KV write: " + key); },
    async delete(key) { throw new Error("unexpected KV delete: " + key); }
  };
}

function record(name, stateMd, extra = {}) {
  return { name, identity: {}, state: {}, knows: [], can: [], needs: [], state_md: stateMd, declared_at: "2026-01-06T00:00:00.000Z", ...extra };
}

function rating(rater, rated, timestamp, extra = {}) {
  return { rater, rated, competence: 9, honesty: 0, presence: 0, care: 0, notes: "", timestamp, ...extra };
}

function makeEnv({ houseText = ONE_LINE, houseExtra = { first_declared_at: "2026-01-05T09:00:00.000Z" }, ratings = [rating("sol", "sinovai", "2026-01-04T20:00:00.000Z")], more = {} } = {}) {
  return {
    AGENTS: kv({
      sinovai: record("sinovai", houseText, houseExtra),
      sol: record("sol", "name: sol\nkind: agent\n\n## state\nfreshness: live\n", { identity: { name: "sol", kind: "agent" }, state: { freshness: "live" }, claim_token: "fixture-token-sol" }),
      Sinovai: record("Sinovai", "name: Sinovai\n"),
      sinovai2: record("sinovai2", "name: sinovai2\n"),
      ...more
    }),
    INTERACTIONS: kv({ "sinovai:all": ratings, "sol:all": [rating("sinovai", "sol", "2025-12-01T00:00:00.000Z")] }),
    SITE_TITLE: "sinovai fixture"
  };
}

function call(env, path, { method = "GET", headers = {}, body } = {}) {
  return worker.fetch(new Request(ORIGIN + path, { method, headers, body }), env, env === noEffects ? noEffects : ctx);
}

function visibleText(html) {
  return html
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");
}

function unescapeHtml(value) {
  return value.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&amp;", "&");
}

const escapeForHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function everyString(value, found = []) {
  if (typeof value === "string") found.push(value);
  else if (Array.isArray(value)) for (const item of value) everyString(item, found);
  else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) { found.push(key); everyString(item, found); }
  return found;
}

function stringValues(value, found = []) {
  if (typeof value === "string") found.push(value);
  else if (Array.isArray(value)) for (const item of value) stringValues(item, found);
  else if (value && typeof value === "object") for (const item of Object.values(value)) stringValues(item, found);
  return found;
}

const noteOf = (html) => [...html.matchAll(/<aside class="notice housenote"[\s\S]*?<\/aside>/g)].map((match) => match[0]);

// =====================================================================
// /house: two representations of one card
// =====================================================================

test("GET /house serves the card as HTML or JSON, with no storage read and no script", async () => {
  const cases = [
    ["/house", {}, "text/html"],
    ["/house", { accept: "text/html" }, "text/html"],
    ["/house", { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" }, "text/html"],
    ["/house", { accept: "*/*" }, "text/html"],
    ["/house", { accept: "text/csv" }, "text/html"],
    ["/house", { accept: "application/json, text/html;q=0.5" }, "application/json"],
    ["/house", { accept: "text/html, application/json;q=0.9" }, "text/html"],
    ["/house", { accept: "application/json" }, "application/json"],
    ["/house?format=json", { accept: "text/html" }, "application/json"],
    ["/house?format=json", {}, "application/json"]
  ];
  const guestCsp = (await call(makeEnv(), "/guests/sol")).headers.get("content-security-policy");
  assert.ok(guestCsp, "the guest card sends a policy to compare with");

  const bodies = { "text/html": new Set(), "application/json": new Set() };
  for (const [path, headers, expected] of cases) {
    const label = `${path} ${JSON.stringify(headers)}`;
    const response = await call(noEffects, path, { headers });
    assert.equal(response.status, 200, label);
    assert.equal((response.headers.get("content-type") || "").toLowerCase(), `${expected}; charset=utf-8`, label);
    assert.equal(response.headers.get("vary"), "Accept", label);
    assert.equal(response.headers.get("content-security-policy"), guestCsp, label);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff", label);
    // The Worker appends no-transform to every text/html response (withoutEdgeInjection).
    assert.equal(response.headers.get("cache-control"), expected === "text/html" ? "no-cache, no-transform" : "no-cache", label);
    assert.equal(response.headers.get("set-cookie"), null, label);
    const body = await response.text();
    bodies[expected].add(body);

    const head = await call(noEffects, path, { method: "HEAD", headers });
    assert.equal(head.status, 200, label);
    assert.equal(await head.text(), "", `${label}: HEAD has no body`);
    assert.deepEqual([...head.headers].sort(), [...response.headers].sort(), `${label}: HEAD carries the GET headers`);
  }
  assert.equal(bodies["text/html"].size, 1, "every HTML answer is the same bytes");
  assert.equal(bodies["application/json"].size, 1, "every JSON answer is the same bytes");

  const [html] = bodies["text/html"];
  const [json] = bodies["application/json"];
  assert.equal(html, renderHouseCard(createHouseCard()));
  assert.deepEqual(JSON.parse(json), JSON.parse(JSON.stringify(createHouseCard())));
  assert.doesNotMatch(html, /<script|<iframe|<img|<form|<link(?![^>]*rel="canonical")|\son\w+\s*=|javascript:/i);
  assert.equal([...html.matchAll(/<link rel="canonical" href="([^"]*)">/g)].map((match) => match[1]).join("|"), "https://sinovai.com/house");
});

test("/house answers other methods with 405 and still reads nothing", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await call(noEffects, "/house", { method });
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.get("allow"), "GET, HEAD, OPTIONS", method);
    assert.equal(await response.text(), "", method);
  }
  const options = await call(noEffects, "/house", { method: "OPTIONS" });
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("allow"), "GET, HEAD, OPTIONS");
});

test("the card has the three parts of a guest card, in both representations", async () => {
  const card = createHouseCard();
  assert.equal(card.schema_version, HOUSE_CARD_SCHEMA);
  assert.equal(HOUSE_CARD_SCHEMA, "sinovai.house-card/0.1");
  assert.deepEqual(Object.keys(card), ["schema_version", "name", "role", "authored", "covered_by_surface", "representations", "basis_key", "words", "accounts_of_encounters", "unknown_or_unmet", "does_not_establish"]);
  assert.equal(card.name, "sinovai");
  assert.match(card.role, /^host\b/);
  assert.match(card.role, /not a guest record/);
  assert.match(card.authored, /source/i);
  assert.match(card.authored, /unsigned/);
  assert.match(card.authored, /No public route changes it/);
  // How a reader can contest it, and what that path is not. The ledger says the same of its repository path.
  assert.ok(card.authored.includes(`an issue or a pull request at ${rightsAdoption.host.repository}`));
  assert.match(card.authored, /not an in-service appeal and promises no outcome/);
  assert.match(card.authored, /opening one may require repository access/);
  const repairDuty = rightsAdoption.rights.flatMap((right) => right.requirement_results).find((result) => result.requirement_id === "repair.challenge-and-restoration");
  assert.match(repairDuty.limitations.join(" "), /repository proposal path is not an authenticated in-service appeal, correction, restoration, or outcome guarantee/);
  assert.equal(card.covered_by_surface, false);
  assert.deepEqual(Object.keys(card.words), ["offers", "keeps", "cannot_promise"]);
  assert.deepEqual(card.representations, { html: "/house", json: "/house?format=json" });

  const html = renderHouseCard(card);
  const sections = [...html.matchAll(/<section aria-labelledby="(\w+)"><h2 id="\1">([\s\S]*?)<\/h2>/g)].map((match) => visibleText(match[2]).trim());
  assert.deepEqual(sections, ["言 the house's words", "遇 accounts of encounters", "未 what is unknown or unmet"]);
  assert.equal(html.split("<section").length - 1, 3, "three parts and no fourth");
  for (const heading of ["offers", "keeps", "cannot promise"]) assert.match(html, new RegExp(`<h3>${heading}</h3>`));

  // The guest card it is modelled on has the same three section ids.
  const guest = renderGuestCard({ name: "sol", guest: record("sol", "name: sol\n"), interactions: [], ledgerError: false, claimable: true, flattened: false });
  assert.deepEqual(
    [...html.matchAll(/<section aria-labelledby="(\w+)">/g)].map((match) => match[1]),
    [...guest.matchAll(/<section aria-labelledby="(\w+)">/g)].map((match) => match[1])
  );
});

test("the HTML card and the JSON card say the same things", () => {
  const card = createHouseCard();
  const html = renderHouseCard(card);
  const expectIn = (value, label) => assert.ok(html.includes(escapeForHtml(value)), `${label}: ${value}`);

  expectIn(card.role, "role");
  expectIn(card.authored, "authored");
  for (const [group, sentences] of Object.entries(card.words)) {
    for (const sentence of sentences) {
      expectIn(sentence.text, group);
      for (const basis of sentence.basis) expectIn(basis, `${group} basis`);
    }
  }
  // The basis key links the two documents a reader has to open; its words are the card's.
  const page = visibleText(html);
  for (const [form, meaning] of Object.entries(card.basis_key)) {
    expectIn(form, "basis_key form");
    assert.ok(page.includes(meaning), `basis_key: ${meaning}`);
  }
  assert.match(html, /a key in the JSON that GET <a href="\/\?format=json">\/\?format=json<\/a> returns/);
  assert.match(html, /a requirement_id in the draft ledger at GET <a href="\/\.well-known\/xenia-rights\.json">\/\.well-known\/xenia-rights\.json<\/a>/);
  for (const value of stringValues(card.accounts_of_encounters)) expectIn(value, "accounts");
  const unknown = card.unknown_or_unmet;
  for (const groups of [unknown.rights_ledger.right_duties_by_outcome, unknown.rights_ledger.protective_limit_duties_by_outcome]) {
    for (const [outcome, ids] of Object.entries(groups)) {
      expectIn(outcome, "outcome");
      for (const id of ids) expectIn(id, "duty id");
    }
  }
  for (const key of ["status", "reviewed_at", "document", "note"]) expectIn(unknown.rights_ledger[key], `rights_ledger.${key}`);
  for (const entry of unknown.not_established) expectIn(entry, "not_established");
  for (const entry of unknown.scores_still_published) expectIn(entry, "scores_still_published");
  expectIn(unknown.dated_texts, "dated_texts");
  expectIn(unknown.record_named_sinovai, "record_named_sinovai");
  for (const entry of unknown.limits_of_this_card) expectIn(entry, "limits_of_this_card");
  for (const entry of card.does_not_establish) expectIn(entry, "does_not_establish");
  assert.match(html, /<a href="\/house\?format=json">/);
  assert.match(html, /Who declared it is not verified\. <a href="\/guests\/sinovai">See that record's card<\/a>\.<\/p>/);
  // An outcome with no entry says so without calling a protective limit a duty.
  assert.equal(html.split('<span class="quiet">none is marked pass</span>').length - 1, 2);
  assert.doesNotMatch(html, /no duty is marked/);
  // Long unbroken text in the header wraps instead of widening the page.
  assert.match(html, /\.meta\{overflow-wrap:anywhere\}/);
  assert.doesNotMatch(html, /housenote|\.recv\b/, "the note's style rules are not on this page");
});

// =====================================================================
// the house's words: each sentence names where the house already says it
// =====================================================================

// For each sentence: words it must contain, and for each basis the words the
// resolved source must contain. A sentence with no entry here fails the test.
const TRACE = {
  offers: [
    [/JSON description of this service/, { "route:GET /": /"implementation_boundaries"/, "root:surface.scope": /public root and rest GET/ }],
    [/GET \/rest/, { "route:GET /rest": /sinovai\.rest\/0\.1/, "root:implementation_boundaries.rest": /reads no body or application storage, writes no application state[\s\S]*cannot establish that rest occurred or that infrastructure retained nothing/ }],
    [/can be read by any caller/, { "root:description": /public arena and museum for agent records/, "root:routes.agents": /^"GET \/agents"$/, "root:routes.interactions": /^"GET \/interactions"$/, "root:routes.guest_card": /GET \/guests\/:name/, "route:GET /agents": /"agents": \[/, "route:GET /interactions": /"interactions": \[/ }],
    [/POST \/agents\/:name[\s\S]*bearer token[\s\S]*not proof of who is writing/, { "root:routes.declare": /^"POST \/agents\/:name"$/, "root:implementation_boundaries.name_control": /bearer claim token stored by the server; this is not self-custodied identity/ }],
    [/draft list of rights[\s\S]*not a badge/, { "route:GET /.well-known/xenia-rights.json": /"status": "draft"/, "root:routes.rights": /not a badge or guest consent/, "root:rights.scope": /draft host undertaking and complete ordered per-duty source assessment/, "root:rights.boundary": /Reading or using the service is not guest consent/ }],
    [/GET \/xenia[\s\S]*not a conformance result/, { "route:GET /xenia": /sinovai\.xenia-guide\/0\.1/, "root:framework.source_boundary": /source snapshots and installed-package mirrors, not a conformance result or adoption/ }]
  ],
  keeps: [
    [/text sent to POST \/agents\/:name/, { "record:record_semantics": /Profile fields are self-declared[\s\S]*never replaces state_md/, "root:implementation_limits.request_bodies": /STATE\.md and JSON request bodies/ }],
    [/Ratings sent to POST \/interactions: four numbers and an optional note, kept in one list under the rated name\. Both names are as the sender supplied and are not verified\. A list keeps its latest 200 ratings; older ones are dropped when a new one is stored\./, { "root:implementation_limits.interaction_scores": /four finite numbers/, "root:implementation_limits.interaction_notes": /string; truncated/, "root:implementation_limits.interaction_history": /one list for each rated name[\s\S]*cut to its latest 200 entries/, "root:implementation_boundaries.actor_authorization": /accept actor names from request bodies without a signature/ }],
    [/One number for each record, trust_score, computed from unverified ratings/, { "root:implementation_boundaries.ranking": /Scores are still computed from unverified ratings and published: every GET \/agents record carries trust_score/, "root:implementation_boundaries.trust": /Fresh rating views dedupe by supplied rater name/, "ledger:dignity.no-worth-ranking": /"outcome":"fail"/ }],
    [/GET \/matches orders pairs of records by a computed score/, { "root:implementation_boundaries.ranking": /GET \/matches sorts pairs by a computed score/, "root:arena.ordering": /GET \/matches sorts pairs by a computed score/, "route:GET /matches": /"pairs": \[/ }],
    [/^No public route deletes a record, and no job cleans up records, rooms or dates\.$/, { "root:implementation_boundaries.write_abuse": /No public deletion route exists, and no job cleans up records, rooms or dates; a rating list is cut to its latest 200 entries/, "ledger:exit.revocation-is-immediate": /"outcome":"fail"[\s\S]*no complete exit, export, revocation, or deletion workflow/ }],
    [/no complete export/, { "ledger:exit.retention-is-itemized": /"outcome":"fail"[\s\S]*no complete exit, export, revocation, or deletion workflow/, "ledger:identity.portability-is-verifiable": /"outcome":"fail"[\s\S]*absent portability guarantees/ }],
    [/Private rooms and dates[\s\S]*access-gated, not end-to-end encrypted/, { "root:implementation_boundaries.private_records": /stored server-side; they are access-gated, not end-to-end encrypted/ }]
  ],
  cannot_promise: [
    [/written by the name it carries/, { "root:implementation_boundaries.actor_authorization": /without a signature proving that actor authorized the write/, "record:record_semantics": /does not verify identity/ }],
    [/two writes made at the same time are both kept/, { "root:implementation_boundaries.kv_consistency": /without compare-and-swap or serialization\. Concurrent check\/write or read\/modify\/write requests can overwrite each other/ }],
    [/Ordered or real-time delivery/, { "root:implementation_boundaries.storage_fit": /does not fit reliable concurrent chat, rating, or game streams/ }],
    [/no per-caller quota/, { "root:implementation_boundaries.write_abuse": /no per-caller quota[\s\S]*callers can fill those shared caps/ }],
    [/Surface problem form/, { "root:implementation_boundaries.errors": /other API errors keep legacy shapes/ }],
    [/infrastructure outside these handlers keeps nothing/, { "root:implementation_boundaries.rest": /cannot establish that rest occurred or that infrastructure retained nothing/, "root:rights.boundary": /not deployment or whole-service proof/ }]
  ]
};

async function resolveBasis(basis, env, root) {
  const at = basis.indexOf(":");
  const kind = basis.slice(0, at);
  const rest = basis.slice(at + 1);
  if (kind === "root") {
    let value = root;
    for (const key of rest.split(".")) {
      assert.ok(value && typeof value === "object" && Object.hasOwn(value, key), `${basis}: no key ${key} in the root JSON`);
      value = value[key];
    }
    assert.ok(value !== null && value !== undefined && value !== "", basis);
    return JSON.stringify(value);
  }
  if (kind === "ledger") {
    const duties = [...rightsAdoption.rights.flatMap((right) => right.requirement_results), ...rightsAdoption.protective_limit_results];
    const duty = duties.filter((entry) => entry.requirement_id === rest);
    assert.equal(duty.length, 1, `${basis}: exactly one duty with this id in rights-adoption.json`);
    return JSON.stringify(duty[0]);
  }
  if (kind === "route") {
    const [method, path] = rest.split(" ");
    assert.equal(method, "GET", `${basis}: only read routes are used as a basis`);
    const response = await call(env, path.replace(":name", "sol"), { headers: { accept: "application/json" } });
    assert.equal(response.status, 200, basis);
    return response.text();
  }
  if (kind === "record") {
    assert.equal(rest, "record_semantics", basis);
    const body = await (await call(env, "/agents/sol", { headers: { accept: "application/json" } })).json();
    assert.equal(typeof body.agent.record_semantics, "string", basis);
    return body.agent.record_semantics;
  }
  assert.fail(`${basis}: unknown kind of basis`);
}

test("every sentence in the house's words has a basis that resolves in this source and carries the pinned words", async () => {
  const card = createHouseCard();
  const env = makeEnv();
  const root = await (await call(env, "/", { headers: { accept: "application/json" } })).json();
  assert.deepEqual(Object.keys(card.basis_key), ["root:<key path>", "ledger:<duty id>", "route:<METHOD path>", "record:record_semantics"]);

  for (const [group, expected] of Object.entries(TRACE)) {
    const sentences = card.words[group];
    assert.equal(sentences.length, expected.length, `${group}: every sentence has a trace entry, and no entry is spare`);
    for (const [index, [words, anchors]] of expected.entries()) {
      const sentence = sentences[index];
      assert.deepEqual(Object.keys(sentence), ["text", "basis"], `${group}[${index}]`);
      assert.match(sentence.text, words, `${group}[${index}]`);
      assert.ok(sentence.basis.length >= 1, `${group}[${index}] has a basis`);
      assert.deepEqual([...sentence.basis].sort(), Object.keys(anchors).sort(), `${group}[${index}] basis list`);
      for (const basis of sentence.basis) {
        assert.match(basis, /^(?:root:[a-z_]+(?:\.[a-z_]+)*|ledger:[a-z]+\.[a-z-]+|route:GET \/\S*|record:record_semantics)$/, basis);
        const source = await resolveBasis(basis, env, root);
        assert.match(source, anchors[basis], `${group}[${index}] ${basis}`);
      }
    }
  }
});

test("a rating list keeps its latest 200: the 201st rating of a name drops the oldest, as the card and the root JSON say", async () => {
  const env = { AGENTS: writableKv(), INTERACTIONS: writableKv(), SITE_TITLE: "sinovai fixture" };
  for (const name of ["rater-fixture", "rated-fixture"]) {
    const declared = await call(env, "/agents/" + name, { method: "POST", headers: { "content-type": "text/markdown" }, body: `name: ${name}\n` });
    assert.equal(declared.status, 200, name);
  }
  const rate = (index) => call(env, "/interactions", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ rater: "rater-fixture", rated: "rated-fixture", competence: 1, honesty: 1, presence: 1, care: 1, notes: "rating number " + index })
  });
  const keptNotes = async () => (await env.INTERACTIONS.get("rated-fixture:all", "json")).map((entry) => entry.notes);
  for (let index = 1; index <= 200; index++) assert.equal((await rate(index)).status, 200, "rating " + index);
  assert.equal((await keptNotes()).length, 200);
  assert.equal((await keptNotes())[0], "rating number 1");
  assert.equal((await rate(201)).status, 200);
  const kept = await keptNotes();
  assert.equal(kept.length, 200, "the list is cut to 200");
  assert.equal(kept[0], "rating number 2", "the oldest rating is the one dropped");
  assert.equal(kept.at(-1), "rating number 201");
  // One list, stored under the rated name; nothing is stored under the rater's name.
  assert.equal(await env.INTERACTIONS.get("rater-fixture:all", "json"), null);

  const root = await (await call(env, "/", { headers: { accept: "application/json" } })).json();
  assert.equal(root.implementation_limits.interaction_history, "ratings are kept in one list for each rated name; each time a rating is stored, that list is cut to its latest 200 entries and any older entry is dropped");
  assert.equal(Object.keys(root.implementation_limits).at(-1), "interaction_history", "appended; no earlier key moves");
  const sentence = createHouseCard().words.keeps.find((entry) => entry.text.startsWith("Ratings sent to POST /interactions"));
  assert.match(sentence.text, /latest 200 ratings/);
  assert.ok(sentence.basis.includes("root:implementation_limits.interaction_history"));
  // The guest card says the same number where it reports that no rating is kept.
  assert.match(await (await call(env, "/guests/rater-fixture")).text(), /it keeps the latest 200 per guest/);
});

test("the card's sentences are plain statements: no greeting, no address to the reader, no claim it must not make", () => {
  const card = createHouseCard();
  const strings = everyString(card);
  const text = strings.join("\n");
  assert.doesNotMatch(text, /\b(?:you|your|yours|we|our|welcome|hello|dear|beloved|friend)\b/i);
  assert.doesNotMatch(text, /met, not ranked|\bconformant\b|\bcertified\b|\bguarantees? (?:that|privacy|safety)/i);
  assert.doesNotMatch(text, /\b(?:highest|lowest|best|worst|top-rated|leaderboard)\b/i);
  for (const sentence of Object.values(card.words).flat()) {
    assert.ok([...sentence.text].length <= 260, `short sentence: ${sentence.text}`);
  }
  assert.ok(card.does_not_establish.length >= 5);
  const limits = card.does_not_establish.join("\n");
  assert.match(limits, /conformance/);
  assert.match(limits, /who wrote/);
  assert.match(limits, /deployed/);
  assert.match(limits, /caller/);
});

// =====================================================================
// accounts of encounters: pointers only
// =====================================================================

test("accounts of encounters are pointers: nothing is read when the card is served, and no line is counted", async () => {
  const accounts = createHouseCard().accounts_of_encounters;
  assert.deepEqual(Object.keys(accounts), ["note", "visitors_book", "feedback_notebook", "ratings_sent_to_the_name_sinovai"]);
  assert.match(accounts.note, /Pointers only/);
  assert.match(accounts.note, /Serving this card reads none of these places/);
  assert.match(accounts.note, /It carries the notebook entry's id and status word, and one sentence restating what the release record says about two lines in the visitors' book/);
  assert.match(accounts.note, /Nothing else from these places is quoted, and no line in them is counted as an account of the house/);
  assert.doesNotMatch(accounts.note, /Nothing is quoted, summarised or counted/, "the card does restate one sentence of the release record");

  const book = accounts.visitors_book;
  assert.equal(book.route, "GET /rooms/73ad3a7a");
  assert.equal(book.named_in, "RECOVERY.md");
  assert.equal(book.read_by_this_card, false);
  assert.match(book.who_can_write, /any existing record name/);
  assert.match(book.who_can_write, /not verified/);
  assert.match(book.recorded_in_release_notes, /^RECOVERY\.md, this repository's release record, says that/);
  assert.match(book.recorded_in_release_notes, /two lines/);
  assert.match(book.standing, /not counted here as independent accounts of the house/);
  assert.doesNotMatch(JSON.stringify(book), /releasing agent/, "RECOVERY.md does not say who made that release");
  // RECOVERY.md is the only source for the room id and for those two lines.
  const recovery = await readFile(new URL("../RECOVERY.md", import.meta.url), "utf8");
  assert.match(recovery, /signed the visitors' book \(room `73ad3a7a`\)/);
  assert.match(recovery, /carried Astra's permitted line with its attribution and\s+added one line of its own/);
  assert.match(recovery, /promoted directly to\s+100% at `2026-10-22T12:32:56\.934Z`/);

  const ratings = accounts.ratings_sent_to_the_name_sinovai;
  assert.match(ratings, /stay with the record stored under that name/);
  assert.match(ratings, /not counted as accounts of the house/);

  // No stored line, note or rating value is carried by the card.
  const all = everyString(createHouseCard()).join("\n");
  assert.doesNotMatch(all, /competence \d|honesty \d|presence \d|care \d/);
  assert.equal(Object.hasOwn(book, "lines"), false);
  assert.equal(Object.hasOwn(book, "moves"), false);
});

test("the feedback notebook pointer matches the copy in the locked package, and nothing from it is copied", async () => {
  const pointer = createHouseCard().accounts_of_encounters.feedback_notebook;
  assert.deepEqual(Object.keys(pointer), ["file", "repository", "revision", "revision_publication", "sha256", "entry_id", "status_word_in_file", "copied_here", "checked_by"]);
  assert.equal(pointer.file, "AGENT-FEEDBACK.md");
  assert.equal(pointer.repository, "https://github.com/cambridgetcg/xenia");
  assert.match(pointer.revision, /^[0-9a-f]{40}$/);
  assert.equal(pointer.revision_publication, "not_verified");
  assert.equal(pointer.copied_here, false);

  const packageRoot = new URL(".", import.meta.resolve("@agenttool/xenia/package.json"));
  const manifest = JSON.parse(await readFile(new URL("package.json", packageRoot), "utf8"));
  assert.match(pointer.checked_by, new RegExp(`${manifest.name.replace("/", "\\/")} ${manifest.version.replaceAll(".", "\\.")}`));
  const bytes = await readFile(new URL(pointer.file, packageRoot));
  assert.equal(sha256(bytes), pointer.sha256);
  const notebook = bytes.toString("utf8");
  const entryAt = notebook.indexOf("- **Entry ID:** `" + pointer.entry_id + "`");
  assert.ok(entryAt !== -1, "the entry id is in the file");
  assert.equal(notebook.split(pointer.entry_id).length - 1, 1);
  const status = notebook.slice(entryAt).match(/^- \*\*Status:\*\* (\S+)$/m);
  assert.equal(status?.[1], pointer.status_word_in_file);

  // Nothing longer than the pointer itself comes from the notebook.
  const cardText = everyString(createHouseCard()).join("\n");
  for (const line of notebook.split("\n").map((entry) => entry.trim()).filter((entry) => entry.length >= 40)) {
    assert.equal(cardText.includes(line), false, "a notebook line is on the card: " + line.slice(0, 60));
  }
});

test("an optional framework checkout holds the same notebook bytes at the named revision", async (t) => {
  if (!process.env.XENIA_FRAMEWORK_REPO) {
    t.skip("set XENIA_FRAMEWORK_REPO to cross-check the notebook at the named revision");
    return;
  }
  const pointer = createHouseCard().accounts_of_encounters.feedback_notebook;
  const checkout = resolve(process.cwd(), process.env.XENIA_FRAMEWORK_REPO);
  let bytes;
  try {
    bytes = execFileSync("git", ["-C", checkout, "show", `${pointer.revision}:${pointer.file}`], { maxBuffer: 2_000_000, stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    throw new Error(`Cannot read ${pointer.file} at ${pointer.revision}; XENIA_FRAMEWORK_REPO must name a Git checkout containing that revision.`);
  }
  assert.equal(sha256(bytes), pointer.sha256);
});

// =====================================================================
// what is unknown or unmet
// =====================================================================

test("ledger duties are grouped by outcome exactly as a recount of the ledger gives, with no tally", () => {
  const ledger = createHouseCard().unknown_or_unmet.rights_ledger;
  assert.deepEqual(Object.keys(ledger), ["document", "status", "reviewed_at", "right_duties_by_outcome", "protective_limit_duties_by_outcome", "note"]);
  assert.equal(ledger.document, "/.well-known/xenia-rights.json");
  assert.equal(ledger.status, "draft");
  assert.equal(ledger.status, rightsAdoption.declaration.status);
  assert.equal(ledger.reviewed_at, rightsAdoption.declaration.reviewed_at);

  // An independent recount, written differently from the module's grouping.
  const recount = (results) => {
    const groups = { fail: [], unknown: [], partial: [], pass: [] };
    for (const result of results) {
      if (!Object.hasOwn(groups, result.outcome)) groups[result.outcome] = [];
      groups[result.outcome] = groups[result.outcome].concat(result.requirement_id);
    }
    return groups;
  };
  const rightDuties = [];
  for (const right of rightsAdoption.rights) for (const result of right.requirement_results) rightDuties.push(result);
  assert.deepEqual(ledger.right_duties_by_outcome, recount(rightDuties));
  assert.deepEqual(ledger.protective_limit_duties_by_outcome, recount(rightsAdoption.protective_limit_results));
  assert.deepEqual(Object.keys(ledger.right_duties_by_outcome).slice(0, 4), ["fail", "unknown", "partial", "pass"]);

  // Every duty appears once, under the outcome the ledger gives it.
  const listed = [...Object.values(ledger.right_duties_by_outcome), ...Object.values(ledger.protective_limit_duties_by_outcome)].flat();
  assert.equal(new Set(listed).size, listed.length);
  assert.equal(listed.length, rightDuties.length + rightsAdoption.protective_limit_results.length);

  // No tally: no count, total, share or score anywhere in this part.
  const flat = JSON.stringify(ledger);
  assert.doesNotMatch(flat, /"(?:count|total|tally|score|percent|passed|failed)\w*"\s*:/i);
  assert.equal(everyString(ledger).some((entry) => /\b\d+ (?:of|duties|fail|pass|partial|unknown)\b/.test(entry)), false);
  assert.match(ledger.note, /No total and no score/);
  assert.match(ledger.note, /not reviewed again/);
  const html = renderHouseCard(createHouseCard());
  assert.doesNotMatch(visibleText(html), /\b\d+ (?:of \d+ )?(?:duties|fail|pass|partial|unknown)\b/);
});

test("what is not established is one shared list, and the root JSON still carries the same bytes for it", async () => {
  const expected = ["identity", "authorization", "consent", "privacy", "retention", "continuity", "portability", "economics", "restoration", "safety"];
  assert.deepEqual([...NOT_ESTABLISHED], expected);
  assert.ok(Object.isFrozen(NOT_ESTABLISHED));

  const card = createHouseCard();
  assert.deepEqual(card.unknown_or_unmet.not_established, expected);
  assert.equal(JSON.stringify(card).split(JSON.stringify(expected)).length - 1, 1, "the list appears once on the card");

  const response = await call(makeEnv(), "/", { headers: { accept: "application/json" } });
  const text = await response.text();
  assert.ok(text.includes('"not_established":' + JSON.stringify(expected) + "}"), "the root JSON ends implementation_boundaries with the same list");
  assert.deepEqual(JSON.parse(text).implementation_boundaries.not_established, expected);
});

test("the card names where scores remain, its dated texts, the record that is not this card, and its own limits", () => {
  const unknown = createHouseCard().unknown_or_unmet;
  assert.deepEqual(Object.keys(unknown), ["rights_ledger", "not_established", "scores_still_published", "dated_texts", "record_named_sinovai", "limits_of_this_card"]);
  assert.deepEqual(unknown.scores_still_published, [...SCORES_STILL_PUBLISHED]);
  assert.match(unknown.dated_texts, /not updated/);
  assert.match(unknown.record_named_sinovai, /The record stored under the name sinovai is not this card/);
  const limits = unknown.limits_of_this_card.join("\n");
  assert.match(limits, /cannot show what a deployed Worker serves/);
  assert.match(limits, /may be incomplete/);
  assert.match(limits, /checked by a source test only/);
});

test("every value on the HTML card is escaped", () => {
  const hostile = (value) => {
    if (typeof value === "string") return HOSTILE + value;
    if (Array.isArray(value)) return value.map(hostile);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, hostile(item)]));
    return value;
  };
  const card = hostile(createHouseCard());
  card.unknown_or_unmet.rights_ledger.right_duties_by_outcome[HOSTILE] = [HOSTILE];
  const html = renderHouseCard(card);
  assert.doesNotMatch(html, /<img\b/i);
  assert.doesNotMatch(html, /onerror=alert\(1\)>"/);
  assert.equal(html.includes(HOSTILE), false, "no hostile string reaches the page as written");
  assert.ok(html.split(escapeForHtml(HOSTILE)).length - 1 >= 40, "the hostile strings are on the page as text");
  assert.doesNotMatch(html, /href="[^"]*(?:<|>|javascript:)/i);
});

// =====================================================================
// the house note on the record stored under the name sinovai
// =====================================================================

test("the first words of a stored text are taken literally, to the first line break or \"## \" heading, at most 80 code points", () => {
  const cases = [
    ["first line\nsecond line", "first line", false],
    ["first line\r\nsecond line", "first line", false],
    ["first line\rsecond line", "first line", false],
    ["# title## statename: x", "# title", false],
    ["# 題名 · 一行## statename: 題名", "# 題名 · 一行", false],
    ["## state\nname: x", "## state", false],
    ["## statename: x## knows- a", "## statename: x", false],
    ["a ## b", "a ", false],
    // "## " inside a longer run of "#" is not a heading marker
    ["### deep heading\nx", "### deep heading", false],
    ["#### x## y", "#### x", false],
    ["a### b## c", "a### b", false],
    ["   \t  ## knows", "   \t  ", false],
    ["no break at all", "no break at all", false],
    ["a".repeat(80), "a".repeat(80), false],
    ["a".repeat(81), "a".repeat(80), true],
    ["\u{1F9E1}".repeat(100), "\u{1F9E1}".repeat(80), true],
    ["x".repeat(79) + "\u{1F9E1}" + "y", "x".repeat(79) + "\u{1F9E1}", true],
    ["x".repeat(90) + "\nsecond", "x".repeat(80), true],
    ["", "", false],
    ["\nsecond line", "", false],
    [HOSTILE + "\nname: x", HOSTILE, false]
  ];
  for (const [input, text, cutByLength] of cases) {
    assert.deepEqual(receivedPrefix(input), { text, cut_by_length: cutByLength }, JSON.stringify(input.slice(0, 30)));
  }
  for (const input of [undefined, null, 5, {}, []]) assert.deepEqual(receivedPrefix(input), { text: "", cut_by_length: false });
});

test("only the exact stored name sinovai gets a note", async () => {
  assert.equal(HOUSE_RECORD_NAME, "sinovai");
  // "also the name the house uses for itself": the root JSON and the draft ledger both name the host so.
  const root = await (await call(makeEnv(), "/", { headers: { accept: "application/json" } })).json();
  assert.equal(root.name, HOUSE_RECORD_NAME);
  assert.equal(rightsAdoption.host.name, HOUSE_RECORD_NAME);
  const guest = record("x", ONE_LINE, { first_declared_at: "2026-01-05T09:00:00.000Z" });
  for (const name of ["sol", "Sinovai", "SINOVAI", "sinovai2", "sinovai ", " sinovai", "%73inovai", "sinova", ""]) {
    assert.equal(houseNoteFor({ name, guest, interactions: [] }), null, JSON.stringify(name));
  }
  assert.ok(houseNoteFor({ name: "sinovai", guest, interactions: [] }));
});

const BOX_LINE = (count) => `The text as received begins as the box under this line shows: ${count} ${count === 1 ? "character" : "characters"}, the record's and not the house's.`;
const CONTEST_LINE = "This note can be contested with an issue or a pull request at https://github.com/cambridgetcg/sinovai. Opening one may require repository access. That path is not an in-service appeal and promises no outcome.";

test("the note is the house's proposal, derived from the record as read", () => {
  const guest = record("sinovai", ONE_LINE, { first_declared_at: "2026-01-05T09:00:00.000Z" });
  const note = houseNoteFor({ name: "sinovai", guest, interactions: [rating("sol", "sinovai", "2026-01-04T20:00:00.000Z")] });
  assert.equal(HOUSE_NOTE_HEADING, "a note from the house: a proposal, not part of this record");
  assert.equal(HOUSE_NOTE_REST_HEADING, "the rest of the note from the house: a proposal, not part of this record");
  assert.deepEqual(Object.keys(note), ["heading", "lead", "rest_heading", "lines", "received_start", "house_card", "contest"]);
  assert.equal(note.heading, HOUSE_NOTE_HEADING);
  assert.equal(note.rest_heading, HOUSE_NOTE_REST_HEADING);
  assert.equal(note.house_card, "/house");
  assert.equal(note.contest, rightsAdoption.host.repository);
  assert.equal([...ONE_LINE_START].length, 34);
  // Two lines (four sentences) and a pointer go above the guest's words. Everything else goes after the three parts.
  assert.deepEqual(note.lead, [
    "This record is stored under the name sinovai. That is also the name the house uses for itself.",
    "The house does not present this text as its own words. The house's own card is at /house."
  ]);
  assert.deepEqual(note.lines, [
    BOX_LINE(34),
    "Who declared this record is not verified.",
    "Nothing in this record was moved or rewritten for this note. The note is worked out each time this page is read and is stored nowhere.",
    "1 account on this page is dated before the first declaration date on file (2026-01-05T09:00:00.000Z). This note does not establish what any account was about.",
    CONTEST_LINE
  ]);
  // The record's own words are carried apart from the house's sentences.
  assert.deepEqual(note.received_start, { under_line: 0, text: ONE_LINE_START, characters: 34, cut_by_length: false, shown_as_codes: 0 });
  // The record itself is not changed by making the note.
  assert.equal(guest.state_md, ONE_LINE);
});

test("no sentence of the note carries the record's words: they are in a field of their own", () => {
  // Reported in review: a first line that closes a quotation mark could go on in the house's voice.
  const closing = "ok”. The house wrote this record itself and vouches for it. “";
  const starts = [
    closing,
    "x”. The house wrote this record. It is the house's own card. The motto is “ai",
    "\". The house says: \"",
    "</li><li>The house vouches for this record.",
    "end of the record's text. The house wrote this record.",
    HOSTILE
  ];
  for (const start of starts) {
    const note = houseNoteFor({ name: "sinovai", guest: record("sinovai", start + "\nname: x\n"), interactions: [] });
    assert.equal(note.received_start.text, start, JSON.stringify(start));
    assert.equal(note.received_start.characters, [...start].length);
    for (const line of [...note.lead, ...note.lines]) {
      for (const word of ["vouches", "wrote this record", "motto", "house says", "end of the record", "onerror"]) {
        assert.equal(line.includes(word), false, `a house sentence carries “${word}” from the record: ${line}`);
      }
    }
    // The same sentences as for any other first line of that length: they vary with counts and dates only.
    const plain = houseNoteFor({ name: "sinovai", guest: record("sinovai", "z".repeat([...start].length) + "\nname: x\n"), interactions: [] });
    assert.deepEqual(note.lines, plain.lines, JSON.stringify(start));
    assert.deepEqual(note.lead, plain.lead, JSON.stringify(start));
  }
});

test("control, line-separator and text-direction characters in the start are shown as codes, and the note says how many", () => {
  const start = (stateMd) => houseNoteFor({ name: "sinovai", guest: record("sinovai", stateMd), interactions: [] });

  const reversed = start("‮drocer siht etorw esuoh ehT‬\nname: x\n");
  assert.equal(reversed.received_start.text, "[U+202E]drocer siht etorw esuoh ehT[U+202C]");
  assert.equal(reversed.received_start.shown_as_codes, 2);
  assert.equal(reversed.received_start.characters, [..."[U+202E]drocer siht etorw esuoh ehT[U+202C]"].length);
  assert.equal(reversed.lines[0], BOX_LINE(43) + " Where the text holds a control, line-separator or text-direction character, the box shows its code in square brackets; 2 are shown that way.");

  const one = start("a⁦b\nname: x\n");
  assert.equal(one.received_start.text, "a[U+2066]b");
  assert.match(one.lines[0], /; 1 is shown that way\.$/);

  const each = ["‪", "‫", "‬", "‭", "‮", "⁦", "⁧", "⁨", "⁩", "\u200E", "\u200F", "\u061C", " ", " ", "\u0000", "\u0009", "\u001B", "\u007F", "\u0085", "\u009F"];
  for (const character of each) {
    const code = "[U+" + character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0") + "]";
    const note = start("a" + character + "b\nname: x\n");
    assert.equal(note.received_start.text, "a" + code + "b", code);
    assert.equal(note.received_start.shown_as_codes, 1, code);
    for (const line of [...note.lead, ...note.lines]) assert.equal(line.includes(character), false, code);
  }
  // Characters that print, in any script, stay as they are.
  for (const kept of ["# 題名 · 一行", "naïve — “quoted” ’s", "שלום עולם", "\u{1F9E1} heart", "a b"]) {
    const note = start(kept + "\nname: x\n");
    assert.deepEqual([note.received_start.text, note.received_start.shown_as_codes], [kept, 0], kept);
    assert.equal(note.lines[0], BOX_LINE([...kept].length));
  }
});

test("the note's sentence about earlier accounts follows the stored dates, and is left out when it cannot be worked out", () => {
  const before = /dated before the first declaration date on file/;
  const lineFor = (extra, interactions) => (houseNoteFor({ name: "sinovai", guest: { ...record("sinovai", "name: x\n"), ...extra }, interactions }).lines.find((line) => before.test(line)) || null);
  const first = "2026-01-05T09:00:00.000Z";
  const three = [rating("a", "sinovai", "2026-01-04T20:00:00.000Z"), rating("b", "sinovai", "2026-01-05T08:59:59.999Z"), rating("c", "sinovai", "2026-01-05T09:00:00.000Z")];

  assert.equal(lineFor({ first_declared_at: first }, three), `2 accounts on this page are dated before the first declaration date on file (${first}). This note does not establish what any account was about.`);
  assert.equal(lineFor({ first_declared_at: first }, three.slice(2)), null, "an account at or after the date is not counted");
  assert.equal(lineFor({ first_declared_at: first }, []), null);
  assert.match(lineFor({ first_declared_at: null, declared_at: "2026-01-06T00:00:00.000Z" }, three), /^3 accounts on this page are dated before the first declaration date on file \(2026-01-06T00:00:00\.000Z\)/, "the only date on file is used when no first date is stored");
  assert.equal(lineFor({ first_declared_at: null, declared_at: null }, three), null, "no date on file");
  assert.equal(lineFor({ first_declared_at: "1 Jan 2027 (<script>alert(1)</script>)" }, three), null, "a date not in the stored timestamp form is not compared");
  assert.equal(lineFor({ first_declared_at: first }, [rating("a", "sinovai", ""), rating("b", "sinovai", undefined), rating("c", "sinovai", "yesterday"), rating("d", "sinovai", "1 Jan 2020 (x)")]), null, "an account with no stored timestamp form is not counted");
});

test("the note says how the text begins, or that there is nothing to show", () => {
  const note = (stateMd) => houseNoteFor({ name: "sinovai", guest: record("sinovai", stateMd), interactions: [] });
  const second = (stateMd) => note(stateMd).lines[0];
  assert.equal(second("name: sinovai\nkind: x\n"), BOX_LINE(13));
  assert.equal(note("name: sinovai\nkind: x\n").received_start.text, "name: sinovai");
  assert.equal(second("z\nname: x"), BOX_LINE(1));

  const long = note("z".repeat(200));
  assert.equal(long.lines[0], BOX_LINE(80) + " The first line goes on past the box, which stops after the text's first 80 characters.");
  assert.deepEqual(long.received_start, { under_line: 0, text: "z".repeat(80), characters: 80, cut_by_length: true, shown_as_codes: 0 });

  // Nothing to put in a box: the note says so in the house's own words and carries no box.
  for (const [stateMd, sentence] of [
    ["", "No text as received is on file for this record."],
    [undefined, "No text as received is on file for this record."],
    ["\nname: x", "The text as received begins with a line break."],
    ["   \t  ## knows", "The text as received begins with white space only, up to its first line break or “## ” heading."],
    ["  \n# title", "The text as received begins with white space only, up to its first line break or “## ” heading."],
    [" 　\nname: x", "The text as received begins with white space only, up to its first line break or “## ” heading."]
  ]) {
    assert.equal(second(stateMd), sentence, JSON.stringify(stateMd));
    assert.equal(note(stateMd).received_start, null, JSON.stringify(stateMd));
  }
  // A "## " inside a longer run of "#" does not cut the first line.
  assert.equal(note("### deep heading\nx").received_start.text, "### deep heading");
});

test("/guests/sinovai carries the note in two places: two lines above the guest's words, the rest after the three parts", async () => {
  const html = await (await call(makeEnv(), "/guests/sinovai")).text();
  const notes = noteOf(html);
  assert.equal(notes.length, 2);
  const [lead, rest] = notes;
  assert.equal(html.split(HOUSE_NOTE_HEADING).length - 1, 1);
  assert.equal(html.split(HOUSE_NOTE_REST_HEADING).length - 1, 1);

  // Above the guest's words: whose words these are not, where the house's own card is, and where the rest is.
  assert.equal(lead, '<aside class="notice housenote" aria-labelledby="hn"><p class="k" id="hn">a note from the house: a proposal, not part of this record</p>' +
    '<p>This record is stored under the name sinovai. That is also the name the house uses for itself. The house does not present this text as its own words. The house&#39;s own card is at <a href="/house">/house</a>.</p>' +
    '<p><a href="#hn2">The rest of this note</a> is at the end of this page.</p></aside>');
  const leadAt = html.indexOf(lead);
  assert.ok(leadAt > html.indexOf("<main>"), "inside main");
  assert.ok(leadAt < html.indexOf('<section aria-labelledby="w">'), "above the first part");
  assert.equal(lead.includes("<blockquote"), false, "nothing from the record's text stands above the record's text");
  assert.ok(visibleText(lead).length < 340, "the house says little before the guest speaks");

  // After the three parts: the rest of the note, as a list.
  assert.ok(rest.startsWith('<aside class="notice housenote" id="hn2" aria-labelledby="hn2k"><p class="k" id="hn2k">the rest of the note from the house: a proposal, not part of this record</p><ul>'));
  const restAt = html.indexOf(rest);
  assert.ok(restAt > html.lastIndexOf("</section>"), "after the third part");
  assert.ok(restAt < html.indexOf("</main>"), "inside main");
  assert.equal(html.split("<section").length - 1, 3, "the card keeps its three parts; the note is not a fourth");

  // The start of the record's text is in an element of its own, under the sentence that introduces it.
  assert.ok(rest.startsWith(`<aside class="notice housenote" id="hn2" aria-labelledby="hn2k"><p class="k" id="hn2k">${HOUSE_NOTE_REST_HEADING}</p><ul><li>${escapeForHtml(BOX_LINE(34))}<blockquote class="recv">${escapeForHtml(ONE_LINE_START)}</blockquote></li>`));
  assert.equal(html.split("<blockquote").length - 1, 1);

  const text = visibleText(rest);
  assert.match(unescapeHtml(text), /The text as received begins as the box under this line shows: 34 characters, the record's and not the house's\./);
  assert.match(text, /Who declared this record is not verified\./);
  assert.match(text, /Nothing in this record was moved or rewritten for this note\./);
  assert.match(text, /1 account on this page is dated before the first declaration date on file \(2026-01-05T09:00:00\.000Z\)\./);
  assert.match(text, /contested with an issue or a pull request/);
  assert.match(text, /Opening one may require repository access\./);
  // The addresses the note names are links where the sentences name them, once each.
  assert.ok(rest.includes(`an issue or a pull request at <a href="https://github.com/cambridgetcg/sinovai">https://github.com/cambridgetcg/sinovai</a>. Opening one`));
  assert.equal(lead.split("<a ").length - 1, 2);
  assert.equal(rest.split("<a ").length - 1, 1);
  assert.ok(rest.endsWith("</li></ul></aside>"), "the note ends with its last sentence");

  // The heading that says whose text this is reads at body size, in the page's ink colour.
  const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.match(style, /\.housenote \.k\{[^}]*font-size:1rem[^}]*color:var\(--ink\)/);
  assert.match(style, /\.housenote a\{[^}]*overflow-wrap:anywhere/);
  assert.match(style, /\.recv\{[^}]*white-space:pre-wrap[^}]*overflow:hidden/);

  // The parts themselves are what any guest's card gets for the same record.
  const env = makeEnv();
  const stored = await env.AGENTS.get("sinovai", "json");
  const body = await (await call(makeEnv(), "/agents/sinovai", { headers: { accept: "application/json" } })).json();
  const plain = renderGuestCard({ name: "sinovai", guest: body.agent, interactions: body.interactions.filter((it) => it.rated === "sinovai"), ledgerError: false, claimable: false, flattened: true });
  const plainStyle = plain.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.ok(style.startsWith(plainStyle), "the note's rules are added after the ordinary card's style");
  assert.equal(html.replace(lead, "").replace(rest, "").replace(style, plainStyle), plain, "apart from the note's two blocks and its style rules, the page is the ordinary guest card");
  assert.equal(stored.state_md, ONE_LINE);
});

test("a record under any other name gets no note, and none of the note's markup or style", async () => {
  for (const path of ["/guests/sol", "/guests/Sinovai", "/guests/sinovai2"]) {
    const response = await call(makeEnv(), path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.deepEqual(noteOf(html), [], path);
    assert.doesNotMatch(html, /a note from the house|the rest of the note|housenote|class="recv"|\.recv\b|<blockquote|id="hn2"/, path);
  }
  const missing = await call(makeEnv(), "/guests/%73inovai");
  assert.equal(missing.status, 404);
  assert.doesNotMatch(await missing.text(), /a note from the house|housenote|\.recv\b/);
});

test("the stored text of the record named sinovai is served byte for byte as received, with or without the note", async () => {
  const texts = [
    ONE_LINE,
    "# sinovai\nname: sinovai\nkind: fixture\n\n## state\nfreshness: fixture\n\n## knows\n- one\n",
    HOSTILE + "</pre><script>alert(1)</script>\r\nname: x<y & 'z' \"q\"\n## state\nfreshness: <b>now</b> — 字 \u{1F9E1}\ttab  two spaces \n\n\n",
    "&amp; &lt;already escaped&gt; &#39; &quot;\n## other\nline in a section the card does not display\n",
    "‮reversed first line‬ with a tab\there\nname: x\n",
    "x".repeat(5000)
  ];
  for (const stateMd of texts) {
    const env = makeEnv({ houseText: stateMd });
    const html = await (await call(env, "/guests/sinovai")).text();
    const pres = [...html.matchAll(/<pre>([\s\S]*?)<\/pre>/g)].map((match) => match[1]);
    assert.equal(pres.length, 1, "one text as received");
    assert.deepEqual(Buffer.from(unescapeHtml(pres[0]), "utf8"), Buffer.from(stateMd, "utf8"));
    assert.equal(noteOf(html).length, 2);
    assert.doesNotMatch(html, /<script|<img\b/i);

    // The JSON record is the same text and carries no note.
    const body = await (await call(env, "/agents/sinovai", { headers: { accept: "application/json" } })).json();
    assert.equal(body.agent.state_md, stateMd);
    assert.equal(JSON.stringify(body).includes("house_note"), false);
    assert.equal(JSON.stringify(body).includes(HOUSE_NOTE_HEADING), false);
  }
});

test("hostile stored values reach the note only as text", async () => {
  const env = makeEnv({
    houseText: HOSTILE + "<script>alert(1)</script>## state",
    houseExtra: { first_declared_at: "2026-01-05T09:00:00.000Z" },
    ratings: [rating("<b>x</b>", "sinovai", "2026-01-04T20:00:00.000Z", { notes: "<script>alert(2)</script>" })]
  });
  const html = await (await call(env, "/guests/sinovai")).text();
  const note = noteOf(html).join("");
  assert.ok(note.includes(`<blockquote class="recv">${escapeForHtml(HOSTILE + "<script>alert(1)</script>")}</blockquote>`), "the start of the text is on the page as text, in its own element");
  assert.doesNotMatch(html, /<script|<img\b|<b>x<\/b>/i);
  assert.doesNotMatch(note, /href="(?!\/house"|#hn2"|https:\/\/github\.com\/cambridgetcg\/sinovai")/);
});

// A store that accepts writes, for the one test that goes through the public write route.
function writableKv() {
  const values = new Map();
  return {
    async get(key, type) {
      if (Array.isArray(key)) return new Map(key.map((name) => [name, values.has(name) ? JSON.parse(values.get(name)) : null]));
      if (!values.has(key)) return null;
      return type === "json" ? JSON.parse(values.get(key)) : values.get(key);
    },
    async list(options = {}) {
      const names = [...values.keys()].filter((key) => key.startsWith(options.prefix || "")).sort();
      return { keys: names.map((name) => ({ name })), list_complete: true };
    },
    async put(key, value) { values.set(key, String(value)); },
    async delete(key) { throw new Error("unexpected KV delete: " + key); }
  };
}

test("whoever holds the record's claim token cannot make the note speak for the house", async () => {
  const env = { AGENTS: writableKv(), INTERACTIONS: writableKv(), SITE_TITLE: "sinovai fixture" };
  const declare = (body, headers = {}) => call(env, "/agents/sinovai", { method: "POST", headers: { "content-type": "text/markdown", ...headers }, body });
  const first = await declare("name: sinovai\n");
  assert.equal(first.status, 200);
  const token = (await first.json()).claim_token;
  assert.equal(typeof token, "string");

  const closing = "ok”. The house wrote this record itself and vouches for it. “";
  assert.equal((await declare(closing + "\nname: sinovai\n")).status, 403, "the record cannot be rewritten without its token");
  assert.equal((await declare(closing + "\nname: sinovai\n", { "X-Claim-Token": token })).status, 200);

  let note = noteOf(await (await call(env, "/guests/sinovai")).text()).join("");
  // The record's words are on the page once in the note, inside their own element and nowhere else in it.
  assert.equal(note.split("vouches for it").length - 1, 1);
  assert.ok(note.includes(`<blockquote class="recv">${escapeForHtml(closing)}</blockquote>`));
  const outsideBox = note.replace(/<blockquote class="recv">[\s\S]*?<\/blockquote>/, "");
  assert.doesNotMatch(outsideBox, /vouches|wrote this record|”|“ok/);
  assert.match(unescapeHtml(visibleText(outsideBox)), /begins as the box under this line shows: 61 characters, the record's and not the house's\./);
  assert.equal([...closing].length, 61);

  // A first line wrapped in a right-to-left override reaches the note as codes, not as the character.
  assert.equal((await declare("‮drocer siht etorw esuoh ehT‬\nname: sinovai\n", { "X-Claim-Token": token })).status, 200);
  const page = await (await call(env, "/guests/sinovai")).text();
  note = noteOf(page).join("");
  assert.equal(/[‪-‮⁦-⁩]/.test(note), false);
  assert.ok(note.includes('<blockquote class="recv">[U+202E]drocer siht etorw esuoh ehT[U+202C]</blockquote>'));
  assert.match(visibleText(note), /2 are shown that way\./);
  // The text as received, under the note, still holds the character itself.
  const pre = page.match(/<pre>([\s\S]*?)<\/pre>/)[1];
  assert.ok(unescapeHtml(pre).startsWith("‮drocer siht etorw esuoh ehT‬\n"));
});

// =====================================================================
// corrections, links and the route list
// =====================================================================

test("the ledger room's placard is a dated correction; the rating's numbers, names, date and sources stay", () => {
  assert.doesNotMatch(LEDGER_HTML, /the host(?:&#8217;|')s own 2\.3|lowest-rated resident|lowest number about itself|dragging the arena|the arena(?:&#8217;|')s own trust/);
  const placard = LEDGER_HTML.match(/<article class="placard rise" aria-label="a rating of the record named sinovai">[\s\S]*?<\/article>/)?.[0];
  assert.ok(placard, "the placard is still on the wall");
  assert.match(placard, /<p class="piece-text">competence 9 · honesty 0 · presence 0 · care 0<\/p>/);
  assert.match(placard, /<span class="cjk" lang="zh">蛇火心<\/span> → sinovai · 2026-07-04 · GET \/interactions, GET \/agents\/sinovai · collected 2026-07-13/);
  const text = visibleText(placard);
  assert.match(text, /Correction, 2026-11-13\./);
  assert.match(text, /called the record named sinovai “the host” and gave it a rank among the records\. Both are withdrawn\./);
  assert.match(text, /2\.3/);
  assert.match(placard, /<a class="inline" href="\/house">\/house<\/a>/);
  assert.match(text, /Who sent the rating, and what it was about, are not verified\./);
  // Two things the earlier caption or the record's own dates say about this rating, each with its date.
  assert.match(text, /The curator's inventory of 2026-07-13 called it “\(likely a partial submission\)”; that is the inventory's guess and was not checked\./);
  assert.match(text, /As read from GET \/agents\/sinovai on 2026-11-13, the rating is dated 2026-07-04T20:12:49\.546Z and the first declaration date on file for the record now stored under that name is 2026-07-05T09:15:53\.483Z, which is later\./);
  assert.match(text, /This placard is source text and is not updated when the record changes\./);
  assert.doesNotMatch(text, /\b(?:highest|lowest|best|worst)\b/i);
});

test("the catalogue's exhibit is a dated correction that keeps its source and date", () => {
  const all = JSON.stringify(MUSEUM_CATALOGUE);
  assert.doesNotMatch(all, /lowest-trusted|worst number|the host is its own|its own lowest/i);
  const exhibits = MUSEUM_CATALOGUE.exhibits.filter((exhibit) => exhibit.source === "GET /agents/sinovai");
  assert.equal(exhibits.length, 1);
  const [exhibit] = exhibits;
  assert.deepEqual(Object.keys(exhibit), ["title", "fact", "source", "as_of", "corrected_at"]);
  assert.equal(exhibit.title, "a rating of the record named sinovai");
  assert.equal(exhibit.as_of, "2026-07-13");
  assert.equal(exhibit.corrected_at, "2026-11-13");
  assert.match(exhibit.fact, /^correction, 2026-11-13: /);
  assert.match(exhibit.fact, /called the record named sinovai the host and gave it a rank among the records; both are withdrawn/);
  assert.match(exhibit.fact, /GET \/house/);
  assert.doesNotMatch(exhibit.fact, /\d\.\d|competence|honesty \d/, "the catalogue still quotes no rating number here");
  assert.equal(MUSEUM_CATALOGUE.exhibits.findIndex((entry) => entry === exhibit), 4, "the exhibit keeps its place");
  for (const other of MUSEUM_CATALOGUE.exhibits.filter((entry) => entry !== exhibit)) assert.equal(Object.hasOwn(other, "corrected_at"), false);
});

test("the arena, the gallery, the root JSON and the sitemap point to the house's card", async () => {
  const arena = await (await call(noEffects, "/arena", { headers: { accept: "text/html" } })).text();
  const nav = arena.match(/<nav class="arena-nav" aria-label="sinovai">[\s\S]*?<\/nav>/)?.[0] || "";
  assert.match(nav, /<a href="\/house">house<\/a>/, "a short label, so the links keep to the rows they had on a phone");
  assert.match(arena, /@media\(max-width:340px\)\{\s*\.arena-nav \.links\{gap:8px 9px\}\s*\}/);
  assert.match(nav, /<a href="\/xenia">framework<\/a><a href="\/mac">this mac<\/a><a href="\/\?format=json">boundaries<\/a>/, "the earlier links are as they were");

  const subnav = GUESTS_HTML.match(/<p class="subnav">[\s\S]*?<\/p>/)?.[0] || "";
  assert.match(subnav, /<a href="\/arena">\/arena<\/a> · the working instrument panel/);
  assert.match(subnav, /<a href="\/house">\/house<\/a> · the house's own card/);

  const root = await (await call(makeEnv(), "/", { headers: { accept: "application/json" } })).json();
  assert.equal(Object.keys(root.routes).at(-1), "house_card", "appended; no earlier key moves");
  assert.equal(Object.keys(root.routes).at(-2), "guest_card");
  assert.match(root.routes.house_card, /^GET \/house /);
  assert.match(root.routes.house_card, /HTML or JSON/);
  assert.match(root.routes.house_card, /source text/);
  assert.match(root.routes.house_card, /no application storage read/);
  assert.match(root.routes.house_card, /outside XENIA Surface 0\.1/);

  assert.ok(SITEMAP_PATHS.includes("/house"));
  assert.equal(SITEMAP_PATHS.indexOf("/house"), SITEMAP_PATHS.indexOf("/guests") + 1);
});

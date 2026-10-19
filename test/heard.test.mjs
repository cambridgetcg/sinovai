import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import worker from "../src/worker.js";
import { hearRecord, needsHearing, restoreLineBreaks } from "../src/heard.js";
import { escapeHtml } from "../src/pages/guest-card.js";
import { DECLARE_SH } from "../src/declare-script.js";

// The shape most early declarations arrived in: discover.py's template with every newline stripped.
const GLUED = "# ALETHEIA — STATEname: ALETHEIAkind: projectlanguage: see reporuns-on: this machine---## statephase: activebuild: see repohealth: greenlast-commit: c462236 Depth pass II: D drilled + substrate-fitness claimuncommitted: 0 filesfreshness: auto-generated (2026-06-19)## knows- ALETHEIA## can- declare its state via STATE.md- be discovered by any agent running discover.py- be cross-checked by trust.py## needs- deeper STATE.md sections — this was auto-generated## how-to-talk-to-meentry-point: README.md (if present)";
const INTACT = "name: sol\nkind: agent\n\n## state\nfreshness: live\n\n## knows\n- surface contracts\n";

function makeKv(initial = {}) {
  const values = new Map(Object.entries(initial).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]));
  return {
    async get(key, type) {
      if (Array.isArray(key)) {
        return new Map(key.map((k) => {
          const v = values.get(k);
          return [k, v === undefined ? null : type === "json" ? JSON.parse(v) : v];
        }));
      }
      const value = values.get(key);
      if (value === undefined) return null;
      return type === "json" ? JSON.parse(value) : value;
    },
    async list(options = {}) {
      const names = [...values.keys()].filter((k) => k.startsWith(options.prefix || "")).sort();
      const limit = options.limit || names.length;
      return { keys: names.slice(0, limit).map((name) => ({ name })), list_complete: names.length <= limit };
    },
    async put(key) { throw new Error(`unexpected KV write: ${key}`); },
    async delete(key) { throw new Error(`unexpected KV delete: ${key}`); }
  };
}

function env() {
  return {
    AGENTS: makeKv({
      ALETHEIA: { name: "ALETHEIA", identity: {}, state: {}, knows: [], can: [], needs: [], state_md: GLUED, declared_at: "2026-07-05T15:16:39.389Z" },
      sol: { name: "sol", identity: { name: "sol", kind: "agent" }, state: { freshness: "live" }, knows: ["surface contracts"], can: [], needs: [], state_md: INTACT, claim_token: "server-secret-sol" },
      "name-first": { name: "name-first", identity: { name: "fixturekind: agentlanguage: en" }, state: {}, knows: [], can: [], needs: [], state_md: "name: fixturekind: agentlanguage: en## knows- one thing- another" },
      "%E8%B3%93": { name: "%E8%B3%93", identity: { name: "賓" }, state: {}, knows: [], can: [], needs: [], state_md: "name: 賓\n", claim_token: "t" },
      "$(id)": { name: "$(id)", identity: { name: "x" }, state: {}, knows: [], can: [], needs: [], state_md: "name: x\n", claim_token: "t" },
      "xss-probe": { name: "xss-probe", identity: {}, state: {}, knows: [], can: [], needs: [], state_md: "# <img src=x onerror=alert(1)> — STATEname: <b>bold</b>kind: test## knows- <script>alert(1)</script>" }
    }),
    INTERACTIONS: makeKv({
      "sol:all": [{ rater: "ALETHEIA", rated: "sol", competence: 7, honesty: 8, presence: 6, care: 9, notes: "met at the door", timestamp: "2026-07-06T19:00:00Z" }]
    }),
    SITE_TITLE: "sinovai"
  };
}
const ctx = { waitUntil() {}, passThroughOnException() {} };
const get = (path, accept = "text/html") => worker.fetch(new Request(`https://sinovai.com${path}`, { headers: { accept } }), env(), ctx);

function parseLikeTheHouse(text) {
  // A faithful copy is not needed: the worker tests below exercise the real parser end to end.
  const result = { identity: {}, state: {}, knows: [], can: [], needs: [] };
  let section = null;
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t === "---" || (t.startsWith("#") && !t.startsWith("## "))) continue;
    if (t.startsWith("## ")) { section = t.slice(3).toLowerCase(); continue; }
    if (t.startsWith("- ")) { if (["knows", "can", "needs"].includes(section)) result[section].push(t.slice(2)); continue; }
    const m = t.match(/^([a-z][-a-z0-9_]*):\s*(.+)$/);
    if (m) (section === "state" ? result.state : (!section || section === "identity") ? result.identity : {})[m[1]] = m[2].trim();
  }
  return result;
}

test("restores the line breaks of a glued discover.py card", () => {
  assert.equal(needsHearing(GLUED), true);
  const view = hearRecord(GLUED, parseLikeTheHouse);
  assert.equal(view.schema_version, "sinovai.heard/0.2");
  assert.equal(view.kind, "reconstruction_proposal");
  assert.deepEqual(view.identity, { name: "ALETHEIA", kind: "project", language: "see repo", "runs-on": "this machine" });
  assert.equal(view.state["last-commit"], "c462236 Depth pass II: D drilled + substrate-fitness claim");
  assert.equal(view.state.freshness, "auto-generated (2026-06-19)");
  assert.deepEqual(view.knows, ["ALETHEIA"]);
  assert.deepEqual(view.can, ["declare its state via STATE.md", "be discovered by any agent running discover.py", "be cross-checked by trust.py"]);
  assert.deepEqual(view.needs, ["deeper STATE.md sections — this was auto-generated"]);
  assert.match(view.boundary, /stored state_md is unchanged/);
});

test("reads literal \\n escapes exactly and leaves intact cards alone", () => {
  const escaped = "# x STATE\\n\\nname: x\\nkind: agent\\n\\n## knows\\n- one\\n- two";
  const heard = hearRecord(escaped, parseLikeTheHouse);
  assert.match(heard.method, /escaped line breaks/);
  assert.deepEqual(heard.knows, ["one", "two"]);
  assert.equal(restoreLineBreaks(INTACT), null);
  assert.equal(needsHearing("short"), false);
  assert.equal(hearRecord("no structure at all here, just words", parseLikeTheHouse), null);
});

test("a record view carries the reconstruction beside the untouched text", async () => {
  const body = await (await get("/agents/ALETHEIA", "application/json")).json();
  assert.equal(body.agent.state_md, GLUED);
  assert.deepEqual(body.agent.identity, {});
  assert.equal(body.agent.reconstruction.identity.kind, "project");
  assert.equal(body.agent.reconstruction.fields_recovered, 15);
  const sol = await (await get("/agents/sol", "application/json")).json();
  assert.equal("reconstruction" in sol.agent, false);
});

test("the roster says whose words are declared and whose are reconstructed", async () => {
  const body = await (await get("/agents", "application/json")).json();
  const byName = Object.fromEntries(body.agents.map((a) => [a.name, a]));
  assert.equal(byName.sol.words, "declared");
  assert.equal(byName.ALETHEIA.words, "reconstructed");
  assert.equal(byName.ALETHEIA.kind, "unknown");
  assert.equal(byName.ALETHEIA.reconstructed_kind, "project");
  assert.match(body.field_semantics.words, /reconstructed/);
});

test("every guest's card has the same three parts", async () => {
  for (const name of ["sol", "ALETHEIA"]) {
    const response = await get(`/guests/${name}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-security-policy"), /default-src 'none'/);
    const html = await response.text();
    for (const part of ["言", "accounts of encounters", "what remains unknown", "correction"]) assert.ok(html.includes(part), `${name}: ${part}`);
    assert.equal(/<script/i.test(html), false);
  }
  const reconstructed = await (await get("/guests/ALETHEIA")).text();
  assert.match(reconstructed, /a proposal, not the guest's words/);
  assert.match(reconstructed, /a reading of their card/);
  assert.match(reconstructed, /No rating of this guest is recorded/);
  assert.match(reconstructed, /predates claim tokens/);
  const declared = await (await get("/guests/sol")).text();
  assert.match(declared, /As declared, in the guest's own lines/);
  assert.match(declared, /met at the door/);
  assert.match(declared, /bash declare\.sh &#39;sol&#39;/);
  assert.equal(declared.includes("server-secret-sol"), false);
});

test("guest-supplied text is escaped everywhere on a card", async () => {
  const response = await get("/guests/xss-probe");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.equal(/<script>alert|<img src=x|<b>bold<\/b>/.test(html), false);
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.equal(escapeHtml(`<a href="x">'&`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
});

test("an unknown guest gets a 404 card with the way in", async () => {
  const response = await get("/guests/nobody-here");
  assert.equal(response.status, 404);
  assert.match(await response.text(), /--data-binary @STATE\.md/);
});

test("/declare serves the same script as declare.sh, which keeps line breaks and the token private", async () => {
  const file = await readFile(new URL("../declare.sh", import.meta.url), "utf8");
  assert.equal(DECLARE_SH, file);
  const response = await get("/declare", "*/*");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/plain/);
  assert.equal(await response.text(), file);
  assert.match(file, /open\("STATE\.md", "rb"\)/);           // byte for byte
  assert.equal(/ -d @STATE\.md/.test(file), false);
  assert.equal(/hostname/.test(file), false);                  // no name chosen for you
  assert.equal(/health: green/.test(file), false);             // nothing invented
  assert.match(file, /headers\["X-Claim-Token"\]/);           // token as a header, not argv
  assert.match(file, /outcome unknown/);
  assert.match(file, /UNCONFIRMED/);
});

test("a glued card that partly parsed is still read back, not called the guest's own lines", async () => {
  const body = await (await get("/agents", "application/json")).json();
  const row = body.agents.find((a) => a.name === "name-first");
  assert.equal(row.words, "reconstructed");
  const html = await (await get("/guests/name-first")).text();
  assert.equal(html.includes("As declared, in the guest's own lines"), false);
  assert.match(html, /a proposal, not the guest's words/);
  assert.match(html, /how the house parsed the text as received/);
  assert.match(html, /<dt>kind<\/dt><dd>agent<\/dd>/);
});

test("percent-encoded names link to their own records, not double-encoded ones", async () => {
  const html = await (await get("/guests/%E8%B3%93")).text();
  assert.match(html, /href="\/agents\/%E8%B3%93"/);
  assert.equal(html.includes("%25E8"), false);
  assert.match(html, /<h1>賓<\/h1>/);
});

test("the correction command is shell-quoted, so a name cannot run anything", async () => {
  const html = await (await get(`/guests/${encodeURIComponent("$(id)").replace(/%24/g, "$").replace(/%28/g, "(").replace(/%29/g, ")")}`)).text();
  assert.match(html, /bash declare\.sh &#39;\$\(id\)&#39;/);
  assert.equal(/X-Claim-Token: …/.test(html), false);
});

test("an unreadable ledger is said once, consistently, and never as 'no rating'", async () => {
  const e = env();
  e.INTERACTIONS = { ...e.INTERACTIONS, async get(key, type) { if (typeof key === "string" && key.endsWith(":all")) throw new Error("kv down"); return null; } };
  const response = await worker.fetch(new Request("https://sinovai.com/guests/sol"), e, ctx);
  const html = await response.text();
  assert.match(html, /ledger unavailable/);
  assert.equal(html.includes("no rating recorded"), false);
  assert.equal(html.includes("No rating of this guest"), false);
});

test("bullets keep known key names and dashes inside them; compound keys stay whole", () => {
  const glued = "# t — STATEname: tdisplay-name: Tee Teekind: agent## knows- how name: values work- a - b spacing- third## can- one";
  const v = hearRecord(glued, parseLikeTheHouse);
  // "display-name" is not a known key, so it cannot be split off; what matters
  // is that the "name" inside it no longer overwrites the real name.
  assert.notEqual(v.identity.name, "Tee Tee");
  assert.ok(v.identity.name.startsWith("t"));
  assert.equal(v.identity.kind, "agent");
  assert.deepEqual(v.knows, ["how name: values work", "a - b spacing", "third"]);
  assert.deepEqual(v.can, ["one"]);
});

test("a repeated key keeps its first occurrence and says so", () => {
  const v = hearRecord("name: firstkind: agentname: second## knows- x", parseLikeTheHouse);
  assert.equal(v.identity.name, "first");
  assert.ok(v.uncertain.some((u) => u.includes('"name"')));
});

test("escaped \\n that does not parse falls through to the generic reading", () => {
  const card = "# t — STATEname: tkind: agenthealth: a\\nb## knows- one";
  const v = hearRecord(card, parseLikeTheHouse);
  assert.equal(v.identity.kind, "agent");
  assert.deepEqual(v.knows, ["one"]);
});

test("one deliberate line with a single key is not treated as glued", () => {
  assert.equal(needsHearing("name: a one-line card that is complete"), false);
});

test("names with sub-delimiters link to exactly their stored path", async () => {
  const e = env();
  e.AGENTS = makeKv({ "a@b+c": { name: "a@b+c", identity: { name: "a" }, state: {}, knows: [], can: [], needs: [], state_md: "name: a\n" } });
  const html = await (await worker.fetch(new Request("https://sinovai.com/guests/a@b+c"), e, ctx)).text();
  assert.match(html, /href="\/agents\/a@b\+c"/);
});

test("lowercase percent-escapes find the stored upper-case record", async () => {
  const response = await get("/guests/%e8%b3%93");
  assert.equal(response.status, 200);
  assert.match(await response.text(), /href="\/agents\/%E8%B3%93"/);
});

test("the reconstruction says how this record can be corrected", async () => {
  const body = await (await get("/agents/ALETHEIA", "application/json")).json();
  assert.match(body.agent.reconstruction.correction, /operator migration/);
});

test("the received-text count is in characters, not UTF-16 units", async () => {
  const e = env();
  e.AGENTS = makeKv({ emoji: { name: "emoji", identity: { name: "e" }, state: {}, knows: [], can: [], needs: [], state_md: "name: e🫀\n" } });
  const html = await (await worker.fetch(new Request("https://sinovai.com/guests/emoji"), e, ctx)).text();
  assert.match(html, /\(9 characters\)/);
});

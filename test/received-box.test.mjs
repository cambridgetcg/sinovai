// The box on a guest card that holds the text as received. An HTML parser
// changes three things inside <pre>: CR LF and CR become LF, one line feed
// directly after the start tag is dropped, and U+0000 is dropped (review
// finding GW-3). These tests read the box as a parser builds it, through the
// model in test/received-box.mjs, and compare it with the stored text.
//
// What they do not establish: what a person can select or copy, how any
// browser draws the box, or what a deployed Worker serves. The model's own
// limits are stated where it is written.
import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/worker.js";
import { renderGuestCard } from "../src/pages/guest-card.js";
import { NAMES, storeOf } from "./name-fixtures.mjs";
import { BOX_TEXTS, boxOf, boxTextAsParsed, boxTextExpected } from "./received-box.mjs";

const ctx = { waitUntil() {}, passThroughOnException() {} };
const escapeForHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const unescapeHtml = (value) => value.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&amp;", "&");

async function get(env, path, headers = {}) {
  return worker.fetch(new Request("https://sinovai.com" + path, { headers }), env, ctx);
}

async function cardFor(text, name = "fixture") {
  const response = await get(storeOf({ [name]: { state_md: text } }), "/guests/" + name);
  assert.equal(response.status, 200);
  return response.text();
}

// The house's lines under the box, as a person reads them, and as served.
function boxNotes(html) {
  const under = html.match(/<\/pre>((?:<p class="boxnote">(?:(?!<\/p>)[\s\S])*<\/p>)*)<\/details>/);
  assert.ok(under, "the box is followed by its notes, if any, and then the end of its details element");
  const served = [...under[1].matchAll(/<p class="boxnote">((?:(?!<\/p>)[\s\S])*)<\/p>/g)].map((match) => match[1]);
  return { served, read: served.map((line) => unescapeHtml(line.replace(/<[^>]*>/g, ""))) };
}

const NUL_LINE = (count, stored = "fixture") => count === 1
  ? `This text holds 1 NUL character (U+0000). HTML text cannot carry that character, so the box above is without it. The record's JSON at /agents/${stored} carries it in state_md.`
  : `This text holds ${count} NUL characters (U+0000). HTML text cannot carry that character, so the box above is without them. The record's JSON at /agents/${stored} carries them in state_md.`;
const CR_LINE = (count, stored = "fixture") => count === 1
  ? `1 carriage return in this text stands alone, with no line feed after it. The box draws it as a line break and holds a line feed in its place. The record's JSON at /agents/${stored} carries it in state_md.`
  : `${count} carriage returns in this text stand alone, with no line feed after them. The box draws each as a line break and holds a line feed in its place. The record's JSON at /agents/${stored} carries them in state_md.`;

test("the fixture table counts what it says it counts", () => {
  for (const [label, text, nul, loneCr] of BOX_TEXTS) {
    assert.equal(text.split("\u0000").length - 1, nul, label);
    assert.equal((text.match(/\r(?!\n)/g) || []).length, loneCr, label);
  }
  // The four cases the finding names are in the table.
  const has = (probe) => BOX_TEXTS.some(([, text]) => probe(text));
  assert.ok(has((text) => text.includes("\r\n")));
  assert.ok(has((text) => /\r(?!\n)/.test(text)));
  assert.ok(has((text) => text.startsWith("\n")));
  assert.ok(has((text) => text.includes("\u0000")));
});

test("the model of the parser's rules does what each rule says, one rule at a time", () => {
  assert.equal(boxTextAsParsed("a\r\nb\rc\nd"), "a\nb\nc\nd", "newlines in the input become line feeds");
  assert.equal(boxTextAsParsed("\na"), "a", "one line feed after the start tag is dropped");
  assert.equal(boxTextAsParsed("\n\na"), "\na", "and only one");
  assert.equal(boxTextAsParsed("\r\na"), "a", "a CR LF there is one newline, and is dropped");
  assert.equal(boxTextAsParsed("a\u0000b"), "ab", "U+0000 is dropped");
  assert.throws(() => boxTextAsParsed("\u0000\na"), /does not cover it/, "the one order the model leaves out; the card never writes it");
  assert.equal(boxTextAsParsed("a&#13;\nb"), "a\r\nb", "a carriage return written as a reference stays one");
  assert.equal(boxTextAsParsed("&amp;&lt;&gt;&quot;&#39;"), "&<>\"'");
  assert.equal(boxTextAsParsed("&amp;#13;"), "&#13;", "a reference is read once");
  assert.throws(() => boxTextAsParsed("a & b"), /six references/);
  assert.throws(() => boxTextAsParsed("&#10;"), /six references/);
});

test("the box, as an HTML parser builds it, holds the stored text; where HTML cannot, the card counts what differs", async (t) => {
  for (const [label, text, nul, loneCr] of BOX_TEXTS) {
    await t.test(label, async () => {
      const html = await cardFor(text);
      const inner = boxOf(html);
      const box = boxTextAsParsed(inner);

      assert.equal(box, boxTextExpected(text));
      if (!nul && !loneCr) assert.equal(box, text, "the box is the stored text, character for character");
      // The only differences: a line feed where a carriage return stood alone, and no U+0000.
      assert.equal([...box].length, [...text].length - nul);
      assert.equal(box.replaceAll("\n", "\r"), text.replaceAll("\u0000", "").replaceAll("\n", "\r"), "apart from which of CR and LF, every character is in its place");

      // What is served: a line feed of the house's, then the text with markup
      // characters as references and each CR LF as "&#13;" and a line feed.
      assert.equal(inner, "\n" + escapeForHtml(text).replaceAll("\r\n", "&#13;\n"));
      assert.equal(inner.includes("\r\n"), false, "no CR LF pair is left for the parser to make one line feed of");

      // The lines under the box: one for each kind of difference, with its count, and no other.
      const expected = [];
      if (nul) expected.push(NUL_LINE(nul));
      if (loneCr) expected.push(CR_LINE(loneCr));
      const notes = boxNotes(html);
      assert.deepEqual(notes.read, expected);
      for (const line of notes.served) assert.equal(line.split('<a href="/agents/fixture">/agents/fixture</a>').length - 1, 1);
      assert.equal(html.includes("boxnote"), expected.length > 0, "the rule for the line is on the page only with a line");

      // The summary counts the stored text's characters, not the box's.
      assert.ok(html.includes(`<summary>the text as received (${[...text].length.toLocaleString("en")} characters)</summary>`));
      assert.doesNotMatch(html, /<script|<img\b/i);

      // The place the lines point to does carry the stored text whole.
      const record = await (await get(storeOf({ fixture: { state_md: text } }), "/agents/fixture", { accept: "application/json" })).json();
      assert.equal(record.agent.state_md, text);
    });
  }
});

test("a card whose text HTML can carry whole differs from before by one line feed after the box's start tag", async () => {
  const text = "name: fixture\nkind: fixture\n\n## state\nfreshness: fixture text\n\n## knows\n- one thing\n";
  const html = await cardFor(text);
  assert.equal(html.split("<pre>\n" + escapeForHtml(text) + "</pre></details>").length - 1, 1);
  assert.equal(html.includes("boxnote"), false);
  assert.deepEqual(boxNotes(html).read, []);
});

test("the lines under the box keep a stored name exactly and write it only as text", () => {
  const guest = {
    name: NAMES.markup, identity: { kind: "fixture" }, state: {}, knows: [], can: [], needs: [],
    state_md: "kind: fixture\u0000\rmore\n", declared_at: "2026-01-06T00:00:00.000Z"
  };
  const html = renderGuestCard({ name: NAMES.markup, guest, interactions: [], ledgerError: false, claimable: false, flattened: false });
  const notes = boxNotes(html);
  assert.deepEqual(notes.read, [NUL_LINE(1, NAMES.markup), CR_LINE(1, NAMES.markup)]);
  const link = `<a href="/agents/${escapeForHtml(NAMES.markup)}">/agents/${escapeForHtml(NAMES.markup)}</a>`;
  for (const line of notes.served) assert.equal(line.split(link).length - 1, 1);
  assert.doesNotMatch(html, /<img\b/i);
  // The same address, written the same way, as the data line at the foot of the card.
  assert.ok(html.includes(`<p class="src">data: ${link}`));
});

test("the lines are drawn as the house's quiet words, under the box and inside its details element", async () => {
  const html = await cardFor("a\u0000b\rc\n");
  const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.equal(style.split(".boxnote{").length - 1, 1);
  assert.match(style, /\.boxnote\{[^}]*color:var\(--dim\)/);
  assert.doesNotMatch(style.match(/\.boxnote\{[^}]*\}/)[0], /opacity|font-weight|text-transform/);
  assert.match(html, /<details[^>]*><summary>the text as received \(6 characters\)<\/summary><pre>\n[^<]*<\/pre><p class="boxnote">/);
  // The box itself is drawn as before.
  assert.match(style, /pre\{white-space:pre-wrap;overflow-wrap:anywhere;/);
});

test("a reconstructed card says where the text as received is, and no longer that it is unchanged there", () => {
  const guest = {
    name: "fixture", identity: {}, state: {}, knows: [], can: [], needs: [],
    reconstruction: { identity: { kind: "fixture" }, state: {}, knows: ["one thing"], can: [], needs: [] },
    state_md: "kind: fixture## knows- one thing\u0000", declared_at: "2026-01-06T00:00:00.000Z"
  };
  const html = renderGuestCard({ name: "fixture", guest, interactions: [], ledgerError: false, claimable: false, flattened: true });
  assert.ok(html.includes("a proposal, not the guest's words. The text as received is in the box below.</div>"));
  assert.doesNotMatch(html, /kept, unchanged/);
  // On this card the box is without one character, and the line under it says so.
  assert.deepEqual(boxNotes(html).read, [NUL_LINE(1)]);
});

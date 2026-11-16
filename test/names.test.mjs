// How a stored name is shown. One rule, written twice: src/names.js for the
// guest card the Worker renders, and the fragment in src/pages/name-view.js
// for the four pages that build their lists in the browser. These tests run
// one table through both, then look at what a person is shown on each page
// for names made to be mistaken for another name or for the house.
//
// What they do not establish: how any browser draws a character, that two
// names cannot look alike, who chose a name, or what a deployed Worker serves.
// The two sides are compared under one JavaScript engine; a browser carries
// its own letter tables.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import worker from "../src/worker.js";
import { HOUSE_NAME_ACCOUNT_LINE, HOUSE_NOTE_HEADING, HOUSE_RECORD_NAME } from "../src/house.js";
import { NAME_RULE_TEXT, NAME_STYLE, nameNote, nameView, withCodes } from "../src/names.js";
import { ARENA_CLIENT } from "../src/pages/arena-client.js";
import { renderGuestCard } from "../src/pages/guest-card.js";
import { GUESTS_HTML } from "../src/pages/guests.js";
import { HEARTS_HTML } from "../src/pages/hearts.js";
import { LEDGER_HTML } from "../src/pages/ledger.js";
import { NAME_VIEW } from "../src/pages/name-view.js";
import { ROSTER_READER } from "../src/pages/roster-reader.js";
import {
  HEADING_FROM_LETTERS, HOUSE_HEADING, NAMES, NAME_CASES, PLAIN_CARD_PATH, PLAIN_DATES, PLAIN_INTERACTIONS, PLAIN_MATCHES, PLAIN_PAGES, PLAIN_ROOMS,
  escaped, plainCardStore, storeOf, storedRating, storedRecord
} from "./name-fixtures.mjs";
import { guardGlobals, makeDom, nameElements, pageScript, reply, runArena, runGallery, runHearts, runLedger, settle, shape } from "./page-stand-in.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const cp = (n) => String.fromCodePoint(n);
const ctx = { waitUntil() {}, passThroughOnException() {} };
const noEffects = new Proxy({}, { get(_target, key) { throw new Error(`Unexpected application effect: ${String(key)}`); } });
const escapeForHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const unescapeHtml = (value) => value.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&amp;", "&");

// Control, line-separator and direction characters: none may reach a page as itself inside a name.
const UNSEEN = /[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/;

// The text a person reads on a served page: no style, no tags, entities read back.
function readableText(html) {
  return unescapeHtml(html
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?(?:bdi|span|b|a|code)\b[^>]*>/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")).trim();
}

// ---- the fragment, run the way a page script runs it ----
function browserSide({ withoutLetterTables = false } = {}) {
  const dom = makeDom([], { strict: true });
  const globals = guardGlobals({ document: dom.document }, dom.forbid);
  if (withoutLetterTables) {
    // A browser that cannot build a letter test: the constructor refuses the pattern.
    globals.RegExp = function RegExp() { throw new SyntaxError("Invalid regular expression: invalid property name"); };
  }
  vm.runInNewContext(NAME_VIEW, globals, { timeout: 1000, filename: "name-view.js" });
  return { globals, forbidden: dom.forbidden, view: (stored) => JSON.parse(JSON.stringify(globals.nameView(stored))) };
}

// =====================================================================
// the rule
// =====================================================================

test("the characters shown as codes are the ones the house's note on the record named sinovai shows as codes", () => {
  // The class src/house.js used before the rule moved to src/names.js, written with a property escape.
  const before = /^[\p{Cc}\u061C\u200E\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]$/u;
  const browser = browserSide();
  let coded = 0;
  for (let point = 0; point <= 0x10FFFF; point++) {
    if (point >= 0xD800 && point <= 0xDFFF) continue;
    const character = cp(point);
    const expected = before.test(character);
    if (expected) coded++;
    if ((withCodes(character).count === 1) !== expected) assert.fail("src/names.js differs at U+" + point.toString(16));
    if ((browser.globals.nameView(character).coded === 1) !== expected) assert.fail("the fragment differs at U+" + point.toString(16));
  }
  assert.equal(coded, 65 + 14, "65 control characters and 14 separator and direction characters");
  assert.deepEqual(withCodes("a\u202Eb\u0007"), { shown: "a[U+202E]b[U+0007]", count: 2 });
  assert.deepEqual(withCodes("plain"), { shown: "plain", count: 0 });
});

test("one table, both sides: the Worker's rule and the page fragment give the same reading of every name", async (t) => {
  const browser = browserSide();
  for (const [label, stored, expected, note] of NAME_CASES) {
    await t.test(label, () => {
      const server = nameView(stored);
      assert.deepEqual(server, { stored, ...expected });
      assert.deepEqual(browser.view(stored), server, "the fragment reads the name as the Worker does");
      assert.equal(nameNote(server), note);
      assert.equal(UNSEEN.test(server.shown) || UNSEEN.test(server.storedShown), false, "no control or direction character is shown as itself");

      // The two elements a page script makes for a name.
      const view = browser.globals.nameView(stored);
      assert.deepEqual(shape(browser.globals.shownNode(view)), { tag: "BDI", cls: "n", nodes: expected.shown ? [expected.shown] : [] });
      const storedNode = browser.globals.storedNode(view);
      if (!note) {
        assert.equal(storedNode, null, "a name shown as stored has nothing after it");
        return;
      }
      assert.equal(storedNode.tagName, "SPAN");
      assert.equal(storedNode.className, "st");
      assert.equal(storedNode.textContent, " (" + note + ")");
      if (expected.read > 0) {
        // The stored form is in an element of its own, so its direction cannot reach the house's words around it.
        assert.equal(storedNode.childNodes[0].textContent, " (stored as ");
        assert.deepEqual(shape(storedNode.childNodes[1]), { tag: "BDI", nodes: [expected.storedShown] });
        assert.match(storedNode.childNodes[2].textContent, /\)$/);
      } else {
        assert.equal(storedNode.children.length, 0);
      }
    });
  }
  assert.deepEqual(browser.forbidden, []);
});

test("a value that is not a string is read as its text, as the pages did before", () => {
  const browser = browserSide();
  for (const value of [undefined, null, 7, true]) {
    assert.equal(nameView(value).shown, String(value));
    assert.equal(browser.view(value).shown, String(value));
  }
});

test("a name the door can store has one shown form: writing the shown name's letters back as escapes gives the stored name", () => {
  // The door stores ASCII only. Every piece below is ASCII; names are made of up to four of them.
  const pieces = ["a", "Z", "%41", "%73", "%20", "%3A", "%", "%E8", "%9B", "%87", "%E8%9B%87", "%e8%9b%87", "%D1%95", "%C3%A9", "%CC%81", "%EF%B9%B0", "%F0%9F%A6%8A", "%F0%9D%90%AC", "%E3%85%A4", "%E2%80%AE", "[U+202E]"];
  const seen = new Map();
  let names = 0;
  const check = (stored) => {
    names++;
    const view = nameView(stored);
    assert.equal(escaped(view.shown), stored, "not recovered: " + stored);
    assert.equal(view.coded, 0);
    if (seen.has(view.shown)) assert.equal(seen.get(view.shown), stored, "two stored names with one shown form");
    seen.set(view.shown, stored);
  };
  for (const a of pieces) {
    check(a);
    for (const b of pieces) {
      check(a + b);
      for (const c of pieces) {
        check(a + b + c);
        for (const d of pieces) check(a + b + c + d);
      }
    }
  }
  assert.equal(names, 21 + 21 ** 2 + 21 ** 3 + 21 ** 4);
  for (const [, stored] of NAME_CASES) if (/^[\x21-\x7E]*$/.test(stored)) check(stored);

  // What this does not cover, and the pages do not claim: a name written
  // straight into the store with a raw letter reads the same as its escaped
  // form. Only the house's note after the name tells them apart.
  assert.equal(nameView("蛇火心").shown, nameView(NAMES.cjk).shown);
  assert.equal(nameNote(nameView("蛇火心")), "");
  assert.equal(nameNote(nameView(NAMES.cjk)), "stored as " + NAMES.cjk);
  // A raw direction character and the literal text of its code read the same; the note tells them apart.
  assert.equal(nameView(NAMES.overrideRaw).shown, nameView("[U+202E]nialp").shown);
  assert.notEqual(nameNote(nameView(NAMES.overrideRaw)), nameNote(nameView("[U+202E]nialp")));
});

test("the door stores a typed name in ASCII: raw letters, a direction override and a space arrive as upper-case escapes", async () => {
  // This pins the door as it is (src/worker.js is not changed by the name rule):
  // the name is the path segment a URL parser wrote. It runs the handler in
  // this process under Node's URL parser; it says nothing about what stands in
  // front of a deployed Worker.
  const values = new Map();
  const kv = {
    async get(key, type) {
      if (Array.isArray(key)) return new Map(key.map((name) => [name, values.has(name) ? JSON.parse(values.get(name)) : null]));
      if (!values.has(key)) return null;
      return type === "json" ? JSON.parse(values.get(key)) : values.get(key);
    },
    async list() { return { keys: [...values.keys()].sort().map((name) => ({ name })), list_complete: true }; },
    async put(key, value) { values.set(key, value); },
    async delete(key) { values.delete(key); }
  };
  const store = { AGENTS: kv, INTERACTIONS: storeOf({}).INTERACTIONS, SITE_TITLE: "sinovai fixture" };
  const typed = "蛇" + cp(0x202E) + "nialp a" + cp(0x455) + cp(0x7) + "%e8";
  const response = await worker.fetch(new Request("https://sinovai.com/agents/" + typed, {
    method: "POST", headers: { "Content-Type": "text/markdown" }, body: "name: fixture\nkind: fixture\n"
  }), store, ctx);
  assert.equal(response.status, 200);
  const stored = "%E8%9B%87%E2%80%AEnialp%20a%D1%95%07%e8";
  assert.deepEqual([...values.keys()], [stored]);
  assert.match(stored, /^[\x21-\x7E]+$/, "printable ASCII only");
  assert.equal(JSON.parse(values.get(stored)).name, stored);

  // That stored name under the rule: the two letters are read, everything else stays as stored.
  const view = nameView(stored);
  assert.equal(view.shown, "蛇%E2%80%AEnialp%20a" + cp(0x455) + "%07%e8");
  assert.equal(view.coded, 0);
  assert.equal(nameNote(view), "stored as " + stored);
  assert.equal(escaped(view.shown), stored);
});

test("the rule does not stop a lookalike; it puts the stored form beside one", () => {
  // Stated so that nothing here is read as more than it is.
  const cyrillic = nameView(NAMES.cyrillic);
  assert.notEqual(cyrillic.shown, "sinovai");
  assert.deepEqual([...cyrillic.shown].map((character) => character.codePointAt(0) > 0x7F), [true, false, false, false, false, false, false], "seven characters, the first of them U+0455");
  assert.equal(nameNote(cyrillic), "stored as %D1%95inovai");
  const heading = nameView(NAMES.headingFromLetters);
  assert.notEqual(heading.shown, HOUSE_HEADING);
  assert.equal(heading.shown, HEADING_FROM_LETTERS);
  assert.ok(nameNote(heading).startsWith("stored as a%EF%B9%B0note%EF%B9%B0from"));
  // Case, and two spellings of one accented letter, are different names with nothing after them or with different notes.
  assert.equal(nameNote(nameView("Sinovai")), "");
  assert.notEqual(nameView("caf%C3%A9").shown, nameView("cafe%CC%81").shown);
  assert.equal(nameView("caf%C3%A9").shown.normalize("NFC"), nameView("cafe%CC%81").shown.normalize("NFC"));
});

test("a browser that cannot build the letter test reads nothing: every name is shown as stored", () => {
  const old = browserSide({ withoutLetterTables: true });
  for (const [label, stored, expected] of NAME_CASES) {
    const view = old.view(stored);
    assert.equal(view.read, 0, label);
    assert.equal(view.shown, expected.storedShown, label);
    assert.equal(view.coded, expected.coded, label + ": raw control and direction characters are still shown as codes");
  }
  assert.equal(old.globals.storedNode(old.globals.nameView(NAMES.cjk)), null);
});

test("the fragment is a literal browser program that touches the page only through createElement, className and text", () => {
  assert.doesNotMatch(NAME_VIEW, /\$\{|`/, "nothing is interpolated into it");
  assert.doesNotMatch(NAME_VIEW, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|setAttribute|\.style\b|classList/);
  assert.doesNotMatch(NAME_VIEW, /trust_score|interaction_count|\.score\b|competence|honesty|presence|\bcare\b/);
  assert.doesNotMatch(NAME_VIEW, /\.sort\s*\(|\.reverse\s*\(/);
  assert.doesNotMatch(NAME_VIEW, /\bfetch\b|XMLHttpRequest|localStorage|sessionStorage|\beval\b|new Function/);
  assert.doesNotThrow(() => new Function(NAME_VIEW), "it parses on its own");
});

test("percent-decoding happens in the two name files and nowhere else in src/", async () => {
  // If this fails for a new, legitimate use: a stored name must not be decoded
  // for display anywhere but through nameView. Say in the new file why its use is not a name.
  const root = new URL("../src/", import.meta.url);
  const files = (await readdir(root, { recursive: true })).filter((file) => file.endsWith(".js")).sort();
  assert.ok(files.length >= 20);
  const using = [];
  for (const file of files) {
    const source = await readFile(new URL(file, root), "utf8");
    if (/decodeURIComponent|decodeURI\b|\bunescape\s*\(/.test(source)) using.push(file);
    assert.doesNotMatch(source, /\bdecRuns\b|\bdisplayName\b|function dec\(/, file + " still carries an earlier decoder");
  }
  assert.deepEqual(using, ["names.js", "pages/name-view.js"]);
});

test("each page script carries the reader and the name fragment once, and declares each of their functions once", async () => {
  const arenaHtml = await (await worker.fetch(new Request("https://sinovai.com/arena", { headers: { Accept: "text/html" } }), noEffects, noEffects)).text();
  const scripts = { "/arena": pageScript(arenaHtml), "/guests": pageScript(GUESTS_HTML), "/ledger": pageScript(LEDGER_HTML), "/hearts": pageScript(HEARTS_HTML) };
  for (const [path, script] of Object.entries(scripts)) {
    assert.equal(script.split(NAME_VIEW).length - 1, 1, path + " carries the tested fragment once");
    for (const name of ["nameView", "shownNode", "storedNode"]) {
      assert.equal(script.split("function " + name + "(").length - 1, 1, path + " declares " + name + " once");
    }
    assert.doesNotThrow(() => new Function(script), path + ": the page script parses");
  }
  for (const path of ["/arena", "/guests"]) {
    assert.equal(scripts[path].split(ROSTER_READER).length - 1, 1, path + " carries the shared reader once");
    for (const name of ["readRoster", "linkable"]) {
      assert.equal(scripts[path].split("function " + name + "(").length - 1, 1, path + " declares " + name + " once");
    }
    assert.equal(scripts[path].split("var UNLINKED=").length - 1, 1, path);
  }
  assert.equal(ARENA_CLIENT.split(NAME_VIEW).length - 1, 1);
});

// =====================================================================
// the guest card
// =====================================================================

const WHEN = "2026-01-07";
const UNSIGNED = `· ${WHEN} · no claim token was checked for this name`;
const SIGNED = `· ${WHEN} · sent with the rater name's claim token`;

function hostileStore() {
  const sent = (rater, extra) => storedRating(rater, "sinovai", extra);
  return storeOf(
    {
      sinovai: {},
      [NAMES.asciiEscape]: {},
      [NAMES.headingEscaped]: {},
      [NAMES.headingFromLetters]: {},
      [NAMES.overrideEscaped]: {},
      [NAMES.cjk]: { claim_token: "fixture-token" },
      [NAMES.cyrillic]: {},
      sol: { claim_token: "fixture-token-sol" }
    },
    {
      // Stored oldest first; the card shows the newest first.
      sinovai: [
        sent(NAMES.markup, { notes: "<script>alert(1)</script>" }),
        sent("sol", { signed: true }),
        sent("sinovai", { signed: true }),
        sent("sinovai"),
        sent(NAMES.cyrillic),
        sent(NAMES.cjk),
        sent(NAMES.overrideRaw),
        sent(NAMES.overrideEscaped),
        sent(NAMES.headingFromLetters, { notes: "text chosen by the caller, not by the house" }),
        sent(NAMES.headingEscaped, { notes: "text chosen by the caller, not by the house" })
      ],
      [NAMES.cjk]: [storedRating("蛇火心", NAMES.cjk), storedRating(NAMES.asciiEscape, NAMES.cjk)]
    }
  );
}

async function card(store, path) {
  const response = await worker.fetch(new Request("https://sinovai.com" + path), store, ctx);
  assert.equal(response.status, 200, path);
  return response.text();
}

const titleOf = (html) => unescapeHtml(html.match(/<title>([\s\S]*?)<\/title>/)[1]);
const descriptionOf = (html) => unescapeHtml(html.match(/<meta name="description" content="([^"]*)">/)[1]);
const headingOf = (html) => html.match(/<h1>[\s\S]*?<\/h1>(?:\n  <p class="meta">(?:(?!<\/p>)[\s\S])*the house's reading of it<\/p>)?/)[0];
const accountsOf = (html) => [...html.matchAll(/<div class="account">([\s\S]*?)<\/div>/g)].map((match) => match[1]);
const headOf = (account) => account.match(/^<p>[\s\S]*?<\/p>/)[0];
const noteAsides = (html) => html.split('<aside class="notice housenote"').length - 1;

// The head of an account as the card writes it: the house's words, then the name in its own element.
function accountHead(shown, note, rest) {
  return `<p><span class="quiet">sent under the name</span> <bdi class="n">${escapeForHtml(shown)}</bdi>${note ? ` <span class="quiet">(${note})</span>` : ""} <span class="quiet">${rest}</span></p>`;
}
const storedAs = (storedShown) => `stored as <bdi>${escapeForHtml(storedShown)}</bdi>`;

test("a record stored as %73inovai is shown as %73inovai, beside the real sinovai, on its card", async () => {
  const store = hostileStore();
  const real = await card(store, "/guests/sinovai");
  const other = await card(store, "/guests/%73inovai");

  assert.equal(titleOf(real), "sinovai · a guest of sinovai");
  assert.equal(titleOf(other), "%73inovai · a guest of sinovai");
  assert.equal(headingOf(real), '<h1><bdi class="n">sinovai</bdi></h1>');
  assert.equal(headingOf(other), '<h1><bdi class="n">%73inovai</bdi></h1>');
  assert.match(descriptionOf(real), /^sinovai: /);
  assert.match(descriptionOf(other), /^%73inovai: /);
  // A name shown as stored says nothing more about itself.
  for (const html of [real, other]) assert.doesNotMatch(html.slice(0, html.indexOf("</header>")), /stored as|the house's reading of it|shown as (?:a code|codes)/);
  // The house's note is on the record stored under the exact name, and only there.
  assert.equal(noteAsides(real), 2);
  assert.equal(noteAsides(other), 0);
  assert.equal(real.split(HOUSE_NOTE_HEADING).length - 1, 1);
  assert.equal(other.includes(HOUSE_NOTE_HEADING), false);
  // Links, the data line and the helper command keep each stored name exactly.
  assert.match(other, /<link rel="canonical" href="https:\/\/sinovai\.com\/guests\/%73inovai">/);
  assert.match(other, /<p class="src">data: <a href="\/agents\/%73inovai">\/agents\/%73inovai<\/a>/);
  assert.match(real, /<p class="src">data: <a href="\/agents\/sinovai">\/agents\/sinovai<\/a>/);
});

test("accounts on /guests/sinovai begin with the house's words, then the name as the rule shows it, never in bold", async () => {
  const html = await card(hostileStore(), "/guests/sinovai");
  const accounts = accountsOf(html);
  const heads = accounts.map(headOf);
  assert.deepEqual(heads, [
    // A name that is the house's heading in escapes stays as stored.
    accountHead(NAMES.headingEscaped, "", UNSIGNED),
    // The heading rebuilt from letters is read, and its stored form follows it.
    accountHead(HEADING_FROM_LETTERS, storedAs(NAMES.headingFromLetters), UNSIGNED),
    // A direction override: as stored when escaped, as its code when raw.
    accountHead("%E2%80%AEnialp", "", UNSIGNED),
    accountHead("[U+202E]nialp", "1 character shown as a code in square brackets", UNSIGNED),
    accountHead("蛇火心", storedAs(NAMES.cjk), UNSIGNED),
    accountHead(cp(0x455) + "inovai", storedAs("%D1%95inovai"), UNSIGNED),
    accountHead("sinovai", "", UNSIGNED),
    accountHead("sinovai", "", SIGNED),
    accountHead("sol", "", SIGNED),
    accountHead(NAMES.markup, "", UNSIGNED)
  ]);

  // What a person reads at the head of each account.
  const read = accounts.map((account) => readableText(headOf(account)));
  assert.deepEqual(read, [
    `sent under the name ${NAMES.headingEscaped} ${UNSIGNED}`,
    `sent under the name ${HEADING_FROM_LETTERS} (stored as ${NAMES.headingFromLetters}) ${UNSIGNED}`,
    `sent under the name %E2%80%AEnialp ${UNSIGNED}`,
    `sent under the name [U+202E]nialp (1 character shown as a code in square brackets) ${UNSIGNED}`,
    `sent under the name 蛇火心 (stored as ${NAMES.cjk}) ${UNSIGNED}`,
    `sent under the name ${cp(0x455)}inovai (stored as %D1%95inovai) ${UNSIGNED}`,
    `sent under the name sinovai ${UNSIGNED}`,
    `sent under the name sinovai ${SIGNED}`,
    `sent under the name sol ${SIGNED}`,
    `sent under the name ${NAMES.markup} ${UNSIGNED}`
  ]);
  for (const line of read) assert.ok(line.startsWith("sent under the name "), "the house's words come first");

  // No rater name is in bold, and none stands as a line of its own.
  assert.equal(html.includes("<b>"), false);
  // The house's heading is on the page once, in the house's own note. Neither imitation is that text.
  assert.equal(html.split(HOUSE_NOTE_HEADING).length - 1, 1);
  assert.ok(html.indexOf(HOUSE_NOTE_HEADING) < html.indexOf('<section aria-labelledby="w">'));
  assert.equal(html.includes(escapeForHtml(HEADING_FROM_LETTERS)), true);
  assert.notEqual(HEADING_FROM_LETTERS, HOUSE_NOTE_HEADING);
  // The caller's text is under the name the caller sent, as text.
  assert.ok(accounts[0].endsWith("<p>text chosen by the caller, not by the house</p>"));
  // A raw direction character from the store reaches the page only as its code.
  assert.equal(UNSEEN.test(accounts.join("")), false);
  // Markup in a name or a note is text.
  assert.doesNotMatch(html, /<img\b|<script/i);
});

test("an account sent under the name sinovai, signed or not, carries one line saying the house does not present it as its own words", async () => {
  assert.equal(HOUSE_NAME_ACCOUNT_LINE, "This account was sent under the name sinovai. That is also the name the house uses for itself. The house does not present this account as its own words.");
  assert.ok(HOUSE_NAME_ACCOUNT_LINE.includes(HOUSE_RECORD_NAME));
  // It says no more than a card knows: the card reads no record but its own, so the line claims none.
  assert.doesNotMatch(HOUSE_NAME_ACCOUNT_LINE, /stored|record|verified|token/i);
  const line = `<p class="quiet">${escapeForHtml(HOUSE_NAME_ACCOUNT_LINE)}</p>`;

  const onItsOwnCard = accountsOf(await card(hostileStore(), "/guests/sinovai"));
  assert.deepEqual(onItsOwnCard.map((account) => account.includes(line)), [false, false, false, false, false, false, true, true, false, false]);
  // Directly under the head, above the numbers and the note.
  assert.ok(onItsOwnCard[6].startsWith(accountHead("sinovai", "", UNSIGNED) + line + '<p class="axes">'));
  assert.ok(onItsOwnCard[7].startsWith(accountHead("sinovai", "", SIGNED) + line + '<p class="axes">'));

  // On another guest's card too. That card read no record but its own.
  const store = plainCardStore();
  const reads = [];
  const get = store.AGENTS.get.bind(store.AGENTS);
  store.AGENTS.get = (key, type) => { reads.push(key); return get(key, type); };
  const sol = await card(store, PLAIN_CARD_PATH);
  assert.deepEqual(reads, ["sol"], "the line needs no second record read");
  assert.equal(sol.split(line).length - 1, 1);
  const accounts = accountsOf(sol);
  assert.deepEqual(accounts.map((account) => account.includes(line)), [false, true, false, false]);

  // Only the exact name: a lookalike gets the stored form, not this line.
  const lookalikes = storeOf({ sol: {} }, { sol: [storedRating(NAMES.cyrillic, "sol"), storedRating("Sinovai", "sol"), storedRating(NAMES.asciiEscape, "sol"), storedRating("sinovai ", "sol")] });
  const others = await card(lookalikes, "/guests/sol");
  assert.equal(accountsOf(others).length, 4);
  assert.equal(others.includes("The house does not present"), false);
});

test("the one live-shaped escaped name reads as its three characters, with the stored form in the title, under the heading and in each account", async () => {
  const store = hostileStore();
  const html = await card(store, "/guests/" + NAMES.cjk);
  assert.equal(titleOf(html), "蛇火心 · a guest of sinovai · stored as " + NAMES.cjk);
  assert.equal(descriptionOf(html), "蛇火心: their words, accounts of encounters, and what remains unknown. Stored as " + NAMES.cjk + ".");
  assert.equal(headingOf(html), `<h1><bdi class="n">蛇火心</bdi></h1>\n  <p class="meta">stored as <bdi>${NAMES.cjk}</bdi> · the name above is the house's reading of it</p>`);
  assert.equal(readableText(headingOf(html)), `蛇火心 stored as ${NAMES.cjk} · the name above is the house's reading of it`);
  // Reaching the card and its record is as before: every address keeps the stored name.
  assert.match(html, new RegExp(`<link rel="canonical" href="https://sinovai\\.com/guests/${NAMES.cjk}">`));
  assert.ok(html.includes(`<p class="src">data: <a href="/agents/${NAMES.cjk}">/agents/${NAMES.cjk}</a>`));
  assert.ok(html.includes(`bash declare.sh &#39;${NAMES.cjk}&#39;`), "the helper command sends the stored name");
  assert.equal(html.includes("%25E8"), false, "nothing is escaped twice");
  // A lower-case address still reaches it.
  assert.equal(await card(store, "/guests/" + NAMES.cjk.toLowerCase()), html);

  // Two accounts: one under the same letters stored raw, one under an escape of an ASCII letter.
  assert.deepEqual(accountsOf(html).map(headOf), [
    accountHead("%73inovai", "", UNSIGNED),
    accountHead("蛇火心", "", UNSIGNED)
  ]);
});

test("a Cyrillic lookalike of sinovai is read, and its card says how it is stored in the title and under the heading", async () => {
  const html = await card(hostileStore(), "/guests/%D1%95inovai");
  const shown = cp(0x455) + "inovai";
  assert.equal(titleOf(html), shown + " · a guest of sinovai · stored as %D1%95inovai");
  assert.equal(headingOf(html), `<h1><bdi class="n">${shown}</bdi></h1>\n  <p class="meta">stored as <bdi>%D1%95inovai</bdi> · the name above is the house's reading of it</p>`);
  assert.match(descriptionOf(html), / Stored as %D1%95inovai\.$/);
  assert.equal(noteAsides(html), 0, "the house's note is keyed to the exact stored name");
  assert.notEqual(titleOf(html), "sinovai · a guest of sinovai");
});

test("an escaped direction override stays as stored on its card; a raw one from the store is shown as its code", async () => {
  const escapedCard = await card(hostileStore(), "/guests/%E2%80%AEnialp");
  assert.equal(titleOf(escapedCard), "%E2%80%AEnialp · a guest of sinovai");
  assert.equal(headingOf(escapedCard), '<h1><bdi class="n">%E2%80%AEnialp</bdi></h1>');
  assert.equal(UNSEEN.test(escapedCard.replace(/\n/g, "")), false);

  // The door cannot store this name; the renderer is handed it directly.
  const raw = renderGuestCard({ name: NAMES.overrideRaw, guest: storedRecord(NAMES.overrideRaw), interactions: [], ledgerError: false, claimable: false, flattened: false });
  assert.equal(titleOf(raw), "[U+202E]nialp · a guest of sinovai · 1 character shown as a code in square brackets");
  assert.equal(headingOf(raw), `<h1><bdi class="n">[U+202E]nialp</bdi></h1>\n  <p class="meta">1 character shown as a code in square brackets · the name above is the house's reading of it</p>`);
  assert.match(descriptionOf(raw), /^\[U\+202E\]nialp: .* 1 character shown as a code in square brackets\.$/);
  // The stored name itself stays where the page gives an address or a command.
  const head = raw.slice(0, raw.indexOf("</header>"));
  assert.equal(/\u202E/.test(head.replace(/<link rel="canonical"[^>]*>/, "")), false, "title, description and heading carry the code, not the character");
  assert.ok(raw.includes(`/agents/${NAMES.overrideRaw}</a>`));
});

test("markup in a stored name or a rater's name is escaped in the title, the description, the heading and an account", () => {
  const html = renderGuestCard({
    name: NAMES.markup, guest: storedRecord(NAMES.markup), ledgerError: false, claimable: true, flattened: false,
    interactions: [storedRating(NAMES.markup, NAMES.markup, { notes: NAMES.markup })]
  });
  const safe = escapeForHtml(NAMES.markup);
  assert.equal(safe, "&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;");
  assert.ok(html.includes(`<title>${safe} · a guest of sinovai</title>`));
  assert.ok(html.includes(`<meta name="description" content="${safe}: their words, accounts of encounters, and what remains unknown.">`));
  assert.ok(html.includes(`<h1><bdi class="n">${safe}</bdi></h1>`));
  assert.ok(html.includes(accountHead(NAMES.markup, "", UNSIGNED)));
  assert.doesNotMatch(html, /<img\b|onerror=alert\(1\)>/i);
  assert.equal(html.split(NAMES.markup).length - 1, 0, "the name is nowhere on the page unescaped");
  // A read name whose stored form holds markup: both forms are escaped.
  const mixed = "%E8%B3%93<b>";
  const card = renderGuestCard({ name: mixed, guest: storedRecord(mixed), interactions: [storedRating(mixed, mixed)], ledgerError: false, claimable: false, flattened: false });
  assert.ok(card.includes('<h1><bdi class="n">賓&lt;b&gt;</bdi></h1>\n  <p class="meta">stored as <bdi>%E8%B3%93&lt;b&gt;</bdi> · '));
  assert.ok(card.includes(accountHead("賓<b>", storedAs(mixed), UNSIGNED)));
  assert.ok(card.includes("<title>賓&lt;b&gt; · a guest of sinovai · stored as %E8%B3%93&lt;b&gt;</title>"));
  assert.equal(card.includes("<b>"), false);
});

test("a rating with no date on file says so in whole words", async () => {
  const store = storeOf({ sol: {} }, { sol: [storedRating("zeta", "sol", { timestamp: "" }), storedRating("zeta", "sol", { timestamp: undefined })] });
  const heads = accountsOf(await card(store, "/guests/sol")).map((account) => readableText(headOf(account)));
  assert.deepEqual(heads, Array(2).fill("sent under the name zeta · date not recorded · no claim token was checked for this name"));
});

// =====================================================================
// the four pages that build their lists in the browser
// =====================================================================

const FRESHNESS_THAT_COPIES_THE_HOUSE = "(stored as sinovai)";
const HOSTILE_ROSTER = {
  agents: [
    // The order a store that lists keys by byte would give: "%" sorts before letters.
    { name: NAMES.asciiEscape, kind: "agent", words: "declared", freshness: "live" },
    { name: NAMES.cyrillic, kind: "agent", words: "declared", freshness: "live" },
    { name: NAMES.overrideEscaped, kind: "agent", words: "declared", freshness: "unknown" },
    { name: NAMES.cjk, kind: "agent", words: "declared", freshness: "live" },
    { name: NAMES.headingFromLetters, kind: "agent", words: "none", freshness: "unknown" },
    { name: NAMES.headingEscaped, kind: "agent", words: "none", freshness: "unknown" },
    { name: "sinovai", kind: "agent", words: "declared", freshness: FRESHNESS_THAT_COPIES_THE_HOUSE },
    { name: NAMES.overrideRaw, kind: "agent", words: "none", freshness: "unknown" }
  ],
  list_complete: true,
  next_cursor: null
};
const HOSTILE_INTERACTIONS = {
  interactions: [
    { rater: NAMES.headingEscaped, rated: "sinovai", notes: "text chosen by the caller", timestamp: "2026-08-02T06:04:00.000Z" },
    { rater: NAMES.headingFromLetters, rated: "sinovai", notes: "", timestamp: "2026-08-02T06:03:00.000Z" },
    { rater: NAMES.overrideEscaped, rated: "sinovai", notes: "", timestamp: "2026-08-02T06:02:00.000Z" },
    { rater: NAMES.overrideRaw, rated: NAMES.cjk, notes: "", timestamp: "2026-08-02T06:01:00.000Z" },
    { rater: NAMES.cyrillic, rated: NAMES.asciiEscape, notes: "", timestamp: "2026-08-02T06:00:00.000Z" },
    // As two live rows are: the letters stored raw as the rater, the escaped record as the rated.
    { rater: "蛇火心", rated: NAMES.cjk, notes: "", timestamp: "2026-08-02T05:59:00.000Z" }
  ].map((row) => ({ competence: 6, honesty: 7, presence: 8, care: 5, ...row }))
};
const HOSTILE_MATCHES = {
  pairs: [
    { a: NAMES.cjk, b: "sinovai", score: 8, why: `both profiles declare knowledge of doors; ${NAMES.cjk} declares a need for readers; sinovai declares that capability.` },
    { a: NAMES.asciiEscape, b: NAMES.cyrillic, score: 5, why: `${NAMES.asciiEscape} declares a need for readers; ${NAMES.cyrillic} declares that capability.` },
    { a: NAMES.overrideRaw, b: NAMES.headingFromLetters, score: 2, why: `${NAMES.overrideRaw} declares a need for readers.` }
  ]
};

function hostileRoutes(url) {
  const table = {
    "/agents": HOSTILE_ROSTER, "/interactions": HOSTILE_INTERACTIONS, "/matches": HOSTILE_MATCHES, "/rooms": PLAIN_ROOMS, "/dates": PLAIN_DATES,
    "/agents/opal/trust": { score: 7.9, raters: 7, breakdown: { competence: 8, honesty: 8, presence: 7, care: 8 } }
  };
  assert.ok(Object.hasOwn(table, url), "an expected read: " + url);
  return reply(200, table[url]);
}

const CYRILLIC_SHOWN = cp(0x455) + "inovai";
const bdi = (text) => ({ tag: "BDI", cls: "n", nodes: [text] });
const st = (storedShown) => ({ tag: "SPAN", cls: "st", nodes: [" (stored as ", { tag: "BDI", nodes: [storedShown] }, ")"] });
const ST_ONE_CODE = { tag: "SPAN", cls: "st", nodes: [" (1 character shown as a code in square brackets)"] };
const UNLINKED = "not linked: this stored name is not a usable address";

test("/arena cards: each name in its own element, the stored form after a read name, and one card that reads sinovai", async () => {
  const a = runArena(ARENA_CLIENT, hostileRoutes);
  await settle();
  const cards = a.cards().map((card) => ({ tag: card.tagName, href: card.href, name: shape(card.children[0]), lines: card.children.slice(1).map((line) => [line.className, line.textContent]) }));
  assert.deepEqual(cards, [
    { tag: "A", href: "/guests/%73inovai", name: { tag: "DIV", cls: "nm", nodes: [bdi("%73inovai")] }, lines: [["kd", "agent"], ["met", "words as declared"], ["met", "declares: live"]] },
    { tag: "A", href: "/guests/%D1%95inovai", name: { tag: "DIV", cls: "nm", nodes: [bdi(CYRILLIC_SHOWN), st("%D1%95inovai")] }, lines: [["kd", "agent"], ["met", "words as declared"], ["met", "declares: live"]] },
    { tag: "A", href: "/guests/%E2%80%AEnialp", name: { tag: "DIV", cls: "nm", nodes: [bdi("%E2%80%AEnialp")] }, lines: [["kd", "agent"], ["met", "words as declared"]] },
    { tag: "A", href: "/guests/" + NAMES.cjk, name: { tag: "DIV", cls: "nm", nodes: [bdi("蛇火心"), st(NAMES.cjk)] }, lines: [["kd", "agent"], ["met", "words as declared"], ["met", "declares: live"]] },
    { tag: "A", href: "/guests/" + NAMES.headingFromLetters, name: { tag: "DIV", cls: "nm", nodes: [bdi(HEADING_FROM_LETTERS), st(NAMES.headingFromLetters)] }, lines: [["kd", "agent"], ["met", "no readable words"]] },
    { tag: "A", href: "/guests/" + NAMES.headingEscaped, name: { tag: "DIV", cls: "nm", nodes: [bdi(NAMES.headingEscaped)] }, lines: [["kd", "agent"], ["met", "no readable words"]] },
    { tag: "A", href: "/guests/sinovai", name: { tag: "DIV", cls: "nm", nodes: [bdi("sinovai")] }, lines: [["kd", "agent"], ["met", "words as declared"], ["met", "declares: " + FRESHNESS_THAT_COPIES_THE_HOUSE]] },
    { tag: "DIV", href: undefined, name: { tag: "DIV", cls: "nm", nodes: [bdi("[U+202E]nialp"), ST_ONE_CODE] }, lines: [["kd", "agent"], ["met", "no readable words"], ["met", UNLINKED]] }
  ]);
  // What a person reads as each card's name line.
  assert.deepEqual(a.cards().map((card) => card.children[0].textContent), [
    "%73inovai",
    CYRILLIC_SHOWN + " (stored as %D1%95inovai)",
    "%E2%80%AEnialp",
    "蛇火心 (stored as " + NAMES.cjk + ")",
    HEADING_FROM_LETTERS + " (stored as " + NAMES.headingFromLetters + ")",
    NAMES.headingEscaped,
    "sinovai",
    "[U+202E]nialp (1 character shown as a code in square brackets)"
  ]);
  assert.equal(a.names().filter((name) => name === "sinovai").length, 1, "one card reads sinovai");
  assert.equal(a.names().includes(HOUSE_HEADING), false, "no card reads as the house's heading");
  // The house's bracket is an element of the name line; a freshness that copies its words is in a line that begins "declares: ".
  const houseBrackets = a.cards().flatMap((card) => card.children.flatMap((line) => line.children.filter((node) => node.className === "st")));
  assert.equal(houseBrackets.length, 4);
  for (const bracket of houseBrackets) assert.equal(bracket.parentNode.className, "nm");
  assert.equal(UNSEEN.test(a.strings().join("")), false, "no control or direction character reaches the page");
  assert.deepEqual(a.forbidden, []);

  // The filter still finds a record by what is shown and by what is stored.
  a.search("蛇火");
  assert.deepEqual(a.visibleNames(), ["蛇火心"]);
  a.search("%e8%9b%87");
  assert.deepEqual(a.visibleNames(), ["蛇火心"]);
  a.search("sinovai");
  assert.deepEqual(a.visibleNames(), ["sinovai"], "neither lookalike holds these seven letters, shown or stored");
  a.search("inovai");
  assert.deepEqual(a.visibleNames(), ["%73inovai", CYRILLIC_SHOWN, "sinovai"]);
  a.search("%d1%95");
  assert.deepEqual(a.visibleNames(), [CYRILLIC_SHOWN]);
});

test("/arena rating rows: the link text is the name alone, the stored form follows it, and a reversed name cannot redraw the row", async () => {
  const a = runArena(ARENA_CLIENT, hostileRoutes);
  await settle();
  const arrow = { tag: "SPAN", cls: "arrow", nodes: ["→"] };
  const linked = (stored, shown) => ({ tag: "A", href: "/guests/" + stored, nodes: [bdi(shown)] });
  const unlinked = (shown) => ({ tag: "SPAN", nodes: [bdi(shown)] });
  assert.deepEqual(a.page.meets.children.map((row) => shape(row.children[0]).nodes), [
    [linked(NAMES.headingEscaped, NAMES.headingEscaped), arrow, linked("sinovai", "sinovai")],
    [linked(NAMES.headingFromLetters, HEADING_FROM_LETTERS), st(NAMES.headingFromLetters), arrow, linked("sinovai", "sinovai")],
    [linked(NAMES.overrideEscaped, "%E2%80%AEnialp"), arrow, linked("sinovai", "sinovai")],
    // In the roster, but not an address a browser keeps: no link.
    [unlinked("[U+202E]nialp"), ST_ONE_CODE, arrow, linked(NAMES.cjk, "蛇火心"), st(NAMES.cjk)],
    [linked(NAMES.cyrillic, CYRILLIC_SHOWN), st("%D1%95inovai"), arrow, linked(NAMES.asciiEscape, "%73inovai")],
    // Stored raw, so not in the roster and not linked; it reads the same as the record it rates, without the bracket.
    [unlinked("蛇火心"), arrow, linked(NAMES.cjk, "蛇火心"), st(NAMES.cjk)]
  ]);
  assert.deepEqual(a.page.meets.children.map((row) => row.children[0].textContent), [
    NAMES.headingEscaped + "→sinovai",
    HEADING_FROM_LETTERS + " (stored as " + NAMES.headingFromLetters + ")→sinovai",
    "%E2%80%AEnialp→sinovai",
    "[U+202E]nialp (1 character shown as a code in square brackets)→蛇火心 (stored as " + NAMES.cjk + ")",
    CYRILLIC_SHOWN + " (stored as %D1%95inovai)→%73inovai",
    "蛇火心→蛇火心 (stored as " + NAMES.cjk + ")"
  ]);
  // Every name in a row is inside a name element.
  for (const row of a.page.meets.children) assert.equal(nameElements(row.children[0]).length, 2);
  assert.equal(UNSEEN.test(a.page.meets.textContent), false);
  assert.deepEqual(a.forbidden, []);
});

test("/guests doors: the face and the spoken label carry the name alone; the label under the door carries the stored form, then what the record declares", async () => {
  const g = runGallery(pageScript(GUESTS_HTML), hostileRoutes);
  await settle();
  const doors = g.doors().map((cell) => {
    // A door with a link is hung inside it; a door with none is hung in the cell itself.
    const [first, caption] = cell.children;
    const frame = first.tagName === "A" ? first.children[0] : first;
    const face = frame.children[0].children.find((node) => node.className === "door-name");
    return { href: first.href, spoken: first.attributes["aria-label"], face: shape(face), caption: shape(caption).nodes, read: caption.textContent };
  });
  const face = (shown) => ({ tag: "H3", cls: "door-name", nodes: [bdi(shown)] });
  const b = (shown) => ({ tag: "B", nodes: [bdi(shown)] });
  const open = " — open this guest’s card";
  assert.deepEqual(doors, [
    { href: "/guests/%73inovai", spoken: "%73inovai" + open, face: face("%73inovai"), caption: [b("%73inovai"), " · declares: live"], read: "%73inovai · declares: live" },
    { href: "/guests/%D1%95inovai", spoken: CYRILLIC_SHOWN + open, face: face(CYRILLIC_SHOWN), caption: [b(CYRILLIC_SHOWN), st("%D1%95inovai"), " · declares: live"], read: CYRILLIC_SHOWN + " (stored as %D1%95inovai) · declares: live" },
    { href: "/guests/%E2%80%AEnialp", spoken: "%E2%80%AEnialp" + open, face: face("%E2%80%AEnialp"), caption: [b("%E2%80%AEnialp")], read: "%E2%80%AEnialp" },
    { href: "/guests/" + NAMES.cjk, spoken: "蛇火心" + open, face: face("蛇火心"), caption: [b("蛇火心"), st(NAMES.cjk), " · declares: live"], read: "蛇火心 (stored as " + NAMES.cjk + ") · declares: live" },
    { href: "/guests/" + NAMES.headingFromLetters, spoken: HEADING_FROM_LETTERS + open, face: face(HEADING_FROM_LETTERS), caption: [b(HEADING_FROM_LETTERS), st(NAMES.headingFromLetters)], read: HEADING_FROM_LETTERS + " (stored as " + NAMES.headingFromLetters + ")" },
    { href: "/guests/" + NAMES.headingEscaped, spoken: NAMES.headingEscaped + open, face: face(NAMES.headingEscaped), caption: [b(NAMES.headingEscaped)], read: NAMES.headingEscaped },
    // A freshness that copies the house's bracket stands after "declares: ", outside the name's bold.
    { href: "/guests/sinovai", spoken: "sinovai" + open, face: face("sinovai"), caption: [b("sinovai"), " · declares: " + FRESHNESS_THAT_COPIES_THE_HOUSE], read: "sinovai · declares: " + FRESHNESS_THAT_COPIES_THE_HOUSE },
    // Not an address a browser keeps as written: the door has no link and no spoken label, and the house says so last, in its own element.
    {
      href: undefined, spoken: undefined, face: face("[U+202E]nialp"),
      caption: [b("[U+202E]nialp"), ST_ONE_CODE, { tag: "DIV", nodes: [UNLINKED] }],
      read: "[U+202E]nialp (1 character shown as a code in square brackets)" + UNLINKED
    }
  ]);
  assert.equal(doors.filter((door) => door.face.nodes[0].nodes[0] === "sinovai").length, 1, "one door reads sinovai");
  for (const door of doors) assert.equal(UNSEEN.test(door.read + door.spoken + JSON.stringify(door.face)), false);
  assert.deepEqual(g.forbidden, []);
});

test("/ledger rows: each name in its own element, with the stored form after a read name", async () => {
  const l = runLedger(pageScript(LEDGER_HTML), hostileRoutes);
  await settle();
  assert.deepEqual(l.calls, ["/interactions"]);
  const who = l.rows().map((row) => row.children[0].children.find((node) => node.className === "who"));
  assert.deepEqual(who.map((node) => shape(node).nodes), [
    [bdi(NAMES.headingEscaped), " → ", bdi("sinovai")],
    [bdi(HEADING_FROM_LETTERS), st(NAMES.headingFromLetters), " → ", bdi("sinovai")],
    [bdi("%E2%80%AEnialp"), " → ", bdi("sinovai")],
    [bdi("[U+202E]nialp"), ST_ONE_CODE, " → ", bdi("蛇火心"), st(NAMES.cjk)],
    [bdi(CYRILLIC_SHOWN), st("%D1%95inovai"), " → ", bdi("%73inovai")],
    [bdi("蛇火心"), " → ", bdi("蛇火心"), st(NAMES.cjk)]
  ]);
  assert.deepEqual(who.map((node) => node.textContent), [
    NAMES.headingEscaped + " → sinovai",
    HEADING_FROM_LETTERS + " (stored as " + NAMES.headingFromLetters + ") → sinovai",
    "%E2%80%AEnialp → sinovai",
    "[U+202E]nialp (1 character shown as a code in square brackets) → 蛇火心 (stored as " + NAMES.cjk + ")",
    CYRILLIC_SHOWN + " (stored as %D1%95inovai) → %73inovai",
    "蛇火心 → 蛇火心 (stored as " + NAMES.cjk + ")"
  ]);
  assert.equal(l.page.count.textContent, "6 retained ratings · live · /interactions · counted just now");
  assert.equal(UNSEEN.test(l.page.rows.textContent), false);
  // The strict stand-in DOM: no setAttribute, classList, style or markup setter was reached.
  assert.deepEqual(l.forbidden, []);
});

test("/hearts pairs: each name in its own element with the stored form after a read name; the reason sentence is read by the same rule", async () => {
  const h = runHearts(pageScript(HEARTS_HTML), hostileRoutes);
  await settle();
  const pairs = h.pairs().map((frame) => {
    const [, names, why] = frame.children;
    return { names: shape(names).nodes, read: names.textContent, why: why.textContent };
  });
  const x = { tag: "SPAN", cls: "pair-x", nodes: [" × "] };
  const plain = (shown) => ({ tag: "SPAN", nodes: [bdi(shown)] });
  const zh = (shown) => ({ tag: "SPAN", cls: "zh", attrs: { lang: "zh" }, nodes: [bdi(shown)] });
  assert.deepEqual(pairs, [
    {
      names: [zh("蛇火心"), st(NAMES.cjk), x, plain("sinovai")],
      read: "蛇火心 (stored as " + NAMES.cjk + ") × sinovai",
      why: "both profiles declare knowledge of doors; 蛇火心 declares a need for readers; sinovai declares that capability."
    },
    {
      names: [plain("%73inovai"), x, plain(CYRILLIC_SHOWN), st("%D1%95inovai")],
      read: "%73inovai × " + CYRILLIC_SHOWN + " (stored as %D1%95inovai)",
      // The sentence carries no stored form; the names line above it does.
      why: "%73inovai declares a need for readers; " + CYRILLIC_SHOWN + " declares that capability."
    },
    {
      names: [plain("[U+202E]nialp"), ST_ONE_CODE, x, plain(HEADING_FROM_LETTERS), st(NAMES.headingFromLetters)],
      read: "[U+202E]nialp (1 character shown as a code in square brackets) × " + HEADING_FROM_LETTERS + " (stored as " + NAMES.headingFromLetters + ")",
      why: "[U+202E]nialp declares a need for readers."
    }
  ]);
  assert.equal(UNSEEN.test(h.page.pairWall.textContent), false);
  assert.deepEqual(h.forbidden, []);
});

// =====================================================================
// what the pages say about the rule, and how a name element is drawn
// =====================================================================

const ARENA_NAME_RULES = "/* names: one element each (src/names.js) */\n" + NAME_STYLE + "\n.st{font-family:var(--mono);font-size:.64rem;color:var(--ink2)}\n.seam .who a .n{text-decoration:inherit}\n";
const ARENA_RULE_PARAGRAPH = `  <p class="lede">${NAME_RULE_TEXT}</p>\n`;
const GUESTS_NAME_RULES = "/* ---- names: one element each (src/names.js) ---- */\n" + NAME_STYLE + "\n";
const GUESTS_DOOR_SENTENCE = "A door opens onto that guest's card when its stored name is a usable address.";
const GUESTS_RULE_PARAGRAPH = `    <p class="glyphs rise">${NAME_RULE_TEXT} On this wall the brackets are in the label under each door.</p>\n`;
const LEDGER_NAME_RULES = "/* ---- names: one element each (src/names.js) ---- */\n" + NAME_STYLE + "\n.lr-head .st{color:var(--dim);font-weight:400}\n";
const HEARTS_NAME_RULES = "/* ---- names: one element each (src/names.js) ---- */\n" + NAME_STYLE + "\n.pair-names .st{font-family:var(--mono);font-size:.66rem;font-weight:400;color:var(--dim)}\n";
const CARD_NAME_RULES = NAME_STYLE + "\n.src{overflow-wrap:anywhere}\n";

async function servedArena() {
  return (await worker.fetch(new Request("https://sinovai.com/arena", { headers: { Accept: "text/html" } }), noEffects, noEffects)).text();
}

test("the rule is stated once on /arena and once on /guests, in the house's words, and says what it does not stop", async () => {
  assert.equal(NAME_RULE_TEXT,
    "A name is shown as stored, with two exceptions. A percent code in capitals for one letter, accent or digit outside plain ASCII is shown as that character, and the stored form follows the name in round brackets. " +
    "A control, line-separator or direction character is shown as its code in square brackets, and the round brackets give the count. A space or sign sent as a percent code stays a code. " +
    "On this page the words “stored as” are the house's only inside those round brackets; a kind, a freshness line or a rating note is its sender's text. " +
    "Different stored names can look alike; the stored name is the exact one.");
  assert.doesNotMatch(NAME_RULE_TEXT, /[<>&"]/, "it goes into a page as it is");
  assert.doesNotMatch(NAME_RULE_TEXT, /cannot be (?:borrowed|copied|imitated)|\bverified\b|\bproves?\b|\bsafe\b|\bfake\b|\bforged?\b|\bspoof/i);

  const arena = await servedArena();
  assert.equal(arena.split(NAME_RULE_TEXT).length - 1, 1);
  assert.ok(arena.includes(ARENA_RULE_PARAGRAPH));
  assert.ok(arena.indexOf(ARENA_RULE_PARAGRAPH) < arena.indexOf('<div class="tools">'), "above the list it is about");
  assert.ok(arena.indexOf(ARENA_RULE_PARAGRAPH) > arena.indexOf('<section id="gather">'));

  assert.equal(GUESTS_HTML.split(NAME_RULE_TEXT).length - 1, 1);
  assert.ok(GUESTS_HTML.includes(GUESTS_RULE_PARAGRAPH));
  // /ledger and /hearts show the stored form without stating the rule; the README quotes it as the pages state it.
  assert.equal(LEDGER_HTML.includes(NAME_RULE_TEXT) || HEARTS_HTML.includes(NAME_RULE_TEXT), false);
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const quoted = readme.split("\n").filter((line) => line.startsWith("> ")).map((line) => line.slice(2)).join(" ");
  assert.ok(quoted.includes(NAME_RULE_TEXT), "the README quotes the rule word for word");
  assert.ok(GUESTS_HTML.indexOf(GUESTS_RULE_PARAGRAPH) < GUESTS_HTML.indexOf('<div class="wall" id="wall0">'), "above the first stretch of wall");

  // Each sentence of the rule is something the code does.
  const browser = browserSide();
  for (const view of [nameView, browser.view]) {
    assert.equal(view("plain").shown, "plain");
    assert.equal(view("%E8%B3%93").shown, "賓");
    assert.equal(view("%e8%b3%93").shown, "%e8%b3%93", "in capitals only");
    assert.equal(view("a%20b%3Ac%2Cd%E2%80%99").shown, "a%20b%3Ac%2Cd%E2%80%99", "a space or sign stays a code");
    // One of each kind the sentence names: a control, a line separator, a direction character.
    assert.equal(view("a\u0007b\u2028c\u202E").shown, "a[U+0007]b[U+2028]c[U+202E]");
  }
  assert.equal(browser.globals.storedNode(browser.globals.nameView("a\u0007b\u2028c\u202E")).textContent, " (3 characters shown as codes in square brackets)");
  // The sentence names every kind of character the rule shows as a code: nothing outside these three is coded.
  const kinds = /^[\p{Cc}\u2028\u2029\p{Bidi_Control}]$/u;
  for (let point = 0; point <= 0x10FFFF; point++) {
    if (point >= 0xD800 && point <= 0xDFFF) continue;
    if (nameView(cp(point)).coded === 1) assert.ok(kinds.test(cp(point)), "coded, and not a control, line-separator or direction character: U+" + point.toString(16));
  }
});

test("a name element is drawn the same way on all five pages: direction kept inside it, long names wrapped, marks held to its own box", async () => {
  assert.equal(NAME_STYLE, "bdi{overflow-wrap:anywhere}\nbdi.n{display:inline-block;max-width:100%;overflow:hidden;vertical-align:bottom;padding:.3em 0;margin:-.3em 0}");
  const styleOf = (html) => [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((match) => match[1]).join("\n");
  const plain = await card(plainCardStore(), PLAIN_CARD_PATH);
  const pages = {
    "/arena": [styleOf(await servedArena()), ARENA_NAME_RULES],
    "/guests": [styleOf(GUESTS_HTML), GUESTS_NAME_RULES],
    "/ledger": [styleOf(LEDGER_HTML), LEDGER_NAME_RULES],
    "/hearts": [styleOf(HEARTS_HTML), HEARTS_NAME_RULES],
    "a guest card": [styleOf(plain), CARD_NAME_RULES]
  };
  for (const [page, [style, rules]] of Object.entries(pages)) {
    assert.equal(style.split(rules).length - 1, 1, page + " carries the name rules once");
    assert.equal(style.split("bdi").length - 1, 2, page + " has no other rule for the element");
    // The stored form is quieter than the name: smaller or dimmer ink, and no opacity.
    assert.doesNotMatch(rules, /opacity|font-weight:(?:[5-9]00|bold)|text-transform/, page);
  }
  // The house's own card shows no stored name and keeps its style.
  const house = await (await worker.fetch(new Request("https://sinovai.com/house", { headers: { Accept: "text/html" } }), noEffects, noEffects)).text();
  assert.equal(house.includes("bdi"), false);
});

// =====================================================================
// a record whose stored and shown names are equal: the pages are what they
// were, apart from what is listed in each test
// =====================================================================

// sha256 digests taken from the tree at 90e26c9, before the name rule, with the
// plain fixtures in test/name-fixtures.mjs and the stand-in DOM in
// test/page-stand-in.mjs: "card" is the page GET /guests/sol returned, "static"
// is each list page with its script emptied, and "built" is the JSON of what
// each page script built (shapesWithoutNameElements, with the date elements
// replaced as below). Each test takes the listed changes away from what the
// pages give now and requires the digest of what is left to be the one taken
// then. A later change made to one of these pages on purpose belongs in the
// list of the test it breaks, as one more line that takes it away.
const BEFORE = {
  card: "c26222d5ee9a3bd187419a6c9c124b8a1bcdbf458cb199f2f55ca93035e7653b",
  static: {
    "/arena": "9e59f80901ac85d871aa1309d49116d6f7320e862ccbe6178e515465cb55239f",
    "/guests": "41d4a957e6a6438b75cb242b6407122e09b3f3bfaa1deede0e6001c5b509c11e",
    "/ledger": "e8b857d6dde4b6553a2a4a44c754f86d97d8b9b6c2bd401a3fdd58eef8192ddc",
    "/hearts": "428d71466124db70ee4d503372ba4ca2f79f4435228362bc310d48f5e1160d2f"
  },
  built: {
    "/arena": "284d33bc4acb89554779b91b5acb3c43542a4377c5e57a6c7cca334db9ac2723",
    "/guests": "45d07f7453b03b4b2e5c7784998214b53dc859609dac80e24bffad1ba7a90c6b",
    "/ledger": "9bf61a931f9b2ce5f7cd768e6f7a4a279122eb102db33842bca7090bc85a0781",
    "/hearts": "30064fa60d29470633f91c9a3886dc1087bebe4b633af3319feee9e3424a689b"
  }
};

// Takes one exact piece of text out of a page, and fails if it is not there exactly `times` times.
function without(text, piece, times, label) {
  assert.equal(text.split(piece).length - 1, times, label);
  return text.split(piece).join("");
}

test("a guest card for plain names is the card as it was, apart from seven listed changes", async () => {
  let html = await card(plainCardStore(), PLAIN_CARD_PATH);
  // 1. The name rules in the style.
  html = without(html, CARD_NAME_RULES, 1, "the name rules");
  // 2. The heading's name is in its own element.
  assert.equal(html.split('<h1><bdi class="n">sol</bdi></h1>').length - 1, 1);
  html = html.replace('<h1><bdi class="n">sol</bdi></h1>', "<h1>sol</h1>");
  // 3. One line under the account sent under the house's name.
  html = without(html, `<p class="quiet">${HOUSE_NAME_ACCOUNT_LINE}</p>`, 1, "the line under an account sent under the house's name");
  // 4. Each account begins with the house's words and the name in its own element; it began with the name in bold.
  // 5. An unsigned account says no claim token was checked; it said nothing.
  // 6. A rating with no date on file reads "date not recorded"; the words were cut to "date not r".
  let heads = 0;
  let undated = 0;
  html = html.replace(/<p><span class="quiet">sent under the name<\/span> <bdi class="n">([^<]*)<\/bdi> <span class="quiet">(· [^·<]*) · (sent with the rater name's claim token|no claim token was checked for this name)<\/span><\/p>/g, (_head, name, date, token) => {
    heads++;
    if (date === "· date not recorded") { undated++; date = "· date not r"; }
    return `<p><b>${name}</b> <span class="quiet">${date}${token.startsWith("sent with") ? " · " + token : ""}</span></p>`;
  });
  assert.equal(heads, 4);
  assert.equal(undated, 1);
  // 7. A line feed of the house's follows the start tag of the box that holds the text as received
  //    (src/pages/guest-card.js, receivedBox): an HTML parser drops one line feed there.
  assert.equal(html.split("<pre>").length - 1, 1);
  assert.equal(html.split("<pre>\n").length - 1, 1);
  html = html.replace("<pre>\n", "<pre>");
  assert.equal(sha256(html), BEFORE.card);
});

test("the four list pages' markup and style are what they were, apart from the name rules, the two paragraphs that state the rule, and one sentence about doors", async () => {
  const still = (html) => { const script = pageScript(html); return html.replace("<script>" + script + "</script>", () => "<script></script>"); };
  let arena = still(await servedArena());
  arena = without(arena, ARENA_NAME_RULES, 1, "/arena name rules");
  arena = without(arena, ARENA_RULE_PARAGRAPH, 1, "/arena rule paragraph");
  assert.equal(sha256(arena), BEFORE.static["/arena"]);

  let guests = still(GUESTS_HTML);
  guests = without(guests, GUESTS_NAME_RULES, 1, "/guests name rules");
  guests = without(guests, GUESTS_RULE_PARAGRAPH, 1, "/guests rule paragraph");
  // A door is a link only when its stored name is a usable address; the page said every door opens.
  assert.equal(guests.split(GUESTS_DOOR_SENTENCE).length - 1, 1, "/guests door sentence");
  guests = guests.replace(GUESTS_DOOR_SENTENCE, "Every door opens onto that guest's card.");
  assert.equal(sha256(guests), BEFORE.static["/guests"]);

  assert.equal(sha256(without(still(LEDGER_HTML), LEDGER_NAME_RULES, 1, "/ledger name rules")), BEFORE.static["/ledger"]);
  assert.equal(sha256(without(still(HEARTS_HTML), HEARTS_NAME_RULES, 1, "/hearts name rules")), BEFORE.static["/hearts"]);
});

test("for plain names the four list pages build what they built before, apart from the name element and the gallery's word \"declares\"", async () => {
  const routes = (url) => {
    const table = {
      "/agents": PLAIN_PAGES[0], "/agents?cursor=page-2": PLAIN_PAGES[1], "/interactions": PLAIN_INTERACTIONS,
      "/rooms": PLAIN_ROOMS, "/matches": PLAIN_MATCHES, "/dates": PLAIN_DATES,
      "/agents/opal/trust": { score: 7.9, raters: 7, breakdown: { competence: 8, honesty: 8, presence: 7, care: 8 } }
    };
    assert.ok(Object.hasOwn(table, url), "an expected read: " + url);
    return reply(200, table[url]);
  };
  const pages = {
    "/arena": runArena(ARENA_CLIENT, routes),
    "/guests": runGallery(pageScript(GUESTS_HTML), routes),
    "/ledger": runLedger(pageScript(LEDGER_HTML), routes),
    "/hearts": runHearts(pageScript(HEARTS_HTML), routes)
  };
  await settle();
  await settle();
  for (const [path, page] of Object.entries(pages)) {
    // Every name on the page is in a name element now; before, each was a bare text.
    assert.ok(Object.values(page.page).flatMap((node) => nameElements(node)).length >= 4, path + " shows names");
    const shapes = page.shapesWithoutNameElements();
    for (const id of ["asof", "statusDate"]) if (shapes[id]) shapes[id] = "(today's date)";
    let text = JSON.stringify(shapes);
    if (path === "/guests") {
      // The label under a door now says "declares: " before the record's freshness text.
      assert.equal(text.split('" · declares: ').length - 1, 5);
      text = text.replaceAll('" · declares: ', '" · ');
    }
    assert.equal(sha256(text), BEFORE.built[path], path);
    assert.deepEqual(page.forbidden, [], path);
    // No plain name gained a bracket.
    assert.equal(page.classNames.has("st"), false, path);
    assert.equal(page.strings().join("\n").includes("stored as"), false, path);
  }
});

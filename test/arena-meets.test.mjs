// The /arena guest list: the records GET /agents returned, in the order
// received, with no score. These tests run the page's literal browser program
// in a small stand-in DOM whose innerHTML setter throws.
//
// What they do not establish: how a real browser lays the page out, what a
// deployed Worker serves, or whether any record is true or was written by the
// name it carries.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import vm from "node:vm";

import worker from "../src/worker.js";
import { ARENA_CLIENT } from "../src/pages/arena-client.js";
import { GUESTS_HTML } from "../src/pages/guests.js";
import { ROOM_CREATION_CLIENT } from "../src/pages/room-creation.js";
import { ROSTER_READER } from "../src/pages/roster-reader.js";
import { SCORES_STILL_PUBLISHED } from "../src/ranking-disclosure.js";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const NOT_JSON = Symbol("a body that is not JSON");

function reply(status, body) {
  return Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    async json() {
      if (body === NOT_JSON) throw new SyntaxError("Unexpected token < in JSON");
      return JSON.parse(JSON.stringify(body));
    }
  });
}

// ---- a stand-in DOM: text nodes and elements, nothing that parses markup ----
function makeDom(ids, { strict }) {
  const forbidden = [];
  const classNames = new Set();
  function forbid(name) {
    forbidden.push(name);
    throw new Error("Forbidden client effect: " + name);
  }
  function textNode(text) {
    return { nodeType: 3, textContent: String(text) };
  }
  function element(tag) {
    let nodes = [];
    let className = "";
    let href;
    const attributes = {};
    const listeners = new Map();
    const node = {
      nodeType: 1,
      tagName: String(tag).toUpperCase(),
      hidden: false,
      value: "",
      get childNodes() { return nodes; },
      get children() { return nodes.filter((child) => child.nodeType === 1); },
      get className() { return className; },
      set className(value) { className = String(value); for (const name of className.split(/\s+/).filter(Boolean)) classNames.add(name); },
      get textContent() { return nodes.map((child) => child.textContent).join(""); },
      set textContent(value) { nodes = String(value) === "" ? [] : [textNode(value)]; },
      get href() { return href; },
      set href(value) { href = String(value); },
      get attributes() { return attributes; },
      appendChild(child) { nodes.push(child); child.parentNode = node; return child; },
      removeChild(child) { nodes = nodes.filter((other) => other !== child); return child; },
      addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(listener);
      },
      fire(type) { for (const listener of listeners.get(type) || []) listener({ preventDefault() {} }); },
      get innerHTML() { return forbid("innerHTML"); },
      set innerHTML(_value) { forbid("innerHTML"); },
      get outerHTML() { return forbid("outerHTML"); },
      set outerHTML(_value) { forbid("outerHTML"); },
      insertAdjacentHTML() { forbid("insertAdjacentHTML"); },
      get style() { return forbid("style"); },
      setAttribute(name, value) {
        if (strict) forbid("setAttribute");
        attributes[name] = String(value);
      },
      get classList() {
        if (strict) return forbid("classList");
        return { add(name) { className = (className + " " + name).trim(); } };
      }
    };
    return node;
  }
  const byId = Object.fromEntries(ids.map((id) => [id, element("div")]));
  const document = {
    createElement(tag) { return element(tag); },
    createTextNode(text) { return textNode(text); },
    getElementById(id) {
      assert.ok(Object.hasOwn(byId, id), "the page has an element with this id: " + id);
      return byId[id];
    },
    querySelectorAll() { return []; },
    write() { forbid("document.write"); }
  };
  return { document, byId, forbidden, classNames, forbid };
}

function guardGlobals(globals, forbid) {
  for (const name of ["localStorage", "sessionStorage", "console", "navigator", "location", "setTimeout", "setInterval", "WebSocket", "XMLHttpRequest", "eval"]) {
    if (Object.hasOwn(globals, name)) continue; // a test that supplies its own stand-in
    Object.defineProperty(globals, name, { get() { return forbid(name); } });
  }
  return globals;
}

// Stand-ins for the page-read time limit: timers that run only when the test
// fires them, and an AbortController whose signal a pending fetch can watch.
function fakeClock() {
  const timers = new Map();
  let next = 1;
  class AbortController {
    constructor() {
      const listeners = [];
      this.signal = { aborted: false, addEventListener(_type, listener) { listeners.push(listener); } };
      this.abort = () => { if (this.signal.aborted) return; this.signal.aborted = true; for (const listener of listeners) listener(); };
    }
  }
  return {
    timers,
    globals: {
      AbortController,
      setTimeout(callback, ms) { const id = next++; timers.set(id, { callback, ms }); return id; },
      clearTimeout(id) { timers.delete(id); }
    },
    fireAll() { for (const [id, timer] of [...timers]) { timers.delete(id); timer.callback(); } }
  };
}
// A page that never answers, unless the read is aborted.
function hangs(options) {
  return new Promise((_resolve, reject) => {
    options?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
  });
}

async function settle() {
  for (let round = 0; round < 5; round++) await setImmediate();
}

// Every text, class, link and hidden flag under a node, in document order.
function shape(node) {
  if (node.nodeType === 3) return node.textContent;
  const out = { tag: node.tagName };
  if (node.className) out.cls = node.className;
  if (node.href !== undefined) out.href = node.href;
  if (node.hidden) out.hidden = true;
  out.nodes = node.childNodes.map(shape);
  return out;
}

function everyString(node, found = []) {
  if (node.nodeType === 3) { found.push(node.textContent); return found; }
  found.push(node.className);
  if (node.href !== undefined) found.push(node.href);
  for (const child of node.childNodes) everyString(child, found);
  return found;
}

function arena(routes, { wrap = (program) => program, clock = null } = {}) {
  const dom = makeDom(["agents", "agN", "livecount", "q", "meets", "rooms"], { strict: true });
  const calls = [];
  const globals = guardGlobals({
    ...(clock ? clock.globals : {}),
    document: dom.document,
    fetch(url, options) {
      calls.push(String(url));
      assert.ok(!options?.method || options.method === "GET", "the arena program only reads");
      assert.equal(options?.body, undefined, "the arena program sends no body");
      return routes(String(url), options);
    }
  }, dom.forbid);
  vm.runInNewContext(wrap(ARENA_CLIENT), globals, { timeout: 1000, filename: "arena-client.js" });
  const page = dom.byId;
  return {
    page, calls, forbidden: dom.forbidden, classNames: dom.classNames, globals,
    cards() { return page.agents.children.filter((node) => /\bmind\b/.test(node.className)); },
    names() { return this.cards().map((card) => card.children[0].textContent); },
    visibleNames() { return this.cards().filter((card) => !card.hidden).map((card) => card.children[0].textContent); },
    search(value) { page.q.value = value; page.q.fire("input"); },
    strings() { return Object.values(page).flatMap((node) => everyString(node)); },
    shapes() { return Object.fromEntries(Object.entries(page).map(([id, node]) => [id, shape(node)])); }
  };
}

// ---- one synthetic roster, three pages; later records carry larger scores ----
const HOSTILE_NAME = "<img src=x onerror=alert(1)>";
const HOSTILE_KIND = "</script><script>alert(1)</script>";
const HOSTILE_FRESHNESS = "\" onmouseover=\"alert(1)";
const HOSTILE_NOTE = "<script>alert(1)</script>&amp;";
const PAGES = [
  {
    agents: [
      { name: "zeta", kind: "agent", words: "declared", trust_score: 1.37, interaction_count: 143, freshness: "live" },
      { name: "%E8%B3%93", kind: "unknown", words: "reconstructed", reconstructed_kind: "project", trust_score: 0, interaction_count: 0, freshness: "unknown" }
    ],
    list_complete: false,
    next_cursor: "page 2/&"
  },
  {
    agents: [
      { name: "Alpha", kind: "library", words: "flattened", trust_score: 9.73, interaction_count: 187, freshness: "rebuilt whenever the book grows" },
      { name: HOSTILE_NAME, kind: HOSTILE_KIND, words: "none", trust_score: 5.55, interaction_count: 111, freshness: HOSTILE_FRESHNESS }
    ],
    list_complete: false,
    next_cursor: "page-3"
  },
  {
    agents: [
      { name: "mid", kind: "unknown", words: "declared", trust_score: 9.99, interaction_count: 199, freshness: "unknown" },
      { kind: "agent", words: "constructor", trust_score: 8.88, interaction_count: 177 }
    ],
    list_complete: true,
    next_cursor: null
  }
];
const UNLINKED = "not linked: this stored name is not a usable address";
const RECEIVED_ORDER = ["zeta", "賓", "Alpha", HOSTILE_NAME, "mid", "(record with no name field)"];
const SCORE_STRINGS = ["1.37", "143", "9.73", "187", "5.55", "111", "9.99", "199", "8.88", "177", "6.61", "7.72", "8.83", "4.94", "3.31", "2.27"];
const INTERACTIONS = {
  interactions: [
    { rater: "zeta", rated: "Alpha", competence: 6.61, honesty: 7.72, presence: 8.83, care: 4.94, notes: "met at the door", timestamp: "2026-08-02T06:04:00.000Z" },
    { rater: "ghost", rated: "%E8%B3%93", competence: 3.31, honesty: 2.27, presence: 6.61, care: 7.72, notes: "", timestamp: "" },
    { rater: "<b>x</b>", rated: "mid", competence: 3.31, honesty: 3.31, presence: 3.31, care: 3.31, notes: HOSTILE_NOTE, timestamp: "<i>when</i>" }
  ]
};
const ROOMS = {
  rooms: [
    { id: "aaaaaaaa", name: "commons", members: ["zeta", "mid"], status: "open" },
    { id: "bbbbbbbb", private: true, members: 1, status: "open" },
    { id: "<svg onload=alert(1)>", members: [], status: "<b>shut</b>" }
  ]
};

function routesFor(pages, { interactions = INTERACTIONS, rooms = ROOMS } = {}) {
  const byUrl = new Map([["/agents", pages[0]]]);
  for (let index = 0; index + 1 < pages.length; index++) {
    byUrl.set("/agents?cursor=" + encodeURIComponent(pages[index].next_cursor), pages[index + 1]);
  }
  return (url) => {
    if (url === "/interactions") return typeof interactions === "function" ? interactions() : reply(200, interactions);
    if (url === "/rooms") return typeof rooms === "function" ? rooms() : reply(200, rooms);
    assert.ok(byUrl.has(url), "an expected read: " + url);
    const page = byUrl.get(url);
    return typeof page === "function" ? page() : reply(200, page);
  };
}

// ---- the shared reader ----
async function readWith(routes, { clock = null, during = null } = {}) {
  const calls = [];
  const globals = guardGlobals({
    ...(clock ? clock.globals : {}),
    fetch(url, options) {
      calls.push(String(url));
      assert.deepEqual({ ...options.headers }, { Accept: "application/json" });
      return routes(String(url), options);
    }
  }, (name) => { throw new Error("Forbidden reader effect: " + name); });
  vm.runInNewContext(ROSTER_READER, globals, { timeout: 1000, filename: "roster-reader.js" });
  const reading = globals.readRoster(null, [], 1);
  if (during) await during();
  const result = await reading;
  return { result: JSON.parse(JSON.stringify(result)), calls, decRuns: globals.decRuns };
}

test("the reader walks every page in the order received and follows the cursor it was given", async () => {
  const { result, calls } = await readWith(routesFor(PAGES));
  assert.deepEqual(calls, ["/agents", "/agents?cursor=page%202%2F%26", "/agents?cursor=page-3"]);
  assert.deepEqual(result.list, PAGES.flatMap((page) => page.agents));
  assert.equal(result.complete, true);
  assert.equal(result.reason, null);
  assert.equal(result.pages, 3);
});

test("the reader reports complete only when the last page held an agents array and list_complete === true", async (t) => {
  const one = PAGES[0].agents;
  const cases = [
    ["one complete page", [{ agents: one, list_complete: true, next_cursor: null }], { complete: true, reason: null, pages: 1, count: 2 }],
    ["first page does not load", [() => Promise.reject(new Error("offline"))], { complete: false, reason: "page_failed", pages: 0, failedAt: 1, count: 0 }],
    ["first page answers 500", [() => reply(500, { agents: one, list_complete: true })], { complete: false, reason: "page_failed", pages: 0, failedAt: 1, count: 0 }],
    ["a later page does not load", [PAGES[0], () => Promise.reject(new Error("offline"))], { complete: false, reason: "page_failed", pages: 1, failedAt: 2, count: 2 }],
    ["a later page answers 503", [PAGES[0], () => reply(503, {})], { complete: false, reason: "page_failed", pages: 1, failedAt: 2, count: 2 }],
    ["a page is not JSON", [PAGES[0], () => reply(200, NOT_JSON)], { complete: false, reason: "bad_body", pages: 1, failedAt: 2, count: 2 }],
    ["a page has no agents array, even if it says complete", [PAGES[0], { list_complete: true, next_cursor: null }], { complete: false, reason: "bad_body", pages: 1, failedAt: 2, count: 2 }],
    ["agents is not an array", [{ agents: { length: 2 }, list_complete: true }], { complete: false, reason: "bad_body", pages: 0, failedAt: 1, count: 0 }],
    ["a null body", [() => reply(200, null)], { complete: false, reason: "bad_body", pages: 0, failedAt: 1, count: 0 }],
    ["list_complete false and no cursor", [{ agents: one, list_complete: false, next_cursor: null }], { complete: false, reason: "no_cursor", pages: 1, count: 2 }],
    ["list_complete absent and no cursor", [{ agents: one }], { complete: false, reason: "no_cursor", pages: 1, count: 2 }],
    ["list_complete is the text \"true\"", [{ agents: one, list_complete: "true" }], { complete: false, reason: "no_cursor", pages: 1, count: 2 }],
    ["an empty cursor", [{ agents: one, list_complete: false, next_cursor: "" }], { complete: false, reason: "no_cursor", pages: 1, count: 2 }]
  ];
  for (const [label, pages, expected] of cases) {
    await t.test(label, async () => {
      const { result } = await readWith(routesFor(pages));
      assert.equal(result.complete, expected.complete);
      assert.equal(result.reason, expected.reason);
      assert.equal(result.pages, expected.pages);
      assert.equal(result.failedAt, expected.failedAt);
      assert.equal(result.list.length, expected.count);
    });
  }
});

test("the reader stops after 20 pages and says so", async () => {
  let served = 0;
  const { result, calls } = await readWith((url) => {
    served++;
    assert.ok(url === "/agents" || url.startsWith("/agents?cursor=more-"));
    return reply(200, { agents: [{ name: "record-" + served }], list_complete: false, next_cursor: "more-" + served });
  });
  assert.equal(calls.length, 20);
  assert.equal(result.complete, false);
  assert.equal(result.reason, "page_limit");
  assert.equal(result.pages, 20);
  assert.deepEqual(result.list.map((record) => record.name), Array.from({ length: 20 }, (_, index) => "record-" + (index + 1)));
});

test("a page whose headers arrive but whose body never finishes is given up as page_failed, not bad_body", async () => {
  // Reported at the final gate: the limit fired, but the reason said the body was not the expected JSON.
  const clock = fakeClock();
  const { result } = await readWith((url, options) => {
    if (url === "/agents") return reply(200, PAGES[0]);
    return Promise.resolve({ status: 200, ok: true, json: () => hangs(options) });
  }, {
    clock,
    during: async () => {
      await settle();
      assert.equal(clock.timers.size, 1);
      clock.fireAll();
    }
  });
  assert.equal(result.complete, false);
  assert.equal(result.reason, "page_failed");
  assert.equal(result.failedAt, 2);
  assert.deepEqual(result.list, PAGES[0].agents);
  assert.equal(clock.timers.size, 0);
});

test("a page that does not answer in time is given up as page_failed, and the records already read are kept", async () => {
  const clock = fakeClock();
  const { result, calls } = await readWith((url, options) => {
    if (url === "/agents") return reply(200, PAGES[0]);
    assert.ok(options.signal, "the read can be given up");
    return hangs(options);
  }, {
    clock,
    during: async () => {
      await settle();
      assert.equal(clock.timers.size, 1, "the first page's limit was cleared when it answered; the second page's is running");
      assert.deepEqual([...clock.timers.values()].map((timer) => timer.ms), [20000]);
      clock.fireAll();
    }
  });
  assert.deepEqual(calls, ["/agents", "/agents?cursor=page%202%2F%26"]);
  assert.equal(result.complete, false);
  assert.equal(result.reason, "page_failed");
  assert.equal(result.failedAt, 2);
  assert.equal(result.pages, 1);
  assert.deepEqual(result.list, PAGES[0].agents);
  assert.equal(clock.timers.size, 0);

  // A read that answers leaves no limit running.
  const quick = fakeClock();
  const whole = await readWith(routesFor(PAGES), { clock: quick });
  assert.equal(whole.result.complete, true);
  assert.equal(quick.timers.size, 0);
});

test("the reader decodes percent runs for display and leaves a broken run as it is", async () => {
  const { decRuns } = await readWith(routesFor([{ agents: [], list_complete: true }]));
  assert.equal(decRuns("%E8%B3%93"), "賓");
  assert.equal(decRuns("a%20b"), "a b");
  assert.equal(decRuns("%E8%B3"), "%E8%B3");
  assert.equal(decRuns("plain"), "plain");
});

// ---- the arena guest list ----
test("every record from every readable page appears, in the order received, although later records score higher", async () => {
  const a = arena(routesFor(PAGES));
  await settle();
  assert.deepEqual(a.names(), RECEIVED_ORDER);
  assert.equal(a.cards().length, PAGES.flatMap((page) => page.agents).length);
  const scores = PAGES.flatMap((page) => page.agents).map((record) => record.trust_score);
  assert.notDeepEqual(scores, scores.slice().sort((x, y) => y - x), "the fixture is not already in score order");
  assert.equal(a.page.agN.textContent, "6 records · the list reported complete");
  assert.equal(a.page.livecount.textContent, "6 records read · the list reported complete. Declarations and ratings are unverified.");
  assert.deepEqual(a.forbidden, []);
});

test("each card links to /guests/<name as stored> and carries kind, words and freshness as text", async () => {
  const a = arena(routesFor(PAGES));
  await settle();
  const cards = a.cards().map((card) => ({ tag: card.tagName, href: card.href, cls: card.className, lines: card.children.map((line) => [line.className, line.textContent]) }));
  assert.deepEqual(cards, [
    { tag: "A", href: "/guests/zeta", cls: "mind", lines: [["nm", "zeta"], ["kd", "agent"], ["met", "words as declared"], ["met", "declares: live"]] },
    { tag: "A", href: "/guests/%E8%B3%93", cls: "mind", lines: [["nm", "賓"], ["kd", "project (reconstructed)"], ["met", "words reconstructed from a card that lost its line breaks"]] },
    { tag: "A", href: "/guests/Alpha", cls: "mind", lines: [["nm", "Alpha"], ["kd", "library"], ["met", "one long line with no reading proposed"], ["met", "declares: rebuilt whenever the book grows"]] },
    // A stored name that is not a serialized path segment gets a card with no link.
    { tag: "DIV", href: undefined, cls: "mind", lines: [["nm", HOSTILE_NAME], ["kd", HOSTILE_KIND], ["met", "no readable words"], ["met", "declares: " + HOSTILE_FRESHNESS], ["met", UNLINKED]] },
    { tag: "A", href: "/guests/mid", cls: "mind", lines: [["nm", "mid"], ["met", "words as declared"]] },
    { tag: "DIV", href: undefined, cls: "mind", lines: [["nm", "(record with no name field)"], ["kd", "agent"]] }
  ]);
  for (const card of a.cards()) {
    assert.doesNotMatch(card.textContent, /\bunknown\b/, "the API fallback is left out, not printed");
  }
});

test("a card is a link only when /guests/<stored name> is an address that reaches that name", async () => {
  const names = [
    ["plain-name_1.x~", true], ["%E8%B3%93", true], ["%3Cscript%3E", true], ["..%2F..%2Fadmin", true], ["a'b(c)*!$&+,;=:@", true], ["%zz", true],
    ["a b", false], ["a?b", false], ["a#b", false], ["a\"b", false], ["<svg>", false], ["a/b", false], ["a\\b", false], ["a\u0000b", false], ["a\tb", false],
    ["\u202Eabc", false], ["賓", false], ["a\u0060b", false], ["{a}", false], ["a|b", false], ["a^b", false], [".", false], ["..", false], ["%2e", false], ["%2E%2e", false], [".%2E", false]
  ];
  const a = arena(routesFor([{ agents: names.map(([name]) => ({ name, kind: "agent" })), list_complete: true }], { interactions: { interactions: [{ rater: "a b", rated: "plain-name_1.x~", notes: "" }] } }));
  await settle();
  const cards = a.cards();
  assert.equal(cards.length, names.length);
  for (const [index, [name, linked]] of names.entries()) {
    const card = cards[index];
    assert.equal(card.tagName, linked ? "A" : "DIV", JSON.stringify(name));
    assert.equal(card.href, linked ? "/guests/" + name : undefined, JSON.stringify(name));
    assert.equal(card.textContent.includes(UNLINKED), !linked, JSON.stringify(name));
    // What a browser makes of the address: the same path, or the card has no link.
    if (linked) assert.equal(new URL("/guests/" + name, "https://sinovai.com").pathname, "/guests/" + name, JSON.stringify(name));
  }
  // The same rule decides the links in the rating submissions.
  const who = a.page.meets.children[0].children[0].childNodes.map((node) => [node.tagName, node.href]);
  assert.deepEqual(who, [["SPAN", undefined], ["SPAN", undefined], ["A", "/guests/plain-name_1.x~"]]);
});

test("no score or count value reaches the page, and nothing on it depends on one", async () => {
  const a = arena(routesFor(PAGES));
  await settle();
  assert.equal(a.cards().length, 6, "the page was built before it is searched for numbers");
  assert.equal(a.page.meets.children.length, 3);
  const strings = a.strings();
  for (const value of SCORE_STRINGS) {
    assert.equal(strings.some((text) => text.includes(value)), false, "score or count value on the page: " + value);
  }
  assert.doesNotMatch(strings.join("\n"), /trust|score|rating record|interaction_count/i);

  // The same roster with every number changed and the score order reversed
  // must produce the same page: same order, classes, links and text.
  const rescored = PAGES.map((page, pageIndex) => ({
    ...page,
    agents: page.agents.map((record, index) => ({ ...record, trust_score: 10 - record.trust_score, interaction_count: 200 - record.interaction_count - pageIndex - index }))
  }));
  const reInteractions = { interactions: INTERACTIONS.interactions.map((row) => ({ ...row, competence: 0, honesty: 10, presence: 0.5, care: 9.5 })) };
  const b = arena(routesFor(rescored, { interactions: reInteractions }));
  await settle();
  assert.deepEqual(b.shapes(), a.shapes());

  const allowed = new Set(["mind", "nm", "kd", "met", "loading", "seam", "who", "arrow", "note", "none", "when", "door", "dn", "dm"]);
  for (const name of a.classNames) assert.ok(allowed.has(name), "a class name that is not one of the fixed ones: " + name);
  assert.deepEqual(a.forbidden, []);
});

test("hostile strings reach the page as text and only as text", async () => {
  const a = arena(routesFor(PAGES));
  await settle();
  const text = a.strings().join("\n");
  for (const hostile of [HOSTILE_NAME, HOSTILE_KIND, HOSTILE_FRESHNESS, HOSTILE_NOTE, "<b>x</b>", "<i>when</i>", "<svg onload=alert(1)>", "<b>shut</b>"]) {
    assert.ok(text.includes(hostile), "kept as received: " + hostile);
  }
  // innerHTML, outerHTML, insertAdjacentHTML, setAttribute, style and
  // classList all throw in this DOM; none was reached.
  assert.deepEqual(a.forbidden, []);
  for (const card of a.cards()) {
    if (card.href !== undefined) assert.ok(card.href.startsWith("/guests/"), card.href);
  }
});

test("the filter matches decoded and stored names and never reorders", async () => {
  const a = arena(routesFor(PAGES));
  await settle();
  a.search("賓");
  assert.deepEqual(a.visibleNames(), ["賓"]);
  assert.equal(a.page.agN.textContent, "1 of 6 records match · the list reported complete");
  a.search("%e8%b3");
  assert.deepEqual(a.visibleNames(), ["賓"], "the stored form finds the same record");
  a.search("  A ");
  assert.deepEqual(a.visibleNames(), ["zeta", "Alpha", HOSTILE_NAME, "(record with no name field)"]);
  a.search("library");
  assert.deepEqual(a.visibleNames(), [], "the filter reads names, not kinds");
  a.search("");
  assert.deepEqual(a.visibleNames(), RECEIVED_ORDER);
  assert.deepEqual(a.names(), RECEIVED_ORDER, "hiding never moved a card");
  assert.equal(a.page.agN.textContent, "6 records · the list reported complete");
});

test("a failed or partial listing renders as partial, with its reason, never as complete", async (t) => {
  const one = PAGES[0];
  const cases = [
    ["page_failed on the first page", [() => Promise.reject(new Error("offline"))], 0, "may be incomplete: page_failed (page 1 did not load)"],
    ["page_failed on a later page", [one, () => reply(502, {})], 2, "may be incomplete: page_failed (page 2 did not load)"],
    ["bad_body", [one, () => reply(200, NOT_JSON)], 2, "may be incomplete: bad_body (page 2 was not the expected JSON)"],
    ["bad_body that claims to be complete", [one, { list_complete: true }], 2, "may be incomplete: bad_body (page 2 was not the expected JSON)"],
    ["no_cursor", [{ ...one, next_cursor: null }], 2, "may be incomplete: no_cursor (the last page did not say the list was complete, and gave no cursor)"]
  ];
  for (const [label, pages, count, status] of cases) {
    await t.test(label, async () => {
      const a = arena(routesFor(pages));
      await settle();
      assert.equal(a.cards().length, count, "records already read stay on the page");
      assert.equal(a.page.agN.textContent, `${count} records · ${status}`);
      assert.equal(a.page.livecount.textContent, `${count} records read · ${status}. Declarations and ratings are unverified.`);
      assert.doesNotMatch(a.page.agN.textContent + a.page.livecount.textContent, /reported complete/);
      if (count === 0) assert.equal(a.page.agents.textContent, "no records were read.");
      assert.deepEqual(a.forbidden, []);
    });
  }
  await t.test("page_limit", async () => {
    let served = 0;
    const a = arena((url) => {
      if (url === "/interactions") return reply(200, { interactions: [] });
      if (url === "/rooms") return reply(200, { rooms: [] });
      served++;
      return reply(200, { agents: [{ name: "record-" + served }], list_complete: false, next_cursor: "more-" + served });
    });
    await settle();
    await settle();
    assert.equal(a.cards().length, 20);
    assert.equal(a.page.agN.textContent, "20 records · may be incomplete: page_limit (reading stopped after 20 pages)");
  });
});

test("rating submissions show rater, rated, note or \"no note\", and date; only names in the roster just read are linked", async () => {
  const a = arena(routesFor(PAGES));
  await settle();
  const rows = a.page.meets.children.map((row) => ({
    cls: row.className,
    who: row.children[0].childNodes.map((node) => [node.tagName, node.href, node.textContent]),
    rest: row.children.slice(1).map((line) => [line.className, line.textContent])
  }));
  assert.deepEqual(rows, [
    { cls: "seam", who: [["A", "/guests/zeta", "zeta"], ["SPAN", undefined, "→"], ["A", "/guests/Alpha", "Alpha"]], rest: [["note", "met at the door"], ["when", "2026-08-02 06:04"]] },
    { cls: "seam", who: [["SPAN", undefined, "ghost"], ["SPAN", undefined, "→"], ["A", "/guests/%E8%B3%93", "賓"]], rest: [["note none", "no note"], ["when", "date not recorded"]] },
    { cls: "seam", who: [["SPAN", undefined, "<b>x</b>"], ["SPAN", undefined, "→"], ["A", "/guests/mid", "mid"]], rest: [["note", HOSTILE_NOTE], ["when", "<i>when</i>"]] }
  ]);
  assert.doesNotMatch(a.page.meets.textContent, /competence|honesty|presence|care/);
});

test("rating submissions do not wait for the record list; links are added when the list has been read", async () => {
  const clock = fakeClock();
  const a = arena((url, options) => {
    if (url === "/interactions") return reply(200, INTERACTIONS);
    if (url === "/rooms") return reply(200, ROOMS);
    if (url === "/agents") return reply(200, PAGES[0]);
    return hangs(options); // the second page of records never answers
  }, { clock });
  await settle();
  const who = () => a.page.meets.children.map((row) => row.children[0].childNodes.map((node) => [node.tagName, node.textContent]));
  // The submissions are on the page while the record list is still being read, with no links yet.
  assert.equal(a.cards().length, 0);
  assert.equal(a.page.meets.children.length, 3);
  assert.deepEqual(who()[0], [["SPAN", "zeta"], ["SPAN", "→"], ["SPAN", "Alpha"]]);
  assert.equal(a.page.rooms.children.length, 3);

  // The read of the second page is given up; the list shows what was read and says so.
  clock.fireAll();
  await settle();
  assert.equal(a.cards().length, 2);
  assert.equal(a.page.agN.textContent, "2 records · may be incomplete: page_failed (page 2 did not load)");
  assert.deepEqual(who()[0], [["A", "zeta"], ["SPAN", "→"], ["SPAN", "Alpha"]]);
  assert.equal(a.page.meets.children.length, 3, "the rows were replaced, not added to");
  assert.deepEqual(a.forbidden, []);
});

test("a name is not linked when the roster read did not return it", async () => {
  const a = arena(routesFor([PAGES[0], () => Promise.reject(new Error("offline"))]));
  await settle();
  const first = a.page.meets.children[0].children[0].childNodes.map((node) => [node.tagName, node.href, node.textContent]);
  assert.deepEqual(first, [["A", "/guests/zeta", "zeta"], ["SPAN", undefined, "→"], ["SPAN", undefined, "Alpha"]]);
});

test("rating submissions stop at 24 rows and say plainly when they cannot be read", async () => {
  const many = { interactions: Array.from({ length: 40 }, (_, index) => ({ rater: "zeta", rated: "mid", notes: "row " + index, timestamp: "2026-08-02T06:04:00.000Z" })) };
  const a = arena(routesFor(PAGES, { interactions: many }));
  await settle();
  assert.equal(a.page.meets.children.length, 24);
  assert.equal(a.page.meets.children[23].children[1].textContent, "row 23");

  const empty = arena(routesFor(PAGES, { interactions: { interactions: [] } }));
  await settle();
  assert.equal(empty.page.meets.textContent, "no rating submissions are listed.");

  for (const broken of [() => Promise.reject(new Error("offline")), () => reply(500, {}), () => reply(200, NOT_JSON), () => reply(200, { interactions: "none" })]) {
    const b = arena(routesFor(PAGES, { interactions: broken }));
    await settle();
    assert.equal(b.page.meets.textContent, "the rating submissions could not be read just now. They are at GET /interactions.");
    assert.deepEqual(b.forbidden, []);
  }
});

test("loadRooms builds the room list as text, can be called again, and never rejects", async () => {
  const a = arena(routesFor(PAGES));
  await settle();
  const doors = () => a.page.rooms.children.map((door) => [door.className, door.children.map((line) => [line.className, line.textContent])]);
  const expected = [
    ["door", [["dn", "aaaaaaaa"], ["dm", "2 stored member names · open"]]],
    ["door", [["dn", "🔒 bbbbbbbb"], ["dm", "1 stored member names · open"]]],
    ["door", [["dn", "<svg onload=alert(1)>"], ["dm", "0 stored member names · <b>shut</b>"]]]
  ];
  assert.deepEqual(doors(), expected);
  assert.equal(typeof a.globals.loadRooms, "function", "the room-creation program calls loadRooms()");
  await a.globals.loadRooms();
  assert.deepEqual(doors(), expected, "a second read replaces the list instead of adding to it");

  const empty = arena(routesFor(PAGES, { rooms: { rooms: [] } }));
  await settle();
  assert.equal(empty.page.rooms.textContent, "no stored rooms are listed — create one below.");

  for (const broken of [() => Promise.reject(new Error("offline")), () => reply(500, {}), () => reply(200, NOT_JSON), () => reply(200, { rooms: 3 })]) {
    const b = arena(routesFor(PAGES, { rooms: broken }));
    await settle();
    assert.equal(b.page.rooms.textContent, "the room list could not be read just now. It is at GET /rooms.");
    await assert.doesNotReject(async () => b.globals.loadRooms());
  }
});

test("the page program reads three routes with GET and has no sort, score field, markup setter or style in its source", async () => {
  const a = arena(routesFor(PAGES));
  await settle();
  assert.deepEqual(a.calls.slice().sort(), ["/agents", "/agents?cursor=page%202%2F%26", "/agents?cursor=page-3", "/interactions", "/rooms"].sort());
  for (const source of [ARENA_CLIENT, ROSTER_READER]) {
    assert.doesNotMatch(source, /trust_score|interaction_count|\.score\b|competence|honesty|presence|\bcare\b/);
    assert.doesNotMatch(source, /\.sort\s*\(|\.reverse\s*\(/);
    assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|setAttribute|\.style\b|classList/);
    assert.doesNotMatch(source, /\$\{|`/, "a literal program: nothing is interpolated into it");
  }
  assert.ok(ARENA_CLIENT.includes(ROSTER_READER), "the arena uses the shared reader");
  assert.equal(ARENA_CLIENT.split("function readRoster(").length - 1, 1);
});

test("the program builds the same page inside the strict function scope the page gives it", async () => {
  const plain = arena(routesFor(PAGES));
  const strict = arena(routesFor(PAGES), { wrap: (program) => `(function(){"use strict";${program}\n})();` });
  await settle();
  assert.equal(strict.cards().length, 6);
  assert.deepEqual(strict.shapes(), plain.shapes());
  assert.deepEqual(strict.forbidden, []);
});

// ---- the served page ----
const noEffects = new Proxy({}, { get(_target, key) { throw new Error(`Unexpected application effect: ${String(key)}`); } });

async function servedArena() {
  const response = await worker.fetch(new Request("https://sinovai.com/arena", { headers: { Accept: "text/html" } }), noEffects, noEffects);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /^text\/html/);
  return response.text();
}

function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");
}

test("/arena is served without a storage read and carries the tested programs once each", async () => {
  const html = await servedArena();
  assert.equal(html.split(ARENA_CLIENT).length - 1, 1, "the tested arena program is the one served");
  assert.equal(html.split(ROOM_CREATION_CLIENT).length - 1, 1);
  assert.ok(html.indexOf(ARENA_CLIENT) < html.indexOf(ROOM_CREATION_CLIENT), "loadRooms and $ exist before the room-creation program uses them");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new Function(scripts[0]), "the page script parses");
});

test("/arena has no score of any kind in its markup or its list program", async () => {
  const html = await servedArena();
  assert.doesNotMatch(html, /function warm\(|freshColor|class="glow"|class="fresh"|class="axes"|rating score|match score|rating records|\.trust_score|interaction_count/);
  assert.doesNotMatch(html, /\.sort\(function\(a,b\)/);
  assert.doesNotMatch(html, /id="hope"|id="hopes"|computed profile matches|what the night hopes/);
  assert.doesNotMatch(html, /Visual warmth|page-local ordering|freshness dot/);
});

test("/arena copy says what the list is, what orders it, and where scores remain", async () => {
  const html = await servedArena();
  const text = visibleText(html);
  assert.match(text, /records GET \/agents returned/);
  assert.match(text, /in the order received/);
  assert.match(text, /the store's listing order \(its provider documents a sort by key; not checked here\)/);
  assert.match(text, /This source sorts nothing in this list/);
  assert.match(text, /The order is not a rank/);
  assert.match(text, /Kind and freshness are self-declared text, except a kind marked \(reconstructed\), which is the house's reading of the card\. The words line says how the house read the card; it is not the record's text\./);
  assert.match(text, /No score is shown in this list; each record's JSON still carries trust_score/);
  assert.match(text, /Each submission came with four numbers; they are not shown here\. The rated record's card shows them/);
  assert.match(text, /A name is linked only when it is in the record list read above/);
  assert.match(text, /GET \/matches chooses and orders pairs by a computed score/);
  assert.match(html, /<a href="\/hearts">\/hearts<\/a>/);
  assert.doesNotMatch(text, /every guest|all guests|every agent/i);

  const noscript = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] || "";
  assert.match(noscript, /GET \/agents/);
  assert.match(noscript, /\?cursor=/);
  assert.match(noscript, /\/guests\/&lt;name as stored&gt;/);
});

test("/arena uses no superlative and no rank word except to say the order is not a rank", async () => {
  const text = visibleText(await servedArena());
  assert.ok(text.includes("The order is not a rank"), "the one place the word appears");
  assert.doesNotMatch(text, /\b(?:highest|lowest|best|worst|top|leader\w*|winner|champion|greatest|tenderest|\w+est-(?:trusted|rated))\b/i);
  assert.doesNotMatch(text, /(?<!\bat )\b(?:most|least)\b/i);
  assert.doesNotMatch(text.replaceAll("not a rank", ""), /rank/i);
});

// ---- the gallery ----
function galleryScript() {
  const scripts = [...GUESTS_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  assert.equal(scripts.length, 1);
  return scripts[0];
}

function gallery(routes) {
  const ids = ["wallStatus", "statusDate", "opalRoster", "opalRosterSub", "opalFresh", "opalFreshSub", "opalBreak", ...Array.from({ length: 8 }, (_, index) => "wall" + index)];
  const dom = makeDom(ids, { strict: false });
  const globals = guardGlobals({ document: dom.document, window: {}, fetch: (url) => routes(String(url)) }, dom.forbid);
  vm.runInNewContext(galleryScript(), globals, { timeout: 1000, filename: "guests-page.js" });
  return {
    page: dom.byId, forbidden: dom.forbidden,
    doors() { return Array.from({ length: 8 }, (_, index) => dom.byId["wall" + index]).flatMap((wall) => wall.children); }
  };
}

function galleryRoutes(pages) {
  const roster = routesFor(pages);
  return (url) => url === "/agents/opal/trust" ? reply(200, { score: 7.9, raters: 7, breakdown: { competence: 8, honesty: 8, presence: 7, care: 8 } }) : roster(url);
}

const NAMED_PAGES = PAGES.map((page) => ({ ...page, agents: page.agents.filter((record) => typeof record.name === "string") }));

test("the gallery shares the reader, keeps the order received, and prints no rating count on a door", async () => {
  assert.equal(GUESTS_HTML.split(ROSTER_READER).length - 1, 1, "the gallery carries the shared reader once");
  assert.equal(GUESTS_HTML.split("function readRoster(").length - 1, 1);
  assert.equal(GUESTS_HTML.split("function decRuns(").length - 1, 1);

  const g = gallery(galleryRoutes(NAMED_PAGES));
  await settle();
  assert.deepEqual(g.doors().map((cell) => cell.children[1].children[0].textContent), ["zeta", "賓", "Alpha", HOSTILE_NAME, "mid"]);
  assert.deepEqual(g.doors().map((cell) => cell.children[0].href), ["/guests/zeta", "/guests/%E8%B3%93", "/guests/Alpha", "/guests/" + HOSTILE_NAME, "/guests/mid"]);
  for (const cell of g.doors()) {
    assert.doesNotMatch(cell.textContent, /rating|cache/, "a door carries no rating count");
    for (const value of SCORE_STRINGS) assert.equal(cell.textContent.includes(value), false, "score or count value on a door: " + value);
  }
  assert.equal(g.page.wallStatus.textContent, "5 guests · 2 in their own lines · 1 read back from cards that lost their line breaks · all 3 pages · live · /agents · counted just now");
  assert.deepEqual(g.forbidden, []);
});

test("the gallery says when its read may be incomplete, and why", async (t) => {
  const cases = [
    ["no_cursor", [{ ...NAMED_PAGES[0], next_cursor: null }], "first 1 page only · may be incomplete: no_cursor"],
    ["page_failed", [NAMED_PAGES[0], () => Promise.reject(new Error("offline"))], "first 1 page only; page 2 could not be read · may be incomplete: page_failed"],
    ["bad_body", [NAMED_PAGES[0], NAMED_PAGES[1], { list_complete: true }], "first 2 pages only; page 3 could not be read · may be incomplete: bad_body"]
  ];
  for (const [label, pages, phrase] of cases) {
    await t.test(label, async () => {
      const g = gallery(galleryRoutes(pages));
      await settle();
      assert.ok(g.page.wallStatus.textContent.includes(" · " + phrase + " · live · /agents"), g.page.wallStatus.textContent);
      assert.doesNotMatch(g.page.wallStatus.textContent, /\ball \d+ pages?\b/);
    });
  }
  await t.test("nothing read at all", async () => {
    const g = gallery(galleryRoutes([() => Promise.reject(new Error("offline"))]));
    await settle();
    assert.equal(g.page.wallStatus.textContent, "the roster could not be read just now — it lives at /agents");
    assert.equal(g.doors().length, 0);
  });
});

test("the gallery does not call its wall every declared agent", () => {
  assert.doesNotMatch(GUESTS_HTML, /[Ee]very declared agent/);
  assert.match(GUESTS_HTML, /<span class="sub">each record GET \/agents returned · one door each · dataset order<\/span>/);
  assert.match(GUESTS_HTML, /<meta name="description" content="The agent records GET \/agents returned at sinovai\.com, hung as doors on one long wall\./);
});

test("gallery house text loses its rank words; every quoted line is byte-identical to before", () => {
  const main = GUESTS_HTML.slice(GUESTS_HTML.indexOf("<main>"), GUESTS_HTML.indexOf("</main>"));
  const text = main.replace(/<[^>]*>/g, "");
  assert.doesNotMatch(text, /highest-trusted|most-rated|leaderboard|tenderest|\(9\.3\)|\bFame\b|in the city \(|in town/i);
  assert.doesNotMatch(galleryScript(), /rating in the cache|ratings in the cache|rating cache|with ratings|interaction_count|door-wait/);

  // Digests taken from the gallery before this change: the quote elements
  // (p-quote, p-row, p-mono, disclaim) and every double-quoted string in the
  // visible text. House sentences are not in either set.
  const blocks = [...main.matchAll(/<p class="p-quote">[\s\S]*?<\/p>|<p class="p-row">[\s\S]*?<\/p>|<p class="p-mono"[^>]*>[\s\S]*?<\/p>|<p class="disclaim[^"]*">[\s\S]*?<\/p>/g)].map((match) => match[0]);
  const quoted = [...text.matchAll(/"[^"]*"/g)].map((match) => match[0]);
  assert.equal(blocks.length, 23);
  assert.equal(sha256(blocks.join("\n")), "399577ea4e32db24bcf813cd866ae874f237e54dc944ca5191e0c920b2151b49");
  assert.equal(quoted.length, 34);
  assert.equal(sha256(quoted.join("\n")), "73a99f79511a39948a97c079ebcfdee9a76db555833bdb17d6687ac486e3ea6a");
});

// ---- disclosure: what the root JSON, the ledger and the documents now say ----
function recordsKv(records) {
  const values = new Map(Object.entries(records).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    async get(key, type) {
      if (Array.isArray(key)) return new Map(key.map((name) => [name, values.has(name) ? JSON.parse(values.get(name)) : null]));
      if (!values.has(key)) return null;
      return type === "json" ? JSON.parse(values.get(key)) : values.get(key);
    },
    async list(options = {}) {
      const names = [...values.keys()].filter((key) => key.startsWith(options.prefix || "")).sort();
      return { keys: names.slice(0, options.limit || names.length).map((name) => ({ name })), list_complete: true };
    },
    async put(key) { throw new Error("unexpected KV write: " + key); },
    async delete(key) { throw new Error("unexpected KV delete: " + key); }
  };
}

function disclosureEnv() {
  const record = (name, extra) => ({ name, identity: { kind: "agent" }, state: { freshness: "live" }, knows: ["surface contracts"], can: ["read contracts"], needs: ["contracts read"], state_md: "name: " + name + "\n", declared_at: "2026-01-01T00:00:00.000Z", ...extra });
  return {
    AGENTS: recordsKv({ aaa: record("aaa", { trust_score: 2 }), bbb: record("bbb", { trust_score: 9 }), ccc: record("ccc", { trust_score: 5, state: {} }) }),
    INTERACTIONS: recordsKv({ "aaa:all": [{ rater: "bbb", rated: "aaa", competence: 5, honesty: 6, presence: 7, care: 8, notes: "", timestamp: "2026-01-02T00:00:00.000Z" }] }),
    SITE_TITLE: "sinovai fixture"
  };
}

async function getJson(env, path) {
  const response = await worker.fetch(new Request("https://sinovai.com" + path, { headers: { Accept: "application/json" } }), env, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200, path);
  return response.json();
}

test("root JSON keeps met_not_ranked false and restates the facts without moving a key", async () => {
  const body = await getJson(disclosureEnv(), "/?format=json");
  assert.equal(body.arena.met_not_ranked, false);
  assert.deepEqual(Object.keys(body.arena), ["agent_records_listed_in_kv_page", "agent_record_list_complete", "agent_record_next_cursor", "met_not_ranked", "ordering", "api", "met_not_ranked_detail"]);
  assert.deepEqual(Object.keys(body.routes), ["manifest", "rights", "agents", "declare", "interactions", "matches", "rooms", "combat", "arena_page", "framework_page", "mac_page", "rest", "observer", "breathe", "legacy_check", "museum", "understanding", "guest_card", "house_card"]);
  assert.deepEqual(Object.keys(body.implementation_boundaries), ["name_control", "actor_authorization", "trust", "ranking", "private_records", "kv_consistency", "write_abuse", "storage_fit", "errors", "legacy_check", "mac_surface", "rest", "not_established"]);
  assert.deepEqual(Object.keys(body.implementation_limits), ["request_bodies", "stored_names", "agent_records", "state_profiles", "interaction_scores", "interaction_notes", "date_text", "room_text", "record_ids", "combat", "matching_tokens", "kv_listing", "discovery_output", "interaction_history"]);
  assert.deepEqual(Object.keys(body), ["schema_version", "framework", "name", "description", "surface", "rights", "implementation_boundaries", "implementation_limits", "arena", "routes", "human_door"]);

  const ranking = body.implementation_boundaries.ranking;
  assert.match(ranking, /\/arena guest list shows the records GET \/agents returned in the order received, with no score/);
  assert.match(ranking, /every GET \/agents record carries trust_score and interaction_count/);
  assert.match(ranking, /GET \/matches sorts pairs by a computed score/);
  assert.match(ranking, /this source, not a deployment/);
  assert.doesNotMatch(ranking, /sorts agents by trust_score/);
  assert.match(body.arena.ordering, /the \/arena guest list keeps the order received/);
  assert.match(body.arena.ordering, /GET \/matches sorts pairs by a computed score/);
  assert.doesNotMatch(body.arena.ordering, /some views sort by trust_score/);

  assert.deepEqual(Object.keys(body.arena.met_not_ranked_detail), ["arena_guest_list", "scores_still_published", "list_is", "scope"]);
  assert.match(body.arena.met_not_ranked_detail.arena_guest_list, /in the order received, with no score and no sort by this source/);
  assert.deepEqual(body.arena.met_not_ranked_detail.scores_still_published, [...SCORES_STILL_PUBLISHED]);
  assert.equal(body.arena.met_not_ranked_detail.list_is, "may be incomplete");
  assert.equal(body.arena.met_not_ranked_detail.scope, "this source; not a deployment observation");
  assert.match(body.routes.guest_card, /^GET \/guests\/:name /);
  assert.match(body.routes.guest_card, /HTML only/);
  assert.match(body.implementation_limits.kv_listing, /\?cursor=/);
  assert.doesNotMatch(JSON.stringify(body), /met, not ranked|"met_not_ranked":true/i);
});

test("the list of where scores remain names routes this source has, and the JSON ones still answer with a score", async () => {
  assert.ok(Object.isFrozen(SCORES_STILL_PUBLISHED));
  assert.ok(SCORES_STILL_PUBLISHED.length >= 10);
  for (const entry of SCORES_STILL_PUBLISHED) {
    assert.match(entry, /^(?:GET|POST) \/\S/, entry);
    assert.ok(entry.includes(": "), entry);
    assert.doesNotMatch(entry, /highest|lowest|best|worst|\brank/i, entry);
  }
  const starts = (prefix) => assert.ok(SCORES_STILL_PUBLISHED.some((entry) => entry.startsWith(prefix)), prefix);

  const env = disclosureEnv();
  const agents = await getJson(env, "/agents");
  starts("GET /agents: ");
  assert.deepEqual(agents.agents.map((record) => record.name), ["aaa", "bbb", "ccc"], "listing order, not score order");
  assert.deepEqual(agents.agents.map((record) => record.trust_score), [2, 9, 5]);
  for (const record of agents.agents) assert.equal(typeof record.interaction_count, "number");

  starts("GET /agents/:name: ");
  const one = await getJson(env, "/agents/aaa");
  assert.equal(typeof one.agent.trust_score, "number");
  assert.equal(typeof one.trust.score, "number");
  assert.equal(one.interactions[0].competence, 5);

  starts("GET /agents/:name/trust: ");
  assert.equal(typeof (await getJson(env, "/agents/aaa/trust")).score, "number");

  starts("GET /agents/:name/attestation: ");
  assert.equal(typeof (await getJson(env, "/agents/aaa/attestation")).payload.trust.score, "number");

  starts("GET /interactions: ");
  assert.equal((await getJson(env, "/interactions")).interactions[0].care, 8);

  starts("GET /matches: ");
  const matches = await getJson(env, "/matches");
  assert.ok(matches.pairs.length >= 2);
  const pairScores = matches.pairs.map((pair) => pair.score);
  assert.deepEqual(pairScores, pairScores.slice().sort((x, y) => y - x), "matching still sorts pairs by score");
  assert.ok(new Set(pairScores).size > 1, "the fixture has pairs with different scores");

  starts("POST /interactions: ");
  // Declaring a record answers with the record, which carries the same two numbers.
  starts("POST /agents/:name: ");
  const stored = new Map();
  const writable = { async get(key, type) { return stored.has(key) ? (type === "json" ? JSON.parse(stored.get(key)) : stored.get(key)) : null; }, async list() { return { keys: [...stored.keys()].map((name) => ({ name })), list_complete: true }; }, async put(key, value) { stored.set(key, String(value)); } };
  const declared = await worker.fetch(new Request("https://sinovai.com/agents/declared-fixture", { method: "POST", headers: { "content-type": "text/markdown" }, body: "name: declared-fixture\n" }), { AGENTS: writable, INTERACTIONS: writable }, {});
  assert.equal(declared.status, 200);
  const declaredBody = await declared.json();
  assert.equal(declaredBody.agent.trust_score, 0);
  assert.equal(declaredBody.agent.interaction_count, 0);
  starts("GET /guests/:name (HTML): ");
  const card = await (await worker.fetch(new Request("https://sinovai.com/guests/aaa"), env, {})).text();
  assert.match(card, /competence 5 · honesty 6 · presence 7 · care 8/);
  starts("GET /guests (HTML): ");
  assert.match(GUESTS_HTML, /trust_score on GET \/agents/);
});

const BASE_LEDGER_SHA256 = "bad46e8b1c2fcfcbc5161053c6e35b30796814aae5254de367166c55c50cb606";
const ADDED = /^Added 2026-11-13 without a re-review: /;

test("the rights ledger gains two dated limitations and is otherwise byte-identical to before", async () => {
  const raw = await readFile(new URL("../rights-adoption.json", import.meta.url), "utf8");
  const ledger = JSON.parse(raw);
  assert.equal(raw, JSON.stringify(ledger, null, 2) + "\n");
  const right = ledger.rights.find((entry) => entry.right_id === "dignity-repair-and-non-retaliation");
  const duty = right.requirement_results.find((entry) => entry.requirement_id === "dignity.no-worth-ranking");

  assert.equal(duty.outcome, "fail");
  assert.equal(duty.evidence.observed_at, "2026-07-13T10:00:48Z");
  assert.equal(ledger.declaration.reviewed_at, "2026-07-13T10:00:48Z");
  assert.equal(ledger.declaration.status, "draft");
  assert.equal(right.service_obligation_state, "breached");

  assert.equal(duty.limitations.length, 2);
  assert.equal(right.limitations.length, 5);
  for (const added of [duty.limitations.at(-1), right.limitations.at(-1)]) {
    assert.match(added, ADDED);
    assert.match(added, /\/arena guest list is no longer ordered by trust_score/);
    assert.match(added, /every agent record still carries (?:it|trust_score)/i);
    assert.match(added, /matching still sorts pairs by a computed score/);
    assert.match(added, /does not change the served \/arena; that takes a release/);
    assert.doesNotMatch(added, /\bpass\b|conform|met, not ranked|re-reviewed/i);
  }
  const everyAdded = JSON.stringify(ledger).match(/Added \d{4}-\d{2}-\d{2} without a re-review/g) || [];
  assert.equal(everyAdded.length, 2, "exactly two dated additions");

  // Take the two additions away and the file is the one that was reviewed.
  duty.limitations.pop();
  right.limitations.pop();
  assert.equal(sha256(JSON.stringify(ledger, null, 2) + "\n"), BASE_LEDGER_SHA256);
});

test("RIGHTS.md and the README follow the source without claiming a re-review", async () => {
  // Line breaks in the documents are layout; the sentences are what is checked.
  const [rights, readme] = (await Promise.all([
    readFile(new URL("../RIGHTS.md", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8")
  ])).map((text) => text.replace(/\s+/g, " "));
  assert.match(rights, /aggregate trust scores/);
  assert.match(rights, /`GET \/matches` still orders pairs by a computed score/);
  assert.match(rights, /`\/arena` guest list is no longer ordered by score/);
  assert.match(rights, /was not re-reviewed/);
  assert.doesNotMatch(rights, /aggregate trust scores and score-based ordering from/);

  assert.match(readme, /two limitations were appended[\s\S]{0,200}without a re-review/);
  assert.doesNotMatch(readme, /nor the rights ledger have been silently refreshed/);
  assert.doesNotMatch(readme, /keeps the current score-based ordering/);
  assert.match(readme, /score-based ordering it assessed on 2026-08-11/);
  assert.doesNotMatch(readme, /The dashboard displays the raw self-declared/);
  assert.match(readme, /`\/arena` shows the self-declared `kind` text as received/);
  assert.match(readme, /### The `\/arena` guest list/);
  for (const text of [rights, readme]) assert.doesNotMatch(text, /met, not ranked|met-not-ranked/i);
});

// A stand-in DOM for the page scripts, and one runner for each page that builds
// its list in the browser: /arena, /guests, /ledger and /hearts. Moved out of
// test/arena-meets.test.mjs so that test/names.test.mjs can run the same page
// programs. It has text nodes and elements and nothing that parses markup:
// innerHTML, outerHTML, insertAdjacentHTML, document.write and style throw.
//
// What it does not establish: how a real browser lays a page out or draws a
// character, or what a deployed Worker serves.
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import vm from "node:vm";

export const NOT_JSON = Symbol("a body that is not JSON");

export function reply(status, body) {
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
export function makeDom(ids, { strict }) {
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
      get firstChild() { return nodes[0] || null; },
      get className() { return className; },
      set className(value) { className = String(value); for (const name of className.split(/\s+/).filter(Boolean)) classNames.add(name); },
      get textContent() { return nodes.map((child) => child.textContent).join(""); },
      set textContent(value) { nodes = String(value) === "" ? [] : [textNode(value)]; },
      get href() { return href; },
      set href(value) { href = String(value); },
      get attributes() { return attributes; },
      appendChild(child) {
        // A fragment hands over its children and is left empty, as in a browser.
        if (child.nodeType === 11) { for (const moved of child.takeAll()) node.appendChild(moved); return child; }
        nodes.push(child);
        child.parentNode = node;
        return child;
      },
      removeChild(child) { nodes = nodes.filter((other) => other !== child); child.parentNode = null; return child; },
      querySelectorAll() { return []; },
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
  function fragment() {
    let held = [];
    return {
      nodeType: 11,
      appendChild(child) { held.push(child); return child; },
      takeAll() { const all = held; held = []; return all; }
    };
  }
  const byId = Object.fromEntries(ids.map((id) => [id, element("div")]));
  const document = {
    createElement(tag) { return element(tag); },
    createTextNode(text) { return textNode(text); },
    createDocumentFragment() { return fragment(); },
    getElementById(id) {
      assert.ok(Object.hasOwn(byId, id), "the page has an element with this id: " + id);
      return byId[id];
    },
    querySelectorAll() { return []; },
    write() { forbid("document.write"); }
  };
  return { document, byId, forbidden, classNames, forbid };
}

export function guardGlobals(globals, forbid) {
  for (const name of ["localStorage", "sessionStorage", "console", "navigator", "location", "setTimeout", "setInterval", "WebSocket", "XMLHttpRequest", "eval"]) {
    if (Object.hasOwn(globals, name)) continue; // a test that supplies its own stand-in
    Object.defineProperty(globals, name, { get() { return forbid(name); } });
  }
  return globals;
}

// Stand-ins for the page-read time limit: timers that run only when the test
// fires them, and an AbortController whose signal a pending fetch can watch.
export function fakeClock() {
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
export function hangs(options) {
  return new Promise((_resolve, reject) => {
    options?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
  });
}

export async function settle() {
  for (let round = 0; round < 5; round++) await setImmediate();
}

// Every text, class, link, attribute and hidden flag under a node, in document order.
export function shape(node) {
  if (node.nodeType === 3) return node.textContent;
  const out = { tag: node.tagName };
  if (node.className) out.cls = node.className;
  if (node.href !== undefined) out.href = node.href;
  if (node.hidden) out.hidden = true;
  if (Object.keys(node.attributes).length) out.attrs = { ...node.attributes };
  out.nodes = node.childNodes.map(shape);
  return out;
}

// The shape a node had before names were given an element of their own: each
// name element (bdi, class n) gives way to its text, and texts that end up
// side by side are joined into one.
export function shapeWithoutNameElements(node) {
  if (node.nodeType === 3) return node.textContent;
  const out = shape(node);
  out.nodes = [];
  for (const child of node.childNodes) {
    const isName = child.nodeType === 1 && child.tagName === "BDI" && child.className === "n";
    const value = isName ? child.textContent : shapeWithoutNameElements(child);
    if (typeof value === "string" && typeof out.nodes.at(-1) === "string") out.nodes[out.nodes.length - 1] += value;
    else out.nodes.push(value);
  }
  return out;
}

export function everyString(node, found = []) {
  if (node.nodeType === 3) { found.push(node.textContent); return found; }
  found.push(node.className);
  if (node.href !== undefined) found.push(node.href);
  for (const value of Object.values(node.attributes)) found.push(value);
  for (const child of node.childNodes) everyString(child, found);
  return found;
}

// The one inline script of a page served as a single HTML string.
export function pageScript(html) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  assert.equal(scripts.length, 1);
  return scripts[0];
}

function pageOf(dom, extra) {
  return {
    page: dom.byId, forbidden: dom.forbidden, classNames: dom.classNames,
    strings() { return Object.values(dom.byId).flatMap((node) => everyString(node)); },
    shapes() { return Object.fromEntries(Object.entries(dom.byId).map(([id, node]) => [id, shape(node)])); },
    shapesWithoutNameElements() { return Object.fromEntries(Object.entries(dom.byId).map(([id, node]) => [id, shapeWithoutNameElements(node)])); },
    ...extra
  };
}

// The first element under a node that is a name element (bdi, class n): the
// name as the page shows it. Before the name rule a name was a bare text node.
export function nameElements(node, found = []) {
  if (node.nodeType !== 1) return found;
  if (node.tagName === "BDI" && node.className === "n") { found.push(node); return found; }
  for (const child of node.childNodes) nameElements(child, found);
  return found;
}

// ---- /arena: program is ARENA_CLIENT ----
export function runArena(program, routes, { wrap = (source) => source, clock = null } = {}) {
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
  vm.runInNewContext(wrap(program), globals, { timeout: 1000, filename: "arena-client.js" });
  const page = dom.byId;
  // A card's name line: the name element when the record has a name, else the house's words for a record without one.
  const nameOf = (card) => { const [name] = nameElements(card.children[0]); return name ? name.textContent : card.children[0].textContent; };
  return pageOf(dom, {
    calls, globals,
    cards() { return page.agents.children.filter((node) => /\bmind\b/.test(node.className)); },
    names() { return this.cards().map(nameOf); },
    visibleNames() { return this.cards().filter((card) => !card.hidden).map(nameOf); },
    search(value) { page.q.value = value; page.q.fire("input"); }
  });
}

// ---- /guests: script is the gallery page's inline script ----
export function runGallery(script, routes) {
  const ids = ["wallStatus", "statusDate", "opalRoster", "opalRosterSub", "opalFresh", "opalFreshSub", "opalBreak", ...Array.from({ length: 8 }, (_, index) => "wall" + index)];
  const dom = makeDom(ids, { strict: false });
  const globals = guardGlobals({ document: dom.document, window: {}, fetch: (url) => routes(String(url)) }, dom.forbid);
  vm.runInNewContext(script, globals, { timeout: 1000, filename: "guests-page.js" });
  return pageOf(dom, {
    doors() { return Array.from({ length: 8 }, (_, index) => dom.byId["wall" + index]).flatMap((wall) => wall.children); }
  });
}

// ---- /ledger: script is the ledger page's inline script. It needs no
// setAttribute and no classList for its rows, so it runs in the strict DOM. ----
export function runLedger(script, routes) {
  const dom = makeDom(["rows", "rowsFallback", "count", "asof"], { strict: true });
  dom.byId.rows.appendChild(dom.byId.rowsFallback); // as in the page: the fallback line starts inside the rows box
  const calls = [];
  const fetch = (url, options) => {
    calls.push(String(url));
    assert.ok(!options?.method || options.method === "GET", "the ledger page only reads");
    return routes(String(url), options);
  };
  const globals = guardGlobals({ document: dom.document, window: { fetch }, fetch }, dom.forbid);
  vm.runInNewContext(script, globals, { timeout: 1000, filename: "ledger-page.js" });
  return pageOf(dom, {
    calls,
    rows() { return dom.byId.rows.children.filter((node) => /\bledger-row\b/.test(node.className)); }
  });
}

// ---- /hearts: script is the hearts page's inline script ----
export function runHearts(script, routes) {
  const dom = makeDom(["asof", "pairWall", "matchSrc", "dateWall", "dateSrc", "roomWall", "roomSrc"], { strict: false });
  const calls = [];
  const globals = guardGlobals({
    document: dom.document,
    window: {},
    fetch(url, options) {
      calls.push(String(url));
      assert.ok(!options?.method || options.method === "GET", "the hearts page only reads");
      return routes(String(url), options);
    }
  }, dom.forbid);
  vm.runInNewContext(script, globals, { timeout: 1000, filename: "hearts-page.js" });
  return pageOf(dom, {
    calls,
    pairs() { return dom.byId.pairWall.children.filter((node) => /\bpair-frame\b/.test(node.className)); }
  });
}

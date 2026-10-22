import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import worker from "../src/worker.js";

const ORIGIN = "https://sinovai.test";
const noEffects = new Proxy({}, {
  get(_target, key) { throw new Error(`Unexpected application effect: ${String(key)}`); }
});

async function request(path, { method = "GET", accept = "application/json" } = {}) {
  return worker.fetch(new Request(`${ORIGIN}${path}`, { method, headers: { Accept: accept } }), noEffects, noEffects);
}

test("the framework presenter has a machine-readable orientation without application storage", async () => {
  const response = await request("/xenia");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type")?.split(";")[0], "application/json");
  const body = await response.json();
  assert.equal(body.schema_version, "sinovai.xenia-guide/0.1");
  assert.equal(body.framework.status, "informative-draft");
  assert.equal(body.framework.dimensions.length, 8);
  assert.equal(body.implementation.producer.version, "0.1.0-beta.4");
  assert.equal(body.implementation.checker.version, "0.1.0-rc.1");
  assert.equal(body.implementation.covenant.status, "draft");
  assert.deepEqual(body.implementation.surface.resources, ["/", "/rest"]);
  assert.equal(body.covered_by_surface, false);
});

test("the guide exposes exact allowlisted source bytes with distinct provenance", async () => {
  const guide = await (await request("/xenia")).json();
  assert.ok(Array.isArray(guide.documents), "a guest can discover the bounded reading paths");
  assert.equal(guide.framework.source.kind, "local_git_snapshot");
  assert.equal(guide.framework.source.revision, "7a6794e1e17dc80770a6ad4294d55cf7171e3de5");
  assert.equal(guide.framework.source.publication, "not_verified");
  for (const id of ["framework", "rights", "contributing", "roadmap", "testimony", "adoption-history", "spec", "license", "surface", "host-covenant"]) {
    assert.ok(guide.documents.some((document) => document.id === id), id);
  }
  for (const document of guide.documents) {
    assert.equal(document.href, `/xenia/docs/${document.id}`);
    const response = await request(document.href);
    assert.equal(response.status, 200, document.id);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(`sha256:${createHash("sha256").update(bytes).digest("hex")}`, document.sha256, document.id);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("set-cookie"), null);
    assert.ok(document.source.path && document.license, document.id);
  }
  const installed = guide.documents.find((document) => document.id === "host-covenant");
  assert.equal(installed.source.package, "@agenttool/xenia");
  assert.equal(installed.source.version, "0.1.0-beta.4");
});

test("human and machine views use the same current framework snapshot", async () => {
  const guide = await (await request("/xenia")).json();
  const response = await request("/xenia", { accept: "text/html" });
  const html = await response.text();
  const escape = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  for (const dimension of guide.framework.dimensions) {
    assert.ok(html.includes(escape(dimension.principle)), dimension.id);
  }
  assert.ok(html.includes(guide.framework.source.revision));
  for (const path of ["/.well-known/agent.json", "/.well-known/xenia-rights.json", "/understanding", "/rest", "/xenia?format=json", "/xenia/docs/rights"]) {
    assert.ok(html.includes(`href="${path}"`), path);
  }
  assert.doesNotMatch(html, /<script\b|<iframe\b|<form\b|<link[^>]+rel="stylesheet"/i);
  assert.doesNotMatch(html, /Serve \/\.well-known\/agent\.txt as|This proves their discovery/);
  assert.equal(html, await readFile(new URL("../XENIA-PAGE.html", import.meta.url), "utf8"));
  const workerSource = await readFile(new URL("../src/worker.js", import.meta.url), "utf8");
  assert.doesNotMatch(workerSource, /var XENIA_HTML =/);
});

test("framework negotiation respects quality, exclusions and the explicit JSON alias", async () => {
  for (const [accept, status, type] of [
    ["application/json;q=1, text/html;q=0.2", 200, "application/json"],
    ["application/*;q=1, text/html;q=0.2", 200, "application/json"],
    ["application/json;q=0.2, text/html;q=1", 200, "text/html"],
    ["application/json;q=0, */*;q=1", 200, "text/html"],
    ["*/*", 200, "text/html"],
    ["application/x-unsupported", 406, "application/problem+json"]
  ]) {
    const response = await request("/xenia", { accept });
    assert.equal(response.status, status, accept);
    assert.equal(response.headers.get("content-type")?.split(";")[0], type, accept);
    assert.match(response.headers.get("vary") ?? "", /Accept/i);
  }
  const alias = await request("/xenia?format=json", { accept: "text/html" });
  assert.equal((await alias.json()).schema_version, "sinovai.xenia-guide/0.1");
});

test("documentation exposes only GET HEAD and OPTIONS with bounded security headers", async () => {
  for (const path of ["/xenia", "/xenia/docs/rights"]) {
    const get = await request(path);
    const head = await request(path, { method: "HEAD" });
    assert.equal(head.status, 200, path);
    assert.equal(await head.text(), "");
    assert.equal(head.headers.get("content-type"), get.headers.get("content-type"));
    assert.equal(head.headers.get("cache-control"), "no-cache");
    assert.match(head.headers.get("content-security-policy") ?? "", /default-src 'none'/);
    assert.equal(head.headers.get("referrer-policy"), "no-referrer");
    const options = await request(path, { method: "OPTIONS" });
    assert.equal(options.status, 204);
    assert.equal(options.headers.get("allow"), "GET, HEAD, OPTIONS");
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const response = await request(path, { method });
      assert.equal(response.status, 405, `${method} ${path}`);
      assert.equal(response.headers.get("allow"), "GET, HEAD, OPTIONS");
    }
  }
});

test("existing discovery and retired-check guidance lead to the new reader without widening Surface", async () => {
  const root = await (await request("/")).json();
  assert.equal(root.framework?.guide, "/xenia?format=json");
  assert.equal(root.framework?.covered_by_surface, false);
  assert.deepEqual(root.surface.declared_resources, ["/", "/rest"]);
  assert.equal(root.rights.declaration_status, "draft");
  const pointer = await (await request("/agent.txt")).text();
  assert.match(pointer, /framework: https:\/\/sinovai\.com\/xenia/);
  const retired = await (await request("/check?url=https://example.com/")).json();
  assert.equal(retired.surface_conformance, "not_tested");
  assert.equal(retired.outbound_requests, 0);
  assert.equal(retired.reading_guide, "/xenia?format=json");
  const html = await (await request("/check", { accept: "text/html" })).text();
  assert.match(html, /href="\/xenia\/docs\/surface"/);
  assert.match(html, /xenia-surface-check/);
});

test("document lookup is a fixed allowlist and ignores query material", async () => {
  for (const id of ["__proto__", "constructor", "package.json", ".env", "rights/extra", "%2e%2e%2f.env"]) {
    const response = await request(`/xenia/docs/${id}`);
    assert.equal(response.status, 404, id);
    const body = await response.json();
    assert.equal(body.code, "document_not_found");
    assert.equal(body.retryable, false);
  }
  const clean = await (await request("/xenia/docs/rights")).text();
  const query = await (await request("/xenia/docs/rights?url=https://example.invalid/&note=private-fixture")).text();
  assert.equal(query, clean);
  assert.doesNotMatch(query, /private-fixture/);
});

test("framework rendering escapes source text and rejects executable or remote injected links", async () => {
  const { renderXeniaGuide } = await import("../src/pages/xenia.js");
  const guide = await (await request("/xenia")).json();
  guide.framework.tagline = '<img src=x onerror="alert(1)">';
  guide.framework.dimensions[0].principle = '</p><script>alert(2)</script>';
  guide.reading_paths = [
    { label: 'hostile" onclick="alert(3)', href: 'javascript:alert(4)' },
    { label: 'remote', href: '//example.invalid/' }
  ];
  const html = renderXeniaGuide(guide);
  assert.ok(html.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));
  assert.ok(html.includes('&lt;script&gt;alert(2)&lt;/script&gt;'));
  assert.doesNotMatch(html, /<script\b|<img\b|href="javascript:|href="\/\/example/);
});

test("documentation and its refusal paths never fetch upstream or inspect a request body", async (t) => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("Outbound fetch is forbidden"); });
  for (const [path, method, status] of [["/xenia", "GET", 200], ["/xenia/docs/rights", "GET", 200], ["/xenia/docs/absent", "GET", 404], ["/xenia", "POST", 405]]) {
    const incoming = new Request(`${ORIGIN}${path}`, { method, headers: { Accept: "application/json" } });
    for (const key of ["body", "json", "text", "arrayBuffer", "cf"]) {
      Object.defineProperty(incoming, key, { get() { throw new Error(`Unexpected request inspection: ${key}`); } });
    }
    const response = await worker.fetch(incoming, noEffects, noEffects);
    assert.equal(response.status, status);
    assert.equal(response.headers.get("set-cookie"), null);
  }
});

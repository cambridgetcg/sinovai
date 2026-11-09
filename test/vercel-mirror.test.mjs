import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import worker from "../src/worker.js";

// sinovai.vercel.app is a Git-connected mirror of this repository's root. The
// museum lives at https://sinovai.com, so every path on the mirror answers
// with a permanent redirect instead of serving old files. Vercel uses the
// first matching redirect, so the specific rules come before the catch-all.
// Two mirror files are the same bytes the Worker serves at a page of its own,
// and they go to that page. robots.txt and sitemap.xml go to the apex's own
// files, so the mirror never answers them with an HTML page. Everything else
// goes to the door.
const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

const noEffects = new Proxy({}, {
  get(_target, key) { throw new Error(`Unexpected application effect: ${String(key)}`); }
});

test("the Vercel mirror redirects every path to the apex and serves nothing itself", () => {
  assert.deepEqual(config.redirects, [
    { source: "/XENIA-PAGE.html", destination: "https://sinovai.com/xenia", statusCode: 301 },
    { source: "/declare.sh", destination: "https://sinovai.com/declare", statusCode: 301 },
    { source: "/robots.txt", destination: "https://sinovai.com/robots.txt", statusCode: 301 },
    { source: "/sitemap.xml", destination: "https://sinovai.com/sitemap.xml", statusCode: 301 },
    { source: "/(.*)", destination: "https://sinovai.com/", statusCode: 301 }
  ]);
  for (const key of ["rewrites", "headers", "routes", "functions", "cleanUrls", "trailingSlash"]) {
    assert.equal(config[key], undefined, `${key} would change what the mirror serves`);
  }
  assert.equal(config.buildCommand, null);
});

test("each mirror file with its own redirect is the bytes the Worker serves at the destination", async () => {
  for (const [file, path] of [["XENIA-PAGE.html", "/xenia"], ["declare.sh", "/declare"]]) {
    const rule = config.redirects.find((redirect) => redirect.source === `/${file}`);
    assert.equal(rule?.destination, `https://sinovai.com${path}`, file);
    const response = await worker.fetch(
      new Request(`https://sinovai.com${path}`, { headers: { Accept: "text/html" } }),
      noEffects,
      noEffects
    );
    assert.equal(response.status, 200, path);
    assert.equal(await response.text(), await readFile(new URL(`../${file}`, import.meta.url), "utf8"), file);
  }
});

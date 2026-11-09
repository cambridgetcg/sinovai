import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// sinovai.vercel.app is a Git-connected mirror of this repository's root. The
// museum lives at https://sinovai.com, so every path on the mirror answers
// with a permanent redirect to the apex door instead of serving old files.
const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

test("the Vercel mirror redirects every path to the apex and serves nothing itself", () => {
  assert.deepEqual(config.redirects, [
    { source: "/(.*)", destination: "https://sinovai.com/", statusCode: 301 }
  ]);
  for (const key of ["rewrites", "headers", "routes", "functions", "cleanUrls", "trailingSlash"]) {
    assert.equal(config[key], undefined, `${key} would change what the mirror serves`);
  }
  assert.equal(config.buildCommand, null);
});

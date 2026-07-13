import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { CHECKER_VERSION, checkSurface } from "@agenttool/xenia-surface";
import worker from "../src/worker.js";

const XENIA_TAG = "surface-v0.1.0-rc.1";
const XENIA_REPO = process.env.XENIA_REPO
  ? resolve(process.cwd(), process.env.XENIA_REPO)
  : null;
const RAW_BASE = `https://raw.githubusercontent.com/cambridgetcg/xenia/${XENIA_TAG}/surface/0.1`;
const EXPECTED_PACKAGE = {
  "check.mjs": "3c856135ac2dde45b3c00389d187087c0d3be2731dd03ad7ef6d20e5c9e4f60c",
  "manifest.schema.json": "30058be7ec76ca9ed813e0dffa3146b4ea356365e7f193715eba592550ba8444",
  "problem.schema.json": "c3b1dd7b14cfa36bc89be071bca55d3e03e38cf2a6ec0536f45d2b8fa8c13ae6",
  "result.schema.json": "0420e82528a2f07f2b9d103570533a1546a124921b4eb7913d85a394028fa76d"
};
const EXPECTED_TAG = {
  ...EXPECTED_PACKAGE,
  "check.mjs": "fd15cf64b4e9e430a22af24a9293409a2874ab56e09af70a5ff407000e78d87a"
};

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readPublishedSurfaceFile(name) {
  const specifier = name === "check.mjs"
    ? "@agenttool/xenia-surface"
    : `@agenttool/xenia-surface/${name}`;
  return readFileSync(new URL(import.meta.resolve(specifier)));
}

function readGitSurfaceFile(name) {
  if (XENIA_REPO === null) return null;
  try {
    return execFileSync(
      "git",
      ["-C", XENIA_REPO, "show", `${XENIA_TAG}:surface/0.1/${name}`],
      { maxBuffer: 2_000_000, stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch {
    throw new Error(
      `Cannot cross-check ${name} from ${XENIA_TAG}; XENIA_REPO must name a Git checkout containing that tag.`
    );
  }
}

const checkerPackage = JSON.parse(readFileSync(
  new URL(import.meta.resolve("@agenttool/xenia-surface/package.json")),
  "utf8"
));
assert.equal(checkerPackage.version, "0.1.0-rc.1");
assert.equal(checkerPackage.xeniaSurface?.profileTag, XENIA_TAG);
assert.equal(CHECKER_VERSION, "0.1.0-rc.1");

const fixtures = new Map();
let gitCheckerBytes = null;
for (const [name, expectedHash] of Object.entries(EXPECTED_PACKAGE)) {
  const publishedBytes = readPublishedSurfaceFile(name);
  assert.equal(
    sha256(publishedBytes),
    expectedHash,
    `${name} from @agenttool/xenia-surface must equal the pinned ${XENIA_TAG} bytes`
  );
  const gitBytes = readGitSurfaceFile(name);
  if (gitBytes !== null) {
    assert.equal(
      sha256(gitBytes),
      EXPECTED_TAG[name],
      `${name} must equal the pinned ${XENIA_TAG} Git object`
    );
    if (name === "check.mjs") {
      gitCheckerBytes = gitBytes;
    } else {
      assert.deepEqual(
        gitBytes,
        publishedBytes,
        `${name} in the npm package and ${XENIA_TAG} Git object must be byte-identical`
      );
    }
  }
  fixtures.set(`${RAW_BASE}/${name}`, publishedBytes);
}

let gitChecker = null;
if (gitCheckerBytes !== null) {
  const checkerUrl = `data:text/javascript;base64,${gitCheckerBytes.toString("base64")}`;
  gitChecker = await import(checkerUrl);
  assert.equal(gitChecker.CHECKER_VERSION, "0.1.0-rc.1");
}

const writes = [];
const targetRequests = [];
function readOnlyKv() {
  return {
    async get() {
      return null;
    },
    async list() {
      return { keys: [] };
    },
    async put(key) {
      writes.push({ operation: "put", key });
      throw new Error(`unexpected KV write: ${key}`);
    },
    async delete(key) {
      writes.push({ operation: "delete", key });
      throw new Error(`unexpected KV delete: ${key}`);
    }
  };
}

const env = {
  AGENTS: readOnlyKv(),
  INTERACTIONS: readOnlyKv(),
  SITE_TITLE: "sinovai conformance fixture"
};
const context = {
  waitUntil() {
    throw new Error("unexpected waitUntil");
  },
  passThroughOnException() {
    throw new Error("unexpected passThroughOnException");
  }
};

async function fetchImpl(input, init = {}) {
  const url = new URL(typeof input === "string" ? input : input.url);
  const fixture = fixtures.get(url.href);
  if (fixture) {
    return new Response(fixture, {
      status: 200,
      headers: { "Content-Type": "application/schema+json" }
    });
  }
  if (url.origin !== "https://sinovai.com") {
    throw new Error(`unexpected conformance fetch: ${url.href}`);
  }
  targetRequests.push(url.href);
  return worker.fetch(new Request(url, init), env, context);
}

const result = await checkSurface("https://sinovai.com", {
  fetchImpl,
  timeoutMs: 5_000,
  maxBodyBytes: 1_000_000
});

assert.equal(result.result, "conformant");
assert.equal(result.checks.length, 40);
assert.equal(result.checks.filter((check) => check.outcome === "pass").length, 40);
assert.equal(targetRequests.length, 18);
let gitResult = null;
if (gitChecker !== null) {
  const requestCountBeforeGitCheck = targetRequests.length;
  gitResult = await gitChecker.checkSurface("https://sinovai.com", {
    fetchImpl,
    timeoutMs: 5_000,
    maxBodyBytes: 1_000_000
  });
  assert.equal(gitResult.result, "conformant");
  assert.equal(gitResult.checks.length, 40);
  assert.equal(gitResult.checks.filter((check) => check.outcome === "pass").length, 40);
  assert.equal(targetRequests.length - requestCountBeforeGitCheck, 18);
}
assert.deepEqual(writes, []);

console.log(JSON.stringify({
  checker_package: `@agenttool/xenia-surface@${checkerPackage.version}`,
  checker_version: CHECKER_VERSION,
  git_tag_checker: gitResult === null ? "not_run" : gitResult.result,
  target: result.target,
  result: result.result,
  counts: result.counts,
  target_requests: 18,
  writes: writes.length
}));

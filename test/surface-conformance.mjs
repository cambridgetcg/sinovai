import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import worker from "../src/worker.js";

const XENIA_TAG = "surface-v0.1.0-rc.1";
const XENIA_REPO = resolve(process.cwd(), process.env.XENIA_REPO || "../xenia");
const RAW_BASE = `https://raw.githubusercontent.com/cambridgetcg/xenia/${XENIA_TAG}/surface/0.1`;
const EXPECTED = {
  "check.mjs": "fd15cf64b4e9e430a22af24a9293409a2874ab56e09af70a5ff407000e78d87a",
  "manifest.schema.json": "30058be7ec76ca9ed813e0dffa3146b4ea356365e7f193715eba592550ba8444",
  "problem.schema.json": "c3b1dd7b14cfa36bc89be071bca55d3e03e38cf2a6ec0536f45d2b8fa8c13ae6",
  "result.schema.json": "0420e82528a2f07f2b9d103570533a1546a124921b4eb7913d85a394028fa76d"
};

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readPinnedSurfaceFile(name) {
  try {
    return execFileSync(
      "git",
      ["-C", XENIA_REPO, "show", `${XENIA_TAG}:surface/0.1/${name}`],
      { maxBuffer: 2_000_000, stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch {
    throw new Error(
      `Cannot read ${name} from ${XENIA_TAG}. XENIA_REPO must name a Git checkout containing that tag.`
    );
  }
}

const fixtures = new Map();
for (const [name, expectedHash] of Object.entries(EXPECTED)) {
  const bytes = readPinnedSurfaceFile(name);
  assert.equal(sha256(bytes), expectedHash, `${name} must equal the pinned ${XENIA_TAG} bytes`);
  fixtures.set(`${RAW_BASE}/${name}`, bytes);
}

const checkerBytes = fixtures.get(`${RAW_BASE}/check.mjs`);
const checkerUrl = `data:text/javascript;base64,${checkerBytes.toString("base64")}`;
const { CHECKER_VERSION, checkSurface } = await import(checkerUrl);
assert.equal(CHECKER_VERSION, "0.1.0-rc.1");

const writes = [];
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
  return worker.fetch(new Request(url, init), env, context);
}

const result = await checkSurface("https://sinovai.com", {
  fetchImpl,
  timeoutMs: 5_000,
  maxBodyBytes: 1_000_000
});

assert.equal(result.result, "conformant");
assert.equal(result.checks.length, 24);
assert.equal(result.checks.filter((check) => check.outcome === "pass").length, 24);
assert.deepEqual(writes, []);

console.log(JSON.stringify({
  checker_version: CHECKER_VERSION,
  target: result.target,
  result: result.result,
  counts: result.counts,
  writes: writes.length
}));

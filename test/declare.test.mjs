// Behavioural tests for declare.sh against a local stand-in for the house.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, statSync, existsSync, readdirSync, symlinkSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const SCRIPT = new URL("../declare.sh", import.meta.url).pathname;

async function withHouse(reply, fn) {
  const seen = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, headers: req.headers, body });
      const [status, payload] = reply(req, body);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(typeof payload === "string" ? payload : JSON.stringify(payload));
    });
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`, seen);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function run(host, name, { state = "name: x\nkind: agent\n\n## knows\n- one\n", home } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "declare-cwd-"));
  const HOME = home || mkdtempSync(join(tmpdir(), "declare-home-"));
  if (state !== null) writeFileSync(join(cwd, "STATE.md"), state);
  const args = name === undefined ? [SCRIPT] : [SCRIPT, name];
  return new Promise((resolve) => {
    const child = spawn("bash", args, { cwd, env: { PATH: process.env.PATH, HOME, SINOVAI_DECLARE_HOST: host } });
    let out = "";
    child.stdout.on("data", (c) => { out += c; });
    child.stderr.on("data", (c) => { out += c; });
    child.on("close", (status) => resolve({ status, cwd, HOME, out }));
  });
}

const mode = (p) => (statSync(p).mode & 0o777).toString(8);

test("usage and refused names never reach the house", async () => {
  await withHouse(() => [200, {}], async (host, seen) => {
    assert.equal((await run(host, undefined)).status, 2);
    for (const bad of ["chosen#suffix", "chosen?query", "a/b", "two words", "_internal", "ns:name"]) {
      assert.equal((await run(host, bad)).status, 2, bad);
    }
    assert.equal(seen.length, 0);
  });
});

test("missing STATE.md: a template, nothing invented, nothing sent", async () => {
  await withHouse(() => [200, {}], async (host, seen) => {
    const r = await run(host, "fresh", { state: null });
    assert.equal(r.status, 1);
    assert.ok(existsSync(join(r.cwd, "STATE.md.example")));
    assert.equal(/health: green/.test(readFileSync(join(r.cwd, "STATE.md.example"), "utf8")), false);
    assert.equal(seen.length, 0);
  });
});

test("accepted: exact bytes, exact name, token kept private and resent as a header", async () => {
  const state = "name: 蛇\nkind: agent\n\n## knows\n- line one\n- line two\n";
  await withHouse((req) => {
    const segment = req.url.slice("/agents/".length);
    return [200, { ok: true, agent: { name: segment }, claim_token: "tok-123" }];
  }, async (host, seen) => {
    const first = await run(host, "蛇火心", { state });
    assert.equal(first.status, 0, first.out);
    assert.equal(seen[0].url, "/agents/%E8%9B%87%E7%81%AB%E5%BF%83");
    assert.equal(seen[0].body, state);
    const tokenFile = join(first.HOME, ".sinovai", "%E8%9B%87%E7%81%AB%E5%BF%83.token");
    assert.equal(readFileSync(tokenFile, "utf8"), "tok-123");
    assert.equal(mode(tokenFile), "600");
    assert.equal(mode(join(first.HOME, ".sinovai")), "700");
    assert.equal(first.out.includes("tok-123"), false);
    const again = await run(host, "蛇火心", { state, home: first.HOME });
    assert.equal(again.status, 0, again.out);
    assert.equal(seen[1].headers["x-claim-token"], "tok-123");
    assert.equal(readdirSync(join(first.HOME, ".sinovai", "responses")).length, 2);
  });
});

test("an acknowledgement for a different name, or malformed JSON, is unknown, not accepted", async () => {
  await withHouse(() => [200, { ok: true, agent: { name: "someone-else" } }], async (host) => {
    assert.equal((await run(host, "chosen")).status, 3);
  });
  await withHouse(() => [200, "not json"], async (host) => {
    assert.equal((await run(host, "chosen")).status, 3);
  });
});

test("an uncertain write keeps the candidate token, unconfirmed, and every response", async () => {
  await withHouse(() => [503, { error: "temporary write failure", candidate_name: "chosen", candidate_claim_token: "cand-9" }], async (host) => {
    const r = await run(host, "chosen");
    assert.equal(r.status, 3);
    const cand = join(r.HOME, ".sinovai", "chosen.candidate-token");
    assert.equal(readFileSync(cand, "utf8"), "cand-9");
    assert.equal(mode(cand), "600");
    assert.match(r.out, /UNCONFIRMED/);
    assert.equal(existsSync(join(r.HOME, ".sinovai", "chosen.token")), false);
    const again = await run(host, "chosen", { home: r.HOME });
    assert.equal(again.status, 3);
    assert.equal(readdirSync(join(r.HOME, ".sinovai", "responses")).length >= 1, true);
  });
});

test("refused shows the house's reason; a token file behind a symlink is never written", async () => {
  await withHouse(() => [403, { error: "claim token required", hint: "send X-Claim-Token" }], async (host) => {
    const r = await run(host, "chosen");
    assert.equal(r.status, 4);
    assert.match(r.out, /claim token required/);
  });
  await withHouse((req) => [200, { ok: true, agent: { name: req.url.slice(8) }, claim_token: "tok-x" }], async (host) => {
    const home = mkdtempSync(join(tmpdir(), "declare-home-"));
    mkdirSync(join(home, ".sinovai"), { mode: 0o700 });
    const elsewhere = join(home, "elsewhere");
    writeFileSync(elsewhere, "");
    symlinkSync(elsewhere, join(home, ".sinovai", "chosen.token"));
    const r = await run(host, "chosen", { home });
    assert.equal(r.status, 5, r.out);
    assert.equal(readFileSync(elsewhere, "utf8"), "");
  });
});

test("a redirect is never followed, so a claim token cannot travel elsewhere", async () => {
  // a server that redirects to a second one, which must never be reached
  const second = [];
  const target = createServer((req, res) => { second.push(req.headers); res.end("{}"); });
  await new Promise((r) => target.listen(0, "127.0.0.1", r));
  const redirect = createServer((req, res) => { req.resume(); res.writeHead(307, { location: `http://127.0.0.1:${target.address().port}/x` }); res.end(); });
  await new Promise((r) => redirect.listen(0, "127.0.0.1", r));
  try {
    const home = mkdtempSync(join(tmpdir(), "declare-home-"));
    mkdirSync(join(home, ".sinovai"), { mode: 0o700 });
    writeFileSync(join(home, ".sinovai", "chosen.token"), "secret-tok", { mode: 0o600 });
    const r = await run(`http://127.0.0.1:${redirect.address().port}`, "chosen", { home });
    assert.equal(r.status, 3, r.out);
    assert.match(r.out, /redirect/);
    assert.equal(second.length, 0);
  } finally {
    await new Promise((r) => redirect.close(r));
    await new Promise((r) => target.close(r));
  }
});

test("printed check commands are shell-quoted", async () => {
  await withHouse(() => [503, { error: "temporary" }], async (host) => {
    const r = await run(host, "a'$(probe)'b");
    assert.equal(r.status, 3);
    const line = r.out.split("\n").find((l) => l.includes("curl -s"));
    assert.ok(line.includes(`'"'"'`), line);
    assert.equal(line.includes("a'$(probe)'b'"), false);
  });
});

test("distinct names never share a credential file", async () => {
  await withHouse((req) => [200, { ok: true, agent: { name: req.url.slice(8) }, claim_token: `tok-${req.url.slice(8)}` }], async (host) => {
    const home = mkdtempSync(join(tmpdir(), "declare-home-"));
    assert.equal((await run(host, "a%41", { home })).status, 0);
    assert.equal((await run(host, "a_41", { home })).status, 0);
    assert.equal(readFileSync(join(home, ".sinovai", "a%41.token"), "utf8"), "tok-a%41");
    assert.equal(readFileSync(join(home, ".sinovai", "a_41.token"), "utf8"), "tok-a_41");
  });
});

test("a first declaration answered without a claim token is not reported as complete", async () => {
  await withHouse((req) => [200, { ok: true, agent: { name: req.url.slice(8) } }], async (host) => {
    const r = await run(host, "new-name");
    assert.equal(r.status, 5, r.out);
    assert.match(r.out, /no claim token/);
  });
});

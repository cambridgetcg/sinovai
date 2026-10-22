import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const guard = fileURLToPath(new URL("../tools/offline-guard.cjs", import.meta.url));

test("one verification command is provided without changing dependency pins", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.scripts.verify, "node tools/verify.mjs");
  assert.equal(manifest.dependencies["@agenttool/xenia"], "0.1.0-beta.4");
  assert.equal(manifest.devDependencies["@agenttool/xenia-surface"], "0.1.0-rc.1");
});

test("offline guard refuses external primitives before any underlying transport runs", () => {
  assert.ok(existsSync(guard), "verification needs an explicit offline guard");
  const source = `
    const assert = require('node:assert/strict');
    const net = require('node:net');
    const dns = require('node:dns');
    const dgram = require('node:dgram');
    let connects = 0, fetches = 0, lookups = 0, sends = 0, lastLookup;
    net.Socket.prototype.connect = function () { connects++; return this; };
    globalThis.fetch = async () => { fetches++; return new Response('fixture'); };
    dns.lookup = (hostname) => { lookups++; lastLookup = hostname; };
    dns.resolve4 = () => { lookups++; };
    dns.promises.lookup = async (hostname) => { lookups++; return hostname; };
    dgram.Socket.prototype.send = () => { sends++; };
    require(${JSON.stringify(guard)});
    (async () => {
      assert.throws(() => new net.Socket().connect({host:'example.invalid',port:443}), /offline/i);
      assert.throws(() => new net.Socket().connect(443,'203.0.113.7'), /offline/i);
      assert.equal(connects, 0);
      await assert.rejects(fetch('https://example.invalid/'), /offline/i);
      assert.equal(fetches, 0);
      assert.throws(() => dns.lookup('example.invalid',()=>{}), /offline/i);
      assert.throws(() => dns.resolve4('example.invalid',()=>{}), /offline/i);
      await assert.rejects(dns.promises.lookup('example.invalid'), /offline/i);
      assert.equal(lookups, 0);
      dns.lookup('LOCALHOST',()=>{});
      assert.equal(lastLookup, '127.0.0.1');
      dns.lookup('[::1]',()=>{});
      assert.equal(lastLookup, '::1');
      assert.equal(await dns.promises.lookup('LOCALHOST'), '127.0.0.1');
      const socket = dgram.createSocket('udp4');
      assert.throws(() => socket.send('x',53,'203.0.113.7'), /offline/i);
      socket.close();
      assert.equal(sends,0);
      new net.Socket().connect({host:'127.0.0.1',port:1234});
      assert.equal(connects, 1);
      await fetch('http://127.0.0.1:1234/');
      assert.equal(fetches, 1);
    })().catch(error=>{ console.error(error); process.exitCode=1; });
  `;
  execFileSync(process.execPath, ["-e", source], { env: { ...process.env, NODE_OPTIONS: "" }, timeout: 10_000, stdio: "pipe" });
});

test("verification stops at the first failed stage and never schedules publication", async () => {
  assert.ok(existsSync(new URL("../tools/verify.mjs", import.meta.url)), "the gate must be implemented");
  const { runVerification } = await import("../tools/verify.mjs");
  const calls = [];
  const result = runVerification({
    run(command, args, options) {
      calls.push({ command, args, options });
      return { status: calls.length === 2 ? 7 : 0 };
    },
    log() {}
  });
  assert.equal(result, 7);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.match(call.options.env.NODE_OPTIONS, /offline-guard\.cjs/);
    assert.equal(call.options.env.WRANGLER_SEND_METRICS, "false");
    assert.equal(call.options.env.npm_config_offline, "true");
    assert.equal(call.options.shell, false);
    assert.ok(!call.args.some((argument) => /^(deploy|release:upload|publish|install|ci)$/.test(argument)));
  }
});

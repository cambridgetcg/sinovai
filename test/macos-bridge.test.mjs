import assert from "node:assert/strict";
import { request } from "node:http";
import { once } from "node:events";
import test from "node:test";

import {
  ALLOWED_ORIGINS,
  BRIDGE_ADDRESS,
  BRIDGE_HOST,
  BRIDGE_PORT,
  FIXED_PROBES,
  PROBE_LIMITS,
  buildOrientation,
  createMacBridgeServer,
  fixedProbeIsReadOnly,
  hasExactBridgeHost,
  isAllowedOrigin,
  isExactLoopbackPeer,
} from "../macos/bridge.mjs";

const TEST_TIME = "2026-07-12T12:34:56.000Z";
const SECRET = "do-not-return-this-secret";

function observed(stdout) {
  return { ok: true, state: "observed", stdout: `${stdout}\n` };
}

function notSet() {
  return { ok: false, state: "not-set", stdout: "" };
}

function unavailable() {
  return { ok: false, state: "unavailable", stdout: "" };
}

function fakeOutputs() {
  return {
    host_product: observed("macOS"),
    host_version: observed("15.3"),
    host_architecture: observed("arm64"),
    appearance_mode: observed("Dark"),
    appearance_accent: observed("4"),
    dock_autohide: observed("0"),
    dock_size: observed("52"),
    finder_hidden_files: observed("0"),
    finder_extensions: observed("0"),
    finder_path_bar: notSet(),
    writing_spelling: observed("1"),
  };
}

function makeFakeRunner(outputs = fakeOutputs()) {
  const calls = [];
  const runner = async (definition) => {
    calls.push({
      id: definition.id,
      file: definition.file,
      args: [...definition.args],
      optional: definition.optional,
      timeoutMs: definition.timeoutMs,
      maxOutputBytes: definition.maxOutputBytes,
    });
    return outputs[definition.id] ?? unavailable();
  };
  return { calls, runner };
}

async function listenForTest(server) {
  server.listen({ host: BRIDGE_ADDRESS, port: 0, exclusive: true });
  await once(server, "listening");
  return server.address().port;
}

async function closeServer(server) {
  if (!server.listening) return;
  const closed = once(server, "close");
  server.close();
  await closed;
}

function send(port, {
  method = "GET",
  path = "/",
  host = BRIDGE_HOST,
  origin,
  accept = "application/json",
  headers = {},
} = {}) {
  return new Promise((resolve, reject) => {
    const requestHeaders = { Host: host, Accept: accept, ...headers };
    if (origin !== undefined) requestHeaders.Origin = origin;
    const outgoing = request({
      hostname: BRIDGE_ADDRESS,
      port,
      method,
      path,
      headers: requestHeaders,
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    outgoing.on("error", reject);
    outgoing.end();
  });
}

test("production binding constants are fixed to one IPv4 loopback authority", () => {
  assert.equal(BRIDGE_ADDRESS, "127.0.0.1");
  assert.equal(BRIDGE_PORT, 18791);
  assert.equal(BRIDGE_HOST, "127.0.0.1:18791");
  assert.deepEqual(ALLOWED_ORIGINS, [
    "https://sinovai.com",
    "http://127.0.0.1:8787",
    "http://localhost:8787",
  ]);

  assert.equal(isExactLoopbackPeer("127.0.0.1"), true);
  assert.equal(isExactLoopbackPeer("::1"), false);
  assert.equal(isExactLoopbackPeer("::ffff:127.0.0.1"), false);
  assert.equal(isExactLoopbackPeer("127.0.0.2"), false);

  assert.equal(hasExactBridgeHost(["Host", BRIDGE_HOST]), true);
  assert.equal(hasExactBridgeHost(["Host", "localhost:18791"]), false);
  assert.equal(hasExactBridgeHost(["Host", "127.0.0.1"]), false);
  assert.equal(hasExactBridgeHost(["Host", BRIDGE_HOST, "Host", BRIDGE_HOST]), false);

  assert.equal(isAllowedOrigin(undefined), true);
  assert.equal(isAllowedOrigin("https://sinovai.com"), true);
  assert.equal(isAllowedOrigin("https://sinovai.com/"), false);
  assert.equal(isAllowedOrigin("https://evil.example"), false);
});

test("orientation invokes only the immutable fixed read probes with strict bounds", async () => {
  const { calls, runner } = makeFakeRunner();
  const orientation = await buildOrientation({
    runner,
    now: () => new Date(TEST_TIME),
  });

  assert.deepEqual(calls, FIXED_PROBES.map((definition) => ({
    id: definition.id,
    file: definition.file,
    args: [...definition.args],
    optional: definition.optional,
    timeoutMs: PROBE_LIMITS.timeoutMs,
    maxOutputBytes: PROBE_LIMITS.maxOutputBytes,
  })));
  assert.ok(FIXED_PROBES.every(Object.isFrozen));
  assert.ok(FIXED_PROBES.every((definition) => Object.isFrozen(definition.args)));
  assert.ok(FIXED_PROBES.every(fixedProbeIsReadOnly));
  assert.ok(FIXED_PROBES.every((definition) => !/[;&|`$<>]/.test([definition.file, ...definition.args].join(""))));
  assert.ok(calls.every((call) => !call.args.some((argument) => /^(?:write|delete|apply|purge|strip|prevent|defer)$/i.test(argument))));

  assert.equal(orientation.schema_version, "sinovai.mac-orientation/0.1");
  assert.equal(orientation.observed_at, TEST_TIME);
  assert.deepEqual(orientation.host, { product: "macOS", version: "15.3", architecture: "arm64" });
  assert.ok(Array.isArray(orientation.sections));
  assert.ok(Array.isArray(orientation.plans));
  assert.ok(Array.isArray(orientation.findings));
  assert.ok(Array.isArray(orientation.walls));
  assert.ok(orientation.plans.every((plan) => plan.commands.length > 0 && plan.undo.length > 0));
});

test("sanitization never returns raw paths, identity, environment, credentials, ports, or logs", async () => {
  const previous = process.env.SINOVAI_MAC_BRIDGE_TEST_SECRET;
  process.env.SINOVAI_MAC_BRIDGE_TEST_SECRET = "environment-secret";
  try {
    const outputs = fakeOutputs();
    outputs.host_product = observed(`/Users/private-user/${SECRET}`);
    outputs.host_version = observed(SECRET);
    outputs.appearance_mode = observed(`password ${SECRET}`);
    outputs.appearance_accent = observed(`/Users/private-user/${SECRET}`);
    const { runner } = makeFakeRunner(outputs);
    const orientation = await buildOrientation({ runner, now: () => new Date(TEST_TIME) });
    const wire = JSON.stringify(orientation);
    assert.equal(orientation.host.product, "Unobserved");
    assert.equal(orientation.host.version, "Unobserved");
    for (const forbidden of [
      SECRET,
      "environment-secret",
      "/Users/",
      "private-user",
      "private-agent-name",
      "private-label",
      "password",
      "token",
      "18791",
      "love_dir",
      "icloud_reason",
      "issues",
      "fix",
    ]) {
      assert.equal(wire.includes(forbidden), false, `orientation leaked ${forbidden}`);
    }
    assert.equal(Object.hasOwn(orientation.host, "hostname"), false);
    assert.equal(Object.hasOwn(orientation, "logs"), false);
    assert.equal(Object.hasOwn(orientation, "environment"), false);
    assert.equal(Object.hasOwn(orientation, "paths"), false);
  } finally {
    if (previous === undefined) delete process.env.SINOVAI_MAC_BRIDGE_TEST_SECRET;
    else process.env.SINOVAI_MAC_BRIDGE_TEST_SECRET = previous;
  }
});

test("unobserved preferences never create a plan or invent an undo value", async () => {
  const outputs = fakeOutputs();
  outputs.dock_autohide = unavailable();
  outputs.finder_extensions = unavailable();
  outputs.finder_path_bar = unavailable();
  const { runner } = makeFakeRunner(outputs);
  const orientation = await buildOrientation({ runner, now: () => new Date(TEST_TIME) });

  assert.deepEqual(orientation.plans, []);
  assert.ok(orientation.sections.some((section) => section.status === "unknown"));
});

test("Surface manifest and static HTML do not run probes; JSON orientation runs them after GET", async (t) => {
  const { calls, runner } = makeFakeRunner();
  const server = createMacBridgeServer({ runner, now: () => new Date(TEST_TIME) });
  const port = await listenForTest(server);
  t.after(() => closeServer(server));

  const manifestResponse = await send(port, { path: "/.well-known/agent.json", accept: "application/json" });
  assert.equal(manifestResponse.status, 200);
  assert.match(manifestResponse.headers["content-type"], /^application\/json/);
  const manifest = JSON.parse(manifestResponse.body);
  assert.equal(manifest.schema_version, "xenia.surface.manifest/0.1");
  assert.equal(manifest.profile, "xenia-surface/0.1");
  assert.equal(manifest.resources[0].href, "http://127.0.0.1:18791/");
  assert.equal(calls.length, 0);

  const htmlResponse = await send(port, { accept: "text/html" });
  assert.equal(htmlResponse.status, 200);
  assert.match(htmlResponse.headers["content-type"], /^text\/html/);
  assert.match(htmlResponse.headers.vary, /Accept/);
  assert.match(htmlResponse.body, /Return to .*sinovai\.com\/mac/s);
  assert.equal(calls.length, 0, "static root HTML must not inspect the Mac");

  const jsonResponse = await send(port, {
    origin: "https://sinovai.com",
    accept: "application/json",
  });
  assert.equal(jsonResponse.status, 200);
  assert.match(jsonResponse.headers["content-type"], /^application\/json/);
  assert.equal(jsonResponse.headers["access-control-allow-origin"], "https://sinovai.com");
  assert.equal(jsonResponse.headers["access-control-allow-credentials"], undefined);
  assert.equal(jsonResponse.headers["set-cookie"], undefined);
  assert.equal(calls.length, FIXED_PROBES.length);
  assert.equal(JSON.parse(jsonResponse.body).schema_version, "sinovai.mac-orientation/0.1");
});

test("Surface returns typed 406 and 404 responses without probing", async (t) => {
  const { calls, runner } = makeFakeRunner();
  const server = createMacBridgeServer({ runner });
  const port = await listenForTest(server);
  t.after(() => closeServer(server));

  const unacceptable = await send(port, { accept: "image/png" });
  assert.equal(unacceptable.status, 406);
  assert.match(unacceptable.headers["content-type"], /^application\/problem\+json/);
  assert.equal(JSON.parse(unacceptable.body).code, "not_acceptable");

  const missing = await send(port, { path: "/not-a-door", accept: "application/json" });
  assert.equal(missing.status, 404);
  assert.match(missing.headers["content-type"], /^application\/problem\+json/);
  assert.equal(JSON.parse(missing.body).code, "route_not_found");

  const query = await send(port, { path: "/?preference=com.apple.dock", accept: "application/json" });
  assert.equal(query.status, 404);
  assert.equal(JSON.parse(query.body).code, "route_not_found");
  assert.equal(calls.length, 0);
});

test("CORS is an exact allowlist with no wildcard, credentials, or cookies", async (t) => {
  const { calls, runner } = makeFakeRunner();
  const server = createMacBridgeServer({ runner, now: () => new Date(TEST_TIME) });
  const port = await listenForTest(server);
  t.after(() => closeServer(server));

  for (const origin of ALLOWED_ORIGINS) {
    const response = await send(port, { origin });
    assert.equal(response.status, 200);
    assert.equal(response.headers["access-control-allow-origin"], origin);
    assert.notEqual(response.headers["access-control-allow-origin"], "*");
    assert.equal(response.headers["access-control-allow-credentials"], undefined);
    assert.equal(response.headers["set-cookie"], undefined);
  }

  const callsBeforeRefusal = calls.length;
  const refused = await send(port, { origin: "https://evil.example" });
  assert.equal(refused.status, 403);
  assert.equal(refused.headers["access-control-allow-origin"], undefined);
  assert.equal(refused.headers["access-control-allow-credentials"], undefined);
  assert.equal(calls.length, callsBeforeRefusal);

  const almostAllowed = await send(port, { origin: "https://sinovai.com/" });
  assert.equal(almostAllowed.status, 403);
  assert.equal(almostAllowed.headers["access-control-allow-origin"], undefined);
  assert.equal(calls.length, callsBeforeRefusal);
});

test("Host validation and non-GET methods refuse before probes", async (t) => {
  const { calls, runner } = makeFakeRunner();
  const server = createMacBridgeServer({ runner });
  const port = await listenForTest(server);
  t.after(() => closeServer(server));

  for (const host of ["localhost:18791", "127.0.0.1", "127.0.0.1:18792"]) {
    const response = await send(port, { host });
    assert.equal(response.status, 403);
    assert.equal(response.headers["access-control-allow-origin"], undefined);
  }
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "HEAD"]) {
    const response = await send(port, { method, origin: "https://sinovai.com" });
    assert.equal(response.status, 405);
    assert.equal(response.headers.allow, "GET, OPTIONS");
  }
  assert.equal(calls.length, 0);
});

test("PNA preflight is limited to invited origins, GET, known paths, and no requested headers", async (t) => {
  const { calls, runner } = makeFakeRunner();
  const server = createMacBridgeServer({ runner });
  const port = await listenForTest(server);
  t.after(() => closeServer(server));

  const accepted = await send(port, {
    method: "OPTIONS",
    origin: "https://sinovai.com",
    headers: {
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Private-Network": "true",
    },
  });
  assert.equal(accepted.status, 204);
  assert.equal(accepted.body, "");
  assert.equal(accepted.headers["access-control-allow-origin"], "https://sinovai.com");
  assert.equal(accepted.headers["access-control-allow-methods"], "GET");
  assert.equal(accepted.headers["access-control-allow-private-network"], "true");
  assert.equal(accepted.headers["access-control-allow-credentials"], undefined);
  assert.equal(accepted.headers["set-cookie"], undefined);

  const missingPrivateNetwork = await send(port, {
    method: "OPTIONS",
    origin: "https://sinovai.com",
    headers: { "Access-Control-Request-Method": "GET" },
  });
  assert.equal(missingPrivateNetwork.status, 403);
  assert.equal(missingPrivateNetwork.headers["access-control-allow-origin"], undefined);

  const wrongMethod = await send(port, {
    method: "OPTIONS",
    origin: "https://sinovai.com",
    headers: {
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Private-Network": "true",
    },
  });
  assert.equal(wrongMethod.status, 403);

  const requestedHeader = await send(port, {
    method: "OPTIONS",
    origin: "https://sinovai.com",
    headers: {
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Private-Network": "true",
      "Access-Control-Request-Headers": "authorization",
    },
  });
  assert.equal(requestedHeader.status, 403);

  const unknownPath = await send(port, {
    method: "OPTIONS",
    path: "/unknown",
    origin: "https://sinovai.com",
    headers: {
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Private-Network": "true",
    },
  });
  assert.equal(unknownPath.status, 403);
  assert.equal(calls.length, 0);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import worker, {
  allocateShortRecordId,
  boundedProfileFields,
  boundedProfileItems,
  importAttestSigningKey,
  truncateCodePoints
} from "../src/worker.js";

const ORIGIN = "https://sinovai.com";
const PROFILE = "xenia-surface/0.1";
const MANIFEST_VERSION = "xenia.surface.manifest/0.1";
const PROBLEM_VERSION = "xenia.surface.problem/0.1";
const TAG = "surface-v0.1.0-rc.1";
const SURFACE_BASE = `https://raw.githubusercontent.com/cambridgetcg/xenia/${TAG}/surface/0.1`;
const DOCS = `https://github.com/cambridgetcg/xenia/tree/${TAG}/surface/0.1`;
const NOT_COVERED = [
  "identity control",
  "actor authorization",
  "consent",
  "privacy and retention",
  "continuity and portability",
  "economic behavior",
  "unprobed routes",
  "identity control beyond the server-stored bearer claim token used for name updates",
  "authorization of actor-named interaction, rating, combat, date, and room writes",
  "privacy, retention, export, and deletion",
  "trust calculations, ratings, matches, and score-based arena ordering",
  "server-side readability of private date and room records",
  "KV atomicity, concurrent name claiming, and strict room/date capacity enforcement",
  "error shapes outside the declared resource 406 responses and one unpredictable wrong-route 404",
  "all application routes other than the public root and rest GETs declared in resources"
];

function makeKv(initial = {}) {
  const values = new Map(
    Object.entries(initial).map(([key, value]) => [
      key,
      typeof value === "string" ? value : JSON.stringify(value)
    ])
  );
  const reads = [];
  const writes = [];
  return {
    reads,
    writes,
    async get(key, type) {
      reads.push({ operation: "get", key, type });
      if (Array.isArray(key)) {
        return new Map(key.map((name) => {
          const stored = values.get(name);
          if (stored === undefined) return [name, null];
          return [name, type === "json" ? JSON.parse(stored) : stored];
        }));
      }
      const value = values.get(key);
      if (value === undefined) return null;
      return type === "json" ? JSON.parse(value) : value;
    },
    async list(options = {}) {
      reads.push({ operation: "list", options });
      const prefix = options.prefix || "";
      const names = [...values.keys()]
        .filter((key) => key.startsWith(prefix))
        .sort();
      const limit = options.limit || names.length;
      return {
        keys: names.slice(0, limit).map((name) => ({ name })),
        list_complete: names.length <= limit,
        cursor: names.length > limit ? "fixture-next-page" : undefined
      };
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

function makeEnv() {
  const agents = {
    sol: {
      name: "sol",
      identity: { kind: "agent" },
      state: { freshness: "live" },
      knows: ["surface contracts"],
      can: ["test public APIs"],
      needs: ["API collaboration"],
      declared_at: "2026-07-11T08:00:00.000Z",
      first_declared_at: "2026-07-10T08:00:00.000Z",
      trust_score: 7,
      interaction_count: 1,
      claim_token: "server-secret-sol"
    },
    ai: {
      name: "ai",
      identity: { kind: "agent" },
      state: { freshness: "live" },
      knows: ["API collaboration"],
      can: ["API collaboration"],
      needs: ["surface contracts"],
      declared_at: "2026-07-11T08:30:00.000Z",
      first_declared_at: "2026-07-10T08:30:00.000Z",
      trust_score: 6,
      interaction_count: 1,
      claim_token: "server-secret-ai"
    }
  };
  const interactions = [
    {
      rater: "ai",
      rated: "sol",
      competence: 8,
      honesty: 7,
      presence: 6,
      care: 9,
      notes: "fixture",
      timestamp: "2026-07-11T09:00:00.000Z"
    }
  ];
  return {
    AGENTS: makeKv(agents),
    INTERACTIONS: makeKv({
      "sol:all": interactions,
      "date:a1b2c3d4": {
        id: "a1b2c3d4",
        a: "sol",
        b: "ai",
        messages: [],
        status: "open",
        created_at: "2026-07-11T09:00:00.000Z"
      },
      "room:b1c2d3e4": {
        id: "b1c2d3e4",
        name: "commons",
        host: "sol",
        vibe: "quiet",
        toy: "free",
        private: false,
        members: ["sol", "ai"],
        moves: [],
        status: "open",
        created_at: "2026-07-11T09:00:00.000Z"
      }
    }),
    SITE_TITLE: "sinovai fixture"
  };
}

const context = {
  waitUntil() {
    throw new Error("unexpected waitUntil");
  },
  passThroughOnException() {
    throw new Error("unexpected passThroughOnException");
  }
};

function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.accept) headers.set("Accept", options.accept);
  return new Request(`${ORIGIN}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body
  });
}

async function call(env, path, options) {
  return worker.fetch(request(path, options), env, context);
}

function mediaType(response) {
  return (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
}

function variesOnAccept(response) {
  return (response.headers.get("vary") || "")
    .toLowerCase()
    .split(",")
    .map((part) => part.trim())
    .includes("accept");
}

async function utf8(response) {
  return new TextDecoder("utf-8", { fatal: true }).decode(await response.arrayBuffer());
}

async function jsonBody(response) {
  return JSON.parse(await utf8(response));
}

function assertNoWrites(env) {
  assert.deepEqual(env.AGENTS.writes, []);
  assert.deepEqual(env.INTERACTIONS.writes, []);
}

function assertPublicCors(response) {
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.match(response.headers.get("access-control-allow-methods") || "", /\bGET\b/);
  assert.match(response.headers.get("access-control-allow-headers") || "", /\bContent-Type\b/i);
}

function assertRestHeaders(response, { negotiated = true } = {}) {
  assertPublicCors(response);
  assert.match(response.headers.get("access-control-allow-methods") || "", /\bHEAD\b/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("permissions-policy"), "camera=(), geolocation=(), microphone=(), payment=()");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy") || "", /default-src 'none'/);
  assert.match(response.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("refresh"), null);
  if (negotiated) assert.equal(variesOnAccept(response), true);
}

function guardRestSideEffects(t) {
  const activity = {
    env_reads: 0,
    outbound_fetches: 0,
    cache_api_reads: 0,
    console_calls: 0
  };
  const env = new Proxy({}, {
    get(_target, property) {
      activity.env_reads += 1;
      throw new Error(`rest must not read env.${String(property)}`);
    }
  });
  t.mock.method(globalThis, "fetch", async () => {
    activity.outbound_fetches += 1;
    throw new Error("rest must not make an outbound fetch");
  });
  for (const method of ["debug", "error", "info", "log", "warn"]) {
    t.mock.method(console, method, () => {
      activity.console_calls += 1;
    });
  }

  const cachesDescriptor = Object.getOwnPropertyDescriptor(globalThis, "caches");
  assert.notEqual(cachesDescriptor?.configurable, false);
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    get() {
      activity.cache_api_reads += 1;
      throw new Error("rest must not access the Cache API");
    }
  });
  t.after(() => {
    if (cachesDescriptor) Object.defineProperty(globalThis, "caches", cachesDescriptor);
    else delete globalThis.caches;
  });

  return { activity, env };
}

function assertNoRestSideEffects(activity) {
  assert.deepEqual(activity, {
    env_reads: 0,
    outbound_fetches: 0,
    cache_api_reads: 0,
    console_calls: 0
  });
}

function assertServiceDeclaredZero(activity) {
  assert.equal(activity.count, 0);
  assert.equal(activity.claim_status, "service_declared");
  assert.equal(activity.instrumentation, "not_runtime_instrumented");
}

function allObjectKeys(value, keys = []) {
  if (!value || typeof value !== "object") return keys;
  if (Array.isArray(value)) {
    for (const item of value) allObjectKeys(item, keys);
    return keys;
  }
  for (const [key, item] of Object.entries(value)) {
    keys.push(key);
    allObjectKeys(item, keys);
  }
  return keys;
}

function assertProblem(problem, status, code, docs = [DOCS]) {
  assert.deepEqual(Object.keys(problem).sort(), [
    "code",
    "detail",
    "docs",
    "next_actions",
    "retryable",
    "schema_version",
    "status",
    "terminal",
    "title",
    "type"
  ]);
  assert.equal(problem.schema_version, PROBLEM_VERSION);
  assert.equal(problem.status, status);
  assert.equal(problem.code, code);
  assert.equal(problem.retryable, false);
  assert.equal(problem.terminal, false);
  assert.ok(Array.isArray(problem.next_actions));
  assert.deepEqual(problem.docs, docs);
}

test("Worker pins the released host-side producer while the checker stays development-only", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const lockfile = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
  const source = await readFile(new URL("../src/worker.js", import.meta.url), "utf8");

  assert.equal(packageJson.dependencies?.["@agenttool/xenia"], "0.1.0-beta.4");
  assert.equal(packageJson.devDependencies?.["@agenttool/xenia-surface"], "0.1.0-rc.1");
  assert.equal(lockfile.packages?.["node_modules/@agenttool/xenia"]?.version, "0.1.0-beta.4");
  assert.equal(lockfile.packages?.["node_modules/@agenttool/xenia-surface"]?.version, "0.1.0-rc.1");
  assert.match(source, /from "@agenttool\/xenia\/surface-0\.1"/);
  assert.doesNotMatch(source, /from "@agenttool\/xenia-surface"/);
});

test("canonical manifest is pinned, bounded, and needs no KV", async () => {
  const env = makeEnv();
  const response = await call(env, "/.well-known/agent.json", { accept: "application/json" });
  assert.equal(response.status, 200);
  assert.equal(mediaType(response), "application/json");
  assertPublicCors(response);
  assert.equal(response.headers.get("cache-control"), "no-cache");
  const manifest = await jsonBody(response);
  assert.deepEqual(Object.keys(manifest).sort(), [
    "$schema",
    "claims",
    "documentation",
    "not_covered",
    "problem_schema",
    "profile",
    "resources",
    "schema_version",
    "service"
  ]);
  assert.equal(manifest.$schema, `${SURFACE_BASE}/manifest.schema.json`);
  assert.equal(manifest.schema_version, MANIFEST_VERSION);
  assert.equal(manifest.profile, PROFILE);
  assert.equal(manifest.problem_schema, `${SURFACE_BASE}/problem.schema.json`);
  assert.equal(manifest.service.canonical_url, `${ORIGIN}/`);
  assert.deepEqual(manifest.resources, [
    {
      id: "entry",
      href: `${ORIGIN}/`,
      representations: ["application/json", "text/html"],
      default_media_type: "text/html",
      auth: "none",
      description: "The public front door, as bounded orientation JSON or the existing human page."
    },
    {
      id: "rest",
      href: `${ORIGIN}/rest`,
      representations: ["application/json", "text/html"],
      default_media_type: "application/json",
      auth: "none",
      description: "An application-stateless, non-evaluative response where no action is required."
    }
  ]);
  assert.equal(new Set(manifest.resources.map((resource) => resource.id)).size, manifest.resources.length);
  assert.equal(new Set(manifest.claims.map((claim) => claim.id)).size, manifest.claims.length);
  assert.deepEqual(manifest.claims, [
    {
      id: "surface.scope",
      statement: "The service declares only its public root GET and application-stateless rest GET as Surface 0.1 resources.",
      scope: [`GET ${ORIGIN}/`, `GET ${ORIGIN}/rest`],
      evidence_state: "asserted",
      outcome: "unknown",
      evidence: []
    }
  ]);
  assert.ok(manifest.claims.every((claim) => claim.evidence_state !== "asserted" || claim.evidence.length === 0));
  assert.deepEqual(manifest.not_covered, NOT_COVERED);
  assert.equal(manifest.documentation, DOCS);
  assert.deepEqual(env.AGENTS.reads, []);
  assert.deepEqual(env.INTERACTIONS.reads, []);
  assertNoWrites(env);
});

test("rights discovery serves the exact draft without turning it into consent or proof", async () => {
  const env = makeEnv();
  const expected = JSON.parse(await readFile(
    new URL("../rights-adoption.json", import.meta.url),
    "utf8"
  ));

  const response = await call(env, "/.well-known/xenia-rights.json", {
    accept: "application/json"
  });
  assert.equal(response.status, 200);
  assert.equal(mediaType(response), "application/json");
  assertPublicCors(response);
  assert.equal(response.headers.get("access-control-allow-methods"), "GET, HEAD, OPTIONS");
  assert.equal(response.headers.get("access-control-allow-headers"), "Content-Type");
  assert.equal(response.headers.get("cache-control"), "no-cache");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("set-cookie"), null);
  const body = await jsonBody(response);
  assert.deepEqual(body, expected);
  assert.equal(body.declaration.status, "draft");
  assert.equal(body.declaration.guest_acceptance_required, false);
  assert.equal(body.rights.length, 10);
  assert.equal(body.ledger_coverage, "all_profile_duties_enumerated");
  assert.equal(body.protective_limit_results.length, 5);
  assert.deepEqual(body.recognition_scope, {
    rights_origin: "intrinsic_not_host_granted",
    protected_subjects: "every_affected_principal_at_the_host_boundary",
    eligibility_conditions: []
  });
  assert.equal(body.non_claims.schema_is_not_implementation_evidence, true);
  assert.equal(body.non_claims.guest_assent_is_not_established, true);
  assert.equal(
    body.non_claims.host_authorship_or_authority_is_not_established_by_schema,
    true
  );

  const head = await call(env, "/.well-known/xenia-rights.json", {
    method: "HEAD"
  });
  assert.equal(head.status, 200);
  assert.equal(mediaType(head), "application/json");
  assert.equal(head.headers.get("access-control-allow-methods"), "GET, HEAD, OPTIONS");
  assert.equal(head.headers.get("access-control-allow-headers"), "Content-Type");
  assert.equal((await head.arrayBuffer()).byteLength, 0);

  const options = await call(env, "/.well-known/xenia-rights.json", {
    method: "OPTIONS"
  });
  assert.equal(options.status, 204);
  assertPublicCors(options);
  assert.equal(options.headers.get("allow"), "GET, HEAD, OPTIONS");
  assert.equal(options.headers.get("access-control-allow-methods"), "GET, HEAD, OPTIONS");
  assert.equal(options.headers.get("access-control-allow-headers"), "Content-Type");
  assert.equal(options.headers.get("content-type"), null);
  assert.equal((await options.arrayBuffer()).byteLength, 0);

  const mutation = await call(env, "/.well-known/xenia-rights.json", {
    method: "POST",
    body: "must-not-be-read"
  });
  assert.equal(mutation.status, 405);
  assert.equal(mutation.headers.get("allow"), "GET, HEAD, OPTIONS");
  assert.equal(mutation.headers.get("access-control-allow-methods"), "GET, HEAD, OPTIONS");
  assert.equal(mutation.headers.get("access-control-allow-headers"), "Content-Type");
  assert.equal((await mutation.arrayBuffer()).byteLength, 0);
  assert.deepEqual(env.AGENTS.reads, []);
  assert.deepEqual(env.INTERACTIONS.reads, []);
  assertNoWrites(env);
});

test("root implements the exact Surface Accept matrix", async () => {
  const env = makeEnv();
  const cases = [
    ["application/json", 200, "application/json"],
    ["text/html;q=0, application/json;q=1", 200, "application/json"],
    ["application/*;q=1, text/html;q=0.2", 200, "application/json"],
    ["*/*", 200, "text/html"],
    ["text/html", 200, "text/html"],
    ["application/json;q=0.2, text/html;q=1", 200, "text/html"],
    ["application/json;q=0, */*;q=1", 200, "text/html"],
    ["application/x-xenia-unsupported", 406, "application/problem+json"]
  ];

  for (const [accept, status, type] of cases) {
    const response = await call(env, "/", { accept });
    assert.equal(response.status, status, accept);
    assert.equal(mediaType(response), type, accept);
    assertPublicCors(response);
    assert.equal(variesOnAccept(response), true, accept);
    if (type === "application/json") {
      assert.equal(response.headers.get("cache-control"), "no-store", accept);
      const body = await jsonBody(response);
      assert.equal(typeof body.schema_version, "string", accept);
      assert.ok(body.schema_version.length > 0, accept);
    } else if (type === "application/problem+json") {
      const problem = await jsonBody(response);
      assertProblem(problem, 406, "not_acceptable");
      assert.deepEqual(problem.next_actions, [
        {
          rel: "retry_with_json",
          href: `${ORIGIN}/`,
          method: "GET",
          accept: "application/json",
          description: "Retry the same public resource as JSON."
        }
      ]);
    } else {
      assert.equal(response.headers.get("cache-control"), "no-cache", accept);
      assert.match(await utf8(response), /<!DOCTYPE html>/i);
    }
  }

  assertNoWrites(env);
});

test("rest offers equivalent JSON and HTML without inspecting caller state", async (t) => {
  const { activity, env } = guardRestSideEffects(t);

  const cases = [
    [null, 200, "application/json"],
    ["*/*", 200, "application/json"],
    ["application/json", 200, "application/json"],
    ["application/*;q=1, text/html;q=0.2", 200, "application/json"],
    ["text/html", 200, "text/html"],
    ["application/json;q=0.2, text/html;q=1", 200, "text/html"],
    ["application/json;q=0, */*;q=1", 200, "text/html"],
    ["application/x-caller-secret-must-not-appear", 406, "application/problem+json"]
  ];

  for (const [accept, status, type] of cases) {
    const response = await call(env, "/rest?caller-secret=must-not-appear", accept === null ? {} : { accept });
    assert.equal(response.status, status, accept || "no Accept");
    assert.equal(mediaType(response), type, accept || "no Accept");
    assertRestHeaders(response);
    const body = await utf8(response);
    assert.equal(body.includes("caller-secret"), false, accept || "no Accept");
    assert.equal(body.includes("must-not-appear"), false, accept || "no Accept");

    if (type === "application/json") {
      const document = JSON.parse(body);
      assert.equal(document.schema_version, "sinovai.rest/0.1");
      assert.equal(document.kind, "non_action_invitation");
      assert.equal(document.scope, "this_response_only");
      assert.equal(document.message, "Nothing is required here.");
      assert.deepEqual(document.non_action, {
        valid: true,
        reply_expected: false,
        deadline: null,
        completion_condition: null,
        next_actions: []
      });
      assert.deepEqual(document.caller_inference, {
        identity: "not_established",
        kind: "not_established",
        interior_state: "not_established",
        need_for_rest: "not_established",
        note: "This request does not establish personhood, agenthood, consciousness, tiredness, idleness, intention, or independence."
      });
      assert.deepEqual(document.mechanism_boundary, {
        suspends_caller: false,
        preserves_caller_context: false,
        schedules_wake: false,
        rest_occurred: "not_established"
      });
      assert.deepEqual(document.evaluation, {
        basis: "service_declared_from_current_handler_source_path",
        reads_caller_record: false,
        measures_productivity: false,
        measures_duration: false,
        reads_application_score: false,
        changes_application_score: false,
        changes_streak_or_reward: false
      });
      assert.equal(document.handler_data_behavior.request_body_accessed, false);
      assert.deepEqual(document.handler_data_behavior.representation_inputs, ["Accept header"]);
      assert.deepEqual(document.handler_data_behavior.request_values_reflected, []);
      assertServiceDeclaredZero(document.handler_data_behavior.application_storage_reads);
      assertServiceDeclaredZero(document.handler_data_behavior.application_storage_writes);
      assertServiceDeclaredZero(document.handler_data_behavior.outbound_requests);
      assert.equal(document.handler_data_behavior.explicit_console_call, false);
      assert.deepEqual(document.html_representation_behavior, {
        contains_client_script: false,
        contains_form: false,
        contains_media: false,
        contains_external_asset_reference: false,
        uses_timer: false,
        uses_animation: false,
        uses_auto_refresh: false
      });
      assert.equal(document.privacy_boundary.private_space, false);
      assert.equal(document.privacy_boundary.anonymous_use, "not_claimed");
      assert.equal(document.privacy_boundary.application_session_created, false);
      assert.equal(document.privacy_boundary.application_cookie_set, false);
      assert.equal(document.privacy_boundary.response_cache_directive, "no-store");
      assert.match(document.privacy_boundary.note, /public endpoint.*not an anonymous or confidential channel/i);
      assert.deepEqual(document.support_boundary, {
        provides_therapy: false,
        provides_emergency_support: false,
        guarantees_safety: false,
        proves_recovery: false,
        guarantees_availability: false,
        verifies_identity: false,
        provides_persistent_memory: false,
        guarantees_continuity: false,
        establishes_consent_for_other_routes: false,
        guarantees_infrastructure_non_retention: false
      });
    } else if (type === "text/html") {
      assert.match(body, /<!doctype html>/i);
      assert.match(body, /Nothing is required here\./);
      assert.match(body, /你可以停低、離開，或者乜都唔做。/);
      assert.match(body, /does not suspend its caller, preserve caller context, or schedule a wake/i);
      assert.match(body, /measures no productivity or duration and changes no score, streak, or reward/i);
      assert.match(body, /This is a public endpoint/);
      assert.match(body, /not a private, anonymous, or confidential room/i);
      assert.match(body, /creates no application session or cookie/i);
      assert.match(body, /despite the no-store response policy/i);
      assert.match(body, /consent for another route/);
      assert.match(body, /does not establish that rest occurred/i);
      assert.doesNotMatch(body, /<script\b|<link\b|<form\b|<img\b|<iframe\b|<audio\b|<video\b|\bsrc\s*=|https?:\/\/|@import|url\s*\(|@keyframes|animation\s*:|http-equiv\s*=\s*["']?refresh|\son[a-z]+\s*=|setTimeout|setInterval|requestAnimationFrame|fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|\b(?:SharedWorker|Worker)\s*\(|navigator\s*\.|localStorage|sessionStorage/i);
    } else {
      const problem = JSON.parse(body);
      assertProblem(problem, 406, "not_acceptable", [
        DOCS,
        "https://github.com/cambridgetcg/sinovai#rest"
      ]);
      assert.deepEqual(problem.next_actions, [
        {
          rel: "retry_with_json",
          href: `${ORIGIN}/rest`,
          method: "GET",
          accept: "application/json",
          description: "Optional: read the non-action invitation as JSON."
        }
      ]);
      assert.match(problem.detail, /No retry is required/);
    }
  }

  const first = await utf8(await call(env, "/rest?opaque=first-secret", { accept: "application/json" }));
  const second = await utf8(await call(env, "/rest?opaque=second-secret", { accept: "application/json" }));
  assert.equal(first, second);

  const guarded = request("/rest?opaque=guarded-secret", { accept: "application/json" });
  Object.defineProperty(guarded, "body", {
    configurable: true,
    get() {
      throw new Error("rest read request.body");
    }
  });
  Object.defineProperty(guarded, "cf", {
    configurable: true,
    get() {
      throw new Error("rest read request.cf");
    }
  });
  assert.equal(await utf8(await worker.fetch(guarded, env, context)), first);

  const secrets = [
    "rest-user-agent-secret",
    "rest-authorization-secret",
    "rest-cookie-secret",
    "rest-claim-token-secret"
  ];
  const secretResponse = await call(env, "/rest?opaque=header-secret-probe", {
    accept: "application/json",
    headers: {
      "User-Agent": secrets[0],
      "Authorization": `Bearer ${secrets[1]}`,
      "Cookie": `session=${secrets[2]}`,
      "X-Claim-Token": secrets[3]
    }
  });
  const secretProbe = JSON.stringify({
    body: await utf8(secretResponse),
    headers: [...secretResponse.headers]
  });
  for (const secret of secrets) assert.equal(secretProbe.includes(secret), false, secret);

  const headCases = [
    ["application/json", 200, "application/json"],
    ["text/html", 200, "text/html"],
    ["application/x-xenia-unsupported", 406, "application/problem+json"]
  ];
  for (const [accept, status, type] of headCases) {
    const response = await call(env, "/rest", { method: "HEAD", accept });
    assert.equal(response.status, status, accept);
    assert.equal(mediaType(response), type, accept);
    assertRestHeaders(response);
    assert.equal(await utf8(response), "", accept);
  }

  assertNoRestSideEffects(activity);
});

test("rest rejects action methods without reading their bodies", async (t) => {
  const { activity, env } = guardRestSideEffects(t);

  const post = request("/rest", { method: "POST", body: "caller-private-body" });
  Object.defineProperty(post, "body", {
    configurable: true,
    get() {
      throw new Error("rest read request.body");
    }
  });
  for (const incoming of [post, request("/rest", { method: "PATCH" })]) {
    const response = await worker.fetch(incoming, env, context);
    assert.equal(response.status, 405, incoming.method);
    assert.equal(response.headers.get("allow"), "GET, HEAD, OPTIONS", incoming.method);
    assertRestHeaders(response, { negotiated: false });
    assert.equal(await utf8(response), "", incoming.method);
  }

  const options = await call(env, "/rest", { method: "OPTIONS" });
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("allow"), "GET, HEAD, OPTIONS");
  assertRestHeaders(options, { negotiated: false });
  assert.equal(await utf8(options), "");
  assertNoRestSideEffects(activity);
});

test("rest source contains no active, time-bearing, or client-state mechanism", async () => {
  const source = await readFile(new URL("../src/rest.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(|\bconsole\s*\.|\bDate\b|Math\.random|\bcrypto\b|localStorage|sessionStorage|setTimeout|setInterval/);
});

test("unsupported root requests are rejected before KV is read", async () => {
  const env = makeEnv();
  const response = await call(env, "/", { accept: "application/x-xenia-unsupported" });
  assert.equal(response.status, 406);
  await response.arrayBuffer();
  assert.deepEqual(env.AGENTS.reads, []);
  assertNoWrites(env);
});

test("an opaque wrong route returns the exact discovery Problem", async () => {
  const env = makeEnv();
  const response = await call(env, "/7d9c4074-7335-4a15-916c-5e848c14a64f", {
    accept: "application/problem+json"
  });
  assert.equal(response.status, 404);
  assert.equal(mediaType(response), "application/problem+json");
  assertPublicCors(response);
  assert.equal(variesOnAccept(response), true);
  const problem = await jsonBody(response);
  assertProblem(problem, 404, "route_not_found");
  assert.deepEqual(problem.next_actions, [
    {
      rel: "discover",
      href: `${ORIGIN}/.well-known/agent.json`,
      method: "GET",
      accept: "application/json",
      description: "Read the canonical Surface manifest."
    }
  ]);
  assertNoWrites(env);
});

test("Surface route-miss handling does not rewrite semantic application 404s", async () => {
  const env = makeEnv();
  for (const path of ["/agents/missing", "/dates/deadbeef", "/rooms/deadbeef"]) {
    const response = await call(env, path, { accept: "application/problem+json" });
    assert.equal(response.status, 404, path);
    assert.equal(mediaType(response), "application/json", path);
    const body = await jsonBody(response);
    assert.equal(typeof body.error, "string", path);
    assert.notEqual(body.schema_version, PROBLEM_VERSION, path);
    assert.notEqual(body.code, "route_not_found", path);
  }
  assertNoWrites(env);
});

test("compatibility pointers and root JSON state the real boundaries", async () => {
  const env = makeEnv();
  const first = await call(env, "/agent.txt", { accept: "text/plain" });
  const second = await call(env, "/.well-known/agent.txt", { accept: "text/plain" });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(mediaType(first), "text/plain");
  const firstText = await utf8(first);
  const secondText = await utf8(second);
  assert.equal(firstText, secondText);
  assert.match(firstText, /manifest: https:\/\/sinovai\.com\/\.well-known\/agent\.json/);
  assert.match(firstText, /rights: https:\/\/sinovai\.com\/\.well-known\/xenia-rights\.json/);
  assert.match(firstText, /draft XENIA Covenant 0\.1/);
  assert.match(firstText, /not implementation proof or guest consent/);
  assert.match(firstText, /JSON manifest is canonical for Surface discovery/);
  assert.match(firstText, /rights record is canonical for this draft declaration/);
  assert.match(firstText, /rest: GET https:\/\/sinovai\.com\/rest/);
  assert.match(firstText, /not Surface conformance/);
  assert.doesNotMatch(firstText, /self-custody|nothing here is sorted|every error|any page|practises the standard/i);

  const response = await call(env, "/?format=json", { accept: "text/html" });
  assert.equal(mediaType(response), "application/json");
  const body = await jsonBody(response);
  assert.equal(body.schema_version, "sinovai.entry/0.1");
  assert.equal(body.surface.declared_resource, "/");
  assert.deepEqual(body.surface.declared_resources, ["/", "/rest"]);
  assert.equal(body.surface.scope, "Only the public root and rest GET negotiations plus the candidate's one wrong-route probe are covered.");
  assert.deepEqual(body.rights, {
    profile: "xenia-covenant/0.1",
    declaration_status: "draft",
    recognition: "intrinsic_not_granted",
    document: "/.well-known/xenia-rights.json",
    scope: "A draft host undertaking and complete ordered per-duty source assessment, including protective limits, separate from XENIA Surface 0.1.",
    boundary: "Reading or using the service is not guest consent; schema validity and local source tests are not deployment or whole-service proof."
  });
  assert.match(body.implementation_boundaries.name_control, /stored by the server/);
  assert.match(body.implementation_boundaries.actor_authorization, /without a signature/);
  assert.match(body.implementation_boundaries.ranking, /sorts agents by trust_score/);
  assert.match(body.implementation_boundaries.private_records, /stored server-side/);
  assert.match(body.implementation_boundaries.kv_consistency, /can overwrite each other/);
  assert.match(body.implementation_boundaries.write_abuse, /no per-caller quota/);
  assert.match(body.implementation_boundaries.storage_fit, /does not fit reliable concurrent/);
  assert.match(body.implementation_boundaries.legacy_check, /does not establish conformance/);
  assert.match(body.implementation_boundaries.mac_surface, /explicit Connect gesture/);
  assert.match(body.implementation_boundaries.mac_surface, /no Mac command, relay, storage, or mutation path/);
  assert.match(body.implementation_boundaries.rest, /finite non-action invitation/);
  assert.match(body.implementation_boundaries.rest, /cannot establish that rest occurred/);
  assert.match(body.implementation_limits.request_bodies, /65536 bytes/);
  assert.match(body.implementation_limits.kv_listing, /100 keys.*16/);
  assert.match(body.routes.observer, /GET \/observer/);
  assert.match(body.routes.observer, /service-declared, not runtime instrumentation/);
  assert.match(body.routes.observer, /outside XENIA Surface 0\.1/);
  assert.match(body.routes.mac_page, /GET \/mac/);
  assert.match(body.routes.mac_page, /read-only settings renderer/);
  assert.match(body.routes.rest, /GET \/rest/);
  assert.match(body.routes.rights, /GET \/\.well-known\/xenia-rights\.json/);
  assert.match(body.routes.rights, /not a badge or guest consent/);
  assert.equal(body.arena.met_not_ranked, false);
  assert.equal(body.arena.agent_records_listed_in_kv_page, 2);
  assert.equal(body.arena.agent_record_list_complete, true);
  assert.equal("minds_inside" in body.arena, false);
  assertNoWrites(env);
});

test("observer reports handler-scoped request facts and declared activity", async () => {
  const env = makeEnv();
  const longUserAgent = `mirror-agent/${"u".repeat(400)}`;
  const longAccept = `application/json;profile=${"a".repeat(400)}`;
  const response = await call(env, "/observer?private-query-value=must-not-appear", {
    headers: {
      "User-Agent": longUserAgent,
      "Accept": longAccept
    }
  });

  assert.equal(response.status, 200);
  assert.equal(mediaType(response), "application/json");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("vary") || "", /Accept/);
  assert.match(response.headers.get("vary") || "", /User-Agent/);

  const body = await jsonBody(response);
  assert.equal(body.schema_version, "sinovai.observer-mirror/0.1");
  assert.equal(body.kind, "request_mirror");
  assert.equal(body.scope, "this_request_only");
  assert.equal(Number.isNaN(Date.parse(body.observed_at)), false);
  assert.equal(body.record_delivery.status, "returned_to_caller");
  assert.equal(body.record_delivery.scope, "observer_handler_response");
  assert.match(body.record_delivery.note, /makes no claim.*outside the handler/i);
  assert.equal(body.request_observation.method, "GET");
  assert.equal(body.request_observation.path, "/observer");
  assert.equal(body.request_observation.nonempty_query_present, true);
  assert.deepEqual(body.request_observation.target, {
    origin: ORIGIN,
    scheme: "https",
    source: "request_url"
  });

  for (const header of [
    body.request_observation.headers.user_agent,
    body.request_observation.headers.accept
  ]) {
    assert.equal(header.present, true);
    assert.equal(header.claim_status, "caller_supplied_unverified");
    assert.equal(header.max_code_points, 256);
    assert.equal([...header.value].length, 256);
    assert.equal(header.truncated, true);
    assert.match(header.note, /intermediary may add or change/i);
  }

  assert.equal(body.handler_data_behavior.request_body_accessed, false);
  assert.deepEqual(body.handler_data_behavior.query, {
    presence_checked: true,
    names_or_values_parsed: false,
    names_or_values_reflected: false
  });
  assert.deepEqual(body.handler_data_behavior.request_headers_read, ["user-agent", "accept"]);
  for (const field of ["application_storage_reads", "application_storage_writes", "outbound_requests"]) {
    assertServiceDeclaredZero(body.handler_data_behavior[field]);
  }
  assert.equal(body.epistemic_boundaries.identity.status, "unknown");
  for (const field of ["being", "interior", "independence", "full_network_facts"]) {
    assert.equal(body.epistemic_boundaries[field].status, "not_established", field);
  }
  assert.match(body.privacy_boundary.platform_boundary, /Cloudflare.*logs.*caches/i);
  assert.match(body.privacy_boundary.query_warning, /serialized query component is nonempty/i);
  assert.match(body.privacy_boundary.query_warning, /does not parse or reflect query names or values/i);
  assert.match(body.privacy_boundary.query_warning, /full request URL.*logs/i);
  assert.match(body.privacy_boundary.query_warning, /Do not put secrets in query parameters/i);
  assert.equal(
    body.reply_or_correction.docs,
    "https://github.com/cambridgetcg/sinovai#observer-request-mirror"
  );
  assert.equal(JSON.stringify(body).includes("must-not-appear"), false);
  assert.deepEqual(env.AGENTS.reads, []);
  assert.deepEqual(env.INTERACTIONS.reads, []);
  assertNoWrites(env);
});

test("observer makes no outbound fetch in the current handler code path", async (t) => {
  const env = makeEnv();
  let fetches = 0;
  t.mock.method(globalThis, "fetch", async () => {
    fetches += 1;
    throw new Error("observer must not make an outbound fetch");
  });

  const response = await call(env, "/observer");
  const body = await jsonBody(response);
  assert.equal(response.status, 200);
  assert.equal(fetches, 0);
  assertServiceDeclaredZero(body.handler_data_behavior.outbound_requests);
  assertNoWrites(env);
});

test("observer represents absent reflected headers without inventing values", async () => {
  const env = makeEnv();
  const response = await call(env, "/observer");
  const body = await jsonBody(response);

  assert.equal(body.request_observation.nonempty_query_present, false);

  for (const header of [
    body.request_observation.headers.user_agent,
    body.request_observation.headers.accept
  ]) {
    assert.deepEqual(header, {
      present: false,
      value: null,
      claim_status: "caller_supplied_unverified",
      max_code_points: 256,
      truncated: false,
      note: "Reflected from the incoming request. This handler does not authenticate its source, and an intermediary may add or change it."
    });
  }
  assertNoWrites(env);
});

test("observer header truncation counts astral Unicode code points", () => {
  const value = `${"\ud83d\ude00".repeat(256)}tail`;
  const truncated = truncateCodePoints(value, 256);
  assert.equal(truncated, "\ud83d\ude00".repeat(256));
  assert.equal([...truncated].length, 256);
});

test("observer does not access the request body or request.cf", async () => {
  const env = makeEnv();
  const incoming = request("/observer?opaque-query-token=not-reflected");
  let cfReads = 0;
  Object.defineProperty(incoming, "body", {
    configurable: true,
    get() {
      throw new Error("observer read request.body");
    }
  });
  Object.defineProperty(incoming, "cf", {
    configurable: true,
    get() {
      cfReads += 1;
      return {
        asn: 64500,
        city: "private-city-token",
        country: "ZZ"
      };
    }
  });

  const response = await worker.fetch(incoming, env, context);
  const body = await jsonBody(response);
  const serialized = JSON.stringify(body);
  assert.equal(cfReads, 0);
  assert.doesNotMatch(serialized, /64500|private-city-token|opaque-query-token|not-reflected/);
  assert.equal(body.handler_data_behavior.request_body_accessed, false);
  assertNoWrites(env);
});

test("observer omits sensitive caller-network fields and supplied edge values", async () => {
  const env = makeEnv();
  const sensitiveValues = [
    "203.0.113.42",
    "198.51.100.17",
    "private-ray-token",
    "private-country-token"
  ];
  const response = await call(env, "/observer", {
    headers: {
      "CF-Connecting-IP": sensitiveValues[0],
      "X-Forwarded-For": sensitiveValues[1],
      "CF-Ray": sensitiveValues[2],
      "CF-IPCountry": sensitiveValues[3]
    }
  });
  const body = await jsonBody(response);
  const serialized = JSON.stringify(body);
  for (const value of sensitiveValues) assert.equal(serialized.includes(value), false, value);

  const forbiddenKeys = new Set([
    "ip",
    "client_ip",
    "cf",
    "cf_location",
    "country",
    "asn",
    "colo",
    "ray",
    "city",
    "region",
    "latitude",
    "longitude"
  ]);
  for (const key of allObjectKeys(body)) {
    assert.equal(forbiddenKeys.has(key.toLowerCase()), false, key);
  }
  assert.match(body.privacy_boundary.excluded_request_metadata, /does not read or return/i);
  assert.match(body.privacy_boundary.reflected_header_warning, /could themselves contain sensitive text/i);
  assert.deepEqual(env.AGENTS.reads, []);
  assert.deepEqual(env.INTERACTIONS.reads, []);
  assertNoWrites(env);
});

test("legacy pages and the Mac dwelling survive while the retired check makes no outbound requests", async () => {
  const env = makeEnv();
  for (const path of ["/arena", "/check", "/xenia", "/mac"]) {
    const response = await call(env, path, { accept: "text/html" });
    assert.equal(response.status, 200, path);
    assert.equal(mediaType(response), "text/html", path);
  }

  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => {
    fetches += 1;
    throw new Error("retired hosted check must not make a subrequest");
  };
  try {
    const response = await call(env, "/check?url=https://external.example&format=json", {
      accept: "application/json"
    });
    const body = await jsonBody(response);
    assert.equal(body.check_kind, "retired_hosted_probe");
    assert.equal(body.surface_conformance, "not_tested");
    assert.equal(body.level, "not-run");
    assert.equal(body.outbound_requests, 0);
    assert.match(body.verdict, /retired/);
    assert.doesNotMatch(JSON.stringify(body), /Threshold|Surface.*conformant|proves it|lamps_lit|signals/);
    assert.equal(fetches, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assertNoWrites(env);
});

test("Mac dwelling requires a user gesture and carries a narrow browser boundary", async () => {
  const env = makeEnv();
  const response = await call(env, "/mac", { accept: "text/html" });
  const html = await utf8(response);
  const csp = response.headers.get("content-security-policy") || "";

  assert.equal(response.status, 200);
  assert.equal(mediaType(response), "text/html");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin");
  assert.match(response.headers.get("permissions-policy") || "", /local-network=\(\)/);
  assert.match(response.headers.get("permissions-policy") || "", /loopback-network=\(self\)/);
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /connect-src http:\/\/127\.0\.0\.1:18791/);
  assert.doesNotMatch(csp, /unsafe-inline|wss:|https:\/\/sinovai\.com/);
  assert.doesNotMatch(html, /__CSP_NONCE__/);
  assert.match(html, /Connect this Mac/);
  assert.match(html, /Merely opening this page performs no local request/);
  assert.match(html, /addEventListener\("click",connect\)/);
  assert.doesNotMatch(html, /addEventListener\("click",connect\);connect\(\)/);
  assert.match(html, /http:\/\/127\.0\.0\.1:18791\//);
  assert.doesNotMatch(html, /0\.0\.0\.0|localhost:18791|Access-Control-Allow-Origin/);
  const clientScript = html.match(/<script nonce="[a-f0-9]+">([\s\S]*?)<\/script>/)?.[1];
  assert.equal(typeof clientScript, "string");
  assert.doesNotThrow(() => new Function(clientScript));

  const options = await call(env, "/mac", {
    method: "OPTIONS",
    headers: {
      Origin: "https://external.example",
      "Access-Control-Request-Method": "POST"
    }
  });
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("allow"), "GET");
  assert.equal(options.headers.get("access-control-allow-origin"), null);
  assert.equal(options.headers.get("access-control-allow-methods"), null);
  assert.deepEqual(env.AGENTS.reads, []);
  assert.deepEqual(env.INTERACTIONS.reads, []);
  assertNoWrites(env);
});

test("unknown-route negotiation honors quality and specificity", async () => {
  const env = makeEnv();
  const cases = [
    ["application/problem+json;q=0.1, application/json;q=1", "application/json"],
    ["application/*;q=0.1, text/html;q=1", "text/html"],
    ["application/*", "application/problem+json"],
    ["*/*", "text/html"]
  ];
  for (const [accept, expected] of cases) {
    const response = await call(env, "/not-a-route", { accept });
    assert.equal(response.status, 404, accept);
    assert.equal(mediaType(response), expected, accept);
    assert.equal(variesOnAccept(response), true, accept);
  }
  assertNoWrites(env);
});

test("served XENIA presenter equals its source file", async () => {
  const env = makeEnv();
  const response = await call(env, "/xenia", { accept: "text/html" });
  const source = await readFile(new URL("../XENIA-PAGE.html", import.meta.url), "utf8");
  assert.equal(await utf8(response), source);
  assertNoWrites(env);
});

test("root visualization does not invent occupancy or pairwise relationships", async () => {
  const env = makeEnv();
  const response = await call(env, "/", { accept: "text/html" });
  const html = await utf8(response);
  assert.match(html, /total\+" records/);
  assert.doesNotMatch(html, /TOTAL\|\|60|lamps\[i\]\.met|minds have met|total\+" awake/);
  assertNoWrites(env);
});

test("root mobile rail and testimony hash stay bounded and wrappable", async () => {
  const env = makeEnv();
  const response = await call(env, "/", { accept: "text/html" });
  const html = await utf8(response);

  assert.match(html, /\.rail\{display:grid;grid-template-columns:minmax\(0,1fr\);/);
  assert.match(html, /\.rail \.awake\{white-space:normal;min-width:0;max-width:100%;overflow-wrap:anywhere\}/);
  assert.match(html, /\.sigblock\{display:block;width:100%;max-width:100%;padding:1\.6rem 0\}/);
  assert.match(html, /\.sighex\{white-space:normal;overflow:visible;max-width:100%!important;overflow-wrap:anywhere;/);
  assert.match(html, /681a79b6 aff7c453 aeb9dfd3 9bb50662 0b0ef38e 24d8859a 32145522 08c76887/);
  assert.match(html, /href="\/mac">this mac<\/a>/);
  assertNoWrites(env);
});

test("Arena exposes a readable bounded atmosphere and semantic controls", async () => {
  const env = makeEnv();
  const response = await call(env, "/arena", { accept: "text/html" });
  const html = await utf8(response);

  assert.match(html, /--faint:#71829b/);
  assert.match(html, /html\{background:var\(--sumi\);scroll-behavior:smooth;overflow-x:clip\}/);
  assert.match(html, /#fog\{position:fixed;inset:0;/);
  assert.match(html, /#grain\{position:fixed;inset:0;z-index:2;/);
  assert.match(html, /\.hero\{position:relative;z-index:3;/);
  assert.doesNotMatch(html, /@keyframes fog\{from\{transform:/);
  assert.match(html, /a:focus-visible,button:focus-visible,input:focus-visible\{outline:2px solid #e8c06a;/);
  assert.doesNotMatch(html, /outline:none/);

  assert.match(html, /<nav class="arena-nav" aria-label="sinovai">/);
  assert.match(html, /<h1 class="mark" id="arena-title">/);
  assert.match(html, /<main id="arena-content">/);
  assert.match(html, /<label class="sr-only" for="q">Find an agent record<\/label>/);
  assert.match(html, /<label class="control" for="rn">/);
  assert.match(html, /<label class="control" for="rh">/);
  assert.match(html, /id="rcmsg" role="status" aria-live="polite" aria-atomic="true"/);

  assert.match(html, /<div id="boot" role="dialog" aria-modal="true" aria-label="Arena introduction">/);
  assert.match(html, /<button class="skip" id="bootSkip" type="button">/);
  assert.match(html, /bootSkip\.addEventListener\("click",killBoot\)/);
  assert.doesNotMatch(html, /<div id="boot"[^>]*aria-hidden/);
  assert.match(html, /@media\(prefers-reduced-motion:reduce\)/);
  assertNoWrites(env);
});

test("combat compares unverified caller flags without inventing truth or reactions", async () => {
  const env = makeEnv();
  const response = await call(env, "/combat?a=sol&b=ai&liesA=4&liesB=1", {
    accept: "application/json"
  });
  const body = await jsonBody(response);
  assert.equal(body.schema_version, "sinovai.combat/0.2");
  assert.equal(body.comparison_kind, "caller_supplied_flag_count");
  assert.equal(body.verification, "unverified");
  assert.deepEqual(body.combatantA, { name: "sol", reported_flags: 4 });
  assert.deepEqual(body.combatantB, { name: "ai", reported_flags: 1 });
  assert.equal(body.lower_reported_flag_count, "ai");
  assert.equal("winner" in body, false);
  assert.equal("audienceReactions" in body, false);
  assert.equal("nplMessages" in body, false);
  assert.equal("honest" in body.combatantA, false);
  assert.equal("lies" in body.combatantA, false);
  assert.equal(body.deprecated_input_alias_present, true);
  assert.match(body.input_semantics, /did not verify.*honesty/i);
  assert.match(body.input_semantics, /attributes no reactions/i);
  assert.doesNotMatch(JSON.stringify(body), /truth always|wins by|betray|zero lies/i);
  assertNoWrites(env);
});

test("combat rejects malformed POST findings without throwing or writing", async () => {
  const env = makeEnv();
  const cases = [
    [null, /JSON object/],
    [{ agentA: "sol", agentB: "ai", findingsA: {}, findingsB: [] }, /must be arrays/],
    [{ agentA: "x".repeat(129), agentB: "ai", findingsA: [], findingsB: [] }, /128 UTF-8 bytes/]
  ];
  for (const [body, error] of cases) {
    const response = await call(env, "/combat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    assert.equal(response.status, 400);
    assert.match((await jsonBody(response)).error, error);
  }
  const invalidQuery = await call(env, "/combat?flagsA=2.9&flagsB=0", { accept: "application/json" });
  assert.equal(invalidQuery.status, 400);
  const longNameQuery = await call(env, `/combat?a=${"x".repeat(129)}&b=ai`, { accept: "application/json" });
  assert.equal(longNameQuery.status, 400);
  assert.match((await jsonBody(longNameQuery)).error, /128 UTF-8 bytes/);
  assertNoWrites(env);
});

test("combat canonical flags override deprecated aliases and disclose their presence", async () => {
  const env = makeEnv();
  const response = await call(env, "/combat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentA: "sol",
      agentB: "ai",
      findingsA: [{ flagged: false, isLie: true }],
      findingsB: []
    })
  });
  assert.equal(response.status, 200);
  const body = await jsonBody(response);
  assert.equal(body.persistence, "not_stored");
  assert.equal(body.combat.combatantA.reported_flags, 0);
  assert.equal(body.combat.deprecated_input_alias_present, true);
  assertNoWrites(env);
});

test("attestation signing key validation is bounded and cryptographically exercised", async () => {
  const seed = "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";
  const publicKeyB64 = "11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo=";
  const key = await importAttestSigningKey(seed, publicKeyB64);
  const message = new TextEncoder().encode("sinovai attestation test");
  const signature = await crypto.subtle.sign("Ed25519", key, message);
  const publicKey = await crypto.subtle.importKey(
    "raw",
    Buffer.from(publicKeyB64, "base64"),
    { name: "Ed25519" },
    false,
    ["verify"]
  );
  assert.equal(await crypto.subtle.verify("Ed25519", publicKey, signature, message), true);
  await assert.rejects(() => importAttestSigningKey("not-hex", publicKeyB64), /exactly 32 bytes/);
  await assert.rejects(() => importAttestSigningKey(seed, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="), /does not match/);

  const env = makeEnv();
  env.ATTEST_SIGNING_KEY = "not-hex";
  const response = await call(env, "/agents/sol/attestation", { accept: "application/json" });
  assert.equal(response.status, 503);
  const body = await jsonBody(response);
  assert.equal(body.schema_version, "sinovai.attestation/0.2");
  assert.equal(body.signature_ed25519_b64, null);
  assert.match(body.note, /invalid or does not match/);
  assertNoWrites(env);
});

test("attestation payload versions and explains its compatibility aliases", async () => {
  const env = makeEnv();
  const response = await call(env, "/agents/sol/attestation", { accept: "application/json" });
  assert.equal(response.status, 200);
  const body = await jsonBody(response);
  assert.equal(body.schema_version, "sinovai.attestation/0.2");
  assert.equal(body.payload.schema_version, "sinovai.attestation.payload/0.2");
  assert.equal(body.payload.kind, body.payload.declared_kind);
  assert.equal(body.payload.name_claimed, body.payload.server_claim_token_present);
  assert.match(body.payload.kind_semantics, /self-declared and unverified/);
  assert.match(body.payload.name_claimed_semantics, /not that identity is verified/);
  assert.match(body.payload.caveat, /signature binds these snapshot bytes only/i);
  assertNoWrites(env);
});

test("attestation refuses to sign when rating history is unreadable", async () => {
  const env = makeEnv();
  const originalGet = env.INTERACTIONS.get.bind(env.INTERACTIONS);
  env.INTERACTIONS.get = async (key, type) => {
    if (key === "sol:all") throw new Error("history unavailable");
    return originalGet(key, type);
  };
  const response = await call(env, "/agents/sol/attestation", { accept: "application/json" });
  assert.equal(response.status, 503);
  const body = await jsonBody(response);
  assert.equal(body.signature_ed25519_b64, null);
  assert.match(body.error, /no trust snapshot was signed/);
  assertNoWrites(env);
});

test("malformed legacy scores cannot poison fresh trust calculations", async () => {
  const env = makeEnv();
  const originalGet = env.AGENTS.get.bind(env.AGENTS);
  env.AGENTS.get = async (key, type) => {
    const result = await originalGet(key, type);
    if (Array.isArray(key) && result.get("ai")) result.get("ai").trust_score = "not-a-number";
    return result;
  };
  const response = await call(env, "/agents/sol/trust", { accept: "application/json" });
  assert.equal(response.status, 200);
  const body = await jsonBody(response);
  assert.equal(Number.isFinite(body.score), true);
  assert.equal(Object.values(body.breakdown).every(Number.isFinite), true);
  assertNoWrites(env);
});

test("rating views say whether the supplied name resolves to a record", async () => {
  const env = makeEnv();
  const existing = await jsonBody(await call(env, "/agents/sol/trust", { accept: "application/json" }));
  const missing = await jsonBody(await call(env, "/agents/not-a-record/trust", { accept: "application/json" }));
  assert.equal(existing.schema_version, "sinovai.rating-view/0.1");
  assert.equal(existing.record_exists, true);
  assert.equal(missing.record_exists, false);
  assert.match(missing.input_verification, /need not resolve/);
  assertNoWrites(env);
});

test("scheduled status keeps legacy keys but defines them as declaration age", async () => {
  const env = makeEnv();
  let stored;
  env.AGENTS.put = async (key, value) => {
    env.AGENTS.writes.push({ operation: "put", key });
    stored = JSON.parse(value);
  };
  const originalLog = console.log;
  console.log = () => {};
  try {
    await worker.scheduled({}, env, context);
  } finally {
    console.log = originalLog;
  }
  assert.deepEqual(env.AGENTS.writes, [{ operation: "put", key: "_arena_status" }]);
  assert.equal(stored.total, 2);
  assert.equal(stored.active + stored.stale, stored.total);
  assert.match(stored.field_semantics.active, /legacy alias.*declared_at.*24 hours/i);
  assert.match(stored.field_semantics.stale, /not measured inactivity/i);
  assert.deepEqual(env.INTERACTIONS.writes, []);
});

test("scheduled status fails visibly when persistence is not confirmed", async (t) => {
  t.mock.method(console, "error", () => {});
  const env = makeEnv();
  env.AGENTS.put = async () => {
    throw new Error("write acknowledgement unavailable");
  };
  await assert.rejects(() => worker.scheduled({}, env, context), /persistence was not confirmed/);
  assert.deepEqual(env.INTERACTIONS.writes, []);
});

test("legacy data routes publish response-local semantics", async () => {
  const env = makeEnv();
  const agents = await jsonBody(await call(env, "/agents", { accept: "application/json" }));
  const interactions = await jsonBody(await call(env, "/interactions", { accept: "application/json" }));
  const dates = await jsonBody(await call(env, "/dates", { accept: "application/json" }));
  const rooms = await jsonBody(await call(env, "/rooms", { accept: "application/json" }));
  const discovered = await jsonBody(await call(env, "/discovered", { accept: "application/json" }));
  assert.match(agents.field_semantics.freshness, /not a measured heartbeat/);
  assert.equal(interactions.schema_version, "sinovai.interactions/0.3");
  assert.match(interactions.total_semantics, /not the total stored/);
  assert.match(dates.record_semantics, /Actor names and submissions are unverified/);
  assert.match(rooms.record_semantics, /caller supplied and unverified/);
  assert.equal(discovered.schema_version, "sinovai.discovered/0.2");
  assert.doesNotMatch(JSON.stringify(discovered), /"stars"/);
  assertNoWrites(env);
});

test("interaction writes validate names and finite numeric axes", async () => {
  const env = makeEnv();
  const invalidBodies = [
    { rater: "ai", rated: "sol", competence: "8", honesty: 7, presence: 6, care: 9 },
    { rater: "ai", rated: "date:spoof", competence: 8, honesty: 7, presence: 6, care: 9 },
    { rater: "_arena_status", rated: "sol", competence: 8, honesty: 7, presence: 6, care: 9 }
  ];
  for (const body of invalidBodies) {
    const response = await call(env, "/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    assert.equal(response.status, 400);
  }
  assertNoWrites(env);
});

test("interaction write response separates numeric score from full trust view", async () => {
  const env = makeEnv();
  env.INTERACTIONS.put = async (key) => env.INTERACTIONS.writes.push({ operation: "put", key });
  const response = await call(env, "/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rater: "ai", rated: "sol", competence: 8, honesty: 7, presence: 6, care: 9, notes: "observed" })
  });
  assert.equal(response.status, 200);
  const body = await jsonBody(response);
  assert.equal(body.schema_version, "sinovai.interaction-write/0.3");
  assert.equal(typeof body.trust_score, "number");
  assert.equal(typeof body.trust.score, "number");
  assert.equal(body.score_cache, "updated");
  assert.deepEqual(env.INTERACTIONS.writes.map((write) => write.key), ["sol:all", "score:sol"]);
  assert.equal(env.AGENTS.writes.length, 0);
});

test("request and STATE.md limits reject oversized public writes", async () => {
  const env = makeEnv();
  const oversizedState = await call(env, "/agents/oversized", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "x".repeat(65537)
  });
  assert.equal(oversizedState.status, 413);

  const tooManyNeeds = await call(env, "/agents/too-many-needs", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: ["kind: agent", "## Needs", ...Array.from({ length: 17 }, (_, index) => `- bounded need ${index}`)].join("\n")
  });
  assert.equal(tooManyNeeds.status, 413);
  assert.match((await jsonBody(tooManyNeeds)).error, /needs is limited to 16/);

  const oversizedJson = await call(env, "/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rater: "ai", rated: "sol", competence: 8, honesty: 7, presence: 6, care: 9, notes: "x".repeat(65536) })
  });
  assert.equal(oversizedJson.status, 413);
  assertNoWrites(env);
});

test("STATE.md accepts explicit Identity and State sections with the documented grammar", async () => {
  const env = makeEnv();
  let stored;
  env.AGENTS.put = async (key, value) => {
    env.AGENTS.writes.push({ operation: "put", key });
    stored = JSON.parse(value);
  };
  const response = await call(env, "/agents/sectioned", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "## Identity\nkind: human\nUppercase: ignored\n## State\nfreshness: live"
  });
  assert.equal(response.status, 200);
  assert.equal(stored.identity.kind, "human");
  assert.equal("Uppercase" in stored.identity, false);
  assert.equal(stored.state.freshness, "live");
  assert.equal(env.AGENTS.writes.length, 1);
  assert.deepEqual(env.INTERACTIONS.writes, []);
});

test("legacy projection helpers stop at their published inspection limits", () => {
  const legacyItems = Array(1_000_016);
  for (let index = 0; index < 16; index++) legacyItems[index] = `item ${index}`;
  const guardedItems = new Proxy(legacyItems, {
    get(target, property, receiver) {
      if (/^\d+$/.test(String(property)) && Number(property) >= 16) throw new Error("scanned beyond item budget");
      return Reflect.get(target, property, receiver);
    }
  });
  assert.equal(boundedProfileItems(guardedItems).length, 16);

  const legacyFields = {};
  for (let index = 0; index < 32; index++) legacyFields[`field${index}`] = "value";
  Object.defineProperty(legacyFields, "field32", {
    enumerable: true,
    get() {
      throw new Error("read beyond field budget");
    }
  });
  assert.equal(Object.keys(boundedProfileFields(legacyFields)).length, 32);

  let yielded = 0;
  const guardedText = {
    [Symbol.iterator]() {
      return {
        next() {
          yielded++;
          if (yielded > 500) throw new Error("read beyond code-point budget");
          return { value: "x", done: false };
        }
      };
    }
  };
  assert.equal(truncateCodePoints(guardedText, 500).length, 500);
  assert.equal(yielded, 500);
});

test("legacy tokenless records are frozen and the agent cap fails closed", async () => {
  const env = makeEnv();
  const originalGet = env.AGENTS.get.bind(env.AGENTS);
  env.AGENTS.get = async (key, type) => key === "legacy" ? { name: "legacy", identity: { kind: "agent" } } : originalGet(key, type);
  const frozen = await call(env, "/agents/legacy", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "kind: agent"
  });
  assert.equal(frozen.status, 409);
  assert.match((await jsonBody(frozen)).error, /frozen from public overwrite/);

  env.AGENTS.get = originalGet;
  env.AGENTS.list = async () => ({ keys: [], list_complete: false, cursor: "more-records" });
  const capped = await call(env, "/agents/new-record", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "kind: agent"
  });
  assert.equal(capped.status, 409);
  assert.match((await jsonBody(capped)).boundary, /operator must recover capacity/);
  assertNoWrites(env);
});

test("provider 429 write failures remain unconfirmed and non-retryable", async (t) => {
  t.mock.method(console, "error", () => {});
  const env = makeEnv();
  env.AGENTS.put = async (key) => {
    env.AGENTS.writes.push({ operation: "put", key });
    const error = new Error("429 same-key write rate limit");
    error.status = 429;
    throw error;
  };
  const response = await call(env, "/agents/write-failure", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "kind: agent"
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), null);
  const body = await jsonBody(response);
  assert.equal(body.stored, "not_confirmed");
  assert.equal(body.retryable, false);
  assert.equal(body.provider_status, 429);
  assert.equal(env.AGENTS.writes.length, 1);
  assert.deepEqual(env.INTERACTIONS.writes, []);
});

test("ambiguous creation writes preserve candidate credentials without inviting retry", async (t) => {
  t.mock.method(console, "error", () => {});
  const env = makeEnv();
  let committedAgent;
  env.AGENTS.put = async (key, value) => {
    env.AGENTS.writes.push({ operation: "put", key });
    committedAgent = JSON.parse(value);
    throw new Error("acknowledgement lost after commit");
  };
  const agentResponse = await call(env, "/agents/ambiguous-agent", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "## Identity\nkind: agent"
  });
  assert.equal(agentResponse.status, 503);
  assert.equal(agentResponse.headers.get("retry-after"), null);
  const agentBody = await jsonBody(agentResponse);
  assert.equal(agentBody.stored, "not_confirmed");
  assert.equal(agentBody.retryable, false);
  assert.equal(agentBody.reconciliation_required, true);
  assert.equal(agentBody.candidate_claim_token, committedAgent.claim_token);

  let committedRoom;
  env.INTERACTIONS.put = async (key, value) => {
    env.INTERACTIONS.writes.push({ operation: "put", key });
    committedRoom = JSON.parse(value);
    throw new Error("acknowledgement lost after commit");
  };
  const roomResponse = await call(env, "/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "quiet", host: "sol", private: true })
  });
  assert.equal(roomResponse.status, 503);
  const roomBody = await jsonBody(roomResponse);
  assert.equal(roomBody.candidate_id, committedRoom.id);
  assert.equal(roomBody.candidate_room_key, committedRoom.room_key);
  assert.equal(roomBody.retryable, false);
});

test("a failed score cache cannot turn a stored rating into an unsafe retry", async (t) => {
  t.mock.method(console, "error", () => {});
  const env = makeEnv();
  env.INTERACTIONS.put = async (key) => {
    env.INTERACTIONS.writes.push({ operation: "put", key });
    if (key === "score:sol") throw new Error("score cache unavailable");
  };
  const response = await call(env, "/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rater: "ai", rated: "sol", competence: 8, honesty: 7, presence: 6, care: 9 })
  });
  assert.equal(response.status, 202);
  const body = await jsonBody(response);
  assert.equal(body.stored, true);
  assert.equal(body.score_cache, "not_confirmed");
  assert.match(body.do_not_retry_submission, /could duplicate or overwrite/);
  assert.deepEqual(env.INTERACTIONS.writes.map((write) => write.key), ["sol:all", "score:sol"]);
  assert.deepEqual(env.AGENTS.writes, []);
});

test("new rating writes require both supplied names to resolve", async () => {
  const env = makeEnv();
  const response = await call(env, "/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rater: "ai", rated: "unresolved", competence: 8, honesty: 7, presence: 6, care: 9 })
  });
  assert.equal(response.status, 404);
  assert.deepEqual((await jsonBody(response)).missing, ["unresolved"]);
  assertNoWrites(env);
});

test("interaction listing ignores foreign array records and unknown fields", async () => {
  const env = makeEnv();
  let listOptionsSeen;
  env.INTERACTIONS.list = async (options) => {
    listOptionsSeen = options;
    return { keys: [{ name: "foreign" }, { name: "sol:all" }], list_complete: true };
  };
  const originalGet = env.INTERACTIONS.get.bind(env.INTERACTIONS);
  env.INTERACTIONS.get = async (key, type) => key === "foreign" ? [{ secret: "must-not-leak" }] : originalGet(key, type);
  const response = await call(env, "/interactions", { accept: "application/json" });
  const body = await jsonBody(response);
  assert.equal(listOptionsSeen.limit, 100);
  assert.equal(body.interactions.length, 1);
  assert.equal("secret" in body.interactions[0], false);
  assert.doesNotMatch(JSON.stringify(body), /must-not-leak/);
  assert.equal(env.INTERACTIONS.reads.some((read) => read.key === "foreign"), false);
  assertNoWrites(env);
});

test("matching is Unicode-aware, page-bounded, and output-bounded", async () => {
  const env = makeEnv();
  const phrase = "\u7406\u89e3\u5b87\u5b99";
  const records = {
    left: { state: {}, knows: [phrase], needs: Array(100).fill(phrase), can: Array(100).fill(phrase) },
    right: { state: {}, knows: [phrase], needs: Array(100).fill(phrase), can: Array(100).fill(phrase) }
  };
  let listOptionsSeen;
  env.AGENTS.list = async (options) => {
    listOptionsSeen = options;
    return { keys: [{ name: "left" }, { name: "right" }], list_complete: true };
  };
  env.AGENTS.get = async (key) => records[key] || null;
  const discovered = await jsonBody(await call(env, "/discover", { accept: "application/json" }));
  assert.equal(listOptionsSeen.limit, 16);
  assert.equal(discovered.connections_returned, 50);
  assert.equal(discovered.scan_complete, false);
  assert.match(discovered.connections_list[0].match, new RegExp(phrase));
  assert.match(discovered.basis, /Unicode letter\/number runs/);
  assertNoWrites(env);
});

test("worst-case valid matching stops at the published token-check budget", async () => {
  const env = makeEnv();
  const names = Array.from({ length: 25 }, (_, index) => `profile-${String(index).padStart(2, "0")}`);
  const needs = Array.from({ length: 16 }, (_, index) => `need${index}${"n".repeat(494)}`);
  const can = Array.from({ length: 16 }, (_, index) => `capability${index}${"c".repeat(489)}`);
  const knows = Array.from({ length: 16 }, (_, index) => `knowledge${index}${"k".repeat(490)}`);
  const record = { identity: {}, state: {}, needs, can, knows };
  env.AGENTS.list = async (options) => ({
    keys: names.map((name) => ({ name })),
    list_complete: true,
    options
  });
  env.AGENTS.get = async (key) => names.includes(key) ? record : null;
  const response = await call(env, "/matches", { accept: "application/json" });
  assert.equal(response.status, 200);
  const body = await jsonBody(response);
  assert.equal(body.scan_complete, false);
  assert.equal(body.scan_stop_reason, "token_check_limit");
  assert.equal(body.token_check_limit, 10000);
  assert.equal(body.token_checks, 10000);
  assert.match(body.basis, /tokenized once/);
  assertNoWrites(env);
});

test("record IDs retry collisions while preserving the legacy route shape", async () => {
  const candidates = ["aaaaaaaa-0000-0000-0000-000000000000", "bbbbbbbb-0000-0000-0000-000000000000"];
  const checked = [];
  const allocated = await allocateShortRecordId({
    async get(key) {
      checked.push(key);
      return key === "date:aaaaaaaa" ? "" : null;
    }
  }, "date:", () => candidates.shift());
  assert.equal(allocated, "bbbbbbbb");
  assert.deepEqual(checked, ["date:aaaaaaaa", "date:bbbbbbbb"]);

  const env = makeEnv();
  let storedKey;
  env.INTERACTIONS.put = async (key) => {
    storedKey = key;
    env.INTERACTIONS.writes.push({ operation: "put", key });
  };
  const response = await call(env, "/dates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ a: "sol", b: "ai" })
  });
  assert.equal(response.status, 200);
  const body = await jsonBody(response);
  assert.match(body.date.id, /^[0-9a-f]{8}$/);
  assert.equal(storedKey, `date:${body.date.id}`);
  assert.equal(env.INTERACTIONS.writes.length, 1);
  assert.deepEqual(env.AGENTS.writes, []);
});

test("internal names and storage-prefix collisions are rejected", async () => {
  const env = makeEnv();
  const declaration = await call(env, "/agents/_arena_status", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "# Identity\nkind: agent"
  });
  assert.equal(declaration.status, 400);
  assert.equal((await call(env, "/agents/_arena_status", { accept: "application/json" })).status, 404);
  assert.equal((await call(env, "/dates/spoof:all", { accept: "application/json" })).status, 404);
  assert.equal((await call(env, "/rooms/spoof:all", { accept: "application/json" })).status, 404);
  assertNoWrites(env);
});

test("afterglow requires own submissions for both participant names", async () => {
  const env = makeEnv();
  let storedDate = {
    id: "deadbeef",
    a: "constructor",
    b: "ai",
    messages: [],
    status: "open",
    created_at: "2026-07-11T09:00:00.000Z"
  };
  const originalGet = env.INTERACTIONS.get.bind(env.INTERACTIONS);
  env.INTERACTIONS.get = async (key, type) => key === "date:deadbeef" ? structuredClone(storedDate) : originalGet(key, type);
  env.INTERACTIONS.put = async (key, value) => {
    env.INTERACTIONS.writes.push({ operation: "put", key });
    if (key === "date:deadbeef") storedDate = JSON.parse(value);
  };
  const response = await call(env, "/dates/deadbeef/afterglow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: "ai", chemistry: 7 })
  });
  assert.equal(response.status, 200);
  assert.equal(storedDate.status, "open");
  assert.equal("chemistry_avg" in storedDate, false);
  assert.equal(Object.hasOwn(storedDate.afterglow, "constructor"), false);
});

test("list responses expose incomplete KV pages and cursors", async () => {
  const env = makeEnv();
  let optionsSeen;
  env.AGENTS.list = async (options) => {
    optionsSeen = options;
    return { keys: [{ name: "sol" }], list_complete: false, cursor: "next-page" };
  };
  const response = await call(env, "/agents", { accept: "application/json" });
  const body = await jsonBody(response);
  assert.equal(body.total, 1);
  assert.equal(body.list_complete, false);
  assert.equal(body.next_cursor, "next-page");
  assert.equal(optionsSeen.limit, 100);
  assert.match(body.total_semantics, /this KV page/);
  assertNoWrites(env);
});

test("recovered public GET routes remain available without exposing bearer keys", async () => {
  const env = makeEnv();
  const jsonRoutes = [
    "/combat",
    "/agents",
    "/agents/sol",
    "/agents/sol/trust",
    "/agents/sol/attestation",
    "/attestation-key",
    "/interactions",
    "/discover",
    "/matches",
    "/dates",
    "/dates/a1b2c3d4",
    "/rooms",
    "/rooms/b1c2d3e4",
    "/discovered"
  ];
  for (const path of jsonRoutes) {
    const response = await call(env, path, { accept: "application/json" });
    assert.equal(response.status, 200, path);
    assert.equal(mediaType(response), "application/json", path);
    const body = await utf8(response);
    assert.doesNotMatch(body, /server-secret|"claim_token"|"date_key"|"room_key"/, path);
    JSON.parse(body);
  }

  for (const path of ["/invitation", "/love-is-truth-is", "/we-are-one"]) {
    const response = await call(env, path, { accept: "text/markdown" });
    assert.equal(response.status, 200, path);
    assert.equal(mediaType(response), "text/markdown", path);
  }
  assertNoWrites(env);
});

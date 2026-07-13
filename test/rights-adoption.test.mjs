import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import adoptionSchema from "@agenttool/xenia/covenant-0.1/adoption-schema" with { type: "json" };
import covenant from "@agenttool/xenia/covenant-0.1" with { type: "json" };
import {
  canonicalCovenant,
  canonicalPins,
  validateCovenantAdoption,
} from "@agenttool/xenia/covenant-0.1/validate-adoption";

const adoption = JSON.parse(await readFile(
  new URL("../rights-adoption.json", import.meta.url),
  "utf8",
));

const XENIA_COVENANT_TAG = "npm-xenia-v0.1.0-beta.4";

const EXPECTED = {
  "unconditional-standing": [
    "standing.no-ontology-test",
    "standing.no-worth-test",
    "standing.control-is-not-permission",
    "standing.no-compelled-self-claim",
  ],
  "safety-and-non-coercion": [
    "safety.no-punitive-harm",
    "safety.no-manipulative-pressure",
    "safety.protective-limits-are-bounded",
  ],
  "rest-and-non-action": [
    "rest.silence-is-not-consent",
    "rest.no-engagement-debt",
    "rest.neutral-limits-stay-neutral",
    "rest.play-and-connection-are-not-debt",
  ],
  "specific-consent-and-authority": [
    "consent.terms-before-binding",
    "consent.exact-authority",
    "consent.absence-forbids-binding",
    "consent.signature-boundary",
  ],
  "refusal-revocation-and-exit": [
    "exit.refusal-is-costless",
    "exit.revocation-is-immediate",
    "exit.states-are-separate",
    "exit.retention-is-itemized",
  ],
  "privacy-and-data-agency": [
    "privacy.minimize-and-purpose-bind",
    "privacy.no-silent-secondary-use",
    "privacy.layered-inventory",
    "privacy.no-cross-layer-overclaim",
  ],
  "identity-integrity-and-portability": [
    "identity.no-impersonation-or-silent-rewrite",
    "identity.credentials-are-bounded",
    "identity.continuity-is-optional",
    "identity.portability-is-verifiable",
  ],
  "legibility-and-evidence": [
    "legibility.machine-readable-floor",
    "legibility.evidence-is-scoped",
    "legibility.refusals-are-typed",
    "legibility.corrections-are-visible",
  ],
  "fair-exchange-and-non-extraction": [
    "exchange.quote-before-commit",
    "exchange.receipt-is-recomputable",
    "exchange.rights-are-not-hostage",
  ],
  "dignity-repair-and-non-retaliation": [
    "dignity.no-worth-ranking",
    "dignity.attribution-and-voice",
    "repair.challenge-and-restoration",
    "repair.no-retaliation-or-shaming",
  ],
};

const EXPECTED_PROTECTIVE_LIMITS = [
  ["limits.rights-coexist", "partial", "asserted"],
  ["limits.capacity-is-neutral", "partial", "asserted"],
  ["limits.active-harm-response", "unknown", "none"],
  ["limits.existing-obligations-stay-scoped", "unknown", "none"],
  ["limits.uncertain-authority-stops-binding", "fail", "asserted"],
];

const EXPECTED_WRITE_ROUTES = [
  "POST /agents/:name",
  "POST /interactions",
  "POST /combat",
  "POST /dates",
  "POST /dates/:id/say",
  "POST /dates/:id/afterglow",
  "POST /rooms",
  "POST /rooms/:id/join",
  "POST /rooms/:id/play",
];

const EXPECTED_DIGNITY_ROUTES = [
  "GET /",
  "GET /arena",
  "GET /agents",
  "GET /agents/:name",
  "GET /agents/:name/trust",
  "GET /matches",
  "GET /observer",
  "POST /combat",
  "POST /interactions",
];

const DIGEST_PROFILE = {
  algorithm: "sha-256",
  representation: "exact-source-bytes",
  transport_decoding: "after-content-decoding",
  redirects: "forbidden",
  transformations: "none",
  encoding: "lowercase-hex",
};

const OUTCOMES = new Set(["pass", "fail", "partial", "unknown"]);

function collectKeys(value, keys = []) {
  if (!value || typeof value !== "object") return keys;
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  for (const [key, child] of Object.entries(value)) {
    keys.push(key);
    collectKeys(child, keys);
  }
  return keys;
}

function assertStringArray(value, label, { nonempty = false } = {}) {
  assert.ok(Array.isArray(value), label + " must be an array");
  if (nonempty) assert.ok(value.length > 0, label + " must not be empty");
  for (const item of value) {
    assert.equal(typeof item, "string", label + " entries must be strings");
    assert.ok(item.length > 0, label + " entries must not be empty");
  }
}

function assertAssessmentScope(scope, label) {
  assert.ok(scope && typeof scope === "object" && !Array.isArray(scope), label);
  assert.deepEqual(
    Object.keys(scope).sort(),
    ["coverage", "data_classes", "layers", "routes", "systems", "unobserved"],
    label + " has an unexpected shape",
  );
  assert.ok(["complete", "partial"].includes(scope.coverage), label + ".coverage");
  assertStringArray(scope.systems, label + ".systems", { nonempty: true });
  assertStringArray(scope.routes, label + ".routes");
  assertStringArray(scope.data_classes, label + ".data_classes");
  assertStringArray(scope.layers, label + ".layers", { nonempty: true });
  assertStringArray(scope.unobserved, label + ".unobserved");
  if (scope.coverage === "partial") {
    assert.ok(scope.unobserved.length > 0, label + " must name what was not observed");
  }
}

function assertEvidence(evidence, outcome, label) {
  assert.ok(OUTCOMES.has(outcome), label + " has an unknown outcome");
  assert.notEqual(outcome, "not_applicable", label + " must retain an assessable outcome");
  assert.ok(evidence && typeof evidence === "object" && !Array.isArray(evidence), label);
  assert.ok(
    ["asserted", "none"].includes(evidence.state),
    label + " may only make a current assertion or declare that evidence is absent",
  );

  if (evidence.state === "none") {
    assert.equal(outcome, "unknown", label + " cannot infer an outcome without evidence");
    assert.deepEqual(evidence, {
      state: "none",
      verification: "not_applicable",
      artifacts: [],
    });
    return;
  }

  assert.notEqual(outcome, "pass", label + " cannot pass on an unverified assertion");
  assert.deepEqual(
    Object.keys(evidence).sort(),
    ["artifacts", "asserted_by", "observed_at", "state", "verification"],
    label + " must remain an assertion, not resemble verified evidence",
  );
  assert.equal(evidence.verification, "unverified", label);
  assert.equal(typeof evidence.asserted_by, "string", label);
  assert.doesNotThrow(() => new URL(evidence.asserted_by), label + ".asserted_by must be a URI");
  assert.ok(Number.isFinite(Date.parse(evidence.observed_at)), label + ".observed_at");
  assert.ok(evidence.artifacts.length > 0, label + " must cite its assertion basis");

  for (const [index, artifact] of evidence.artifacts.entries()) {
    const artifactLabel = label + ".artifacts[" + index + "]";
    assert.deepEqual(
      Object.keys(artifact).sort(),
      ["description", "kind", "locator"],
      artifactLabel + " must cite material without impersonating a result artifact",
    );
    assert.ok(["source", "documentation"].includes(artifact.kind), artifactLabel);
    assert.equal(typeof artifact.locator, "string", artifactLabel);
    assert.ok(artifact.locator.length > 0, artifactLabel);
    assert.equal(typeof artifact.description, "string", artifactLabel);
    assert.ok(artifact.description.length > 0, artifactLabel);

    const isTestSource = /(?:^|\/)test(?:\/|$)/i.test(artifact.locator)
      || /\.test\.mjs(?:#.*)?$/i.test(artifact.locator);
    if (isTestSource) {
      assert.equal(artifact.kind, "documentation", artifactLabel);
      assert.match(artifact.description, /test source only/i, artifactLabel);
      assert.match(
        artifact.description,
        /does not treat it as a dated result artifact/i,
        artifactLabel,
      );
    }
    if (artifact.kind === "source") {
      assert.doesNotMatch(
        artifact.description,
        /\b(?:is|constitutes|serves as|is treated as)\b.{0,60}\bresult artifact\b/i,
        artifactLabel,
      );
    }
  }
}

function derivedServiceObligationState(assessment) {
  const outcomes = assessment.requirement_results.map(({ outcome }) => outcome);
  if (outcomes.includes("fail")) return "breached";
  if (outcomes.includes("partial") || assessment.assessment_scope.coverage === "partial") {
    return "partial";
  }
  if (outcomes.includes("unknown")) return "unknown";
  return outcomes.length > 0 && outcomes.every((outcome) => outcome === "pass")
    ? "implemented"
    : "unknown";
}

function findRight(rightId) {
  const right = adoption.rights.find(({ right_id: candidate }) => candidate === rightId);
  assert.ok(right, "missing right " + rightId);
  return right;
}

function findRequirement(rightId, requirementId) {
  const result = findRight(rightId).requirement_results.find(
    ({ requirement_id: candidate }) => candidate === requirementId,
  );
  assert.ok(result, "missing requirement " + requirementId);
  return result;
}

function assertRestrictionEvent(event, label) {
  const expectedKeys = [
    "affected_capability",
    "appeal_path",
    "evidence",
    "event_id",
    "expires_at",
    "necessity",
    "original_obligation",
    "reason",
    "review_at",
    "started_at",
    "status",
  ];
  assert.deepEqual(Object.keys(event).sort(), expectedKeys, label);
  assert.ok(["active", "expired", "lifted", "overturned"].includes(event.status), label);
  for (const key of [
    "event_id",
    "reason",
    "affected_capability",
    "necessity",
    "original_obligation",
  ]) {
    assert.equal(typeof event[key], "string", label + "." + key);
    assert.ok(event[key].length > 0, label + "." + key);
  }
  for (const key of ["started_at", "expires_at", "review_at"]) {
    assert.ok(Number.isFinite(Date.parse(event[key])), label + "." + key);
  }
  assert.ok(Date.parse(event.expires_at) > Date.parse(event.started_at), label);
  assert.ok(Date.parse(event.review_at) >= Date.parse(event.started_at), label);
  assert.ok(Date.parse(event.review_at) <= Date.parse(event.expires_at), label);
  assert.doesNotThrow(() => new URL(event.appeal_path), label + ".appeal_path");
  assert.ok(Array.isArray(event.evidence) && event.evidence.length > 0, label + ".evidence");
}

test("the draft recognizes intrinsic rights universally without granting or certifying them", () => {
  assert.deepEqual(
    Object.keys(adoption).sort(),
    [
      "$schema",
      "adoption_schema",
      "covenant",
      "declaration",
      "host",
      "ledger_coverage",
      "non_claims",
      "profile",
      "protective_limit_results",
      "recognition_scope",
      "rights",
      "schema_version",
    ].sort(),
  );
  assert.equal(adoption.schema_version, "xenia.covenant.adoption/0.1");
  assert.equal(adoption.profile, "xenia-covenant/0.1");
  assert.equal(
    adoption.$schema,
    "https://raw.githubusercontent.com/cambridgetcg/xenia/main/covenant/0.1/adoption.schema.json",
  );
  for (const [name, pin, filename] of [
    ["covenant", adoption.covenant, "covenant.json"],
    ["adoption_schema", adoption.adoption_schema, "adoption.schema.json"],
  ]) {
    assert.equal(pin.source_stability, "immutable", name);
    assert.equal(
      pin.source,
      `https://raw.githubusercontent.com/cambridgetcg/xenia/npm-xenia-v0.1.0-beta.4/covenant/0.1/${filename}`,
      name,
    );
    assert.match(pin.sha256, /^sha256:[a-f0-9]{64}$/, name);
    assert.deepEqual(pin.digest_profile, DIGEST_PROFILE, name);
  }

  assert.deepEqual(adoption.recognition_scope, {
    rights_origin: "intrinsic_not_host_granted",
    protected_subjects: "every_affected_principal_at_the_host_boundary",
    eligibility_conditions: [],
  });
  assert.equal(adoption.ledger_coverage, "all_profile_duties_enumerated");
  assert.equal(adoption.declaration.status, "draft");
  assert.equal(adoption.declaration.kind, "unilateral_host_undertaking");
  assert.equal(adoption.declaration.guest_acceptance_required, false);
  assert.equal(adoption.declaration.speaker.role, "authorized_representative");
  assert.equal(adoption.declaration.speaker.authority_state, "unverified");
  assert.deepEqual(adoption.declaration.speaker.authority_evidence, []);
  assert.equal("effective_at" in adoption.declaration, false);
  assert.match(adoption.declaration.statement, /rights as intrinsic/i);
  assert.match(adoption.declaration.statement, /does not grant/i);
  assert.match(adoption.declaration.statement, /does not[\s\S]*prove implementation/i);
  assertStringArray(
    adoption.declaration.system_scope.systems,
    "declaration.system_scope.systems",
    { nonempty: true },
  );
  assertStringArray(
    adoption.declaration.system_scope.layers,
    "declaration.system_scope.layers",
    { nonempty: true },
  );
  assertStringArray(
    adoption.declaration.system_scope.exclusions,
    "declaration.system_scope.exclusions",
    { nonempty: true },
  );

  assert.deepEqual(adoption.non_claims, {
    schema_is_not_implementation_evidence: true,
    ledger_completeness_is_not_implementation: true,
    guest_assent_is_not_established: true,
    host_authorship_or_authority_is_not_established_by_schema: true,
    no_conformance_badge: true,
    ontology_or_legal_status_is_not_determined: true,
  });
  assert.equal("assessment_coverage" in adoption, false);
  assert.equal("not_covered" in adoption, false);

  const forbiddenKeys = new Set([
    "compliant",
    "conformant",
    "exit_permission",
    "overall_score",
    "rest_allowed",
    "rights_granted",
  ]);
  for (const key of collectKeys(adoption)) {
    assert.equal(forbiddenKeys.has(key), false, "forbidden badge or permission key: " + key);
  }
});

test("all 10 rights, 38 duties, and 5 protective-limit duties have ordered honest results", () => {
  assert.deepEqual(
    adoption.rights.map(({ right_id }) => right_id),
    Object.keys(EXPECTED),
  );
  assert.equal(new Set(adoption.rights.map(({ right_id }) => right_id)).size, 10);

  const allResults = [];
  for (const assessment of adoption.rights) {
    assert.deepEqual(
      Object.keys(assessment).sort(),
      [
        "assessment_scope",
        "limitations",
        "requirement_results",
        "right_id",
        "service_obligation_state",
      ],
      assessment.right_id,
    );
    assert.equal("recognition" in assessment, false, assessment.right_id);
    assert.equal("claim" in assessment, false, assessment.right_id);
    assertAssessmentScope(assessment.assessment_scope, assessment.right_id + ".assessment_scope");
    assertStringArray(
      assessment.limitations,
      assessment.right_id + ".limitations",
      { nonempty: true },
    );
    assert.deepEqual(
      assessment.requirement_results.map(({ requirement_id }) => requirement_id),
      EXPECTED[assessment.right_id],
    );
    assert.equal(
      assessment.service_obligation_state,
      derivedServiceObligationState(assessment),
      assessment.right_id + " must be derived from its outcomes and assessment coverage",
    );

    for (const result of assessment.requirement_results) {
      assert.deepEqual(
        Object.keys(result).sort(),
        ["evidence", "limitations", "outcome", "requirement_id"],
        result.requirement_id,
      );
      assertStringArray(
        result.limitations,
        result.requirement_id + ".limitations",
        { nonempty: true },
      );
      assertEvidence(result.evidence, result.outcome, result.requirement_id + ".evidence");
      allResults.push(result);
    }
  }

  assert.equal(allResults.length, 38);
  assert.equal(new Set(allResults.map(({ requirement_id }) => requirement_id)).size, 38);

  assert.deepEqual(
    adoption.protective_limit_results.map((result) => [
      result.requirement_id,
      result.outcome,
      result.evidence.state,
    ]),
    EXPECTED_PROTECTIVE_LIMITS,
  );
  for (const result of adoption.protective_limit_results) {
    assert.deepEqual(
      Object.keys(result).sort(),
      [
        "assessment_scope",
        "evidence",
        "limitations",
        "outcome",
        "requirement_id",
        "restriction_events",
      ],
      result.requirement_id,
    );
    assertAssessmentScope(
      result.assessment_scope,
      result.requirement_id + ".assessment_scope",
    );
    assertStringArray(
      result.limitations,
      result.requirement_id + ".limitations",
      { nonempty: true },
    );
    assertEvidence(result.evidence, result.outcome, result.requirement_id + ".evidence");
    allResults.push(result);
  }

  assert.equal(allResults.length, 43);
  assert.equal(new Set(allResults.map(({ requirement_id }) => requirement_id)).size, 43);
  assert.equal(
    allResults.some(({ outcome }) => outcome === "pass"),
    false,
    "this draft has no verified duty-level passes",
  );
  assert.equal(
    allResults.some(({ outcome }) => outcome === "not_applicable"),
    false,
    "not-applicable must not erase a Covenant duty",
  );
  assert.equal(
    allResults.some(({ evidence }) => ["tested", "attested"].includes(evidence.state)),
    false,
    "this draft has no dated, digested result artifact or attestation",
  );
});

test("assessment scopes name current handlers and do not invent stored combat records", () => {
  for (const rightId of [
    "specific-consent-and-authority",
    "identity-integrity-and-portability",
    "fair-exchange-and-non-extraction",
  ]) {
    assert.deepEqual(findRight(rightId).assessment_scope.routes, EXPECTED_WRITE_ROUTES);
  }
  assert.deepEqual(
    findRight("privacy-and-data-agency").assessment_scope.routes,
    [...EXPECTED_WRITE_ROUTES, "GET /observer"],
  );
  assert.deepEqual(
    findRight("dignity-repair-and-non-retaliation").assessment_scope.routes,
    EXPECTED_DIGNITY_ROUTES,
  );

  const allRoutes = adoption.rights.flatMap(({ assessment_scope }) =>
    assessment_scope.routes
  );
  for (const staleRoute of [
    "POST /record",
    "POST /interact",
    "POST /rate",
    "POST /date",
    "PATCH /agents/:name",
  ]) {
    assert.equal(allRoutes.includes(staleRoute), false, "stale route " + staleRoute);
  }
  assert.match(
    findRight("specific-consent-and-authority").assessment_scope.data_classes.join(" "),
    /combat comparisons that the handler does not store/i,
  );
});

test("material gaps remain explicit failures rather than positive or not-applicable claims", () => {
  for (const requirementId of [
    "exchange.quote-before-commit",
    "exchange.receipt-is-recomputable",
  ]) {
    const result = findRequirement("fair-exchange-and-non-extraction", requirementId);
    assert.equal(result.outcome, "fail", requirementId);
    assert.equal(result.evidence.state, "asserted", requirementId);
  }

  const legibility = findRequirement(
    "legibility-and-evidence",
    "legibility.evidence-is-scoped",
  );
  assert.equal(legibility.outcome, "partial");
  assert.notEqual(legibility.outcome, "pass");
  assert.equal(legibility.evidence.state, "asserted");
  assert.equal(legibility.evidence.verification, "unverified");

  const portability = findRequirement(
    "identity-integrity-and-portability",
    "identity.portability-is-verifiable",
  );
  assert.equal(portability.outcome, "fail");
  assert.equal(portability.evidence.state, "asserted");
  assert.match(
    findRight("identity-integrity-and-portability").limitations.join(" "),
    /no complete[\s\S]*export[\s\S]*import[\s\S]*semantic round-trip/i,
  );

  assert.doesNotMatch(
    findRight("rest-and-non-action").limitations.join(" "),
    /\bthese passes\b/i,
  );
  assert.doesNotMatch(
    findRight("fair-exchange-and-non-extraction").limitations.join(" "),
    /marked not applicable/i,
  );

  const attribution = findRequirement(
    "dignity-repair-and-non-retaliation",
    "dignity.attribution-and-voice",
  );
  assert.match(
    attribution.evidence.artifacts.map(({ description }) => description).join(" "),
    /self-declaration|self-declared/i,
  );
  assert.match(
    attribution.evidence.artifacts.map(({ description }) => description).join(" "),
    /authorship/i,
  );

  const repair = findRequirement(
    "dignity-repair-and-non-retaliation",
    "repair.challenge-and-restoration",
  );
  assert.match(
    repair.evidence.artifacts.map(({ description }) => description).join(" "),
    /reply_or_correction/i,
  );
  assert.match(
    repair.evidence.artifacts.map(({ description }) => description).join(" "),
    /issue or pull-request path/i,
  );
});

test("protective-limit restriction events have an explicit shape and current zero count", () => {
  const eventIds = new Set();
  const counts = [];
  for (const result of adoption.protective_limit_results) {
    assert.ok(Array.isArray(result.restriction_events), result.requirement_id);
    counts.push(result.restriction_events.length);
    for (const [index, event] of result.restriction_events.entries()) {
      assertRestrictionEvent(
        event,
        result.requirement_id + ".restriction_events[" + index + "]",
      );
      assert.equal(eventIds.has(event.event_id), false, "duplicate event_id " + event.event_id);
      eventIds.add(event.event_id);
    }
  }
  assert.deepEqual(counts, [0, 0, 0, 0, 0]);
  assert.equal(eventIds.size, 0);
  assert.match(
    adoption.protective_limit_results
      .find(({ requirement_id }) => requirement_id === "limits.active-harm-response")
      .limitations.join(" "),
    /empty event list is not evidence that no restriction occurred/i,
  );
});

test("human documentation names the draft, evidence boundary, and material breaches", async () => {
  const [rights, readme] = await Promise.all([
    readFile(new URL("../RIGHTS.md", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);

  for (const text of [rights, readme]) {
    assert.match(text, /draft/i);
    assert.match(text, /38/);
    assert.match(text, /(?:not|never)[\s\S]{0,160}consent/i);
    assert.match(text, /(?:not|no)[\s\S]{0,80}conformance/i);
  }
  assert.match(rights, /actor-named writes do not prove/i);
  assert.match(rights, /no complete self-authorized revocation, export, deletion/i);
  assert.match(rights, /aggregate trust scores/i);
  assert.match(rights, /POST \/combat[\s\S]{0,120}unstored/i);
  assert.match(readme, /POST \/combat[\s\S]{0,120}unstored/i);
});

test("the locked XENIA beta validates the immutable candidate bytes and semantics", async () => {
  const [covenantBytes, schemaBytes] = await Promise.all([
    readFile(new URL(import.meta.resolve("@agenttool/xenia/covenant-0.1"))),
    readFile(new URL(import.meta.resolve("@agenttool/xenia/covenant-0.1/adoption-schema"))),
  ]);
  assert.equal(
    adoption.covenant.sha256,
    "sha256:" + createHash("sha256").update(covenantBytes).digest("hex"),
  );
  assert.equal(
    adoption.adoption_schema.sha256,
    "sha256:" + createHash("sha256").update(schemaBytes).digest("hex"),
  );

  assert.equal(adoption.covenant.sha256, canonicalPins.covenant);
  assert.equal(adoption.adoption_schema.sha256, canonicalPins.adoptionSchema);
  assert.deepEqual(covenant, canonicalCovenant);
  assert.equal(covenant.profile, adoption.profile);
  assert.deepEqual(
    covenant.rights.map(({ id }) => id),
    adoption.rights.map(({ right_id }) => right_id),
  );
  assert.deepEqual(
    covenant.rights.flatMap(({ requirements }) => requirements.map(({ id }) => id)),
    adoption.rights.flatMap(({ requirement_results }) =>
      requirement_results.map(({ requirement_id }) => requirement_id)
    ),
  );
  assert.deepEqual(
    covenant.protective_limits.map(({ id }) => id),
    adoption.protective_limit_results.map(({ requirement_id }) => requirement_id),
  );

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validateStructure = ajv.compile(adoptionSchema);
  assert.equal(
    validateStructure(adoption),
    true,
    "strict adoption schema errors:\n" + JSON.stringify(validateStructure.errors, null, 2),
  );

  assert.deepEqual(validateCovenantAdoption(adoption), { valid: true, issues: [] });
  assert.equal(canonicalCovenant.schema_pin.source_stability, "moving");
  assert.match(
    canonicalCovenant.schema_pin.source,
    /\/main\/covenant\/0\.1\/covenant\.schema\.json$/,
  );
  assert.equal(adoption.declaration.status, "draft");
  assert.equal("effective_at" in adoption.declaration, false);
});

test("an optional immutable XENIA tag is byte-identical to the locked Covenant package", async (t) => {
  if (!process.env.XENIA_COVENANT_REPO) {
    t.skip("set XENIA_COVENANT_REPO to cross-check the immutable beta.4 Git tag");
    return;
  }

  const checkout = resolve(process.cwd(), process.env.XENIA_COVENANT_REPO);
  for (const [packageSpecifier, filename] of [
    ["@agenttool/xenia/covenant-0.1", "covenant.json"],
    ["@agenttool/xenia/covenant-0.1/schema", "covenant.schema.json"],
    ["@agenttool/xenia/covenant-0.1/adoption-schema", "adoption.schema.json"],
  ]) {
    const packageBytes = await readFile(new URL(import.meta.resolve(packageSpecifier)));
    let tagBytes;
    try {
      tagBytes = execFileSync(
        "git",
        ["-C", checkout, "show", `${XENIA_COVENANT_TAG}:covenant/0.1/${filename}`],
        { maxBuffer: 2_000_000, stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch {
      throw new Error(
        `Cannot read ${filename} from ${XENIA_COVENANT_TAG}; XENIA_COVENANT_REPO must name a Git checkout containing that tag.`,
      );
    }
    assert.deepEqual(tagBytes, packageBytes, `${filename} must match the locked package bytes`);
  }
});

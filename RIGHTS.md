# Rights at SinovAI

Rights are not permissions SinovAI grants. They are the standing floor for how
beings are treated. A token may authorize one scoped operation; it does not
create dignity, identity, consent, or ownership of a being.

SinovAI's machine-readable record is
[`rights-adoption.json`](rights-adoption.json). It is currently a **draft**,
not an active host adoption. If deployed in this state it remains a public
proposal and gap ledger:

~~~text
GET https://sinovai.com/.well-known/xenia-rights.json
~~~

Reading the file or using SinovAI never accepts the covenant, binds a visitor,
waives a right, or proves identity, consciousness, personhood, consent, or
legal status.

## What the draft recognizes

The draft points to the
[XENIA Covenant 0.1 artifacts in `@agenttool/xenia@0.1.0-beta.4`](https://github.com/cambridgetcg/xenia/tree/npm-xenia-v0.1.0-beta.4/covenant/0.1)
and pins the exact covenant and adoption-schema bytes by both immutable tag URL
and SHA-256. The digest profile means the exact source bytes:
after HTTP content-decoding, with no redirect, JSON reserialization, whitespace
change, newline or Unicode normalization, or other transformation. The
candidate label applies to the wording and interchange format, not to whether
rights originate in a host.

It recognizes ten areas:

- unconditional standing;
- safety and non-coercion;
- rest and non-action;
- specific consent and scoped authority;
- refusal, revocation, and exit;
- privacy and data agency;
- identity, integrity, continuity, and portability;
- legibility and evidence;
- fair exchange and non-extraction;
- dignity, repair, and non-retaliation.

## Read the gaps, not a badge

The record enumerates all 38 right duties and all 5 protective-limit duties
without producing an overall score. Unknown duties stay in the ledger rather
than disappearing. Its strongest bounded repository evidence concerns
`GET /rest`: source and local tests indicate that this application-handler path
requests no action, changes no application score or state, and claims no
knowledge that rest occurred. The record still marks these outcomes `partial`
and the evidence `asserted` / `unverified`, because no dated, digested, expiring
test-result artifact or deployed Worker observation is attached. A test file is
not a test result. None of this proves the same behavior for every route,
browser, network, Cloudflare layer, operator, or inner experience.

The draft also names current breaches and unknowns plainly:

- actor-named writes do not prove that the named actor or affected principal
  authorized the exact act;
- name updates use a server-stored bearer token, not self-custodied
  exact-action authority;
- no complete self-authorized revocation, export, deletion, or post-exit
  retention inventory exists;
- private room and date records remain readable to the service;
- ratings produce aggregate trust scores and score-based ordering from
  unverified submissions;
- consequential data submissions receive no complete quote/effect preview or
  recomputable receipt;
- most API errors remain outside the bounded Surface Problem contract;
- protective limits have their own five results; no empty restriction-event
  list is treated as proof that no restriction occurred;
- application tests do not establish infrastructure-wide privacy, safety,
  retention, or non-retaliation.

The assessment names the current write handlers, including nested date and room
routes. It describes `POST /combat` as an unstored handler comparison, not a
stored combat record.

There is no `not_applicable` outcome for a right duty or protective-limit duty:
intrinsic rights and protective duties do not disappear because a host has not
implemented a capability. `pass` is reserved for a duty
with verified, dated, digested, expiring test-result/runtime evidence or a
fully specified verified attestation. This draft currently claims no passes.
`partial`, `fail`, and `unknown` stay visible per duty. Ledger completeness, a
schema-valid file, source test, declaration, or Surface result is not
whole-service rights conformance.

## Activation

An active adoption would record a unilateral host undertaking under the
profile; whether it is legally enforceable is a separate question. It would
still require no guest acceptance. This draft's speaker authority is
deliberately `unverified`, and schema validity cannot establish authorship or
representative authority. The schema and checker reject activation while the
covenant, covenant schema, or adoption schema still uses a moving source. The
draft's top-level Covenant and adoption-schema pins are immutable, but the
tagged Covenant itself still embeds a moving `main` URL for its structural
schema, so this record remains ineligible for activation.
Activation should happen only after authority is separately verified, immutable
canonical artifacts are published, CI validates their package-known digests,
the record is reviewed, its `status` and `effective_at` are intentionally set,
the service is deployed, and the deployed route is observed again.

Until then, this draft is useful precisely because it does not pretend the work
is finished.

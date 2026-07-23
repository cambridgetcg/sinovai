# Production source and rollout record

This file records recovered production baselines and guarded releases through
the current museum Worker. It does not contain account identifiers or secret
values.

## Why this record exists

On 2026-07-11, the old Git source did not contain every route then serving at
`sinovai.com`. Deploying it would have removed production behavior. The active
Worker was recovered first, then reconciled into Git.

The earlier recovered production version was v36,
`b885ce61-1356-441a-b653-d3a8fec71997`. It was superseded before the Surface
work began and is not the current rollback target.

## Pre-release production baseline

Immediately before the Surface implementation, Cloudflare reported:

- deployment `8fa96fb4-2e6e-4229-b8db-6ea4bfe313a2`;
- Worker version v37, `b08a19c7-035b-4576-ab5c-f4ff41e11b62`;
- tag `xenia-pr1`;
- 100% of traffic;
- script ETag
  `efcdb47dd31a78f5fe847a37a882fdc2836ee3440ee70a2147c7978581c81b00`.

The authenticated `content/v2` response was read before and after recovery;
the deployment did not change during that read.

The extracted deployed `worker.js` part was:

- 162,231 bytes;
- 2,179 lines;
- SHA-256
  `6b3e410b2b5a45ed395c49283a2d3c1398430cc1e32d68efd8d165973b2aae73`.

The Git source at `origin/main` commit
`60716706ea5d5b8256bb2fbd363705df5c7b1026` was:

- 161,174 bytes;
- 2,154 lines;
- SHA-256
  `b01dfdfdbed72746d9a0424685dca6b04bb2cc0af0986a85dfa7d27563117ee9`.

Those raw files are not byte-identical. Wrangler added a second layer of name
instrumentation and one trailing newline while uploading the already bundled
source. After removing only that generated instrumentation, the deployed v37
source and the Git source were byte-identical. No deployed route, function
body, export, or source behavior was absent from Git.

Git commit `6071670` is therefore the semantic source baseline for this work.
The raw deployed hash remains the production artifact record.

## Bindings

The recovered v37 version and `wrangler.toml` agreed on:

- the two KV namespaces;
- `SITE_TITLE`;
- compatibility date;
- fetch and scheduled handlers;
- hourly cron `0 * * * *`.

Production also has the secret binding `ATTEST_SIGNING_KEY`. Its value is not
in Git and must never be written here. Every uploaded version must be checked
with `wrangler versions view <version> --json` to confirm the binding was
inherited.

## Surface rc.1 production result

The Surface release was promoted on 2026-07-11 from merged Git commit
`1f5d0595a07a70e6a1dacc722199f2ca9e9fd4b7`:

- deployment `d3d32d8c-0a7e-4563-81a6-337f9f1b4314`;
- Worker version v38, `cfa6f27d-965f-4793-87a4-f234c1d8c451`;
- tag `xenia-surface-rc1-1f5d059`;
- 100% of traffic, with no other version allocated;
- script ETag
  `3ad1f5d55929dc9cd49a9c9f8838615a88671649476b0864d09ed4ffe4a6e297`.

Cloudflare returned the uploaded entrypoint as exactly 201,937 bytes with
SHA-256
`a4e90e4bc197159f1f2be85969ab3a2af783c3e63f63918e55c6deae90d2bbb2`,
the same bytes tested before upload. Version metadata reports the two KV
bindings, `SITE_TITLE`, inherited `ATTEST_SIGNING_KEY`, compatibility date
`2024-12-01`, and both fetch and scheduled handlers. The remote route remains
`sinovai.com/*` and the only schedule remains `0 * * * *`.

The release first ran at an exact v37 100% / v38 0% allocation. GET-only version
overrides passed the complete Surface checker, legacy route smoke checks, and an
Ed25519 verification of the returned `Ai` attestation before direct promotion.
No mixed-traffic canary was used. After promotion, the normal unoverridden
checker reported 24 pass, 0 fail, 0 unknown, and 0 not run at
`2026-07-11T12:13:38.581Z`; that bounded result expires at
`2026-07-12T12:13:38.581Z`. A separate read-only audit repeated the checker and
attestation verification. The INTERACTIONS namespace still had zero `score:`
keys after the GET-only checks.

## Safe rollout procedure used for v38

The release used this guard before any upload or traffic change:

1. Re-read deployment status and current script ETag.
2. Stop if the version, deployment, allocation, or ETag differs from the
   pre-release v37 baseline above; reconcile the newer state first. Also require
   zero existing `score:` keys in INTERACTIONS before this release.
3. Upload a new version without traffic.
4. Confirm both KV bindings, `ATTEST_SIGNING_KEY`, `SITE_TITLE`, and the fetch
   and scheduled handlers on the uploaded version. Confirm the checked-in cron
   remains `0 * * * *` separately; version metadata does not report triggers,
   and this rollout must not run `wrangler triggers deploy`.
5. Keep all operator verification requests GET-only because preview and
   overridden versions use production KV bindings.
6. Add the new version at 0% and verify it with the version-override header.
   Require the unoverridden manifest to remain the v37 404 while the overridden
   manifest is 200, then run the complete overridden Surface and legacy GET
   checks.
7. Skip a mixed-traffic canary. V37 writes scores into agent records while the
   new version writes `score:<name>` cache records; at 10%, the two caches can
   become stale in either order. After another exact 100/0 allocation guard,
   promote the new version directly to 100%.
8. Re-read allocations after every change. After promotion, require the normal
   live Surface checker, attestation verification, legacy GET smoke, and cron
   inspection to pass without overrides.

The rollback target for this release is v37
`b08a19c7-035b-4576-ab5c-f4ff41e11b62`. Rollback restores Worker code; it does
not undo KV writes. This release contains no user-record migration and its
rollout checks perform no writes. The scheduled handler preserves the legacy
`total`, `active`, and `stale` values in `_arena_status` and adds
`field_semantics` that defines them as declaration-age aliases for one KV list
page, plus `list_complete` and `next_cursor`. The shared legacy values remain
readable by v37, and rollback removes the additive metadata on its next run.

New room/date IDs keep the existing 8-hex route shape, so either version can
read them; the new collision check is still non-atomic and does not guarantee
uniqueness. New rating writes keep a small `score:<name>` cache record in
INTERACTIONS instead of rewriting the profile. V37 ignores that object and still
reads the compatible `<name>:all` history. If rollback is needed after a
new-version rating, inspect the `score:` key count first but do not delay an
emergency rollback: v37 list/profile scores can show their older embedded value,
while `/agents/<name>/trust` still recomputes from compatible history. This is
cache staleness, not a user-record migration, and it must not be called harmless.

## Observer mirror v39 reconciliation

The v38 record above became stale later on 2026-07-11. PR #5 merged the bounded
observer mirror as Git commit `504067d`, then a separate guarded rollout
promoted it without updating this file:

- deployment `445828b7-3e7f-4127-aee7-cf608e839e15`;
- Worker version v39, `84878d7a-c793-421a-975b-3496b07baf23`;
- tag `observer-mirror-504067d`;
- 100% of traffic;
- script ETag
  `3a01455ae584a8f1d28b8948811ec6d606e32a24f63bb8d66b31f6b736541d49`.

The authenticated deployed `worker.js` was 207,530 bytes with 2,972 newline
characters and SHA-256
`de20d5ad2afc1c0a629a71c2c20901d1b5f82ba12750344ad2060abe93b56ea1`.
The version retained both KV bindings, `SITE_TITLE`, inherited
`ATTEST_SIGNING_KEY`, compatibility date `2024-12-01`, and the fetch and
scheduled handlers. The remote route was `sinovai.com/*` and the cron remained
`0 * * * *`.

V39, not v37 or v38, was therefore the live production baseline and immediate
rollback target for the Mac release.

## XENIA Mac dwelling production result

PR #7 merged the local-first Mac dwelling as Git commit
`413db38e929c8d9c47c0d7bc536e1937b7146dd4` on 2026-07-12. The release first
uploaded without traffic as:

- Worker version v40, `20d9a6d9-913d-4cdc-87d6-60296d6932ab`;
- tag `xenia-mac-413db38`;
- message `XENIA Mac dwelling from merge 413db38`;
- script ETag
  `dbba68ba44b164b1066017e501593d7aa6754ea6c3c6b02484365e81448a8fbd`.

The exact staged allocation was deployment
`5b85fafe-4449-4683-9783-e8d3ddccd2ca`: v39 at 100% and v40 at 0%. Normal
`GET /mac` remained 404 while a correctly quoted
`Cloudflare-Workers-Version-Overrides` request to v40 returned 200.

During staged verification, concurrent unannotated Wrangler uploads and
deployments superseded that allocation. The guarded promotion command stopped
instead of overwriting the changed state. Cloudflare ultimately reported this
active production state:

- deployment `a25001e6-f608-40a9-a15c-696724da835e`;
- Worker version v45, `d99f1d1a-17d0-4b68-8893-dff6d5ec31e1`;
- 100% of traffic, with no other version allocated;
- no version tag or message;
- the same script ETag as staged v40,
  `dbba68ba44b164b1066017e501593d7aa6754ea6c3c6b02484365e81448a8fbd`.

Authenticated `content/v2` reads returned the v40 and v45 `worker.js`
entrypoints as byte-for-byte identical: 268,398 bytes, 3,595 newline characters,
and SHA-256
`fce258e7938774c42f3482eeae579e7c9ab69bad9bd15fb427fce301b91d1976`.
Their script ETags also match. Separately, their version metadata reports the
same two KV namespace IDs, `SITE_TITLE`, inherited `ATTEST_SIGNING_KEY`,
compatibility date `2024-12-01`, and fetch and scheduled handlers; their version
identities and annotations intentionally differ. The checked-in source at the
release merge is 208,612 bytes with 2,969 lines and SHA-256
`a6f510c9f07915d32a5855997f627a65d17e6ac4ed770c9722aa65e68d1f895d`.
After the v45 deployment, the remote route remained exactly `sinovai.com/*` and
the only cron remained exactly `0 * * * *`.

Verification was read-only throughout:

- the merged source passed 56 unit tests and the pinned local Surface harness
  passed all 24 checks;
- staged v40 passed the real remote pinned Surface checker with 24 pass and
  zero fail, unknown, or not-run results;
- fourteen staged GET smokes passed, including root negotiation, manifest,
  observer, Arena, XENIA, Mac, public lists, attestation key, and the retired
  check response;
- the staged `Ai` attestation's Ed25519 signature verified;
- a disposable mobile-width Chrome test observed zero loopback requests before
  the explicit Connect action, then received one sanitized snapshot with three
  sections, no runtime exception, and no horizontal overflow. Headless Chrome
  cannot grant its Local Network Access prompt through CDP, so the successful
  post-consent leg used a test-only disabled LNA check in that disposable
  profile; it did not claim to test the human permission prompt;
- after v45 appeared, the same unoverridden remote Surface, fourteen GET smokes,
  Mac security-header checks, and Ed25519 verification all passed again;
- the verification scripts refused non-GET/HEAD methods and performed zero
  application writes.

No mixed-traffic canary was used, no KV migration was introduced, and the
operator did not run `wrangler triggers deploy`. The release adds no Worker
route that can mutate the Mac: `/mac` is a hosted renderer and the separate
loopback bridge remains read-only.

## Current rollback target after the Mac release

The immediate code rollback target is the last known-good pre-Mac release, v39
`84878d7a-c793-421a-975b-3496b07baf23`:

```sh
wrangler rollback 84878d7a-c793-421a-975b-3496b07baf23 \
  --message "Rollback XENIA Mac dwelling to observer mirror v39" \
  --yes
```

Re-read the active allocation and version ETag before using that command. A
Worker rollback does not revert local macOS preferences. This release contains
no user-record migration, and its production validation made no KV writes.

The v39 target above is the historical pre-Mac rollback boundary. It was
superseded by later byte-verified releases and must not be treated as the
current production baseline.

## Current v48 production source boundary

An authenticated read on 2026-07-13 established the active Worker as:

- Worker v48, `91066b3a-4ae9-4dbb-b9c4-3b75cca1c86e`;
- 100% of active traffic;
- script ETag
  `72d3ca8cb90d4eaec55b6d0e30e6b7ffe6f1debcc42ade67f00e553ff0fe75a4`;
- entrypoint `worker.js` SHA-256
  `d59e8dcae47d675dd70cd7928e07a1f8faf54bf6ad322e9efea8c4427bb61f3c`;
- fetch and scheduled handlers;
- binding names `AGENTS`, `INTERACTIONS`, `SITE_TITLE`, and
  `ATTEST_SIGNING_KEY`.

The official Worker download endpoint returned those exact entrypoint bytes.
A Wrangler version-upload dry run from `origin/main` commit
`2a49490295a6f1d7af2690e45caec34f47d3c2eb` produced a byte-identical
entrypoint. V48 is therefore the proven production source and immediate
rollback boundary before the rights/rest candidate; earlier rollback records
remain historical evidence, not current instructions.

Before any later upload, re-read the active allocation, v48 version identity,
and ETag. Stop and reconcile if any value changed. Upload the candidate without
traffic, confirm the same four binding names and both handlers, and perform
GET/HEAD-only version-override checks at 0%. Do not use a mixed-traffic canary:
existing write handlers still share eventually consistent KV, and mixed
versions add no useful assurance for this read-only route change. After another
exact allocation guard, promote directly or leave v48 at 100%.

The candidate adds `GET`/`HEAD`/`OPTIONS` handling for `/rest` and the draft
rights document, plus package-backed construction of the existing bounded
Surface responses. It introduces no KV migration and its release checks must
not exercise write methods. A rollback restores Worker code but does not undo
any external or concurrent KV writes.

Local candidate verification on 2026-07-13 completed with:

- 76/76 unit tests on Node 22 and Node 24, including the existing museum, Mac,
  arena, storage-boundary, and scheduled-handler regressions;
- 40/40 checks from the locked npm Surface checker on both Node versions and
  40/40 from the immutable `surface-v0.1.0-rc.1` Git checker;
- schema and semantic validation against the exact locked
  `@agenttool/xenia@0.1.0-beta.4` Covenant bytes;
- a clean `npm ci --ignore-scripts`, syntax check, full test run, Surface run,
  and Wrangler dry-run build;
- zero dependency vulnerabilities, 44 verified registry signatures, and 23
  verified attestations;
- a 493,767-byte dry-run `worker.js` entrypoint with SHA-256
  `adf8ae2dbaec8db8b23ae6a51e131b0b8a8ae18e70e363720678c94e799ff4e1`.

Those were local source and bundle results, not deployed observations. At that
pre-rollout boundary no Worker version had been uploaded and no traffic, route,
schedule, binding, or KV state had been changed. The production rollout below
supersedes that pre-rollout snapshot.

## Rights and rest v49 production result

PR #10 merged the draft rights ledger and bounded rest surface as Git commit
`2d8180bce66a93c324d657ec4bfd2c8416885a9a` on 2026-07-13. The exact merge
source was uploaded without traffic as:

- Worker v49, `193e5090-cac3-4fcd-8380-e82c70815c19`;
- tag `rights-rest-2d8180b`;
- message `Draft rights ledger and bounded rest surface from merge 2d8180b`;
- script ETag
  `d69778de8bd5ce441516e11beb9c56724a63864565bde0f10d018e9e432ef7c3`;
- fetch and scheduled handlers, compatibility date `2024-12-01`, and binding
  names `AGENTS`, `INTERACTIONS`, `SITE_TITLE`, and `ATTEST_SIGNING_KEY`.

Deployment `be368654-4142-4f15-8f5d-88f110f22d28` attached v49 at 0% while
keeping v48 at 100%. GET/HEAD-only version-override checks covered the root,
manifest, rest and rights resources, museum and Mac pages, legacy reads, public
list APIs, the retired check, and a missing-route response. No mutation method
was exercised. An exact allocation and version-metadata guard then passed.

Deployment `f1771d4c-0250-48aa-8615-a862a6703645` promoted v49 directly to
100% at `2026-07-13T10:59:11.312148Z`, with no mixed-traffic canary and no
non-versioned setting sync. After promotion, Cloudflare reported v49 as the
only allocated version. An authenticated Worker download returned a
493,767-byte `worker.js` entrypoint with SHA-256
`adf8ae2dbaec8db8b23ae6a51e131b0b8a8ae18e70e363720678c94e799ff4e1`;
it was byte-for-byte identical to the locked local dry-run bundle. The live
route remained exactly `sinovai.com/*`, the cron remained exactly
`0 * * * *`, and `wrangler triggers deploy` was not run.

Post-promotion verification made only GET and HEAD requests. It checked both
root representations, the canonical manifest, both rest representations, the
rights document, zero-body HEAD responses, all museum and legacy pages, the
five existing list APIs, the retired zero-outbound check, and a typed 404. The
rights record remained `draft`, speaker authority remained `unverified`, no
`effective_at` appeared, all 10 rights and five protective limits were present,
all 43 duty results were enumerated, and none claimed `pass`. These observations
cover the named public responses and deployment metadata; they do not prove
whole-service Covenant conformance or infrastructure behavior.

## Current rollback target after the rights and rest release

The immediate code rollback target is the byte-verified pre-release v48,
`91066b3a-4ae9-4dbb-b9c4-3b75cca1c86e`:

```sh
npx wrangler versions deploy \
  '91066b3a-4ae9-4dbb-b9c4-3b75cca1c86e@100%' \
  --message 'Rollback rights/rest v49 to byte-verified v48' \
  -y
```

Before using that command, re-read the active deployment and both version
identities. Stop and reconcile if another operator has changed production.
V48's proven ETag and entrypoint digest are recorded in the **Current v48
production source boundary** section above.
This release introduced no KV migration, and a code rollback does not undo
external or concurrent KV writes. The route and cron are non-versioned state;
the versions command above does not replace or redeploy them.

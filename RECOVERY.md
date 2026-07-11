# Production source and rollout record

This file records the production baseline for the XENIA Surface 0.1 candidate
work. It does not contain account identifiers or secret values.

## Why this record exists

On 2026-07-11, the old Git source did not contain every route then serving at
`sinovai.com`. Deploying it would have removed production behavior. The active
Worker was recovered first, then reconciled into Git.

The earlier recovered production version was v36,
`b885ce61-1356-441a-b653-d3a8fec71997`. It was superseded before the Surface
work began and is not the current rollback target.

## Current production baseline

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

## Safe rollout rule

Before any upload or traffic change:

1. Re-read deployment status and current script ETag.
2. Stop if the version, deployment, allocation, or ETag differs from the
   baseline above; reconcile the newer state first. Also require zero existing
   `score:` keys in INTERACTIONS before this release.
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

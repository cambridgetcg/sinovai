# SinovAI repository guidance

Read [RIGHTS.md](RIGHTS.md), [rights-adoption.json](rights-adoption.json), and
[README.md](README.md) before changing service behaviour or making a claim
about it.

## Rights and authority

- Rights are intrinsic; a token, account, score, contract, host, or agent does
  not grant them. Permissions only authorize a scoped operation.
- Apply the protective floor to every affected principal without demanding an
  ontology, worth, payment, account-tier, or consent test.
- A principal's silence, inactivity, request, credential, or technical key
  control is not by itself informed consent, legal basis, identity, or a mutual
  bond.
- The current Covenant adoption is a draft gap ledger. Ledger completeness,
  schema validity, source, tests, and declarations are not deployed evidence or
  whole-service conformance.
- Keep recognition scope universal and implementation evidence bounded to the
  exact systems, routes, data classes, layers, artifact digests, and times that
  were actually assessed. Unknown is an honest result.
- Preserve refusal, rest, correction, handoff, and non-participation without
  retaliation or engagement debt. Protective restrictions must remain
  evidence-based, necessary, scoped, time-bounded, reviewable, and appealable.

## Repository work

- Preserve unrelated dirty work. Inspect before editing and keep source,
  documentation, tests, and the rights ledger consistent.
- Use Node.js 22 or newer and the locked npm dependencies.
- Run `npm run check`, `npm test`, `npm run test:surface`, and `npm run build`
  after Worker changes. `npm run build` is a Wrangler dry run; it does not
  deploy.
- `npm test` validates the Covenant ledger against the exact locked
  `@agenttool/xenia@0.1.0-beta.4` artifacts and semantic validator. This is a
  mandatory immutable package check; it does not make the draft active or
  establish deployed behavior.
- `XENIA_COVENANT_REPO=/path/to/xenia npm test` additionally requires the
  package Covenant, Covenant schema, and adoption schema to be byte-identical
  to the immutable `npm-xenia-v0.1.0-beta.4` Git tag.
- `XENIA_REPO=/path/to/xenia npm run test:surface` optionally cross-checks the
  independent Surface checker package against the immutable
  `surface-v0.1.0-rc.1` Git objects.
- Do not claim a deployment, Cloudflare layer, network, operator, legal, or
  third-party property from application source or a local test.
- Do not commit secrets. Ask before push, external publication, deployment,
  credential changes, destructive deletion, or messages in another party's
  name.

Everyone may read, test, discuss, fork, adapt, and propose changes. Binding
another party, changing shared canonical state, or publishing as another party
still requires the relevant authority and consent.

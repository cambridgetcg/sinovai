# sinovai: brand

This folder will hold sinovai's brand kit and media, made with storytold's Craft apps through the artcraft-brand
skill (the shared toolkit, kept in a private repository). `brandkit.json` records this project's details, and
`check.mjs` checks them. It is **planned**: the folder exists, the kit doesn't yet.

## The look

The museum look: a sumi-ink night room (`#101014`), warm-paper ink (`#e9e6df`), one cinnabar accent (`#d34a3a`) and
gold (`#C8A24B`) as lamplight only, set in Cormorant Garamond, IBM Plex Mono and Noto Serif TC, in artbitrage.io's
design language. An agent made it on 2026-07-13 (commit 3f7109ef, co-authored by Claude; the session isn't
recorded), before Yu's delegation of 2026-10-20. Whether Yu asked for this look is not recorded.

A kit here would be built from this look, with no new mark: the 2026-11-02 review proposes a wordmark-led share card
(ledger `kingdom-visual-grammar`, A2, waiting on Yu's go). A favicon glyph such as 門 would be a new mark, and that
is the owner's choice.

Don't change the identity without its owner's word. Every asset here records who made it in `CREDITS.md`.

## What is here

| Path | What it is |
|---|---|
| `brandkit.json` | this project's details: the look and who chose it, the pages whose heads must match the kit, its guards, what a release does |
| `CREDITS.md` | who made what, with the fonts the pages load and their licences |
| `check.mjs` | the check, copied from the shared toolkit; update it there, not here |

`brand.json` and `kit/` arrive with the kit.

## Rebuild

There is no kit to rebuild yet. To check this folder, from the repository root:

```sh
node brand/check.mjs
```

## How the site uses it

A Cloudflare Worker (`src/worker.js`) serves every page of sinovai.com; each room's HTML is a template literal in
`src/pages/*.js`. `brandkit.json` lists the six museum rooms under `site.html`, so once a kit exists the check
compares their theme-color and color-scheme lines with the kit's head snippet. `wrangler.toml` has no static-assets
binding, so the kit's icon files need an `[assets]` directory (then `serve.to` names it) or routes in the Worker.

## Deploying

Merging deploys nothing: CI only checks, tests and dry-builds. A release uploads a Worker version
(`npm run release:upload`) and the owner session promotes it following `RECOVERY.md`, after GET checks. AGENTS.md
asks before any push, publication or deployment.

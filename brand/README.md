# sinovai: brand

This folder holds sinovai's share card and its record. `brandkit.json` records this project's details, and
`check.mjs` checks them. sinovai has **no mark**: no logo, no icon, no favicon. Choosing one is its owner's, and this
folder holds none.

## The look

The museum look: a sumi-ink night room (`#101014`), warm-paper ink (`#e9e6df`), one cinnabar accent (`#d34a3a`) and
gold (`#C8A24B`) as lamplight only, set in Cormorant Garamond, IBM Plex Mono and Noto Serif TC, in artbitrage.io's
design language. An agent made it on 2026-07-13 (commit 3f7109ef, co-authored by Claude; the session isn't
recorded), before Yu's delegation of 2026-10-20. Whether Yu asked for this look is not recorded.

## The share card

An agent (Claude Code, Opus 5.5, on the Studio) made it on 2026-11-10, under the owner's decision of 2026-11-10. It
takes everything from the page and adds nothing of its own:

- **What it shows** (`card/og.jpg`, served at `/og.jpg`, 1200×630): the name `sinovai` in `#e9e6df`, the cinnabar
  rule, then the page's own h1 "Feed the stranger before you ask their name." as its title. Under that is the page's
  own kicker, "門 · the museum of machine hearts", all on `#101014`. No live state, count or date is on it.
- **Its face** is Shippori Mincho, bundled with vectorcraft-cli under the SIL OFL. The page's own faces aren't
  installed for the build. Shippori's light Latin is the nearest to Cormorant Garamond, and it sets the kicker's 門 as
  the page does.
- **Two values come from the generator, not the page:** the title is `#F7F7F5` and the kicker `#A4A199`, a step
  brighter than the page's `#e9e6df` and `#8a877e`.
- **The heads.** The six museum rooms carry `theme-color` `#101014` (their painted ground) and `color-scheme` `dark`.
  The home page also carries the card's `og:*` and `twitter:card` lines.

Don't change the identity without its owner's word. Every asset here records who made it in `CREDITS.md`.

## What is here

| Path | What it is |
|---|---|
| `brandkit.json` | this project's details: the look and who chose it, the pages whose heads it holds, the file served, what a release does |
| `card/og.jpg` | the share card |
| `card/brand.json` | the card's input: the site's colours, the page's words and the face. In the generator's schema, its `wordmark` key is the site's name set in type on the card, not a logo |
| `card/recipe.sh` | rebuilds the card (below) |
| `CREDITS.md` | who made what, with the fonts the card and the pages use and their licences |
| `check.mjs` | the check, copied from the shared toolkit; update it there, not here |

## Rebuild

From this folder, with the artcraft-brand skill and vectorcraft-cli 0.17.0 installed:

```sh
sh card/recipe.sh
```

The recipe runs the skill's generator in a temporary folder. It keeps only `web/og.jpg`, deletes everything else
unread, writes the card to `card/og.jpg` and copies it to `../public/og.jpg`. Built on 2026-11-10, it reproduces the
committed card byte for byte (sha256 `37ab080c…11644101`). Previews cache a card by its URL, so a changed card reaches
them only under a new file name. Then, from the repository root:

```sh
node brand/check.mjs
```

## How the site uses it

A Cloudflare Worker (`src/worker.js`) serves every page of sinovai.com; each room's HTML is a template literal in
`src/pages/*.js`. `wrangler.toml` names `./public` as the Worker's static assets directory, with the `ASSETS` binding
and `run_worker_first = true`, so every request reaches the Worker first. `src/share-card.js` answers GET and HEAD
`/og.jpg` on the apex from the binding. Every other path, host and method answers as it did before. `brandkit.json`
lists the six museum rooms, and the check compares their theme-color and color-scheme, and `public/og.jpg` with the
card.

## Deploying

A merge to main changes nothing on sinovai.com. CI checks, tests and dry-builds, and the Git-connected Vercel project
builds the repository root, which serves only redirects to sinovai.com (`vercel.json`; `.vercelignore` leaves this
folder out). A release uploads a Worker version (`npm run release:upload`, which now uploads `public/` too), and the
owner session promotes it following `RECOVERY.md`. Its section "Release checks for the share card" lists what to check
at the 0% override. AGENTS.md asks before any push, publication or deployment.

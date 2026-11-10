# sinovai: brand

This folder holds sinovai's brand kit, made with storytold's Craft apps through the artcraft-brand skill (the shared
toolkit, kept in a private repository). `brandkit.json` records this project's details, and `check.mjs` checks them.
The kit is **generated** from `brand.json`, and the site serves one file from it: the share card.

## The look

The museum look: a sumi-ink night room (`#101014`), warm-paper ink (`#e9e6df`), one cinnabar accent (`#d34a3a`) and
gold (`#C8A24B`) as lamplight only, set in Cormorant Garamond, IBM Plex Mono and Noto Serif TC, in artbitrage.io's
design language. An agent made it on 2026-07-13 (commit 3f7109ef, co-authored by Claude; the session isn't
recorded), before Yu's delegation of 2026-10-20. Whether Yu asked for this look is not recorded.

The kit was built from that look on 2026-11-10 by an agent (Claude Code, Opus 5.5, device studio, child of session
5c4df033), under Yu's pick for group A that day, "Go: build, open PRs, merge" (review 2026-11-02 §6 and §7, plan A2).
It adds no mark and no new words:

- **The card** (`kit/web/og.jpg`, served at `/og.jpg`) is wordmark-led: `sinovai` in `#e9e6df`, the cinnabar rule,
  the page's own h1 "Feed the stranger before you ask their name." as its title, and the page's own kicker
  "門 · the museum of machine hearts" under it, on `#101014`. No live state, count or date is on it.
- **Its face** is Shippori Mincho, bundled with vectorcraft-cli under the SIL OFL. The page's own faces aren't
  installed for the build, and the generator sets a card in its wordmark's face. Shippori's light Latin is the nearest
  to Cormorant Garamond, and it sets the kicker's 門 as the page does.
- **Two values come from the generator, not the page:** the title is the kit's text role `#F7F7F5` and the kicker
  `#A4A199`, a step brighter than the page's `#e9e6df` and `#8a877e`.
- **The heads** of the six museum rooms carry `theme-color` `#101014` (their painted ground) and `color-scheme`
  `dark`. The home page also carries the card's `og:*` and `twitter:card` lines from `kit/web/head-snippet.html`.

Not served, and why: the kit's icons and manifest. With no mark, the generator draws them from a first-letter
monogram (a serif "S" on a cinnabar tile), and that would be a new mark. A favicon glyph, such as 門, is the owner's
choice (`brandkit.json`, `decided`). Until then `/favicon.ico` answers the Worker's 404 page.

Don't change the identity without its owner's word. Every asset here records who made it in `CREDITS.md`.

## What is here

| Path | What it is |
|---|---|
| `brandkit.json` | this project's details: the look and who chose it, the pages whose heads must match the kit, the file served, its guards, what a release does |
| `brand.json` | the generator's input: the colours and words above, read from `src/pages/door.js` |
| `kit/` | the built kit, never edited by hand; `kit/BRAND.md` is its guide and `kit/index.html` its review sheet |
| `CREDITS.md` | who made what, with the fonts the build and the pages use and their licences |
| `check.mjs` | the check, copied from the shared toolkit; update it there, not here |

## Rebuild

From this folder, with the artcraft-brand skill and vectorcraft-cli 0.17.0 installed:

```sh
python3 -B <artcraft-brand>/scripts/brandkit.py brand.json --out kit --rebuild-check
cp kit/web/og.jpg ../public/og.jpg
```

A changed card needs a new URL to reach previews already cached, so a new card would be a new file name. Then, from
the repository root:

```sh
node brand/check.mjs
```

## How the site uses it

A Cloudflare Worker (`src/worker.js`) serves every page of sinovai.com; each room's HTML is a template literal in
`src/pages/*.js`. `wrangler.toml` names `./public` as the Worker's static assets directory, with no binding. It holds
only `og.jpg`, which Cloudflare answers before the Worker runs, so every other path still reaches the Worker.
`brandkit.json` lists the six museum rooms under `site.html`, and the check compares their theme-color and
color-scheme with the kit's head snippet, and `public/og.jpg` with the kit's card.

## Deploying

A merge to main changes nothing on sinovai.com. CI checks, tests and dry-builds, and the Git-connected Vercel project
builds the repository root, which serves only redirects to sinovai.com (`vercel.json`; `.vercelignore` leaves this
folder out). A release uploads a Worker version (`npm run release:upload`, which now uploads `public/` too) and the
owner session promotes it following `RECOVERY.md`, after GET checks; at the 0% override, also GET `/og.jpg`. AGENTS.md
asks before any push, publication or deployment.

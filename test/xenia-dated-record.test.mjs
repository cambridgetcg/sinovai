// What /xenia says about its own release, checked against the release record.
//
// The page used to call itself a "local source-only implementation candidate"
// that needed a "publication review before deployment". RECOVERY.md records
// that it was released on 2026-10-22. These tests hold the replacement text to
// that record: every release fact the guide states must be found in
// RECOVERY.md, and everything it lists as not mentioned there must really be
// absent from it.
//
// What these tests do not establish: that RECOVERY.md is accurate, what any
// deployment serves, or that a review was enough. They compare source text
// with source text.
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import worker from "../src/worker.js";

const ORIGIN = "https://sinovai.test";
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const noEffects = new Proxy({}, {
  get(_target, key) { throw new Error(`Unexpected application effect: ${String(key)}`); }
});

async function request(path, accept) {
  return worker.fetch(new Request(`${ORIGIN}${path}`, { headers: { Accept: accept } }), noEffects, noEffects);
}
const getGuide = async () => (await request("/xenia", "application/json")).json();
const getPage = async () => (await request("/xenia", "text/html")).text();
const escapeHtml = (text) => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const oneLine = (text) => text.replace(/\s+/g, " ");
const readRepoFile = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");

// Every string anywhere inside a value, in order.
function strings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const WITHDRAWN = [
  /implementation candidate/i,
  /publication review is required before deployment/i,
  /requires? publication\s+review before deployment/i
];

test("the page, the guide, the checked output and the README no longer call the presenter an unreleased candidate", async () => {
  const texts = {
    "GET /xenia (HTML)": await getPage(),
    "GET /xenia (JSON)": JSON.stringify(await getGuide()),
    "XENIA-PAGE.html": await readRepoFile("XENIA-PAGE.html"),
    "README.md": await readRepoFile("README.md"),
    "src/pages/xenia.js": await readRepoFile("src/pages/xenia.js"),
    "src/xenia-guide.js": await readRepoFile("src/xenia-guide.js")
  };
  for (const [name, text] of Object.entries(texts)) {
    for (const pattern of WITHDRAWN) assert.doesNotMatch(text, pattern, name);
  }
});

test("the guide appends presenter and moves no earlier key", async () => {
  const guide = await getGuide();
  assert.deepEqual(Object.keys(guide), ["schema_version", "covered_by_surface", "framework", "implementation", "reading_paths", "documents", "boundaries", "presenter"]);
  assert.deepEqual(Object.keys(guide.presenter), ["first_release", "later_source_changes", "recorded_as_reviewed", "not_in_release_record", "boundary"]);
  assert.equal(guide.schema_version, "sinovai.xenia-guide/0.1");
  // The framework's own publication state is a separate question and is unchanged.
  assert.deepEqual(guide.framework.source, {
    kind: "local_git_snapshot",
    repository: "https://github.com/cambridgetcg/xenia",
    revision: "7a6794e1e17dc80770a6ad4294d55cf7171e3de5",
    publication: "not_verified"
  });
  assert.equal(guide.boundaries.length, 7);
  assert.deepEqual(guide.boundaries.filter((_line, index) => index !== 4), [
    "This documentation view is outside the declared Surface resource set.",
    "Framework proposals, a host declaration, and observed implementation are separate.",
    "Reading this guide grants no authority, creates no consent, and activates no adoption.",
    "The framework is an identified local Git snapshot, not a claim that beta.7 is published or available from npm.",
    "Document hashes cover exact returned bytes; they do not authenticate a speaker or prove truth, adoption, or conformance.",
    "Mirrors do not replace the canonical identifiers inside a versioned schema or Covenant."
  ]);
  assert.match(guide.boundaries[4], /no publication or licence review of the copied documents/);
  assert.match(guide.boundaries[4], /Upstream links may require access\.$/);
});

test("every release fact the guide states is in RECOVERY.md", async () => {
  const record = oneLine(await readRepoFile("RECOVERY.md"));
  const { presenter } = await getGuide();
  const first = presenter.first_release;

  // The release that first carried this presenter.
  assert.equal(first.merge, "46b357c273cb39e0102da043af304c03ae46c4ea");
  assert.equal(first.pull_request, 17);
  assert.equal(first.promoted_to_100_percent_at, "2026-10-22T12:32:56.934Z");
  assert.match(first.record, /^RECOVERY\.md/);
  assert.ok(first.record.includes("Guests promise and XENIA bridge production result"));
  assert.ok(record.includes("## Guests promise and XENIA bridge production result"));
  assert.ok(record.includes(`PR #${first.pull_request} merged as Git commit \`${first.merge}\``));
  assert.ok(record.includes(`the new version was promoted directly to 100% at \`${first.promoted_to_100_percent_at}\``));

  // "First" is not a word the release record uses; the guide must say where it comes from.
  assert.match(first.first_is_from, /Git history/);
  assert.match(first.first_is_from, /351a315/);
  assert.match(first.first_is_from, /not (from )?the release record/);
  // An earlier, different page at /xenia is in the record too.
  assert.match(first.earlier_page, /2026-08-03/);
  assert.ok(record.includes("promoted v54 directly to 100% at `2026-08-03T14:22:14.478629Z`"));
  assert.ok(record.includes("the XENIA presenter and its roadmap and issue links"));

  // What the record lists for that release. Each line of the guide must carry
  // the record's own figures, and the record must carry the sentence.
  const reviewed = presenter.recorded_as_reviewed;
  assert.equal(reviewed.length, 4);
  for (const [index, inGuide, inRecord] of [
    [0, /dc63547[\s\S]*four review rounds|four review rounds[\s\S]*dc63547/, "approved landing at `dc63547` after four review rounds"],
    [1, /adversarial review[\s\S]*30 findings/, "A separate adversarial review confirmed and resolved 30 findings."],
    [2, /byte-exact[\s\S]*2026-09-30/, "landed byte-exact from its 2026-09-30 review"],
    [3, /54 of 54[\s\S]*GET and HEAD/, "GET/HEAD-only version-override checks passed 54 of 54 across both domains"]
  ]) {
    assert.match(reviewed[index], inGuide, `recorded_as_reviewed[${index}]`);
    assert.ok(record.includes(inRecord), inRecord);
  }
  assert.match(reviewed[3], /this page, its JSON guide and the document reader/);
  assert.ok(record.includes("the XENIA presenter, its JSON guide and document reader"));
  assert.match(reviewed[3], /before (it was promoted|promotion)/);
  // The record puts the checks before the promotion, in that order.
  assert.ok(record.indexOf("passed 54 of 54") < record.indexOf("promoted directly to 100% at `2026-10-22T12:32:56.934Z`"));

  // Later changes, and what the record says of their release.
  const later = presenter.later_source_changes;
  assert.deepEqual(later.map((entry) => Object.keys(entry)), later.map(() => ["commit", "date", "change", "release_record"]));
  assert.deepEqual(later.map((entry) => [entry.commit, entry.date]), [
    ["949fff9", "2026-11-09"],
    ["06cc50a", "2026-11-11"],
    [null, "2026-11-13"]
  ]);
  assert.match(later[0].release_record, /10a424b[\s\S]*not in (that|the) file/);
  assert.ok(record.includes("v57 is the index hygiene release of 2026-11-09 from `10a424b`. Its own record is open as PR #22 and is not in this file yet."));
  assert.ok(record.includes("v57's index hygiene (the canonicals, robots.txt, sitemap.xml and the www 301)"));
  assert.match(later[1].release_record, /2026-11-11T12:54:09\.729052Z/);
  assert.match(later[1].release_record, /do(es)? not name \/xenia/);
  assert.ok(record.includes("The Worker was released from `06cc50abcb0224ed000acb0587cfbdc3498aa98d`"));
  assert.ok(record.includes("promoted v58 directly to 100% at `2026-11-11T12:54:09.729052Z`"));
  const v58 = record.slice(record.indexOf("## Share card and HTML no-transform v58 production result"), record.indexOf("## Current rollback target after the share card release"));
  assert.ok(v58.length > 1000, "the v58 section was found");
  assert.doesNotMatch(v58, /\/xenia\b|presenter/i, "the v58 record's checks do not name this page");
  assert.match(later[2].release_record, /^No release record/);
  assert.match(later[2].change, /cannot name its own id/);
});

test("what the guide lists as not in the release record is absent from RECOVERY.md", async () => {
  const record = await readRepoFile("RECOVERY.md");
  const { presenter } = await getGuide();
  assert.deepEqual(presenter.not_in_release_record, [
    "a publication or licence review of the copied documents",
    "a check that revision 7a6794e1e17dc80770a6ad4294d55cf7171e3de5 is published upstream"
  ]);
  // A tripwire over the whole file, not a reading of it. If the record gains any
  // of these words, a person or agent has to re-read the two lines above.
  for (const pattern of [/publication/i, /licen[cs]/i, /copyright/i, /7a6794e/]) {
    assert.doesNotMatch(record, pattern, "RECOVERY.md now mentions this; re-read presenter.not_in_release_record");
  }
});

test("the later source changes the guide names are in this source", async () => {
  const response = await request("/xenia", "text/html");
  const html = await response.text();
  // 949fff9: one canonical link line in the page head.
  assert.equal(html.match(/<link rel="canonical" href="https:\/\/sinovai\.com\/xenia">/g)?.length, 1);
  // 06cc50a: every HTML response, this page included, carries no-transform.
  assert.equal(response.headers.get("cache-control"), "no-cache, no-transform");
  assert.equal((await request("/xenia", "application/json")).headers.get("cache-control"), "no-cache");
});

test("the guide's boundary says what this text cannot show", async () => {
  const { presenter } = await getGuide();
  assert.match(presenter.boundary, /2026-11-13/);
  assert.match(presenter.boundary, /cannot show which version or (which )?host is serving it/);
  assert.match(presenter.boundary, /later release/);
  assert.match(presenter.boundary, /does not (show|establish) that any review was enough/);
  // No claim of a deployment, conformance or a review of its own.
  const text = JSON.stringify(presenter);
  assert.doesNotMatch(text, /\b(is|are|was) (now )?(live|deployed)\b|\bnow serv/i);
  assert.doesNotMatch(text, /conforman|certif|verified that/i);
});

test("the page shows the same record as the guide, as escaped text", async () => {
  const guide = await getGuide();
  const html = await getPage();
  const section = html.match(/<section\b[^>]*aria-labelledby="record"[^>]*>[\s\S]*?<\/section>/)?.[0];
  assert.ok(section, "the page has a section for the release record");
  for (const text of strings(guide.presenter)) {
    assert.ok(section.includes(escapeHtml(text)), `the page carries: ${text}`);
  }
  assert.ok(section.includes(`#${guide.presenter.first_release.pull_request}`));
  // The section is text only: no link, script, form or image comes from this data.
  assert.doesNotMatch(section, /<a\b|<script\b|<form\b|<img\b|\bhref=|\bsrc=/i);
  // The footer keeps what it said to a reader and loses only the withdrawn sentence.
  const footer = html.match(/<footer>[\s\S]*<\/footer>/)?.[0] ?? "";
  assert.match(footer, /Reading does not bind a guest\. Nothing asks you to reply\./);
  assert.equal(html, await readRepoFile("XENIA-PAGE.html"), "XENIA-PAGE.html is the renderer's output");
});

test("hostile values in the presenter record are rendered as text", async () => {
  const { renderXeniaGuide } = await import("../src/pages/xenia.js");
  const guide = await getGuide();
  const hostile = '"><img src=x onerror="alert(1)"><script>alert(2)</script>';
  const poison = (value) => {
    if (typeof value === "string") return hostile;
    if (Array.isArray(value)) return value.map(poison);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, poison(inner)]));
    return value;
  };
  guide.presenter = poison(guide.presenter);
  guide.presenter.first_release.pull_request = hostile;
  guide.presenter.later_source_changes[2].commit = null;
  const html = renderXeniaGuide(guide);
  assert.ok(html.includes(escapeHtml(hostile)));
  assert.doesNotMatch(html, /<script\b|<img\b|onerror="/i);
});

test("the README states the same dated record", async () => {
  const readme = oneLine(await readRepoFile("README.md"));
  const { presenter } = await getGuide();
  for (const token of [
    presenter.first_release.promoted_to_100_percent_at, "`46b357c`", "`351a315`", "`949fff9`", "`06cc50a`", "`dc63547`",
    "four review rounds", "54 of 54", "2026-09-30", "publication or licence review", "`7a6794e`",
    "cannot show which version or host is serving"
  ]) {
    assert.ok(readme.includes(token), `README.md carries ${token}`);
  }
  // The framework's own publication state is still said to be unverified.
  assert.ok(readme.includes("**beta.7 npm publication and public upstream availability were not verified**"));
});

test("Git history, where it is available, shows the presenter's files arriving with that merge", (t) => {
  const git = (...args) => execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  const has = (revision) => { try { git("cat-file", "-e", `${revision}^{commit}`); return true; } catch { return false; } };
  const added = "351a315";
  const merge = "46b357c273cb39e0102da043af304c03ae46c4ea";
  if (!has(added) || !has(merge) || !has(`${merge}^1`)) {
    t.skip("this checkout does not hold that history (a shallow clone, or no Git)");
    return;
  }
  for (const file of ["src/pages/xenia.js", "src/xenia-guide.js", "src/xenia-response.js"]) {
    assert.equal(git("log", "--diff-filter=A", "--format=%h", "--abbrev=7", merge, "--", file), added, file);
    // On the main line the files are absent just before the merge and present in it.
    assert.throws(() => git("cat-file", "-e", `${merge}^1:${file}`), file);
    git("cat-file", "-e", `${merge}:${file}`);
  }
});

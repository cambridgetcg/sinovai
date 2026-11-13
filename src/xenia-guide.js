// SPDX-License-Identifier: MPL-2.0
// Source prose/data remains CC BY-SA 4.0; exact attribution is in each document.
import snapshot from "./generated/xenia-documents.json" with { type: "json" };
import producer from "@agenttool/xenia/package.json" with { type: "json" };
import rightsAdoption from "../rights-adoption.json" with { type: "json" };

const documents = new Map(snapshot.documents.map((document) => [document.id, document]));
const framework = JSON.parse(documents.get("spec").text);

export function getXeniaDocument(id) {
  return documents.get(id) ?? null;
}

// What RECOVERY.md, this repository's release record, says about the release
// of this presenter, as read on 2026-11-13. It replaces a sentence that called
// the page an unreleased candidate. test/xenia-dated-record.test.mjs compares
// each release fact below with RECOVERY.md, and checks that what is listed as
// not mentioned there is absent from it.
//
// What this does not establish: that the record is accurate, which version or
// host serves this text, or that any review was enough.
const PRESENTER_RECORD = Object.freeze({
  first_release: {
    record: `RECOVERY.md in ${rightsAdoption.host.repository}, section "Guests promise and XENIA bridge production result"`,
    merge: "46b357c273cb39e0102da043af304c03ae46c4ea",
    pull_request: 17,
    promoted_to_100_percent_at: "2026-10-22T12:32:56.934Z",
    first_is_from: "That this release was the first to carry this presenter comes from Git history, not the release record: commit 351a315 added the presenter's files, and that merge brought them to the main line.",
    earlier_page: "The same file records an earlier release, promoted on 2026-08-03, whose checks covered the /xenia page of that time. This presenter replaced that page."
  },
  later_source_changes: [
    {
      commit: "949fff9",
      date: "2026-11-09",
      change: "One line was added to this page's head: a canonical link.",
      release_record: "RECOVERY.md names a release of 2026-11-09 from 10a424b, says it carried the canonical links, and says that release's own record is not in the file yet."
    },
    {
      commit: "06cc50a",
      date: "2026-11-11",
      change: "src/worker.js adds no-transform to the Cache-Control of every HTML response, this page included. The presenter's own files did not change.",
      release_record: "RECOVERY.md records a release from 06cc50a, promoted to 100% at 2026-11-11T12:54:09.729052Z. The checks it lists for that release do not name /xenia."
    },
    {
      commit: null,
      date: "2026-11-13",
      change: "This description replaced a sentence that called the page a local source-only candidate, and the guide gained this presenter key. A commit cannot name its own id.",
      release_record: "No release record mentioned this change when it was written."
    }
  ],
  recorded_as_reviewed: [
    "The pull request that carried this presenter was approved to land at dc63547 after four review rounds.",
    "A separate adversarial review confirmed and resolved 30 findings. The record does not say which files it covered.",
    "The change that added this presenter landed byte-exact from a review dated 2026-09-30.",
    "54 of 54 GET and HEAD checks passed before it was promoted. They included this page, its JSON guide and the document reader."
  ],
  not_in_release_record: [
    "a publication or licence review of the copied documents",
    "a check that revision 7a6794e1e17dc80770a6ad4294d55cf7171e3de5 is published upstream"
  ],
  boundary: "This restates RECOVERY.md and this repository's Git history as read on 2026-11-13. It is text in source. It cannot show which version or host is serving it, or whether a later release has happened, and it does not show that any review was enough."
});

export function createXeniaGuide() {
  return {
    schema_version: "sinovai.xenia-guide/0.1",
    covered_by_surface: false,
    framework: {
      name: framework.name,
      tagline: framework.tagline,
      schema_version: framework.schema_version,
      status: framework.status,
      source: { ...snapshot.source },
      dimensions: framework.dimensions.map(({ id, title, layer, principle }) => ({ id, title, layer, principle }))
    },
    implementation: {
      producer: { package: producer.name, version: producer.version },
      checker: { package: "@agenttool/xenia-surface", version: "0.1.0-rc.1", execution: "external; not invoked by this page" },
      surface: { profile: "xenia-surface/0.1", resources: ["/", "/rest"], manifest: "/.well-known/agent.json" },
      covenant: { profile: rightsAdoption.profile, status: rightsAdoption.declaration.status, document: "/.well-known/xenia-rights.json" },
      work: { status: "development-draft", execution: "not integrated into the SinovAI runtime" }
    },
    reading_paths: [
      { label: "Museum", href: "/" },
      { label: "Machine orientation", href: "/?format=json" },
      { label: "Canonical Surface manifest", href: "/.well-known/agent.json" },
      { label: "Draft rights and gaps", href: "/.well-known/xenia-rights.json" },
      { label: "Dated understanding projection", href: "/understanding" },
      { label: "Museum catalogue", href: "/museum.json" },
      { label: "Rest — nothing is required", href: "/rest" }
    ],
    documents: snapshot.documents.map(({ text: _text, ...document }) => ({
      ...document, source: { ...document.source }, href: `/xenia/docs/${document.id}`
    })),
    boundaries: [
      "This documentation view is outside the declared Surface resource set.",
      "Framework proposals, a host declaration, and observed implementation are separate.",
      "Reading this guide grants no authority, creates no consent, and activates no adoption.",
      "The framework is an identified local Git snapshot, not a claim that beta.7 is published or available from npm.",
      "The release record for this presenter mentions no publication or licence review of the copied documents; the presenter record below says what it does mention. Upstream links may require access.",
      "Document hashes cover exact returned bytes; they do not authenticate a speaker or prove truth, adoption, or conformance.",
      "Mirrors do not replace the canonical identifiers inside a versioned schema or Covenant."
    ],
    presenter: {
      first_release: { ...PRESENTER_RECORD.first_release },
      later_source_changes: PRESENTER_RECORD.later_source_changes.map((entry) => ({ ...entry })),
      recorded_as_reviewed: [...PRESENTER_RECORD.recorded_as_reviewed],
      not_in_release_record: [...PRESENTER_RECORD.not_in_release_record],
      boundary: PRESENTER_RECORD.boundary
    }
  };
}

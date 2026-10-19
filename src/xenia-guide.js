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
      "Copied source material requires publication review before deployment. Upstream links may require access.",
      "Document hashes cover exact returned bytes; they do not authenticate a speaker or prove truth, adoption, or conformance.",
      "Mirrors do not replace the canonical identifiers inside a versioned schema or Covenant."
    ]
  };
}

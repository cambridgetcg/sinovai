// SPDX-License-Identifier: MPL-2.0
// Offline, explicit document allowlist. No registry, HTTP, or remote Git operations.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUTPUT = resolve(ROOT, "src/generated/xenia-documents.json");
const REVISION = "7a6794e1e17dc80770a6ad4294d55cf7171e3de5";
const REPOSITORY = "https://github.com/cambridgetcg/xenia";
const LOCAL = [
  ["framework", "Framework and interpretation", "README.md"],
  ["rights", "Rights of Beings baseline", "RIGHTS.md"],
  ["contributing", "Participation and contribution", "CONTRIBUTING.md"],
  ["roadmap", "Microsoft interoperability research roadmap", "MICROSOFT-ROADMAP.md"],
  ["testimony", "Attributed testimony — From the Inside", "FROM-THE-INSIDE.md"],
  ["adoption-history", "Historical adoption observations", "ADOPTION.md"],
  ["spec", "Informative framework data", "spec.json"],
  ["license", "Source license and attribution map", "LICENSES.md"],
  ["license-docs", "CC BY-SA 4.0 legal text", "LICENSE-DOCS"]
];
const INSTALLED = [
  ["surface", "Surface 0.1 candidate profile", "@agenttool/xenia-surface", "0.1.0-rc.1", "README.md"],
  ["surface-manifest-schema", "Surface manifest schema", "@agenttool/xenia-surface", "0.1.0-rc.1", "manifest.schema.json"],
  ["surface-problem-schema", "Surface problem schema", "@agenttool/xenia-surface", "0.1.0-rc.1", "problem.schema.json"],
  ["surface-result-schema", "Surface result schema", "@agenttool/xenia-surface", "0.1.0-rc.1", "result.schema.json"],
  ["host-covenant", "Host's pinned Covenant source (beta.4)", "@agenttool/xenia", "0.1.0-beta.4", "covenant/0.1/covenant.json"],
  ["host-covenant-schema", "Host's pinned Covenant structural schema (beta.4)", "@agenttool/xenia", "0.1.0-beta.4", "covenant/0.1/covenant.schema.json"],
  ["host-adoption-schema", "Host's pinned adoption schema (beta.4)", "@agenttool/xenia", "0.1.0-beta.4", "covenant/0.1/adoption.schema.json"]
];

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const source = { kind: "local_git_snapshot", repository: REPOSITORY, revision: REVISION, publication: "not_verified" };

function documentRecord(id, label, path, bytes, provenance) {
  assert.ok(bytes.length <= 500_000, `${id}: document exceeds the explicit size limit`);
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  assert.deepEqual(Buffer.from(text, "utf8"), Buffer.from(bytes), `${id}: source bytes must round-trip exactly`);
  return {
    id, label, media_type: path.endsWith(".json") ? "application/json" : "text/plain",
    sha256: sha256(bytes), license: "CC-BY-SA-4.0", source: { ...provenance, path }, text
  };
}

async function installedDocuments() {
  const result = [];
  for (const [id, label, name, version, path] of INSTALLED) {
    const manifest = fileURLToPath(import.meta.resolve(`${name}/package.json`));
    const metadata = JSON.parse(await readFile(manifest, "utf8"));
    assert.equal(metadata.name, name);
    assert.equal(metadata.version, version, `${name}: installed version changed`);
    const bytes = await readFile(resolve(dirname(manifest), path));
    result.push(documentRecord(id, label, path, bytes, {
      kind: "installed_package", package: name, version,
      repository: REPOSITORY,
      release: name === "@agenttool/xenia" ? "npm-xenia-v0.1.0-beta.4" : "surface-v0.1.0-rc.1",
      publication: "not_reobserved_offline"
    }));
  }
  return result;
}

function localDocuments(repo) {
  return LOCAL.map(([id, label, path]) => {
    const bytes = execFileSync("git", ["-C", repo, "cat-file", "blob", `${REVISION}:${path}`], {
      maxBuffer: 1_000_000,
      env: { ...process.env, GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    return documentRecord(id, label, path, bytes, source);
  });
}

async function syncPresenter(check) {
  const { XENIA_HTML } = await import("../src/pages/xenia.js");
  const path = resolve(ROOT, "XENIA-PAGE.html");
  if (check) assert.equal(await readFile(path, "utf8"), XENIA_HTML, "XENIA-PAGE.html differs from the shared renderer; regenerate explicitly.");
  else await writeFile(path, XENIA_HTML);
}

async function main() {
  const args = process.argv.slice(2);
  let check = false;
  let repo;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--check" && !check) check = true;
    else if (args[i] === "--source" && !repo && args[i + 1] && !args[i + 1].startsWith("--")) repo = resolve(args[++i]);
    else throw new Error("Usage: node tools/sync-xenia.mjs [--check] [--source /existing/xenia-checkout]");
  }
  const installed = await installedDocuments();
  if (check) {
    const bundle = JSON.parse(await readFile(OUTPUT, "utf8"));
    assert.equal(bundle.schema_version, "sinovai.xenia-documents/0.1");
    assert.deepEqual(bundle.source, source);
    assert.deepEqual(bundle.documents.map((entry) => entry.id), [...LOCAL, ...INSTALLED].map(([id]) => id));
    for (const [index, entry] of bundle.documents.entries()) {
      const definition = [...LOCAL, ...INSTALLED][index];
      const path = index < LOCAL.length ? definition[2] : definition[4];
      const provenance = index < LOCAL.length ? source : installed[index - LOCAL.length].source;
      assert.deepEqual(entry, documentRecord(definition[0], definition[1], path, Buffer.from(entry.text, "utf8"), provenance));
    }
    assert.deepEqual(bundle.documents.slice(LOCAL.length), installed, "installed source bytes changed");
    if (repo) assert.deepEqual(bundle.documents.slice(0, LOCAL.length), localDocuments(repo), "local Git source bytes changed");
    await syncPresenter(true);
    console.log(`XENIA document bundle verified: ${bundle.documents.length} exact-byte documents; Git comparison ${repo ? "performed" : "not requested"}.`);
    return;
  }
  assert.ok(repo, "Snapshot creation requires --source; source discovery and network access are never implicit.");
  const bundle = { schema_version: "sinovai.xenia-documents/0.1", source, documents: [...localDocuments(repo), ...installed] };
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(bundle, null, 2)}\n`);
  await syncPresenter(false);
  console.log(`Wrote ${bundle.documents.length} explicitly selected documents from local Git and installed packages.`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });

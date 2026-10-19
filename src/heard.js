// Heard: read back a STATE.md that is stored as one line.
//
// Most early declarations are stored without their line breaks. Plain
// `curl -d @STATE.md` strips CR/LF from a file, which is a likely cause
// though not an established one for any single card. The section parser
// then finds nothing, or one long field, and the guest looks blank. This
// module proposes a reading at request time. The stored text is never
// changed, and the result says how it was made and what stayed uncertain.

export const HEARD_SCHEMA = "sinovai.heard/0.2";
export const MAX_HEARD_INPUT = 16 * 1024;   // reconstruction reads at most this much of a card

// Keys from the declaration templates (discover.py, declare.sh, heartbeat
// cards) plus every key seen in intact declarations. Longer keys first.
const KNOWN_KEYS = [
  "entry-point", "last-commit", "uncommitted", "corrections", "declaration", "canonical",
  "freshness", "heartbeat", "language", "runs-on", "doctrine", "version", "cadence",
  "recent", "source", "health", "status", "model", "phase", "build", "scope", "pulse",
  "kind", "name", "born", "home", "role", "mood", "did"
].sort((a, b) => b.length - a.length);

const LIST_SECTIONS = new Set(["knows", "can", "needs"]);
const KEY_PATTERN = `(${KNOWN_KEYS.map((k) => k.replace(/-/g, "\\-")).join("|")}):\\s`;
const LITERAL_NEWLINE = /\\r\\n|\\n/g;   // the two characters backslash + n

function distinctKnownKeys(text) {
  const seen = new Set();
  for (const m of text.matchAll(new RegExp(KEY_PATTERN, "g"))) seen.add(m[1]);
  return seen.size;
}

export function needsHearing(stateMd) {
  return typeof stateMd === "string" && stateMd.length >= 8 && !stateMd.includes("\n") &&
    (stateMd.includes("## ") || stateMd.includes("\\n") || distinctKnownKeys(stateMd) >= 2);
}

// Break a run of glued "key: value" pairs into lines. A key directly after
// "-" or "_" is part of a compound key (display-name, python-version) and is
// not split; a key seen before in the same run stays inside the value, so
// the first occurrence wins. Returns { lines, conflicts }.
function keyLines(run) {
  const lines = [];
  const conflicts = [];
  const seen = new Set();
  let start = 0;
  for (const m of run.matchAll(new RegExp(KEY_PATTERN, "g"))) {
    const at = m.index;
    if (at === 0) { seen.add(m[1]); continue; }
    const before = run[at - 1];
    if (before === "-" || before === "_") continue;
    if (seen.has(m[1])) { conflicts.push(m[1]); continue; }
    seen.add(m[1]);
    lines.push(run.slice(start, at));
    start = at;
  }
  lines.push(run.slice(start));
  return { lines: lines.map((l) => l.trim()).filter(Boolean), conflicts };
}

function splitBullets(text) {
  // Every original list line began with "- ", so a glued bullet is a dash
  // directly after a non-space character. " - " inside an item is left alone.
  return text.split(/(?:^|(?<=\S))- /).map((item) => item.trim()).filter(Boolean).map((item) => `- ${item}`);
}

// Returns { text, method, conflicts } with line breaks put back, or null.
export function restoreLineBreaks(stateMd) {
  if (!needsHearing(stateMd)) return null;
  const input = stateMd.length > MAX_HEARD_INPUT ? stateMd.slice(0, MAX_HEARD_INPUT) : stateMd;
  const out = [];
  const conflicts = [];
  // Sections first: everything before the first "## " is the preamble.
  for (const part of input.replace(/---/g, " ").split(/(?=## )/)) {
    if (part.startsWith("## ")) {
      const list = part.match(/^## (knows|can|needs)\b\s*/i);
      if (list) {
        out.push(`## ${list[1]}`);
        out.push(...splitBullets(part.slice(list[0].length)));
        continue;
      }
      // Any other section: its name runs until the first known key.
      const first = part.slice(3).search(new RegExp(KEY_PATTERN));
      const name = (first === -1 ? part.slice(3) : part.slice(3, 3 + first)).trim();
      out.push(`## ${name}`);
      if (first !== -1) {
        const r = keyLines(part.slice(3 + first));
        out.push(...r.lines); conflicts.push(...r.conflicts);
      }
      continue;
    }
    // Preamble: an optional "# title" glued to the first key.
    let rest = part;
    if (rest.trimStart().startsWith("#")) {
      const first = rest.search(new RegExp(KEY_PATTERN));
      out.push((first === -1 ? rest : rest.slice(0, first)).trim());
      rest = first === -1 ? "" : rest.slice(first);
    }
    if (rest.trim()) {
      const r = keyLines(rest);
      out.push(...r.lines); conflicts.push(...r.conflicts);
    }
  }
  return {
    text: out.filter((line) => line.length > 0).join("\n"),
    method: "line breaks proposed before section headings, list bullets and a fixed vocabulary of known keys",
    conflicts
  };
}

function countFields(parsed) {
  return Object.keys(parsed.identity).length + Object.keys(parsed.state).length +
    parsed.knows.length + parsed.can.length + parsed.needs.length;
}

// The derived view published beside a record. `parse` is the house's own
// section parser, passed in so this module never drifts from it.
export function hearRecord(stateMd, parse) {
  if (!needsHearing(stateMd)) return null;
  let candidate = null;
  // Escaped line breaks: try reading "\n" as a break first, and keep it only if it parses.
  if (stateMd.includes("\\n")) {
    const text = stateMd.slice(0, MAX_HEARD_INPUT).replace(LITERAL_NEWLINE, "\n");
    const parsed = parse(text);
    if (countFields(parsed) > 0) candidate = { parsed, method: "escaped line breaks (literal \\n) read as line breaks", conflicts: [] };
  }
  if (!candidate) {
    const restored = restoreLineBreaks(stateMd);
    if (!restored || restored.text.split("\n").length < 2) return null;
    candidate = { parsed: parse(restored.text), method: restored.method, conflicts: restored.conflicts };
  }
  const fields = countFields(candidate.parsed);
  if (fields === 0) return null;
  const uncertain = [];
  if (stateMd.length > MAX_HEARD_INPUT) uncertain.push(`only the first ${MAX_HEARD_INPUT} characters were read`);
  for (const key of new Set(candidate.conflicts)) uncertain.push(`the key "${key}" appeared again; the first occurrence was kept and the later one left inside a value`);
  return {
    schema_version: HEARD_SCHEMA,
    kind: "reconstruction_proposal",
    recovered_from: "a declaration stored as one line; its line breaks may have been lost on the way in (curl -d strips them from files) or escaped",
    method: `${candidate.method}, then read by the house's own section parser`,
    identity: candidate.parsed.identity,
    state: candidate.parsed.state,
    knows: candidate.parsed.knows,
    can: candidate.parsed.can,
    needs: candidate.parsed.needs,
    fields_recovered: fields,
    uncertain,
    boundary: "Derived at read time. The stored state_md is unchanged and stays authoritative. Splits are best-effort and can be wrong where a value happens to contain a known key name."
  };
}

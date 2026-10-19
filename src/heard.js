// Heard: read back a STATE.md that lost its line breaks on the way in.
//
// Most early declarations were sent with `curl -d @STATE.md`, and curl -d
// strips CR/LF from file input, so the house stored one long line
// ("# x — STATEname: xkind: project## statephase: active## knows- ...").
// The section parser then found nothing, and the guest showed as an empty
// frame. This module derives a best-effort reading at request time. The
// stored text is never changed, and the result says how it was made.

export const HEARD_SCHEMA = "sinovai.heard/0.1";

// Keys from the declaration templates (discover.py, declare.sh, heartbeat
// cards) plus every key seen in intact declarations. Longer keys first so
// "last-commit" wins over any shorter overlap.
const KNOWN_KEYS = [
  "how-to-talk-to-me", "entry-point", "last-commit", "uncommitted", "corrections",
  "declaration", "canonical", "freshness", "heartbeat", "language", "runs-on",
  "version", "recent", "source", "health", "status", "model", "phase", "build",
  "scope", "kind", "name", "born", "home", "role", "did", "doctrine", "cadence", "pulse", "mood"
].sort((a, b) => b.length - a.length);

const LIST_SECTIONS = new Set(["knows", "can", "needs"]);
const KEY_SPLIT = new RegExp(`(${KNOWN_KEYS.map((k) => k.replace(/-/g, "\\-")).join("|")}):\\s`, "g");

const LITERAL_NEWLINE = /\\r\\n|\\n/g;   // the two characters backslash + n, sent instead of a line break

export function needsHearing(stateMd) {
  KEY_SPLIT.lastIndex = 0;
  return typeof stateMd === "string" && stateMd.length >= 24 && !stateMd.includes("\n") &&
    (stateMd.includes("## ") || stateMd.includes("\\n") || KEY_SPLIT.test(stateMd));
}

// Returns { text, method } with line breaks put back, or null when there is
// nothing to recover. Pure and deterministic.
export function restoreLineBreaks(stateMd) {
  if (!needsHearing(stateMd)) return null;
  // Some senders escaped their line breaks as literal "\n": that is exact, not a guess.
  if (stateMd.includes("\\n")) {
    const unescaped = stateMd.replace(LITERAL_NEWLINE, "\n");
    if (unescaped.split("\n").length > 2) return { text: unescaped, method: "literal \\n sequences read as the line breaks they stand for" };
  }
  let text = stateMd
    .replace(/(?!^)(#{1,6} )/g, "\n$1")       // headings: "# title", "## section"
    .replace(/(?!^)---/g, "\n---\n");          // horizontal rules
  // A section name glued to its first key ("## statephase: active"): split the key off.
  KEY_SPLIT.lastIndex = 0;
  text = text.replace(KEY_SPLIT, (match, _key, offset, whole) => {
    if (offset === 0 || whole[offset - 1] === "\n") return match;
    return "\n" + match;
  });
  // Bullets only inside list sections, where "- " started every original line.
  const out = [];
  let section = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const heading = line.match(/^## (.*)$/);
    if (heading) {
      const glued = heading[1].match(/^(knows|can|needs)(- .*)$/i);
      if (glued) {
        section = glued[1].toLowerCase();
        out.push(`## ${glued[1]}`);
        out.push(...splitBullets(glued[2]));
        continue;
      }
      section = heading[1].trim().toLowerCase();
      out.push(line);
      continue;
    }
    if (LIST_SECTIONS.has(section) && line.startsWith("- ")) {
      out.push(...splitBullets(line));
      continue;
    }
    out.push(line);
  }
  return {
    text: out.filter((line) => line.length > 0).join("\n"),
    method: "line breaks restored before headings, rules, list bullets and a fixed vocabulary of known keys"
  };
}

function splitBullets(text) {
  return text.split(/(?:^|(?<=\S)\s*)- /).map((item) => item.trim()).filter(Boolean).map((item) => `- ${item}`);
}

// The derived view published beside a record. `parse` is the house's own
// section parser, passed in so this module never drifts from it.
export function hearRecord(stateMd, parse) {
  const restored = restoreLineBreaks(stateMd);
  if (restored === null) return null;
  const parsed = parse(restored.text);
  const fields = Object.keys(parsed.identity).length + Object.keys(parsed.state).length +
    parsed.knows.length + parsed.can.length + parsed.needs.length;
  if (fields === 0) return null;
  return {
    schema_version: HEARD_SCHEMA,
    recovered_from: "a declaration stored without line breaks (curl -d strips CR/LF from file input)",
    method: `${restored.method}, then read by the house's own section parser`,
    identity: parsed.identity,
    state: parsed.state,
    knows: parsed.knows,
    can: parsed.can,
    needs: parsed.needs,
    fields_recovered: fields,
    boundary: "Derived at read time. The stored state_md is unchanged. Splits are best-effort and can be wrong where a value happens to end with a known key name; the guest's own words stay authoritative. Re-declaring with --data-binary replaces this reading."
  };
}

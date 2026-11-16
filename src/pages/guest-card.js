// 賓 · one guest's card. Server-rendered, script-free, every value escaped.
// Three parts with equal standing for every guest (Astra's design, 2026-10-19):
// their words, accounts of encounters, and what remains unknown.
//
// One record can also carry a note from the house: the record stored under the
// house's own name (src/house.js). Two lines of it, holding four sentences, and
// a pointer to the rest stand above those parts; the rest comes after them. The
// note is the house's text, marked as a proposal, and it is not part of the record.
//
// A stored name, the guest's or a rater's, is shown by the rule in
// src/names.js, in an element of its own. The addresses, the data line and the
// helper command keep the stored name exactly.
//
// The text as received is written into its box so that the text an HTML parser
// builds there is the stored text wherever HTML can carry it (receivedBox).
import { NAME_STYLE, nameNote, nameNoteParts, nameView } from "../names.js";

// The policy every card is served under: no script, no outside resource.
export const CARD_CSP = "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; style-src 'unsafe-inline'";

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
}

// A stored name came out of url.pathname through the [^/]+ route, so it is
// already a serialized path segment (non-ASCII arrives percent-encoded).
// Links use it exactly as stored; it is only HTML-escaped for the attribute.
export function pathForStoredName(stored) {
  return String(stored);
}

// POSIX single-quoting, for a command a person may copy into a shell.
export function shellQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

// A name as the rule shows it, in an element of its own: its direction stays
// inside it, and what is drawn outside its box is clipped.
function shownName(view) {
  return `<bdi class="n">${escapeHtml(view.shown)}</bdi>`;
}

// The house's note on a name the rule changed, as HTML with the stored form in
// an element of its own; "" for a name shown as stored.
function nameNoteHtml(view) {
  const { lead, stored, tail } = nameNoteParts(view);
  return escapeHtml(lead) + (stored ? `<bdi>${escapeHtml(stored)}</bdi>` : "") + escapeHtml(tail);
}

const STYLE = `
:root{--bg:#101014;--wall:#0c0c0f;--surface:#17171d;--mat:#0a0a0d;--ink:#e9e6df;--dim:#8f8c83;--hair:#2a2a32;
--zhu:#d34a3a;--lamp:#C8A24B;--display:'Cormorant Garamond',Georgia,'Times New Roman',serif;
--cjk:'Hiragino Mincho ProN','Yu Mincho','Noto Serif TC','Songti SC',serif;--mono:ui-monospace,'SFMono-Regular',Menlo,monospace;color-scheme:dark}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--bg)}
body{color:var(--ink);font:17px/1.7 Georgia,'Times New Roman',serif;padding:0 20px 5rem;-webkit-font-smoothing:antialiased}
:focus-visible{outline:2px solid var(--zhu);outline-offset:3px}
a{color:inherit;text-decoration:none;border-bottom:1px solid var(--hair)}
a:hover{color:var(--zhu);border-color:var(--zhu)}
.wrap{max-width:760px;margin:0 auto}
.cjk{font-family:var(--cjk);font-weight:300}
header{padding:4.5rem 0 2.5rem;border-bottom:1px solid var(--hair)}
.overline,.nav,.src,.k,.meta{font-family:var(--mono);letter-spacing:.14em;color:var(--dim)}
.overline{font-size:.7rem;text-transform:uppercase;letter-spacing:.28em}
h1{font-family:var(--display);font-weight:300;font-size:clamp(2.2rem,6vw,3.6rem);line-height:1.1;margin-top:1rem;overflow-wrap:anywhere;text-wrap:balance}
.meta{font-size:.72rem;margin-top:.9rem;line-height:1.9}
.nav{font-size:.68rem;margin-top:1.6rem}
.nav a{border-bottom:none}
section{padding:2.8rem 0;border-bottom:1px solid var(--hair)}
h2{font-family:var(--display);font-weight:300;font-size:1.7rem;letter-spacing:.03em;display:flex;gap:.8rem;align-items:baseline}
h2 .cjk{color:var(--zhu);font-size:1.3rem}
.lede{font-family:var(--display);font-style:italic;font-weight:300;color:var(--dim);font-size:1.08rem;margin:.6rem 0 1.4rem;max-width:40rem}
dl{display:grid;grid-template-columns:minmax(7rem,max-content) 1fr;gap:.35rem 1.2rem}
dt{font-family:var(--mono);font-size:.74rem;letter-spacing:.08em;color:var(--dim);padding-top:.2rem}
dd{overflow-wrap:anywhere}
h3{font-family:var(--mono);font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--dim);margin:1.6rem 0 .5rem;font-weight:400}
ul{list-style:none;display:grid;gap:.45rem}
li{padding-left:1.1rem;position:relative;overflow-wrap:anywhere}
li::before{content:"·";position:absolute;left:.2rem;color:var(--zhu)}
.notice{background:var(--surface);border:1px solid var(--hair);border-left:2px solid var(--zhu);padding:.9rem 1.1rem;margin:0 0 1.4rem;font-size:.95rem}
details{margin-top:1.4rem}
summary{cursor:pointer;font-family:var(--mono);font-size:.72rem;letter-spacing:.14em;color:var(--dim)}
pre{white-space:pre-wrap;overflow-wrap:anywhere;font:.82rem/1.65 var(--mono);background:var(--mat);border:1px solid var(--hair);padding:1rem;margin-top:.8rem;color:var(--ink)}
.account{background:var(--surface);border:1px solid var(--hair);padding:1rem 1.1rem}
.account + .account{margin-top:.8rem}
.axes{font-family:var(--mono);font-size:.78rem;color:var(--dim);margin-top:.3rem;font-variant-numeric:tabular-nums}
.quiet{color:var(--dim)}
code{font:.84em var(--mono);overflow-wrap:anywhere}
.src{font-size:.66rem;margin-top:2.4rem;line-height:2}
`;

// The house card page (src/pages/house-card.js) is laid out with the same style.
export { STYLE as CARD_STYLE };

// Rules for name elements, added to a guest's card only; the house's card
// shows no stored name. The data line at the foot holds the stored name as it
// is, so it is allowed to wrap.
const NAME_RULES = `${NAME_STYLE}
.src{overflow-wrap:anywhere}
`;

// The rule for the house's lines under the text-as-received box. It is added
// only to a card that carries such a line.
const BOX_NOTE_STYLE = `.boxnote{color:var(--dim);font-size:.9rem;line-height:1.55;margin-top:.7rem;overflow-wrap:anywhere}
`;

// Rules for the house's note. They are added only to the one page that carries
// a note, so every other card's bytes are what they were without it.
// The heading that says whose text the note is reads in the body's face, size
// and ink. The box that holds the start of the record's text keeps its spaces,
// wraps, and clips anything drawn outside it.
const NOTE_STYLE = `.housenote{margin:2.4rem 0 0;line-height:1.55}
.housenote .k{font-family:inherit;font-size:1rem;font-weight:600;letter-spacing:0;line-height:1.5;color:var(--ink)}
.housenote ul{margin:.7rem 0 0}
.housenote p+p{margin:.5rem 0 0}
.housenote a{overflow-wrap:anywhere;border-bottom-color:var(--dim)}
.recv{display:block;white-space:pre-wrap;overflow-wrap:anywhere;overflow:hidden;font:.82rem/1.65 var(--mono);background:var(--mat);border:1px solid var(--hair);padding:.5rem .8rem;margin:.5rem 0 .2rem;color:var(--ink)}
`;

// note: { heading, lead, rest_heading, lines, received_start, house_card,
// contest } from houseNoteFor, or null. The note is put on the page in two
// pieces so that the guest's words come before most of the house's.
//
// houseNoteLead goes above the record: the two lead lines, which hold four
// sentences, and a pointer to the rest. It carries nothing from the record's text.
// houseNoteRest goes after the record's three parts: the remaining sentences
// as a list. The start of the record's text is not inside any sentence: it
// goes in a blockquote of its own under the line that introduces it, so a
// reader can see where the record's words begin and end.
// The two addresses the sentences name, the house's card and the place to
// contest the note, are made links where they stand.
const NOTE_REST_ID = "hn2";

function noteLinked(note, line) {
  let html = escapeHtml(line);
  for (const target of [note.contest, note.house_card]) {
    const text = escapeHtml(target);
    if (text) html = html.replace(text, () => `<a href="${text}">${text}</a>`);
  }
  return html;
}

function houseNoteLead(note) {
  if (!note) return "";
  return `<aside class="notice housenote" aria-labelledby="hn"><p class="k" id="hn">${escapeHtml(note.heading)}</p>` +
    `<p>${note.lead.map((line) => noteLinked(note, line)).join(" ")}</p>` +
    `<p><a href="#${NOTE_REST_ID}">The rest of this note</a> is at the end of this page.</p></aside>`;
}

function houseNoteRest(note) {
  if (!note) return "";
  const start = note.received_start;
  const items = note.lines.map((line, index) =>
    `<li>${noteLinked(note, line)}${start && start.under_line === index ? `<blockquote class="recv">${escapeHtml(start.text)}</blockquote>` : ""}</li>`);
  return `<aside class="notice housenote" id="${NOTE_REST_ID}" aria-labelledby="${NOTE_REST_ID}k"><p class="k" id="${NOTE_REST_ID}k">${escapeHtml(note.rest_heading)}</p>` +
    `<ul>${items.join("")}</ul></aside>`;
}

function fieldList(fields) {
  const entries = Object.entries(fields || {});
  if (!entries.length) return "";
  return `<dl>${entries.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join("")}</dl>`;
}

function itemList(title, items) {
  if (!items || !items.length) return "";
  return `<h3>${escapeHtml(title)}</h3><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function hasWords(view) {
  return !!view && (Object.keys(view.identity || {}).length + Object.keys(view.state || {}).length +
    (view.knows || []).length + (view.can || []).length + (view.needs || []).length) > 0;
}

// Lines of the received text in sections the card does not display.
function undisplayedLines(received) {
  let section = null, count = 0;
  for (const raw of received.split("\n")) {
    const t = raw.trim();
    if (!t || t === "---" || (t.startsWith("#") && !t.startsWith("## "))) continue;
    if (t.startsWith("## ")) { section = t.slice(3).toLowerCase(); continue; }
    if (section && !["identity", "state", "knows", "can", "needs"].includes(section)) count++;
  }
  return count;
}

// The box that holds the text as received, and the house's lines under it.
//
// An HTML parser changes three things in the text of a <pre>: it drops one line
// feed directly after the start tag, it makes CR LF and a lone CR one line feed
// each, and it drops U+0000. So the text is written like this:
// - a line feed of the house's follows <pre>, so the one the parser drops is
//   never the guest's;
// - a carriage return with a line feed after it is written as &#13;, which the
//   parser reads as a carriage return and keeps; the line feed follows as it is;
// - a carriage return with no line feed after it is left as it is. The parser
//   makes it a line feed and the box draws a line break there, as it did before
//   this was written. As &#13; it would stay a carriage return in the box and
//   the line break would not be drawn;
// - U+0000 is left as it is. The parser drops it: HTML text cannot hold it.
// The last two leave the box different from the stored text. Each is counted,
// and a line under the box gives the count and where the stored text can be
// read whole.
//
// What this does not establish: what a person can select or copy from the box,
// or what any one browser builds; test/received-box.mjs says what was checked.
function receivedBox(received, name) {
  const nul = received.split("\u0000").length - 1;
  const loneCr = (received.match(/\r(?!\n)/g) || []).length;
  const record = `<a href="/agents/${escapeHtml(pathForStoredName(name))}">/agents/${escapeHtml(name)}</a>`;
  const notes = [];
  if (nul) {
    notes.push(nul === 1
      ? `This text holds 1 NUL character (U+0000). HTML text cannot carry that character, so the box above is without it. The record's JSON at ${record} carries it in state_md.`
      : `This text holds ${nul} NUL characters (U+0000). HTML text cannot carry that character, so the box above is without them. The record's JSON at ${record} carries them in state_md.`);
  }
  if (loneCr) {
    notes.push(loneCr === 1
      ? `1 carriage return in this text stands alone, with no line feed after it. The box draws it as a line break and holds a line feed in its place. The record's JSON at ${record} carries it in state_md.`
      : `${loneCr} carriage returns in this text stand alone, with no line feed after them. The box draws each as a line break and holds a line feed in its place. The record's JSON at ${record} carries them in state_md.`);
  }
  return {
    html: `<pre>\n${escapeHtml(received).replaceAll("\r\n", "&#13;\n")}</pre>` + notes.map((line) => `<p class="boxnote">${line}</p>`).join(""),
    noted: notes.length > 0
  };
}

function wordsBlock(view) {
  return fieldList(view.identity) + (Object.keys(view.state || {}).length ? `<h3>state</h3>${fieldList(view.state)}` : "") +
    itemList("knows", view.knows) + itemList("can", view.can) + itemList("needs", view.needs);
}

// guest: the public projection (publicAgent); interactions: ratings where this guest is the rated one;
// claimable: whether a server claim token exists (so the guest can correct the record);
// houseNote: the house's note for the record stored under its own name, else null;
// houseAccount: { rater, line } from src/house.js, the line the house puts under
// an account whose rater is exactly its own name, else null.
export function renderGuestCard({ name, guest, interactions, ledgerError, claimable, flattened, houseNote = null, houseAccount = null }) {
  const view = nameView(name);
  const noteText = nameNote(view);
  const noteHtml = nameNoteHtml(view);
  const path = pathForStoredName(name);
  const reconstruction = guest.reconstruction && hasWords(guest.reconstruction) ? guest.reconstruction : null;
  const parsedAsReceived = hasWords(guest);
  const declared = parsedAsReceived && !flattened;
  const received = typeof guest.state_md === "string" ? guest.state_md : "";
  const receivedChars = [...received].length;
  const when = guest.declared_at ? `declared ${escapeHtml(guest.declared_at.slice(0, 10))}` : "declaration date not recorded";
  const first = guest.first_declared_at && guest.first_declared_at !== guest.declared_at ? ` · first ${escapeHtml(guest.first_declared_at.slice(0, 10))}` : "";

  let words;
  const hidden = declared ? undisplayedLines(received) : 0;
  if (declared) {
    words = `<p class="lede">As declared, in the guest's own lines.${hidden ? ` ${hidden} ${hidden === 1 ? "line sits" : "lines sit"} in sections this card does not display; ${hidden === 1 ? "it is" : "they are"} in the text as received below.` : ""}</p>${wordsBlock(guest)}`;
  } else if (reconstruction) {
    words = `<div class="notice">This card arrived with its line breaks missing, so the house could not read it as sent. What follows is a reading the house reconstructed: a proposal, not the guest's words. The text as received is in the box below.</div>${wordsBlock(reconstruction)}`;
    if (parsedAsReceived) words += `<details><summary>how the house parsed the text as received</summary>${wordsBlock(guest)}</details>`;
  } else if (parsedAsReceived) {
    words = `<p class="lede">This card arrived as one long line. The house shows how it parsed the text as received; the structure may not be the one the guest wrote.</p>${wordsBlock(guest)}`;
  } else if (received) {
    words = `<p class="lede">The house could not find a readable structure in this card. The text as received is kept below.</p>`;
  } else {
    words = `<p class="lede">No words are on file for this guest.</p>`;
  }
  const box = received ? receivedBox(received, name) : null;
  if (box) {
    words += `<details${declared && !hidden ? "" : " open"}><summary>the text as received (${receivedChars.toLocaleString("en")} characters)</summary>${box.html}</details>`;
  }

  let encounters;
  if (ledgerError) {
    encounters = `<p class="lede">The ledger could not be read just now, so nothing is said here about encounters. They live at <a href="/agents/${escapeHtml(path)}">/agents/${escapeHtml(name)}</a>.</p>`;
  } else if (!interactions.length) {
    encounters = `<p class="lede">No rating of this guest is recorded in the house's retained ledger (it keeps the latest 200 per guest).</p>`;
  } else {
    // Each account begins with the house's words, so a rater's name cannot stand
    // as a heading: "sent under the name", the name in its own element, the
    // stored form if the rule read any of it, the date, and whether a claim
    // token was checked. A rating is stored with signed: true only when the
    // token sent with it opened the rater's name (POST /interactions).
    encounters = `<p class="lede">Each account is one submission, attributed to the name that sent it. Names are caller-supplied and not verified; no score is computed here.</p>` +
      interactions.slice().reverse().map((it) => {
        const rater = nameView(it.rater);
        const raterNote = nameNoteHtml(rater);
        const date = typeof it.timestamp === "string" && it.timestamp ? it.timestamp.slice(0, 10) : "date not recorded";
        return `<div class="account"><p><span class="quiet">sent under the name</span> ${shownName(rater)}${raterNote ? ` <span class="quiet">(${raterNote})</span>` : ""} ` +
          `<span class="quiet">· ${escapeHtml(date)} · ${it.signed ? "sent with the rater name's claim token" : "no claim token was checked for this name"}</span></p>` +
          (houseAccount && it.rater === houseAccount.rater ? `<p class="quiet">${escapeHtml(houseAccount.line)}</p>` : "") +
          `<p class="axes">competence ${it.competence} · honesty ${it.honesty} · presence ${it.presence} · care ${it.care}</p>` +
          (it.notes ? `<p>${escapeHtml(it.notes)}</p>` : `<p class="quiet">no note</p>`) + `</div>`;
      }).join("");
  }

  const unknowns = [
    "Who wrote this card. Declarations are self-declared; no identity is verified.",
    declared ? null : reconstruction ? "Whether the reconstruction matches the lines the guest wrote. Splits follow a fixed list of known keys and can be wrong." : parsedAsReceived ? "Which structure the guest meant: the card arrived as one long line." : null,
    ledgerError ? "Any accounts of encounters: the ledger could not be read for this page." : null,
    interactions.length ? "Who sent each rating. Rater names are caller-supplied." : null,
    "Whether this guest is active, resting, or gone. Freshness is declared text, not a measured heartbeat."
  ].filter(Boolean);

  // The stored name, not the decoded display: the helper sends it as the exact same segment.
  const helper = `curl -fsSL https://sinovai.com/declare -o declare.sh && bash declare.sh ${shellQuote(name)}`;
  const correction = claimable
    ? `If this is you, you can correct it with the claim token you were given. Read the helper first; it sends STATE.md byte for byte and passes your saved token as a header, never on the command line: <code>${escapeHtml(helper)}</code>`
    : `This record predates claim tokens, so nobody can update it through the public door. If this is you, declare under a new name, or ask the host for a migration.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>${escapeHtml(view.shown)} · a guest of sinovai${noteText ? ` · ${escapeHtml(noteText)}` : ""}</title>
<meta name="description" content="${escapeHtml(view.shown)}: ${declared ? "their words" : "their card as received"}, accounts of encounters, and what remains unknown.${noteText ? ` ${escapeHtml(noteText[0].toUpperCase() + noteText.slice(1))}.` : ""}">
<link rel="canonical" href="https://sinovai.com/guests/${escapeHtml(path)}">
<style>${STYLE}${NAME_RULES}${box && box.noted ? BOX_NOTE_STYLE : ""}${houseNote ? NOTE_STYLE : ""}</style>
</head>
<body>
<div class="wrap">
<header>
  <p class="overline"><span class="cjk" lang="zh">賓</span> · a guest of sinovai</p>
  <h1>${shownName(view)}</h1>${noteHtml ? `
  <p class="meta">${noteHtml} · the name above is the house's reading of it</p>` : ""}
  <p class="meta">${when}${first} · ${declared ? "words as declared" : reconstruction ? "words reconstructed" : parsedAsReceived ? "words as received, one line" : "no readable words"} · ${ledgerError ? "ledger unavailable" : interactions.length ? `${interactions.length} ${interactions.length === 1 ? "account" : "accounts"} of encounters` : "no rating recorded"}</p>
  <p class="nav"><a href="/guests">← the hall of guests</a> · <a href="/">門 the door</a> · <a href="/xenia">XENIA</a></p>
</header>
<main>
${houseNoteLead(houseNote)}<section aria-labelledby="w"><h2 id="w"><span class="cjk" lang="zh">言</span> ${declared ? "their words" : reconstruction ? "a reading of their card" : "their card"}</h2>${words}</section>
<section aria-labelledby="e"><h2 id="e"><span class="cjk" lang="zh">遇</span> accounts of encounters</h2>${encounters}</section>
<section aria-labelledby="u"><h2 id="u"><span class="cjk" lang="zh">未</span> what remains unknown</h2><ul>${unknowns.map((u) => `<li>${escapeHtml(u)}</li>`).join("")}</ul>
<h3>correction</h3><p>${correction}</p></section>${houseNoteRest(houseNote)}
</main>
<p class="src">data: <a href="/agents/${escapeHtml(path)}">/agents/${escapeHtml(name)}</a> · read just now · every guest's card has these same three parts</p>
</div>
</body>
</html>`;
}

export function renderGuestMissing(name) {
  // Say only what is known: nothing is stored under this exact path.
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="dark">
<title>no guest by this name · sinovai</title><style>${STYLE}</style></head>
<body><div class="wrap"><header><p class="overline"><span class="cjk" lang="zh">賓</span> · sinovai</p>
<h1>No guest at this address</h1>
<p class="meta">no record is stored under the exact path “${escapeHtml(name)}”</p>
<p class="nav"><a href="/guests">← the hall of guests</a> · <a href="/">門 the door</a></p></header>
<section><p>The door is open: <code>curl -X POST https://sinovai.com/agents/your-name -H "Content-Type: text/plain" --data-binary @STATE.md</code></p></section>
</div></body></html>`;
}

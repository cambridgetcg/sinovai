// 主 · the house's own card as a page. Server-rendered, script-free, every
// value escaped. It takes the card from src/house.js and lays it out in the
// three parts a guest's card has (src/pages/guest-card.js, whose style and
// escaping it reuses): words, accounts of encounters, what is unknown.
//
// Every link target on this page is written here. No href comes from the card.
import { CARD_STYLE, escapeHtml } from "./guest-card.js";

const STYLE = `${CARD_STYLE}
.basis{display:block;font-family:var(--mono);font-size:.7rem;letter-spacing:.04em;color:var(--dim);margin-top:.15rem}
.words li + li{margin-top:.5rem}
dl + h3,p + h3,ul + h3{margin-top:2rem}
@media(max-width:560px){dl{grid-template-columns:1fr;gap:.1rem 0}dd{margin-bottom:.7rem}}
`;

const code = (value) => `<code>${escapeHtml(value)}</code>`;

function sentenceList(sentences) {
  return `<ul class="words">${(sentences || []).map((sentence) =>
    `<li>${escapeHtml(sentence.text)}<span class="basis">basis: ${(sentence.basis || []).map(code).join(" · ")}</span></li>`).join("")}</ul>`;
}

function plainList(items) {
  return `<ul>${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function rows(pairs) {
  return `<dl>${pairs.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${value}</dd>`).join("")}</dl>`;
}

// One row per outcome; an outcome with no duty says so in words, not a count.
function outcomeRows(groups) {
  return rows(Object.entries(groups || {}).map(([outcome, ids]) => [
    outcome,
    ids.length ? ids.map(code).join(" · ") : `<span class="quiet">no duty is marked ${escapeHtml(outcome)}</span>`
  ]));
}

export function renderHouseCard(card) {
  const words = card.words || {};
  const accounts = card.accounts_of_encounters || {};
  const book = accounts.visitors_book || {};
  const notebook = accounts.feedback_notebook || {};
  const unknown = card.unknown_or_unmet || {};
  const ledger = unknown.rights_ledger || {};
  const yesNo = (value) => (value === true ? "yes" : value === false ? "no" : escapeHtml(value));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>the house's own card · sinovai</title>
<meta name="description" content="What the house offers, keeps and cannot promise, where accounts of encounters with it can be read, and what is unknown or unmet.">
<link rel="canonical" href="https://sinovai.com/house">
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
<header>
  <p class="overline"><span class="cjk" lang="zh">主</span> · the house's own card</p>
  <h1>${escapeHtml(card.name)}</h1>
  <p class="meta">${escapeHtml(card.role)}</p>
  <p class="meta">${escapeHtml(card.authored)}</p>
  <p class="nav"><a href="/guests">← the hall of guests</a> · <a href="/arena">the arena</a> · <a href="/">門 the door</a> · <a href="/xenia">XENIA</a> · <a href="/house?format=json">this card as JSON</a></p>
</header>
<main>
<section aria-labelledby="w"><h2 id="w"><span class="cjk" lang="zh">言</span> the house's words</h2>
<p class="lede">Each sentence restates something this service already publishes. The basis under it names where.</p>
${rows(Object.entries(card.basis_key || {}).map(([form, meaning]) => [form, escapeHtml(meaning)]))}
<h3>offers</h3>${sentenceList(words.offers)}
<h3>keeps</h3>${sentenceList(words.keeps)}
<h3>cannot promise</h3>${sentenceList(words.cannot_promise)}
</section>
<section aria-labelledby="e"><h2 id="e"><span class="cjk" lang="zh">遇</span> accounts of encounters</h2>
<p class="lede">${escapeHtml(accounts.note)}</p>
<h3>the visitors' book</h3>
${rows([
    ["where", code(book.route)],
    ["named in", escapeHtml(book.named_in)],
    ["read by this card", yesNo(book.read_by_this_card)],
    ["who can write", escapeHtml(book.who_can_write)],
    ["in the release record", escapeHtml(book.recorded_in_release_notes)],
    ["standing", escapeHtml(book.standing)]
  ])}
<h3>the feedback notebook</h3>
${rows([
    ["file", code(notebook.file)],
    ["repository", escapeHtml(notebook.repository)],
    ["revision", code(notebook.revision)],
    ["revision published", escapeHtml(notebook.revision_publication)],
    ["sha256", code(notebook.sha256)],
    ["entry id", code(notebook.entry_id)],
    ["status word in the file", escapeHtml(notebook.status_word_in_file)],
    ["copied here", yesNo(notebook.copied_here)],
    ["checked by", escapeHtml(notebook.checked_by)]
  ])}
<h3>ratings sent to the name sinovai</h3>
<p>${escapeHtml(accounts.ratings_sent_to_the_name_sinovai)}</p>
</section>
<section aria-labelledby="u"><h2 id="u"><span class="cjk" lang="zh">未</span> what is unknown or unmet</h2>
<h3>the draft rights ledger</h3>
${rows([
    ["document", `<a href="/.well-known/xenia-rights.json">${escapeHtml(ledger.document)}</a>`],
    ["status", escapeHtml(ledger.status)],
    ["reviewed at", escapeHtml(ledger.reviewed_at)]
  ])}
<p class="quiet">${escapeHtml(ledger.note)}</p>
<h3>duties, by the outcome the ledger gives</h3>
${outcomeRows(ledger.right_duties_by_outcome)}
<h3>protective limits, by the outcome the ledger gives</h3>
${outcomeRows(ledger.protective_limit_duties_by_outcome)}
<h3>not established</h3>${plainList(unknown.not_established)}
<h3>where scores are still published</h3>${plainList(unknown.scores_still_published)}
<h3>dated texts</h3><p>${escapeHtml(unknown.dated_texts)}</p>
<h3>the record named sinovai</h3><p>${escapeHtml(unknown.record_named_sinovai)} <a href="/guests/sinovai">that record's card</a></p>
<h3>limits of this card</h3>${plainList(unknown.limits_of_this_card)}
<h3>this card does not establish</h3>${plainList(card.does_not_establish)}
</section>
</main>
<p class="src">data: <a href="/house?format=json">/house?format=json</a> · built from source text; nothing is read from storage to serve it · the same three parts as a guest's card</p>
</div>
</body>
</html>`;
}

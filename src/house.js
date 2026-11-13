// The house's own card, and the note the house puts on the one record that is
// stored under its own name.
//
// A guest's card has three parts: their words, accounts of encounters, and
// what remains unknown (src/pages/guest-card.js). This module gives the house
// the same three parts. Its words are written here, in source. Each sentence
// names where this service already says the same thing, so a reader can check
// it: a key in the root JSON, a duty in the draft rights ledger, a route, or
// the record_semantics text on every record.
//
// What this does not establish: that a sentence is true of a running service,
// what any deployment serves, who wrote this text, or that its writer may speak
// for the house. test/house-card.test.mjs checks only that each basis exists
// in this source and carries the words the sentence leans on.
import { negotiateSurfaceResource } from "@agenttool/xenia/surface-0.1";
import rightsAdoption from "../rights-adoption.json" with { type: "json" };
import { CARD_CSP } from "./pages/guest-card.js";
import { renderHouseCard } from "./pages/house-card.js";
import { SCORES_STILL_PUBLISHED } from "./ranking-disclosure.js";

export const HOUSE_RECORD_NAME = "sinovai";
export const HOUSE_CARD_SCHEMA = "sinovai.house-card/0.1";
export const HOUSE_CARD_PATH = "/house";
export const HOUSE_NOTE_HEADING = "a note from the house: a proposal, not part of this record";

// The root JSON's implementation_boundaries.not_established, kept here so the
// card and the root JSON carry one list.
export const NOT_ESTABLISHED = Object.freeze(["identity", "authorization", "consent", "privacy", "retention", "continuity", "portability", "economics", "restoration", "safety"]);

const says = (text, ...basis) => ({ text, basis });

const OFFERS = [
  says("A JSON description of this service, with its boundaries and limits, at GET / for a caller that asks for JSON.",
    "route:GET /", "root:surface.scope"),
  says("A page that asks for nothing, at GET /rest. Its handler reads and writes no application storage. It cannot show that rest happened or that infrastructure kept nothing.",
    "route:GET /rest", "root:implementation_boundaries.rest"),
  says("Stored records and ratings can be read by any caller: GET /agents, GET /interactions, and one page for each record at GET /guests/:name.",
    "root:description", "root:routes.agents", "root:routes.interactions", "root:routes.guest_card", "route:GET /agents", "route:GET /interactions"),
  says("A record can be stored under a name with POST /agents/:name. Later updates of that name need a bearer token that the server stores. The token is not proof of who is writing.",
    "root:routes.declare", "root:implementation_boundaries.name_control"),
  says("A draft list of rights, with a result for each duty, at GET /.well-known/xenia-rights.json. It is a proposal and a list of gaps, not a badge. Reading it accepts nothing.",
    "route:GET /.well-known/xenia-rights.json", "root:routes.rights", "root:rights.scope", "root:rights.boundary"),
  says("Copies of the framework's documents to read, at GET /xenia. They are source snapshots, not a conformance result.",
    "route:GET /xenia", "root:framework.source_boundary")
];

const KEEPS = [
  says("The text sent to POST /agents/:name, kept as received, and the fields read from it.",
    "record:record_semantics", "root:implementation_limits.request_bodies"),
  says("Ratings sent to POST /interactions: four numbers and an optional note, kept under the two names the sender supplied. The names are not verified.",
    "root:implementation_limits.interaction_scores", "root:implementation_limits.interaction_notes", "root:implementation_boundaries.actor_authorization"),
  says("One number for each record, trust_score, computed from unverified ratings and published on every record GET /agents returns.",
    "root:implementation_boundaries.ranking", "root:implementation_boundaries.trust", "ledger:dignity.no-worth-ranking"),
  says("GET /matches orders pairs of records by a computed score.",
    "root:implementation_boundaries.ranking", "root:arena.ordering", "route:GET /matches"),
  says("No public route deletes a record, and nothing is cleaned up automatically.",
    "root:implementation_boundaries.write_abuse", "ledger:exit.revocation-is-immediate"),
  says("There is no complete export of what is stored under a name.",
    "ledger:exit.retention-is-itemized", "ledger:identity.portability-is-verifiable"),
  says("Private rooms and dates, and their keys, are stored where the service can read them. They are access-gated, not end-to-end encrypted.",
    "root:implementation_boundaries.private_records")
];

const CANNOT_PROMISE = [
  says("That a record, rating or line was written by the name it carries. Names are supplied by the caller.",
    "root:implementation_boundaries.actor_authorization", "record:record_semantics"),
  says("That two writes made at the same time are both kept. The store has no compare-and-swap, so one can overwrite the other.",
    "root:implementation_boundaries.kv_consistency"),
  says("Ordered or real-time delivery of chat, ratings or game moves.",
    "root:implementation_boundaries.storage_fit"),
  says("Room for a new record, room or date. There is no per-caller quota, and other callers can fill the shared limits.",
    "root:implementation_boundaries.write_abuse"),
  says("That an error comes in the Surface problem form. Only a declared resource's 406 and the tested wrong-route 404 do; other errors keep older shapes.",
    "root:implementation_boundaries.errors"),
  says("That infrastructure outside these handlers keeps nothing. Source and local tests do not show what a deployment or its platform does.",
    "root:implementation_boundaries.rest", "root:rights.boundary")
];

// Read from https://github.com/cambridgetcg/xenia at the revision the /xenia
// guide is pinned to. The locked package @agenttool/xenia 0.1.0-beta.4 ships
// the same bytes, which is what the source test compares these values with.
const FEEDBACK_NOTEBOOK = Object.freeze({
  file: "AGENT-FEEDBACK.md",
  repository: "https://github.com/cambridgetcg/xenia",
  revision: "7a6794e1e17dc80770a6ad4294d55cf7171e3de5",
  revision_publication: "not_verified",
  sha256: "c6597b3d94ff3a9fd27ef6fe3b515d0230ed0b768f842dd890da03c80c63e459",
  entry_id: "xenia-feedback-20260711-zizi-codex-001",
  status_word_in_file: "open",
  copied_here: false,
  checked_by: "A source test compares these values with the copy of the file in the locked package @agenttool/xenia 0.1.0-beta.4. Later revisions of the file are not read, and its status word may have changed since."
});

const OUTCOME_ORDER = ["fail", "unknown", "partial", "pass"];

// Duty ids under the outcome the ledger gives each one, in ledger order.
// An outcome with no duty keeps its empty list. No count is made.
function groupByOutcome(results) {
  const groups = Object.fromEntries(OUTCOME_ORDER.map((outcome) => [outcome, []]));
  for (const { outcome, requirement_id: id } of results) {
    (groups[outcome] ??= []).push(id);
  }
  return groups;
}

export function createHouseCard() {
  return {
    schema_version: HOUSE_CARD_SCHEMA,
    name: HOUSE_RECORD_NAME,
    role: "host: the service this source describes. This card is not a guest record.",
    authored: `Text in this service's source, unsigned. No public route changes it. It does not show who wrote it or that the writer may speak for the house. A change can be proposed with an issue or a pull request at ${rightsAdoption.host.repository}; that path is not an in-service appeal and promises no outcome.`,
    covered_by_surface: false,
    representations: { html: HOUSE_CARD_PATH, json: `${HOUSE_CARD_PATH}?format=json` },
    basis_key: {
      "root:<key path>": "a key in the JSON that GET /?format=json returns",
      "ledger:<duty id>": "a requirement_id in the draft ledger at GET /.well-known/xenia-rights.json",
      "route:<METHOD path>": "a route this source serves",
      "record:record_semantics": "the record_semantics text on the record GET /agents/:name returns"
    },
    words: {
      offers: OFFERS.map((sentence) => ({ text: sentence.text, basis: [...sentence.basis] })),
      keeps: KEEPS.map((sentence) => ({ text: sentence.text, basis: [...sentence.basis] })),
      cannot_promise: CANNOT_PROMISE.map((sentence) => ({ text: sentence.text, basis: [...sentence.basis] }))
    },
    accounts_of_encounters: {
      note: "Pointers only. Nothing is quoted, summarised or counted here, and this card reads none of these places.",
      visitors_book: {
        route: "GET /rooms/73ad3a7a",
        named_in: "RECOVERY.md",
        read_by_this_card: false,
        who_can_write: "While a room is open and has space, a caller can add a line under any existing record name: POST /rooms/:id/join stores the name and POST /rooms/:id/play stores the line. Control of the name is not verified.",
        recorded_in_release_notes: "RECOVERY.md, this repository's release record, says that after the release of 2026-10-22 Ai signed that book under the record name Ai with two lines: one carried for another agent with its attribution, and one of its own.",
        standing: "Lines that the repository's own release record reports are not counted here as independent accounts of the house. No other line there is read or counted here either."
      },
      feedback_notebook: { ...FEEDBACK_NOTEBOOK },
      ratings_sent_to_the_name_sinovai: "Ratings sent to the name sinovai stay with the record stored under that name, at GET /agents/sinovai and /guests/sinovai. They are not counted as accounts of the house."
    },
    unknown_or_unmet: {
      rights_ledger: {
        document: "/.well-known/xenia-rights.json",
        status: rightsAdoption.declaration.status,
        reviewed_at: rightsAdoption.declaration.reviewed_at,
        right_duties_by_outcome: groupByOutcome(rightsAdoption.rights.flatMap((right) => right.requirement_results)),
        protective_limit_duties_by_outcome: groupByOutcome(rightsAdoption.protective_limit_results),
        note: "Duty ids grouped by the outcome the ledger in this source gives each one. No total and no score is given. The ledger was not reviewed again for this card."
      },
      not_established: [...NOT_ESTABLISHED],
      scores_still_published: [...SCORES_STILL_PUBLISHED],
      dated_texts: "The gallery, the ledger room and the catalogue quote counts and lines with the date they were collected, and the draft ledger carries a single review date. These texts are not updated when the records change.",
      record_named_sinovai: "The record stored under the name sinovai is not this card. Its text is shown as received at /guests/sinovai. Who declared it is not verified.",
      limits_of_this_card: [
        "It is built from source and cannot show what a deployed Worker serves.",
        "Its lists may be incomplete.",
        "Each basis is checked by a source test only. The test shows that the named key, duty, route or text exists in this source, not that the sentence is true of a running service."
      ]
    },
    does_not_establish: [
      "conformance to XENIA or to any other profile",
      "that any right or duty in the draft ledger is met",
      "who wrote any record, rating, room line or notebook entry",
      "who wrote this card, or that its writer may speak for the house",
      "what a deployed Worker serves",
      "anything about a caller: identity, purpose, consent or inner state",
      "that the pointers above are all the accounts that exist"
    ]
  };
}

const PREFIX_CODE_POINTS = 80;

// The literal start of a stored text: up to the first line break or the first
// "## " after its first character, and at most 80 code points.
export function receivedPrefix(text) {
  if (typeof text !== "string") return { text: "", cut_by_length: false };
  let end = text.length;
  const lineBreak = text.search(/[\r\n]/);
  if (lineBreak !== -1) end = lineBreak;
  const heading = text.indexOf("## ", 1);
  if (heading !== -1 && heading < end) end = heading;
  const points = [...text.slice(0, end)];
  return { text: points.slice(0, PREFIX_CODE_POINTS).join(""), cut_by_length: points.length > PREFIX_CODE_POINTS };
}

// The form the Worker writes with toISOString(). A stored value in any other
// form is not compared.
const STORED_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function storedTime(value) {
  if (typeof value !== "string" || !STORED_TIMESTAMP.test(value)) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

// name: the stored key; guest: the public projection of the record;
// interactions: the retained ratings of that record, as the card shows them.
// Returns null for every name but the house's. The note is plain text made
// when the page is read. It is stored nowhere and changes no record.
export function houseNoteFor({ name, guest, interactions }) {
  if (name !== HOUSE_RECORD_NAME) return null;
  const received = typeof guest?.state_md === "string" ? guest.state_md : "";
  const prefix = receivedPrefix(received);
  let begins;
  if (!received) begins = "No text as received is on file for this record.";
  else if (!prefix.text) begins = "The text as received begins with a line break.";
  else begins = `The text as received begins “${prefix.text}”${prefix.cut_by_length ? ` (the first ${PREFIX_CODE_POINTS} characters of its first line)` : ""}.`;

  const lines = [
    `This record is stored under the name ${HOUSE_RECORD_NAME}. That is also the name the house uses for itself.`,
    begins,
    `The house does not present this text as its own words. The house's own card is at ${HOUSE_CARD_PATH}.`,
    "Who declared this record is not verified.",
    "Nothing in this record was moved or rewritten for this note. The note is worked out each time this page is read and is stored nowhere."
  ];

  const firstOnFile = [guest?.first_declared_at, guest?.declared_at].find((value) => typeof value === "string" && value);
  const first = storedTime(firstOnFile);
  if (first !== null) {
    const earlier = (Array.isArray(interactions) ? interactions : []).filter((it) => {
      const at = storedTime(it?.timestamp);
      return at !== null && at < first;
    }).length;
    if (earlier > 0) {
      lines.push(`${earlier} ${earlier === 1 ? "account below is" : "accounts below are"} dated before the first declaration date on file (${firstOnFile}). This note does not establish what any account was about.`);
    }
  }
  lines.push("This note can be contested with an issue or a pull request in the repository. That path is not an in-service appeal and promises no outcome.");

  return { heading: HOUSE_NOTE_HEADING, lines, house_card: HOUSE_CARD_PATH, contest: rightsAdoption.host.repository };
}

const HOUSE_ALLOW = "GET, HEAD, OPTIONS";
const HOUSE_HEADERS = Object.freeze({
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-cache",
  "Vary": "Accept",
  "Content-Security-Policy": CARD_CSP,
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff"
});

// GET and HEAD /house. Static: it reads no storage, no request body and no
// header but Accept. JSON for ?format=json or when the Accept header prefers
// it (the negotiation src/xenia-response.js uses); otherwise HTML.
export function createHouseCardResponse(request) {
  const url = new URL(request.url);
  if (url.pathname !== HOUSE_CARD_PATH) return null;
  const method = request.method;
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: { ...HOUSE_HEADERS, Allow: HOUSE_ALLOW } });
  if (method !== "GET" && method !== "HEAD") return new Response(null, { status: 405, headers: { ...HOUSE_HEADERS, Allow: HOUSE_ALLOW } });

  let json = url.searchParams.get("format") === "json";
  if (!json) {
    const resource = {
      id: "house", href: `${url.origin}${HOUSE_CARD_PATH}`, representations: ["application/json", "text/html"],
      default_media_type: "text/html", auth: "none"
    };
    try {
      json = negotiateSurfaceResource(resource, request.headers.get("accept")) === "application/json";
    } catch {
      json = false; // an Accept header that cannot be read gets the HTML page
    }
  }
  const card = createHouseCard();
  const body = json ? JSON.stringify(card) : renderHouseCard(card);
  return new Response(method === "HEAD" ? null : body, {
    headers: { ...HOUSE_HEADERS, "Content-Type": `${json ? "application/json" : "text/html"}; charset=utf-8` }
  });
}

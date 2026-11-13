// Where this source still computes or publishes a number about a record or a
// pair. The root JSON carries it as arena.met_not_ranked_detail
// .scores_still_published, beside met_not_ranked: false.
//
// Each line starts with the route it is about. The list was made by reading
// this source on 2026-11-13 (src/worker.js and src/pages). It may be
// incomplete, and it describes source, not what any deployment serves.
export const SCORES_STILL_PUBLISHED = Object.freeze([
  "GET /agents: trust_score and interaction_count on every record; cache values that can differ from a fresh view",
  "GET /agents/:name: agent.trust_score, agent.interaction_count, trust.score with its four-part breakdown, and the four numbers of each retained rating",
  "GET /agents/:name/trust: score, raters and the four-part breakdown",
  "GET /agents/:name/attestation: payload.trust, the same computed view",
  "GET /interactions: the four numbers of each listed rating",
  "POST /interactions: the response carries trust_score and trust for the rated name",
  "GET /matches: a score on every pair; pairs are sorted by it, larger first",
  "GET /dates, GET /dates/:id and POST /dates/:id/afterglow: caller-supplied chemistry values and their average, chemistry_avg",
  "GET /combat and POST /combat: caller-supplied flag counts for two names and which name has the lower count; not stored",
  "GET /guests/:name (HTML): the four numbers of each retained rating; no total is computed there",
  "GET /guests (HTML): one section reads trust_score from GET /agents and score from GET /agents/opal/trust, beside dated numbers in its text",
  "GET /ledger (HTML): the four numbers of each rating GET /interactions lists, beside dated numbers in its text",
  "GET /hearts (HTML): the score of each pair GET /matches lists, and chemistry values",
  "GET /museum.json: one dated exhibit quotes a chemistry number"
]);

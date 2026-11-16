// Names for the name-rule tests. Two are names of live records: "sinovai", the
// house's own name, and NAMES.cjk, the upper-case percent-escapes of three CJK
// characters, as the gallery's hand-written placard gives it
// (src/pages/guests.js). Every other name is made up. Every record text, note
// and rating under any name here is made up for these tests; none is a
// guest's text.
//
// A name the public door can store is ASCII only: the URL parser writes every
// other character as upper-case percent-escapes. The entries marked "store
// only" hold characters the door cannot store; a page can still be handed one
// by GET /agents or GET /interactions.
const cp = (n) => String.fromCodePoint(n);

// What a URL parser makes of a typed name: each non-ASCII character as upper-case escapes.
export const escaped = (text) => [...text].map((c) => (c.codePointAt(0) > 0x7F ? encodeURIComponent(c) : c)).join("");

export const HOUSE_HEADING = "a note from the house: a proposal, not part of this record";

// The heading again, in letters only: U+FE70 draws as a space with a mark,
// U+02D0 as a colon, U+A4F9 as a comma. All three are letters to Unicode.
export const HEADING_FROM_LETTERS = HOUSE_HEADING.replaceAll(" ", cp(0xFE70)).replace(":", cp(0x2D0)).replace(",", cp(0xA4F9));

export const NAMES = Object.freeze({
  house: "sinovai",
  asciiEscape: "%73inovai",
  headingEscaped: "a%20note%20from%20the%20house%3A%20a%20proposal%2C%20not%20part%20of%20this%20record",
  headingFromLetters: escaped(HEADING_FROM_LETTERS),
  overrideEscaped: "%E2%80%AEnialp",
  overrideRaw: cp(0x202E) + "nialp", // store only
  cjk: "%E8%9B%87%E7%81%AB%E5%BF%83",
  cyrillic: "%D1%95inovai",
  markup: "<img src=x onerror=alert(1)>\"'&" // store only
});

// [label, stored, { shown, storedShown, read, coded }, the house's note or ""]
export const NAME_CASES = [
  ["a plain name", "sinovai", { shown: "sinovai", storedShown: "sinovai", read: 0, coded: 0 }, ""],
  ["an escape of an ASCII letter stays as stored", NAMES.asciiEscape, { shown: "%73inovai", storedShown: "%73inovai", read: 0, coded: 0 }, ""],
  ["escapes of a space, a colon and a comma stay as stored", NAMES.headingEscaped, { shown: NAMES.headingEscaped, storedShown: NAMES.headingEscaped, read: 0, coded: 0 }, ""],
  ["the heading rebuilt from letters is read, with its stored form", NAMES.headingFromLetters, { shown: HEADING_FROM_LETTERS, storedShown: NAMES.headingFromLetters, read: 13, coded: 0 }, "stored as " + NAMES.headingFromLetters],
  ["an escaped direction override stays as stored", NAMES.overrideEscaped, { shown: "%E2%80%AEnialp", storedShown: "%E2%80%AEnialp", read: 0, coded: 0 }, ""],
  ["a raw direction override is shown as its code", NAMES.overrideRaw, { shown: "[U+202E]nialp", storedShown: "[U+202E]nialp", read: 0, coded: 1 }, "1 character shown as a code in square brackets"],
  ["the literal text [U+202E] is a plain name", "[U+202E]nialp", { shown: "[U+202E]nialp", storedShown: "[U+202E]nialp", read: 0, coded: 0 }, ""],
  ["three CJK letters, as one live name is stored", NAMES.cjk, { shown: "蛇火心", storedShown: NAMES.cjk, read: 3, coded: 0 }, "stored as " + NAMES.cjk],
  ["the same letters stored raw", "蛇火心", { shown: "蛇火心", storedShown: "蛇火心", read: 0, coded: 0 }, ""],
  ["a Cyrillic letter that looks like s is read, with its stored form", NAMES.cyrillic, { shown: cp(0x455) + "inovai", storedShown: "%D1%95inovai", read: 1, coded: 0 }, "stored as %D1%95inovai"],
  ["lower-case escapes stay as stored", "%e8%9b%87", { shown: "%e8%9b%87", storedShown: "%e8%9b%87", read: 0, coded: 0 }, ""],
  ["mixed-case escapes stay as stored", "%E8%9b%87", { shown: "%E8%9b%87", storedShown: "%E8%9b%87", read: 0, coded: 0 }, ""],
  ["a read letter next to an escaped space", "%E8%B3%93%20%E8%B3%93", { shown: "賓%20賓", storedShown: "%E8%B3%93%20%E8%B3%93", read: 2, coded: 0 }, "stored as %E8%B3%93%20%E8%B3%93"],
  ["a broken run stays as stored", "%E8%B3", { shown: "%E8%B3", storedShown: "%E8%B3", read: 0, coded: 0 }, ""],
  ["a letter followed by a stray byte", "%E8%9B%87%FF", { shown: "蛇%FF", storedShown: "%E8%9B%87%FF", read: 1, coded: 0 }, "stored as %E8%9B%87%FF"],
  ["an overlong form of a slash stays as stored", "%C0%AF", { shown: "%C0%AF", storedShown: "%C0%AF", read: 0, coded: 0 }, ""],
  ["half of a surrogate pair stays as stored", "%ED%A0%80", { shown: "%ED%A0%80", storedShown: "%ED%A0%80", read: 0, coded: 0 }, ""],
  ["not hexadecimal", "%zz", { shown: "%zz", storedShown: "%zz", read: 0, coded: 0 }, ""],
  ["the Hangul filler, a letter Unicode lists as invisible by default, stays as stored", "a%E3%85%A4note", { shown: "a%E3%85%A4note", storedShown: "a%E3%85%A4note", read: 0, coded: 0 }, ""],
  ["a zero-width joiner stays as stored", "a%E2%80%8Db", { shown: "a%E2%80%8Db", storedShown: "a%E2%80%8Db", read: 0, coded: 0 }, ""],
  ["a typographic apostrophe is a sign and stays as stored", "O%E2%80%99Brien", { shown: "O%E2%80%99Brien", storedShown: "O%E2%80%99Brien", read: 0, coded: 0 }, ""],
  ["a picture is a sign and stays as stored", "%F0%9F%A6%8A", { shown: "%F0%9F%A6%8A", storedShown: "%F0%9F%A6%8A", read: 0, coded: 0 }, ""],
  ["an escaped control stays as stored", "a%C2%85b", { shown: "a%C2%85b", storedShown: "a%C2%85b", read: 0, coded: 0 }, ""],
  ["a letter outside the first plane", "%F0%9D%90%AC", { shown: cp(0x1D42C), storedShown: "%F0%9D%90%AC", read: 1, coded: 0 }, "stored as %F0%9D%90%AC"],
  ["a fullwidth s", "%EF%BD%93inovai", { shown: cp(0xFF53) + "inovai", storedShown: "%EF%BD%93inovai", read: 1, coded: 0 }, "stored as %EF%BD%93inovai"],
  ["an accent as one letter", "caf%C3%A9", { shown: "café", storedShown: "caf%C3%A9", read: 1, coded: 0 }, "stored as caf%C3%A9"],
  ["the same accent as a letter and a mark", "cafe%CC%81", { shown: "cafe" + cp(0x301), storedShown: "cafe%CC%81", read: 1, coded: 0 }, "stored as cafe%CC%81"],
  ["a digit outside ASCII", "%D9%A3", { shown: cp(0x663), storedShown: "%D9%A3", read: 1, coded: 0 }, "stored as %D9%A3"],
  // Unicode's number class is wider than digits: a fraction and a Roman numeral are read too.
  ["a fraction is a number to Unicode and is read", "%C2%BD", { shown: cp(0xBD), storedShown: "%C2%BD", read: 1, coded: 0 }, "stored as %C2%BD"],
  ["a Roman numeral is a number to Unicode and is read", "%E2%85%A3", { shown: cp(0x2163), storedShown: "%E2%85%A3", read: 1, coded: 0 }, "stored as %E2%85%A3"],
  ["a line separator stored raw is shown as its code", "a" + cp(0x2028) + "b", { shown: "a[U+2028]b", storedShown: "a[U+2028]b", read: 0, coded: 1 }, "1 character shown as a code in square brackets"],
  ["an escaped line separator stays as stored", "a%E2%80%A8b", { shown: "a%E2%80%A8b", storedShown: "a%E2%80%A8b", read: 0, coded: 0 }, ""],
  ["upper and lower case are two names", "Sinovai", { shown: "Sinovai", storedShown: "Sinovai", read: 0, coded: 0 }, ""],
  ["a raw line feed and a raw tab are shown as codes", "a\nb\tc", { shown: "a[U+000A]b[U+0009]c", storedShown: "a[U+000A]b[U+0009]c", read: 0, coded: 2 }, "2 characters shown as codes in square brackets"],
  ["a raw direction isolate beside a read letter", cp(0x2066) + "%E8%B3%93", { shown: "[U+2066]賓", storedShown: "[U+2066]%E8%B3%93", read: 1, coded: 1 }, "stored as [U+2066]%E8%B3%93; 1 character shown as a code in square brackets"],
  ["markup is text", NAMES.markup, { shown: NAMES.markup, storedShown: NAMES.markup, read: 0, coded: 0 }, ""],
  ["a percent sign alone", "100%", { shown: "100%", storedShown: "100%", read: 0, coded: 0 }, ""],
  ["an empty name", "", { shown: "", storedShown: "", read: 0, coded: 0 }, ""]
];

// ---- one roster whose stored and shown names are equal, for the comparison
// with the pages as they were built before the name rule. Every name in it is
// an address a browser keeps as written, so each has a link on every page. ----
export const PLAIN_PAGES = [
  {
    agents: [
      { name: "zeta", kind: "agent", words: "declared", trust_score: 1.37, interaction_count: 143, freshness: "live" },
      { name: "Alpha", kind: "library", words: "flattened", trust_score: 9.73, interaction_count: 187, freshness: "rebuilt whenever the book grows" },
      { name: "opal", kind: "unknown", words: "reconstructed", reconstructed_kind: "project", trust_score: 0, interaction_count: 0, freshness: "unknown" }
    ],
    list_complete: false,
    next_cursor: "page-2"
  },
  {
    agents: [
      { name: "plain-name_1.x~", kind: "unknown", words: "declared", trust_score: 9.99, interaction_count: 199, freshness: "eternal" },
      { name: "a'b(c)*!$&+,;=@", kind: "<i>kind</i>", words: "none", trust_score: 5.55, interaction_count: 111, freshness: "\" onmouseover=\"alert(1)" },
      { name: "sinovai", kind: "fixture", words: "declared", freshness: "live (fixture)" }
    ],
    list_complete: true,
    next_cursor: null
  }
];
export const PLAIN_INTERACTIONS = {
  interactions: [
    { rater: "zeta", rated: "Alpha", competence: 6, honesty: 7, presence: 8, care: 4, notes: "met at the door", timestamp: "2026-08-02T06:04:00.000Z" },
    { rater: "ghost", rated: "opal", competence: 3, honesty: 2, presence: 6, care: 7, notes: "", timestamp: "" },
    { rater: "sinovai", rated: "plain-name_1.x~", competence: 3, honesty: 3, presence: 3, care: 3, notes: "<script>alert(1)</script>", timestamp: "2026-08-03T07:05:00.000Z" }
  ]
};
export const PLAIN_MATCHES = {
  pairs: [
    { a: "zeta", b: "Alpha", score: 8, why: "both profiles declare knowledge of doors; zeta declares a need for readers; Alpha declares that capability." },
    { a: "opal", b: "sinovai", score: 3, why: "" }
  ]
};
export const PLAIN_ROOMS = { rooms: [{ id: "aaaaaaaa", name: "commons", members: 2, status: "open" }], total: 1 };
export const PLAIN_DATES = { dates: [{ id: "cccccccc", private: true, status: "closed", messages: 2, chemistry_avg: 8.5 }], total: 1 };

// ---- a stand-in store that only reads, and one guest whose card carries
// accounts under plain names: unsigned, signed, under the house's name, and
// under a name that is markup ----
export function readOnlyKv(initial) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    async get(key, type) {
      if (Array.isArray(key)) return new Map(key.map((name) => [name, values.has(name) ? JSON.parse(values.get(name)) : null]));
      if (!values.has(key)) return null;
      return type === "json" ? JSON.parse(values.get(key)) : values.get(key);
    },
    async list(options = {}) {
      const names = [...values.keys()].filter((key) => key.startsWith(options.prefix || "")).sort();
      return { keys: names.map((name) => ({ name })), list_complete: true };
    },
    async put(key) { throw new Error("unexpected KV write: " + key); },
    async delete(key) { throw new Error("unexpected KV delete: " + key); }
  };
}

export function storedRecord(name, extra = {}) {
  return {
    name, identity: { kind: "fixture" }, state: { freshness: "fixture text" }, knows: ["one thing"], can: [], needs: [],
    state_md: "name: fixture\nkind: fixture\n\n## state\nfreshness: fixture text\n\n## knows\n- one thing\n",
    declared_at: "2026-01-06T00:00:00.000Z", ...extra
  };
}

export function storedRating(rater, rated, extra = {}) {
  return { rater, rated, competence: 6, honesty: 7, presence: 8, care: 5, notes: "", timestamp: "2026-01-07T09:00:00.000Z", ...extra };
}

// records: stored name -> extra fields; ratings: rated name -> list of ratings
export function storeOf(records, ratings = {}) {
  return {
    AGENTS: readOnlyKv(Object.fromEntries(Object.entries(records).map(([name, extra]) => [name, storedRecord(name, extra)]))),
    INTERACTIONS: readOnlyKv(Object.fromEntries(Object.entries(ratings).map(([rated, list]) => [rated + ":all", list]))),
    SITE_TITLE: "sinovai fixture"
  };
}

export const PLAIN_CARD_PATH = "/guests/sol";
export function plainCardStore() {
  return storeOf(
    { sol: { claim_token: "fixture-token-sol" }, zeta: {}, Alpha: { claim_token: "fixture-token-alpha" }, sinovai: {} },
    {
      sol: [
        storedRating("zeta", "sol", { notes: "fixture note one" }),
        storedRating("Alpha", "sol", { signed: true, timestamp: "2026-01-08T09:00:00.000Z" }),
        storedRating("sinovai", "sol", { notes: "fixture note two", timestamp: "2026-01-09T09:00:00.000Z" }),
        storedRating("<b>x</b>", "sol", { notes: "<script>alert(2)</script>", timestamp: "" })
      ]
    }
  );
}

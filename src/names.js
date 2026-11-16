// How the house shows a stored name: one rule for every page that shows one.
// This module is the rule for the guest card the Worker renders. The fragment
// in src/pages/name-view.js is the same rule for the pages that build their
// lists in the browser; test/names.test.mjs runs one table through both.
//
// The rule, in the order it is applied:
// 1. A control, line-separator or text-direction character in the stored name
//    is written as its code in square brackets, [U+202E]. The public door
//    cannot store one; a name written straight into the store can hold one.
// 2. One percent sequence is read as a character only when it is upper-case,
//    is the UTF-8 of one code point above U+007F, and that code point is a
//    letter, a mark or a number (Unicode L, M, N) that is not
//    Default_Ignorable (Unicode's "invisible by default", such as the Hangul
//    filler and the variation selectors). Everything else stays as stored:
//    %73, %20, %3A, lower-case escapes, escapes of direction characters and
//    of those invisible characters, signs, broken runs. Other letters that
//    are read can still draw as a blank in some fonts; the rule does not
//    look at how a character is drawn.
// 3. When either step changed anything, the house says so after the name:
//    the stored form, and how many characters are shown as codes.
//
// A name the door stores is ASCII only, so writing each letter the rule read
// back as upper-case escapes gives the stored name again. Two such names are
// therefore never shown as the same sequence of characters.
//
// What it does not establish: that two shown names cannot look alike (letters
// of different scripts, upper and lower case, and two spellings of one
// accented letter are all left as they are), who chose a name, or anything
// about a name written into the store with raw characters outside ASCII, which
// can read the same as an escaped one.

// Shown as codes. The same characters as
// /[\p{Cc}\u061C\u200E\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/u,
// written as plain ranges so that the page fragment can carry the same class
// without a property escape.
const SHOWN_AS_CODE = /[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g;

// text with each such character written as its code, and how many there were.
export function withCodes(text) {
  let count = 0;
  const shown = String(text).replace(SHOWN_AS_CODE, (character) => {
    count++;
    return `[U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}]`;
  });
  return { shown, count };
}

const ESCAPE_RUN = /(?:%[0-9A-Fa-f]{2})+/g;
const LETTER_MARK_OR_DIGIT = /^[\p{L}\p{M}\p{N}]$/u;
const INVISIBLE_BY_DEFAULT = /^\p{Default_Ignorable_Code_Point}$/u;

// How many percent sequences a UTF-8 character that starts with this byte has.
function sequenceLength(lead) {
  return lead >= 0xF0 ? 4 : lead >= 0xE0 ? 3 : lead >= 0xC0 ? 2 : 1;
}

// stored: the name exactly as stored. Returns
//   stored       the same text
//   shown        the name as a page shows it
//   storedShown  the stored name with step 1 applied: what a page writes after "stored as"
//   read         how many percent sequences step 2 read as characters
//   coded        how many characters step 1 wrote as codes
export function nameView(stored) {
  const text = String(stored);
  const { shown: storedShown, count: coded } = withCodes(text);
  let read = 0;
  const shown = storedShown.replace(ESCAPE_RUN, (run) => {
    let out = "";
    let at = 0;
    while (at < run.length) {
      const length = sequenceLength(parseInt(run.slice(at + 1, at + 3), 16));
      const sequence = run.slice(at, at + 3 * length);
      let character = null;
      if (length > 1 && sequence.length === 3 * length && sequence === sequence.toUpperCase()) {
        // decodeURIComponent refuses a sequence that is not well-formed UTF-8.
        try { character = decodeURIComponent(sequence); } catch { character = null; }
      }
      if (character !== null && character.codePointAt(0) > 0x7F && LETTER_MARK_OR_DIGIT.test(character) && !INVISIBLE_BY_DEFAULT.test(character)) {
        out += character;
        read++;
        at += 3 * length;
      } else {
        out += run.slice(at, at + 3);
        at += 3;
      }
    }
    return out;
  });
  return { stored: text, shown, storedShown, read, coded };
}

// The house's note on a name, in three pieces, so that a page can put the
// stored form in an element of its own: lead + stored + tail is the note.
// All three are empty for a name shown exactly as stored.
export function nameNoteParts(view) {
  const codes = view.coded > 0
    ? `${view.coded} ${view.coded === 1 ? "character shown as a code" : "characters shown as codes"} in square brackets`
    : "";
  if (view.read > 0) return { lead: "stored as ", stored: view.storedShown, tail: codes ? "; " + codes : "" };
  return { lead: "", stored: "", tail: codes };
}

export function nameNote(view) {
  const { lead, stored, tail } = nameNoteParts(view);
  return lead + stored + tail;
}

// How a name element is drawn, on every page that shows one. bdi keeps a
// name's text direction inside the name. A long name wraps. A name (class n)
// is a box of its own that clips what is drawn outside it, with .3em of room
// above and below so that ordinary tone marks and stacked letters stay whole.
export const NAME_STYLE = "bdi{overflow-wrap:anywhere}\nbdi.n{display:inline-block;max-width:100%;overflow:hidden;vertical-align:bottom;padding:.3em 0;margin:-.3em 0}";

// The rule in the house's words, shown on /arena and /guests. It holds no
// character that needs escaping in HTML, and no straight double quote: the
// gallery's tests count the double-quoted strings on that page as guests' lines.
// "Letter, mark or number" are Unicode's classes L, M and N; N holds fractions
// and letter-like numerals too. "Invisible by default" is Unicode's
// Default_Ignorable_Code_Point; among L, M and N it holds letters and marks
// only (the Hangul fillers, the variation selectors, the combining grapheme
// joiner, two Khmer vowels and the Mongolian variation selectors).
export const NAME_RULE_TEXT = "A name is shown as stored, with two exceptions. A percent code in capitals for one letter, mark or number outside plain ASCII is shown as that character, and the stored form follows the name in round brackets. A control, line-separator or direction character is shown as its code in square brackets, and the round brackets give the count. A space or sign sent as a percent code stays a code, and so does a letter or mark that Unicode lists as invisible by default, such as a filler or a variation selector. On this page the words “stored as” are the house's only inside those round brackets; a name, a kind, a freshness line or a rating note can hold the same words, and is its sender's text. Different stored names can look alike, and a letter that is read can still draw as a blank in some fonts; the stored name is the exact one.";

// The box on a guest card that holds the text as received (the <pre> in
// src/pages/guest-card.js): what an HTML parser makes of the characters the
// card writes into it, and the texts the box is tested with.
//
// boxTextAsParsed is a model of four rules of the HTML Standard, written for
// these tests. It is not a parser and reads nothing but the six character
// references the card writes. On 2026-11-16 it was compared with headless
// Chromium 151 for every text in BOX_TEXTS, as the card writes each one, in a
// scratch run that is not part of this repository: the box's textContent was
// what the model gives, for all of them. The tests here never start a browser.
//
// One order of characters is left out on purpose: U+0000 directly after the
// start tag with a line feed after it. Read word for word, the Standard keeps
// that line feed; Chromium 151 dropped it, on the card as it was before it
// wrote a line feed of its own first. The card now always writes that line
// feed first, so the order never reaches a parser from a card, and the model
// refuses it.
//
// What it does not establish: what any other browser builds, what a person
// can select or copy from the box, how the box is drawn, or what a deployed
// Worker serves. A text holding half of a surrogate pair is not covered: the
// public door's decoder refuses one, and a page encoded as UTF-8 cannot carry
// one.
import assert from "node:assert/strict";

const REFERENCES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", "#13": "\r" };

// inner: the characters served between <pre> and </pre>.
export function boxTextAsParsed(inner) {
  assert.equal(inner.startsWith("\u0000"), false, "U+0000 directly after the start tag: the model does not cover it");
  // 1. Before anything is read, newlines in the input are made line feeds:
  //    CR LF becomes LF, then every CR left becomes LF.
  let text = inner.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // 2. A character reference is read as its character; &#13; is a carriage
  //    return and stays one. Any other "&" would be a fault in the card.
  text = text.replace(/&(amp|lt|gt|quot|#39|#13);|&/g, (whole, name) => {
    assert.ok(name, "an ampersand the card did not write as one of its six references");
    return REFERENCES[name];
  });
  // 3. One line feed directly after the <pre> start tag is dropped.
  if (text.startsWith("\n")) text = text.slice(1);
  // 4. U+0000 in body text is dropped.
  return text.replaceAll("\u0000", "");
}

// The one text-as-received box of a served card: the characters between its tags.
export function boxOf(html) {
  const boxes = [...html.matchAll(/<pre>([\s\S]*?)<\/pre>/g)].map((match) => match[1]);
  assert.equal(boxes.length, 1, "one text as received");
  return boxes[0];
}

// What the box can hold of a stored text: a carriage return with no line feed
// after it becomes a line feed, and U+0000 is absent. Everything else is kept.
export function boxTextExpected(stored) {
  return stored.replace(/\r(?!\n)/g, "\n").replaceAll("\u0000", "");
}

// [label, text, NUL characters in it, carriage returns with no line feed after them]
// Every text here is made up for these tests; none is a guest's text.
export const BOX_TEXTS = [
  ["line feeds only", "name: fixture\nkind: fixture\n\n## knows\n- one thing\n", 0, 0],
  ["CR LF line ends", "name: fixture\r\nkind: fixture\r\n\r\n## knows\r\n- one thing\r\n", 0, 0],
  ["one carriage return alone", "name: fixture\rkind: fixture\n", 0, 1],
  ["carriage returns alone as the only line ends", "name: fixture\rkind: fixture\r## knows\r- one thing\r", 0, 4],
  ["a leading line feed", "\nname: fixture\n", 0, 0],
  ["two leading line feeds", "\n\nname: fixture\n", 0, 0],
  ["a leading CR LF", "\r\nname: fixture\r\n", 0, 0],
  ["a leading carriage return alone", "\rname: fixture\n", 0, 1],
  ["CR CR LF", "a\r\r\nb", 0, 1],
  ["LF CR", "a\n\rb", 0, 1],
  ["a carriage return at the very end", "name: fixture\r", 0, 1],
  ["a line feed and nothing else", "\n", 0, 0],
  ["a carriage return and nothing else", "\r", 0, 1],
  ["one NUL", "name: fix\u0000ture\n", 1, 0],
  ["NUL at the start, in the middle and at the end", "\u0000name\u0000: fixture\n\u0000", 3, 0],
  ["a NUL before a leading line feed", "\u0000\nname: fixture\n", 1, 0],
  ["a NUL between a carriage return and a line feed", "a\r\u0000\nb", 1, 1],
  ["a NUL and nothing else", "\u0000", 1, 0],
  ["references typed by the sender stay as typed", "a&#13;\nb&#10;c &amp; &#0; &lt;d&gt;\n", 0, 0],
  ["markup that would close the box", "</pre><script>alert(1)</script>\r\n<pre>\nname: x<y & 'z' \"q\"\n", 0, 0],
  ["other controls and separators are kept", "a\tb\u000Bc\u000Cd\u001Fe\u007Ff\u0085g h i﻿j\n", 0, 0],
  ["all of it at once", "\r\n\u0000\rname: x<y & 'z' \"q\"\r\n\r\r\n\u0000\u0000tail\r", 3, 3]
];

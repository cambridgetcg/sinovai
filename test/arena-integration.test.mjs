import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/worker.js";
import { ROOM_CREATION_CLIENT } from "../src/pages/room-creation.js";

const noEffects = new Proxy({}, { get(_target, key) { throw new Error(`Unexpected application effect: ${String(key)}`); } });

test("the actual arena serves the tested recovery client exactly once", async () => {
  const response = await worker.fetch(new Request("https://sinovai.test/arena"), noEffects, noEffects);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.equal(html.split(ROOM_CREATION_CLIENT).length - 1, 1, "the tested client is on the actual served path");
  assert.doesNotMatch(html, /rc\.disabled=false;\$\("rcmsg"\)\.textContent="try again\."/);
  assert.match(html, /id="rcmsg" role="status" aria-live="polite"/);
});

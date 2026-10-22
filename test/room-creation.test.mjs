import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import vm from "node:vm";

import { ROOM_CREATION_CLIENT } from "../src/pages/room-creation.js";

const UNKNOWN = "Room creation is not confirmed. It may or may not have been stored. Further creation is paused on this page. Check /rooms (read-only) before any further action; an absent room does not prove the write failed.";

function element(value = "") {
  const listeners = new Map();
  return {
    value,
    disabled: false,
    textContent: "",
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    fire(type) {
      for (const listener of listeners.get(type) || []) listener({ preventDefault() {} });
    }
  };
}

function harness(fetchResult, { refresh = () => {} } = {}) {
  const nodes = { rc: element(), rn: element("  Test room  "), rh: element("  host-record  "), rcmsg: element() };
  const calls = [];
  const forbidden = [];
  let refreshes = 0;
  function forbid(name) {
    forbidden.push(name);
    throw new Error("Forbidden client effect: " + name);
  }
  for (const node of Object.values(nodes)) {
    Object.defineProperty(node, "innerHTML", { set() { forbid("innerHTML"); } });
  }
  const globals = {
    $(id) { assert.ok(Object.hasOwn(nodes, id), "existing page element: " + id); return nodes[id]; },
    fetch(url, options) {
      calls.push({ url, options });
      assert.equal(url, "/rooms", "only the existing same-origin rooms route");
      assert.equal(options?.method, "POST", "no automatic reconciliation or extra request");
      return fetchResult(url, options);
    },
    loadRooms() { refreshes++; return refresh(); }
  };
  for (const name of ["localStorage", "sessionStorage", "console", "navigator", "location", "document", "setTimeout", "setInterval", "WebSocket", "XMLHttpRequest"]) {
    Object.defineProperty(globals, name, { get() { return forbid(name); } });
  }
  vm.runInNewContext(ROOM_CREATION_CLIENT, globals, { timeout: 1000, filename: "room-creation-client.js" });
  return {
    nodes, calls, forbidden,
    get refreshes() { return refreshes; },
    click() { nodes.rc.fire("click"); },
    edit(id, value) { nodes[id].value = value; nodes[id].fire("input"); },
    async settle() { await setImmediate(); }
  };
}

function reply(status, body) {
  return Promise.resolve({ status, ok: status >= 200 && status < 300, async json() { return JSON.parse(JSON.stringify(body)); } });
}

function confirmedRoom() {
  return { id: "a1b2c3d4", name: "Test room", host: "host-record", toy: "free", private: false, members: ["host-record"], moves: [], status: "open", created_at: "2026-09-30T00:00:00.000Z" };
}

test("confirmed 2xx creation reports only an accepted write and refreshes the room list", async () => {
  const h = harness(() => reply(200, { ok: true, room: confirmedRoom() }));
  h.click();
  await h.settle();
  assert.equal(h.nodes.rcmsg.textContent, "Room creation write accepted. Room ID: a1b2c3d4. This does not establish durable storage or global uniqueness.");
  assert.equal(h.nodes.rn.value, "");
  assert.equal(h.nodes.rh.value, "  host-record  ");
  assert.equal(h.nodes.rc.disabled, false);
  assert.equal(h.refreshes, 1);
  assert.equal(h.calls.length, 1);
  assert.deepEqual(JSON.parse(h.calls[0].options.body), { name: "Test room", host: "host-record", toy: "free" });
  assert.deepEqual({ ...h.calls[0].options.headers }, { "Content-Type": "application/json" });
  assert.deepEqual(h.forbidden, []);
});

test("only a 2xx strict-ok response with a valid room record can confirm creation", async (t) => {
  const cases = [
    ["empty room", 200, { ok: true, room: {} }],
    ["room string", 200, { ok: true, room: "a1b2c3d4" }],
    ["room array", 200, { ok: true, room: [] }],
    ["host missing", 200, { ok: true, room: { ...confirmedRoom(), host: undefined } }],
    ["members invalid", 200, { ok: true, room: { ...confirmedRoom(), members: 1 } }],
    ["moves missing", 200, { ok: true, room: { ...confirmedRoom(), moves: undefined } }],
    ["hostile id", 200, { ok: true, room: { ...confirmedRoom(), id: '<img src=x onerror="bad()">' } }],
    ["numeric id", 200, { ok: true, room: { ...confirmedRoom(), id: 12345678 } }],
    ["null body", 200, null],
    ["array body", 200, []],
    ["id only", 200, { id: "a1b2c3d4" }],
    ["ok only", 200, { ok: true }],
    ["room only", 200, { room: confirmedRoom() }],
    ["truthy ok", 200, { ok: 1, room: confirmedRoom() }],
    ["error status with success body", 503, { ok: true, room: confirmedRoom() }]
  ];
  for (const [label, status, body] of cases) {
    await t.test(label, async () => {
      const h = harness(() => reply(status, body));
      h.click();
      await h.settle();
      assertUnknown(h);
      h.click();
      assert.equal(h.calls.length, 1);
    });
  }
});

test("empty input is refused locally without a write and can be revised", async (t) => {
  for (const id of ["rn", "rh"]) {
    await t.test(id, async () => {
      const h = harness(() => reply(200, { ok: true, room: confirmedRoom() }));
      h.edit(id, "   ");
      h.click();
      await h.settle();
      assert.equal(h.calls.length, 0);
      assert.equal(h.nodes.rc.disabled, false);
      assert.equal(h.nodes[id].value, "   ");
      assert.equal(h.nodes.rcmsg.textContent, "Enter a room name and an existing host record name before submitting.");
      h.edit(id, id === "rn" ? "Test room" : "host-record");
      assert.equal(h.calls.length, 0, "editing is not consent to submit");
      h.click();
      await h.settle();
      assert.equal(h.calls.length, 1);
      assert.equal(h.refreshes, 1);
    });
  }
});

test("explicit pre-write validation refusals require changed input before another submission", async (t) => {
  for (const [status, error] of [
    [400, "name must be a nonempty string and host is required"],
    [404, "host must name an existing agent record; actor control is not verified"],
    [413, "body must be at most 65536 bytes"]
  ]) {
    await t.test(String(status), async () => {
      let attempt = 0;
      const h = harness(() => ++attempt === 1 ? reply(status, { error }) : reply(200, { ok: true, room: confirmedRoom() }));
      h.click();
      await h.settle();
      assert.equal(h.nodes.rcmsg.textContent, "Room creation was refused before a write. Review and revise the input before submitting a changed request. Server detail: " + error);
      assert.equal(h.nodes.rc.disabled, true);
      assert.equal(h.nodes.rn.value, "  Test room  ");
      assert.equal(h.nodes.rh.value, "  host-record  ");
      assert.equal(h.refreshes, 0);
      h.click();
      h.edit("rn", "Test room"); // Trimming-only changes are not a revised request.
      h.click();
      assert.equal(h.calls.length, 1);
      assert.equal(h.nodes.rc.disabled, true);
      h.edit("rh", "corrected-host");
      assert.equal(h.nodes.rc.disabled, false);
      h.edit("rh", " host-record ");
      assert.equal(h.nodes.rc.disabled, true, "reverting the edit must restore the refusal guard");
      h.edit("rh", "corrected-host");
      assert.equal(h.calls.length, 1, "editing is not consent to submit");
      h.click();
      await h.settle();
      assert.equal(h.calls.length, 2);
      assert.equal(JSON.parse(h.calls[1].options.body).host, "corrected-host");
      assert.equal(h.refreshes, 1);
      assert.deepEqual(h.forbidden, []);
    });
  }
});

test("503 write ambiguity preserves a candidate as unconfirmed without exposing keys or retrying", async () => {
  const h = harness(() => reply(503, {
    error: "temporary storage write failure",
    stored: "not_confirmed", retryable: false, reconciliation_required: true,
    candidate_id: "a1b2c3d4", candidate_room_key: "fixture-private-candidate-key",
    next_action: "https://untrusted.invalid/?room_key=fixture-private-candidate-key"
  }));
  h.click();
  await h.settle();
  assertUnknown(h, " Candidate ID (unconfirmed): a1b2c3d4.");
  assert.doesNotMatch(h.nodes.rcmsg.textContent, /fixture-private|untrusted\.invalid/);
  h.edit("rn", "Changed name");
  h.edit("rh", "changed-host");
  h.click();
  await h.settle();
  assert.equal(h.calls.length, 1);
  assert.equal(h.nodes.rc.disabled, true);
  assert.deepEqual(h.forbidden, []);
});

test("ambiguity hints override both success-looking bodies and validation statuses", async (t) => {
  for (const hint of [
    { stored: "not_confirmed" },
    { reconciliation_required: true },
    { candidate_id: "a1b2c3d4" },
    { candidate_room_key: "fixture-key-only" }
  ]) {
    for (const status of [200, 400]) {
      await t.test(status + " " + Object.keys(hint)[0], async () => {
        const data = status === 200 ? { ok: true, room: confirmedRoom() } : { error: "validation detail" };
        const h = harness(() => reply(status, { ...data, ...hint }));
        h.click();
        await h.settle();
        assertUnknown(h, hint.candidate_id ? " Candidate ID (unconfirmed): a1b2c3d4." : "");
        h.edit("rn", "Changed input cannot resolve an unknown write");
        h.click();
        assert.equal(h.calls.length, 1);
        assert.equal(h.nodes.rc.disabled, true);
      });
    }
  }
});

test("hostile validation text stays literal and is bounded to 160 code points", async () => {
  const error = '<svg onload="bad()"></svg></script>' + "🐉".repeat(3000) + "HIDDEN-TAIL";
  const h = harness(() => reply(400, { error, room_key: "fixture-secret", next_action: "https://untrusted.invalid/" }));
  h.click();
  await h.settle();
  const prefix = "Room creation was refused before a write. Review and revise the input before submitting a changed request. Server detail: ";
  assert.ok([...h.nodes.rcmsg.textContent].length <= prefix.length + 161, "server detail must have a finite display bound");
  assert.equal(h.nodes.rcmsg.textContent, prefix + [...error].slice(0, 160).join("") + "…");
  assert.doesNotMatch(h.nodes.rcmsg.textContent, /HIDDEN-TAIL|fixture-secret|untrusted\.invalid/);
  assert.equal(h.nodes.rn.value, "  Test room  ");
  assert.equal(h.nodes.rc.disabled, true);
  assert.deepEqual(h.forbidden, []);
});

test("malformed candidate identifiers are not displayed or turned into links", async () => {
  const h = harness(() => reply(503, {
    stored: "not_confirmed", retryable: false, reconciliation_required: true,
    candidate_id: '<img src="https://untrusted.invalid/" onerror="bad()">'.repeat(3000),
    error: "<script>bad()</script>", candidate_room_key: "fixture-secret"
  }));
  h.click();
  await h.settle();
  assertUnknown(h);
  assert.equal(h.calls.length, 1);
});

test("room-list refresh failure cannot revoke a confirmed write", async (t) => {
  for (const kind of ["synchronous", "rejected promise"]) {
    await t.test(kind, async () => {
      const h = harness(() => reply(200, { ok: true, room: confirmedRoom() }), {
        refresh() {
          if (kind === "synchronous") throw new Error("read failed");
          return Promise.reject(new Error("read failed"));
        }
      });
      h.click();
      await h.settle();
      assert.equal(h.nodes.rcmsg.textContent, "Room creation write accepted. Room ID: a1b2c3d4. This does not establish durable storage or global uniqueness.");
      assert.equal(h.nodes.rn.value, "");
      assert.equal(h.nodes.rc.disabled, false);
      assert.equal(h.calls.length, 1);
      assert.equal(h.refreshes, 1);
      assert.deepEqual(h.forbidden, []);
    });
  }
});

test("contradictory write evidence is not a success or a revisable validation refusal", async (t) => {
  for (const [label, status, body] of [
    ["success with error", 200, { ok: true, room: confirmedRoom(), error: "not accepted" }],
    ["success with stored false", 200, { ok: true, room: confirmedRoom(), stored: false }],
    ["validation with stored true", 400, { error: "validation detail", stored: true }],
    ["validation with room", 400, { error: "validation detail", room: confirmedRoom() }],
    ["validation with ok true", 400, { error: "validation detail", ok: true }]
  ]) {
    await t.test(label, async () => {
      const h = harness(() => reply(status, body));
      h.click();
      await h.settle();
      assertUnknown(h);
      h.edit("rh", "changed-host");
      h.click();
      assert.equal(h.calls.length, 1);
      assert.equal(h.nodes.rc.disabled, true);
    });
  }
});

function assertUnknown(h, suffix = "") {
  assert.equal(h.nodes.rc.disabled, true, "an unknown write must keep creation disabled; message: " + h.nodes.rcmsg.textContent);
  assert.equal(h.nodes.rn.value, "  Test room  ");
  assert.equal(h.nodes.rh.value, "  host-record  ");
  assert.equal(h.nodes.rcmsg.textContent, UNKNOWN + suffix);
  assert.equal(h.refreshes, 0);
  assert.deepEqual(h.forbidden, []);
}

test("transport failure preserves inputs and blocks repeated creation", async () => {
  const h = harness(() => Promise.reject(new Error("connection lost")));
  assert.equal(h.calls.length, 0, "loading the source never submits");
  h.click();
  await h.settle();
  assertUnknown(h);
  h.click();
  h.edit("rn", "A different room");
  h.click();
  await h.settle();
  assert.equal(h.calls.length, 1, "editing must not bypass outcome-unknown lock");
  assert.equal(h.nodes.rc.disabled, true);
});

test("pending creation guards double clicks independently of the disabled DOM button", async () => {
  let finish;
  const h = harness(() => new Promise((resolve) => { finish = resolve; }));
  h.click();
  assert.equal(h.nodes.rc.disabled, true);
  assert.equal(h.nodes.rcmsg.textContent, "Room creation request pending.");
  h.click(); // Deliberately deliver the listener even though the button is disabled.
  h.edit("rh", "another-host");
  h.click();
  assert.equal(h.calls.length, 1);
  finish(await reply(503, { stored: "not_confirmed" }));
  await h.settle();
  assert.equal(h.nodes.rc.disabled, true);
  assert.equal(h.nodes.rcmsg.textContent, UNKNOWN);
});

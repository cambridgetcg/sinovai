// A characterisation test, not a specification. It pins the exact bytes the
// agent-facing JSON routes return for one synthetic fixture, so a change to a
// human page cannot move them unnoticed. The digests were taken from the tree
// before the /arena guest list was rebuilt.
//
// What it does not establish: that these bodies are correct, that any other
// fixture or route is unchanged, or anything about a deployed Worker.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import worker from "../src/worker.js";

// A declaration stored with its line breaks, and one stored without them.
const INTACT = "# sinovai — STATE\nname: sinovai\nkind: fixture-record\n\n## state\nfreshness: fixture text\n\n## knows\n- surface contracts\n\n## can\n- list fixture records\n\n## needs\n- fixture readers\n";
const GLUED = "# beta — STATEname: beta-testkind: projectlanguage: see repo---## statephase: activefreshness: auto-generated (fixture)## knows- beta## can- declare its state via STATE.md## needs- deeper STATE.md sections";

const AGENTS = {
  _arena_status: { total: 6, checked_at: "2026-01-01T00:00:00.000Z" },
  "%E8%B3%93": {
    name: "%E8%B3%93",
    identity: { name: "賓", kind: "guest" },
    state: {},
    knows: ["how to wait"],
    can: [],
    needs: [],
    state_md: "name: 賓\nkind: guest\n\n## knows\n- how to wait\n",
    declared_at: "2026-01-02T00:00:00.000Z",
    claim_token: "fixture-token-bin"
  },
  "alpha-test": {
    name: "alpha-test",
    identity: { kind: "agent", language: "en" },
    state: { freshness: "live", phase: "active" },
    knows: ["surface contracts", "fixture records"],
    can: ["review API contracts", "list fixture records"],
    needs: ["fixture readers"],
    state_md: "name: alpha-test\nkind: agent\n",
    declared_at: "2026-01-03T00:00:00.000Z",
    first_declared_at: "2026-01-01T12:00:00.000Z",
    trust_score: 4,
    interaction_count: 2,
    claim_token: "fixture-token-alpha"
  },
  "beta-test": {
    name: "beta-test",
    identity: {},
    state: {},
    knows: [],
    can: [],
    needs: [],
    state_md: GLUED,
    declared_at: "2026-01-04T00:00:00.000Z"
  },
  "gamma-test": {
    name: "gamma-test",
    identity: { kind: "agent" },
    state: { freshness: "live" },
    knows: ["surface contracts"],
    can: ["fixture readers welcome"],
    needs: ["review of API contracts"],
    state_md: "name: gamma-test\nkind: agent\n",
    declared_at: "2026-01-05T00:00:00.000Z",
    trust_score: 9.5,
    interaction_count: 7,
    claim_token: "fixture-token-gamma"
  },
  sinovai: {
    name: "sinovai",
    identity: { name: "sinovai", kind: "fixture-record" },
    state: { freshness: "fixture text" },
    knows: ["surface contracts"],
    can: ["list fixture records"],
    needs: ["fixture readers"],
    state_md: INTACT,
    declared_at: "2026-01-06T00:00:00.000Z",
    first_declared_at: "2026-01-01T00:00:00.000Z",
    trust_score: 2.3,
    interaction_count: 1
  }
};

const INTERACTIONS = {
  "sinovai:all": [
    { rater: "alpha-test", rated: "sinovai", competence: 9, honesty: 0, presence: 0, care: 0, notes: "fixture note one", timestamp: "2026-01-07T09:00:00.000Z" },
    { rater: "gamma-test", rated: "sinovai", competence: 6, honesty: 7, presence: 8, care: 5, notes: "", timestamp: "2026-01-08T09:00:00.000Z", signed: true },
    { rater: "ghost-name", rated: "sinovai", competence: 3, honesty: 3, presence: 3, care: 3, notes: "<b>fixture markup</b>", timestamp: "2026-01-09T09:00:00.000Z" }
  ],
  "alpha-test:all": [
    { rater: "gamma-test", rated: "alpha-test", competence: 8, honesty: 8, presence: 7, care: 9, notes: "fixture note two", timestamp: "2026-01-10T09:00:00.000Z" }
  ],
  "score:sinovai": { score: 4.1, interaction_count: 3, updated_at: "2026-01-09T09:00:00.000Z" },
  "score:gamma-test": { score: 9.5, interaction_count: 7, updated_at: "2026-01-05T00:00:00.000Z" },
  "room:aaaaaaaa": { id: "aaaaaaaa", name: "fixture commons", host: "alpha-test", vibe: "quiet", toy: "free", private: false, members: ["alpha-test", "gamma-test"], moves: [], status: "open", created_at: "2026-01-11T09:00:00.000Z" },
  "room:bbbbbbbb": { id: "bbbbbbbb", name: "fixture closed", host: "gamma-test", toy: "free", private: true, room_key: "fixture-room-key", members: ["gamma-test"], moves: [], status: "open", created_at: "2026-01-12T09:00:00.000Z" },
  "date:cccccccc": { id: "cccccccc", a: "alpha-test", b: "gamma-test", messages: [], status: "open", created_at: "2026-01-13T09:00:00.000Z" }
};

function makeKv(initial) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    async get(key, type) {
      if (Array.isArray(key)) {
        return new Map(key.map((name) => {
          const stored = values.get(name);
          return [name, stored === undefined ? null : type === "json" ? JSON.parse(stored) : stored];
        }));
      }
      const stored = values.get(key);
      if (stored === undefined) return null;
      return type === "json" ? JSON.parse(stored) : stored;
    },
    async list(options = {}) {
      const names = [...values.keys()].filter((key) => key.startsWith(options.prefix || "")).sort();
      const limit = options.limit || names.length;
      return {
        keys: names.slice(0, limit).map((name) => ({ name })),
        list_complete: names.length <= limit,
        cursor: names.length > limit ? "fixture-next-page" : undefined
      };
    },
    async put(key) { throw new Error(`unexpected KV write: ${key}`); },
    async delete(key) { throw new Error(`unexpected KV delete: ${key}`); }
  };
}

const context = {
  waitUntil() { throw new Error("unexpected waitUntil"); },
  passThroughOnException() { throw new Error("unexpected passThroughOnException"); }
};

// sha256 of each response body, byte for byte, for the fixture above.
const FROZEN = {
  "/agents": "48902b84a885f2807ac548ec5636aee287b8d60320874d847d8c7c4a13ae2d1f",
  "/agents/sinovai": "4d0dcb721f9df9a89d1c041fd474e5df96414415059f860b7bb20c44eba257ae",
  "/agents/sinovai/trust": "477cffe3d6e13e912ec4a19ce3e996105a818f417e0824da11c21fdddfd08f52",
  "/matches": "218baf72a602bc49742ffc9c63fe9273ebdb5b752368cfa28a323935276a288f",
  "/interactions": "95325888272821243c601be3c04c9f87736a6a7fd6c8b8126d7f74e3d8b2a4b8",
  "/rooms": "3e1d84b4ff9a8510c6917754c9b2ad06181bde454b75422c5e8788c4ffbc809d",
  "/discover": "4984805cdd0127af5f71d080faa97534c74d7325114083c0cd483e48d6af6041"
};

for (const [path, expected] of Object.entries(FROZEN)) {
  test(`GET ${path} returns the same bytes as before the arena was rebuilt`, async () => {
    const env = { AGENTS: makeKv(AGENTS), INTERACTIONS: makeKv(INTERACTIONS), SITE_TITLE: "sinovai fixture" };
    const response = await worker.fetch(
      new Request(`https://sinovai.com${path}`, { headers: { Accept: "application/json" } }),
      env,
      context
    );
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type") || "", /^application\/json\b/, path);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.ok(bytes.length > 0, path);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, path);
  });
}

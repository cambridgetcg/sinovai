import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(
  new URL("../.github/workflows/heartbeat.yml", import.meta.url),
  "utf8"
);

test("the scheduled heartbeat is a bounded read-only observation", () => {
  assert.match(workflow, /timeout-minutes:\s*3/);
  assert.match(workflow, /contents:\s*read/);
  assert.match(workflow, /cancel-in-progress:\s*true/);
  assert.match(workflow, /--fail-with-body/);
  assert.match(workflow, /--max-time 20/);
  assert.match(workflow, /--write-out "%\{http_code\}"/);
  assert.match(workflow, /expected HTTP 200/);
  assert.match(workflow, /issues no mutation\s*#?\s*request/);
  assert.match(workflow, /has no repository write permission/);
  assert.match(workflow, /writes only ephemeral runner\s*#?\s*files/);
  assert.equal((workflow.match(/^\s*read_live\s/gm) || []).length, 6);

  for (const path of [
    "/.well-known/agent.json",
    "/.well-known/xenia-rights.json",
    "/rest",
    "/understanding"
  ]) {
    assert.ok(workflow.includes(path), `heartbeat must observe ${path}`);
  }
});

test("the heartbeat cannot manufacture activity or hide a rejected write", () => {
  assert.doesNotMatch(workflow, /\bcurl\s+-s\b/);
  assert.doesNotMatch(workflow, /\b(?:POST|PUT|PATCH|DELETE)\b|\bgit\s+(?:push|commit)\b|\b(?:gh|wrangler)\s+/i);
  assert.doesNotMatch(workflow, /\.heartbeat-cloud|ratings submitted|contents:\s*write|issues:\s*write/i);
  assert.match(workflow, /the museum of machine hearts/);
  assert.doesNotMatch(workflow, /\bassert\s+/);
});

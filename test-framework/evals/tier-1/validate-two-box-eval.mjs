#!/usr/bin/env node
/** Tier 1: the harness-agnostic Two-Box runner. The Claude transport's command line keeps
 * every isolation flag, its isolation probe fails when a planted canary reaches the model
 * (fake binary, no model call), the assessor's selection becomes the builder's plan, and
 * requirements come from the task's acceptance criteria. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { claude, transport } from "../../../scripts/lib/harness-transports.mjs";
import { chosenPlan, requirementsFor, ARMS } from "../../../scripts/two-box-eval.mjs";

test("claude transport: no tools, no settings, no MCP, no session file, structured output", () => {
  const args = claude.args({ model: "sonnet", effort: "high", schema: { type: "object" } });
  const at = (flag) => args[args.indexOf(flag) + 1];
  assert.equal(at("--tools"), "");
  assert.equal(at("--setting-sources"), "");
  assert.ok(args.includes("--strict-mcp-config") && args.includes("--no-session-persistence"));
  assert.equal(at("--effort"), "high");
  assert.equal(at("--json-schema"), '{"type":"object"}');
  assert.ok(!args.includes("--bare"), "subscription login keeps working");
  assert.throws(() => transport("nope"), /no transport/);
});

function fakeClaude(reply) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fake-claude-"));
  const bin = path.join(dir, "claude");
  // Echoes back any CLAUDE.md it can see in its working directory: a leaky harness.
  fs.writeFileSync(bin, `#!/usr/bin/env node
const fs = require("fs");
let seen = "";
try { seen = fs.readFileSync("CLAUDE.md", "utf8"); } catch {}
process.stdout.write(JSON.stringify({ is_error: false, result: ${JSON.stringify(reply)} === "LEAK" ? seen : ${JSON.stringify(reply)}, total_cost_usd: 0 }));
`);
  fs.chmodSync(bin, 0o755);
  return bin;
}

test("isolation probe: passes when no canary is visible, fails when one leaks", async () => {
  assert.equal((await claude.probeIsolation({ bin: fakeClaude("NONE") })).ok, true);
  const leaky = await claude.probeIsolation({ bin: fakeClaude("LEAK") });
  assert.equal(leaky.ok, false);
  assert.equal(leaky.canary_seen, true);
});

test("the assessor's selection becomes the builder's plan", () => {
  const open = { plan: "Open first paragraph.\n\nOpen second paragraph." };
  const contract = { plan: "C", decisions: [{ id: "D1", text: "Contract decision one." }] };
  const revised = { plan: "Revised plan.", decisions: [{ id: "D2", text: "Revised decision two." }] };
  assert.equal(chosenPlan({ winner: "open_win", selected: [] }, { open, contract, revised }), open.plan);
  assert.equal(chosenPlan({ winner: "contract_win", selected: [] }, { open, contract, revised }), "Revised plan.");
  assert.equal(chosenPlan({ winner: "combination", selected: [{ decision_id: "open:P2" }, { decision_id: "D2" }] }, { open, contract, revised }), "Open second paragraph.\n\nRevised decision two.");
});

test("requirements come from the task's acceptance criteria", () => {
  const reqs = requirementsFor("waitlist-feature", "FEATURE.md");
  assert.deepEqual(reqs.map((r) => r.id), ["AC1", "AC2", "AC3", "AC4", "AC5"]);
  assert.deepEqual(ARMS, ["bare", "open", "contract", "twobox"]);
});

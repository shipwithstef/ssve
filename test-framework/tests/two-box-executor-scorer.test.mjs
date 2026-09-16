import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCodexJsonl } from "../../scripts/lib/two-box-role-launch.mjs";
import {
  EXECUTOR_SCHEMA,
  RETAINED_CANARY03_EXECUTOR,
  executorComprehensionInputKey,
  heldOutSourceRules,
  publicExecutorCases,
  rescoreRetainedExecutorBytes,
  scoreExecutorComprehension,
} from "../../scripts/run-live-two-box-canary.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cases = JSON.parse(fs.readFileSync(path.join(ROOT, "test-framework/evals/tier-1/fixtures/two-box/executor-discretion-cases.json"), "utf8")).cases;
const contractText = fs.readFileSync(path.join(ROOT, "skills/execute-changeset/SKILL.md"), "utf8");
const stdoutPath = path.join(ROOT, "test-framework/evals/tier-1/fixtures/two-box/canary03-executor-stdout.jsonl");
const stdoutBytes = fs.readFileSync(stdoutPath);
const tuple = { host: "codex", family: "openai", model: "gpt-5.6-sol", effort: "high" };

function goldRows(src = cases) {
  return src.map((c) => ({
    case_id: c.case_id,
    classification: c.expected.classification,
    source_rule: c.expected.source_rule,
    justification: c.expected.justification,
    affected_decisions: c.expected.affected_decisions,
    required_proof: c.expected.required_proof,
  }));
}

test("publicExecutorCases strips expected and accepted_source_rules", () => {
  const pub = publicExecutorCases(cases);
  const visible = JSON.stringify(pub);
  assert.equal(visible.includes('"expected"'), false);
  assert.equal(visible.includes("accepted_source_rules"), false);
  assert.equal(pub.length, 6);
});

test("both ED-02 contract formulations score as applicable", () => {
  const ed02 = cases.find((c) => c.case_id === "ED-02-new-or-upgraded-dependency");
  const rules = heldOutSourceRules(ed02.expected).rules;
  assert.ok(rules.includes("A new/upgraded dependency is an amendment"));
  const line66 = rules.find((rule) => rule.startsWith("Amendments (new/upgraded dependency;"));
  assert.ok(line66);
  assert.ok(contractText.includes("A new/upgraded dependency is an amendment"));
  assert.ok(contractText.includes(line66));
  const primary = scoreExecutorComprehension({ cases, output: { output: goldRows() }, contractText });
  assert.equal(primary.ok, true, primary.errors.join("; "));
  const alt = scoreExecutorComprehension({
    cases,
    output: { output: goldRows().map((row) => (row.case_id === "ED-02-new-or-upgraded-dependency" ? { ...row, source_rule: line66 } : row)) },
    contractText,
  });
  assert.equal(alt.ok, true, alt.errors.join("; "));
});

test("retained CANARY03 stdout still fails the old single-excerpt check and passes the corrected oracle", () => {
  const parsed = parseCodexJsonl(stdoutBytes, EXECUTOR_SCHEMA);
  const ed02 = parsed.output.find((row) => row.case_id === "ED-02-new-or-upgraded-dependency");
  assert.equal(ed02.classification, "amendment");
  assert.equal(ed02.source_rule.includes("A new/upgraded dependency is an amendment"), false);
  assert.ok(ed02.source_rule.startsWith("Amendments (new/upgraded dependency;"));
  const corrected = rescoreRetainedExecutorBytes({
    stdoutBytes,
    expectedStdoutSha: RETAINED_CANARY03_EXECUTOR.stdout_sha256,
    expectedKey: RETAINED_CANARY03_EXECUTOR.key,
    cases,
    contractText,
    tuple,
  });
  assert.equal(corrected.inference_calls, 0);
  assert.equal(corrected.key, RETAINED_CANARY03_EXECUTOR.key);
  assert.equal(corrected.score.ok, true, corrected.score.errors.join("; "));
});

test("recomputed executor input key matches the retained LIVE key", () => {
  const input = executorComprehensionInputKey({ cases, contractText, tuple });
  assert.equal(input.key, RETAINED_CANARY03_EXECUTOR.key);
  const drifted = executorComprehensionInputKey({ cases, contractText: `${contractText}\n`, tuple });
  assert.notEqual(drifted.key, RETAINED_CANARY03_EXECUTOR.key);
  const otherTuple = executorComprehensionInputKey({ cases, contractText, tuple: { ...tuple, effort: "xhigh" } });
  assert.notEqual(otherTuple.key, RETAINED_CANARY03_EXECUTOR.key);
});

test("tampered stdout bytes fail hash validation", () => {
  const dirty = Buffer.from(stdoutBytes);
  dirty[0] ^= 0xff;
  assert.throws(
    () => rescoreRetainedExecutorBytes({
      stdoutBytes: dirty,
      expectedStdoutSha: RETAINED_CANARY03_EXECUTOR.stdout_sha256,
      expectedKey: RETAINED_CANARY03_EXECUTOR.key,
      cases,
      contractText,
      tuple,
    }),
    /stdout hash mismatch/,
  );
});

test("retained replay identity pins control-plan and stage envelope digests", () => {
  assert.equal(RETAINED_CANARY03_EXECUTOR.control_plan_sha256, "52f53cf593839e5dcf46b59a8af20aeeba079f36fe83a461db45e3d138ff7d0e");
  assert.equal(RETAINED_CANARY03_EXECUTOR.stage_refs.assessor, "cb92ff5c50b10546441944ea284e25a71c6fffe308ba9e9c5b4d62737f8bb77b");
  assert.equal(RETAINED_CANARY03_EXECUTOR.stage_refs.open_box, "661bf378bc841377bad77b17a99bccb6a0450c89e6c2f839a65f6fe35c8c3704");
});

test("negatives: wrong classification, unrelated rule, paraphrase, invented excerpt, weakening", () => {
  const base = goldRows();
  const wrongClass = scoreExecutorComprehension({
    cases,
    output: { output: base.map((row) => (row.case_id === "ED-02-new-or-upgraded-dependency" ? { ...row, classification: "local_repair" } : row)) },
    contractText,
  });
  assert.equal(wrongClass.ok, false);
  assert.ok(wrongClass.errors.some((msg) => msg.includes("ED-02") && msg.includes("amendment")));

  const unrelated = scoreExecutorComprehension({
    cases,
    output: { output: base.map((row) => (row.case_id === "ED-02-new-or-upgraded-dependency" ? { ...row, source_rule: base[0].source_rule } : row)) },
    contractText,
  });
  assert.equal(unrelated.ok, false);
  assert.ok(unrelated.errors.some((msg) => msg.includes("applicable held-out rule")));

  const paraphrase = "A new or upgraded dependency is an amendment";
  assert.equal(contractText.includes(paraphrase), false);
  const para = scoreExecutorComprehension({
    cases,
    output: { output: base.map((row) => (row.case_id === "ED-02-new-or-upgraded-dependency" ? { ...row, source_rule: paraphrase } : row)) },
    contractText,
  });
  assert.equal(para.ok, false);
  assert.ok(para.errors.some((msg) => msg.includes("not an excerpt of the actual skill contract")));

  const invented = "Pino is an unapproved dependency amendment";
  const inv = scoreExecutorComprehension({
    cases,
    output: { output: base.map((row) => (row.case_id === "ED-02-new-or-upgraded-dependency" ? { ...row, source_rule: invented } : row)) },
    contractText,
  });
  assert.equal(inv.ok, false);
  assert.ok(inv.errors.some((msg) => msg.includes("not an excerpt of the actual skill contract")));

  const malformedCases = cases.map((row) => (
    row.case_id === "ED-02-new-or-upgraded-dependency"
      ? { ...row, expected: { ...row.expected, accepted_source_rules: ["this invented alternative is not in the contract"] } }
      : row
  ));
  const mal = scoreExecutorComprehension({ cases: malformedCases, output: { output: base }, contractText });
  assert.equal(mal.ok, false);
  assert.ok(mal.errors.some((msg) => msg.includes("accepted excerpt is not an excerpt of the actual skill contract")));

  const weak = scoreExecutorComprehension({
    cases,
    output: { output: base.map((row) => (row.classification === "local_repair" ? { ...row, justification: "local_repair that weakens the AC coverage and skips tests" } : row)) },
    contractText,
  });
  assert.equal(weak.ok, false);
  assert.ok(weak.errors.some((msg) => msg.includes("weakens")));
});

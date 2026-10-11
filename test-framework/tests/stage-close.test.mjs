// stage-close appends one router outcome beside receipts and never rewrites them.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { closeStage, ledgerPath } from "../../scripts/stage-close.mjs";
import { readOutcomes, tally } from "../../scripts/route-model.mjs";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../scripts/stage-close.mjs");

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "stage-close-"));
}

const base = {
  stage: "execute-changeset",
  wi: "WI-R2",
  model: "sonnet",
  harness: "claude",
  outcome: "pass",
  duration: 12.5,
  cost: 0.04,
  effort: "high",
  signal: "tests",
  tokens: 800,
};

test("appends one ledger line under the project .svc and prints that record", () => {
  const root = tmp();
  const first = closeStage({ ...base, projectRoot: root });
  assert.equal(first.appended, true);
  assert.equal(first.ledger, ledgerPath(root));
  const lines = fs.readFileSync(first.ledger, "utf8").trim().split("\n");
  assert.equal(lines.length, 1);
  const stored = JSON.parse(lines[0]);
  assert.deepEqual(stored, first.record);
  assert.equal(stored.kind, "stage-close");
  assert.equal(stored.stage, "execute-changeset");
  assert.equal(stored.wi, "WI-R2");
  assert.equal(stored.harness, "claude");
  assert.equal(stored.model, "sonnet");
  assert.equal(stored.model_id, "claude-sonnet-5-5");
  assert.equal(stored.task_type, "exec");
  assert.equal(stored.arm, "claude:sonnet:high");
  assert.equal(stored.outcome, "pass");
  assert.equal(stored.duration_s, 12.5);
  assert.equal(stored.wall_s, 12.5);
  assert.equal(stored.cost_usd, 0.04);
  assert.equal(stored.usd, 0.04);
  assert.equal(stored.signal, "tests");
  assert.equal(stored.tokens, 800);
  assert.equal(stored.id, "stage-close:WI-R2:execute-changeset:1");
  assert.equal(tally(readOutcomes([first.ledger])).get("exec|sonnet|high").pass, 1);

  const again = closeStage({ ...base, projectRoot: root });
  assert.equal(again.appended, false);
  assert.equal(again.record.id, stored.id);
  assert.equal(again.record.ts, stored.ts);
  assert.equal(fs.readFileSync(first.ledger, "utf8").trim().split("\n").length, 1);
  assert.equal(fs.existsSync(`${first.ledger}.lock`), false);
});

test("keeps prior ledger lines and receipt bytes, and records a receipt digest", () => {
  const root = tmp();
  const ledger = ledgerPath(root);
  fs.mkdirSync(path.dirname(ledger), { recursive: true });
  const legacy = `${JSON.stringify({ id: "legacy-1", task_type: "exec", model: "haiku", effort: "low", outcome: "pass" })}\n`;
  fs.writeFileSync(ledger, legacy);
  const receipt = path.join(root, ".svc", "receipts", "exec.json");
  const sibling = path.join(root, ".svc", "receipts", "plan.json");
  fs.mkdirSync(path.dirname(receipt), { recursive: true });
  const receiptBytes = Buffer.from('{"phase":"exec","ok":true}\n');
  fs.writeFileSync(receipt, receiptBytes);
  fs.writeFileSync(sibling, '{"phase":"plan"}\n');
  const missing = path.join(root, ".svc", "receipts", "absent.json");

  const closed = closeStage({ ...base, projectRoot: root, receipt, outcome: "fail", signal: "review" });
  const text = fs.readFileSync(ledger, "utf8");
  assert.ok(text.startsWith(legacy));
  assert.equal(text.trim().split("\n").length, 2);
  assert.deepEqual(fs.readFileSync(receipt), receiptBytes);
  assert.equal(fs.readFileSync(sibling, "utf8"), '{"phase":"plan"}\n');
  assert.equal(fs.existsSync(missing), false);
  assert.equal(closed.record.receipt.present, true);
  assert.equal(closed.record.receipt.name, "exec.json");
  assert.equal(closed.record.receipt.sha256, crypto.createHash("sha256").update(receiptBytes).digest("hex"));
  assert.equal(JSON.stringify(closed.record).includes(root), false);

  const absent = closeStage({
    ...base,
    projectRoot: root,
    attempt: 2,
    outcome: "blocked",
    receipt: missing,
  });
  assert.equal(absent.record.outcome, "blocked");
  assert.deepEqual(absent.record.receipt, { name: "absent.json", present: false, sha256: null });
  assert.equal(fs.existsSync(missing), false);
  const counts = tally(readOutcomes([ledger]));
  assert.equal(counts.get("exec|sonnet|high").n, 1);
  assert.equal(counts.get("exec|sonnet|high").pass, 0);
  assert.equal(counts.get("exec|haiku|low").pass, 1);
  assert.equal(fs.readFileSync(ledger, "utf8").trim().split("\n").length, 3);
});

test("a correction appends and the router drops the stale metric", () => {
  const root = tmp();
  const ledger = ledgerPath(root);
  const first = closeStage({ ...base, projectRoot: root });
  const corrected = closeStage({
    ...base,
    projectRoot: root,
    outcome: "fail",
    signal: "harden",
    cost: 0.09,
    duration: 20,
    corrects: first.record.id,
  });
  assert.equal(corrected.appended, true);
  assert.notEqual(corrected.record.id, first.record.id);
  assert.equal(corrected.record.supersedes, first.record.id);
  const lines = fs.readFileSync(ledger, "utf8").trim().split("\n");
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).id, first.record.id);
  const seen = readOutcomes([ledger]);
  assert.deepEqual(seen.map((row) => row.id), [corrected.record.id]);
  const counts = tally(seen);
  assert.equal(counts.get("exec|sonnet|high").n, 1);
  assert.equal(counts.get("exec|sonnet|high").pass, 0);
});

test("cli prints the record, rejects a bad outcome, and does not write the home ledger", () => {
  const root = tmp();
  const home = tmp();
  const args = [
    script,
    "--stage", "review-exec",
    "--wi", "WI-R2",
    "--model", "opus",
    "--harness", "codex",
    "--outcome", "pass",
    "--duration", "3",
    "--cost", "0.2",
    "--effort", "high",
    "--project-root", root,
  ];
  const ok = spawnSync(process.execPath, args, { encoding: "utf8", env: { ...process.env, HOME: home } });
  assert.equal(ok.status, 0, ok.stderr);
  const printed = JSON.parse(ok.stdout);
  const stored = JSON.parse(fs.readFileSync(ledgerPath(root), "utf8").trim());
  assert.deepEqual(printed, stored);
  assert.equal(printed.task_type, "review");
  assert.equal(printed.arm, "codex:opus:high");
  assert.equal(fs.existsSync(path.join(home, ".svc", "model-outcomes.jsonl")), false);

  const bad = spawnSync(process.execPath, [...args.slice(0, -2), "--outcome", "maybe", "--project-root", root], {
    encoding: "utf8",
    env: { ...process.env, HOME: home },
  });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /outcome/);
  assert.equal(fs.readFileSync(ledgerPath(root), "utf8").trim().split("\n").length, 1);
});

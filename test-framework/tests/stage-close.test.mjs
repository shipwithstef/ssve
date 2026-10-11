// @organism-suite
// stage-close appends one router outcome beside receipts and never rewrites them.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { closeStage, ledgerPath } from "../../scripts/stage-close.mjs";
import { loadIntel, readOutcomes, tally } from "../../scripts/route-model.mjs";
import { withStateLock } from "../../scripts/state-io.mjs";

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

test("effort is required, and a recorded effort is counted by the router", () => {
  const root = tmp();
  const args = [
    script,
    "--stage", "execute-changeset",
    "--wi", "WI-R2",
    "--model", "sonnet",
    "--harness", "claude",
    "--outcome", "pass",
    "--duration", "1",
    "--cost", "0",
    "--project-root", root,
  ];
  const missing = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /--effort is required/);
  assert.equal(fs.existsSync(ledgerPath(root)), false);

  const ok = spawnSync(process.execPath, [...args.slice(0, -2), "--effort", "high", "--project-root", root], {
    encoding: "utf8",
  });
  assert.equal(ok.status, 0, ok.stderr);
  const counts = tally(readOutcomes([ledgerPath(root)]), loadIntel().models);
  assert.equal(counts.get("exec|sonnet|high").n, 1);
  assert.equal(counts.get("exec|sonnet|high").pass, 1);
});

test("claude and codex outcomes with the same model and effort do not share a posterior", () => {
  const root = tmp();
  const ledger = ledgerPath(root);
  closeStage({ ...base, projectRoot: root, harness: "claude", outcome: "pass" });
  closeStage({ ...base, projectRoot: root, harness: "codex", outcome: "fail", attempt: 2 });
  const modelId = loadIntel().models.models.sonnet.id;
  fs.appendFileSync(ledger, `${JSON.stringify({
    id: "legacy-claude",
    task_type: "exec",
    model: "sonnet",
    model_id: modelId,
    effort: "high",
    outcome: "pass",
  })}\n`);
  const counts = tally(readOutcomes([ledger]), loadIntel().models);
  assert.equal(counts.get("exec|sonnet|high").n, 2);
  assert.equal(counts.get("exec|sonnet|high").pass, 2);
  let n = 0;
  for (const row of counts.values()) n += row.n;
  assert.equal(n, 2);
});

test("rejects a dangling receipt symlink aimed at a missing ledger", () => {
  const root = tmp();
  const ledger = ledgerPath(root);
  const receiptDir = path.join(root, "receipts");
  fs.mkdirSync(receiptDir, { recursive: true });
  const receipt = path.join(receiptDir, "exec.json");
  const relative = path.relative(receiptDir, ledger);
  fs.symlinkSync(relative, receipt);
  assert.notEqual(path.resolve(receipt), path.resolve(ledger));
  assert.equal(fs.lstatSync(receipt).isSymbolicLink(), true);
  assert.equal(fs.existsSync(receipt), false);
  assert.equal(fs.existsSync(ledger), false);

  assert.throws(
    () => closeStage({ ...base, projectRoot: root, receipt }),
    (error) => error.code === "USAGE" && error.message === "--receipt must not be the outcome ledger",
  );
  assert.equal(fs.existsSync(ledger), false);
  assert.equal(fs.existsSync(`${ledger}.lock`), false);
  assert.equal(fs.existsSync(path.dirname(ledger)), false);
  assert.equal(fs.readlinkSync(receipt), relative);
  assert.equal(fs.existsSync(receipt), false);

  const lockRoot = tmp();
  const lockLedger = ledgerPath(lockRoot);
  const lockReceipt = path.join(lockRoot, "lock-receipt.json");
  fs.symlinkSync(`${lockLedger}.lock`, lockReceipt);
  assert.throws(
    () => closeStage({ ...base, projectRoot: lockRoot, receipt: lockReceipt, id: "lock-dangling" }),
    (error) => error.code === "USAGE" && error.message === "--receipt must not be the outcome ledger lock",
  );
  assert.equal(fs.existsSync(`${lockLedger}.lock`), false);
  assert.equal(fs.existsSync(lockLedger), false);
  assert.equal(fs.existsSync(lockReceipt), false);

  const via = tmp();
  const viaLedger = ledgerPath(via);
  fs.mkdirSync(path.dirname(viaLedger), { recursive: true });
  const alias = path.join(via, "alias-svc");
  fs.symlinkSync(path.dirname(viaLedger), alias);
  const viaReceipt = path.join(via, "via-receipt.json");
  fs.symlinkSync(path.join(alias, path.basename(viaLedger)), viaReceipt);
  assert.notEqual(path.resolve(viaReceipt), path.resolve(viaLedger));
  assert.equal(fs.existsSync(viaReceipt), false);
  assert.throws(
    () => closeStage({ ...base, projectRoot: via, receipt: viaReceipt, id: "via-dangling" }),
    (error) => error.code === "USAGE" && error.message === "--receipt must not be the outcome ledger",
  );
  assert.equal(fs.existsSync(viaLedger), false);
  assert.equal(fs.existsSync(viaReceipt), false);
});

test("rejects a receipt hard-linked to the ledger without changing either file", () => {
  const root = tmp();
  const ledger = ledgerPath(root);
  fs.mkdirSync(path.dirname(ledger), { recursive: true });
  const bytes = Buffer.from('{"phase":"exec"}\n');
  fs.writeFileSync(ledger, bytes);
  const receipt = path.join(root, ".svc", "receipts", "exec.json");
  fs.mkdirSync(path.dirname(receipt), { recursive: true });
  fs.linkSync(ledger, receipt);
  const ledgerStat = fs.statSync(ledger);
  const receiptStat = fs.statSync(receipt);
  assert.equal(ledgerStat.ino, receiptStat.ino);
  assert.equal(ledgerStat.dev, receiptStat.dev);
  assert.notEqual(path.resolve(ledger), path.resolve(receipt));

  assert.throws(
    () => closeStage({ ...base, projectRoot: root, receipt }),
    (error) => error.code === "USAGE" && error.message === "--receipt must not be the outcome ledger",
  );
  assert.deepEqual(fs.readFileSync(ledger), bytes);
  assert.deepEqual(fs.readFileSync(receipt), bytes);
});

test("rejects a receipt that aliases the ledger lock before stale recovery can delete it", () => {
  const root = tmp();
  const ledger = ledgerPath(root);
  const lock = `${ledger}.lock`;
  fs.mkdirSync(path.dirname(ledger), { recursive: true });
  const bytes = Buffer.from('{"phase":"exec","ok":true}\n');
  fs.writeFileSync(lock, bytes);
  const old = new Date(Date.now() - 11 * 60 * 1000);
  fs.utimesSync(lock, old, old);

  assert.throws(
    () => closeStage({ ...base, projectRoot: root, receipt: lock }),
    (error) => error.code === "USAGE" && error.message === "--receipt must not be the outcome ledger lock",
  );
  assert.deepEqual(fs.readFileSync(lock), bytes);
  assert.equal(fs.existsSync(ledger), false);

  const alias = path.join(root, "receipt-alias.json");
  fs.linkSync(lock, alias);
  assert.notEqual(path.resolve(alias), path.resolve(lock));
  assert.throws(
    () => closeStage({ ...base, projectRoot: root, receipt: alias }),
    (error) => error.code === "USAGE" && error.message === "--receipt must not be the outcome ledger lock",
  );
  assert.deepEqual(fs.readFileSync(alias), bytes);
  assert.deepEqual(fs.readFileSync(lock), bytes);
  assert.equal(fs.existsSync(ledger), false);
});

test("organism suite marker is the first line so tier-1 discovers this file", () => {
  const text = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
  assert.equal(text.startsWith("// @organism-suite\n"), true);
  const discovered = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../evals/tier-1/validate-organism-suite.mjs"),
    "utf8",
  );
  assert.match(discovered, /@organism-suite/);
  assert.match(discovered, /test-framework", "tests"/);
});

test("refuses a correction whose target is missing or already superseded", () => {
  const root = tmp();
  assert.throws(
    () => closeStage({ ...base, projectRoot: root, corrects: "missing", id: "corr-missing" }),
    (error) => error.code === "USAGE" && error.message === "--corrects must name an existing, active outcome",
  );
  assert.equal(fs.existsSync(ledgerPath(root)), false);

  const first = closeStage({ ...base, projectRoot: root, id: "target-a" });
  const replaced = closeStage({
    ...base,
    projectRoot: root,
    id: "corr-b",
    outcome: "fail",
    corrects: first.record.id,
  });
  assert.equal(replaced.appended, true);
  const before = fs.readFileSync(ledgerPath(root));
  assert.throws(
    () => closeStage({
      ...base,
      projectRoot: root,
      id: "corr-c",
      outcome: "pass",
      attempt: 3,
      corrects: first.record.id,
    }),
    (error) => error.code === "USAGE" && error.message === "--corrects must name an existing, active outcome",
  );
  assert.deepEqual(fs.readFileSync(ledgerPath(root)), before);
  const seen = readOutcomes([ledgerPath(root)]);
  assert.deepEqual(seen.map((row) => row.id), ["corr-b"]);
  const counts = tally(seen);
  assert.equal(counts.get("exec|sonnet|high").n, 1);
  assert.equal(counts.get("exec|sonnet|high").pass, 0);

  const again = closeStage({
    ...base,
    projectRoot: root,
    id: "corr-b",
    outcome: "pass",
    corrects: first.record.id,
  });
  assert.equal(again.appended, false);
  assert.equal(again.record.outcome, "fail");
  assert.deepEqual(fs.readFileSync(ledgerPath(root)), before);
});

test("a correction of the active replacement still counts as one sample", () => {
  const root = tmp();
  const first = closeStage({ ...base, projectRoot: root, id: "target-a", outcome: "pass" });
  const replaced = closeStage({
    ...base,
    projectRoot: root,
    id: "corr-b",
    outcome: "fail",
    corrects: first.record.id,
  });
  const latest = closeStage({
    ...base,
    projectRoot: root,
    id: "corr-c",
    outcome: "pass",
    attempt: 4,
    corrects: replaced.record.id,
  });
  assert.equal(latest.appended, true);
  assert.equal(latest.record.supersedes, "corr-b");
  const seen = readOutcomes([ledgerPath(root)]);
  assert.deepEqual(seen.map((row) => row.id), ["corr-c"]);
  const counts = tally(seen);
  assert.equal(counts.get("exec|sonnet|high").n, 1);
  assert.equal(counts.get("exec|sonnet|high").pass, 1);
});

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function childClose(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

test("a correction waiting on the ledger lock rechecks that the target is still active", async () => {
  const root = tmp();
  const first = closeStage({ ...base, projectRoot: root, id: "target-a" });
  const ledger = ledgerPath(root);
  const correction = `${JSON.stringify({
    id: "corr-b",
    kind: "stage-close",
    task_type: "exec",
    model: "sonnet",
    harness: "claude",
    effort: "high",
    outcome: "fail",
    supersedes: first.record.id,
  })}\n`;
  let pending;
  withStateLock(ledger, () => {
    pending = childClose([
      "--stage", "execute-changeset",
      "--wi", "WI-R2",
      "--model", "sonnet",
      "--harness", "claude",
      "--outcome", "pass",
      "--duration", "1",
      "--cost", "0",
      "--effort", "high",
      "--id", "corr-c",
      "--corrects", first.record.id,
      "--project-root", root,
    ]);
    sleep(500);
    fs.appendFileSync(ledger, correction);
  });
  const result = await pending;
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /existing, active outcome/);
  const text = fs.readFileSync(ledger, "utf8");
  assert.equal(text.includes('"id":"corr-c"'), false);
  assert.equal(text.includes('"id":"corr-b"'), true);
  const counts = tally(readOutcomes([ledger]));
  assert.equal(counts.get("exec|sonnet|high").n, 1);
  assert.equal(counts.get("exec|sonnet|high").pass, 0);
});

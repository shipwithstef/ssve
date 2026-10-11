#!/usr/bin/env node
/**
 * stage-close.mjs — record one stage outcome on the router's ledger.
 *
 * Appends a single JSON line to `<project>/.svc/model-outcomes.jsonl`, the
 * same store `route-model.mjs` reads (created if missing). A repeat of the
 * same id prints the existing line and does not append. A correction
 * (`--corrects <id>`) appends a new line only when that id is an existing
 * ledger row that no row already names in `supersedes`. The check runs
 * under the ledger lock, so a second correction of an already replaced
 * outcome is refused and cannot become a second router sample. The named
 * line stays on disk and `readOutcomes` stops counting it.
 *
 * Receipt files are read-only. `--receipt` hashes a regular file and stores
 * its basename plus digest. This script never creates, rewrites, or deletes
 * a receipt, a git note, or any ledger line.
 *
 *   node scripts/stage-close.mjs \
 *     --stage S --wi WI --model M --harness H --effort E \
 *     --outcome pass|fail|blocked --duration <seconds> --cost <usd> \
 *     [--task-type T] [--tokens N] [--signal tests|review|harden] \
 *     [--attempt N] [--id ID] [--corrects ID] [--receipt PATH] \
 *     [--project-root DIR]
 *
 * `--effort` is required. The router counts only rows that carry one, so a
 * record without it would not be a usable learning.
 */

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";
import { withStateLock } from "./state-io.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTCOMES = ["pass", "fail", "blocked"];
const SIGNALS = ["tests", "review", "harden"];
const LEDGER_NAME = "model-outcomes.jsonl";

export function ledgerPath(root) {
  return path.join(root, ".svc", LEDGER_NAME);
}

export function projectRoot({ projectRoot, cwd = process.cwd() } = {}) {
  if (projectRoot) return path.resolve(cwd, projectRoot);
  try {
    const common = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return path.dirname(common);
  } catch {
    return path.resolve(cwd);
  }
}

function usage(message) {
  const error = new Error(message);
  error.code = "USAGE";
  return error;
}

function requiredToken(value, flag) {
  if (typeof value !== "string" || !value.trim() || /[\r\n]/.test(value)) {
    throw usage(`${flag} is required`);
  }
  return value.trim();
}

function nonNegative(value, flag, { integer = false } = {}) {
  if (value === undefined || value === null || value === "") throw usage(`${flag} is required`);
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n))) {
    throw usage(`${flag} must be a non-negative ${integer ? "integer" : "number"}`);
  }
  return n;
}

function loadIntel() {
  try {
    const models = JSON.parse(fs.readFileSync(path.join(ROOT, "references", "model-intel", "models.json"), "utf8"));
    const priors = JSON.parse(fs.readFileSync(path.join(ROOT, "references", "model-intel", "priors.json"), "utf8"));
    return { models, priors };
  } catch {
    return null;
  }
}

function inspectReceipt(receiptPath) {
  if (!receiptPath) return null;
  const name = path.basename(receiptPath);
  let st;
  try {
    st = fs.statSync(receiptPath);
  } catch (error) {
    if (error?.code === "ENOENT") return { name, present: false, sha256: null };
    throw error;
  }
  if (!st.isFile()) return { name, present: true, sha256: null };
  const bytes = fs.readFileSync(receiptPath);
  return {
    name,
    present: true,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
}

function readLedger(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      rows.push(null);
    }
  }
  return rows;
}

function refuseSymlink(file) {
  try {
    if (fs.lstatSync(file).isSymbolicLink()) throw usage(`${file} is a symlink; refusing to follow it`);
  } catch (error) {
    if (error?.code === "USAGE") throw error;
    if (error?.code !== "ENOENT") throw error;
  }
}

// Device and inode, so a hard link or a symlink to the same file compares equal
// even when the path strings differ. stat follows links; a missing path does not.
function fileIdentity(file) {
  try {
    const st = fs.statSync(file);
    return `${st.dev}:${st.ino}`;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function assertReceiptDistinct(receiptPath, otherPath, label) {
  if (!receiptPath) return;
  if (path.resolve(receiptPath) === path.resolve(otherPath)) {
    throw usage(`--receipt must not be the ${label}`);
  }
  const receiptId = fileIdentity(receiptPath);
  const otherId = fileIdentity(otherPath);
  if (receiptId && otherId && receiptId === otherId) {
    throw usage(`--receipt must not be the ${label}`);
  }
}

// Active means a real row with this id, and no row already supersedes it.
// A→B then A→C would otherwise leave both B and C in the router tally.
function activeCorrectionTarget(rows, id) {
  for (const row of rows) {
    if (row && row.supersedes === id) return false;
  }
  return rows.some((row) => row && row.id === id);
}

/**
 * Append one stage outcome. `opts.projectRoot` selects the project whose
 * `.svc/model-outcomes.jsonl` is updated. Returns `{ record, appended, ledger }`.
 */
export function closeStage(opts = {}) {
  const stage = requiredToken(opts.stage, "--stage");
  const wi = requiredToken(opts.wi, "--wi");
  const model = requiredToken(opts.model, "--model");
  const harness = requiredToken(opts.harness, "--harness");
  const outcome = requiredToken(opts.outcome, "--outcome");
  if (!OUTCOMES.includes(outcome)) throw usage("--outcome must be pass, fail, or blocked");
  const durationS = nonNegative(opts.duration, "--duration");
  const costUsd = nonNegative(opts.cost, "--cost");
  const attempt = opts.attempt === undefined || opts.attempt === null || opts.attempt === ""
    ? 1
    : nonNegative(opts.attempt, "--attempt", { integer: true });
  if (attempt < 1) throw usage("--attempt must be an integer >= 1");
  if (opts.effort === undefined || opts.effort === null || opts.effort === "") {
    throw usage("--effort is required");
  }
  const effort = requiredToken(String(opts.effort), "--effort");
  let tokens = null;
  if (opts.tokens !== undefined && opts.tokens !== null && opts.tokens !== "") {
    tokens = nonNegative(opts.tokens, "--tokens", { integer: true });
  }
  let signal = null;
  if (opts.signal !== undefined && opts.signal !== null && opts.signal !== "") {
    signal = requiredToken(String(opts.signal), "--signal");
    if (!SIGNALS.includes(signal)) throw usage("--signal must be tests, review, or harden");
  }
  const corrects = opts.corrects ? requiredToken(String(opts.corrects), "--corrects") : null;
  const intel = loadIntel();
  const taskType = opts.taskType
    ? requiredToken(String(opts.taskType), "--task-type")
    : intel?.priors?.skill_task_types?.[stage] || "exec";
  const modelId = intel?.models?.models?.[model]?.id || null;
  const id = opts.id
    ? requiredToken(String(opts.id), "--id")
    : corrects
      ? `stage-close:${wi}:${stage}:${attempt}:corrects:${corrects}`
      : `stage-close:${wi}:${stage}:${attempt}`;
  if (corrects && corrects === id) throw usage("--corrects must name a different record");

  const root = projectRoot(opts);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw usage("--project-root is not a directory");
  const ledger = ledgerPath(root);
  const svcDir = path.join(root, ".svc");
  refuseSymlink(svcDir);
  refuseSymlink(ledger);
  const receiptPath = opts.receipt ? path.resolve(String(opts.receipt)) : null;
  const lockFile = `${ledger}.lock`;
  // Before the lock: stale-lock recovery unlinks `<ledger>.lock`.
  assertReceiptDistinct(receiptPath, lockFile, "outcome ledger lock");
  assertReceiptDistinct(receiptPath, ledger, "outcome ledger");
  const receipt = inspectReceipt(receiptPath);

  const record = {
    id,
    ts: new Date().toISOString(),
    kind: "stage-close",
    stage,
    wi,
    task_type: taskType,
    skill: stage,
    model,
    model_id: modelId,
    harness,
    effort,
    arm: `${harness}:${model}:${effort}`,
    rung: null,
    outcome,
    failure_kind: null,
    signal,
    tokens,
    duration_s: durationS,
    wall_s: durationS,
    cost_usd: costUsd,
    usd: costUsd,
    attempt,
    supersedes: corrects,
    receipt,
  };

  return withStateLock(ledger, () => {
    // Re-check after the lock is held, immediately before any append. A hard
    // link created after the earlier check would otherwise share the ledger inode.
    assertReceiptDistinct(receiptPath, ledger, "outcome ledger");
    const rows = readLedger(ledger);
    const prior = rows.find((row) => row && row.id === record.id);
    if (prior) return { record: prior, appended: false, ledger };
    if (corrects && !activeCorrectionTarget(rows, corrects)) {
      throw usage("--corrects must name an existing, active outcome");
    }
    let existing = "";
    try {
      existing = fs.readFileSync(ledger, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
    fs.mkdirSync(path.dirname(ledger), { recursive: true });
    fs.appendFileSync(ledger, `${prefix}${JSON.stringify(record)}\n`, "utf8");
    return { record, appended: true, ledger };
  });
}

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      o._.push(a);
      continue;
    }
    const key = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    o[key] = argv[++i];
  }
  return o;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args._.length) {
    process.stderr.write(`stage-close: unknown argument ${args._[0]}\n`);
    return 2;
  }
  try {
    const { record } = closeStage({
      stage: args.stage,
      wi: args.wi,
      model: args.model,
      harness: args.harness,
      outcome: args.outcome,
      duration: args.duration,
      cost: args.cost,
      effort: args.effort,
      taskType: args.taskType,
      tokens: args.tokens,
      signal: args.signal,
      attempt: args.attempt,
      id: args.id,
      corrects: args.corrects,
      receipt: args.receipt,
      projectRoot: args.projectRoot,
    });
    process.stdout.write(`${JSON.stringify(record)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`stage-close: ${error.message}\n`);
    return error.code === "USAGE" ? 2 : 1;
  }
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));

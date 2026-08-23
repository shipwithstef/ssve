#!/usr/bin/env node
// Canonical WI binding, reviewed-plan authorization, EXEC preflight, and
// dispatch-receipt verification. Adapters transport this helper's output;
// they do not reimplement policy or WI grammar.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { WI_ID_BODY, WI_ID_RE, isValidWiId } from "../hooks/lib/wi-id.mjs";
import { resolveDispatchModel } from "./resolve-dispatch.mjs";

const AUTHORIZED_STATES = new Set(["PROMOTED", "PROMOTED_WITH_DISPUTES", "REVISED_AND_REVIEWED"]);
const WI_LOCATOR = new RegExp(`(?:^|[^A-Za-z0-9])(${WI_ID_BODY})(?![A-Za-z0-9])`, "g");
const STRUCTURED_FIELD = /^\s*(?:\|\s*)?(?:\*{0,2}|_{0,2})(Work item|WI)(?:\*{0,2}|_{0,2})\s*[:|]\s*(.*)$/i;
const DEFAULT_MAX_AGE_SECONDS = 21600;

function fail(message, code = 1) {
  const error = new Error(message);
  error.exitCode = code;
  throw error;
}

function sha256(value) {
  return crypto.createHash("sha256").update(Buffer.isBuffer(value) ? value : String(value)).digest("hex");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractTokens(text) {
  if (typeof text !== "string" || !text) return [];
  const found = [];
  const locator = new RegExp(WI_LOCATOR.source, WI_LOCATOR.flags);
  let match;
  while ((match = locator.exec(text))) found.push(match[1]);
  return unique(found);
}

function extractStructuredTokens(text) {
  const found = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const matched = line.match(STRUCTURED_FIELD);
    if (!matched) continue;
    found.push(...extractTokens(matched[2] || ""));
  }
  return unique(found);
}

function realpathOrResolve(target) {
  try {
    return fs.realpathSync(target);
  } catch {
    return path.resolve(target);
  }
}

function containedPath(root, target, label) {
  const realRoot = realpathOrResolve(root);
  const resolved = path.isAbsolute(target) ? path.resolve(target) : path.resolve(realRoot, target);
  const real = realpathOrResolve(resolved);
  if (real !== realRoot && !real.startsWith(`${realRoot}${path.sep}`)) {
    fail(`${label} escapes repo root ${realRoot}: ${target}`, 4);
  }
  return real;
}

function repoRelative(root, target) {
  const realRoot = realpathOrResolve(root);
  const real = containedPath(root, target, "path");
  return path.relative(realRoot, real).split(path.sep).join("/");
}

function currentBranch(repo) {
  try {
    return execFileSync("git", ["-C", repo, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function formatCandidates(values) {
  return values.join(" ");
}

export function bindPlan({ repo, manifest } = {}) {
  if (!repo || !manifest) fail("usage: resolve-execute-dispatch.mjs bind-plan --repo <root> --manifest <path>", 2);
  const repoRoot = realpathOrResolve(repo);
  if (!fs.existsSync(repoRoot) || !fs.statSync(repoRoot).isDirectory()) fail(`repo is unreadable: ${repo}`, 2);
  const manifestPath = containedPath(repoRoot, manifest, "manifest");
  if (!fs.existsSync(manifestPath) || !fs.statSync(manifestPath).isFile()) fail(`manifest is unreadable: ${manifest}`, 2);
  const manifestBytes = fs.readFileSync(manifestPath);
  const manifestText = manifestBytes.toString("utf8");
  const branch = currentBranch(repoRoot);
  const branchCandidates = extractTokens(branch);
  const structuredCandidates = extractStructuredTokens(manifestText);
  const fallbackCandidates = structuredCandidates.length ? [] : extractTokens(manifestText);
  const manifestCandidates = structuredCandidates.length ? structuredCandidates : fallbackCandidates;

  if (branchCandidates.length > 1) {
    fail(`bind-plan: cannot derive exactly one authoritative WI (found ${branchCandidates.length}: ${formatCandidates(branchCandidates)}); refusing plan review before any provider call. Branch candidates disagree.`, 4);
  }
  if (manifestCandidates.length > 1) {
    fail(`bind-plan: cannot derive exactly one authoritative WI (found ${manifestCandidates.length}: ${formatCandidates(manifestCandidates)}); refusing plan review before any provider call.`, 4);
  }
  if (branchCandidates.length === 1 && manifestCandidates.length === 1 && branchCandidates[0] !== manifestCandidates[0]) {
    fail(`bind-plan: derived WI ${branchCandidates[0]} does not appear in the plan (${manifestCandidates[0]}); refusing to bind a stale/reused branch WI. Distinct candidates: branch=${branchCandidates[0]} manifest=${manifestCandidates[0]}.`, 4);
  }
  const wi = branchCandidates[0] || manifestCandidates[0] || "";
  if (!wi || !isValidWiId(wi)) {
    fail(`bind-plan: cannot derive exactly one authoritative WI (found 0: ); refusing plan review before any provider call. Use an unambiguous WI branch or plan, or run review-exec if implementation has begun.`, 4);
  }
  return {
    schema_version: 1,
    wi,
    manifest: repoRelative(repoRoot, manifestPath),
    manifest_sha256: sha256(manifestBytes),
    branch,
  };
}

function listActivePlanDirs(repoRoot) {
  const plansRoot = path.join(repoRoot, "docs", "plans");
  if (!fs.existsSync(plansRoot)) return [];
  const dirs = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      const rel = path.relative(path.join(repoRoot, "docs", "plans"), full).split(path.sep).join("/");
      if (rel === "done" || rel.startsWith("done/")) continue;
      dirs.push(full);
      walk(full);
    }
  };
  walk(plansRoot);
  return dirs;
}

function findManifestsInDir(dir) {
  const names = ["manifest.md", "plan.md"];
  const found = [];
  for (const name of names) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) found.push(candidate);
  }
  try {
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith(".md")) continue;
      const candidate = path.join(dir, entry);
      if (fs.statSync(candidate).isFile() && !found.includes(candidate)) found.push(candidate);
    }
  } catch {}
  return found;
}

function manifestBoundToWi(manifestPath, wi) {
  const text = fs.readFileSync(manifestPath, "utf8");
  const structured = extractStructuredTokens(text);
  if (structured.length) return structured.length === 1 && structured[0] === wi;
  const fallback = extractTokens(text);
  return fallback.length === 1 && fallback[0] === wi;
}

function parseTerminalState(reviewLogPath) {
  const text = fs.readFileSync(reviewLogPath, "utf8");
  const lines = text.split(/\r?\n/).filter((line) => /^\s*terminal_state\s*:/.test(line));
  if (lines.length !== 1) fail(`preflight: review log must contain exactly one terminal_state line: ${reviewLogPath}`, 1);
  const state = lines[0].replace(/^\s*terminal_state\s*:\s*/, "").trim().replace(/^["']|["']$/g, "");
  return { state, bytes: fs.readFileSync(reviewLogPath), text };
}

function parseOverrideFile(file) {
  if (!file) return null;
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) fail(`override file is unreadable: ${file}`, 1);
  const bytes = fs.readFileSync(absolute);
  const text = bytes.toString("utf8");
  let accept = false;
  let reason = "";
  try {
    const json = JSON.parse(text);
    accept = json.accept === true || json.accepted === true;
    reason = String(json.reason || "");
  } catch {
    accept = /^\s*accept\s*:\s*true\s*$/im.test(text);
    const reasonLine = text.split(/\r?\n/).find((line) => /^\s*reason\s*:/.test(line));
    reason = reasonLine ? reasonLine.replace(/^\s*reason\s*:\s*/, "").trim() : "";
  }
  if (!accept) fail("override file is present but not accepted", 1);
  if (!reason) fail("accepted override requires a reason", 1);
  return { path: absolute, reason, sha256: sha256(bytes) };
}

function compactDispatch({ wi, reviewLog, reviewLogSha, policyPath, policySha, mode, tuple }) {
  return {
    schema_version: 2,
    decision: "dispatch",
    wi,
    review_log: reviewLog,
    review_log_sha256: reviewLogSha,
    policy: policyPath,
    policy_sha256: policySha,
    mode,
    host: tuple.host,
    family: tuple.family,
    model: tuple.model,
    effort: tuple.effort,
    orchestrator: tuple.orchestrator,
  };
}

export function preflight({
  repo,
  wi,
  policy = null,
  mode = null,
  orchestrator = null,
  allowOverrideFile = null,
} = {}) {
  if (!repo || !wi) fail("usage: resolve-execute-dispatch.mjs preflight --repo <root> --wi <WI> [--policy <path>] [--mode <mode>] [--orchestrator <host>] [--allow-override-file <path>]", 2);
  if (!isValidWiId(wi)) fail(`preflight: WI is not canonical: ${wi}`, 4);
  const repoRoot = realpathOrResolve(repo);
  const matches = [];
  for (const dir of listActivePlanDirs(repoRoot)) {
    const manifests = findManifestsInDir(dir).filter((file) => manifestBoundToWi(file, wi));
    if (!manifests.length) continue;
    const reviewLog = path.join(dir, "review-log.yaml");
    if (!fs.existsSync(reviewLog) || !fs.statSync(reviewLog).isFile()) continue;
    matches.push({ dir, manifests, reviewLog });
  }
  if (matches.length === 0) fail(`preflight: no active review log structured-bound to ${wi}`, 1);
  if (matches.length > 1) {
    fail(`preflight: two matching active logs for ${wi}: ${matches.map((row) => repoRelative(repoRoot, row.reviewLog)).join(" ")}`, 1);
  }
  const selected = matches[0];
  const parsed = parseTerminalState(selected.reviewLog);
  if (!AUTHORIZED_STATES.has(parsed.state)) {
    fail(`preflight: review log terminal_state ${parsed.state} is not execution-authorized for ${wi}`, 1);
  }
  const reviewRel = repoRelative(repoRoot, selected.reviewLog);
  const reviewSha = sha256(parsed.bytes);
  if (allowOverrideFile) {
    const override = parseOverrideFile(allowOverrideFile);
    return {
      schema_version: 2,
      decision: "owner-override",
      wi,
      override_sha256: override.sha256,
      reason: override.reason,
      review_log: reviewRel,
      review_log_sha256: reviewSha,
    };
  }
  const resolved = resolveDispatchModel({
    label: "EXEC",
    configPath: policy || process.env.SVC_DISPATCH_POLICY || null,
    mode: mode || null,
    orchestrator: orchestrator || process.env.SVC_HOST || null,
    wi,
    cwd: repoRoot,
  });
  return compactDispatch({
    wi,
    reviewLog: reviewRel,
    reviewLogSha: reviewSha,
    policyPath: resolved.config_path,
    policySha: resolved.config_sha256,
    mode: resolved.mode,
    tuple: resolved.tuple,
  });
}

function readDispatchRows(file) {
  if (!fs.existsSync(file)) return [];
  const rows = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      continue;
    }
  }
  return rows;
}

export function verifyReceipt({
  repo,
  wi,
  policy = null,
  orchestrator = null,
  maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS,
  allowOverrideFile = null,
} = {}) {
  if (!repo || !wi) fail("usage: resolve-execute-dispatch.mjs verify-receipt --repo <root> --wi <WI> [--max-age-seconds 21600]", 2);
  const repoRoot = realpathOrResolve(repo);
  const expected = preflight({ repo: repoRoot, wi, policy, orchestrator });
  const logPath = path.join(repoRoot, ".svc", "dispatch-log.jsonl");
  const cutoff = Date.now() - Number(maxAgeSeconds) * 1000;
  const rows = readDispatchRows(logPath);
  const override = allowOverrideFile ? parseOverrideFile(allowOverrideFile) : null;
  for (const row of rows.slice().reverse()) {
    if (!row || typeof row !== "object") continue;
    if (row.wi !== wi) continue;
    if (row.skill !== "execute-changeset") continue;
    const ts = Date.parse(row.ts || "");
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    if (row.exit_code !== 0) continue;
    if (row.schema_version !== 2) continue;
    if (row.decision === "owner-override") {
      if (!override) continue;
      if (row.override_sha256 !== override.sha256) continue;
      if (row.review_log_sha256 !== expected.review_log_sha256) continue;
      if (typeof row.reason !== "string" || !row.reason) continue;
      return { ok: true, decision: "owner-override", wi, review_log_sha256: expected.review_log_sha256, override_sha256: override.sha256 };
    }
    if (row.decision !== "dispatch") continue;
    if (row.policy_sha256 !== expected.policy_sha256) continue;
    if (row.review_log_sha256 !== expected.review_log_sha256) continue;
    if (row.host !== expected.host || row.family !== expected.family || row.model !== expected.model || row.effort !== expected.effort) continue;
    return { ok: true, decision: "dispatch", wi, host: expected.host, family: expected.family, model: expected.model, effort: expected.effort };
  }
  fail(`verify-receipt: no recent exact dispatch evidence for ${wi} (expected ${expected.host}/${expected.family}/${expected.model}/${expected.effort} policy=${expected.policy_sha256.slice(0, 12)} review=${expected.review_log_sha256.slice(0, 12)})`, 1);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) fail(`unsupported argument ${token}`, 2);
    const key = token.slice(2);
    const next = rest[index + 1];
    if (next === undefined || next.startsWith("--")) {
      options[key] = "true";
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return { command, options };
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function cli() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === "bind-plan") {
    printJson(bindPlan({ repo: options.repo, manifest: options.manifest }));
    return;
  }
  if (command === "preflight") {
    printJson(preflight({
      repo: options.repo,
      wi: options.wi,
      policy: options.policy || null,
      mode: options.mode || null,
      orchestrator: options.orchestrator || null,
      allowOverrideFile: options["allow-override-file"] || null,
    }));
    return;
  }
  if (command === "verify-receipt") {
    printJson(verifyReceipt({
      repo: options.repo,
      wi: options.wi,
      policy: options.policy || null,
      orchestrator: options.orchestrator || null,
      maxAgeSeconds: options["max-age-seconds"] || DEFAULT_MAX_AGE_SECONDS,
      allowOverrideFile: options["allow-override-file"] || null,
    }));
    return;
  }
  fail("usage: resolve-execute-dispatch.mjs bind-plan|preflight|verify-receipt ...", 2);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    cli();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = error.exitCode || 1;
  }
}

export { WI_ID_RE, extractTokens, extractStructuredTokens };

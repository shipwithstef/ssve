#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { appendJsonlLine, readJsonAtomic, writeJsonAtomic } from "./state-io.mjs";

// OPT-13: rapid tool loops re-diagnose the same text repeatedly. Skip
// re-scoring the registry when an identical-text diagnosis ran <60s ago;
// still runs the ledger-write side effect (--ledger) normally, marking the
// reused result memoized. Cache is machine-local, best-effort (fail-open).
const MEMO_TTL_MS = 60_000;

function memoCachePath(root) {
  return path.join(root, ".svc", "diagnose-capability-cache.json");
}

function readMemo(root, textHash) {
  try {
    const cache = readJsonAtomic(memoCachePath(root));
    const entry = cache?.[textHash];
    if (!entry || typeof entry.ts !== "string") return null;
    const ageMs = Date.now() - Date.parse(entry.ts);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs >= MEMO_TTL_MS) return null;
    return { entry, ageMs };
  } catch {
    return null; // fail-open: memoization is an optimization, never a gate
  }
}

function writeMemo(root, textHash, registryPath, matches, primary) {
  try {
    const cache = readJsonAtomic(memoCachePath(root)) || {};
    cache[textHash] = { ts: new Date().toISOString(), registryPath, matches, primary };
    writeJsonAtomic(memoCachePath(root), cache);
  } catch {
    // best-effort; never blocks diagnosis
  }
}

function parseArgs(argv) {
  const args = { text: "", file: "", root: process.cwd(), registry: "", ledger: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--text") args.text = argv[++i] || "";
    else if (arg === "--file") args.file = argv[++i] || "";
    else if (arg === "--root") args.root = path.resolve(argv[++i] || ".");
    else if (arg === "--registry") args.registry = path.resolve(argv[++i] || "");
    else if (arg === "--ledger") args.ledger = argv[++i] || "";
    else if (arg === "--state") args.state = argv[++i] || "";
    else if (arg === "--wi") args.wi = argv[++i] || "";
    else if (arg === "--source") args.source = argv[++i] || "";
    else if (arg === "--owner-skill") args.ownerSkill = argv[++i] || "";
    else if (arg === "--false-positive-reason") args.falsePositiveReason = argv[++i] || "";
    else if (arg === "--blocked-on") args.blockedOn = argv[++i] || "";
    else if (arg === "--recovery-action") args.recoveryAction = argv[++i] || "";
    else if (arg === "--recovery-result") args.recoveryResult = argv[++i] || "";
    else if (arg === "--evidence") {
      args.evidence ||= [];
      args.evidence.push(argv[++i] || "");
    }
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

function usage() {
  return "Usage: node scripts/diagnose-capability-blocker.mjs --text <request> [--root <dir>] [--registry <file>] [--ledger .svc/capability-blockers.jsonl --state detected|recovered|blocked-on-user|false-positive --wi WI-123]";
}

function loadRegistry(args) {
  const registryPath = args.registry || path.join(args.root, "references", "capability-blockers.json");
  const parsed = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  if (parsed.schema !== 1 || !Array.isArray(parsed.classes)) {
    throw new Error(`Invalid capability blocker registry: ${registryPath}`);
  }
  return { registryPath, registry: parsed };
}

function scoreClass(entry, text) {
  const hits = [];
  for (const signal of entry.signals || []) {
    if (text.includes(signal.toLowerCase())) hits.push(signal);
  }
  return hits;
}

function ledgerEntry({ args, registryPath, primary, matches, text }) {
  if (!primary) return null;
  const ts = new Date().toISOString();
  const state = args.state || "detected";
  const entry = {
    schema: 1,
    ts,
    source: args.source || "diagnose-capability-blocker",
    state,
    blocker_id: primary.id,
    route_to: primary.route_to,
    owner_skill: args.ownerSkill || primary.route_to,
    matched_signals: primary.matched_signals,
    diagnosis: primary.diagnosis,
    registry: path.relative(args.root, registryPath) || registryPath,
  };
  if (args.wi) entry.wi = args.wi;
  if (String(text || "").trim()) entry.source_text = String(text).slice(0, 500);
  if (matches.length > 1) entry.alternative_blocker_ids = matches.slice(1).map((match) => match.id);
  if (args.evidence?.filter(Boolean).length) entry.evidence = args.evidence.filter(Boolean);
  if (state === "recovered") {
    entry.recovery_attempts = [{
      ts,
      action: args.recoveryAction || "not specified",
      result: args.recoveryResult || "recovered",
      evidence: args.evidence?.filter(Boolean) || [],
    }];
  }
  if (state === "blocked-on-user") entry.blocked_on = args.blockedOn || "user input required";
  if (state === "false-positive") entry.false_positive_reason = args.falsePositiveReason || "not specified";
  return entry;
}

const args = parseArgs(process.argv.slice(2));
if (args.ledger) args.ledger = path.resolve(args.root, args.ledger);
if (args.help) {
  console.log(usage());
  process.exit(0);
}

let text = args.text;
if (!text && args.file) text = fs.readFileSync(args.file, "utf8");
if (!text && !process.stdin.isTTY) text = fs.readFileSync(0, "utf8");

const normalized = String(text || "").toLowerCase();
// Key on text AND the resolved registry path — a rapid loop that switches
// --registry between calls must not reuse a memo scored against a different
// registry (cheap to include; loadRegistry's own resolution logic mirrored).
const resolvedRegistryPath = args.registry || path.join(args.root, "references", "capability-blockers.json");
const textHash = createHash("sha256").update(`${resolvedRegistryPath}|${normalized}`).digest("hex");
const memo = readMemo(args.root, textHash);

let registryPath, matches, primary, memoized = false;
if (memo) {
  ({ registryPath, matches, primary } = memo.entry);
  memoized = true;
} else {
  const loaded = loadRegistry(args);
  registryPath = loaded.registryPath;
  matches = loaded.registry.classes
    .map((entry) => ({ ...entry, matched_signals: scoreClass(entry, normalized) }))
    .filter((entry) => entry.matched_signals.length > 0)
    .sort((a, b) => b.matched_signals.length - a.matched_signals.length)
    .map((entry) => ({
      id: entry.id,
      route_to: entry.route_to,
      diagnosis: entry.diagnosis,
      matched_signals: entry.matched_signals
    }));
  primary = matches[0] || null;
  writeMemo(args.root, textHash, registryPath, matches, primary);
}

const result = {
  schema: 1,
  registry: registryPath,
  blocker_detected: Boolean(primary),
  primary,
  matches,
  ...(memoized ? { memoized: true, memoized_age_ms: memo.ageMs } : {}),
};

if (args.ledger && primary) {
  const entry = ledgerEntry({ args, registryPath, primary, matches, text });
  appendJsonlLine(args.ledger, entry);
  result.ledger_entry = entry;
}

console.log(JSON.stringify(result, null, 2));

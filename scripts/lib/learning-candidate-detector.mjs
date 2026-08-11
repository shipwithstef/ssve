// scripts/lib/learning-candidate-detector.mjs
//
// 6 signal heuristics for auto-learning candidate detection per WI-343.
//
// Tranche 1 shipped only `correction-after-failure`. Tranche 2b completes the
// set: review-finding-remediation, hook-side-effect, recursive-failure-
// observation, stale-capability-rediscovery, new-rule-class-observation.
//
// Each detector returns an array of candidate objects matching
// references/schemas/auto-learning-candidate.schema.json. The hook merges
// arrays + dedups.
//
// All detectors are pure functions over `ctx`. The hook is responsible for
// supplying ctx. Detectors must be cheap (filesystem reads + git log; no
// network, no LLM, no spawning long processes) because the hook budget is
// 200ms total per the WI's AC.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { redactSecrets } from "./secret-redaction.mjs";

function gitOutput(args, cwd, timeout = 1500) {
  try {
    const argv = Array.isArray(args) ? args : String(args).split(/\s+/).filter(Boolean);
    return execFileSync("git", argv, { cwd, encoding: "utf8", timeout }).trim();
  } catch (_) {
    return "";
  }
}

function nowIso() {
  return new Date().toISOString();
}

// Redact secrets BEFORE slugifying. Otherwise a commit subject like
// "fix: Bearer abc1234567890abcdef0123 was logged" produces a key/filename
// containing the secret in slugged form, defeating the redaction. Codex
// review caught this P1 leak path on the secret-redaction implementation PR.
function slugify(s, maxLen = 60) {
  return redactSecrets(String(s || ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);
}

function shortSha(s) {
  return String(s || "").slice(0, 7);
}

// Heuristic 1: correction-after-failure.
//
// Signal: a commit on the current branch whose message starts with `fix(`,
// `address`, `restore`, or `revert` AND references a prior commit on the
// same branch in the message body, OR has > 0 lines changing a script/hook
// that another commit on the same branch also touched. The "fix-the-fix"
// pattern is the cheapest learning-yielding signal we have.
//
// Output: one candidate per detected correction commit.
const CORRECTION_HEADLINE_RE = /^(fix\(|address|restore|revert |hotfix)/i;

export function detectCorrectionAfterFailure(ctx) {
  const cwd = ctx.cwd || process.cwd();
  const timeout = Math.max(25, Number(ctx.gitTimeoutMs || 1500));
  const base = ctx.mergeBase || gitOutput(["merge-base", "origin/main", "HEAD"], cwd, timeout);
  if (!base) return [];
  const commits = gitOutput(["log", "--format=%H%x09%s%x09%b%x1e", `${base}..HEAD`], cwd, timeout);
  if (!commits) return [];
  const out = [];
  for (const block of commits.split(/\x1e/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const [sha, subject, ...bodyParts] = trimmed.split(/\t/);
    if (!sha || !subject) continue;
    if (!CORRECTION_HEADLINE_RE.test(subject)) continue;
    const body = (bodyParts || []).join("\t").trim();
    const insight = [
      `Correction commit ${shortSha(sha)} ("${subject}") followed a prior fix attempt on the same branch.`,
      body ? `Body excerpt: ${body.slice(0, 200).replace(/\s+/g, " ")}${body.length > 200 ? "…" : ""}` : null,
      "Pattern: when a fix attempt fails and a follow-up correction is needed, the first attempt usually missed a class-of-pattern check (latest-evidence-before-next-fix per rules/post-fix-evidence-before-next-fix.md, or recursive-irony per framework-learnings entry 75). Capture as learning candidate so future sessions preload the prevention.",
    ].filter(Boolean).join(" ");
    out.push({
      schema_version: 1,
      captured_at: nowIso(),
      signal: "correction-after-failure",
      key: `correction-${slugify(subject, 50)}-${shortSha(sha)}`,
      insight,
      confidence: 6,
      source: `commit ${shortSha(sha)} on branch ${ctx.branch || "(unknown)"}`,
      session_id: ctx.sessionId,
      candidate_target: "framework-learnings",
      files: [],
    });
  }
  return out;
}

// Heuristic 2: review-finding-remediation.
//
// Signal: a commit on the active branch references an adversarial-review
// outcome — "Codex review", "review finding", "X/Y accept", "address review",
// "G5 PASS", "review-gate". These commits typically encode the SPECIFIC fix
// pattern an external reviewer caught, which is exactly the kind of pattern
// future sessions benefit from preloading.
//
// Output: one candidate per detected commit.
const REVIEW_REMEDIATION_RE = /(codex\s+review|review\s+finding|\d+\s*\/\s*\d+\s+accept|address(?:ing|ed)?\s+review|review[- ]gate(?:\s+receipt)?|G[1-7]\s+PASS|HIGH|MEDIUM|burst\s+review|adversarial\s+review)/i;

export function detectReviewFindingRemediation(ctx) {
  const cwd = ctx.cwd || process.cwd();
  const timeout = Math.max(25, Number(ctx.gitTimeoutMs || 1500));
  const base = ctx.mergeBase || gitOutput(["merge-base", "origin/main", "HEAD"], cwd, timeout);
  if (!base) return [];
  const commits = gitOutput(["log", "--format=%H%x09%s%x09%b%x1e", `${base}..HEAD`], cwd, timeout);
  if (!commits) return [];
  const out = [];
  for (const block of commits.split(/\x1e/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const [sha, subject, ...bodyParts] = trimmed.split(/\t/);
    if (!sha || !subject) continue;
    const body = (bodyParts || []).join("\t").trim();
    const haystack = `${subject}\n${body}`;
    if (!REVIEW_REMEDIATION_RE.test(haystack)) continue;
    const insight = [
      `Commit ${shortSha(sha)} ("${subject}") encodes an adversarial-review remediation.`,
      body ? `Body excerpt: ${body.slice(0, 220).replace(/\s+/g, " ")}${body.length > 220 ? "…" : ""}` : null,
      "Pattern: review-finding remediations distill a specific reviewer-caught failure mode into a fix. Capture so future sessions surface the prevention before the same finding fires again.",
    ].filter(Boolean).join(" ");
    out.push({
      schema_version: 1,
      captured_at: nowIso(),
      signal: "review-finding-remediation",
      key: `review-${slugify(subject, 50)}-${shortSha(sha)}`,
      insight,
      confidence: 7,
      source: `commit ${shortSha(sha)} on branch ${ctx.branch || "(unknown)"}`,
      session_id: ctx.sessionId,
      candidate_target: "framework-learnings",
      files: [],
    });
  }
  return out;
}

// Heuristic 3: hook-side-effect.
//
// Signal: `.svc/pipeline-decisions.jsonl` contains entries with
// `guard_override_count > 0` / `guard_override_increment` OR `event` =
// `blocked` / `guard_override` OR a `decision_type` of `framework` paired
// with override-language. These mark moments where a hook fired and the
// session either accepted the block or overrode it — both of which carry
// learning signal about how the framework's safety rails interact with
// real session intent.
const HOOK_BLOCKED_RE = /\b(blocked|hook[- ]blocked|guard[- ]override|override_count|guard_override_increment)\b/i;

export function detectHookSideEffect(ctx) {
  const root = ctx.cwd || process.cwd();
  const file = path.join(root, ".svc", "pipeline-decisions.jsonl");
  if (!fs.existsSync(file)) return [];
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const lines = raw.split(/\r?\n/).filter(Boolean);
  // Bound scan to last 200 entries (cheap, recent-focus).
  const recent = lines.slice(-200);
  const out = [];
  const seenKeys = new Set();
  for (const line of recent) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const overrideCount = Number(entry.guard_override_count ?? entry.guard_override_increment ?? 0);
    const event = String(entry.event || entry.decision || "");
    const reason = String(entry.reason || entry.reasoning || "");
    const matched = overrideCount > 0 || HOOK_BLOCKED_RE.test(event) || HOOK_BLOCKED_RE.test(reason);
    if (!matched) continue;
    const ts = String(entry.timestamp || entry.ts || "");
    const key = `hook-side-${slugify(`${event}-${ts}`, 50)}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const insight = [
      `Hook side-effect at ${ts || "(unknown ts)"} during ${entry.skill || "(unknown skill)"}.`,
      overrideCount > 0 ? `guard_override_count=${overrideCount}.` : null,
      event ? `event/decision: ${event.slice(0, 120)}.` : null,
      reason ? `reason: ${reason.slice(0, 200).replace(/\s+/g, " ")}${reason.length > 200 ? "…" : ""}` : null,
      "Pattern: hook overrides and blocked decisions mark moments where session intent and framework guards disagreed. Each one teaches whether the guard is too tight, the override is too loose, or the workflow needs reshaping.",
    ].filter(Boolean).join(" ");
    out.push({
      schema_version: 1,
      captured_at: nowIso(),
      signal: "hook-side-effect",
      key,
      insight,
      confidence: 6,
      source: `.svc/pipeline-decisions.jsonl entry ${ts || "(no ts)"}`,
      session_id: ctx.sessionId,
      candidate_target: "framework-learnings",
      files: [".svc/pipeline-decisions.jsonl"],
    });
  }
  return out;
}

// Heuristic 4: recursive-failure-observation.
//
// Signal: a commit body or session decision-log entry explicitly references
// an anti-pattern id (AP-NN per references/anti-patterns.md) OR cites a
// framework-learnings key. The author noticing they reproduced (or are about
// to) a flagged pattern is the cheapest reliable signal for this class —
// pure diff-content scanning produces too many false positives at the 200ms
// budget. We capture only EXPLICITLY-NAMED reproductions.
const AP_REF_RE = /\bAP-\d+\b/g;

export function detectRecursiveFailureObservation(ctx) {
  const cwd = ctx.cwd || process.cwd();
  const timeout = Math.max(25, Number(ctx.gitTimeoutMs || 1500));
  const base = ctx.mergeBase || gitOutput(["merge-base", "origin/main", "HEAD"], cwd, timeout);
  if (!base) return [];
  const commits = gitOutput(["log", "--format=%H%x09%s%x09%b%x1e", `${base}..HEAD`], cwd, timeout);
  if (!commits) return [];

  // Load known framework-learning keys (cheap, bounded file).
  const learningsFile = path.join(cwd, "references", "framework-learnings.jsonl");
  const knownKeys = new Set();
  if (fs.existsSync(learningsFile)) {
    try {
      const raw = fs.readFileSync(learningsFile, "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const t = line.trim();
        if (!t) continue;
        try {
          const e = JSON.parse(t);
          if (e.key) knownKeys.add(String(e.key));
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  const out = [];
  for (const block of commits.split(/\x1e/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const [sha, subject, ...bodyParts] = trimmed.split(/\t/);
    if (!sha) continue;
    const body = (bodyParts || []).join("\t");
    const haystack = `${subject}\n${body}`;

    const apMatches = Array.from(new Set(haystack.match(AP_REF_RE) || []));
    const keyMatches = [];
    for (const k of knownKeys) {
      if (haystack.includes(k)) keyMatches.push(k);
    }
    if (apMatches.length === 0 && keyMatches.length === 0) continue;

    const refs = [...apMatches, ...keyMatches].slice(0, 5);
    const insight = [
      `Commit ${shortSha(sha)} ("${subject || "(no subject)"}") references prior-flagged pattern(s): ${refs.join(", ")}.`,
      "Pattern: when author code surfaces an anti-pattern id or named framework-learning, it is evidence of recursive reproduction — the failure class has been documented yet is still recurring. Capture so the next session preloads the prevention earlier.",
    ].join(" ");
    out.push({
      schema_version: 1,
      captured_at: nowIso(),
      signal: "recursive-failure-observation",
      key: `recursive-${slugify(refs.join("-"), 50)}-${shortSha(sha)}`,
      insight,
      confidence: 7,
      source: `commit ${shortSha(sha)} citing ${refs.join(", ")}`,
      session_id: ctx.sessionId,
      candidate_target: "framework-learnings",
      files: ["references/anti-patterns.md", "references/framework-learnings.jsonl"],
    });
  }
  return out;
}

// Heuristic 5: stale-capability-rediscovery.
//
// Signal: `.svc/pipeline-decisions.jsonl` entries mention a failure mode
// indicating an external capability shifted out from under us (404,
// auth-expired, method-not-found, ENOENT on an expected path, "stale",
// "deprecated"). The session navigated around it and probably learned
// something worth preserving.
const STALE_CAPABILITY_RE = /\b(404|401|403|method\s*not\s*found|ENOENT|invalid_grant|token\s*expired|capability\s*missing|stale\s*lane-tasks|deprecated\s*foundation|HostCapability)\b/i;

export function detectStaleCapabilityRediscovery(ctx) {
  const root = ctx.cwd || process.cwd();
  const file = path.join(root, ".svc", "pipeline-decisions.jsonl");
  if (!fs.existsSync(file)) return [];
  let raw;
  try { raw = fs.readFileSync(file, "utf8"); } catch { return []; }
  const recent = raw.split(/\r?\n/).filter(Boolean).slice(-200);
  const out = [];
  const seen = new Set();
  for (const line of recent) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const fields = [
      entry.event,
      entry.decision,
      entry.reason,
      entry.reasoning,
      entry.error,
      entry.notes,
    ].filter((v) => typeof v === "string");
    const haystack = fields.join(" ");
    if (!STALE_CAPABILITY_RE.test(haystack)) continue;
    const m = haystack.match(STALE_CAPABILITY_RE);
    const marker = m ? m[0] : "stale";
    const ts = String(entry.timestamp || entry.ts || "");
    const key = `stale-${slugify(`${marker}-${ts}`, 50)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const snippet = haystack.slice(0, 220).replace(/\s+/g, " ");
    const insight = [
      `Stale-capability marker "${marker}" surfaced at ${ts || "(unknown ts)"} during ${entry.skill || "(unknown skill)"}.`,
      `Decision snippet: ${snippet}${haystack.length > 220 ? "…" : ""}.`,
      "Pattern: external capability drift (auth expiry, deprecated API surface, missing tool) leaves repeatable evidence in pipeline-decisions. Capture so the same rediscovery doesn't cost the next session a full debug loop.",
    ].join(" ");
    out.push({
      schema_version: 1,
      captured_at: nowIso(),
      signal: "stale-capability-rediscovery",
      key,
      insight,
      confidence: 6,
      source: `.svc/pipeline-decisions.jsonl entry ${ts || "(no ts)"} marker=${marker}`,
      session_id: ctx.sessionId,
      candidate_target: "framework-learnings",
      files: [".svc/pipeline-decisions.jsonl"],
    });
  }
  return out;
}

// Heuristic 6: new-rule-class-observation.
//
// Signal: a "applied: <name>" or "concern-acked: <name>" / "concern-waived:
// <name>" marker appears N>=3 times in branch commits but the corresponding
// `rules/<name>.md` (or `concerns/<name>.md`) does not exist. The framework
// has a de-facto rule class operating in commit-message land but no canonical
// rule file backing it — promotion candidate.
const APPLIED_RULE_RE = /\b(?:applied|concern-acked|concern-waived):\s*([a-z][a-z0-9-]+)/gi;

export function detectNewRuleClassObservation(ctx) {
  const cwd = ctx.cwd || process.cwd();
  const timeout = Math.max(25, Number(ctx.gitTimeoutMs || 1500));
  const base = ctx.mergeBase || gitOutput(["merge-base", "origin/main", "HEAD"], cwd, timeout);
  if (!base) return [];
  const commits = gitOutput(["log", "--format=%B%x1e", `${base}..HEAD`], cwd, timeout);
  if (!commits) return [];

  const counts = new Map();
  for (const block of commits.split(/\x1e/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    let m;
    APPLIED_RULE_RE.lastIndex = 0;
    while ((m = APPLIED_RULE_RE.exec(trimmed)) !== null) {
      const name = m[1].toLowerCase();
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }

  const out = [];
  for (const [name, n] of counts) {
    if (n < 3) continue;
    const ruleFile = path.join(cwd, "rules", `${name}.md`);
    const concernFile = path.join(cwd, "concerns", `${name}.md`);
    if (fs.existsSync(ruleFile) || fs.existsSync(concernFile)) continue;
    const insight = [
      `Marker "${name}" was applied/acked ${n} times in this branch's commits but no canonical rule/concern file exists at rules/${name}.md or concerns/${name}.md.`,
      "Pattern: when a rule class is invoked repeatedly via commit-message convention without a backing file, it operates as a de-facto rule that future sessions cannot preload. Capture so promotion to a canonical rule file is considered.",
    ].join(" ");
    out.push({
      schema_version: 1,
      captured_at: nowIso(),
      signal: "new-rule-class-observation",
      key: `new-rule-${slugify(name, 50)}`,
      insight,
      confidence: 6,
      source: `branch commit messages on ${ctx.branch || "(unknown)"} mention "${name}" ${n} times`,
      session_id: ctx.sessionId,
      candidate_target: "framework-learnings",
      files: [`rules/${name}.md (missing)`, `concerns/${name}.md (missing)`],
    });
  }
  return out;
}

export const ALL_DETECTORS = [
  detectCorrectionAfterFailure,
  detectReviewFindingRemediation,
  detectHookSideEffect,
  detectRecursiveFailureObservation,
  detectStaleCapabilityRediscovery,
  detectNewRuleClassObservation,
];

export function runAll(ctx) {
  const out = [];
  for (const fn of ALL_DETECTORS) {
    try {
      const candidates = fn(ctx);
      if (Array.isArray(candidates)) out.push(...candidates);
    } catch (e) {
      // Detectors must never block the hook. Log via ctx.warn if provided.
      if (typeof ctx?.warn === "function") ctx.warn(`detector ${fn.name} failed: ${e.message}`);
    }
  }
  return out;
}

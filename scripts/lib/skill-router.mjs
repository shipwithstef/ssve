#!/usr/bin/env node
/**
 * scripts/lib/skill-router.mjs — WI-FW-SKILLS-ROUTING-01 Wave 2 shared router.
 *
 * Deterministic-first hybrid routing per plan §4.3-§4.6:
 *   1. deterministic pins (explicit name/alias, active task-graph state,
 *      next lane transition, concern-registry signals) resolve BEFORE any
 *      ranking and are never displaced by rank or budget;
 *   2. optional discovery: scope filter → exact resolver → lexical ranking
 *      (BM25-lite) → policy rerank → budget cut;
 *   3. semantic retrieval is a pluggable boundary that is unavailable in this
 *      wave and records degraded mode; it can never gate required material;
 *   4. every decision emits a normalized, privacy-safe result (schema:
 *      schemas/skill-router-decision.schema.json); receipts store a truncated
 *      intent fingerprint, never the raw prompt.
 *
 * Hermetic: no network calls anywhere in this module.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { appendJsonlLine } from "../state-io.mjs";

export const POLICY_VERSION = 1;

// Plan §4.6 budgets (initial measurable ceilings).
export const BUDGETS = Object.freeze({
  d0CeilingTokens: 1500,
  d1CeilingTokens: 1200,
  d1CeilingCards: 8,
});

// Confidence/margin gates for the conservative auto-invocation path (plan §4.5).
// Calibrated against the reviewed corpus; versioned with POLICY_VERSION.
const GATES = Object.freeze({ confidenceFloor: 30, winnerMargin: 5 });

const MODES = new Set(["off", "shadow", "suggest", "active"]);

// D0 kernel: the invariant routing/governance contract kept resident (plan §4.1).
export const KERNEL_TEXT = Object.freeze(
  [
    "svc routing kernel v1.",
    "Deterministic pins (explicit skill name, active task-graph state, next lane transition,",
    "concern-registry signals) always outrank ranked discovery and are never evicted by budget.",
    "Optional capability discovery may be probabilistic; critical domain governance may not.",
    "Invocation policies: required loads on its condition; implicit-allowed may auto-load once",
    "confidence and margin gates pass; suggest-only is advisory; explicit-only needs a named request.",
    "Never auto-invoke destructive, external-write, purchasing, communication-sending, legal-signature,",
    "credential, or production-deployment capabilities.",
    "Every decision carries reason codes and a privacy-safe receipt (fingerprinted intent only).",
    "Semantic retrieval is disposable acceleration: offline/degraded operation must remain fully safe.",
  ].join(" "),
);

function fail(message) {
  throw new Error(`skill-router: ${message}`);
}

function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

export function estimateTokens(text) {
  // Pinned local estimator (~4 chars/token) per plan §4.1 where hosts expose none.
  return Math.ceil(String(text || "").length / 4);
}

export function loadIndex(root) {
  const file = path.join(root, "references", "skill-routing-index.json");
  const raw = fs.readFileSync(file, "utf8");
  const index = JSON.parse(raw);
  if (index.schema_version !== 1) fail(`unsupported index schema_version ${index.schema_version}`);
  const byName = new Map();
  for (const rec of index.skills) {
    if (byName.has(rec.skill)) fail(`index has duplicate skill ${rec.skill}`);
    byName.set(rec.skill, rec);
  }
  return { index, byName, artifactHash: sha256Hex(raw) };
}

/** Verify the committed index still matches its canonical inputs (plan §4.2:
 * vectors/derived data are never accepted without matching source hashes).
 * Returns { fresh, drift[] }; advisory callers degrade, they do not crash. */
export function verifyIndexFreshness(root, index) {
  const read = (rel) => {
    try { return fs.readFileSync(path.join(root, rel)); } catch { return null; }
  };
  const pairs = [
    ["manifest_sha256", "skills-manifest.json"],
    ["overrides_sha256", path.join("references", "skill-routing-overrides.json")],
    ["concern_registry_sha256", path.join("concerns", "REGISTRY.json")],
  ];
  const drift = [];
  for (const [key, rel] of pairs) {
    const bytes = read(rel);
    const actual = bytes ? sha256Hex(bytes) : "missing";
    if (actual !== index.compiled_from?.[key]) drift.push(rel.split("\\").join("/"));
  }
  return { fresh: drift.length === 0, drift };
}

export function loadConcerns(root) {
  const file = path.join(root, "concerns", "REGISTRY.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Anchored glob→regex mirroring hooks/svc-rule-injector.mjs semantics. */
export function globToRe(glob) {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "\u0001")
    .replace(/\*\*/g, "\u0002")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/\u0001/g, "(?:.*/)?")
    .replace(/\u0002/g, ".*");
  return new RegExp("^" + esc + "$");
}

function normalize(text) {
  return String(text || "").toLowerCase().trim();
}

function tokenize(text) {
  return normalize(text).split(/[^a-z0-9]+/).filter((t) => t.length > 1);
}

/** Resolve a concern's declared signals against provided repo evidence.
 * Defensive against malformed signal shapes: a bad concern yields no match,
 * never a crash (advisory discovery fails open with diagnostics upstream). */
export function matchConcern(concern, evidence) {
  const sig = concern.signals || {};
  let matched = null;
  if (Array.isArray(sig.file_path_patterns)) {
    for (const pattern of sig.file_path_patterns) {
      // Signals come in two dialects (verified against svc-rule-injector):
      // glob patterns ("**/aup*") match anchored; bare substrings ("base44")
      // match anywhere in the path.
      // Evidence records the committed PATTERN that matched, never the
      // concrete caller path — receipts must not absorb raw user input.
      let hit = false;
      if (/[*?]/.test(pattern)) {
        let re;
        try { re = globToRe(pattern); } catch { continue; }
        hit = evidence.files.some((f) => re.test(f));
      } else {
        hit = evidence.files.some((f) => f.includes(pattern));
      }
      if (hit) matched = matched || `pattern:${pattern}`;
    }
  }
  const pkgSignals = sig.packages_imported;
  if (pkgSignals && typeof pkgSignals === "object" && !Array.isArray(pkgSignals)) {
    for (const pkg of Object.keys(pkgSignals)) {
      if (evidence.packages.includes(pkg)) matched = matched || `package:${pkg}`;
    }
  }
  const envSignals = sig.env_vars_referenced;
  if (envSignals && typeof envSignals === "object" && !Array.isArray(envSignals)) {
    for (const envVar of Object.keys(envSignals)) {
      if (evidence.env.includes(envVar)) matched = matched || `env:${envVar}`;
    }
  }
  return matched;
}

/** Deterministic pins — plan §4.3. Returns Map<skill, evidence[]> plus rules[]. */
export function resolvePins({ root, index, byName, intent, evidence, activeSkill, nextSkill }) {
  const pins = new Map();
  const rules = [];
  const addPin = (name, why) => {
    if (!byName.has(name)) return; // unknown names surface as diagnostics, never crash
    const list = pins.get(name) || [];
    list.push(why);
    pins.set(name, list);
  };

  // (a) explicit user-named skill: canonical name or alias, whole-phrase match.
  const q = normalize(intent);
  for (const rec of index.skills) {
    const names = [rec.skill, ...(rec.aliases || [])].map(normalize);
    if (q && names.includes(q)) addPin(rec.skill, "explicit:name-or-alias");
  }

  // (b) active task-graph current skill + its mandatory prerequisites.
  if (activeSkill && byName.has(activeSkill)) {
    addPin(activeSkill, "task-graph:active-skill");
    for (const req of byName.get(activeSkill).requires || []) addPin(req, `task-graph:prerequisite-of:${activeSkill}`);
  }

  // (c) next legal lane transition.
  if (nextSkill && byName.has(nextSkill)) addPin(nextSkill, "lane-state:next-transition");

  // (d) repository concerns → required skills + rules. Rule identifiers stay
  // bare/loadable; concern attribution goes to receipt evidence, not the id.
  const concerns = loadConcerns(root);
  const ruleEvidence = [];
  for (const concern of concerns.concerns || []) {
    const hit = matchConcern(concern, evidence);
    if (!hit) continue;
    const handled = concern.handled_by || {};
    for (const s of handled.required_skills || []) addPin(s, `concern:${concern.name}@${hit}`);
    for (const r of handled.required_rules || []) {
      if (!rules.includes(r)) {
        rules.push(r);
        ruleEvidence.push({ pin: `rule:${r}`, evidence: `concern:${concern.name}@${hit}` });
      }
    }
  }

  return { pins, rules, ruleEvidence };
}

/** Build lexical search documents from an index record. */
function docText(rec) {
  return [
    rec.skill.replace(/-/g, " "),
    ...(rec.aliases || []),
    rec.description,
    ...(rec.positive_triggers || []),
    ...(rec.domains || []),
    ...(rec.actions || []),
    ...(rec.objects || []),
  ].join(" ");
}

/** BM25-lite scoring (k1=1.2, b=0.75) over the compact index fields. */
function lexicalRank(queryTokens, records) {
  const k1 = 1.2;
  const b = 0.75;
  const docs = records.map((r) => ({ rec: r, tokens: tokenize(docText(r)) }));
  const df = new Map();
  for (const d of docs) {
    for (const t of new Set(d.tokens)) df.set(t, (df.get(t) || 0) + 1);
  }
  const N = docs.length;
  const avgLen = docs.reduce((s, d) => s + d.tokens.length, 0) / Math.max(1, N);
  const scored = docs.map((d) => {
    const tfMap = new Map();
    for (const t of d.tokens) tfMap.set(t, (tfMap.get(t) || 0) + 1);
    let score = 0;
    for (const qt of queryTokens) {
      const tf = tfMap.get(qt) || 0;
      if (!tf) continue;
      const idf = Math.log(1 + (N - (df.get(qt) || 0) + 0.5) / ((df.get(qt) || 0) + 0.5));
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (d.tokens.length / avgLen))));
    }
    return { rec: d.rec, score: Number(score.toFixed(6)) };
  });
  scored.sort((x, y) => y.score - x.score || x.rec.skill.localeCompare(y.rec.skill));
  return scored;
}

function negativeTriggered(rec, query) {
  const nq = normalize(query);
  for (const neg of rec.negative_triggers || []) {
    if (nq.includes(normalize(neg))) return true;
  }
  return false;
}

/**
 * Core entry point. All inputs are explicit; nothing reads process.env here
 * except through the caller-supplied options so the module stays testable.
 */
export function route(options) {
  const {
    root,
    intent,
    files = [],
    packages = [],
    env = [],
    activeSkill = null,
    nextSkill = null,
    mode = "suggest",
    receipts = true,
    ts = new Date().toISOString(),
    semanticStatus = "unavailable",
    semanticReason = "semantic-provider-not-configured-this-wave",
  } = options;

  if (!MODES.has(mode)) fail(`unknown mode ${mode}`);
  const { index, byName } = loadIndex(root);
  const freshness = verifyIndexFreshness(root, index);

  const evidence = { files, packages, env };
  const { pins, rules, ruleEvidence } = resolvePins({ root, index, byName, intent, evidence, activeSkill, nextSkill });

  // Stale/tampered index (canonical inputs drifted past compile): degrade.
  // Concern-required pins were computed live from REGISTRY.json above and
  // survive; optional discovery is withheld and the reason recorded.
  let staleReason = null;
  if (!freshness.fresh) {
    staleReason = `stale-routing-index:${freshness.drift.join(",")}`;
  }

  const required = [...pins.keys()].sort();
  const pinsEvidence = [];
  for (const [skill, whys] of [...pins.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    for (const w of whys) pinsEvidence.push({ pin: skill, evidence: w });
  }
  pinsEvidence.push(...ruleEvidence);

  // Scope filter: optional candidates must be suggestible in this run.
  // mode "off" is the emergency rollback position: deterministic required
  // pins stay active, ALL optional discovery is disabled (plan §9).
  // A stale index likewise withholds optional discovery while pins survive.
  const optional = mode === "off" || staleReason
    ? []
    : index.skills.filter(
        (r) => !pins.has(r.skill) && (r.invocation_policy === "suggest-only" || r.invocation_policy === "implicit-allowed"),
      );

  const qTokens = tokenize(intent);
  let ranked = lexicalRank(qTokens, optional).map(({ rec, score }) => ({
    rec,
    score,
    reason_codes: [],
  }));

  // Policy rerank: penalize negative triggers to below the suggestion floor;
  // small deterministic boosts for repo-signal/lane-role alignment.
  for (const item of ranked) {
    if (negativeTriggered(item.rec, intent)) {
      item.score = 0;
      item.reason_codes.push("negative-trigger");
    }
    if (nextSkill && (item.rec.lane_roles || []).length) item.reason_codes.push("lane-role-present");
    if (item.score === 0) item.reason_codes.push("below-floor");
  }
  ranked = ranked.filter((i) => i.score > 0);

  // Budget cut: smallest fitting candidate set (plan §4.6). Required pins were
  // already removed from this list and can never be truncated here.
  const cards = [];
  let d1Tokens = 0;
  let truncated = 0;
  for (const item of ranked) {
    if (cards.length >= BUDGETS.d1CeilingCards) { truncated += 1; continue; }
    const cost = Math.min(estimateTokens(JSON.stringify(cardFor(item))), 300);
    if (d1Tokens + cost > BUDGETS.d1CeilingTokens) { truncated += 1; continue; }
    cards.push(item);
    d1Tokens += cost;
  }

  // Selection: only active mode may auto-load one optional skill, gated.
  let selected = null;
  const selectionReasons = [];
  if (mode === "active" && cards.length > 0) {
    const top = cards[0];
    const second = cards[1];
    const marginOk = !second || top.score - second.score >= GATES.winnerMargin;
    const confident = top.score >= GATES.confidenceFloor;
    const policyOk = top.rec.invocation_policy === "implicit-allowed";
    const riskOk = top.rec.risk === "low";
    if (policyOk && confident && marginOk && riskOk) {
      selected = top.rec.skill;
      selectionReasons.push("gates-passed:confidence,margin,policy,risk");
    } else {
      selectionReasons.push(
        `fallback:route-workflow(policy=${top.rec.invocation_policy},confident=${confident},marginOk=${marginOk},risk=${top.rec.risk})`,
      );
    }
  } else if (mode === "active" && cards.length === 0) {
    selectionReasons.push("fallback:route-workflow(no-candidates)");
  }
  if (mode === "active" && selected === null) {
    // Approved ambiguity fallback surfaces route-workflow as the suggestion
    // head. Its cost is accounted BEFORE budget finalization so counters stay
    // truthful (F-EXEC-009).
    if (byName.has("route-workflow") && !pins.has("route-workflow")) {
      const fallback = { rec: byName.get("route-workflow"), score: 0, reason_codes: ["ambiguity-fallback"] };
      const cost = Math.min(estimateTokens(JSON.stringify(cardFor(fallback))), 300);
      if (cards.length >= BUDGETS.d1CeilingCards || d1Tokens + cost > BUDGETS.d1CeilingTokens) {
        truncated += 1;
      } else {
        cards.unshift(fallback);
        d1Tokens += cost;
      }
    }
  }

  const d0Tokens = estimateTokens(KERNEL_TEXT);
  // Honest enforcement semantics (F-EXEC-001): this wave implements no
  // mutation gate and no required-rule receipt verification, so no decision
  // may claim mutation authority. Advisory output only.
  const decision = {
    schema_version: 1,
    mode,
    semantic: {
      status: staleReason ? "degraded" : semanticStatus,
      reason_code: staleReason || semanticReason,
    },
    required,
    selected,
    suggestions: cards.slice(0, BUDGETS.d1CeilingCards).map(({ rec, score, reason_codes }) => ({
      skill: rec.skill,
      score,
      reason_codes,
    })),
    rules,
    budget: {
      d0_tokens: d0Tokens,
      d0_ceiling_tokens: BUDGETS.d0CeilingTokens,
      d1_tokens: d1Tokens,
      d1_ceiling_tokens: BUDGETS.d1CeilingTokens,
      d1_cards: cards.length,
      d1_ceiling_cards: BUDGETS.d1CeilingCards,
    },
    enforcement: "advisory-no-mutation-gate",
    receipt: {
      intent_fingerprint: `sha256:${sha256Hex(normalize(intent)).slice(0, 16)}`,
      ts,
      policy_version: POLICY_VERSION,
      truncated_optional_cards: truncated,
      pins_evidence: pinsEvidence,
    },
  };

  if (d0Tokens > BUDGETS.d0CeilingTokens) fail("D0 kernel exceeds its hard ceiling; reduce the kernel");

  if (receipts && mode !== "off") writeReceipt(root, decision);
  return decision;
}

function cardFor(item) {
  return {
    skill: item.rec.skill,
    purpose: item.rec.description,
    invocation_policy: item.rec.invocation_policy,
    risk: item.rec.risk,
    reason_codes: item.reason_codes,
  };
}

/** Append-only privacy-safe receipt stream (.svc/skill-router/, gitignored).
 * Writes go through scripts/state-io.mjs per the state-write discipline. */
export function writeReceipt(root, decision) {
  try {
    appendJsonlLine(path.join(root, ".svc", "skill-router", "decisions.jsonl"), decision);
  } catch {
    // Receipts are observational telemetry; they must never break routing.
  }
}

/** Structural validation against schemas/skill-router-decision.schema.json
 * without external dependencies (no ajv at repo root). Strict: unknown
 * top-level keys are rejected so no unreviewed payload (e.g. raw intent)
 * can ride along into host adapters. */
const DECISION_KEYS = new Set([
  "schema_version", "mode", "semantic", "required", "selected", "suggestions",
  "rules", "budget", "enforcement", "receipt",
]);

export function validateDecision(decision) {
  const errors = [];
  for (const key of Object.keys(decision)) {
    if (!DECISION_KEYS.has(key)) errors.push(`unknown field: ${key}`);
  }
  const req = ["schema_version", "mode", "semantic", "required", "selected", "suggestions", "rules", "budget", "enforcement"];
  for (const key of req) if (!(key in decision)) errors.push(`missing field: ${key}`);
  if (decision.schema_version !== 1) errors.push("schema_version must be 1");
  if (!MODES.has(decision.mode)) errors.push(`invalid mode ${decision.mode}`);
  if (decision.suggestions.length > BUDGETS.d1CeilingCards) errors.push("suggestions exceed d1 ceiling cards");
  if (decision.budget.d1_tokens > BUDGETS.d1CeilingTokens) errors.push("d1_tokens above ceiling");
  if (decision.budget.d0_tokens > BUDGETS.d0CeilingTokens) errors.push("d0_tokens above ceiling");
  if (decision.selected !== null && typeof decision.selected !== "string") errors.push("selected must be string|null");
  if (!/^sha256:[0-9a-f]{16}$/.test(decision.receipt?.intent_fingerprint || "")) errors.push("receipt.intent_fingerprint malformed");
  if (decision.enforcement !== "advisory-no-mutation-gate" && decision.enforcement !== "read-only-diagnosis") {
    errors.push(`enforcement value ${decision.enforcement} claims authority this wave does not implement`);
  }
  for (const s of decision.suggestions) {
    if (typeof s.score !== "number" || !Array.isArray(s.reason_codes)) errors.push("suggestion card malformed");
  }
  if (JSON.stringify(decision).includes("RAW_INTENT_MARKER")) errors.push("raw intent leaked into decision");
  return errors;
}

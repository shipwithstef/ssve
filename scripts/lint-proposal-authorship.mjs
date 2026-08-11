#!/usr/bin/env node
// scripts/lint-proposal-authorship.mjs
//
// Trigger 1 (T1) of the pre-WI promotion compression gate per WI-341.
//
// Runs 7 author-time predictive checks against a proposals/*.md file. Warn-only;
// never blocks. Output goes to stdout AND a sidecar at .svc/proposal-lints/<slug>.md
// (transient) or docs/specs/reviews/proposal-lints/<slug>.md (--durable opt-in).
//
// Author-time checks (T1, predictive) — NOT identical to T2 validation checks:
//   1. planned_artifacts       — proposal names >=1 concrete artifact path
//   2. candidate_severity      — proposal Route section states severity + rationale
//   3. forbidden_token_config  — proposal does not paste project-specific tokens into framework code blocks
//   4. concerns_intent         — if proposal introduces a new evidence family, it names a concerns/<name>.md file
//   5. tier1_promotion_claims  — every proposed tier-1 validator has promotion-signal fields
//   6. capability_oracles      — harness/model references cite named oracles
//   7. candidate_risk_class    — proposal declares plan-changeset class
//
// Stub threshold: proposals with body length below threshold (default 40 lines) are
// not linted (treated as stubs / placeholders).
//
// Schema baselined 2026-05-12 by WI-341 bootstrap.

import fs from "node:fs";
import path from "node:path";

const STUB_THRESHOLD = Number(process.env.SVC_PROPOSAL_LINT_STUB_THRESHOLD ?? 40);

const FRAMEWORK_PATH_REGEX_SOURCES = [
  "scripts/[A-Za-z0-9_./-]+\\.(mjs|js|sh|cjs|mts|ts)",
  "references/[A-Za-z0-9_./-]+\\.(md|json|js|mjs)",
  "test-framework/evals/tier-[0-9.]+/[A-Za-z0-9_./-]+\\.sh",
  "concerns/[A-Za-z0-9_-]+\\.md",
  "[a-z][a-z0-9-]+/SKILL\\.md",
  "\\.svc/[A-Za-z0-9_./-]+",
  "docs/specs/[A-Za-z0-9_./-]+",
];
const ARTIFACT_PATH_RE = new RegExp(`(?:^|\\s|\\\`)((?:${FRAMEWORK_PATH_REGEX_SOURCES.join("|")}))`, "g");

const SEVERITY_DECL_RE = /\bseverity\s*[:=]\s*\**(critical|high|medium|low)\**/i;
const SEVERITY_RATIONALE_RE = /\bseverity\s*[:=]\s*\**(critical|high|medium|low)\**[^.\n]*[.(—\-]/i;

const PLAN_CHANGESET_CLASSES = ["contract-change", "hot-path", "refactor", "additive", "docs"];

const HARNESS_MODEL_TOKENS = [
  "Kimi", "MiMo", "Mimo", "Claude", "Opus", "Sonnet", "Haiku",
  "Codex", "GPT-4o", "Gemini", "o3", "kimi-for-coding",
];
const CAPABILITY_ORACLE_PATHS = [
  "scripts/resolve-model.sh",
  "references/model-registry.json",
  "references/model-routing.md",
  "references/knowledge/svc/CAPABILITIES.md",
  "references/knowledge/", // partial match for domains
];

const TIER1_VALIDATOR_RE = /test-framework\/evals\/tier-1\/[A-Za-z0-9_.-]+\.(sh|mjs)|tier-1.*validator/i;
const TIER1_PROMOTION_FIELDS = ["validator_path", "failure_class", "promotion_signal"];

const EVIDENCE_FAMILY_HINTS = /\b(evidence[\s_-]?family|evidence[\s_-]?families|delivery[\s_-]?graph)\b/i;
const CONCERNS_PATH_RE = /\bconcerns\/[a-z0-9_-]+\.md\b/i;

function usage() {
  console.error("Usage: node scripts/lint-proposal-authorship.mjs <proposal-path> [--durable] [--stub-threshold <N>] [--forbidden-tokens <path>] [--json]");
  console.error("");
  console.error("  --forbidden-tokens <path>  Load forbidden-token config from <path> instead of .svc/forbidden-tokens.json.");
  console.error("                             Use this for dogfood runs against the committed .svc/forbidden-tokens.example.json.");
  console.error("                             By default the example file is NEVER loaded.");
  process.exit(2);
}

function parseArgs(argv) {
  const args = { paths: [], durable: false, stubThreshold: STUB_THRESHOLD, json: false, forbiddenTokens: null };
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (tok === "--durable") { args.durable = true; continue; }
    if (tok === "--json") { args.json = true; continue; }
    if (tok === "--stub-threshold") { args.stubThreshold = Number(argv[++i]); continue; }
    if (tok === "--forbidden-tokens") { args.forbiddenTokens = argv[++i]; continue; }
    if (tok.startsWith("--")) usage();
    args.paths.push(tok);
  }
  if (args.paths.length === 0) usage();
  return args;
}

function splitFrontmatter(text) {
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) {
    return { frontmatter: "", body: text };
  }
  const end = text.indexOf("\n---", 4);
  if (end === -1) return { frontmatter: "", body: text };
  return { frontmatter: text.slice(0, end + 4), body: text.slice(end + 4).replace(/^\s*\n/, "") };
}

function bodyLineCount(body) {
  return body.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
}

function findArtifactPaths(body) {
  const set = new Set();
  let m;
  ARTIFACT_PATH_RE.lastIndex = 0;
  while ((m = ARTIFACT_PATH_RE.exec(body)) !== null) {
    set.add(m[1].replace(/[`,;:)]+$/, ""));
  }
  return Array.from(set);
}

function checkPlannedArtifacts(body) {
  const paths = findArtifactPaths(body);
  if (paths.length === 0) {
    return { status: "WARN", evidence: "no concrete artifact paths found in proposal body" };
  }
  return { status: "PASS", evidence: `${paths.length} concrete path(s), e.g. ${paths.slice(0, 3).join(", ")}` };
}

function checkCandidateSeverity(body) {
  const m = body.match(SEVERITY_DECL_RE);
  if (!m) return { status: "WARN", evidence: "no Severity: declaration found" };
  if (!SEVERITY_RATIONALE_RE.test(body)) {
    return { status: "WARN", evidence: `Severity = ${m[1]} declared but rationale clause missing or unclear` };
  }
  return { status: "PASS", evidence: `Severity = ${m[1]} with rationale` };
}

function checkForbiddenTokenConfig(body, forbiddenList) {
  if (forbiddenList.length === 0) {
    return { status: "PASS", evidence: "no forbidden-token list configured for this run; check is advisory" };
  }
  const hits = [];
  for (const entry of forbiddenList) {
    const pattern = entry.pattern;
    let re;
    if (pattern.startsWith("/") && pattern.lastIndexOf("/") > 0) {
      const last = pattern.lastIndexOf("/");
      re = new RegExp(pattern.slice(1, last), pattern.slice(last + 1));
    } else {
      re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    }
    if (re.test(body)) hits.push(pattern);
  }
  if (hits.length === 0) return { status: "PASS", evidence: "no forbidden tokens detected in proposal body" };
  return { status: "WARN", evidence: `forbidden tokens present: ${hits.join(", ")}` };
}

function checkConcernsIntent(body) {
  if (!EVIDENCE_FAMILY_HINTS.test(body)) {
    return { status: "PASS", evidence: "proposal does not introduce a new evidence family (check is n/a)" };
  }
  if (!CONCERNS_PATH_RE.test(body)) {
    return { status: "WARN", evidence: "proposal mentions evidence family/delivery graph but names no concerns/<name>.md" };
  }
  const matches = body.match(/concerns\/[a-z0-9_-]+\.md/gi) ?? [];
  return { status: "PASS", evidence: `concerns referenced: ${Array.from(new Set(matches)).slice(0, 3).join(", ")}` };
}

function checkTier1PromotionClaims(body) {
  if (!TIER1_VALIDATOR_RE.test(body)) {
    return { status: "PASS", evidence: "no new tier-1 validator proposed (check is n/a)" };
  }
  const missing = TIER1_PROMOTION_FIELDS.filter((f) => !new RegExp(`\\b${f}\\b`, "i").test(body));
  if (missing.length === 0) {
    return { status: "PASS", evidence: "tier-1 validator proposed and promotion_signal fields present" };
  }
  return { status: "WARN", evidence: `tier-1 validator proposed but missing rules/tier-1-promotion.md fields: ${missing.join(", ")}` };
}

function checkCapabilityOracles(body) {
  const mentionedHarness = HARNESS_MODEL_TOKENS.filter((t) => new RegExp(`\\b${t}\\b`).test(body));
  if (mentionedHarness.length === 0) {
    return { status: "PASS", evidence: "no harness/model references (check is n/a)" };
  }
  const oraclesFound = CAPABILITY_ORACLE_PATHS.filter((o) => body.includes(o));
  if (oraclesFound.length === 0) {
    return { status: "WARN", evidence: `harness/model references (${mentionedHarness.slice(0, 4).join(", ")}) cite no named oracle (scripts/resolve-model.sh, model-registry.json, model-routing.md, CAPABILITIES.md)` };
  }
  return { status: "PASS", evidence: `oracles cited: ${oraclesFound.slice(0, 3).join(", ")}` };
}

function checkCandidateRiskClass(body) {
  for (const cls of PLAN_CHANGESET_CLASSES) {
    const re = new RegExp(`(?:[Pp]lan-changeset\\s+class|risk[:\\s])[^\\n]*\\b${cls}\\b`);
    if (re.test(body)) return { status: "PASS", evidence: `plan-changeset class = ${cls}` };
  }
  return { status: "WARN", evidence: "no plan-changeset risk-class declaration (contract-change | hot-path | refactor | additive | docs) found" };
}

// Heuristic: detect when a proposal introduces a new top-level concept
// (skill name, gate, lane, concern, rule) and check whether it cites prior
// art for that concept. This catches the failure mode where the author
// proposes a "new X" without grepping for existing skills/rules/concerns
// that already do X (PR #131 originally proposed a new cross-model review
// gate + chain when review-plan T2/T3 + review-cross-model already exist
// with that exact pattern).
//
// Two-step detection:
//   1. Does the proposal claim to ADD a new skill/gate/lane/concern/rule
//      (regex over standard introduce-verbs near these noun classes)?
//   2. If yes, does it CITE existing review-*/SKILL.md, rules/, or
//      concerns/ files it extends, supersedes, or distinguishes from?
//
// PASS = no introduce signal OR (introduce signal + at least one prior-art
// citation). WARN = introduce signal without prior-art citation.

// Allow 0-3 descriptive modifier tokens (hyphenated, alpha) between the
// introduce-verb and the concept noun. Codex round-1 caught: "add a
// cross-model review gate" / "create an adversarial wrapper" did not
// match because the noun wasn't immediately after a/new.
const NEW_CONCEPT_RE = /\b(?:add|introduce|create|new|propose)\s+(?:a\s+|an\s+)?(?:new\s+)?(?:[a-z][a-z-]*\s+){0,3}(?:skill|gate|lane|concern|rule|chain|loop|protocol|wrapper|hook|validator|guard)s?\b/i;
// Match negation context near the introduce verb. If a sentence contains
// "does not add", "doesn't introduce", "no new", "NOT a new", or similar
// negation up to ~10 words before the match, treat as NOT introducing.
const NEGATION_BEFORE_RE = /\b(?:does\s+not|doesn'?t|do\s+not|don'?t|will\s+not|won'?t|never|no\s+new|not\s+(?:a\s+|adding\s+|introducing\s+|creating\s+))/i;
const PRIOR_ART_CITATION_RE = /\b(?:extends?|supersedes?|replaces?|distinguished from|differs? from|extension of|tightening|broaden(?:s|ing)?\s+(?:the\s+)?(?:concerns?|handles_concerns)|sources? from|builds? on|relates? to|inherits?)\b/i;
// Skill refs + rules/foo.md + concerns/foo.md all count as prior-art
// citations (Codex round-1 caught: rules and concerns were omitted).
const EXISTING_SKILL_REFERENCE_RE = /\b(?:review-(?:plan|gate|cross-model|security)|capture-idea|execute-changeset|plan-changeset|land-changeset|verify-promotion|design-(?:ux|ui|tech)|write-(?:spec|journeys|vision)|audit-(?:implementation|coverage|ac)|sync-spec-code|manage-learnings|route-workflow|improve-framework|evolve-framework)(?:\/SKILL\.md)?\b/g;
const RULES_OR_CONCERNS_REFERENCE_RE = /\b(?:rules|concerns)\/[a-z0-9_-]+\.md\b/g;

// When the proposal is in the review/gate/chain space specifically, the
// overlap with existing skills (review-plan, review-gate, review-cross-model,
// review-security) is so heavy that a single mention is not sufficient
// evidence the author surveyed prior art. Require explicit overlap-mapping.
const REVIEW_SPACE_RE = /\b(?:review|gate|adversarial|cross[-\s]model|second[-\s]model|chain|fallback)\b/i;
const REVIEW_FAMILY_SKILL_RE = /\breview-(?:plan|gate|cross-model|security)\b/g;
const OVERLAP_MAP_RE = /(?:relationship to existing|overlap (?:with|map)|prior[-\s]art (?:map|table)|comparison (?:to|table)|how this differs from)/i;

// Find an introduce-verb match in `text` and check the preceding ~80 chars
// for a negation. If negated, return false (no concept introduced).
function hasUnnegatedIntroduceSignal(text) {
  const re = new RegExp(NEW_CONCEPT_RE.source, "gi");
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = Math.max(0, m.index - 80);
    const lead = text.slice(start, m.index);
    if (NEGATION_BEFORE_RE.test(lead)) continue;
    return true;
  }
  return false;
}

// Stricter overlap-map check (Codex round-1 P3): require not just the
// heading, but at least one relationship verb WITHIN the section. A heading
// alone with no actual mapping doesn't prove the author surveyed prior art.
function hasOverlapMapWithRelationship(text) {
  if (!OVERLAP_MAP_RE.test(text)) return false;
  // Find the heading and look at the next ~800 chars for a relationship verb
  const m = text.match(/(?:relationship to existing|overlap (?:with|map)|prior[-\s]art (?:map|table)|comparison (?:to|table)|how this differs from)[\s\S]{0,800}/i);
  if (!m) return false;
  return PRIOR_ART_CITATION_RE.test(m[0]);
}

function checkPriorArt(body) {
  if (!hasUnnegatedIntroduceSignal(body)) {
    return { status: "PASS", evidence: "proposal does not introduce a new top-level concept (check is n/a — either no introduce signal or the signal is negated)" };
  }
  const acMatch = body.match(/^##+\s*Acceptance Criteria\b/im);
  const framing = acMatch ? body.slice(0, acMatch.index) : body;

  const hasRelationshipInFraming = PRIOR_ART_CITATION_RE.test(framing);
  // Combined citation set: skill refs + rules/ + concerns/ all count as prior art
  // (Codex round-1 P2 caught: rules and concerns were omitted previously, causing
  // false WARNs for valid rule/concern-mapping proposals).
  const skillCitationsInFraming = Array.from(new Set([
    ...(framing.match(EXISTING_SKILL_REFERENCE_RE) || []),
    ...(framing.match(RULES_OR_CONCERNS_REFERENCE_RE) || []),
  ])).slice(0, 6);
  const skillCitationsAnywhere = Array.from(new Set([
    ...(body.match(EXISTING_SKILL_REFERENCE_RE) || []),
    ...(body.match(RULES_OR_CONCERNS_REFERENCE_RE) || []),
  ])).slice(0, 6);

  // Stronger requirement when the proposal is in the review/gate/chain space:
  // the overlapping family is review-plan / review-gate / review-cross-model /
  // review-security. Require ≥2 explicit citations from that family in the
  // framing prose AND an explicit overlap-map / relationship-table section.
  if (REVIEW_SPACE_RE.test(framing)) {
    const reviewFamilyCitations = Array.from(new Set((framing.match(REVIEW_FAMILY_SKILL_RE) || []))).slice(0, 4);
    // Stricter check (Codex round-1 P3): heading alone is not enough.
    // Require an actual relationship verb WITHIN the overlap-map section.
    const hasOverlapMap = hasOverlapMapWithRelationship(framing);
    if (reviewFamilyCitations.length >= 2 && hasOverlapMap) {
      return { status: "PASS", evidence: `review-space proposal cites ≥2 review-family skills (${reviewFamilyCitations.join(", ")}) with an explicit overlap-map section containing relationship-verb language` };
    }
    if (reviewFamilyCitations.length < 2) {
      return {
        status: "WARN",
        evidence: `proposal is in the review/gate/chain space but cites <2 existing review-family skills (${reviewFamilyCitations.length} cited: ${reviewFamilyCitations.join(", ") || "none"}). The review family — review-plan (3-tier with Codex T2/T3 chain), review-gate (G1-G7 universal protocol), review-cross-model (second-model dispatch), review-security — overlaps heavily by design. Cite the at-least-two most-adjacent ones in the framing prose AND state how this proposal extends/supersedes/distinguishes itself from each. The duplicate-skill failure mode (PR #131 originally proposed a new chain when review-plan T2/T3 already had it) hits hardest in this space.`,
      };
    }
    if (!hasOverlapMap) {
      return {
        status: "WARN",
        evidence: `proposal cites review-family skills (${reviewFamilyCitations.join(", ")}) but lacks an explicit "Relationship to existing skills" / "Overlap map" / "How this differs from" section in framing prose. Mentioning the skills is not enough — explicitly map what the new thing does that the existing skills don't, and what existing capability survives unchanged.`,
      };
    }
  }

  if (hasRelationshipInFraming && skillCitationsInFraming.length > 0) {
    return { status: "PASS", evidence: `prior art cited in framing prose: ${skillCitationsInFraming.join(", ")} with relationship verb (extends/supersedes/etc.)` };
  }
  if (skillCitationsAnywhere.length > 0 && !hasRelationshipInFraming) {
    return {
      status: "WARN",
      evidence: `proposal mentions existing skill(s) ${skillCitationsAnywhere.join(", ")} but the framing prose (before "## Acceptance Criteria") does NOT explicitly state the relationship (extends/supersedes/distinguished-from). An AC bullet saying "extend X" is not enough — by then the proposal has already committed to the new-thing framing. Add a "Relationship to existing skills" subsection in the framing.`,
    };
  }
  return {
    status: "WARN",
    evidence: "proposal introduces a new skill/gate/lane/concern/rule/chain/loop/protocol/wrapper but cites NO existing review-*/SKILL.md, capture-idea, execute-changeset, etc. as prior art. This is the duplicate-skill failure mode — grep `review-*/SKILL.md`, `concerns/`, `rules/` for adjacent patterns BEFORE writing the AC list. If genuinely no prior art exists, state that explicitly with the queries you ran.",
  };
}

function loadForbiddenTokens(explicitPath) {
  // Critical: NEVER fall back to the example file by default. The example
  // file contains project-specific tokens (Example Marketplace, etc.) that exist as a
  // dogfood/demo dataset; treating it as active policy at framework level
  // would be exactly the F-2 product-token leakage this lint exists to
  // prevent. Only load:
  //   1. An explicit --forbidden-tokens <path> argument (used for demos,
  //      project-local config that lives outside .svc/, etc.), OR
  //   2. .svc/forbidden-tokens.json (the real project-local config; absent
  //      in fresh checkouts).
  // The example file at .svc/forbidden-tokens.example.json is committed for
  // reference; it is NEVER loaded automatically.
  const candidate = explicitPath ?? ".svc/forbidden-tokens.json";
  if (fs.existsSync(candidate)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf8"));
      if (Array.isArray(parsed.tokens)) return { source: candidate, tokens: parsed.tokens };
    } catch (_) { /* fall through to empty */ }
  }
  return { source: null, tokens: [] };
}

function lintOne(proposalPath, opts) {
  if (!fs.existsSync(proposalPath)) {
    return { path: proposalPath, error: "file not found" };
  }
  const text = fs.readFileSync(proposalPath, "utf8");
  const { body } = splitFrontmatter(text);
  const lines = bodyLineCount(body);
  const slug = path.basename(proposalPath, ".md");

  if (lines < opts.stubThreshold) {
    return {
      path: proposalPath,
      slug,
      body_lines: lines,
      stub: true,
      stub_threshold: opts.stubThreshold,
      checks: null,
      summary: `STUB (body ${lines} < threshold ${opts.stubThreshold}) — lint skipped`,
    };
  }

  const tokenConfig = loadForbiddenTokens(opts.forbiddenTokens);

  const checks = {
    planned_artifacts:      { t2_equivalent: "concrete_contract",      ...checkPlannedArtifacts(body) },
    candidate_severity:     { t2_equivalent: "severity_taxonomy",      ...checkCandidateSeverity(body) },
    forbidden_token_config: { t2_equivalent: "host_agnostic",          ...checkForbiddenTokenConfig(body, tokenConfig.tokens), config: tokenConfig.source },
    concerns_intent:        { t2_equivalent: "concerns_wired",         ...checkConcernsIntent(body) },
    tier1_promotion_claims: { t2_equivalent: "tier1_promotion_note",   ...checkTier1PromotionClaims(body) },
    capability_oracles:     { t2_equivalent: "capability_freshness",   ...checkCapabilityOracles(body) },
    candidate_risk_class:   { t2_equivalent: "plan_changeset_class",   ...checkCandidateRiskClass(body) },
    prior_art_scan:         { t2_equivalent: "concrete_contract",      ...checkPriorArt(body) },
  };

  const warns = Object.entries(checks).filter(([, v]) => v.status === "WARN").length;
  const passes = Object.entries(checks).filter(([, v]) => v.status === "PASS").length;

  return {
    path: proposalPath,
    slug,
    body_lines: lines,
    stub: false,
    stub_threshold: opts.stubThreshold,
    checks,
    summary: `${passes} PASS, ${warns} WARN, 0 FAIL (lint is warn-only)`,
  };
}

function renderMarkdown(result) {
  const lines = [];
  lines.push(`# Proposal authorship lint — ${result.slug}`);
  lines.push("");
  lines.push(`**Path:** \`${result.path}\``);
  lines.push(`**Body lines:** ${result.body_lines} (stub threshold: ${result.stub_threshold})`);
  lines.push(`**Verdict:** ${result.summary}`);
  lines.push("");
  if (result.stub) {
    lines.push("Stub proposal — lint skipped. Increase body content past the threshold to receive author-time checks.");
    lines.push("");
    return lines.join("\n");
  }
  lines.push("## Author-time checks");
  lines.push("");
  lines.push("| # | Check | T1 status | T2 equivalent | Evidence |");
  lines.push("|---|-------|-----------|---------------|----------|");
  let i = 1;
  for (const [name, check] of Object.entries(result.checks)) {
    const ev = (check.evidence ?? "").replace(/\|/g, "\\|");
    lines.push(`| ${i++} | \`${name}\` | ${check.status} | \`${check.t2_equivalent}\` | ${ev} |`);
  }
  lines.push("");
  lines.push("## How to read this");
  lines.push("");
  lines.push("- **PASS** — the author-time signal is present. The corresponding T2 (WI-promotion) check is likely to pass at promotion time.");
  lines.push("- **WARN** — the author-time signal is missing or ambiguous. The author should add the named field BEFORE opening review. T1 is warn-only, never blocks; T2 will refuse promotion if the same signal is still missing then.");
  lines.push("");
  lines.push("This lint is warn-only by design. The hard gate runs at WI promotion (Trigger 2: `capture-idea --from-proposal`).");
  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const results = args.paths.map((p) => lintOne(p, args));

  if (args.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  for (const r of results) {
    if (r.error) {
      console.error(`ERROR ${r.path}: ${r.error}`);
      continue;
    }
    const md = renderMarkdown(r);
    console.log(md);

    const outDir = args.durable
      ? "docs/specs/reviews/proposal-lints"
      : ".svc/proposal-lints";
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `${r.slug}.md`);
    fs.writeFileSync(outPath, md, "utf8");
    console.error(`\nSidecar written to ${outPath}`);
  }
}

main();

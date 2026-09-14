#!/usr/bin/env node
// scripts/validate-wi-promotion.mjs
//
// WI-341 tranche 2a: receipt validator. The full T2 promotion gate (running
// the 7-check compression on a candidate WI before it lands) is sub-tranche
// 2b. This script implements the VALIDATION half — it reads existing
// `.svc/promotion-receipts/WI-<n>.json` files, schema-checks each, and
// cross-references actionable WIs in `docs/specs/work-items/DONE.md` to
// surface post-cutoff WIs that are missing receipts.
//
// Usage:
//   node scripts/validate-wi-promotion.mjs                 # validate all receipts + cross-ref
//   node scripts/validate-wi-promotion.mjs --wi WI-341     # validate one receipt only
//   node scripts/validate-wi-promotion.mjs --json          # emit JSON summary
//   node scripts/validate-wi-promotion.mjs --strict        # exit 1 on any post-cutoff WI missing a receipt
//
// Exit 0 when receipts validate AND (in strict mode) every post-cutoff
// actionable WI has a receipt. Exit 1 on any schema violation or, in strict
// mode, on a missing receipt for a post-cutoff WI. Exit 2 on usage error.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const SCHEMA_PATH = path.join(REPO_ROOT, "references/schemas/promotion-receipt.schema.json");
const RECEIPTS_DIR = path.join(REPO_ROOT, ".svc/promotion-receipts");
const DONE_PATH = path.join(REPO_ROOT, "docs/specs/work-items/DONE.md");

function parseArgs(argv) {
  const out = { wi: null, json: false, strict: false };
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (tok === "--wi") { out.wi = argv[++i]; continue; }
    if (tok === "--json") { out.json = true; continue; }
    if (tok === "--strict") { out.strict = true; continue; }
    if (tok === "--help" || tok === "-h") {
      console.log("Usage: node scripts/validate-wi-promotion.mjs [--wi WI-NNN] [--json] [--strict]");
      process.exit(0);
    }
    if (tok.startsWith("--")) { console.error(`Unknown flag: ${tok}`); process.exit(2); }
  }
  return out;
}

function loadSchema() {
  if (!fs.existsSync(SCHEMA_PATH)) return null;
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
}

function listReceiptFiles(wi) {
  if (!fs.existsSync(RECEIPTS_DIR)) return [];
  const all = fs.readdirSync(RECEIPTS_DIR)
    .filter((f) => /^WI-\d+\.json$/.test(f))
    .sort();
  if (wi) return all.filter((f) => f === `${wi}.json`);
  return all;
}

function readReceipt(file) {
  const full = path.join(RECEIPTS_DIR, file);
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (e) {
    return { __parse_error: e.message, __path: full };
  }
}

// Receipt-schema-specific validator. The shared scripts/lib/json-schema-
// validator.mjs is a documented subset that intentionally skips `pattern`,
// `minLength`, `additionalProperties`, and `allOf/if/then` (svc's no-npm-dep
// posture per WI-140). This validator covers the exact features the
// promotion-receipt schema uses, so the contract is enforced for real, not
// only at the top level. PR #130 review HIGH addressed.
//
// Coverage matrix (vs references/schemas/promotion-receipt.schema.json):
//   ✓ top-level required keys
//   ✓ top-level additionalProperties=false
//   ✓ wi_id pattern ^WI-\d+$
//   ✓ promoted_at format date-time (ISO-8601 with optional fractional seconds)
//   ✓ enforced_after format date (YYYY-MM-DD)
//   ✓ source_proposal pattern ^proposals/.+\.md$
//   ✓ schema_version const 1
//   ✓ decision enum
//   ✓ reviewer minLength 3
//   ✓ refusal_reason minLength 10 (when present)
//   ✓ checks required keys
//   ✓ checks additionalProperties=false
//   ✓ checks.concrete_contract enum
//   ✓ checks.severity_taxonomy required keys + additionalProperties=false
//   ✓ checks.severity_taxonomy.rated enum
//   ✓ checks.severity_taxonomy.justification minLength 5
//   ✓ checks.host_agnostic required keys + additionalProperties=false
//   ✓ checks.host_agnostic.result enum
//   ✓ checks.host_agnostic.tokens array of string
//   ✓ checks.concerns_wired array of strings matching ^concerns/.+\.md$
//   ✓ checks.tier1_promotion_note enum
//   ✓ checks.capability_freshness required keys + additionalProperties=false
//   ✓ checks.capability_freshness.result enum
//   ✓ checks.capability_freshness.oracles array of string
//   ✓ checks.plan_changeset_class enum
//   ✓ checks.lane enum
//   ✓ allOf conditionals (refusal_reason, grandfathered, bootstrap, n/a)

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WI_ID_RE = /^WI-\d+$/;
const PROPOSAL_PATH_RE = /^proposals\/.+\.md$/;
const CONCERN_PATH_RE = /^concerns\/.+\.md$/;

const DECISION_ENUM = ["accepted", "refused", "bound-to-proposal", "grandfathered"];
const LANE_ENUM = ["greenfield", "brownfield-conversion", "brownfield-feature", "bugfix", "drift", "refactor", "framework"];
const PLAN_CHANGESET_CLASS_ENUM = ["contract-change", "hot-path", "refactor", "additive", "docs", "n/a"];
const CONCRETE_CONTRACT_ENUM = ["pass", "warn", "fail", "n/a"];
const SEVERITY_RATED_ENUM = ["critical", "high", "medium", "low", "n/a"];
const HOST_AGNOSTIC_RESULT_ENUM = ["pass", "flagged", "n/a"];
const TIER1_PROMOTION_NOTE_ENUM = ["n/a", "filled"];
const CAPABILITY_FRESHNESS_RESULT_ENUM = ["pass", "stale", "n/a"];

const CHECKS_REQUIRED = [
  "concrete_contract",
  "severity_taxonomy",
  "host_agnostic",
  "concerns_wired",
  "tier1_promotion_note",
  "capability_freshness",
  "plan_changeset_class",
  "lane",
];
const CHECKS_ALLOWED = new Set(CHECKS_REQUIRED);
const SEVERITY_TAXONOMY_REQUIRED = ["rated", "justification"];
const SEVERITY_TAXONOMY_ALLOWED = new Set(SEVERITY_TAXONOMY_REQUIRED);
const HOST_AGNOSTIC_REQUIRED = ["result"];
const HOST_AGNOSTIC_ALLOWED = new Set([...HOST_AGNOSTIC_REQUIRED, "config", "tokens"]);
const CAPABILITY_FRESHNESS_REQUIRED = ["result"];
const CAPABILITY_FRESHNESS_ALLOWED = new Set([...CAPABILITY_FRESHNESS_REQUIRED, "oracles"]);

function fail(findings, check, message, where) {
  findings.push({ severity: "fail", check, message: where ? `${where}: ${message}` : message });
}

function validateChecksBlock(checks, findings) {
  if (typeof checks !== "object" || checks === null || Array.isArray(checks)) {
    fail(findings, "checks_type", "checks must be an object");
    return;
  }
  for (const k of CHECKS_REQUIRED) {
    if (!(k in checks)) fail(findings, "checks_required", `missing checks.${k}`);
  }
  for (const k of Object.keys(checks)) {
    if (!CHECKS_ALLOWED.has(k)) fail(findings, "checks_additional_property", `unknown key checks.${k}`);
  }

  if ("concrete_contract" in checks && !CONCRETE_CONTRACT_ENUM.includes(checks.concrete_contract)) {
    fail(findings, "concrete_contract_enum", `checks.concrete_contract=${JSON.stringify(checks.concrete_contract)} not in ${CONCRETE_CONTRACT_ENUM.join(", ")}`);
  }

  // severity_taxonomy
  if ("severity_taxonomy" in checks) {
    const st = checks.severity_taxonomy;
    if (typeof st !== "object" || st === null || Array.isArray(st)) {
      fail(findings, "severity_taxonomy_type", "checks.severity_taxonomy must be an object");
    } else {
      for (const k of SEVERITY_TAXONOMY_REQUIRED) {
        if (!(k in st)) fail(findings, "severity_taxonomy_required", `missing checks.severity_taxonomy.${k}`);
      }
      for (const k of Object.keys(st)) {
        if (!SEVERITY_TAXONOMY_ALLOWED.has(k)) fail(findings, "severity_taxonomy_additional_property", `unknown key checks.severity_taxonomy.${k}`);
      }
      if ("rated" in st && !SEVERITY_RATED_ENUM.includes(st.rated)) {
        fail(findings, "severity_rated_enum", `checks.severity_taxonomy.rated=${JSON.stringify(st.rated)} not in ${SEVERITY_RATED_ENUM.join(", ")}`);
      }
      if ("justification" in st && (typeof st.justification !== "string" || st.justification.length < 5)) {
        fail(findings, "severity_justification_minlength", "checks.severity_taxonomy.justification must be a string of length >= 5");
      }
    }
  }

  // host_agnostic
  if ("host_agnostic" in checks) {
    const ha = checks.host_agnostic;
    if (typeof ha !== "object" || ha === null || Array.isArray(ha)) {
      fail(findings, "host_agnostic_type", "checks.host_agnostic must be an object");
    } else {
      for (const k of HOST_AGNOSTIC_REQUIRED) {
        if (!(k in ha)) fail(findings, "host_agnostic_required", `missing checks.host_agnostic.${k}`);
      }
      for (const k of Object.keys(ha)) {
        if (!HOST_AGNOSTIC_ALLOWED.has(k)) fail(findings, "host_agnostic_additional_property", `unknown key checks.host_agnostic.${k}`);
      }
      if ("result" in ha && !HOST_AGNOSTIC_RESULT_ENUM.includes(ha.result)) {
        fail(findings, "host_agnostic_result_enum", `checks.host_agnostic.result=${JSON.stringify(ha.result)} not in ${HOST_AGNOSTIC_RESULT_ENUM.join(", ")}`);
      }
      if ("config" in ha && typeof ha.config !== "string") {
        fail(findings, "host_agnostic_config_type", "checks.host_agnostic.config must be a string");
      }
      if ("tokens" in ha) {
        if (!Array.isArray(ha.tokens)) {
          fail(findings, "host_agnostic_tokens_type", "checks.host_agnostic.tokens must be an array of strings");
        } else {
          for (let i = 0; i < ha.tokens.length; i += 1) {
            if (typeof ha.tokens[i] !== "string") {
              fail(findings, "host_agnostic_tokens_item_type", `checks.host_agnostic.tokens[${i}] must be a string`);
            }
          }
        }
      }
    }
  }

  // concerns_wired
  if ("concerns_wired" in checks) {
    const cw = checks.concerns_wired;
    if (!Array.isArray(cw)) {
      fail(findings, "concerns_wired_type", "checks.concerns_wired must be an array");
    } else {
      for (let i = 0; i < cw.length; i += 1) {
        const v = cw[i];
        if (typeof v !== "string" || !CONCERN_PATH_RE.test(v)) {
          fail(findings, "concerns_wired_pattern", `checks.concerns_wired[${i}]=${JSON.stringify(v)} must be a string matching ^concerns/.+\\.md$`);
        }
      }
    }
  }

  // tier1_promotion_note
  if ("tier1_promotion_note" in checks && !TIER1_PROMOTION_NOTE_ENUM.includes(checks.tier1_promotion_note)) {
    fail(findings, "tier1_promotion_note_enum", `checks.tier1_promotion_note=${JSON.stringify(checks.tier1_promotion_note)} not in ${TIER1_PROMOTION_NOTE_ENUM.join(", ")}`);
  }

  // capability_freshness
  if ("capability_freshness" in checks) {
    const cf = checks.capability_freshness;
    if (typeof cf !== "object" || cf === null || Array.isArray(cf)) {
      fail(findings, "capability_freshness_type", "checks.capability_freshness must be an object");
    } else {
      for (const k of CAPABILITY_FRESHNESS_REQUIRED) {
        if (!(k in cf)) fail(findings, "capability_freshness_required", `missing checks.capability_freshness.${k}`);
      }
      for (const k of Object.keys(cf)) {
        if (!CAPABILITY_FRESHNESS_ALLOWED.has(k)) fail(findings, "capability_freshness_additional_property", `unknown key checks.capability_freshness.${k}`);
      }
      if ("result" in cf && !CAPABILITY_FRESHNESS_RESULT_ENUM.includes(cf.result)) {
        fail(findings, "capability_freshness_result_enum", `checks.capability_freshness.result=${JSON.stringify(cf.result)} not in ${CAPABILITY_FRESHNESS_RESULT_ENUM.join(", ")}`);
      }
      if ("oracles" in cf) {
        if (!Array.isArray(cf.oracles)) {
          fail(findings, "capability_freshness_oracles_type", "checks.capability_freshness.oracles must be an array");
        } else {
          for (let i = 0; i < cf.oracles.length; i += 1) {
            if (typeof cf.oracles[i] !== "string") {
              fail(findings, "capability_freshness_oracles_item_type", `checks.capability_freshness.oracles[${i}] must be a string`);
            }
          }
        }
      }
    }
  }

  // plan_changeset_class
  if ("plan_changeset_class" in checks && !PLAN_CHANGESET_CLASS_ENUM.includes(checks.plan_changeset_class)) {
    fail(findings, "plan_changeset_class_enum", `checks.plan_changeset_class=${JSON.stringify(checks.plan_changeset_class)} not in ${PLAN_CHANGESET_CLASS_ENUM.join(", ")}`);
  }

  // lane
  if ("lane" in checks && !LANE_ENUM.includes(checks.lane)) {
    fail(findings, "lane_enum", `checks.lane=${JSON.stringify(checks.lane)} not in ${LANE_ENUM.join(", ")}`);
  }
}

function validateReceipt(obj, schema) {
  const findings = [];
  if (obj.__parse_error) {
    fail(findings, "json_parse", obj.__parse_error);
    return findings;
  }

  const required = schema.required || [];
  for (const k of required) {
    if (!(k in obj)) fail(findings, "required_key", `missing ${k}`);
  }

  const allowedTop = new Set(Object.keys(schema.properties || {}));
  for (const k of Object.keys(obj)) {
    if (!allowedTop.has(k)) fail(findings, "additional_property", `unknown top-level key ${k}`);
  }

  if (obj.schema_version !== 1) {
    fail(findings, "schema_version", `expected schema_version=1, got ${JSON.stringify(obj.schema_version)}`);
  }

  if ("wi_id" in obj && (typeof obj.wi_id !== "string" || !WI_ID_RE.test(obj.wi_id))) {
    fail(findings, "wi_id_pattern", `wi_id=${JSON.stringify(obj.wi_id)} does not match ^WI-\\d+$`);
  }

  if ("promoted_at" in obj && (typeof obj.promoted_at !== "string" || !ISO_DATETIME_RE.test(obj.promoted_at))) {
    fail(findings, "promoted_at_format", `promoted_at=${JSON.stringify(obj.promoted_at)} must be ISO-8601 date-time (YYYY-MM-DDTHH:MM:SS[.f]Z|±HH:MM)`);
  }

  if ("enforced_after" in obj && (typeof obj.enforced_after !== "string" || !ISO_DATE_RE.test(obj.enforced_after))) {
    fail(findings, "enforced_after_format", `enforced_after=${JSON.stringify(obj.enforced_after)} must be YYYY-MM-DD`);
  }

  if ("source_proposal" in obj && (typeof obj.source_proposal !== "string" || !PROPOSAL_PATH_RE.test(obj.source_proposal))) {
    fail(findings, "source_proposal_pattern", `source_proposal=${JSON.stringify(obj.source_proposal)} must match ^proposals/.+\\.md$`);
  }

  if ("decision" in obj && !DECISION_ENUM.includes(obj.decision)) {
    fail(findings, "decision_enum", `decision=${JSON.stringify(obj.decision)} not in ${DECISION_ENUM.join(", ")}`);
  }

  if ("reviewer" in obj && (typeof obj.reviewer !== "string" || obj.reviewer.length < 3)) {
    fail(findings, "reviewer_minlength", `reviewer must be a string of length >= 3, got ${JSON.stringify(obj.reviewer)}`);
  }

  if ("grandfathered" in obj && typeof obj.grandfathered !== "boolean") {
    fail(findings, "grandfathered_type", `grandfathered must be a boolean, got ${JSON.stringify(obj.grandfathered)}`);
  }
  if ("bootstrap" in obj && typeof obj.bootstrap !== "boolean") {
    fail(findings, "bootstrap_type", `bootstrap must be a boolean, got ${JSON.stringify(obj.bootstrap)}`);
  }

  if ("checks" in obj) validateChecksBlock(obj.checks, findings);

  // allOf conditionals
  if (obj.decision === "refused") {
    if (!("refusal_reason" in obj)) {
      fail(findings, "refusal_reason_required", "decision=refused requires refusal_reason");
    } else if (typeof obj.refusal_reason !== "string" || obj.refusal_reason.length < 10) {
      fail(findings, "refusal_reason_minlength", "refusal_reason must be a string of length >= 10");
    }
  }

  if (obj.decision === "grandfathered" && obj.grandfathered !== true) {
    fail(findings, "grandfathered_flag", "decision=grandfathered requires grandfathered: true");
  }

  if (obj.decision !== "grandfathered" && obj.grandfathered === true) {
    fail(findings, "non_grandfathered_flag", "only decision=grandfathered may set grandfathered: true");
  }

  if (obj.decision !== "grandfathered" && obj.checks) {
    const c = obj.checks;
    if (c.concrete_contract === "n/a") fail(findings, "non_grandfathered_check", "non-grandfathered receipt has concrete_contract=n/a");
    if (c.severity_taxonomy && c.severity_taxonomy.rated === "n/a") fail(findings, "non_grandfathered_check", "non-grandfathered receipt has severity_taxonomy.rated=n/a");
    if (c.host_agnostic && c.host_agnostic.result === "n/a") fail(findings, "non_grandfathered_check", "non-grandfathered receipt has host_agnostic.result=n/a");
    if (c.capability_freshness && c.capability_freshness.result === "n/a") fail(findings, "non_grandfathered_check", "non-grandfathered receipt has capability_freshness.result=n/a");
    if (c.plan_changeset_class === "n/a") fail(findings, "non_grandfathered_check", "non-grandfathered receipt has plan_changeset_class=n/a");
  }

  if (obj.bootstrap === true && obj.decision !== "accepted" && obj.decision !== "bound-to-proposal") {
    fail(findings, "bootstrap_decision", `bootstrap=true requires decision in [accepted, bound-to-proposal], got ${JSON.stringify(obj.decision)}`);
  }

  return findings;
}

// Read DONE.md and extract every WI row. Returns [{wi, status, closed, subject}].
function loadDoneWIs() {
  if (!fs.existsSync(DONE_PATH)) return [];
  const lines = fs.readFileSync(DONE_PATH, "utf8").split(/\r?\n/);
  const out = [];
  const rowRe = /^\| \[(WI-\d+)\]\([^)]+\) \| ([^|]+?) \| ([^|]+?) \| (.+?) \|$/;
  for (const line of lines) {
    const m = rowRe.exec(line);
    if (!m) continue;
    out.push({
      wi: m[1],
      status: m[2].trim(),
      closed: m[3].trim(),
      subject: m[4].trim(),
    });
  }
  return out;
}

// An actionable WI is one that landed as work, NOT one that was rejected,
// superseded, split, or invalidated. The cross-ref check applies only to
// actionable WIs whose enforced_after cutoff implies a receipt is required.
const ACTIONABLE_STATUSES = new Set(["verified", "VERIFIED"]);

function isActionable(status) {
  return ACTIONABLE_STATUSES.has(String(status || "").trim());
}

// Cross-ref logic: every actionable WI promoted on or after the active
// enforced_after cutoff (= the latest non-grandfathered, non-bootstrap
// receipt's enforced_after, OR the WI-341 bootstrap receipt's enforced_after
// when nothing else exists) MUST have a receipt. Pre-cutoff WIs are allowed
// to be missing OR carry a grandfathered receipt.
function resolveEnforcedCutoff(receipts) {
  // Use WI-341 (the bootstrap receipt that BOUNDED the gate) as the source of
  // truth — its enforced_after field is the moment the gate goes live.
  const wi341 = receipts.find((r) => r.obj && r.obj.wi_id === "WI-341");
  if (wi341 && wi341.obj.enforced_after) return wi341.obj.enforced_after;
  // Fallback: latest enforced_after among any receipt.
  let max = null;
  for (const r of receipts) {
    if (r.obj && r.obj.enforced_after && (!max || r.obj.enforced_after > max)) max = r.obj.enforced_after;
  }
  return max;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const schema = loadSchema();
  if (!schema) {
    console.error(`Schema not found at ${SCHEMA_PATH}`);
    process.exit(2);
  }

  const files = listReceiptFiles(args.wi);
  // Targeted mode (--wi <ID>) must fail loudly when the requested receipt is
  // absent. Otherwise the script silently passes with "0 receipts found",
  // which lets future tranche 2b/c gating logic green-light a WI that has
  // no receipt at all. PR #130 review MEDIUM addressed.
  if (args.wi && files.length === 0) {
    const message = `No receipt found at .svc/promotion-receipts/${args.wi}.json`;
    if (args.json) {
      process.stdout.write(JSON.stringify({ error: message, requested_wi: args.wi }, null, 2) + "\n");
    } else {
      process.stderr.write(`${message}\n`);
    }
    process.exit(1);
  }
  const receipts = files.map((f) => ({ file: f, obj: readReceipt(f) }));
  const perReceipt = receipts.map((r) => ({
    wi: r.obj.wi_id || r.file.replace(/\.json$/, ""),
    file: r.file,
    findings: validateReceipt(r.obj, schema),
    decision: r.obj.decision,
    grandfathered: r.obj.grandfathered,
    bootstrap: r.obj.bootstrap,
    enforced_after: r.obj.enforced_after,
  }));

  const cutoff = resolveEnforcedCutoff(receipts);
  const doneWIs = loadDoneWIs();
  // A WI is "post-cutoff" if its Closed date is on/after the cutoff.
  // Without a Closed date, we cannot prove it's post-cutoff — skip.
  // Targeted mode (--wi <ID>) intentionally skips the global cross-ref —
  // it validates a single receipt, not the whole repo. Otherwise targeted
  // mode would always fail in --strict the moment any other WI in DONE.md
  // is post-cutoff (because only the targeted receipt is loaded).
  const postCutoffActionable = (!args.wi && cutoff)
    ? doneWIs.filter((w) => isActionable(w.status) && /^\d{4}-\d{2}-\d{2}$/.test(w.closed) && w.closed >= cutoff)
    : [];

  const receiptByWi = new Map(perReceipt.map((p) => [p.wi, p]));
  const missingReceipts = postCutoffActionable
    .filter((w) => !receiptByWi.has(w.wi))
    .map((w) => ({ wi: w.wi, closed: w.closed, status: w.status }));

  // Schema-validation failures
  const schemaFailures = perReceipt.filter((p) => p.findings.some((f) => f.severity === "fail"));

  const summary = {
    enforced_cutoff: cutoff,
    receipts_total: perReceipt.length,
    receipts_with_schema_failures: schemaFailures.length,
    receipts: perReceipt,
    post_cutoff_actionable: postCutoffActionable.length,
    missing_receipts: missingReceipts,
  };

  if (args.json) {
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  } else {
    process.stdout.write(`enforced_cutoff:           ${cutoff || "(none)"}\n`);
    process.stdout.write(`receipts found:            ${perReceipt.length}\n`);
    process.stdout.write(`schema failures:           ${schemaFailures.length}\n`);
    process.stdout.write(`post-cutoff actionable WIs in DONE.md: ${postCutoffActionable.length}\n`);
    process.stdout.write(`missing receipts:          ${missingReceipts.length}\n`);
    for (const p of perReceipt) {
      const fc = p.findings.filter((f) => f.severity === "fail").length;
      const tag = fc > 0 ? `FAIL (${fc})` : "ok";
      process.stdout.write(`  [${tag}] ${p.wi}: decision=${p.decision}, bootstrap=${p.bootstrap}, grandfathered=${p.grandfathered}\n`);
      for (const f of p.findings) {
        process.stdout.write(`        - ${f.severity}: ${f.check} — ${f.message}\n`);
      }
    }
    if (missingReceipts.length > 0) {
      process.stdout.write(`\n  Post-cutoff actionable WIs without a receipt:\n`);
      for (const m of missingReceipts) {
        process.stdout.write(`    • ${m.wi} (closed ${m.closed}, status ${m.status})\n`);
      }
    }
  }

  const hasSchemaFailure = schemaFailures.length > 0;
  const hasMissingInStrict = args.strict && missingReceipts.length > 0;
  if (hasSchemaFailure || hasMissingInStrict) process.exit(1);
  process.exit(0);
}

main();

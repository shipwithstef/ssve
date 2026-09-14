#!/usr/bin/env bash
# WI-554: centrally installed check-chain-receipts verifies reviewer evidence
# against the consumer/invocation repo root, not the framework SCRIPT_DIR parent.
# validator_path: test-framework/evals/tier-1/validate-consumer-evidence-root.sh
# failure_class: SCRIPT_DIR-anchored verifyReviewerEvidence root
# expected_runtime_budget: <10s, no network, no reviewer dispatch
set -euo pipefail

# Keep standalone invocation isolated from active host/session state.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/fixture-home.sh"
svc_require_fixture "$@"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CHECKER="$ROOT/scripts/check-chain-receipts.mjs"

# Static contract: evidence root must be the consumer cache root helper.
node --input-type=module - "$CHECKER" <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(process.argv[2], "utf8");
assert.match(src, /verifyReviewerEvidence\(\{\s*root:\s*repoRootForCache\(\)/);
assert.doesNotMatch(
  src,
  /verifyReviewerEvidence\(\{\s*root:\s*join\(SCRIPT_DIR,\s*"\.\."\)/,
  "verifyReviewerEvidence must not use SCRIPT_DIR parent as evidence root",
);
NODE

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
chmod 700 "$TMP"

node --input-type=module - "$ROOT" "$TMP" "$CHECKER" <<'NODE'
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const [root, tmp, checker] = process.argv.slice(2);
const { EXTERNAL_REVIEW_LAUNCHER_VERSION } = await import(pathToFileURL(path.join(root, "scripts/run-external-review.mjs")));
const wi = "WI-T554";
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  assert.equal(r.status, 0, `${cmd} ${args.join(" ")}\n${r.stderr || r.stdout}`);
  return r.stdout.trim();
};

// Separate consumer repo — not the framework checkout that owns SCRIPT_DIR.
const consumer = path.join(tmp, "consumer");
fs.mkdirSync(consumer, { recursive: true, mode: 0o700 });
run("git", ["init", "-b", "main"], { cwd: consumer });
run("git", ["config", "user.name", "fixture"], { cwd: consumer });
run("git", ["config", "user.email", "fixture@example.invalid"], { cwd: consumer });
fs.writeFileSync(path.join(consumer, "app.txt"), "consumer-app\n", { mode: 0o600 });
run("git", ["add", "app.txt"], { cwd: consumer });
run("git", ["commit", "-m", "consumer seed"], { cwd: consumer });
const head = run("git", ["rev-parse", "HEAD"], { cwd: consumer });
const tree = run("git", ["rev-parse", "HEAD^{tree}"], { cwd: consumer });

const { candidateTreeIdentity, issueExternalReviewProvenance } = await import(
  pathToFileURL(path.join(root, "scripts/lib/external-review-provenance.mjs")).href
);
const identity = candidateTreeIdentity(consumer, { candidateSha: head, treeHash: tree });
const candidate = identity.candidate_digest;

const dir = path.join(consumer, ".svc/external-review-artifacts/plan", candidate, "final");
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const packagePath = path.join(dir, "review-package.bin");
const output = path.join(dir, "findings.json");
const receiptPath = path.join(dir, "receipt.json");
const transportPath = path.join(dir, "agy-transport-receipt.json");
fs.writeFileSync(packagePath, Buffer.from(`candidate_digest=${candidate}\n`), { mode: 0o600 });
const findings = {
  schema_version: 1,
  review_kind: "plan",
  rubric_score: 10,
  rubric_failures: [],
  dependencies_needing_read: [],
  reviewer: { host: "agy", family: "google", model: "Gemini 3.6 Flash (High)", effort: "high" },
  verdict: "pass",
  summary: "pass",
  findings: [],
  certifications: [],
};
fs.writeFileSync(output, JSON.stringify(findings), { mode: 0o600 });
const commands = [{ binary: "agy", argv: ["review", "--frozen", candidate] }];
const tuple = {
  orchestrator: "codex",
  host: "agy",
  family: "google",
  model: "Gemini 3.6 Flash (High)",
  effort: "high",
};
const nilOverride = {
  used: false,
  authority: null,
  source: null,
  path: null,
  expected_sha256: null,
  actual_sha256: null,
};
fs.writeFileSync(
  transportPath,
  JSON.stringify({
    schema_version: 1,
    request_id: crypto.randomUUID(),
    started_at: "2026-08-21T00:00:00.000Z",
    finished_at: "2026-08-21T00:00:01.000Z",
    status: "success",
    classification: "success",
    requested_model: tuple.model,
    requested_effort: tuple.effort,
    response_schema_sha256: null,
    model_attestation: { level: "requested_accepted", evidence: "fixture exact argv" },
    package_sha256: sha(fs.readFileSync(packagePath)),
    package_bytes: 1,
    transport: "stdin_to_private_mode_0600_file",
    sandbox: true,
    mode: "plan",
    timeout_seconds: 1200,
    identical_json_repetitions_collapsed: 0,
    exit_code: 0,
    signal: null,
    artifacts: { output, stderr: path.join(dir, "stderr.log") },
  }),
  { mode: 0o600 },
);
const launcherReceipt = {
  schema_version: 2,
  launcher_version: EXTERNAL_REVIEW_LAUNCHER_VERSION,
  cli_version: "fixture-cli",
  request_id: crypto.randomUUID(),
  review_kind: "plan",
  candidate_digest: candidate,
  package_sha256: sha(fs.readFileSync(packagePath)),
  findings_schema_sha256: sha(
    fs.readFileSync(path.join(root, "schemas/external-review-findings.schema.json")),
  ),
  findings_sha256: sha(fs.readFileSync(output)),
  cache_key: "c".repeat(64),
  fixture_mode: false,
  started_at: "2026-08-21T00:00:00.000Z",
  finished_at: "2026-08-21T00:00:01.000Z",
  status: "success",
  classification: "success",
  requested_tuple: tuple,
  invocation_tuple: tuple,
  effective_tuple: tuple,
  attempts: [{
    index: 1,
    tuple,
    started_at: "2026-08-21T00:00:00.000Z",
    finished_at: "2026-08-21T00:00:01.000Z",
    exit_code: 0,
    classification: "success",
    command: commands[0],
    artifacts: { findings: output },
    usage: {},
  }],
  fallback: { eligible: false, used: false, reason: null },
  override: nilOverride,
  policy: {
    version: 2,
    profile: "production:agy",
    source: "owner-config",
    resolved_at: "2026-08-21T00:00:00.000Z",
    effective_window: { starts_at: null, ends_at: null },
    cutover_utc: null,
    cutover_local: null,
    timezone: null,
    selection_sha256: null,
    selection_expires_at: null,
    selection_authority: "repository-owner",
  },
  protocol: {
    process_invocations: 1,
    configured_turn_ceiling: null,
    configured_budget_usd: null,
    reported_turns: null,
    stop_reason: null,
    terminal_reason: null,
    errors: [],
  },
  route: {
    kind: "owner_config_primary",
    switching_enabled: false,
    cli_fallback_configured: false,
    evidence: "requested_primary",
  },
  effective_effort: { value: "high", provenance: "requested" },
  model_attestation: {
    level: "requested_accepted",
    requested_model: tuple.model,
    observed_models: [],
    evidence: "canonical launcher",
  },
  phase_guard: {
    applicable: true,
    kind: "plan",
    decision: "allow",
    reason: null,
    wi,
    pre_execution_base: head,
    plan_manifest_sha256: candidate,
    exec_record_present: null,
    exec_record_path: null,
    implementation_diverged: null,
    diverged_files: [],
    base_resolved: true,
    override: { ...nilOverride, kind: null },
  },
  package_context: {
    version: 1,
    context_root: consumer,
    base_package_sha256: sha(fs.readFileSync(packagePath)),
    files: [],
  },
  cache: { disposition: "published", reusable: true, entry: null },
  artifacts: { findings: output, receipt: receiptPath, package: packagePath },
  usage: {
    agy_transport_receipt: transportPath,
    agy_transport_receipt_sha256: sha(fs.readFileSync(transportPath)),
  },
  reviewer_run: { commands, output_artifacts: [output] },
};
fs.writeFileSync(receiptPath, JSON.stringify(launcherReceipt), { mode: 0o600 });
issueExternalReviewProvenance({ receiptPath, packagePath, findingsPath: output });

const artifact = (file) => ({
  path: path.relative(consumer, file),
  sha256: sha(fs.readFileSync(file)),
});
const ts = "2026-08-21T00:00:00.000Z";
const reviewPlan = {
  receipt_type: "review-plan",
  schema_version: 3,
  wi,
  candidate_digest: candidate,
  candidate_sha: head,
  tree_hash: tree,
  self_review: { orchestrator: "codex", findings_count: 0, notes: "self" },
  adversarial_review: {
    primary_reviewer_host: "agy",
    primary_used: true,
    fallback_host: "agy",
    fallback_used: false,
    findings: [],
    iteration_count: 1,
  },
  verdict: "pass",
  timestamp: ts,
  reviewer_evidence: {
    independent: true,
    submitter_only: false,
    launcher_receipts: [artifact(receiptPath)],
    commands,
    output_artifacts: [artifact(output)],
    deletion_bearing: false,
    parse_collect_evidence: [],
  },
};
// schema_version 1 plan/exec — grandfathered shapes used by other tier-1 fixtures
const planManifest = {
  receipt_type: "plan-manifest",
  schema_version: 1,
  wi,
  mode: "inline",
  scope: {},
  dependencies: [],
  decision_trace: [],
  task_graph: [],
  validation_plan: [],
  risk_rollback: {},
  timestamp: ts,
  execution_command_sequence: [],
};
const execRecord = {
  receipt_type: "exec-record",
  schema_version: 1,
  wi,
  diff_hash: "legacy-fixture",
  files_touched: ["app.txt"],
  dispatch_model: "fixture",
  timestamp: ts,
};

const writeSlot = (type, body) => {
  const slot = `slot::${type}::${wi}::${head}`;
  let envelope = {};
  try {
    envelope = JSON.parse(
      spawnSync("git", ["notes", "--ref=svc-receipts", "show", head], {
        cwd: consumer,
        encoding: "utf8",
      }).stdout || "{}",
    );
  } catch {
    envelope = {};
  }
  if (!envelope || typeof envelope !== "object") envelope = {};
  envelope[slot] = body;
  // Also keep type-keyed legacy projection for readers that still expect it.
  envelope[type] = body;
  const w = spawnSync("git", ["notes", "--ref=svc-receipts", "add", "-f", "-F", "-", head], {
    cwd: consumer,
    input: JSON.stringify(envelope),
    encoding: "utf8",
  });
  assert.equal(w.status, 0, `note write ${type}: ${w.stderr}`);
};

writeSlot("plan-manifest", planManifest);
writeSlot("exec-record", execRecord);

const emitReview = spawnSync(
  process.execPath,
  [path.join(root, "scripts/emit-receipt.mjs"), "--type", "review-plan", "--wi", wi, "--sha", head],
  { cwd: consumer, input: JSON.stringify(reviewPlan), encoding: "utf8" },
);
assert.equal(emitReview.status, 0, `emit review-plan failed: ${emitReview.stderr || emitReview.stdout}`);

// Central checker (SCRIPT_DIR under framework) with cwd = consumer.
const check = () =>
  spawnSync(process.execPath, [checker, "--sha", head, "--wi", wi, "--consumer", "execute-changeset"], {
    cwd: consumer,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_ALTERNATE_OBJECT_DIRECTORIES: "",
      SVC_REVIEW_EVIDENCE_STORE: "",
    },
  });

const good = check();
assert.equal(good.status, 0, `valid consumer evidence must pass central checker\n${good.stderr || good.stdout}`);

// Tamper candidate digest in the note envelope; keep launcher bytes intact.
const show = spawnSync("git", ["notes", "--ref=svc-receipts", "show", head], {
  cwd: consumer,
  encoding: "utf8",
});
assert.equal(show.status, 0, show.stderr);
const env = JSON.parse(show.stdout);
const slot = `slot::review-plan::${wi}::${head}`;
const target = env[slot] || env["review-plan"];
assert.ok(target, "review-plan receipt missing from note");
target.candidate_digest = "b".repeat(64);
const tamper = spawnSync("git", ["notes", "--ref=svc-receipts", "add", "-f", "-F", "-", head], {
  cwd: consumer,
  input: JSON.stringify(env),
  encoding: "utf8",
});
assert.equal(tamper.status, 0, tamper.stderr);
// Drop mirror cache so the checker re-reads the tampered note.
fs.rmSync(path.join(consumer, ".svc/receipts"), { recursive: true, force: true });
const bad = check();
assert.notEqual(bad.status, 0, "candidate digest mismatch must fail closed");
assert.match(`${bad.stderr}\n${bad.stdout}`, /candidate|digest|evidence|invalid|missing/i);
NODE

echo "PASS: central check-chain-receipts uses consumer repoRootForCache for reviewer evidence"

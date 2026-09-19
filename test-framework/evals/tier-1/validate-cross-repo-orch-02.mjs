#!/usr/bin/env node
/**
 * validator_path: test-framework/evals/tier-1/validate-cross-repo-orch-02.mjs
 * failure_class: origin prompt does not auto-bind a named WI/project to a linked worktree without a user CLI
 * promotion_signal: owner UX 2026-09-18 after #66 CLI; any onboarded svc project from any folder
 * expected_runtime_budget: <5s hermetic
 * why_tier_2_or_targeted_is_insufficient: prompt hook + isolation skills-path is the hot path
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { classifyMutation } from "../../../hooks/svc-worktree-isolation-guard.mjs";
import { dispatchRole, migrateSession } from "../../../scripts/lib/cross-repo-orch.mjs";
import {
  isLinkedWorktree,
  resolveOriginIntent,
  originOrchestratorContext,
  bindIfNeeded,
  resetDiscoverCache,
  discoverCallCount,
  USER_CLI_HOMEWORK_RE,
} from "../../../scripts/lib/resolve-named-worktree.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const FIXTURE = JSON.parse(fs.readFileSync(path.join(ROOT, "test-framework/evals/tier-1/fixtures/cross-repo-orch-02.json"), "utf8"));
const HOOK = path.join(ROOT, "hooks", "svc-origin-orchestrator-prompt.mjs");
const ORCH_SCRIPT = path.join(ROOT, "scripts", "svc-orchestrate.mjs");

function gitInit(dir, branch) {
  fs.mkdirSync(dir, { recursive: true });
  execFileSync("git", ["init", "-b", branch], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["-C", dir, "config", "user.email", "orch@example.test"], { stdio: "ignore" });
  execFileSync("git", ["-C", dir, "config", "user.name", "orch"], { stdio: "ignore" });
  fs.writeFileSync(path.join(dir, "README.md"), `${branch}\n`);
  execFileSync("git", ["-C", dir, "add", "README.md"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["-C", dir, "commit", "-m", "init"], { cwd: dir, stdio: "ignore" });
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-cross-repo-orch-02-"));
const worktreesRoot = path.join(tmp, "worktrees");
const appWsRoot = path.join(tmp, "app-workspaces");
process.env.SVC_WORKTREES_ROOT = worktreesRoot;
process.env.SVC_APP_WORKSPACES_ROOT = appWsRoot;
const origin = path.join(tmp, "hourshub-port");
const targetRepo = path.join(tmp, "ssve");
const acmeRepo = path.join(tmp, "acme");
const decoyRepo = path.join(tmp, "notaproject-repo");
gitInit(origin, "main");
gitInit(targetRepo, "main");
gitInit(acmeRepo, "main");
gitInit(decoyRepo, "main");
const linked = path.join(appWsRoot, "hourshub-worktrees", "wt-lane-account-customer-billing-live");
fs.mkdirSync(path.dirname(linked), { recursive: true });
execFileSync("git", ["-C", origin, "worktree", "add", "-b", "wt-lane-account-customer-billing-live", linked], { stdio: "ignore" });
const ssveWt = path.join(worktreesRoot, "ssve", "feature-orch-02");
fs.mkdirSync(path.dirname(ssveWt), { recursive: true });
execFileSync("git", ["-C", targetRepo, "worktree", "add", "-b", "feature-orch-02", ssveWt], { stdio: "ignore" });
const acmeWt = path.join(worktreesRoot, "acme", "feature-billing");
fs.mkdirSync(path.dirname(acmeWt), { recursive: true });
execFileSync("git", ["-C", acmeRepo, "worktree", "add", "-b", "feature-billing", acmeWt], { stdio: "ignore" });
const decoyWt = path.join(appWsRoot, "notaproject", "feature-x");
fs.mkdirSync(path.dirname(decoyWt), { recursive: true });
execFileSync("git", ["-C", decoyRepo, "worktree", "add", "-b", "feature-x", decoyWt], { stdio: "ignore" });
function onboard(wt, wi) {
  fs.mkdirSync(path.join(wt, "docs", "specs", "work-items"), { recursive: true });
  fs.writeFileSync(path.join(wt, "docs", "specs", "work-items", `${wi}.md`), `# ${wi}\n`);
  fs.mkdirSync(path.join(wt, ".svc"), { recursive: true });
  fs.writeFileSync(path.join(wt, ".svc", `lane-tasks-${wi}.json`), JSON.stringify({ wi }) + "\n");
}
onboard(ssveWt, "WI-FW-CROSS-REPO-ORCH-02");
onboard(acmeWt, "WI-ACME-BILLING-01");
onboard(linked, "WI-ACCOUNT-MULTICONTEXT-01");
onboard(decoyWt, "WI-DECOY-01");
resetDiscoverCache();

let failed = 0;
function check(name, fn) {
  try {
    fn();
    process.stdout.write(`  ok ${name}\n`);
  } catch (error) {
    failed += 1;
    process.stderr.write(`  not ok ${name}: ${error.message}\n`);
  }
}

check("linked vs default checkout", () => {
  assert.equal(isLinkedWorktree(origin), false);
  assert.equal(isLinkedWorktree(linked), true);
  assert.equal(isLinkedWorktree(ssveWt), true);
  assert.equal(isLinkedWorktree(acmeWt), true);
});

check("AC-BIND-1 WI file resolution and cwd wins", () => {
  resetDiscoverCache();
  const fromTmp = resolveOriginIntent("WI-ACME-BILLING-01", tmp);
  assert.equal(fromTmp?.how, "wi");
  assert.equal(fs.realpathSync(fromTmp.worktree), fs.realpathSync(acmeWt));
  const fromSelf = resolveOriginIntent("WI-ACME-BILLING-01", acmeWt);
  assert.equal(fs.realpathSync(fromSelf.worktree), fs.realpathSync(acmeWt));
});

check("AC-BIND-2 any onboarded project id, not HoursHub-only", () => {
  resetDiscoverCache();
  const acme = resolveOriginIntent("acme", tmp);
  assert.equal(acme?.how, "project");
  assert.equal(fs.realpathSync(acme.worktree), fs.realpathSync(acmeWt));
  const hub = resolveOriginIntent("hourshub", tmp);
  assert.equal(fs.realpathSync(hub.worktree), fs.realpathSync(linked));
  const ssve = resolveOriginIntent("ssve", tmp);
  assert.equal(fs.realpathSync(ssve.worktree), fs.realpathSync(ssveWt));
});

check("AC-BIND-2 project-only does not mtime-migrate", () => {
  resetDiscoverCache();
  const intent = resolveOriginIntent("acme", tmp);
  assert.equal(intent.wi, "");
  assert.ok(intent.candidate_wis.includes("WI-ACME-BILLING-01"));
  const sessionId = "dddddddd-eeee-ffff-0000-111111111111";
  const result = bindIfNeeded(intent, { host: "cursor", cwd: tmp, sessionId, request: "acme" });
  assert.equal(result.bound, false);
  assert.equal(result.reason, "no_wi");
  assert.equal(fs.existsSync(path.join(acmeWt, ".svc", "session-contract.jsonl")), false);
  fs.writeFileSync(
    path.join(acmeWt, ".svc", "lane-tasks-WI-ACME-BILLING-01.json"),
    JSON.stringify({ wi: "WI-ACME-BILLING-01", status: "in_progress" }) + "\n",
  );
  resetDiscoverCache();
  const ready = resolveOriginIntent("acme", tmp);
  assert.equal(ready.wi, "WI-ACME-BILLING-01");
});

check("AC-BIND-3 context has no user CLI homework", () => {
  const ctx = originOrchestratorContext({ wi: "WI-FW-CROSS-REPO-ORCH-02", worktree: ssveWt, how: "wi" }, { host: "cursor" });
  assert.match(ctx, /user does not run a CLI/i);
  assert.doesNotMatch(ctx, USER_CLI_HOMEWORK_RE);
  assert.match(ctx, /xhigh/);
  assert.match(ctx, /effort high/);
});

check("AC-BIND-4 hook exit 0 empty {} on no match", () => {
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ prompt: "hello" }),
    encoding: "utf8",
    env: { ...process.env, SVC_WORKTREES_ROOT: worktreesRoot, SVC_APP_WORKSPACES_ROOT: appWsRoot },
  });
  assert.equal(out.trim(), "{}");
});

check("AC-BIND-6 hook source has no spawn", () => {
  const src = fs.readFileSync(HOOK, "utf8");
  assert.doesNotMatch(src, /spawn|child_process/);
});

check("AC-DISPATCH-1 PLAN xhigh", () => {
  const plan = dispatchRole({
    role: "PLAN",
    wi: "WI-FW-CROSS-REPO-ORCH-02",
    worktree: ssveWt,
    origin_host: "cursor",
    dry_run: true,
    manifest_root: ROOT,
  });
  const effort = plan.argv.indexOf("--effort");
  assert.ok(effort >= 0);
  assert.equal(plan.argv[effort + 1], "xhigh");
  assert.ok(plan.argv.includes("grok-4.6"));
  assert.equal(plan.effort, "xhigh");
  assert.equal(plan.svc_grok_effort, "xhigh");
});

check("AC-DISPATCH-2 EXEC high", () => {
  const exec = dispatchRole({
    role: "EXEC",
    wi: "WI-FW-CROSS-REPO-ORCH-02",
    worktree: ssveWt,
    origin_host: "cursor",
    dry_run: true,
    manifest_root: ROOT,
  });
  const effort = exec.argv.indexOf("--effort");
  assert.equal(exec.argv[effort + 1], "high");
  assert.equal(exec.effort, "high");
});

function argvFlag(argv, flag) {
  const index = argv.indexOf(flag);
  assert.ok(index >= 0, `missing ${flag}`);
  return argv[index + 1];
}

function isolatedEnv(overrides = {}) {
  const env = { ...process.env, ...overrides };
  delete env.SVC_REVIEWER_POLICY;
  delete env.SVC_DISPATCH_POLICY;
  return Object.assign(env, overrides);
}

function writeOwnerPolicy(file, policy) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${JSON.stringify(policy, null, 2)}\n`, { mode: 0o600 });
}

const v2Policy = {
  schema_version: 2,
  authority: "repository-owner",
  default_mode: "owner-test",
  modes: {
    "owner-test": {
      orchestrators: {
        grok: {
          plan: {
            release_authority: false,
            stations: [
              {
                id: "self-plan",
                kind: "inline-self",
                required: true,
                authority: "advisory",
                tuple: { host: "current", family: "xai", model: "grok-4.6", effort: "high" },
              },
              {
                id: "owner-plan-station",
                kind: "external",
                required: true,
                authority: "independent",
                tuple: { host: "codex", family: "openai", model: "gpt-6-astra", effort: "high" },
              },
            ],
          },
          exec: {
            release_authority: false,
            stations: [
              {
                id: "self-exec",
                kind: "inline-self",
                required: true,
                authority: "advisory",
                tuple: { host: "current", family: "xai", model: "grok-4.6", effort: "high" },
              },
              {
                id: "owner-mid-exec",
                kind: "external",
                required: true,
                authority: "independent",
                tuple: { host: "codex", family: "openai", model: "gpt-5.6-sol", effort: "high" },
              },
            ],
          },
        },
      },
    },
  },
};

const dispatchPolicy = {
  schema_version: 1,
  authority: "repository-owner",
  default_mode: "governed-test",
  modes: {
    "governed-test": {
      labels: {
        REVIEW: { host: "codex", family: "openai", model: "gpt-6-astra", effort: "high" },
      },
      review: {
        plan: {
          stations: [
            {
              id: "grok-plan-station",
              kind: "external",
              required: true,
              authority: "independent",
              tuple: { host: "grok", family: "xai", model: "grok-4.6", effort: "xhigh" },
            },
            {
              id: "owner-review-plan",
              kind: "external",
              required: true,
              authority: "independent",
              tuple: { host: "codex", family: "openai", model: "gpt-6-astra", effort: "high" },
            },
          ],
        },
        exec: {
          stations: [
            {
              id: "grok-exec-station",
              kind: "external",
              required: true,
              authority: "independent",
              tuple: { host: "grok", family: "xai", model: "grok-4.6", effort: "high" },
            },
            {
              id: "owner-astra-exec",
              kind: "external",
              required: true,
              authority: "independent",
              tuple: { host: "codex", family: "openai", model: "gpt-6-astra", effort: "high" },
            },
            {
              id: "owner-mid-exec",
              kind: "external",
              required: true,
              authority: "independent",
              tuple: { host: "codex", family: "openai", model: "gpt-5.6-sol", effort: "high" },
            },
          ],
        },
      },
    },
  },
};

check("AC-DISPATCH-3 REVIEW station ids come from owner policy, not literals", () => {
  const orchSrc = fs.readFileSync(path.join(ROOT, "scripts/lib/cross-repo-orch.mjs"), "utf8");
  const dispatchStart = orchSrc.indexOf("export function dispatchRole");
  const resolveStart = orchSrc.indexOf("export function resolveOwnerReviewStation");
  const pathStart = orchSrc.indexOf("export function ownerReviewPolicyPath");
  assert.ok(dispatchStart >= 0, "dispatchRole missing");
  assert.ok(resolveStart >= 0, "resolveOwnerReviewStation missing");
  assert.ok(pathStart >= 0, "ownerReviewPolicyPath missing");
  assert.match(orchSrc, /reviewer-policy-v2\.json/);
  assert.match(orchSrc, /dispatch-policy\.json/);
  assert.match(orchSrc, /SVC_DISPATCH_POLICY/);
  assert.match(orchSrc, /SVC_REVIEWER_POLICY/);
  assert.doesNotMatch(orchSrc, /cursor-fable-(plan|exec)/);
  assert.doesNotMatch(orchSrc, /astra-high-(plan|exec)/);

  const v2Path = path.join(tmp, "owner-v2", "reviewer-policy-v2.json");
  writeOwnerPolicy(v2Path, v2Policy);
  const v2Env = isolatedEnv({ SVC_REVIEWER_POLICY: v2Path, HOME: path.join(tmp, "empty-home") });
  const planReview = dispatchRole({
    role: "REVIEW",
    review_kind: "plan",
    wi: "WI-FW-CROSS-REPO-ORCH-02",
    worktree: ssveWt,
    origin_host: "cursor",
    dry_run: true,
    manifest_root: ROOT,
  }, v2Env);
  const execReview = dispatchRole({
    role: "REVIEW",
    review_kind: "exec",
    wi: "WI-FW-CROSS-REPO-ORCH-02",
    worktree: ssveWt,
    origin_host: "cursor",
    dry_run: true,
    manifest_root: ROOT,
  }, v2Env);
  assert.equal(argvFlag(planReview.argv, "--reviewer-station"), "owner-plan-station");
  assert.equal(argvFlag(execReview.argv, "--reviewer-station"), "owner-mid-exec");
  assert.equal(argvFlag(planReview.argv, "--reviewer-config"), v2Path);
  assert.equal(argvFlag(execReview.argv, "--reviewer-config"), v2Path);
  assert.equal(argvFlag(planReview.argv, "--orchestrator"), "grok");
  assert.ok(planReview.argv.some((arg) => String(arg).endsWith("run-external-review.mjs")));
  assert.ok(!planReview.argv.includes("--model"));
  assert.ok(!planReview.argv.includes("--profile"));
  assert.ok(!planReview.argv.includes("cursor-fable-plan"));
  assert.ok(!execReview.argv.includes("cursor-fable-exec"));
  assert.ok(!planReview.argv.includes("astra-high-plan"));
  assert.ok(!execReview.argv.includes("astra-high-exec"));
});

check("AC-DISPATCH-3 REVIEW dispatch-policy plan uses REVIEW label, exec uses last exec station", () => {
  const dispatchPath = path.join(tmp, "owner-dispatch", "dispatch-policy.json");
  writeOwnerPolicy(dispatchPath, dispatchPolicy);
  const env = isolatedEnv({ SVC_DISPATCH_POLICY: dispatchPath, HOME: path.join(tmp, "empty-home") });
  const planReview = dispatchRole({
    role: "REVIEW",
    review_kind: "plan",
    wi: "WI-FW-CROSS-REPO-ORCH-02",
    worktree: ssveWt,
    origin_host: "cursor",
    dry_run: true,
    manifest_root: ROOT,
  }, env);
  const execReview = dispatchRole({
    role: "REVIEW",
    review_kind: "exec",
    wi: "WI-FW-CROSS-REPO-ORCH-02",
    worktree: ssveWt,
    origin_host: "cursor",
    dry_run: true,
    manifest_root: ROOT,
  }, env);
  assert.equal(argvFlag(planReview.argv, "--reviewer-station"), "owner-review-plan");
  assert.equal(argvFlag(execReview.argv, "--reviewer-station"), "owner-mid-exec");
  assert.ok(!execReview.argv.includes("owner-astra-exec"));
  assert.equal(argvFlag(planReview.argv, "--reviewer-config"), dispatchPath);
});

check("AC-DISPATCH-3 labels.REVIEW Astra does not select exec station when exec ends in sol", () => {
  const home = path.join(tmp, "both-policy-home");
  writeOwnerPolicy(path.join(home, ".svc", "reviewer-policy-v2.json"), v2Policy);
  writeOwnerPolicy(path.join(home, ".svc", "dispatch-policy.json"), dispatchPolicy);
  const env = isolatedEnv({ HOME: home });
  const planReview = dispatchRole({
    role: "REVIEW",
    review_kind: "plan",
    wi: "WI-FW-CROSS-REPO-ORCH-02",
    worktree: ssveWt,
    origin_host: "cursor",
    dry_run: true,
    manifest_root: ROOT,
  }, env);
  const execReview = dispatchRole({
    role: "REVIEW",
    review_kind: "exec",
    wi: "WI-FW-CROSS-REPO-ORCH-02",
    worktree: ssveWt,
    origin_host: "cursor",
    dry_run: true,
    manifest_root: ROOT,
  }, env);
  assert.equal(argvFlag(planReview.argv, "--reviewer-station"), "owner-plan-station");
  assert.equal(argvFlag(execReview.argv, "--reviewer-station"), "owner-mid-exec");
  assert.ok(!execReview.argv.includes("owner-astra-exec"));
  assert.ok(!execReview.argv.includes("astra-high-exec"));
  assert.equal(argvFlag(execReview.argv, "--reviewer-config"), path.join(home, ".svc", "reviewer-policy-v2.json"));
});

check("AC-DISPATCH-3 explicit reviewer-policy exec stays on grok.exec last station", () => {
  const home = path.join(tmp, "compose-home");
  const v2Path = path.join(tmp, "compose-v2", "reviewer-policy-v2.json");
  writeOwnerPolicy(v2Path, v2Policy);
  writeOwnerPolicy(path.join(home, ".svc", "dispatch-policy.json"), dispatchPolicy);
  const env = isolatedEnv({ HOME: home, SVC_REVIEWER_POLICY: v2Path });
  const execReview = dispatchRole({
    role: "REVIEW",
    review_kind: "exec",
    wi: "WI-FW-CROSS-REPO-ORCH-02",
    worktree: ssveWt,
    origin_host: "cursor",
    dry_run: true,
    manifest_root: ROOT,
  }, env);
  assert.equal(argvFlag(execReview.argv, "--reviewer-station"), "owner-mid-exec");
  assert.ok(!execReview.argv.includes("owner-astra-exec"));
  assert.equal(argvFlag(execReview.argv, "--reviewer-config"), v2Path);
});

check("AC-DISPATCH-3E incomplete v2 REVIEW label is not masked by dispatch-policy", () => {
  const home = path.join(tmp, "mask-home");
  const incompleteV2 = structuredClone(v2Policy);
  incompleteV2.modes["owner-test"].labels = {
    REVIEW: { host: "codex", family: "openai", model: "gpt-6-astra" },
  };
  writeOwnerPolicy(path.join(home, ".svc", "reviewer-policy-v2.json"), incompleteV2);
  writeOwnerPolicy(path.join(home, ".svc", "dispatch-policy.json"), dispatchPolicy);
  const env = isolatedEnv({ HOME: home });
  let threw = false;
  try {
    dispatchRole({
      role: "REVIEW",
      review_kind: "exec",
      wi: "WI-FW-CROSS-REPO-ORCH-02",
      worktree: ssveWt,
      origin_host: "cursor",
      dry_run: true,
      manifest_root: ROOT,
    }, env);
  } catch (error) {
    threw = true;
    assert.equal(error.code, "orch_review_policy_invalid");
    assert.match(String(error.message), /host, family, model, and effort/);
  }
  assert.equal(threw, true);
});

check("AC-DISPATCH-3E labels.REVIEW missing host fail-closes", () => {
  const missingHost = structuredClone(dispatchPolicy);
  delete missingHost.modes["governed-test"].labels.REVIEW.host;
  const dispatchPath = path.join(tmp, "missing-host-label", "dispatch-policy.json");
  writeOwnerPolicy(dispatchPath, missingHost);
  const env = isolatedEnv({ SVC_DISPATCH_POLICY: dispatchPath, HOME: path.join(tmp, "empty-home") });
  let threw = false;
  try {
    dispatchRole({
      role: "REVIEW",
      review_kind: "exec",
      wi: "WI-FW-CROSS-REPO-ORCH-02",
      worktree: ssveWt,
      origin_host: "cursor",
      dry_run: true,
      manifest_root: ROOT,
    }, env);
  } catch (error) {
    threw = true;
    assert.equal(error.code, "orch_review_policy_invalid");
    assert.match(String(error.message), /host, family, model, and effort/);
  }
  assert.equal(threw, true);
});

check("AC-DISPATCH-3E unsupported policy schema_version fail-closes", () => {
  const future = structuredClone(dispatchPolicy);
  future.schema_version = 3;
  const dispatchPath = path.join(tmp, "future-schema", "dispatch-policy.json");
  writeOwnerPolicy(dispatchPath, future);
  const env = isolatedEnv({ SVC_DISPATCH_POLICY: dispatchPath, HOME: path.join(tmp, "empty-home") });
  let threw = false;
  try {
    dispatchRole({
      role: "REVIEW",
      review_kind: "plan",
      wi: "WI-FW-CROSS-REPO-ORCH-02",
      worktree: ssveWt,
      origin_host: "cursor",
      dry_run: true,
      manifest_root: ROOT,
    }, env);
  } catch (error) {
    threw = true;
    assert.equal(error.code, "orch_review_policy_invalid");
    assert.match(String(error.message), /schema_version/);
  }
  assert.equal(threw, true);
});

check("AC-DISPATCH-3E incomplete labels.REVIEW fail-closes", () => {
  const incomplete = structuredClone(dispatchPolicy);
  delete incomplete.modes["governed-test"].labels.REVIEW.effort;
  const dispatchPath = path.join(tmp, "incomplete-review-label", "dispatch-policy.json");
  writeOwnerPolicy(dispatchPath, incomplete);
  const env = isolatedEnv({ SVC_DISPATCH_POLICY: dispatchPath, HOME: path.join(tmp, "empty-home") });
  let threw = false;
  try {
    dispatchRole({
      role: "REVIEW",
      review_kind: "plan",
      wi: "WI-FW-CROSS-REPO-ORCH-02",
      worktree: ssveWt,
      origin_host: "cursor",
      dry_run: true,
      manifest_root: ROOT,
    }, env);
  } catch (error) {
    threw = true;
    assert.equal(error.code, "orch_review_policy_invalid");
    assert.match(String(error.message), /host, family, model, and effort/);
  }
  assert.equal(threw, true);
});

check("AC-DISPATCH-3E labels.REVIEW with no matching station fail-closes", () => {
  const drift = structuredClone(dispatchPolicy);
  drift.modes["governed-test"].labels.REVIEW = {
    host: "codex",
    family: "openai",
    model: "gpt-6-unconfigured",
    effort: "high",
  };
  const dispatchPath = path.join(tmp, "drift-dispatch", "dispatch-policy.json");
  writeOwnerPolicy(dispatchPath, drift);
  const env = isolatedEnv({ SVC_DISPATCH_POLICY: dispatchPath, HOME: path.join(tmp, "empty-home") });
  let threw = false;
  try {
    dispatchRole({
      role: "REVIEW",
      review_kind: "plan",
      wi: "WI-FW-CROSS-REPO-ORCH-02",
      worktree: ssveWt,
      origin_host: "cursor",
      dry_run: true,
      manifest_root: ROOT,
    }, env);
  } catch (error) {
    threw = true;
    assert.equal(error.code, "orch_review_station_missing");
    assert.match(String(error.message), /labels\.REVIEW/);
  }
  assert.equal(threw, true);
});

check("AC-DISPATCH-3E missing owner policy fail-closes with no default station", () => {
  const emptyHome = path.join(tmp, "no-policy-home");
  fs.mkdirSync(emptyHome, { recursive: true });
  const env = isolatedEnv({ HOME: emptyHome });
  let threw = false;
  try {
    dispatchRole({
      role: "REVIEW",
      review_kind: "plan",
      wi: "WI-FW-CROSS-REPO-ORCH-02",
      worktree: ssveWt,
      origin_host: "cursor",
      dry_run: true,
      manifest_root: ROOT,
    }, env);
  } catch (error) {
    threw = true;
    assert.equal(error.code, "orch_review_policy_missing");
    assert.match(String(error.message), /fail-closed|requires owner policy/i);
    assert.doesNotMatch(String(error.message), /cursor-fable|astra-high/);
  }
  assert.equal(threw, true);
});

check("AC-BIND-5 idempotent migrate does not double-append contract", () => {
  const sessionId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const first = migrateSession({
    wi: "WI-FW-CROSS-REPO-ORCH-02",
    worktree: ssveWt,
    origin_host: "cursor",
    session_id: sessionId,
    origin_cwd: linked,
    request: "first",
  }, { SVC_SESSION_ID: sessionId });
  assert.equal(first.skipped_contract_append, false);
  const before = fs.readFileSync(path.join(ssveWt, ".svc", "session-contract.jsonl"), "utf8").trim().split("\n").length;
  const second = migrateSession({
    wi: "WI-FW-CROSS-REPO-ORCH-02",
    worktree: ssveWt,
    origin_host: "cursor",
    session_id: sessionId,
    origin_cwd: linked,
    request: "second",
  }, { SVC_SESSION_ID: sessionId });
  assert.equal(second.skipped_contract_append, true);
  const after = fs.readFileSync(path.join(ssveWt, ".svc", "session-contract.jsonl"), "utf8").trim().split("\n").length;
  assert.equal(after, before);
});

check("AC-BIND-5 missing receipt reconstructs without append", () => {
  const sessionId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const receipt = path.join(ssveWt, ".svc", "orchestration", "WI-FW-CROSS-REPO-ORCH-02.migrate.json");
  fs.unlinkSync(receipt);
  const before = fs.readFileSync(path.join(ssveWt, ".svc", "session-contract.jsonl"), "utf8").trim().split("\n").length;
  const baton = migrateSession({
    wi: "WI-FW-CROSS-REPO-ORCH-02",
    worktree: ssveWt,
    origin_host: "cursor",
    session_id: sessionId,
    origin_cwd: linked,
    request: "reconstruct",
  }, { SVC_SESSION_ID: sessionId });
  assert.equal(baton.skipped_contract_append, true);
  const after = fs.readFileSync(path.join(ssveWt, ".svc", "session-contract.jsonl"), "utf8").trim().split("\n").length;
  assert.equal(after, before);
  assert.equal(fs.existsSync(receipt), true);
});

check("AC-BIND-5 concurrent migrateSession one contract line", () => {
  const sessionId = "11111111-2222-3333-4444-555555555555";
  const race = path.join(tmp, "race-migrate.mjs");
  fs.writeFileSync(race, `import { migrateSession } from ${JSON.stringify(path.join(ROOT, "scripts/lib/cross-repo-orch.mjs"))};
migrateSession({
  wi: "WI-FW-CROSS-REPO-ORCH-02",
  worktree: ${JSON.stringify(ssveWt)},
  origin_host: "cursor",
  session_id: ${JSON.stringify(sessionId)},
  origin_cwd: ${JSON.stringify(linked)},
  request: "race",
}, { SVC_SESSION_ID: ${JSON.stringify(sessionId)} });
`);
  execFileSync("bash", ["-lc", `node ${JSON.stringify(race)} & node ${JSON.stringify(race)} & wait`], { stdio: "ignore" });
  const lines = fs.readFileSync(path.join(ssveWt, ".svc", "session-contract.jsonl"), "utf8").trim().split("\n");
  const hits = lines.filter((line) => line.includes(sessionId));
  assert.equal(hits.length, 1);
});

check("AC-BIND-1E foreign session denied", () => {
  try {
    migrateSession({
      wi: "WI-FW-CROSS-REPO-ORCH-02",
      worktree: ssveWt,
      origin_host: "cursor",
      session_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      origin_cwd: linked,
    }, { SVC_SESSION_ID: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff" });
    assert.fail("expected orch_foreign");
  } catch (error) {
    assert.equal(error.code, "orch_foreign");
  }
});

check("AC-BIND-2E default checkout migrate throws orch_default_checkout", () => {
  try {
    migrateSession({
      wi: "WI-FW-CROSS-REPO-ORCH-02",
      worktree: targetRepo,
      origin_host: "cursor",
      session_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      origin_cwd: linked,
    }, { SVC_SESSION_ID: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" });
    assert.fail("expected orch_default_checkout");
  } catch (error) {
    assert.equal(error.code, "orch_default_checkout");
  }
});

check("AC-BIND-3E unknown WI is no_target; unknown token is not a project", () => {
  resetDiscoverCache();
  const nope = resolveOriginIntent("WI-NOPE-01", tmp);
  assert.equal(nope.miss, "no_target");
  assert.equal(resolveOriginIntent("nosuchproject", tmp), null);
});

check("AC-ISO-1 installed skills-path orchestrate from foreign cwd", () => {
  const skillsHome = path.join(tmp, "skills-home");
  const cursorScript = path.join(skillsHome, ".cursor", "skills", "scripts", "svc-orchestrate.mjs");
  const grokScript = path.join(skillsHome, ".grok", "skills", "scripts", "svc-orchestrate.mjs");
  fs.mkdirSync(path.dirname(cursorScript), { recursive: true });
  fs.mkdirSync(path.dirname(grokScript), { recursive: true });
  const real = fs.realpathSync(ORCH_SCRIPT);
  fs.symlinkSync(real, cursorScript);
  fs.symlinkSync(real, grokScript);
  const env = { ...process.env, SVC_SKILLS_HOME: skillsHome };
  for (const script of [cursorScript, grokScript]) {
    const allow = classifyMutation({
      toolName: "Bash",
      toolInput: { command: `node ${script} migrate --wi WI-FW-CROSS-REPO-ORCH-02 --worktree ${ssveWt} --json` },
      cwd: linked,
      sessionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    }, env);
    assert.equal(allow.allow, true, script);
    assert.equal(allow.classification, "origin-orchestrate", script);
  }
});

check("AC-ISO-2 mixed-repo Write still denied", () => {
  const deny = classifyMutation({
    toolName: "Write",
    toolInput: { file_path: path.join(ssveWt, "SECRET.md") },
    cwd: linked,
    sessionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  });
  assert.equal(deny.allow, false);
});

check("AC-ISO-3 lookalike cwd script is not origin-orchestrate", () => {
  const lookalike = path.join(linked, "scripts", "svc-orchestrate.mjs");
  fs.mkdirSync(path.dirname(lookalike), { recursive: true });
  fs.copyFileSync(ORCH_SCRIPT, lookalike);
  const deny = classifyMutation({
    toolName: "Bash",
    toolInput: { command: `node scripts/svc-orchestrate.mjs migrate --wi WI-FW-CROSS-REPO-ORCH-02 --worktree ${ssveWt} --json` },
    cwd: linked,
    sessionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  }, { ...process.env, SVC_SKILLS_HOME: path.join(tmp, "skills-home-empty") });
  assert.notEqual(deny.classification, "origin-orchestrate");
});

check("AC-HOT-1 regex-first does not scan on long prompts", () => {
  resetDiscoverCache();
  const miss = resolveOriginIntent("please review the landing page copy and the pricing table", tmp);
  assert.equal(miss, null);
  assert.equal(discoverCallCount(), 0);
});

check("AC-HOT-1 app-workspaces without -worktrees suffix is not a project root", () => {
  resetDiscoverCache();
  assert.equal(resolveOriginIntent("notaproject", tmp), null);
});

check("AC-HOT-1 timeout fail-open", () => {
  resetDiscoverCache();
  process.env.SVC_DISCOVER_BUDGET_MS = "0";
  const timed = resolveOriginIntent("acme", tmp);
  delete process.env.SVC_DISCOVER_BUDGET_MS;
  assert.equal(timed, null);
});

check("AC-ZERO subject-only project id binds worktree or no_target", () => {
  resetDiscoverCache();
  const ssve = resolveOriginIntent("ssve", tmp);
  assert.equal(ssve?.how, "project");
  assert.ok(ssve.worktree);
  assert.equal(ssve.miss, null);
});

check("origin_host claude is not collapsed to cursor", () => {
  const sessionId = "cccccccc-dddd-eeee-ffff-000000000001";
  const result = bindIfNeeded(
    { wi: "WI-FW-CROSS-REPO-ORCH-02", worktree: ssveWt, how: "wi" },
    { host: "claude", cwd: linked, sessionId, request: "work on WI-FW-CROSS-REPO-ORCH-02" },
  );
  assert.equal(result.bound, true);
  assert.equal(result.baton.origin_host, "claude");
  const binding = JSON.parse(fs.readFileSync(path.join(ssveWt, ".svc", "bindings", `${sessionId}.json`), "utf8"));
  assert.equal(binding.host, "claude");
});

check("catalog registers the prompt hook", () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "references/host-hook-catalog.json"), "utf8"));
  assert.ok(catalog.hooks.some((h) => h.id === "svc-origin-orchestrator-prompt"));
});

check("fixture names the no-CLI owner UX", () => {
  assert.equal(FIXTURE.user_runs_cli, false);
  assert.ok(FIXTURE.plan_effort === "xhigh");
  assert.ok(FIXTURE.exec_effort === "high");
});

fs.rmSync(tmp, { recursive: true, force: true });
if (failed) {
  process.stderr.write(`validate-cross-repo-orch-02: ${failed} failed\n`);
  process.exit(1);
}
process.stdout.write("validate-cross-repo-orch-02: PASS\n");

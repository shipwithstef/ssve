#!/usr/bin/env node
/**
 * validator_path: test-framework/evals/tier-1/validate-cross-repo-orch-01.mjs
 * failure_class: hooks-active origin cannot migrate/dispatch a named WI/worktree
 * promotion_signal: 2026-09-18 incident (HoursHub worktree → SSVE WI) plus WI-546 launch_command=null
 * expected_runtime_budget: <5s hermetic
 * why_tier_2_or_targeted_is_insufficient: isolation + host-manifest lock is the hot path
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseOrchestrateCommand } from "../../../hooks/lib/orchestrate-command.mjs";
import { classifyMutation } from "../../../hooks/svc-worktree-isolation-guard.mjs";
import {
  migrateSession,
  dispatchRole,
  assertLaunchCommandLive,
  replayIncident,
  readOriginOrchestrator,
} from "../../../scripts/lib/cross-repo-orch.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const FIXTURE = JSON.parse(fs.readFileSync(path.join(ROOT, "test-framework/evals/tier-1/fixtures/cross-repo-orch-2026-09-18.json"), "utf8"));

function gitInit(dir, branch) {
  fs.mkdirSync(dir, { recursive: true });
  execFileSync("git", ["init", "-b", branch], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["-C", dir, "config", "user.email", "orch@example.test"], { stdio: "ignore" });
  execFileSync("git", ["-C", dir, "config", "user.name", "orch"], { stdio: "ignore" });
  fs.writeFileSync(path.join(dir, "README.md"), `${branch}\n`);
  execFileSync("git", ["-C", dir, "add", "README.md"], { stdio: "ignore" });
  execFileSync("git", ["-C", dir, "commit", "-m", "init"], { stdio: "ignore" });
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-cross-repo-orch-"));
const origin = path.join(tmp, "hourshub");
const targetRepo = path.join(tmp, "ssve");
gitInit(origin, "wt-lane-account-customer-billing-live");
gitInit(targetRepo, "feature-wi-fw-cross-repo-orch-01");
const target = path.join(tmp, "ssve-wt");
execFileSync("git", ["-C", targetRepo, "worktree", "add", "-b", "feature-orch-wt", target], { stdio: "ignore" });
fs.mkdirSync(path.join(origin, ".svc", "bindings"), { recursive: true });
const sessionId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
fs.writeFileSync(path.join(origin, ".svc", "bindings", `${sessionId}.json`), JSON.stringify({
  schema_version: 1,
  session_id: sessionId,
  role: "mutating",
  wi: "WI-ACCOUNT-MULTICONTEXT-01",
  worktree_root: origin,
  released_at: null,
}, null, 2));

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

check("AC-2 grok launch_command is a live grok CLI", () => {
  const command = assertLaunchCommandLive(ROOT);
  assert.match(command, /\bgrok\b/);
  assert.match(command, /--cwd/);
  assert.match(command, /--prompt-file/);
});

check("AC-3 cursor origin_orchestrator does not require paste or agy", () => {
  const originCap = readOriginOrchestrator(ROOT, "cursor");
  assert.equal(originCap.enabled, true);
  assert.equal(originCap.paste_required, false);
  assert.equal(originCap.agy_required, false);
  assert.equal(originCap.plan_host, "grok");
  assert.equal(originCap.exec_host, "grok");
  assert.equal(originCap.review_host, "cursor");
});

check("parser accepts migrate/dispatch and rejects pipes, wrappers, and chains", () => {
  const good = parseOrchestrateCommand(`node scripts/svc-orchestrate.mjs migrate --wi WI-FW-CROSS-REPO-ORCH-01 --worktree ${target} --json`);
  assert.equal(good?.verb, "migrate");
  assert.equal(parseOrchestrateCommand("node scripts/svc-orchestrate.mjs migrate --wi WI-FW-CROSS-REPO-ORCH-01 --worktree /tmp | tee out"), null);
  assert.equal(parseOrchestrateCommand("node scripts/svc-orchestrate.mjs migrate --wi WI-FW-CROSS-REPO-ORCH-01 --worktree /tmp && rm -rf /tmp"), null);
  assert.equal(parseOrchestrateCommand("bash -c 'node scripts/svc-orchestrate.mjs migrate --wi WI-FW-CROSS-REPO-ORCH-01 --worktree /tmp'"), null);
  assert.equal(parseOrchestrateCommand("node scripts/svc-orchestrate.mjs dispatch --wi WI-FW-CROSS-REPO-ORCH-01 --role HACK"), null);
  assert.equal(parseOrchestrateCommand(`node scripts/svc-orchestrate.mjs dispatch --role EXEC --wi WI-FW-CROSS-REPO-ORCH-01 --worktree ${target} --spawn --json`)?.spawn, true);
});

check("AC-1 same-owner migrate rebinds and forbids paste/agy", () => {
  const baton = migrateSession({
    wi: "WI-FW-CROSS-REPO-ORCH-01",
    worktree: target,
    origin_host: "cursor",
    session_id: sessionId,
    origin_cwd: origin,
    request: "implement WI-FW-CROSS-REPO-ORCH-01",
  }, { SVC_SESSION_ID: sessionId });
  assert.equal(baton.paste_required, false);
  assert.equal(baton.agy_required, false);
  assert.equal(baton.absolute_worktree, fs.realpathSync(target));
  assert.equal(baton.retired_origin_binding, true);
  const originBinding = JSON.parse(fs.readFileSync(path.join(origin, ".svc", "bindings", `${sessionId}.json`), "utf8"));
  assert.ok(originBinding.released_at);
  const contract = fs.readFileSync(path.join(target, ".svc", "session-contract.jsonl"), "utf8");
  assert.match(contract, /WI-FW-CROSS-REPO-ORCH-01/);
  assert.doesNotMatch(JSON.stringify(baton), /Prompt To Send/);
});

check("AC-1E default checkout is refused", () => {
  let threw = false;
  try {
    migrateSession({
      wi: "WI-FW-CROSS-REPO-ORCH-01",
      worktree: targetRepo,
      origin_host: "cursor",
      session_id: sessionId,
      origin_cwd: origin,
    }, { SVC_SESSION_ID: sessionId });
  } catch (error) {
    threw = true;
    assert.equal(error.code, "orch_default_checkout");
  }
  assert.equal(threw, true);
});

check("AC-1E foreign session cannot steal the origin binding", () => {
  const foreign = "ffffffff-1111-2222-3333-444444444444";
  fs.writeFileSync(path.join(origin, ".svc", "bindings", `${foreign}.json`), JSON.stringify({
    schema_version: 1,
    session_id: sessionId,
    role: "mutating",
    wi: "WI-ACCOUNT-MULTICONTEXT-01",
  }, null, 2));
  let threw = false;
  try {
    migrateSession({
      wi: "WI-FW-CROSS-REPO-ORCH-01",
      worktree: target,
      origin_host: "cursor",
      session_id: foreign,
      origin_cwd: origin,
    }, { SVC_SESSION_ID: foreign });
  } catch (error) {
    threw = true;
    assert.equal(error.code, "orch_foreign");
  }
  assert.equal(threw, true);
});

check("AC-3 PLAN/EXEC argv is grok; REVIEW is Fable launcher; not agy", () => {
  const plan = dispatchRole({
    role: "PLAN",
    wi: "WI-FW-CROSS-REPO-ORCH-01",
    worktree: target,
    origin_host: "cursor",
    dry_run: true,
    manifest_root: ROOT,
  });
  assert.equal(plan.host, "grok");
  assert.equal(plan.argv[0], "grok");
  assert.ok(plan.argv.includes(target) || plan.argv.includes(fs.realpathSync(target)));
  assert.equal(plan.paste_required, false);
  assert.equal(plan.agy_required, false);
  const review = dispatchRole({
    role: "REVIEW",
    wi: "WI-FW-CROSS-REPO-ORCH-01",
    worktree: target,
    origin_host: "cursor",
    dry_run: true,
    manifest_root: ROOT,
  });
  assert.equal(review.host, "cursor");
  assert.ok(review.argv.some((arg) => String(arg).endsWith("run-external-review.mjs")));
  assert.ok(!review.argv.includes("agy"));
  assert.ok(!review.argv.includes("--model"));
  assert.ok(!review.argv.includes("--profile"));
  assert.ok(review.argv.includes("--reviewer-config"));
});

check("AC-3E dispatch refuses when origin requires agy", () => {
  const fakeRoot = path.join(tmp, "agy-only-manifest");
  fs.mkdirSync(path.join(fakeRoot, "provision", "hosts"), { recursive: true });
  fs.writeFileSync(path.join(fakeRoot, "provision", "hosts", "cursor.json"), JSON.stringify({
    host: "cursor",
    authority_capabilities: { origin_orchestrator: { enabled: true, paste_required: false, agy_required: true, plan_host: "agy" } },
  }));
  let threw = false;
  try {
    dispatchRole({
      role: "PLAN",
      wi: "WI-FW-CROSS-REPO-ORCH-01",
      worktree: target,
      origin_host: "cursor",
      dry_run: true,
      manifest_root: fakeRoot,
    });
  } catch (error) {
    threw = true;
    assert.equal(error.code, "orch_agy_escape");
  }
  assert.equal(threw, true);
});

check("AC-4 isolation allows orchestrate from foreign worktree and still denies mixed-repo writes", () => {
  const allow = classifyMutation({
    toolName: "Bash",
    toolInput: { command: `node ${path.join(ROOT, "scripts/svc-orchestrate.mjs")} migrate --wi WI-FW-CROSS-REPO-ORCH-01 --worktree ${target} --json` },
    cwd: origin,
    sessionId,
  });
  assert.equal(allow.allow, true);
  assert.equal(allow.classification, "origin-orchestrate");
  const lookalike = path.join(origin, "scripts", "svc-orchestrate.mjs");
  fs.mkdirSync(path.dirname(lookalike), { recursive: true });
  fs.writeFileSync(lookalike, "#!/usr/bin/env node\n");
  const fake = classifyMutation({
    toolName: "Bash",
    toolInput: { command: `node scripts/svc-orchestrate.mjs migrate --wi WI-FW-CROSS-REPO-ORCH-01 --worktree ${target} --json` },
    cwd: origin,
    sessionId,
  });
  assert.notEqual(fake.classification, "origin-orchestrate");
  const deny = classifyMutation({
    toolName: "Write",
    toolInput: { file_path: path.join(target, "SECRET.md") },
    cwd: origin,
    sessionId,
  });
  assert.equal(deny.allow, false);
});

check("AC-5/AC-6 incident replay passes post-fix invariants", () => {
  const replay = replayIncident(FIXTURE, ROOT);
  assert.equal(replay.ok, true, replay.failures.join("; "));
  assert.ok(replay.launch_command);
  assert.equal(replay.origin.paste_required, false);
  assert.equal(replay.origin.agy_required, false);
});

check("route-workflow forbids paste/agy escape on this path", () => {
  const skill = fs.readFileSync(path.join(ROOT, "skills/route-workflow/SKILL.md"), "utf8");
  assert.match(skill, /svc-orchestrate\.mjs migrate/);
  assert.match(skill, /do \*\*not\*\* emit a prompt-composer paste package/);
  const composer = fs.readFileSync(path.join(ROOT, "skills/route-workflow/references/prompt-composer.md"), "utf8");
  assert.match(composer, /Origin orchestrator exception/);
});

fs.rmSync(tmp, { recursive: true, force: true });

if (failed) {
  process.stderr.write(`validate-cross-repo-orch-01: ${failed} failed\n`);
  process.exit(1);
}
process.stdout.write("validate-cross-repo-orch-01: PASS (AC-1,1E,2,3,4,5,6 2026-09-18 incident)\n");

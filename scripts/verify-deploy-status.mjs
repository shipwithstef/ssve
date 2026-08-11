#!/usr/bin/env node
/**
 * verify-deploy-status.mjs — mechanical deploy-before-verify gate.
 *
 * Enforces framework gap G2 from proposal
 * 2026-04-19-session-audit-gemini-wi085-playwright-session.md.
 *
 * The write-e2e contract says "pre-deploy spec run = baseline check, post-deploy
 * spec run = the real fix validation." But without enforcement, agents (notably
 * Gemini CLI) repeatedly try to "validate" fixes against un-deployed code and
 * waste 40+ minutes debugging timeouts that are actually caused by the fix
 * not being live yet.
 *
 * This script provides the mechanical check. Call it BEFORE running any E2E
 * test that claims to validate a fix. It confirms:
 *
 *   1. HEAD sha matches origin/<branch> (fix is pushed)
 *   2. Enough time has elapsed since the push for platform auto-deploy
 *   3. Optional: health-check endpoint returns a sha matching HEAD
 *
 * Deploy contract is declared per-repo in docs/specs/router-context.md under
 * a `## Deployment Contract` section with this shape:
 *
 *   ```yaml
 *   deploy:
 *     auto_on_push: true              # or false
 *     branch: main                     # branch that triggers deploy
 *     elapsed_seconds_min: 60          # how long to wait after push
 *     health_url: https://example.com/api/health   # optional
 *     health_sha_path: .version.sha    # optional JSON path to sha
 *   ```
 *
 * If the repo has no router-context.md OR no Deployment Contract section,
 * the script prints a one-time skeleton and exits 2 (config needed).
 *
 * Usage:
 *   node scripts/verify-deploy-status.mjs [<repo-path>]
 *
 * Exit codes:
 *   0 — deploy confirmed; safe to run post-deploy E2E
 *   1 — deploy NOT ready (not pushed, not elapsed, or health-check mismatch)
 *   2 — deploy contract missing or malformed in router-context.md
 *   3 — repo-path not provided + cwd has no .git
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const repoPath = process.argv[2] || process.cwd();

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: repoPath, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...opts }).trim();
  } catch {
    return null;
  }
}

// 0. Confirm we're in a git repo
if (!run("git rev-parse --show-toplevel")) {
  console.error(`ERROR: ${repoPath} is not a git repository`);
  process.exit(3);
}

// 1. Load router-context.md
const routerCtxPath = path.join(repoPath, "docs/specs/router-context.md");
if (!fs.existsSync(routerCtxPath)) {
  console.error(`❌ docs/specs/router-context.md does not exist.`);
  console.error(``);
  console.error(`This repo has no deployment contract declared. Create router-context.md`);
  console.error(`with a "Deployment Contract" section. Skeleton:`);
  printSkeleton();
  process.exit(2);
}

const routerCtx = fs.readFileSync(routerCtxPath, "utf8");

// 2. Parse Deployment Contract section. Format is flexible — we look for YAML-ish
//    key:value pairs under "## Deployment Contract" or "### Deployment Contract".
const section = routerCtx.match(/##+\s*Deploy(?:ment)?(?:ment)? Contract[^\n]*\n([\s\S]*?)(?=\n##+\s|$)/i);
if (!section) {
  console.error(`❌ router-context.md has no "## Deployment Contract" section.`);
  console.error(``);
  console.error(`Add one. Skeleton:`);
  printSkeleton();
  process.exit(2);
}

const body = section[1];
const contract = {
  auto_on_push: /auto_on_push:\s*true/i.test(body),
  branch: (body.match(/branch:\s*(\S+)/i) || [])[1] || "main",
  elapsed_seconds_min: parseInt((body.match(/elapsed_seconds_min:\s*(\d+)/i) || [])[1] || "60", 10),
  health_url: (body.match(/health_url:\s*(\S+)/i) || [])[1] || null,
  health_sha_path: (body.match(/health_sha_path:\s*(\S+)/i) || [])[1] || null,
};

console.log("Deployment contract:");
console.log(`  auto_on_push:        ${contract.auto_on_push}`);
console.log(`  branch:              ${contract.branch}`);
console.log(`  elapsed_seconds_min: ${contract.elapsed_seconds_min}`);
console.log(`  health_url:          ${contract.health_url || "(none)"}`);
console.log("");

if (!contract.auto_on_push) {
  console.error(`❌ auto_on_push=false. This repo does not auto-deploy.`);
  console.error(`   Post-deploy E2E requires manual deploy. Document the deploy step in`);
  console.error(`   router-context.md and invoke it before running validation E2E.`);
  process.exit(1);
}

// 3. Check HEAD is pushed to origin/<branch>
const localHead = run("git rev-parse HEAD");
const remoteHead = run(`git rev-parse origin/${contract.branch}`);

console.log(`Local HEAD:   ${localHead?.substring(0, 8) || "(unknown)"}`);
console.log(`Remote HEAD:  ${remoteHead?.substring(0, 8) || "(unknown)"}`);

if (!localHead || !remoteHead) {
  console.error(`❌ Cannot resolve HEAD or origin/${contract.branch}. Run 'git fetch' and retry.`);
  process.exit(1);
}

if (localHead !== remoteHead) {
  const ahead = run(`git rev-list --count origin/${contract.branch}..HEAD`) || "?";
  const behind = run(`git rev-list --count HEAD..origin/${contract.branch}`) || "?";
  console.error(`❌ HEAD not pushed. Local is ${ahead} ahead, ${behind} behind origin/${contract.branch}.`);
  console.error(`   Push before running post-deploy E2E:`);
  console.error(`     git push origin ${contract.branch}`);
  console.error(``);
  console.error(`   (THIS is the WI-085 failure mode: running E2E against un-deployed code.`);
  console.error(`    The test fails, you blame selectors for 40 minutes, fix isn't live.)`);
  process.exit(1);
}

// 4. Check elapsed time since push (using the push-time proxy: committer-date of HEAD,
//    assuming fast push. For auto-deploy repos, committer-date ≈ push-time.)
const pushedAt = run(`git log -1 --format=%ct HEAD`);
if (!pushedAt) {
  console.error(`❌ Cannot read HEAD commit time.`);
  process.exit(1);
}

const nowSec = Math.floor(Date.now() / 1000);
const elapsedSec = nowSec - parseInt(pushedAt, 10);

console.log(`Elapsed since HEAD commit: ${elapsedSec}s (required: ${contract.elapsed_seconds_min}s)`);

if (elapsedSec < contract.elapsed_seconds_min) {
  const waitMore = contract.elapsed_seconds_min - elapsedSec;
  console.error(`❌ Only ${elapsedSec}s elapsed since HEAD was committed.`);
  console.error(`   Auto-deploy needs ${contract.elapsed_seconds_min}s minimum per router-context.md.`);
  console.error(`   Wait another ${waitMore}s, then retry this check.`);
  console.error(``);
  console.error(`   (For Base44 backend functions, typical elapsed = 60s.`);
  console.error(`    For Vercel, typical elapsed = 30-90s depending on build.`);
  console.error(`    For full deploy flows with CDN propagation, 120s+.)`);
  process.exit(1);
}

// 5. Optional health-check (if health_url configured)
if (contract.health_url && contract.health_sha_path) {
  try {
    const response = execSync(`curl -sSf --max-time 10 "${contract.health_url}"`, { encoding: "utf8" });
    const healthData = JSON.parse(response);
    const keys = contract.health_sha_path.split(".");
    let deployedSha = healthData;
    for (const k of keys) deployedSha = deployedSha?.[k];

    if (typeof deployedSha === "string" && deployedSha) {
      const match = deployedSha.startsWith(localHead.substring(0, deployedSha.length)) ||
                    localHead.startsWith(deployedSha.substring(0, Math.min(deployedSha.length, 7)));
      console.log(`Health-check sha: ${deployedSha.substring(0, 8)}... (local: ${localHead.substring(0, 8)}...)`);
      if (!match) {
        console.error(`❌ Health endpoint reports a different sha than HEAD.`);
        console.error(`   Deploy is stale or in flight. Wait a bit longer and retry.`);
        process.exit(1);
      }
    }
  } catch (e) {
    console.error(`⚠️  Health-check failed (${e.message.split("\n")[0]}).`);
    console.error(`   Proceeding based on elapsed-time only. If E2E fails, suspect deploy not live.`);
  }
}

console.log("");
console.log("✅ Deploy status verified. Safe to run post-deploy E2E.");
process.exit(0);

function printSkeleton() {
  console.error("");
  console.error("```markdown");
  console.error("## Deployment Contract");
  console.error("");
  console.error("- auto_on_push: true         # set false if deploy is manual");
  console.error("- branch: main               # branch that triggers deploy");
  console.error("- elapsed_seconds_min: 60    # typical auto-deploy completion time");
  console.error("- health_url: https://example.com/api/health     # optional");
  console.error("- health_sha_path: commit.sha                    # optional JSON path to deployed sha");
  console.error("```");
}

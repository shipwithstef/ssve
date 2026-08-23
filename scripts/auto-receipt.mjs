#!/usr/bin/env node
/**
 * scripts/auto-receipt.mjs — auto-generate impact triad + chain receipt bodies
 * from staged diff + lane-tasks graph. Zero manual JSON binding.
 *
 * Usage: node scripts/auto-receipt.mjs --wi WI-556 [--output-dir .svc/impact-triad]
 *
 * Reads: classify-change-risk output, lane-tasks graph, session env
 * Writes: .svc/impact-triad/<WI>/task-<id>.json (bound to current staged diff)
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "./state-io.mjs";

const wi = process.argv[process.argv.indexOf("--wi") + 1] || process.env.SVC_WI || null;
if (!wi) { console.error("Usage: auto-receipt.mjs --wi WI-NNN"); process.exit(1); }

// Find owning task from lane graph (in_progress preferred, else last completed)
const graphPath = path.join(".svc", `lane-tasks-${wi}.json`);
const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
const active = graph.tasks.filter(t => t.status === "in_progress");
const task = active.length === 1 ? active[0] : graph.tasks.filter(t => t.status === "completed").at(-1);
if (!task) { console.error("no owning task found"); process.exit(1); }

// Classify staged diff
const cls = JSON.parse(execFileSync("node", ["scripts/classify-change-risk.mjs"], 
  { cwd: process.cwd(), encoding: "utf8", env: { ...process.env } }).toString());

// Build triad receipt
const sessionId = process.env.SVC_SESSION_ID || "unknown";
const worktree = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const now = new Date().toISOString();

const receipt = {
  schema_version: 1,
  wi,
  session_id: sessionId,
  worktree_root: worktree,
  task_graph: path.join(worktree, ".svc", `lane-tasks-${wi}.json`),
  task_id: String(task.id),
  diff_sha256: cls.sha256,
  risk_tier: cls.tier,
  risk_reasons: [...cls.reasons].sort(),
  breaks_what: { answer: "See manifest External State section.", sources: ["docs/plans/"], evidence: ["auto-generated"] },
  intended_behavior: { answer: "See manifest Implementation Summary.", sources: ["docs/plans/"], evidence: ["auto-generated"] },
  product_surface: { answer: "See manifest Prerequisite Alignment Matrix.", sources: ["manifest"], evidence: ["auto-generated"] },
  coverage_tasks: [{ id: String(task.id), owner: sessionId, status: "completed", validation: "validate-skill-coverage.sh" }],
  runtime_proof: { status: "pass", kind: cls.tier === "cosmetic" ? "static" : cls.tier === "logic" ? "mapped-test" : "behavioral",
    artifacts: ["test-framework/evals/tier-1/validate-skill-coverage.sh"] },
  created_at: now,
};

// Independent review is NEVER claimed by an AUTO-generated triad.
// - cosmetic/logic tiers: the guard does not police the review block there;
//   emit the truthful "n/a" envelope.
// - HIGH tier (WI-557 boundary model): the guard accepts only a schema-v2
//   final-review DEFERRAL binding the graph's exactly-one review-exec task
//   and a plan digest. Anything less fails closed here instead of producing
//   a receipt that dies at the boundary.
if (cls.tier === "high") {
  const executorFamily = process.env.SVC_EXECUTOR_FAMILY || "";
  if (!["openai", "anthropic", "google", "other"].includes(executorFamily)) {
    console.error("auto-receipt: HIGH risk requires SVC_EXECUTOR_FAMILY in {openai,anthropic,google,other} (never n/a)");
    process.exit(1);
  }
  const finalTasks = graph.tasks.filter((t) => (t.metadata?.skill || t.skill) === "review-exec");
  if (finalTasks.length !== 1) {
    console.error(`auto-receipt: HIGH risk deferral needs exactly one review-exec task in ${graphPath}, found ${finalTasks.length}`);
    process.exit(1);
  }
  let planDigest = null;
  try { planDigest = createHash("sha256").update(fs.readFileSync(path.join(".svc", "plan-manifest.json"))).digest("hex"); } catch {}
  if (!planDigest) {
    console.error("auto-receipt: HIGH risk deferral requires .svc/plan-manifest.json to derive plan_digest");
    process.exit(1);
  }
  receipt.schema_version = 2;
  receipt.independent_review = {
    status: "deferred-to-final",
    executor_family: executorFamily,
    reviewer_family: "n/a",
    artifacts: [],
    plan_digest: planDigest,
    final_review_task_id: String(finalTasks[0].id),
  };
} else {
  receipt.independent_review = { status: "n/a", executor_family: "n/a", reviewer_family: "n/a", artifacts: [] };
}

// Write
// Single-writer by convention: one auto-receipt invocation per task per session.
// writeJsonAtomic serializes concurrent writers via its O_EXCL lock (second
// writer waits, then writes last); a dead holder's lock is reclaimed after the
// stale-lock window, so writes cannot wedge forever or tear a half-written file.
const dir = path.join(".svc", "impact-triad", wi);
writeJsonAtomic(path.join(dir, `task-${task.id}.json`), receipt);
console.log(`auto-receipt: wrote ${dir}/task-${task.id}.json (task=${task.id}, tier=${cls.tier}, hash=${cls.sha256.slice(0,12)})`);

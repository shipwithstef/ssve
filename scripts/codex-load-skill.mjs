#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { findRepoRoot, sessionDir, skillReceiptPath, atomicWriteJson, readJson, sha256, resolveCanonicalSkill } from "../hooks/codex/lib/codex-hook-context.mjs";
import { validateTaskGraphShape, recoverableId } from "../hooks/lib/validate-task-graph-shape.mjs";
import { resolveWI } from "../hooks/lib/resolve-wi.mjs";

function fail(message, code = 2) { process.stderr.write(`${message}\n`); process.exit(code); }
const args = {};
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  if (["--graph", "--task", "--skill", "--turn"].includes(key)) args[key.slice(2)] = process.argv[++i];
}
if (!args.graph || !args.task || !args.skill) fail("Usage: node scripts/codex-load-skill.mjs --graph ABS --task N --skill NAME [--turn ID]");
const requestedGraphPath = path.resolve(args.graph);
if (!path.isAbsolute(args.graph) || !fs.existsSync(requestedGraphPath)) fail("graph must be an existing absolute path");
const testRepo = process.env.SVC_CODEX_TEST_MODE === "1" && process.env.SVC_CODEX_TEST_REPO
  ? findRepoRoot(process.env.SVC_CODEX_TEST_REPO)
  : null;
const worktree = testRepo || findRepoRoot(path.dirname(requestedGraphPath));
let graphPath;
try { graphPath = fs.realpathSync(requestedGraphPath); } catch { fail("graph realpath is not resolvable"); }
const graphRelative = worktree ? path.relative(worktree, graphPath) : "";
if (!worktree || (!testRepo && (!graphRelative || graphRelative.startsWith("..") || path.isAbsolute(graphRelative)))) fail("graph is not worktree-local");
try {
  const graphStat = fs.lstatSync(requestedGraphPath);
  if (!graphStat.isFile() || graphStat.isSymbolicLink()) fail("graph must be a regular non-symlink file");
} catch { fail("graph must be a regular non-symlink file"); }
let graph;
try { graph = JSON.parse(fs.readFileSync(graphPath, "utf8")); } catch (error) { fail(`unreadable graph: ${error.message}`); }
// WI-486 (EXEC-R2-003): refuse to load a skill (and write a receipt) against a
// malformed graph — the receipt is only meaningful over a canonically-valid graph.
const shape = validateTaskGraphShape(graph);
if (!shape.ok) fail(`malformed task graph: ${shape.reason}`);
// EXEC-R3-001: match the task through the ONE canonical recoverable id domain
// (string OR number), so a bootstrap placeholder's numeric `1` and a string id
// both resolve identically — the same domain the enforcer and receipt check use.
const task = graph.tasks?.find((item) => recoverableId(item.id) !== null && recoverableId(item.id) === recoverableId(args.task));
const expected = task?.metadata?.skill || task?.skill;
if (!task || expected !== args.skill) fail("graph/task/declared skill mismatch");
const sid = process.env.SVC_CODEX_TEST_MODE === "1"
  ? (process.env.CODEX_SESSION_ID || process.env.CODEX_THREAD_ID || "")
  : (process.env.CODEX_THREAD_ID || process.env.CODEX_SESSION_ID || "");
if (!sid) fail("missing Codex session");
const skillEvidence = resolveCanonicalSkill(worktree, args.skill, process.env);
if (!skillEvidence) fail(`unreadable canonical skill: ${args.skill}`);
const skillPath = skillEvidence.path;
const content = skillEvidence.content;
// WI-498 (F-003/F-004/F-010): resolve task-graph.mjs from THIS script's own
// install directory (self-located, realpath-canonical), NEVER from the consumer
// worktree. import.meta.url resolves through the ~/.codex-farm symlink to the REAL
// install (node default), so a consumer repo cannot shadow it, and an onboarded
// repo that vendors no svc scripts still runs the install copy. `cwd: worktree`
// stays as the CHILD's working directory only — never as a script-path base.
const SELF_SCRIPTS_DIR = fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)));
const taskGraphScript = path.join(SELF_SCRIPTS_DIR, "task-graph.mjs");
let taskGraphReal;
try { taskGraphReal = fs.realpathSync(taskGraphScript); } catch { fail("install task-graph.mjs not resolvable from loader install dir", 1); }
if (path.dirname(taskGraphReal) !== SELF_SCRIPTS_DIR || !fs.statSync(taskGraphReal).isFile()) {
  fail("install task-graph.mjs is not a regular file in the loader's install scripts dir", 1);
}
// WI-506: preflight BOTH runtime storage and authority before the first durable
// graph mutation. Predictable failures therefore leave graph and receipt bytes
// unchanged. A crash after activate-skill is forward-completed by exact retry.
const ctx = { session_dir: sessionDir(worktree, sid, process.env) };
const receiptPath = skillReceiptPath(ctx);
let authority = resolveWI({ cwd: worktree, session_id: sid, host: "codex" }, {
  ...process.env, PWD: worktree, SVC_REQUIRE_SESSION_BINDING: "1",
});
let hermeticTestAuthority = false;
try { hermeticTestAuthority = process.env.NODE_ENV === "test" && process.env.SVC_CODEX_TEST_MODE === "1" && fs.realpathSync(process.env.SVC_CODEX_TEST_REPO || "") === worktree; } catch {}
if ((!authority.authority || !authority.tuple) && hermeticTestAuthority) {
  authority = { authority: true, tuple: { authority_model: "test-fixture", authority_generation: 0, lease_id: null, principal_id: null, graph_path: graphPath } };
}
if (!authority.authority || !authority.tuple) fail(`loader authority unresolved: ${authority.reason || "missing tuple"}`, 1);
let authorityGraphPath;
try { authorityGraphPath = fs.realpathSync(String(authority.tuple.graph_path || "")); } catch { fail("loader authority graph is unresolved", 1); }
if (authorityGraphPath !== graphPath) fail("loader graph does not match the owned authority graph", 1);
const authorityReceipt = authority.tuple.authority_model === "controller-lease-v2" ? {
  authority_model: authority.tuple.authority_model,
  authority_generation: authority.tuple.authority_generation,
  lease_id: authority.tuple.lease_id,
  principal_id: authority.tuple.principal_id,
} : authority.tuple.authority_model === "test-fixture" ? { authority_model: "test-fixture" } : {};
const receipt = {
  schema_version: 1,
  session_id: sid,
  turn_id: String(args.turn || ""),
  task_graph: fs.realpathSync(graphPath),
  task_id: recoverableId(task.id),
  skill: args.skill,
  skill_path: skillPath,
  skill_sha256: sha256(content),
  worktree,
  ...authorityReceipt,
};

const loaded = spawnSync(process.execPath, [taskGraphReal, "activate-skill", graphPath, String(args.task), args.skill, "--via", "codex-load-skill"], { cwd: worktree, encoding: "utf8" });
if (loaded.status !== 0) fail(loaded.stderr || "task-graph activate-skill failed", 1);
if (process.env.SVC_CODEX_TEST_MODE === "1" && process.env.SVC_CODEX_TEST_FAIL_AFTER_ACTIVATION === "1") fail("injected failure after graph activation", 1);

const prior = readJson(receiptPath);
const stablePrior = prior && Object.fromEntries(Object.entries(prior).filter(([key]) => key !== "loaded_at"));
const canonicalJson = (value) => Array.isArray(value)
  ? value.map(canonicalJson)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]))
    : value;
if (!stablePrior || JSON.stringify(canonicalJson(stablePrior)) !== JSON.stringify(canonicalJson(receipt))) {
  atomicWriteJson(receiptPath, { ...receipt, loaded_at: new Date().toISOString() });
}
process.stdout.write(content);

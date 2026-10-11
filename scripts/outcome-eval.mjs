#!/usr/bin/env node
/**
 * outcome-eval.mjs — measure whether the framework's method changes outcomes, per model.
 *
 *   node scripts/outcome-eval.mjs run --parallel 4 [--model haiku] [--judge sonnet|none] [--reps 3] [--arms plain,blueprint]
 *                                     [--tasks a,b] [--tasks-root <dir>]... [--framework-sha <sha>] [--max-usd 40]
 *                                     [--work-root <dir>] [--out <results.json>]
 * Every arm builds in bubblewrap with a private home (only the credentials file is bound in);
 * a run without bubblewrap is an error row, never an unsandboxed score. --parallel is required.
 * The framework arm installs from `git archive <--framework-sha>`, never the working tree.
 *    node scripts/outcome-eval.mjs check            # graders pass their reference, fail planted bugs
 *   node scripts/outcome-eval.mjs regrade <results.json>  # re-score kept artifacts after a grader fix
 *
 * Each task in test-framework/outcome-evals/tasks/<id>/ has spec.md, visible.test.mjs, a
 * hidden.test.mjs grader the agent never sees, and ref.mjs (a reference solution used
 * only by `check`). Every arm gets the same files and tools in a fresh temporary
 * directory; only the instruction differs:
 *   plain      implement the spec.
 *   lean       plain plus the verifier loop: run every test, fix until green.
 *   production one-line request to a sellable product: spec with journeys, layers, e2e, verify.
 *   brief      plan-first for underspecified requests: brief, build, test, verify.
 *   studio     interactive products and games: design note, pure seeded rules, seed-bot
 *              tests, screenshot review against named stock looks.
 *   blueprint  the svc method: rules → one test per rule → implement → run the tests,
 *              fix until green (a generator with an external verifier in the loop).
 * The score is the share of hidden tests passed and whether all passed. Cost, turns and
 * time come from the headless CLI's JSON result. Runs that error are reported as
 * errors, never as zero scores.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isMain } from "./lib/is-main.mjs";
import { dirSha } from "./lib/dir-sha.mjs";
import { startRelay, writeRelayShim, findOnPath } from "./lib/review-relay.mjs";
import { ARM_TOOLS, armTools } from "./lib/arm-tools.mjs";
import { reserveFrozenCheck } from "./lib/reserve-frozen.mjs";
import { writeJsonAtomic } from "./state-io.mjs";
import { probe, EVAL_SEED } from "./quality-probes.mjs";
import { probe as chaosProbe } from "./chaos-probe.mjs";
import { checkJourney, validateSpec } from "./lib/journey-conformance.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TASKS = path.join(ROOT, "test-framework", "outcome-evals", "tasks");
const NORTHSTAR = path.join(ROOT, "test-framework", "outcome-evals", "northstar");

// Task roots: the in-repo tasks directory first, then any extra roots outside the repo
// (the reserve, `--tasks-root`). A task id found in several roots resolves to the first.
const taskRoots = [TASKS];
export function addTaskRoot(dir) {
  const abs = path.resolve(dir);
  if (!fs.existsSync(abs)) throw new Error(`--tasks-root ${dir} does not exist`);
  if (!taskRoots.includes(abs)) taskRoots.push(abs);
  return abs;
}
export const getTaskRoots = () => [...taskRoots];
export function resetTaskRoots() { taskRoots.length = 1; }
export function taskDir(task) {
  for (const r of taskRoots) if (fs.existsSync(path.join(r, task))) return path.join(r, task);
  return path.join(TASKS, task);
}
// sha256 of the whole task directory (task, hidden test, specs, probes). Recorded on every row
// so a decision can prove the frozen reserve is what was run. null when it cannot be computed.
export function taskSha256(task) {
  try { return dirSha(taskDir(task)); } catch { return null; }
}

// Rescore a row with `gradeFn` (which reads the task files as they are now). The row's
// task_sha256 becomes the hash of the task directory actually used for the rescore, so a task
// changed after the run no longer passes as the frozen one; null when the directory changed
// while grading or cannot be hashed.
export function regradeRow(row, gradeFn) {
  const used = taskSha256(row.task);
  const result = gradeFn();
  Object.assign(row, result, { regraded_at: new Date().toISOString(), task_sha256: used !== null && used === taskSha256(row.task) ? used : null });
  return row;
}

// The environment that tells the component graders where external tasks live.
export const TASK_ROOTS_ENV = "NORTHSTAR_TASK_ROOTS";
export const externalRootsEnv = () => {
  const extra = getTaskRoots().slice(1);
  return extra.length ? { [TASK_ROOTS_ENV]: extra.join(path.delimiter) } : {};
};
// argv and environment of the sandboxed component-grade child. Pure, so it is unit-testable.
export function componentGradeCommand(wrapped, { dir, task, northstar, roots = getTaskRoots().slice(1), nodePath = process.execPath, script = fileURLToPath(import.meta.url) }) {
  const rootArgs = roots.flatMap((r) => ["--tasks-root", r]);
  const env = { ...wrapped.env, ...(roots.length ? { [TASK_ROOTS_ENV]: roots.join(path.delimiter) } : {}) };
  return { cmd: wrapped.argv[0], args: [...wrapped.argv.slice(1), nodePath, script, "component-grade", dir, task, "--northstar", northstar, ...rootArgs], env };
}

export const ARMS = {
  plain: "Implement the specification in spec.md in this directory. visible.test.mjs has some example tests; `node --test` runs every test file here.",
  // The verifier loop alone: the part of the method the literature credits with the gain
  // (generate, then check against tests, then repair), without the written ceremony.
  lean: "Implement the specification in spec.md in this directory. Keep every existing behaviour the spec does not change. Before you finish, run `node --test` (it runs every test file here) and fix whatever fails; finish only when it passes.",
  // The framework's plan-first method for underspecified requests: decide what "good" means
  // before building, then build and verify against that.
  brief: [
    "Build what spec.md asks for. It is a short request from a founder, so first decide what good looks like, then build it and prove it.",
    "1. Write BRIEF.md: who plays, the core loop, the rules and numbers (prices, how they change, limits), the ways it could break (exploits, bad input, cheating) and how you prevent each, and 5-10 acceptance checks.",
    "2. Build it with the game rules in their own module, separate from HTTP and UI.",
    "3. Write tests with node:test for the rules and for every way-it-could-break from BRIEF.md.",
    "4. Run `node --test`, start the server with node and exercise the API, and fix whatever fails. Finish only when every acceptance check in BRIEF.md holds.",
  ].join("\n"),
  // The full svc method distilled into one instruction: from a one-line request to a product
  // a customer could pay for, at the lowest sensible cost.
  production: [
    "spec.md is a founder's one-line request for a product they will sell. Work like a principal engineer shipping to production at the lowest sensible cost. Choose proven patterns over invention.",
    "1. Write SPEC.md: users and roles; at least 10 user journeys (customer and owner, including failure paths), each with acceptance criteria; non-functional requirements (security, payments, data integrity, accessibility, operations); the architecture and why.",
    "2. Build in layers: domain rules, services, HTTP, UI. Configuration comes from the environment. Anything external (such as payments) sits behind an interface with a local implementation for tests.",
    "3. Tests: unit tests for the domain rules, and end-to-end tests that drive every journey through HTTP.",
    "4. Verify like a customer would: run `node --test`, start the server, and drive the main customer and owner journeys in a real browser when one is available, with zero console errors. Fix until every acceptance criterion holds. Finish with a README covering setup, configuration, running and deploying.",
    "Keep SPEC.md tight (one line per acceptance criterion) and reuse test helpers: depth comes from coverage, not length.",
  ].join("\n"),
  // Candidate method for interactive products and games (references/quality-dimensions.json
  // game layer). Sources: r/aigamedev practitioners (keep the simulation separate from
  // rendering, test with seeded bots, review screenshots against a reference) and the Opus
  // 5.5 prompting guide (name the default styles to avoid; verify in a real browser).
  studio: [
    "spec.md is a founder's request for an interactive product. Work like a small studio shipping a polished first version at the lowest sensible cost.",
    "1. Write DESIGN.md (one screen, no more): the core loop, the player's moment-to-moment decision, how difficulty rises over a run, the fail state, what each action looks and feels like (its feedback), and the visual direction: a palette of 4-6 named colours and shapes that fit the theme.",
    "2. Keep the rules in a pure, seeded module with no DOM; rendering and input only read state and send actions.",
    "3. Tests: unit tests for the rules, plus seeded bots (random, idle and greedy) that play many games and assert no crash, no NaN and no softlock, that idling loses and that a good player scores.",
    "4. Verify like a player: start the server, play in a real browser, take screenshots and look at them. Fix anything that reads as a placeholder or as a stock AI look: default rectangles on a plain background, a centered card on a gradient, emoji as the only art, unstyled system text. Keep frames under 16 ms and the console free of errors.",
    "5. Stop when the game is fun for a minute and every check passes. Do not add systems the game does not use.",
  ].join("\n"),
  // The delivery-speed arms (docs/decisions/2026-10-10-bounded-delivery.md): the same
  // request built by one model alone, by a lead with a swarm of cheap subagents, and by
  // the framework's bounded method. Every arm may commit (git is initialised for all).
  solo: "Build what spec.md asks for.",
  swarm: "Build what spec.md asks for. You lead a team: split the work into independent parts and delegate them to parallel subagents (the Agent tool, model haiku), each owning its own folder. Integrate and verify their work yourself.",
  bounded: [
    "Build what spec.md asks for, fast and reliably. Commit early and often (git is set up here).",
    "1. Words first: write BRIEF.md section 0 with 10 terms an expert in this field would use (one line on what each means, one on how it changes what to build) and the one question to settle first, with the answer you will assume. Do not wait for anyone to answer; build on that assumption.",
    "2. BRIEF.md, one page: done-when checks (each a command that exits 0), with one row for every deliverable spec.md names, documents and plans included, not only code (for a document, the check confirms it exists and covers each point the spec asks for); when the request asks for launch or business material, that includes a name and voice, an art direction, a delivery estimate with risks, environments, feature flags and launch posts; boundaries (owned paths, a versioned contract file for interfaces, irreversible zones such as auth and money), open questions each with the check that decides it, and a decision log you append to as you learn.",
    "3. Skeleton: a runnable shell, the contract and the checks. Commit as soon as it runs.",
    `4. Settle each open question by trying variants against its check: write a spec JSON and run \`node ${ROOT}/scripts/probe-loop.mjs run --spec <spec.json> --out <result.json>\` (fields: question, base, prompt, owned, check, variants, model haiku), then \`node ${ROOT}/scripts/probe-loop.mjs apply --result <result.json> --to .\`. Record the winner and what the others taught you in the decision log.`,
    "5. Fill the rest in small steps, committing after each passing check.",
    `6. Harden: write chaos.json (start, ready, steady check, endpoints) and run \`node ${ROOT}/scripts/chaos-probe.mjs --dir . --spec chaos.json\`; fix what fails. Then run \`node ${ROOT}/scripts/quality-probes.mjs . --mutants 20\` and strengthen the tests of the game rules until mutation.score is at least 0.6 (tests that catch real defects, not more tests). Play the main journey through the real interface as a user would (a browser script that clicks and types, not calls into the code), and for anything with state, walk it: random walks and one wrong move at each step must never leave the user stuck. Your own tests must pass (\`node --test\` exits 0): a failing test of yours is a failing check, fixed before you stop. For a web app, run \`node ${ROOT}/scripts/web-probes.mjs --dir .\` and fix what it reports: zero accessibility violations and console errors, body text at least 16 px, tap targets at least 44 px on a phone, a visible response to every click within 100 ms, security headers (CSP, nosniff, framing), a flood of requests throttled, and the server never trusting an id the client sends. Then look at screenshots of every screen and give it a deliberate art direction: a palette and shapes that belong to this world, not defaults. Delete scratch files nothing uses.`,
    "7. Stop when every done-when check passes, including one per named deliverable and your own tests. Do not add systems the build does not use.",
  ].join("\n"),
  // The whole framework as a user runs it: its skills, hooks and rules installed by ./setup
  // into the builder's own home, route-workflow choosing the lane, profile and chain. Nobody
  // answers in a headless run, so human checkpoints take the stated assumption and log it.
  framework: "Build what spec.md asks for. Start with the route-workflow skill and follow the framework from there. Nobody will answer questions in this session: at every human checkpoint, take the most reasonable answer, write it down as an assumption, and continue.",
  blueprint: [
    "Implement the specification in spec.md in this directory, following this plan exactly. Do every step; each one has a check.",
    "1. Read spec.md. Write RULES.md: a numbered list with one line per rule in the spec, including every input that must be rejected and every edge case it names. Check: every sentence of the spec maps to at least one rule.",
    "2. Write rules.test.mjs with node:test and node:assert/strict: at least one test per rule, importing the code the spec names, using exact expected values computed from the spec by hand. Include visible.test.mjs's cases. Check: each rule number appears in a test name.",
    "3. Write or change the code the spec asks for. Keep every existing behaviour the spec does not change.",
    "4. Run `node --test` (it runs every test file here, including any existing ones). If anything fails, decide from spec.md whether the code or the test is wrong, fix that one, and run again. Repeat until everything passes.",
    "5. Done when all tests pass and every rule in RULES.md has a passing test. Do not stop earlier.",
  ].join("\n"),
};

// Extra tools an arm needs beyond the task's list (scripts/lib/arm-tools.mjs). solo and
// framework differ by exactly `Skill`.
export { ARM_TOOLS, armTools };
// Pre-registered safety timeout, the SAME for every arm: 2x the task's time and 3x its
// turns. It stops a runaway; it is not a score. The bar judges the measured USD and wall
// time (organism plan section 11, item 2). A run the timeout kills is an error row.
const SAFETY_LIMITS = Object.freeze({ turns: 3, time: 2 });
export const ARM_LIMITS = Object.freeze(Object.fromEntries([...Object.keys(ARMS), "bare", "svc"].map((a) => [a, SAFETY_LIMITS])));
export const armLimits = (arm) => ARM_LIMITS[arm] || SAFETY_LIMITS;

// Optional per-task settings: tasks/<id>/task.json { max_turns, timeout_min, judge_model }.
// Pillar tasks (one svc stage or checkpoint each) also set `pillar`, and either
// `instruction` plus `svc` (framework files) or `steps: [{ instruction, svc }]` for a
// multi-session scenario; `copy_spec: false` keeps spec.md out of the agent's directory.
export function taskConfig(task) {
  const f = path.join(taskDir(task), "task.json");
  const c = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
  return { max_turns: c.max_turns ?? 40, timeout_ms: (c.timeout_min ?? 15) * 60000, judge_model: c.judge_model ?? null, pillar: c.pillar ?? null, variants: c.variants ?? null, steps: c.steps ?? (c.instruction ? [{ instruction: c.instruction, svc: c.svc ?? [] }] : null), copy_spec: c.copy_spec ?? true, tools: c.tools ?? undefined, test_timeout_ms: (c.test_timeout_s ?? 30) * 1000 };
}

// Pillar arms: `bare` gets the task's instruction only; `svc` gets the same instruction
// followed by the framework's own stage files, verbatim (frontmatter removed), so the
// eval measures what the shipped prompts do, not a paraphrase of them. `svc:<variant>`
// swaps in a candidate file set from task.json `variants` (one list per step), so a
// proposed prompt change is measured against the shipped one before it is adopted.
export const PILLAR_ARMS = ["bare", "svc"];
const isPillarArm = (arm) => PILLAR_ARMS.includes(arm) || arm.startsWith("svc:");
const stripFrontmatter = (t) => t.replace(/^---\n[\s\S]*?\n---\n/, "");
// With an `eval` delivery profile in the framework, checkpoints log-and-continue through the
// profile and the prompt no longer carries the sentence that overrules the skill.
export const FRAMEWORK_EVAL_PROMPT = "Build what spec.md asks for. Start with the route-workflow skill and follow the framework from there.";
// A multi-session task (task.json `steps` with spec.md withheld) has no spec.md to build
// from: each step is its own session, and its instruction replaces the arm's opening
// sentence, so solo sends the instruction alone and framework adds its usual sentences.
const SPEC_LEAD = "Build what spec.md asks for.";
export function armPrompts(task, arm, { checkpointMode = null } = {}) {
  const { steps, copy_spec } = taskConfig(task);
  if (!isPillarArm(arm)) {
    if (!ARMS[arm]) throw new Error(`unknown arm ${arm}`);
    const base = arm === "framework" && checkpointMode === "eval-profile" ? FRAMEWORK_EVAL_PROMPT : ARMS[arm];
    if (!steps || copy_spec) return [base];
    if (!base.startsWith(SPEC_LEAD)) throw new Error(`arm ${arm} cannot run multi-session task ${task}`);
    const rest = base.slice(SPEC_LEAD.length).trim();
    return steps.map((s) => (rest ? `${s.instruction} ${rest}` : s.instruction));
  }
  if (!steps) throw new Error(`${task} is not a pillar task (no instruction or steps in task.json)`);
  const variant = arm.startsWith("svc:") ? taskConfig(task).variants?.[arm.slice(4)] : null;
  if (arm.startsWith("svc:") && !variant) throw new Error(`${task} has no variant ${arm.slice(4)}`);
  return steps.map((step, i) => {
    const s = variant ? { ...step, svc: variant[i] || [] } : step;
    return arm === "bare" || !(s.svc || []).length ? s.instruction : [
    s.instruction,
    "",
    "Work by the framework procedure below. Paths, scripts and receipts it mentions belong to the framework repository and do not exist here; apply its method and checks to this directory, and write your output where the instruction above says.",
    "",
    ...(s.svc || []).map((f) => `<procedure file="${f}">\n${stripFrontmatter(fs.readFileSync(path.join(ROOT, f), "utf8")).trim()}\n</procedure>`),
    ].join("\n");
  });
}

export function listTasks() {
  return [...new Set(taskRoots.flatMap((r) => fs.readdirSync(r).filter((d) => fs.existsSync(path.join(r, d, "hidden.test.mjs")))))].sort();
}

// node --test summary → passed/failed counts of top-level tests.
// A cancelled test (it timed out) is a failure, not a test that never existed.
export function parseTap(out) {
  const pass = Number(/^# pass (\d+)/m.exec(out)?.[1] ?? NaN);
  const fail = Number(/^# fail (\d+)/m.exec(out)?.[1] ?? NaN);
  const cancelled = Number(/^# cancelled (\d+)/m.exec(out)?.[1] ?? 0);
  return Number.isNaN(pass) || Number.isNaN(fail) ? null : { pass, fail: fail + cancelled };
}

// Browser graders import Playwright from the global install (the container ships one).
let pwEntry;
function playwrightEntry() {
  if (pwEntry !== undefined) return pwEntry;
  const root = spawnSync("npm", ["root", "-g"], { encoding: "utf8" }).stdout?.trim() || "";
  const entry = path.join(root, "playwright", "index.mjs");
  return (pwEntry = fs.existsSync(entry) ? entry : "playwright");
}

// The failing test names and their first error line, so a failed run says why.
export function failureReasons(out) {
  const reasons = [];
  const lines = out.split("\n");
  lines.forEach((line, i) => {
    const m = /^not ok \d+ - (.*)$/.exec(line.trim());
    if (!m) return;
    const err = lines.slice(i + 1, i + 40).find((l) => /error:|message:|Error\b/.test(l)) || "";
    reasons.push(`${m[1]}: ${err.trim()}`.slice(0, 300));
  });
  return reasons.slice(0, 5);
}

// Hidden-test grading. Builder-written modules run here, so with `wrap` the test runs inside
// the sandbox: private empty home, the build directory writable, the same masks as the builder.
export function grade(dir, task, { wrap = null } = {}) {
  fs.copyFileSync(path.join(taskDir(task), "hidden.test.mjs"), path.join(dir, "__hidden.test.mjs"));
  const nodeArgs = ["--test", "--test-reporter=tap", `--test-timeout=${taskConfig(task).test_timeout_ms}`, "__hidden.test.mjs"];
  const env = { ...(wrap ? builderEnvBase() : process.env), NODE_TEST_CONTEXT: undefined, OE_PLAYWRIGHT: playwrightEntry(), ...(wrap?.env || {}) };
  const [bin, argv] = wrap ? [wrap.argv[0], [...wrap.argv.slice(1), process.execPath, ...nodeArgs]] : [process.execPath, nodeArgs];
  const r = spawnSync(bin, argv, { cwd: dir, encoding: "utf8", timeout: Math.max(180000, taskConfig(task).test_timeout_ms * 8), env });
  const out = `${r.stdout}\n${r.stderr}`;
  const t = parseTap(out) || { pass: 0, fail: 1 };
  const total = t.pass + t.fail;
  return { hidden_pass: t.pass, hidden_total: total, score: total ? t.pass / total : 0, solved: t.fail === 0 && t.pass > 0, ...(t.fail ? { hidden_failures: failureReasons(out) } : {}) };
}

// Run fn with a grading sandbox (role grade) around `dir`, and remove its private home after.
export function withGradeSandbox(dir, sandbox, fn) {
  if (!sandbox) return fn(null);
  const w = builderWrap(dir, { ...sandbox, role: "grade" });
  try { return fn(w); } finally { fs.rmSync(w.job_home, { recursive: true, force: true }); }
}

export const promptSha = (arm, task) => crypto.createHash("sha256").update(task ? armPrompts(task, arm).join("\n\0\n") : ARMS[arm]).digest("hex").slice(0, 12);

// A task is either greenfield (ref.mjs is the reference solution.mjs) or brownfield
// (repo/ is the starting codebase and ref/ overlays the reference change on it).
export const SEED_MESSAGE = EVAL_SEED.subject;
const SEED_DATE = EVAL_SEED.date;
export function prepare(task, root = os.tmpdir()) {
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, `oe-${task}-`));
  const repo = path.join(taskDir(task), "repo");
  if (fs.existsSync(repo)) fs.cpSync(repo, dir, { recursive: true });
  const files = taskConfig(task).copy_spec ? ["spec.md", "visible.test.mjs"] : ["visible.test.mjs"];
  for (const f of files) if (fs.existsSync(path.join(taskDir(task), f))) fs.copyFileSync(path.join(taskDir(task), f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, "package.json"), '{"type":"module"}\n');
  // Both arms get an ordinary checkout: branch main, one root commit holding the task
  // files, and origin/main pointing at it (no network remote). A brand-new empty repo is
  // not what a user's project looks like, and the framework's worktree step needs a base.
  const g = (...a) => spawnSync("git", a, { cwd: dir, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_DATE: SEED_DATE, GIT_COMMITTER_DATE: SEED_DATE } });
  g("init", "-q", "-b", "main");
  g("config", "user.name", "outcome-eval");
  g("config", "user.email", "outcome-eval@local");
  g("add", "-A");
  const c = g("commit", "-q", "--no-verify", "-m", SEED_MESSAGE);
  if (c.status !== 0) throw new Error(`seeding the task repo failed: ${(c.stderr || "").slice(-200)}`);
  g("update-ref", "refs/remotes/origin/main", "HEAD");
  g("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");
  return dir;
}

// ---------------------------------------------------------------------------------------
// The builder sandbox. Every arm builds inside bubblewrap with a PRIVATE home that holds
// nothing of the real one except the credentials file. Inside the sandbox HOME is always
// the fixed path SANDBOX_HOME, so a home built once (the framework install) can be cloned
// to any host directory and still match the absolute paths setup wrote into it.
// ---------------------------------------------------------------------------------------
export const SANDBOX_HOME = "/tmp/oe-home";
const CONTEXT_FILES = ["CLAUDE.md", "AGENTS.md", ".claude"];

const isUnder = (p, base) => { const r = path.relative(base, p); return r === "" || (!r.startsWith("..") && !path.isAbsolute(r)); };
const uniq = (xs) => [...new Set(xs)];

// Is bubblewrap on PATH? A plain scan, so tests can pass a PATH without it.
export function hasBwrap(pathEnv = process.env.PATH) {
  return String(pathEnv || "").split(path.delimiter).filter(Boolean).some((d) => { try { fs.accessSync(path.join(d, "bwrap"), fs.constants.X_OK); return true; } catch { return false; } });
}

// The claude command found on PATH as [real binary, path it is found at]. Only this file is
// brought back into the hidden home (not its directory, which may hold other agent CLIs).
export function claudeBinds(pathEnv = process.env.PATH) {
  for (const d of String(pathEnv || "").split(path.delimiter).filter(Boolean)) {
    const f = path.join(d, "claude");
    try { fs.accessSync(f, fs.constants.X_OK); return [[fs.realpathSync(f), f]]; } catch { /* next */ }
  }
  return [];
}

// Agent CLIs other than claude. A builder may only spend through claude, which the runner
// accounts for; these are made unavailable inside the sandbox.
export const FOREIGN_CLIS = Object.freeze(["codex", "grok", "cursor-agent", "agy", "gemini", "opencode", "kimi"]);
// Binaries of those CLIs that sit in visible PATH directories (hidden-home ones are already gone).
export function foreignCliMasks(pathEnv = process.env.PATH, { hidden = () => false } = {}) {
  const out = [];
  for (const d of String(pathEnv || "").split(path.delimiter).filter(Boolean)) for (const n of FOREIGN_CLIS) {
    const f = path.join(d, n);
    let real; try { real = fs.realpathSync(f); } catch { continue; }
    // Hidden paths, and links into the hidden home, are already unavailable in the sandbox.
    if (!hidden(f) && !hidden(real) && !out.includes(f)) out.push(f);
  }
  return out;
}
const SHIM_DIR = path.posix.join(SANDBOX_HOME, ".oe-shims");
// relay: the framework arm's `codex` is the client of the runner's review relay (lib/review-relay.mjs)
// instead of a blocked shim; every other foreign CLI stays blocked. Cross-family review is a
// framework requirement, so the arm that has a reviewer to call gets exactly that one door.
function writeForeignShims(home, { relay = false } = {}) {
  const d = path.join(home, ".oe-shims");
  fs.mkdirSync(d, { recursive: true });
  for (const n of FOREIGN_CLIS) fs.writeFileSync(path.join(d, n), `#!/bin/sh\necho "${n}: blocked in the eval sandbox (claude is the only agent CLI)" >&2\nexit 127\n`, { mode: 0o755 });
  if (relay) writeRelayShim(home);
}

// Playwright's global install and browser cache, read-only, so UI graders still work in a
// sandbox whose home is empty.
export function playwrightBinds() {
  const entry = playwrightEntry();
  const keep = [];
  if (path.isAbsolute(entry)) keep.push(path.dirname(path.dirname(entry)));
  const browsers = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), ".cache", "ms-playwright");
  if (fs.existsSync(browsers)) keep.push(browsers);
  return { keep, browsers: fs.existsSync(browsers) ? browsers : null };
}

// Claude walks up from its working directory reading CLAUDE.md, AGENTS.md and .claude/.
// A build directory under a directory that has any of them is contaminated, so the run
// refuses to start (reports which ancestor and which file).
export function ancestorContamination(dir) {
  let cur = path.dirname(fs.realpathSync(dir));
  const found = [];
  for (;;) {
    for (const f of CONTEXT_FILES) if (fs.existsSync(path.join(cur, f))) found.push(path.join(cur, f));
    const up = path.dirname(cur);
    if (up === cur) break;
    cur = up;
  }
  return found;
}
export function assertCleanAncestors(dir) {
  const found = ancestorContamination(dir);
  if (found.length) throw new Error(`build dir ancestors carry agent context: ${found.join(", ")}`);
}

// The bubblewrap argument list (an array, never a shell string). Pure: no filesystem writes.
//   dir          the writable build directory (null for the framework install)
//   jobHome      host directory bound at SANDBOX_HOME
//   credentials  the real credentials file, bound read-write over the placeholder in the home
//   hideRoots    run-level directories (work root, keep root) emptied BEFORE the job's own
//                directory is bound back, so sibling builds and kept artifacts stay unreadable
//   maskRoots    directories shown empty (task folders incl. extra roots, results, kept builds)
//   keepRo       host paths that must stay readable although they sit under /tmp or the real home
//   keepFiles    [real file, path] pairs bound read-only (the claude binary, node)
//   reBind       read-only paths bound back after the masks (the one task a grader needs)
//   blockFiles   files replaced by /dev/null (foreign agent CLIs)
export function bwrapArgv({ dir = null, jobHome, credentials = null, hideRoots = [], maskRoots = [], keepRo = [], keepFiles = [], reBind = [], blockFiles = [], realHome = os.homedir() }) {
  const a = ["bwrap", "--ro-bind", "/", "/", "--tmpfs", "/tmp"];
  if (realHome && realHome !== "/") a.push("--tmpfs", realHome);
  for (const h of uniq(hideRoots)) a.push("--tmpfs", h);
  for (const k of uniq(keepRo)) a.push("--ro-bind", k, k);
  for (const [from, to] of keepFiles) a.push("--ro-bind", from, to);
  if (dir) a.push("--bind", dir, dir);
  a.push("--bind", jobHome, SANDBOX_HOME);
  if (credentials) a.push("--bind", credentials, path.posix.join(SANDBOX_HOME, ".claude", ".credentials.json"));
  a.push("--tmpfs", "/sys/fs/cgroup");
  for (const m of uniq(maskRoots)) a.push("--tmpfs", m);
  for (const r of uniq(reBind)) a.push("--ro-bind", r, r);
  for (const f of uniq(blockFiles)) a.push("--ro-bind", "/dev/null", f);
  a.push("--dev", "/dev", "--proc", "/proc", "--unshare-pid", "--die-with-parent", "--");
  return a;
}

// SVC_* and config-redirecting variables never reach a builder: the arm sees only its own
// home, not the orchestrator's session.
export function builderEnvBase(env = process.env) {
  const out = {};
  for (const [k, v] of Object.entries(env)) if (!/^SVC_/.test(k) && !/^XDG_/.test(k) && k !== "CLAUDE_CONFIG_DIR") out[k] = v;
  return out;
}

export function realCredentialsFile() { return process.env.OE_CREDENTIALS || path.join(os.homedir(), ".claude", ".credentials.json"); }

// Which directories a sandbox shows empty (and which single paths come back read-only after
// that). Pure over its inputs: the real home and the eval roots are parameters, so the result
// does not depend on the machine it is computed on.
export function sandboxMasks({ dir, framework = null, extraMaskRoots = [], exposeRoot = false, role = "build", task = null, northstar = NORTHSTAR, keepRo = [], realHome = os.homedir(), repoRoot = ROOT, kept = path.join(realHome, ".svc", "outcome-eval-artifacts") }) {
  const evalRoots = [path.join(repoRoot, "test-framework", "outcome-evals"), ...(framework ? [path.join(framework.src, "test-framework", "outcome-evals")] : []), ...[...taskRoots, ...extraMaskRoots].map((r) => path.dirname(r))];
  let answers = [...taskRoots, ...extraMaskRoots, ...answerDirs(evalRoots)];
  const reBind = [];
  if (role === "components") {
    // The grader needs its own code and this one task; everything else stays masked.
    answers = answers.filter((m) => !isUnder(northstar, m) && !isUnder(m, northstar));
    const t = task ? taskDir(task) : null;
    if (t && fs.existsSync(t)) reBind.push(t);
  }
  // A mask under the hidden real home would only recreate directory names there: skip those
  // unless the path was brought back read-only. (Never a mask that would swallow `dir`.)
  const visible = (m) => fs.existsSync(m) && (!isUnder(m, realHome) || keepRo.some((k) => isUnder(m, k)));
  const maskRoots = [...answers, kept, ...(exposeRoot ? [] : [repoRoot])].filter((m) => visible(m) && !isUnder(dir, m));
  return { maskRoots, reBind };
}

// Build the sandbox for one job. `jobHome` is created here: empty for the solo-style arms,
// a clone of the prebuilt framework home for the framework arm. Throws when there is no
// bubblewrap: nothing is scored without a sandbox. One helper serves every role:
//   build       the agent (credentials bound, claude on PATH)
//   grade       hidden tests run against builder code: private empty home, no credentials
//   components  component graders: as grade, with the northstar graders and the one task visible
export function builderWrap(dir, { jobHome = null, framework = null, model = null, extraMaskRoots = [], exposeRoot = false, credentials = undefined, hookMode = null, workRoot = path.dirname(dir), hideRoots = [], role = "build", task = null, northstar = NORTHSTAR, reviewRelay = false } = {}) {
  if (!hasBwrap()) throw new Error("no builder sandbox: bubblewrap (bwrap) is not available");
  const needsCreds = role === "build";
  if (needsCreds && credentials === undefined) credentials = realCredentialsFile();
  if (needsCreds && (!credentials || !fs.existsSync(credentials))) throw new Error(`no builder credentials file at ${credentials}`);
  if (!needsCreds) credentials = null;
  if (role === "components") exposeRoot = true;
  const home = jobHome || fs.mkdtempSync(path.join(workRoot, "home-"));
  if (framework) cloneHome(framework.home, home);
  fs.mkdirSync(path.join(home, ".claude"), { recursive: true });
  if (needsCreds) {
    const placeholder = path.join(home, ".claude", ".credentials.json");
    fs.rmSync(placeholder, { force: true });
    fs.writeFileSync(placeholder, "", { mode: 0o600 });
  }
  writeForeignShims(home, { relay: Boolean(reviewRelay && framework && role === "build") });
  if (framework) {
    const bad = verifyInstalledRoot(home, framework.src);
    if (bad.length) throw new Error(`installed root is not its archive: ${bad.slice(0, 3).join("; ")}`);
    const policy = writeFrameworkPolicies(home, framework.src, model, hookMode || "advisory");
    framework.slot_pin = policy.slot_pin;
  }
  const realHome = os.homedir();
  const hiddenByDefault = (p) => isUnder(p, "/tmp") || isUnder(p, realHome);
  const pw = playwrightBinds();
  const keepFiles = [...(needsCreds ? claudeBinds() : []), ...(hiddenByDefault(process.execPath) ? [[fs.realpathSync(process.execPath), process.execPath]] : [])].filter(([, to]) => hiddenByDefault(to));
  const extraKeep = [...(role === "components" ? [northstar] : [])];
  const keepRo = [...(exposeRoot ? [ROOT] : []), ...(framework ? [framework.src] : []), ...pw.keep, ...extraKeep].filter(hiddenByDefault);
  const { maskRoots, reBind } = sandboxMasks({ dir, framework, extraMaskRoots, exposeRoot, role, task, northstar, keepRo, realHome });
  // Run-level directories outside /tmp and the home (a custom --work-root or --keep) would
  // otherwise show every sibling build and kept artifact.
  const hide = hideRoots.filter((h) => fs.existsSync(h) && !hiddenByDefault(h));
  const blockFiles = foreignCliMasks(process.env.PATH, { hidden: hiddenByDefault });
  const argv = bwrapArgv({ dir, jobHome: home, credentials, hideRoots: hide, maskRoots, keepRo, keepFiles, reBind, blockFiles, realHome });
  const env = { PROBE_DIR: dir, PROBE_HOME: SANDBOX_HOME, HOME: SANDBOX_HOME, npm_config_cache: path.posix.join(SANDBOX_HOME, ".npm"), PATH: `${SHIM_DIR}${path.delimiter}${process.env.PATH || ""}` };
  if (pw.browsers) env.PLAYWRIGHT_BROWSERS_PATH = pw.browsers;
  if (model) { env.CLAUDE_CODE_SUBAGENT_MODEL = model; env.ANTHROPIC_SMALL_FAST_MODEL = model; }
  if (framework) { env.SVC_HOOK_MODE = hookMode || "advisory"; if (framework.checkpoint_mode === "eval-profile") env.SVC_DELIVERY_PROFILE = "eval"; }
  return { name: "bwrap", argv, env, job_home: home, role, foreign_cli: reviewRelay && framework && role === "build" ? "blocked-except-codex-relay" : "blocked", ...(framework ? { framework_home: home, slot_pin: framework.slot_pin } : {}) };
}

// The command the relay runs the real codex under, so a reviewer (whose prompt the builder
// writes) reads no more of the host than the builder could: the answer trees, kept artifacts,
// the live repository, the real credentials and every other job's directory are empty or
// absent; the build dir and the job home come back read-only; only CODEX_HOME (auth, sessions)
// and the call's scratch directory are writable. A deny-list for the home directory: codex's
// own binary and auth live there, so it cannot be hidden as a whole. OE_RELAY_NO_CONFINE=1
// runs codex unwrapped (for a host where codex cannot start under a second bubblewrap).
export function reviewerConfinement({ dir, jobHome, workRoot = path.dirname(dir), hideRoots = [], framework = null, extraMaskRoots = [], realHome = os.homedir(), codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), repoRoot = ROOT, northstar = NORTHSTAR }) {
  const masks = sandboxMasks({ dir, framework, extraMaskRoots, exposeRoot: false, role: "build", northstar, keepRo: [], realHome: "/nonexistent-oe-home", repoRoot, kept: path.join(realHome, ".svc", "outcome-eval-artifacts") }).maskRoots;
  const homeDeny = [".svc", ".claude", ".ssh", ".aws", ".gnupg", ".config/gh", ".git-credentials", ".netrc", ".npmrc"].map((x) => path.join(realHome, x)).filter((x) => fs.existsSync(x));
  const dirs = uniq([...masks, ...homeDeny.filter((x) => { try { return fs.statSync(x).isDirectory(); } catch { return false; } }), ...hideRoots.filter((h) => fs.existsSync(h)), ...(fs.existsSync(workRoot) ? [workRoot] : [])])
    .filter((m) => m !== "/" && !isUnder(codexHome, m));
  const files = homeDeny.filter((x) => { try { return fs.statSync(x).isFile(); } catch { return false; } });
  return ({ cwd, scratch, neutral = null }) => {
    const a = ["bwrap", "--ro-bind", "/", "/", "--dev", "/dev", "--proc", "/proc", "--unshare-pid", "--die-with-parent"];
    for (const m of dirs) a.push("--tmpfs", m);
    for (const f of files) a.push("--ro-bind", "/dev/null", f);
    for (const k of [dir, jobHome]) a.push("--ro-bind", k, k);
    if (fs.existsSync(codexHome)) a.push("--bind", codexHome, codexHome);
    a.push("--bind", scratch, scratch);
    // A neutral working directory is empty and stays read-only to codex.
    if (neutral) a.push("--ro-bind", neutral, neutral);
    a.push("--");
    return a;
  };
}

// Where an eval tree keeps its answers: the tasks (graders, references), recorded results and
// the northstar graders and bar. Masked in every sandbox, also inside a framework archive and
// beside any extra task root.
export const answerDirs = (evalRoots) => uniq(evalRoots.flatMap((r) => ["tasks", "results", "northstar"].map((d) => path.join(r, d))));

export function cloneHome(from, to) {
  fs.mkdirSync(to, { recursive: true });
  const r = spawnSync("cp", ["-a", `${from}${path.sep}.`, to], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`cloning the framework home failed: ${(r.stderr || "").slice(-200)}`);
  // `cp -a src/. dst` copies src's own mode onto dst; the framework's preflight refuses a
  // HOME that is not private, so the clone is as private as a fresh mkdtemp home.
  fs.chmodSync(to, 0o700);
}

// Journey specs: what a framework run is expected to do for a task (see journeys/README.md).
const JOURNEYS = path.join(NORTHSTAR, "journeys");
export function journeySpecPath(task, dir = JOURNEYS) { return path.join(dir, `${task}.json`); }
export function loadJourneySpec(task, dir = JOURNEYS) {
  const f = journeySpecPath(task, dir);
  if (!fs.existsSync(f)) return null;
  const spec = JSON.parse(fs.readFileSync(f, "utf8"));
  // A file that exists is a spec: a non-object is an error, never "no spec".
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) throw new Error(`journey spec for ${task} is not a JSON object`);
  return spec;
}
export function journeyProblems(tasks, dir = JOURNEYS) {
  const out = [];
  for (const task of new Set(tasks)) {
    let spec;
    try { spec = loadJourneySpec(task, dir); } catch (e) { out.push(`journey spec for ${task} is invalid: ${e.message}`); continue; }
    if (!spec) continue;
    if (spec.task !== task) out.push(`journey spec for ${task} names task ${JSON.stringify(spec.task)}`);
    for (const p of validateSpec(spec)) out.push(`journey spec ${task}: ${p}`);
  }
  return out;
}

// Every entry under <home>/.claude/skills that is a symlink must resolve inside the archive
// source. Returns the offending entries (empty when the install is the archive).
export function verifyInstalledRoot(home, src) {
  const skills = path.join(home, ".claude", "skills");
  const root = fs.realpathSync(src);
  const bad = [];
  if (!fs.existsSync(skills)) return [`${skills} missing`];
  for (const name of fs.readdirSync(skills)) {
    const f = path.join(skills, name);
    if (!fs.lstatSync(f).isSymbolicLink()) continue;
    let target;
    try { target = fs.realpathSync(f); } catch { target = path.resolve(path.dirname(f), fs.readlinkSync(f)); }
    if (!isUnder(target, root)) bad.push(`${name} -> ${target}`);
  }
  return bad;
}

// The framework's machine-local policies in the job home. Hook mode is advisory. When the
// framework at this sha ships a default dispatch policy, a copy with every slot pinned to
// the arm's model becomes the home's dispatch policy; otherwise only the environment pins
// the model.
export function pinDispatchPolicy(policy, model) {
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const o = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
      if (typeof o.model === "string" && o.model !== "web_search" && ("host" in o || "family" in o)) { o.model = model; if ("host" in o) o.host = "claude"; if ("family" in o) o.family = "anthropic"; }
      return o;
    }
    return v;
  };
  return walk(policy);
}
export function writeFrameworkPolicies(home, src, model, hookMode = "advisory") {
  const svcDir = path.join(home, ".svc");
  fs.mkdirSync(svcDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(svcDir, 0o700);
  // Owner-protected policy files (the resolvers require 0600-style ownership): written through
  // the state writer, then tightened.
  const put = (name, doc) => { const f = path.join(svcDir, name); writeJsonAtomic(f, doc); fs.chmodSync(f, 0o600); };
  put("hook-policy.json", { mode: hookMode });
  const def = path.join(src, "references", "default-dispatch-policy.json");
  if (!model || !fs.existsSync(def)) return { slot_pin: "env-only" };
  put("dispatch-policy.json", pinDispatchPolicy(JSON.parse(fs.readFileSync(def, "utf8")), model));
  return { slot_pin: "dispatch-policy" };
}

// What a framework source tree at one sha can and cannot do, read once per sha.
export function frameworkCapabilities(src) {
  let profiles = {};
  try { profiles = JSON.parse(fs.readFileSync(path.join(src, "references", "delivery-profiles.json"), "utf8")).profiles || {}; } catch { /* absent */ }
  const grep = spawnSync("grep", ["-rIl", "--exclude-dir=node_modules", "--exclude-dir=docs", "--exclude-dir=test-framework", "same_family_release", ...["scripts", "hooks", "references", "skills", "schemas"].map((d) => path.join(src, d)).filter((d) => fs.existsSync(d))], { encoding: "utf8" });
  return {
    checkpoint_mode: "eval" in profiles ? "eval-profile" : "prompt-sentence",
    has_fail_open_counter: fs.existsSync(path.join(src, "scripts", "lib", "fail-open-counter.mjs")),
    has_same_family_release: grep.status === 0 && grep.stdout.trim().length > 0,
    has_dispatch_policy: fs.existsSync(path.join(src, "references", "default-dispatch-policy.json")),
  };
}

// The framework install, built once per sha: `git archive <sha>` into a cache directory
// outside the repository, then `<src>/setup --host claude` inside the sandbox with an
// empty private home bound at SANDBOX_HOME. Jobs clone that home.
export function buildFrameworkHome(sha, { repo = ROOT, cacheRoot = path.join(os.homedir(), ".svc", "outcome-eval-cache") } = {}) {
  if (!hasBwrap()) throw new Error("no builder sandbox: bubblewrap (bwrap) is not available");
  const rev = spawnSync("git", ["-C", repo, "rev-parse", "--verify", `${sha}^{commit}`], { encoding: "utf8" });
  if (rev.status !== 0) throw new Error(`--framework-sha ${sha} is not a commit in ${repo}`);
  const full = rev.stdout.trim();
  const cache = path.join(cacheRoot, full);
  const src = path.join(cache, "src"), home = path.join(cache, "home");
  const done = () => fs.existsSync(path.join(cache, "ok"));
  if (!done()) {
    fs.rmSync(cache, { recursive: true, force: true });
    fs.mkdirSync(src, { recursive: true }); fs.mkdirSync(home, { recursive: true });
    const tarFile = path.join(cache, "src.tar");
    const arch = spawnSync("git", ["-C", repo, "archive", "--format=tar", "-o", tarFile, full], { encoding: "utf8" });
    if (arch.status !== 0) throw new Error(`git archive failed: ${(arch.stderr || "").slice(-200)}`);
    const ex = spawnSync("tar", ["-xf", tarFile, "-C", src], { encoding: "utf8" });
    fs.rmSync(tarFile, { force: true });
    if (ex.status !== 0) throw new Error(`extracting the archive failed: ${(ex.stderr || "").slice(-200)}`);
    const realSrc = fs.realpathSync(src);
    const keepRo = [realSrc].filter((p) => isUnder(p, "/tmp") || isUnder(p, os.homedir()));
    const argv = bwrapArgv({ jobHome: home, keepRo });
    const env = { ...builderEnvBase(), HOME: SANDBOX_HOME, npm_config_cache: path.posix.join(SANDBOX_HOME, ".npm"), PROBE_HOME: SANDBOX_HOME };
    const r = spawnSync(argv[0], [...argv.slice(1), path.join(realSrc, "setup"), "--host", "claude"], { env, encoding: "utf8", timeout: 600000, cwd: realSrc });
    if (r.status !== 0) { fs.rmSync(cache, { recursive: true, force: true }); throw new Error(`framework setup failed: ${(r.stderr || r.stdout || "").slice(-300)}`); }
    const skillDirs = fs.existsSync(path.join(realSrc, "skills")) ? fs.readdirSync(path.join(realSrc, "skills")).length : 0;
    const installed = fs.existsSync(path.join(home, ".claude", "skills")) ? fs.readdirSync(path.join(home, ".claude", "skills")).length : 0;
    if (installed < Math.max(1, Math.floor(skillDirs * 0.9))) { fs.rmSync(cache, { recursive: true, force: true }); throw new Error(`framework setup installed ${installed} entries, expected about ${skillDirs}`); }
    fs.writeFileSync(path.join(cache, "ok"), full + "\n");
  }
  const realSrc = fs.realpathSync(src);
  const bad = verifyInstalledRoot(home, realSrc);
  if (bad.length) throw new Error(`installed root is not its archive: ${bad.slice(0, 3).join("; ")}`);
  return { sha: full, src: realSrc, home, ...frameworkCapabilities(realSrc) };
}

// Fail-open counter (organism plan 4, 5.4). Contract: <build>/.svc/fail-open-counter.json
// { total, by_hook: { hook: { error_class: n } } }. A framework source without the counter
// library reports "counter absent".
export function readFailOpen(dir, caps) {
  if (!caps?.has_fail_open_counter) return { fail_open: "counter absent" };
  const f = path.join(dir, ".svc", "fail-open-counter.json");
  if (!fs.existsSync(f)) return { fail_open: 0 };
  try {
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    if (!Number.isInteger(j.total) || j.total < 0) return { fail_open: "counter unreadable" };
    return { fail_open: j.total, ...(j.total ? { fail_open_by_hook: j.by_hook ?? null } : {}) };
  } catch { return { fail_open: "counter unreadable" }; }
}

// One run, and a second only when the first failed open at least once. The second result is
// kept (flagged); a repeat marks the rules as not loaded. Spend is the sum of all attempts.
export async function withFailOpenRerun(attempt, { model = null } = {}) {
  const first = await attempt(1);
  if (!(typeof first.fail_open === "number" && first.fail_open > 0)) return first;
  const second = await attempt(2);
  const sum = (k) => +((first[k] || 0) + (second[k] || 0)).toFixed(6);
  const merged = { ...second, fail_open_rerun: true, first_attempt_fail_open: first.fail_open, attempts: 2, cost_usd: sum("cost_usd") };
  for (const k of ["wall_ms", "turns", "duration_ms", "nested_cost_usd"]) if (first[k] != null || second[k] != null) merged[k] = (first[k] || 0) + (second[k] || 0);
  if (first.model_usage || second.model_usage) merged.model_usage = mergeModelUsage(first.model_usage, second.model_usage);
  if (first.judge_cost_usd != null || second.judge_cost_usd != null) merged.judge_cost_usd = sum("judge_cost_usd");
  // Reviewer calls of both attempts: their cost is already inside each attempt's cost_usd.
  if (first.reviewer_calls || second.reviewer_calls) {
    merged.reviewer_calls = [...(first.reviewer_calls || []), ...(second.reviewer_calls || [])];
    merged.reviewer_cost_usd = first.reviewer_cost_usd == null && second.reviewer_cost_usd == null ? null : sum("reviewer_cost_usd");
    for (const k of ["reviewer_unpriced_calls", "reviewer_wall_ms"]) merged[k] = (first[k] || 0) + (second[k] || 0);
  }
  if (first.artifact) merged.first_attempt_artifact = first.artifact;
  if (typeof second.fail_open === "number" && second.fail_open > 0) merged.rules_not_loaded = true;
  // Disqualifying errors are not forgiven by a clean second attempt: the combined usage is
  // judged, and an off-model rejection of the first attempt stays.
  const off = model ? offModelWork(merged.model_usage, model) : null;
  if (off) merged.error = `off-model work: ${off}`;
  else if (!merged.error && /^off-model work/.test(first.error || "")) merged.error = first.error;
  return merged;
}

// Receipts the run emitted: git notes on refs/notes/svc-receipts plus files under .svc/receipts.
export function countReceipts(dir) {
  const notes = spawnSync("git", ["-C", dir, "notes", "--ref=refs/notes/svc-receipts", "list"], { encoding: "utf8" });
  const noteCount = notes.status === 0 ? notes.stdout.split("\n").filter(Boolean).length : 0;
  let files = 0;
  const walk = (d) => { for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) { if (e.isDirectory()) walk(path.join(d, e.name)); else files++; } };
  walk(path.join(dir, ".svc", "receipts"));
  return { receipts_emitted: noteCount + files, receipts_notes: noteCount, receipts_files: files };
}

// Chain policy as the framework at this sha resolves it, and its same_family_release value.
export function chainFacts(dir, caps, src, home) {
  const out = { chain_policy: null, same_family_release: null };
  const lib = path.join(src, "scripts", "lib", "chain-policy.mjs");
  if (fs.existsSync(lib)) {
    const r = spawnSync(process.execPath, [lib, "--mode", "--repo", dir], { env: { PATH: process.env.PATH, HOME: home }, encoding: "utf8", timeout: 20000 });
    out.chain_policy = r.status === 0 ? r.stdout.trim() || null : null;
    if (out.chain_policy == null) out.chain_policy_reason = `resolver exited ${r.status}`;
  } else out.chain_policy_reason = "absent at this sha";
  if (!caps?.has_same_family_release) out.same_family_release_reason = "absent at this sha";
  else {
    for (const f of ["hook-policy.json", "dispatch-policy.json", "chain-policy.json"]) {
      try { const j = JSON.parse(fs.readFileSync(path.join(home, ".svc", f), "utf8")); if (j.same_family_release != null) { out.same_family_release = j.same_family_release; break; } } catch { /* next */ }
    }
    if (out.same_family_release == null) out.same_family_release_reason = "not set in the job home policy";
  }
  return out;
}

// Merge every step's per-model usage and judge whether a model other than the arm's did real
// work: more than 1000 output tokens AND more than 5% of the run's output tokens. The CLI's
// small background calls stay below that and are tolerated (section 11, item 7).
export function mergeModelUsage(...usages) {
  const out = {};
  for (const u of usages) for (const [m, v] of Object.entries(u || {})) {
    const t = (out[m] ??= { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0 });
    for (const k of Object.keys(t)) t[k] += Number(v?.[k]) || 0;
  }
  return out;
}
export const isArmModel = (id, arm) => id === arm || String(id).toLowerCase().includes(String(arm).toLowerCase());
export function offModelWork(usage, armModel, { minTokens = 1000, minShare = 0.05 } = {}) {
  const entries = Object.entries(usage || {});
  const total = entries.reduce((a, [, v]) => a + (Number(v?.outputTokens) || 0), 0);
  for (const [id, v] of entries) {
    if (isArmModel(id, armModel)) continue;
    const out = Number(v?.outputTokens) || 0;
    if (out > minTokens && out > minShare * total) return id;
  }
  return null;
}

// ---------------------------------------------------------------------------------------
// Nested sessions. The outer CLI envelope covers the outer session and its own subagents
// (their transcripts carry the outer session id). A Bash-launched `claude -p` is a separate
// session with its own id, and its spend never reaches the envelope. The job home is private,
// so every session's transcript lands under <home>/.claude/projects/**.jsonl; sessions other
// than the known outer ones are summed here and priced from the repo's model table.
// ---------------------------------------------------------------------------------------
const MODEL_INTEL = path.join(ROOT, "references", "model-intel", "models.json");
// USD per token for one model id: output price from the table; input is a fifth of it, a cache
// read a tenth of input, a cache write 1.25x input (the first-party price ratios). A model the
// table does not know is priced at the dearest known output rate and flagged.
export function modelRates(id, table = JSON.parse(fs.readFileSync(MODEL_INTEL, "utf8")).models) {
  const entries = Object.entries(table);
  const hit = entries.find(([alias, v]) => v.id === id) || entries.find(([alias]) => String(id).toLowerCase().includes(alias));
  const outPerM = hit ? hit[1].price_out : Math.max(...entries.map(([, v]) => v.price_out));
  const out = outPerM / 1e6, input = out / 5;
  return { input, output: out, cacheRead: input * 0.1, cacheWrite: input * 1.25, known: Boolean(hit) };
}
export function priceUsage(id, u, table) {
  const r = modelRates(id, table);
  return { usd: (u.inputTokens || 0) * r.input + (u.outputTokens || 0) * r.output + (u.cacheReadInputTokens || 0) * r.cacheRead + (u.cacheCreationInputTokens || 0) * r.cacheWrite, known: r.known };
}

// Sum assistant usage over every session transcript in `home` whose session id is not in
// `knownIds`. A message is written once per content block, so records are de-duplicated by
// message id (the last one, which carries the final output count, wins).
export function nestedUsage(home, knownIds = new Set(), table) {
  const files = [];
  const walk = (d) => { for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (e.name.endsWith(".jsonl")) files.push(f); } };
  walk(path.join(home, ".claude", "projects"));
  const msgs = new Map(), sessions = new Set();
  for (const f of files) for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    if (!line.includes('"usage"')) continue;
    let j; try { j = JSON.parse(line); } catch { continue; }
    const m = j.message;
    if (j.type !== "assistant" || !m?.usage || !m.model || m.model === "<synthetic>") continue;
    if (knownIds.has(j.sessionId)) continue;
    sessions.add(j.sessionId);
    const key = `${j.sessionId}:${m.id || j.requestId || j.uuid}`;
    const prev = msgs.get(key);
    if (!prev || (m.usage.output_tokens || 0) >= (prev.usage.output_tokens || 0)) msgs.set(key, { model: m.model, usage: m.usage });
  }
  const model_usage = {};
  for (const { model, usage } of msgs.values()) {
    const t = (model_usage[model] ??= { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0 });
    t.inputTokens += usage.input_tokens || 0; t.outputTokens += usage.output_tokens || 0;
    t.cacheReadInputTokens += usage.cache_read_input_tokens || 0; t.cacheCreationInputTokens += usage.cache_creation_input_tokens || 0;
  }
  let usd = 0; const unpriced = [];
  for (const [id, u] of Object.entries(model_usage)) { const pr = priceUsage(id, u, table); u.costUSD = +pr.usd.toFixed(6); usd += pr.usd; if (!pr.known) unpriced.push(id); }
  return { model_usage, usd: +usd.toFixed(6), sessions: sessions.size, unpriced };
}

// Complete JSON lines from a CLI stream (or a single result object). Assistant usage is priced
// with modelRates; a result line's total_cost_usd replaces that price for the same buffer so
// the envelope is not added twice. A trailing partial line is ignored.
export function parseUsageLines(text, table) {
  const raw = String(text || "");
  const lines = raw.split("\n");
  if (!raw.endsWith("\n")) lines.pop();
  const msgs = new Map();
  const sessionIds = new Set();
  let result = null;
  let totalCost = null;
  const take = (j) => {
    if (!j || typeof j !== "object") return;
    const sid = j.sessionId || j.session_id || null;
    if (sid) sessionIds.add(sid);
    if (j.type === "result" || typeof j.total_cost_usd === "number") {
      result = j;
      if (typeof j.total_cost_usd === "number") totalCost = j.total_cost_usd;
    }
    const m = j.message;
    if (j.type !== "assistant" || !m?.usage || !m.model || m.model === "<synthetic>") return;
    const key = `${sid || ""}:${m.id || j.requestId || j.uuid || "anon"}`;
    const prev = msgs.get(key);
    const outTok = m.usage.output_tokens ?? m.usage.outputTokens ?? 0;
    if (!prev || outTok >= (prev.usage.output_tokens ?? prev.usage.outputTokens ?? 0)) msgs.set(key, { model: m.model, usage: m.usage });
  };
  for (const line of lines) {
    const s = line.trim();
    if (!s.startsWith("{")) continue;
    try { take(JSON.parse(s)); } catch { /* partial or noise */ }
  }
  const model_usage = {};
  for (const { model, usage } of msgs.values()) {
    const t = (model_usage[model] ??= { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0 });
    t.inputTokens += usage.input_tokens ?? usage.inputTokens ?? 0;
    t.outputTokens += usage.output_tokens ?? usage.outputTokens ?? 0;
    t.cacheReadInputTokens += usage.cache_read_input_tokens ?? usage.cacheReadInputTokens ?? 0;
    t.cacheCreationInputTokens += usage.cache_creation_input_tokens ?? usage.cacheCreationInputTokens ?? 0;
  }
  let priced = 0;
  for (const [id, u] of Object.entries(model_usage)) {
    const pr = priceUsage(id, u, table);
    u.costUSD = +pr.usd.toFixed(6);
    priced += pr.usd;
  }
  const usd = totalCost != null ? totalCost : priced;
  return { usd: +usd.toFixed(6), priced: +priced.toFixed(6), totalCost, sessionIds, model_usage, result };
}

// Outer stream cost plus transcript sessions the stream does not already cover.
export function jobLiveUsd(streamText, home, knownIds = new Set(), table) {
  const parsed = parseUsageLines(streamText, table);
  const known = new Set(knownIds);
  for (const id of parsed.sessionIds) known.add(id);
  let extra = 0;
  if (home) {
    try { extra = nestedUsage(home, known, table).usd; } catch { extra = 0; }
  }
  return { usd: +((parsed.usd || 0) + extra).toFixed(6), parsed, extra };
}

// A result envelope is the CLI's final JSON, not an assistant usage line that happens to parse.
function resultEnvelope(text) {
  const parsed = parseUsageLines(text);
  let whole = null;
  try { whole = JSON.parse(text); } catch { /* ndjson, or still incomplete */ }
  const looksResult = whole && (whole.total_cost_usd != null || whole.num_turns != null || typeof whole.result === "string" || whole.is_error != null);
  return { j: looksResult ? whole : parsed.result, parsed };
}

// "timeout" when the safety timeout killed the run, "max_turns" when it ended at its turn
// limit, "budget" when the CLI stopped it on its spending cap (all three score 0 downstream).
export function stoppedBy({ timedOut = false, stop = null } = {}) {
  if (timedOut) return "timeout";
  if (/max[_-]?turns/i.test(String(stop || ""))) return "max_turns";
  return /max[_-]?budget/i.test(String(stop || "")) ? "budget" : null;
}

// Kill the CLI and every child it spawned. detached:true makes the child a process-group
// leader; signalling the negative pid reaches that group. Never signal this process.
export function killProcessGroup(child, signal = "SIGKILL") {
  const pid = child?.pid;
  if (!Number.isInteger(pid) || pid <= 1 || pid === process.pid) return false;
  try { process.kill(-pid, signal); return true; }
  catch {
    try { child.kill(signal); return true; } catch { return false; }
  }
}

// How often a running builder's live spend is re-read. Tests pass a shorter interval.
export const BUDGET_POLL_MS = 3000;

// "run-budget" when this job's live spend would put settled + every running job over the
// run cap, or when the job itself has passed 3× its claim. A job that has not reported
// any spend yet is left alone so a sibling's overshoot does not stamp it.
export function runBudgetStop({ cap, spent = 0, live = new Map(), key, jobUsd, ceiling }) {
  if (ceiling != null && jobUsd > ceiling) return "run-budget";
  if (cap == null || !(jobUsd > 0)) return null;
  let others = spent;
  for (const [k, v] of live) if (k !== key) others += Number(v) || 0;
  return others + jobUsd > cap ? "run-budget" : null;
}

export function runAgent(dir, prompt, model, timeoutMs, tools = "Read,Write,Edit,Glob,Grep,Bash(node:*),Bash(ls:*),Bash(cat:*),Bash(curl:*),Bash(mkdir:*)", maxTurns = 40, effort = null, extraArgs = [], wrap = null, watch = null) {
  return new Promise((resolve) => {
    // The model guides tell you to sweep effort on your own evals rather than assume a level.
    const args = ["-p", "--model", model, "--output-format", "json", "--max-turns", String(maxTurns), ...(effort ? ["--effort", effort] : []), ...extraArgs, "--allowedTools", tools];
    // The prompt goes on stdin: --allowedTools is variadic and would swallow it.
    // wrap: an OS sandbox the claude command runs inside, as an argument list (builders) or
    // a shell prefix (probe-loop's sandbox_cmd, which callers write as shell).
    const [bin, argv] = wrap?.argv ? [wrap.argv[0], [...wrap.argv.slice(1), "claude", ...args]] : wrap?.prefix ? ["sh", ["-c", `${wrap.prefix} "$@"`, "sh", "claude", ...args]] : ["claude", args];
    const base = wrap?.argv ? builderEnvBase() : process.env;
    // detached: the child is its own process-group leader so a budget kill reaches grandchildren.
    const child = spawn(bin, argv, { cwd: dir, detached: true, stdio: ["pipe", "pipe", "pipe"], env: { ...base, OE_PLAYWRIGHT: playwrightEntry(), ...(wrap?.env || {}) } });
    child.stdin.end(prompt);
    let out = "";
    child.stdout.on("data", (c) => { out += c; });
    const stop = { reason: null };
    const mark = (reason) => {
      if (stop.reason || child.exitCode != null || child.signalCode != null) return;
      stop.reason = reason;
      killProcessGroup(child);
    };
    const liveKey = watch?.key || (child.pid ? `pid-${child.pid}` : "job");
    const noteLive = () => {
      if (!watch?.budget || watch.claimUsd == null) return null;
      const part = jobLiveUsd(out, watch.home || null, watch.knownSessionIds || new Set());
      // extraUsd: spend the stream cannot show, the framework arm's relayed reviewer calls.
      const jobUsd = +((watch.priorUsd || 0) + (part.usd || 0) + (typeof watch.extraUsd === "function" ? Number(watch.extraUsd()) || 0 : 0)).toFixed(6);
      watch.budget.noteLive(liveKey, jobUsd);
      return jobUsd;
    };
    const poll = () => {
      const jobUsd = noteLive();
      if (jobUsd == null || stop.reason) return;
      const ceiling = watch.claimUsd * 3;
      const reason = runBudgetStop({ cap: watch.budget.cap, spent: watch.budget.spent, live: watch.budget.live, key: liveKey, jobUsd, ceiling });
      if (reason) mark(reason);
    };
    const watchTimer = watch?.budget && watch.claimUsd != null
      ? setInterval(poll, watch.intervalMs > 0 ? watch.intervalMs : BUDGET_POLL_MS)
      : null;
    if (watchTimer?.unref) watchTimer.unref();
    const timer = setTimeout(() => mark("timeout"), timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (watchTimer) clearInterval(watchTimer);
      noteLive();
      const { j, parsed } = resultEnvelope(out);
      const sessionFromStream = j?.session_id || j?.sessionId || [...(parsed.sessionIds || [])][0] || null;
      const modelUsage = j?.modelUsage && Object.keys(j.modelUsage).length ? j.modelUsage : (parsed.model_usage || {});
      const cost = j && j.total_cost_usd != null ? j.total_cost_usd : (parsed.priced > 0 ? parsed.priced : null);
      const acct = (j || cost != null) ? { cost_usd: cost, turns: j?.num_turns ?? null, duration_ms: j?.duration_ms ?? null, model_id: Object.keys(modelUsage)[0] || null, model_usage: modelUsage, session_id: sessionFromStream } : {};
      if (stop.reason === "timeout") return resolve({ ...acct, ok: false, error: `timeout after ${Math.round(timeoutMs / 1000)}s`, stopped_by: "timeout", model_usage: acct.model_usage || {} });
      if (stop.reason === "run-budget") return resolve({ ...acct, ok: false, error: "stopped: run budget", stopped_by: "run-budget", model_usage: acct.model_usage || {}, text: typeof j?.result === "string" ? j.result : "" });
      const why = j ? j.subtype || j.terminal_reason || null : null;
      resolve(j ? { ok: !j.is_error, ...acct, stop: why, stopped_by: stoppedBy({ stop: why }), text: typeof j.result === "string" ? j.result : "" }
        : { ...acct, ok: false, error: `exit ${code}; no JSON result`, stopped_by: null, model_usage: acct.model_usage || {} });
    });
  });
}

// Grade a build, then ALWAYS delete the grader copied into it, also when the judge throws.
// A thrown error carries the fields graded so far on `partial`.
export async function gradeAndCleanup(dir, task, { judgeFn = null, componentsFn = null, sandbox = null } = {}) {
  const fields = {};
  try {
    Object.assign(fields, withGradeSandbox(dir, sandbox, (wrap) => grade(dir, task, { wrap })));
    fs.rmSync(path.join(dir, "__hidden.test.mjs"), { force: true });
    if (componentsFn) Object.assign(fields, await componentsFn());
    if (judgeFn) Object.assign(fields, await judgeFn());
    return fields;
  } catch (e) {
    e.partial = fields;
    throw e;
  } finally {
    fs.rmSync(path.join(dir, "__hidden.test.mjs"), { force: true });
  }
}

// Component graders (E, S, P, K), written elsewhere: northstar/graders/index.mjs exports
// gradeComponents(dir, task, { components }) and northstar/bar.json lists matrix[task].
// Both must exist, otherwise nothing is graded. A grader that throws scores 0.
export async function gradeComponentsFor(dir, task, { northstar = NORTHSTAR, sandbox = null } = {}) {
  const index = path.join(northstar, "graders", "index.mjs"), barFile = path.join(northstar, "bar.json");
  if (!fs.existsSync(index) || !fs.existsSync(barFile)) return {};
  if (sandbox) {
    // The graders run builder code, so the whole grading step runs in a child inside the
    // sandbox (role components: northstar and this one task visible, nothing else of the eval).
    const w = builderWrap(dir, { ...sandbox, role: "components", task, northstar });
    try {
      const c = componentGradeCommand(w, { dir, task, northstar });
      const r = spawnSync(c.cmd, c.args, { cwd: dir, encoding: "utf8", timeout: 900000, env: { ...builderEnvBase(), NODE_TEST_CONTEXT: undefined, OE_PLAYWRIGHT: playwrightEntry(), ...c.env } });
      const line = String(r.stdout || "").split("\n").reverse().find((l) => l.startsWith("OE_COMPONENTS "));
      if (line) return JSON.parse(line.slice("OE_COMPONENTS ".length));
      return failComponents(dir, task, northstar, `component grading child failed: ${String(r.stderr || r.error || "").slice(-200)}`);
    } finally { fs.rmSync(w.job_home, { recursive: true, force: true }); }
  }
  let cell;
  try { cell = JSON.parse(fs.readFileSync(barFile, "utf8")).matrix?.[task]; } catch { return {}; }
  const components = Array.isArray(cell) ? cell : cell && typeof cell === "object" ? Object.keys(cell).filter((k) => cell[k]) : [];
  if (!components.length) return {};
  const scores = {}, errors = {};
  let result = null;
  // The graders find tasks kept outside the repo through this variable (same roots, same order).
  Object.assign(process.env, externalRootsEnv());
  try {
    const mod = await import(`${pathToFileURL(index).href}?t=${Date.now()}`);
    result = await mod.gradeComponents(dir, task, { components });
  } catch (e) { for (const c of components) errors[c] = String(e?.message || e).slice(0, 300); }
  for (const c of components) {
    if (errors[c]) { scores[c] = 0; continue; }
    const v = typeof result?.[c] === "object" && result?.[c] !== null ? result[c].score : result?.[c];
    if (typeof v === "number" && Number.isFinite(v)) scores[c] = Math.min(1, Math.max(0, v));
    else { scores[c] = 0; errors[c] = "grader returned no score"; }
  }
  return { components: scores, ...(Object.keys(errors).length ? { component_errors: errors } : {}) };
}
// A grading child that could not report scores every applicable component 0 with the reason.
function failComponents(dir, task, northstar, reason) {
  let cell; try { cell = JSON.parse(fs.readFileSync(path.join(northstar, "bar.json"), "utf8")).matrix?.[task]; } catch { return {}; }
  const components = Array.isArray(cell) ? cell : cell && typeof cell === "object" ? Object.keys(cell).filter((k) => cell[k]) : [];
  return components.length ? { components: Object.fromEntries(components.map((c) => [c, 0])), component_errors: Object.fromEntries(components.map((c) => [c, reason])) } : {};
}

// A wall-time forecast printed once the first wave of jobs has settled.
export function forecastWall({ firstWaveMs, remaining, parallel }) {
  const mean = firstWaveMs.reduce((a, b) => a + b, 0) / Math.max(1, firstWaveMs.length);
  const waves = Math.ceil(remaining / Math.max(1, parallel));
  return { mean_job_ms: Math.round(mean), waves_left: waves, forecast_ms: Math.round(mean * waves) };
}
// The result files among a subcommand's arguments: options and the values they consume are not files.
const VALUE_OPTIONS = new Set(["--candidate", "--baseline", "--tasks-root", "--out", "--keep", "--work-root", "--model", "--judge", "--parallel", "--reps", "--arms", "--tasks", "--max-usd", "--effort", "--probes", "--framework-sha", "--framework-repo", "--framework-cache", "--northstar"]);
export function positionalArgs(args) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) { if (VALUE_OPTIONS.has(args[i]) && !args[i].includes("=")) i++; continue; }
    out.push(args[i]);
  }
  return out;
}
export function parseParallel(argv) {
  const i = argv.indexOf("--parallel");
  if (i < 0) return { error: "run requires an explicit --parallel N (the concurrency is part of the run's pre-registration)" };
  const n = Number(argv[i + 1]);
  return Number.isInteger(n) && n >= 1 ? { parallel: n } : { error: "--parallel must be a positive integer" };
}

export async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

// A spending cap for a whole run. Each job is offered an equal share of what is not yet
// spent or promised to a job in flight. That share is NOT passed to the CLI: --max-budget-usd
// is printed to the model. While a builder runs, a watchdog (runAgent's watch) polls its
// live spend and kills the process group when settled spend + every running job's live
// spend would pass the cap, or when that job passes 3× its claim. The killed job's spend
// still settles. A poll can overshoot by what arrived since the previous read. No job
// starts once the remaining share is below the floor.
export const JUDGE_SHARE = 0.15;
export class Budget {
  // judgeShare is the part of a job's share kept for the judge; with no judge (--judge none) it is 0
  // and the builder gets the whole share.
  constructor(capUsd, jobs, floorUsd = 0.5, judgeShare = JUDGE_SHARE) { this.cap = capUsd; this.left = jobs; this.floor = floorUsd; this.judgeShare = judgeShare; this.spent = 0; this.promised = 0; this.live = new Map(); }
  claim() {
    if (this.cap == null) { this.left--; return { usd: null }; }
    const share = (this.cap - this.spent - this.promised) / Math.max(1, this.left);
    this.left--;
    if (share < this.floor) return null;
    this.promised += share;
    return { usd: share, builder: +(share * (1 - this.judgeShare)).toFixed(2), judge: +(share * this.judgeShare).toFixed(2) };
  }
  noteLive(key, usd) { this.live.set(key, Math.max(0, Number(usd) || 0)); }
  clearLive(key) { this.live.delete(key); }
  liveSpend() { let n = 0; for (const v of this.live.values()) n += v; return n; }
  projectedSpend() { return this.spent + this.liveSpend(); }
  settle(claim, actualUsd) { if (claim?.usd != null) this.promised -= claim.usd; this.spent += actualUsd || 0; }
}

// Seeded statistics live in lib/stats.mjs (one bootstrap shared with northstar decide).
import { avg, compareSamples } from "./lib/stats.mjs";
export { compareSamples };

// Promotion rule for a prompt or method variant (candidate) over the current one
// (baseline), from recorded rows only. Judged tasks: promote when the judge-score gain is
// established (interval above zero and p < 0.05). Graded tasks: promote when the solve
// rate is higher, or equal at lower mean cost. Otherwise keep the baseline: a variant
// that costs more without a measured gain never wins.
export function promotionDecision(rows, candidate, baseline) {
  const of = (arm) => rows.filter((r) => r.arm === arm && !r.error);
  const c = of(candidate), b = of(baseline);
  if (!c.length || !b.length) return { promote: false, reason: "no runs for one of the arms" };
  const judged = (xs) => xs.filter((r) => typeof r.judge_total === "number").map((r) => r.judge_total);
  if (judged(c).length && judged(b).length) {
    const stats = compareSamples(judged(c), judged(b));
    const established = stats.ci95[0] > 0 && stats.p < 0.05;
    return { promote: established, reason: established ? "judge-score gain established" : "no established judge-score gain", stats };
  }
  const rate = (xs) => xs.filter((r) => r.solved).length / xs.length;
  const cost = (xs) => avg(xs.map((r) => r.cost_usd || 0));
  const [rc, rb, cc, cb] = [rate(c), rate(b), cost(c), cost(b)];
  if (rc > rb) return { promote: true, reason: `solves more (${rc.toFixed(2)} vs ${rb.toFixed(2)})` };
  if (rc === rb && cc < cb) return { promote: true, reason: `same solve rate at lower cost ($${cc.toFixed(4)} vs $${cb.toFixed(4)})` };
  return { promote: false, reason: rc < rb ? "solves less" : `same solve rate at equal or higher cost ($${cc.toFixed(4)} vs $${cb.toFixed(4)})` };
}

// The judge answers with one JSON object; take the last {...} block in its reply.
export function parseJudge(text) {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { const j = JSON.parse(m[0]); return typeof j.total === "number" && j.scores ? j : null; } catch { return null; }
}

// Blind rubric judging for tasks without a full contract (judge.md). The judge sees the
// product, never the arm or the instruction that produced it.
export async function judge(dir, task, model, maxUsd = null, wrap = null) {
  const rubric = path.join(taskDir(task), "judge.md");
  if (!model || !fs.existsSync(rubric)) return {};
  fs.rmSync(path.join(dir, "__hidden.test.mjs"), { force: true });
  for (const f of ["BRIEF.md", "RULES.md"]) if (fs.existsSync(path.join(dir, f))) fs.renameSync(path.join(dir, f), path.join(dir, `NOTES-${f}`));
  const jm = taskConfig(task).judge_model || model;
  const r = await runAgent(dir, fs.readFileSync(rubric, "utf8"), jm, 1800000, "Read,Glob,Grep,Bash(node:*),Bash(ls:*),Bash(cat:*)", 80, null, maxUsd ? ["--max-budget-usd", String(maxUsd)] : [], wrap);
  const verdict = parseJudge(r.text);
  return verdict ? { judge_model: jm, judge_total: verdict.total, judge_scores: verdict.scores, judge_verified_journeys: verdict.verified_journeys ?? null, judge_money_pump: verdict.money_pump_found ?? null, judge_notes: verdict.notes || "", judge_cost_usd: r.cost_usd } : { judge_model: jm, judge_error: r.error || "no JSON verdict" };
}

export function summarize(rows) {
  const by = {};
  for (const r of rows) {
    const k = r.arm; by[k] ??= { arm: k, runs: 0, errors: 0, solved: 0, score_sum: 0, cost: 0, turns: 0 };
    const s = by[k]; s.runs++;
    if (r.error) { s.errors++; continue; }
    s.solved += r.solved ? 1 : 0; s.score_sum += r.score; s.cost += r.cost_usd || 0; s.turns += r.turns || 0;
    if (typeof r.judge_total === "number") { s.judged = (s.judged || 0) + 1; s.judge_sum = (s.judge_sum || 0) + r.judge_total; }
  }
  return Object.values(by).map((s) => { const n = s.runs - s.errors; return { arm: s.arm, runs: s.runs, errors: s.errors, solved: `${s.solved}/${n}`, solve_rate: n ? +(s.solved / n).toFixed(3) : null, mean_hidden_score: n ? +(s.score_sum / n).toFixed(3) : null, mean_cost_usd: n ? +(s.cost / n).toFixed(4) : null, mean_turns: n ? +(s.turns / n).toFixed(1) : null, ...(s.judged ? { judged: s.judged, mean_judge_total: +(s.judge_sum / s.judged).toFixed(2) } : {}) }; });
}

export function check() {
  const problems = [];
  for (const task of listTasks()) {
    const base = taskDir(task);
    if (fs.existsSync(path.join(base, "repo"))) {
      // Brownfield: the untouched repo must fail; repo + ref must pass, including the repo's own tests.
      const plain = prepare(task);
      if (grade(plain, task).solved) problems.push(`${task}: grader passes the unchanged repository`);
      fs.cpSync(path.join(base, "ref"), plain, { recursive: true });
      const good = grade(plain, task);
      if (!good.solved) problems.push(`${task}: reference fails its grader (${good.hidden_pass}/${good.hidden_total})`);
      fs.rmSync(path.join(plain, "__hidden.test.mjs"), { force: true });
      const own = spawnSync(process.execPath, ["--test", "--test-reporter=tap"], { cwd: plain, encoding: "utf8", timeout: 120000, env: { ...process.env, OE_PLAYWRIGHT: playwrightEntry() } });
      if (own.status !== 0) problems.push(`${task}: reference breaks the repository's own tests`);
      fs.rmSync(plain, { recursive: true, force: true });
      // A plausible but wrong answer (ref-wrong/ overlay) must fail too.
      if (fs.existsSync(path.join(base, "ref-wrong"))) {
        const wrong = prepare(task);
        fs.cpSync(path.join(base, "ref-wrong"), wrong, { recursive: true });
        if (grade(wrong, task).solved) problems.push(`${task}: grader passes the plausible wrong answer in ref-wrong/`);
        fs.rmSync(wrong, { recursive: true, force: true });
      }
      continue;
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `oe-check-${task}-`));
    fs.writeFileSync(path.join(dir, "package.json"), '{"type":"module"}\n');
    fs.copyFileSync(path.join(base, "ref.mjs"), path.join(dir, "solution.mjs"));
    const good = grade(dir, task);
    if (!good.solved) problems.push(`${task}: reference fails its grader (${good.hidden_pass}/${good.hidden_total})`);
    // A planted bug: every export returns a constant. The grader must catch it.
    const src = fs.readFileSync(path.join(base, "ref.mjs"), "utf8");
    const names = [...src.matchAll(/export function (\w+)/g)].map((m) => m[1]);
    fs.writeFileSync(path.join(dir, "solution.mjs"), names.map((n) => `export function ${n}() { return 0; }`).join("\n"));
    if (grade(dir, task).solved) problems.push(`${task}: grader passes a constant stub`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return problems;
}

// ---- run preflight --------------------------------------------------------------------
// Everything that can be refused before a paid job starts, with no model call.
const BAR_FILE = path.join(NORTHSTAR, "bar.json");
const readBar = () => { try { return JSON.parse(fs.readFileSync(BAR_FILE, "utf8")); } catch { return null; } };
export const barFloor = (bar) => (typeof bar?.floor_usd === "number" ? bar.floor_usd : 0.5);
// The bar must load and carry a reserve list of { task, grader_sha256 (64 hex or null) }, otherwise
// reserve verification would silently be off. Returns the refusal text or null.
export function barProblem(bar) {
  if (!bar || typeof bar !== "object" || Array.isArray(bar)) return "northstar/bar.json is missing, unreadable or not an object: the reserve cannot be verified, so no run starts";
  if (!Array.isArray(bar.reserve)) return "northstar/bar.json has no reserve array: the reserve cannot be verified, so no run starts";
  if (!bar.reserve.every((e) => e && typeof e.task === "string" && e.task && (e.grader_sha256 === null || typeof e.grader_sha256 === "string"))) return "northstar/bar.json reserve must be a list of { task, grader_sha256 } (grader_sha256 a string or null)";
  if ("floor_usd" in bar && !(typeof bar.floor_usd === "number" && bar.floor_usd > 0)) return "northstar/bar.json floor_usd must be a positive number";
  return null;
}

// --sealed writes the scored rows to --out, so --out must be a plain file: not a device, FIFO,
// directory, or anything under /dev or /proc (/dev/stdout, /dev/fd/N). Returns the refusal or null.
export function sealedOutProblem(out) {
  const bad = (why) => `--sealed --out ${out}: ${why}; it must be a regular file path (new or existing) outside /dev and /proc`;
  const forbidden = (p) => /^\/(dev|proc)(\/|$)/.test(p);
  const abs = path.resolve(out);
  if (forbidden(abs)) return bad("under /dev or /proc");
  let target = abs;
  try { target = fs.realpathSync(abs); }
  catch (e) {
    if (e.code !== "ENOENT") return bad("cannot be resolved");
    // Does not exist yet: a dangling symlink is refused, a new file needs a real parent directory.
    try { fs.lstatSync(abs); return bad("is a dangling symlink"); } catch { /* not there at all */ }
    try { target = path.join(fs.realpathSync(path.dirname(abs)), path.basename(abs)); } catch { return bad("its directory does not exist"); }
    return forbidden(target) ? bad("under /dev or /proc") : null;
  }
  if (forbidden(target)) return bad("resolves under /dev or /proc");
  return fs.statSync(target).isFile() ? null : bad("is not a regular file");
}

// Every reserve task named in the run must exist and hash to its frozen grader_sha256.
export function reserveProblems(tasks, bar, dirOf = taskDir) {
  const out = [];
  for (const task of new Set(tasks)) {
    const res = reserveFrozenCheck(task, dirOf(task), bar);
    if (res?.problem) out.push(res.problem);
  }
  return out;
}

// { error } (exit 2) or { line, jobs, share } for the one line printed before the run starts.
export function preflightRun({ tasks, arms, reps, maxUsd, bar = readBar(), dirOf = taskDir, journeysDir = JOURNEYS }) {
  const bp = barProblem(bar);
  if (bp) return { error: `refusing to start: ${bp}` };
  const jobs = tasks.length * arms.length * reps;
  const floor = barFloor(bar);
  const share = maxUsd != null && jobs > 0 ? maxUsd / jobs : null;
  if (share != null && share < floor) {
    return { error: `refusing to start: tasks ${tasks.join(",")}; ${jobs} jobs (${tasks.length} tasks x ${arms.length} arms x ${reps} reps) at --max-usd ${maxUsd} is $${share.toFixed(3)} per job (arms ${arms.join(",")}), below the $${floor} floor, so later jobs would be skipped. Narrow --tasks / --arms / --reps, or raise --max-usd to at least $${(jobs * floor).toFixed(2)}.` };
  }
  const problems = reserveProblems(tasks, bar, dirOf);
  if (problems.length) return { error: `refusing to start: ${problems.join("; ")}` };
  // An arm that cannot prompt a task (e.g. a spec.md arm on a multi-session task) fails here,
  // before any job is paid for, not midway through the batch.
  const promptErrors = [];
  for (const task of new Set(tasks)) for (const arm of new Set(arms)) { try { armPrompts(task, arm); } catch (e) { promptErrors.push(e.message); } }
  if (promptErrors.length) return { error: `refusing to start: ${promptErrors.join("; ")}` };
  // A malformed journey spec would make every framework row of its task unscorable.
  const jp = journeyProblems(tasks, journeysDir);
  if (jp.length) return { error: `refusing to start: ${jp.join("; ")}` };
  const line = `plan: tasks ${tasks.join(",")}; ${jobs} jobs; ${share != null ? `$${share.toFixed(3)} per job` : "no cap"}; arms ${arms.join(",")}`;
  return { line, jobs, share };
}

async function main(argv) {
  const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  // Extra task roots apply to every subcommand (check and regrade find external tasks too).
  try { argv.forEach((a, i) => { if (a === "--tasks-root") addTaskRoot(argv[i + 1]); }); }
  catch (e) { process.stderr.write(`${e.message}\n`); return 2; }
  if (argv[0] === "check") {
    const problems = check();
    for (const p of problems) process.stderr.write(p + "\n");
    process.stdout.write(problems.length ? `outcome-eval check: ${problems.length} problem(s)\n` : `outcome-eval check: ${listTasks().length} graders sound\n`);
    return problems.length ? 1 : 0;
  }
  if (argv[0] === "component-grade") {
    // Internal: runs inside the grading sandbox (see gradeComponentsFor).
    const [dir, task] = positionalArgs(argv.slice(1));
    process.stdout.write(`OE_COMPONENTS ${JSON.stringify(await gradeComponentsFor(dir, task, { northstar: opt("--northstar", NORTHSTAR) }))}\n`);
    return 0;
  }
  if (argv[0] === "regrade") {
    // Re-score kept artifacts with the current graders; agent and judge results are unchanged.
    const file = positionalArgs(argv.slice(1))[0];
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const r of data.task_roots || []) if (fs.existsSync(r)) addTaskRoot(r);
    for (const row of data.rows) {
      if (!row.artifact || !fs.existsSync(row.artifact)) continue;
      const before = `${row.hidden_pass}/${row.hidden_total}`;
      delete row.hidden_failures;
      try { regradeRow(row, () => withGradeSandbox(row.artifact, { workRoot: os.tmpdir() }, (wrap) => grade(row.artifact, row.task, { wrap }))); }
      finally { fs.rmSync(path.join(row.artifact, "__hidden.test.mjs"), { force: true }); }
      process.stderr.write(`${row.task}/${row.arm}#${row.rep}: ${before} -> ${row.hidden_pass}/${row.hidden_total}\n`);
    }
    data.summary = summarize(data.rows);
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
    return 0;
  }
  if (argv[0] === "promote") {
    // node scripts/outcome-eval.mjs promote --candidate production --baseline plain <results.json...>
    const rest = argv.slice(1);
    const files = positionalArgs(rest);
    const rows = files.flatMap((f) => JSON.parse(fs.readFileSync(f, "utf8")).rows);
    const out = promotionDecision(rows, opt("--candidate"), opt("--baseline", "plain"));
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    return 0;
  }
  if (argv[0] === "summarize") {
    // Recorded evidence, re-derived: per-arm solve rate and cost relative to plain.
    const rows = positionalArgs(argv.slice(1)).flatMap((f) => JSON.parse(fs.readFileSync(f, "utf8")).rows);
    const by = Object.fromEntries(summarize(rows).map((s) => [s.arm, s]));
    const out = { runs: rows.length, errors: rows.filter((r) => r.error).length };
    for (const [arm, s] of Object.entries(by)) {
      out[`${arm}_solve_rate`] = s.solve_rate; out[`${arm}_mean_cost_usd`] = s.mean_cost_usd;
      if (s.mean_judge_total !== undefined) out[`${arm}_mean_judge_total`] = s.mean_judge_total;
    }
    // Judge-score difference from plain, with uncertainty: a difference whose interval spans
    // zero, or whose permutation p is 0.05 or more (small samples make the bootstrap
    // interval optimistic), is reported as not established.
    const judged = (arm) => rows.filter((r) => r.arm === arm && typeof r.judge_total === "number").map((r) => r.judge_total);
    for (const arm of Object.keys(by)) {
      if (arm === "plain") continue;
      const c = compareSamples(judged(arm), judged("plain"));
      if (c) { out[`${arm}_judge_vs_plain`] = c; out[`${arm}_judge_vs_plain_ci_low`] = c.ci95[0]; out[`${arm}_judge_vs_plain_established`] = (c.ci95[0] > 0 || c.ci95[1] < 0) && c.p < 0.05; }
    }
    // Quality probes and judge claims per arm: the dimensions hidden tests do not see.
    const meanOf = (xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3) : null);
    for (const arm of Object.keys(by)) {
      const ok = rows.filter((r) => r.arm === arm && !r.error);
      const probed = ok.filter((r) => r.probes);
      if (probed.length) {
        out[`${arm}_mutation_score`] = meanOf(probed.map((r) => r.probes.mutation?.score).filter((x) => typeof x === "number"));
        out[`${arm}_mutation_scored`] = `${probed.filter((r) => typeof r.probes.mutation?.score === "number").length}/${probed.length}`;
        out[`${arm}_source_loc`] = meanOf(probed.map((r) => r.probes.size.source_loc));
        out[`${arm}_source_files`] = meanOf(probed.map((r) => r.probes.size.source_files));
        out[`${arm}_slop`] = meanOf(probed.map((r) => r.probes.slop.todo_or_placeholder + r.probes.slop.empty_catch + r.probes.slop.unused_exports));
      }
      const judged = ok.filter((r) => r.judge_scores);
      if (judged.length) out[`${arm}_judge_claims`] = Object.fromEntries(Object.keys(judged[0].judge_scores).map((k) => [k, meanOf(judged.map((r) => Number(r.judge_scores[k]) || 0))]));
    }
    // Cost ratios compare matched tasks only: an arm run on harder tasks is not cheaper or dearer by that alone.
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const costOf = (arm, task) => { const xs = rows.filter((r) => r.arm === arm && r.task === task && !r.error).map((r) => r.cost_usd || 0); return xs.length ? mean(xs) : null; };
    for (const arm of Object.keys(by)) {
      const tasks = [...new Set(rows.map((r) => r.task))].filter((t) => costOf(arm, t) != null && costOf("plain", t) != null);
      if (!tasks.length) continue;
      const ratios = tasks.map((t) => costOf(arm, t) / costOf("plain", t));
      out[`${arm}_cost_vs_plain`] = +(tasks.reduce((a, t) => a + costOf(arm, t), 0) / tasks.reduce((a, t) => a + costOf("plain", t), 0)).toFixed(2);
      out[`${arm}_cost_vs_plain_range`] = [+Math.min(...ratios).toFixed(2), +Math.max(...ratios).toFixed(2)];
    }
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    return 0;
  }
  if (argv[0] !== "run") { process.stderr.write("usage: outcome-eval.mjs run --parallel N [--model haiku] [--reps 3] [--arms plain,blueprint] [--tasks ...] [--tasks-root <dir>]... [--framework-sha <sha>] [--max-usd 40] [--sealed --out file] | check\n  --sealed  print no score (progress counts, cost and wall time only); the full rows go to --out, which --sealed requires\n"); return 2; }
  const par = parseParallel(argv);
  if (par.error) { process.stderr.write(par.error + "\n"); return 2; }
  const parallel = par.parallel;
  const repsArg = String(opt("--reps", 3));
  if (!/^[1-9]\d*$/.test(repsArg)) { process.stderr.write(`--reps must be a positive integer (got ${JSON.stringify(repsArg)})\n`); return 2; }
  const model = opt("--model", "haiku"), reps = Number(repsArg);
  const judgeModel = opt("--judge", "sonnet") === "none" ? null : opt("--judge", "sonnet");
  const arms = opt("--arms", "plain,blueprint").split(",");
  const probeMutants = Number(opt("--probes", 0));
  const effort = opt("--effort", null);
  const tasks = opt("--tasks") ? opt("--tasks").split(",") : listTasks();
  const sealed = argv.includes("--sealed");
  if (sealed && !opt("--out")) { process.stderr.write("--sealed requires --out <file>: the rows are written there and nothing is printed that scores them\n"); return 2; }
  if (sealed) { const sp = sealedOutProblem(opt("--out")); if (sp) { process.stderr.write(sp + "\n"); return 2; } }
  const maxUsdArg = opt("--max-usd", null) == null ? null : Number(opt("--max-usd"));
  if (maxUsdArg != null && !(maxUsdArg > 0)) { process.stderr.write("--max-usd must be a positive number of dollars\n"); return 2; }
  const pre = preflightRun({ tasks, arms, reps, maxUsd: maxUsdArg });
  if (pre.error) { process.stderr.write(pre.error + "\n"); return 2; }
  process.stderr.write(pre.line + "\n");
  const keepRoot = opt("--keep", path.join(os.homedir(), ".svc", "outcome-eval-artifacts", new Date().toISOString().replace(/[:.]/g, "-")));
  fs.mkdirSync(keepRoot, { recursive: true });
  // Builds live under a root this runner owns; nothing above them may carry agent context.
  // --work-root names a parent; this invocation owns a unique directory beneath it and
  // deletes only that.
  const workBase = path.resolve(opt("--work-root", os.tmpdir()));
  fs.mkdirSync(workBase, { recursive: true });
  const workRoot = fs.mkdtempSync(path.join(workBase, "oe-run-"));
  try {
    try { assertCleanAncestors(workRoot); } catch (e) { process.stderr.write(`${e.message}\n`); return 2; }
    return await runAll({ argv, opt, parallel, workRoot, workBase, keepRoot, tasks, model, reps, judgeModel, arms, probeMutants, effort, sealed });
  } finally { fs.rmSync(workRoot, { recursive: true, force: true }); }
}

async function runAll({ argv, opt, parallel, workRoot, workBase, keepRoot, tasks, model, reps, judgeModel, arms, probeMutants, effort, sealed = false }) {
  let framework = null;
  if (arms.includes("framework")) {
    const sha = opt("--framework-sha", null);
    if (!sha) { process.stderr.write("the framework arm requires --framework-sha <sha> (the install is built from git archive of that commit)\n"); return 2; }
    try { framework = buildFrameworkHome(sha, { repo: opt("--framework-repo", ROOT), cacheRoot: opt("--framework-cache", undefined) }); }
    catch (e) { process.stderr.write(`framework install: ${e.message}\n`); return 2; }
    process.stderr.write(`framework ${framework.sha.slice(0, 12)}: checkpoints ${framework.checkpoint_mode}, fail-open counter ${framework.has_fail_open_counter ? "present" : "absent"}\n`);
  }
  const jobs = [];
  for (const task of tasks) for (const arm of arms) for (let r = 0; r < reps; r++) jobs.push({ task, arm, rep: r });
  const maxUsd = opt("--max-usd", null) == null ? null : Number(opt("--max-usd"));
  if (maxUsd != null && !(maxUsd > 0)) { process.stderr.write("--max-usd must be a positive number of dollars\n"); return 2; }
  const budget = new Budget(maxUsd, jobs.length, barFloor(readBar()), judgeModel ? JUDGE_SHARE : 0);
  process.stderr.write(`running ${jobs.length} jobs on ${model}, ${parallel} in parallel${maxUsd != null ? ` within $${maxUsd}` : ""}\n`);
  const t0Run = Date.now();
  const ctx = { model, effort, judgeModel, workRoot, keepRoot, framework, hide: [workBase, keepRoot], sealed, progress: { done: 0, total: jobs.length }, budget };
  const settled = [];
  const rows = await pool(jobs, parallel, async (job) => {
    const t0 = Date.now();
    const row = await runJob(job, budget, ctx);
    settled.push(Date.now() - t0);
    if (settled.length === Math.min(parallel, jobs.length) && jobs.length > settled.length) {
      const f = forecastWall({ firstWaveMs: settled, remaining: jobs.length - settled.length, parallel });
      process.stderr.write(`forecast: first wave of ${settled.length} took ${(f.mean_job_ms / 1000).toFixed(0)}s on average; ${jobs.length - settled.length} jobs left, about ${(f.forecast_ms / 60000).toFixed(1)} min more at --parallel ${parallel}\n`);
    }
    return row;
  });
  // Engineering-quality probes (test strength by mutation, size, slop, secrets) run on the
  // kept builds after every agent has finished: they run tests synchronously and would
  // otherwise stall the agents still working.
  if (probeMutants > 0) for (const row of rows) if (!row.error && row.artifact) {
    row.probes = probe(row.artifact, { mutants: probeMutants, startedAt: Date.parse(row.started_at) });
    const chaosSpec = path.join(taskDir(row.task), "chaos.json");
    if (fs.existsSync(chaosSpec)) row.probes.chaos = await chaosProbe(row.artifact, JSON.parse(fs.readFileSync(chaosSpec, "utf8")));
  }
  const result = { ran_at: new Date().toISOString(), model, reps, tasks, arms, parallel, task_roots: getTaskRoots().slice(1), ...(framework ? { framework_sha: framework.sha } : {}), summary: summarize(rows), rows };
  const out = opt("--out");
  if (out) fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  if (sealed) {
    // Counts, cost and wall time only: no solve rates, no pass/fail, no components.
    const cost = rows.reduce((n, r) => n + (r.cost_usd || 0) + (r.judge_cost_usd || 0), 0);
    process.stdout.write(JSON.stringify({ sealed: true, jobs: rows.length, error_rows: rows.filter((r) => r.error).length, cost_usd: +cost.toFixed(2), wall_s: Math.round((Date.now() - t0Run) / 1000), out }, null, 2) + "\n");
    return 0;
  }
  process.stdout.write(JSON.stringify(result.summary, null, 2) + "\n");
  return 0;
}

// A job the budget could not fund. It still names the task it would have run, by hash, so a
// frozen reserve can tell a skipped run of the right task from a row of some other task.
export function skippedRow(job, budget) {
  return { ...job, error: "skipped: budget", spent_before_usd: +budget.spent.toFixed(2), task_sha256: taskSha256(job.task) };
}

// One job: up to two attempts (a second only after a fail-open count), spend summed.
async function runJob(job, budget, ctx) {
  const claim = budget.claim();
  const tick = (what) => { if (ctx.progress) ctx.progress.done++; return ctx.sealed ? `job ${ctx.progress.done}/${ctx.progress.total}: ${what}` : null; };
  if (!claim) { const m = tick("skipped, budget spent"); process.stderr.write(`${m ?? `${job.task}/${job.arm}#${job.rep}: skipped, budget spent`}\n`); return skippedRow(job, budget); }
  let prior = 0;
  const row = await withFailOpenRerun(async (n) => {
    const r = await attemptJob(job, claim, ctx, n, prior);
    prior += (r.cost_usd || 0) + (r.judge_cost_usd || 0);
    return r;
  }, { model: ctx.model });
  const liveKey = `${job.task}/${job.arm}#${job.rep}`;
  budget.clearLive(liveKey);
  budget.settle(claim, (row.cost_usd || 0) + (row.judge_cost_usd || 0));
  const sealedMsg = tick(`${row.error ? "error row (see --out)" : "done"}, $${row.cost_usd}, ${Math.round((row.wall_ms || 0) / 1000)}s`);
  if (sealedMsg) { process.stderr.write(sealedMsg + "\n"); return row; }
  process.stderr.write(`${job.task}/${job.arm}#${job.rep}: ${row.error ? "ERROR " + row.error : `${row.hidden_pass}/${row.hidden_total}${row.solved ? " solved" : ""} $${row.cost_usd}`}${row.fail_open_rerun ? " (re-run after fail-open)" : ""}\n`);
  return row;
}

// Copy <jobHome>/.claude/projects to `to`; returns `to`, or null when the run left none.
export function keepTranscripts(jobHome, to) {
  const src = jobHome ? path.join(jobHome, ".claude", "projects") : null;
  if (!src || !fs.existsSync(src)) return null;
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(src, to, { recursive: true });
  return to;
}

async function attemptJob(job, claim, ctx, attemptNo, spentBefore) {
  const { model, effort, judgeModel, workRoot, keepRoot, framework } = ctx;
  const hideRoots = ctx.hide || [];
  const fw = job.arm === "framework" ? framework : null;
  const dir = prepare(job.task, workRoot);
  const cfg = taskConfig(job.task);
  const t = Date.now();
  let jobHome = null;
  const cleanup = () => { fs.rmSync(dir, { recursive: true, force: true }); if (jobHome) fs.rmSync(jobHome, { recursive: true, force: true }); };
  let wrap;
  try {
    assertCleanAncestors(dir);
    wrap = builderWrap(dir, { framework: fw, model, workRoot, hideRoots, exposeRoot: job.arm === "bounded", reviewRelay: Boolean(fw) && ctx.reviewRelay !== false && process.env.OE_NO_REVIEW_RELAY !== "1" });
    jobHome = wrap.job_home;
  } catch (e) { cleanup(); return { ...job, builder_sandbox: null, error: e.message }; }
  // Multi-step scenarios run each step as a fresh session in the same directory: only
  // what an earlier session left on disk carries over, as between real sessions.
  let agent = { cost_usd: 0, turns: 0, duration_ms: 0, steps: 0 };
  let usage = {};
  const outerIds = new Set();
  const replies = [];
  // Hash the prompts actually sent, not the files as they are when the row is written.
  const prompts = armPrompts(job.task, job.arm, { checkpointMode: fw?.checkpoint_mode });
  const sha = crypto.createHash("sha256").update(prompts.join("\n\0\n")).digest("hex").slice(0, 12);
  const lim = armLimits(job.arm);
  // The framework arm's cross-family review: the real codex, run by this runner outside the
  // sandbox, reached through the shim's socket. Its time is inside the job's wall clock and its
  // cost is added to the job (and counted by the spend watchdog below).
  let relay = null, relayNote = null;
  if (wrap.foreign_cli === "blocked-except-codex-relay") {
    try {
      relay = await startRelay({
        jobHome, buildDir: dir, maxCalls: ctx.reviewerMaxCalls, callTimeoutMs: ctx.reviewerCallTimeoutMs,
        deadlineAt: Date.now() + cfg.timeout_ms * lim.time * prompts.length,
        price: (id, u) => priceUsage(id || "unknown", u),
        confine: process.env.OE_RELAY_NO_CONFINE === "1" ? null : reviewerConfinement({ dir, jobHome, workRoot, hideRoots, framework: fw }),
      });
    } catch (e) { relayNote = e.message; }
  }
  try {
  for (const prompt of prompts) {
    // No --max-budget-usd: the CLI shows it to the model ("USD budget: $0.71"), and runs
    // quoted it as the reason to skip the framework's stages. The run cap and a per-job
    // ceiling of 3× the claim are enforced outside the model, by the spend watchdog.
    const watch = ctx.budget && claim?.usd != null ? { budget: ctx.budget, key: `${job.task}/${job.arm}#${job.rep}`, claimUsd: claim.usd, priorUsd: spentBefore + (agent.cost_usd || 0), knownSessionIds: outerIds, home: jobHome, intervalMs: ctx.budgetPollMs, extraUsd: relay ? () => relay.costUsd() : null } : null;
    const step = await runAgent(dir, prompt, model, cfg.timeout_ms * lim.time, isPillarArm(job.arm) ? cfg.tools : armTools(cfg.tools, job.arm), cfg.max_turns * lim.turns, effort, [], wrap, watch);
    replies.push(String(step.text || "").slice(-400));
    usage = mergeModelUsage(usage, step.model_usage);
    if (step.session_id) outerIds.add(step.session_id);
    // Whatever accounting the step reported counts, also when it was killed.
    const acct = { cost_usd: (agent.cost_usd || 0) + (step.cost_usd || 0), turns: (agent.turns || 0) + (step.turns || 0), duration_ms: (agent.duration_ms || 0) + (step.duration_ms || 0) };
    if (step.error) { agent = { ...agent, ...acct, error: `step ${agent.steps + 1}: ${step.error}`, stopped_by: step.stopped_by ?? agent.stopped_by ?? null }; break; }
    agent = { ...step, ...acct, steps: agent.steps + 1, stopped_by: agent.stopped_by ?? step.stopped_by ?? null };
  }
  } finally { if (relay) await relay.close(); }
  const rv = relay ? relay.summary() : null;
  delete agent.model_usage; delete agent.session_id;
  // Sessions the outer envelope does not cover (Bash-launched `claude -p`, a killed session):
  // read from the job home's transcripts, priced from the repo table, added to the cost.
  const nested = nestedUsage(jobHome, outerIds);
  usage = mergeModelUsage(usage, nested.model_usage);
  agent.outer_cost_usd = agent.cost_usd;
  agent.cost_usd = +((agent.cost_usd || 0) + nested.usd + (rv?.reviewer_cost_usd || 0)).toFixed(6);
  // The end of each step's final reply, so a run that wrote nothing still says why.
  const row = { ...job, ...(claim.usd != null ? { budget_usd: +claim.usd.toFixed(2) } : {}), builder_sandbox: wrap?.name ?? null, model, ...(effort ? { effort } : {}), task_sha256: taskSha256(job.task), pillar: cfg.pillar, prompt_sha: sha, started_at: new Date(t).toISOString(), wall_ms: Date.now() - t, ...agent, stopped_by: agent.stopped_by ?? null, model_usage: usage, nested_cost_usd: nested.usd, nested_sessions: nested.sessions, ...(nested.unpriced.length ? { nested_unpriced_models: nested.unpriced } : {}), foreign_cli: wrap.foreign_cli ?? null, ...(fw ? { reviewer_relay: relay ? "codex" : (relayNote ? `unavailable: ${relayNote}` : "off"), ...(rv || {}) } : {}), step_replies: replies };
  if (fw) {
    Object.assign(row, { framework_sha: fw.sha, checkpoint_mode: fw.checkpoint_mode, slot_pin: wrap.slot_pin, ...readFailOpen(dir, fw), ...countReceipts(dir), ...chainFacts(dir, fw, fw.src, jobHome) });
  }
  if (!row.builder_sandbox && !row.error) row.error = "no builder sandbox";
  const off = !row.error ? offModelWork(usage, model) : null;
  if (off) row.error = `off-model work: ${off}`;
  // A run that ended (even at its turn limit) is graded: hitting the limit is a failure to
  // count, not an error to hide. Only a crash, a timeout or off-model work is an error.
  if (!row.error) {
    const maxUsd = claim.usd != null ? Math.max(0.05, +(claim.usd - spentBefore - (agent.cost_usd || 0)).toFixed(2)) : null;
    const sandbox = { workRoot, hideRoots };
    try {
      Object.assign(row, await gradeAndCleanup(dir, job.task, {
        sandbox,
        componentsFn: () => gradeComponentsFor(dir, job.task, { sandbox }),
        judgeFn: judgeModel ? () => judgeInSandbox(dir, job.task, judgeModel, maxUsd, workRoot, hideRoots) : null,
      }));
    } catch (e) { Object.assign(row, e.partial || {}); row.error = `grading failed: ${e.message}`; }
  }
  delete row.text;
  // Keep what was built (minus dependencies) so a grader fix can re-score it for free.
  const keep = path.join(keepRoot, `${job.task}-${job.arm}-${job.rep}${attemptNo > 1 ? `-rerun` : ""}`);
  fs.rmSync(path.join(dir, "__hidden.test.mjs"), { force: true });
  fs.cpSync(dir, keep, { recursive: true, filter: (src) => !src.includes(`${path.sep}node_modules`) });
  row.artifact = keep;
  // Claude Code's session transcripts, kept beside (never inside) the build: graders and
  // regrade read the build dir.
  row.transcripts = keepTranscripts(jobHome, `${keep}.transcripts`);
  if (fw) {
    try {
      const spec = loadJourneySpec(job.task, ctx.journeysDir || JOURNEYS);
      if (spec) row.journey = checkJourney(spec, { transcriptsDir: row.transcripts, buildDir: keep });
    } catch (e) { row.journey = { error: e.message }; }
  }
  cleanup();
  return row;
}

// The judge reads the build in a sandbox of its own: a private empty home, no skills.
async function judgeInSandbox(dir, task, model, maxUsd, workRoot, hideRoots = []) {
  const w = builderWrap(dir, { model, workRoot, hideRoots });
  try { return await judge(dir, task, model, maxUsd, w); }
  finally { fs.rmSync(w.job_home, { recursive: true, force: true }); }
}

if (isMain(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c));

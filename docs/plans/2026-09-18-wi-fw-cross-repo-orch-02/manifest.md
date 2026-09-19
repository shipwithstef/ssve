# WI-FW-CROSS-REPO-ORCH-02 plan

**Status:** DRAFTED
**Spec:** `docs/specs/features/wi-fw-cross-repo-orch-02.md`
**Gap brief:** `docs/specs/bugfix/wi-fw-cross-repo-orch-02-gap-brief.md`
**WI:** `docs/specs/work-items/WI-FW-CROSS-REPO-ORCH-02.md`
**Branch:** `feature-wi-fw-cross-repo-orch-02`
**Base:** `origin/main` `483e26b322739e2ac7cf13149cf1a37653afdaef` (#66)
**Created At:** 2026-09-18T18:35:09Z
**Patched At:** 2026-09-18T20:10:00Z
**Lane:** framework
**Execution mode:** `dispatch`
**Archetype:** incremental extension of the #66 origin-orchestrate CLI
**Risk Flags:** `runtime_concurrency`, `external_state_writer`, `lossless_rmw`, `idempotent_rewriter`, `cross_runtime_integration`
**Fable round 1:** FAIL rubric 6, F-001/F-002/F-003 HIGH — this packet closes those and folds F-004..F-008
**PLAN_WT:** `/home/dianast/worktrees/ssve/feature-wi-fw-cross-repo-orch-01`

This WI is **any onboarded svc project**, not HoursHub-only. HoursHub is the
2026-09-18 regression example (AC-REG). Project ids are discovered from
`~/worktrees/<id>/` and `~/app-workspaces/<id>-worktrees/` plus optional
`~/.svc/project-aliases.json`.

Scout files already in this worktree are **candidates**. EXEC overwrites
CREATE paths from the blueprint hashes below. Do not rubber-stamp scout.
Do not treat local `./setup` as promotion. Do not land from this PLAN turn.

BEFORE hunks and `context_refs` are `origin/main` `483e26b`, not this dirty
orch-01 tree.

## Implementation Summary

Prompt-time origin bind: extract a WI or a discovered onboarded project id,
resolve an onboarded linked worktree, inject additional_context, migrate
same-owner when identity exists (idempotent under `mkdir_exclusive`), and the
origin dispatches PLAN grok-4.6 `--effort xhigh` → Fable → EXEC grok-4.6
`--effort high` with `--cwd` that worktree. The user never runs a command.
Isolation allows the installed skills-path `svc-orchestrate` from a foreign
cwd and still denies mixed-repo Writes. Default checkout stays refused. The
hook never spawns Grok. Project-only prompts do not mtime-pick a WI.

### Invariants

- User-facing text never matches USER_CLI_HOMEWORK_RE.
- Linked worktrees only (`.git` is a file or symlink).
- Foreign / ambiguous session identity is denied; no rewrite.
- #66 `validate-cross-repo-orch-01.mjs` still PASS.
- Cursor uses the adapter only; Claude/Grok/Kimi use the prompt hook; Kimi honors `SVC_DISABLED_HOOKS`.
- Catalog registers `svc-origin-orchestrator-prompt`.
- `origin_host` is a member of `ORIGIN_HOSTS`; non-grok is not collapsed to cursor.

## Files Planned

| Task | Action | Path |
|---|---|---|
| T1 | CREATE | scripts/lib/resolve-named-worktree.mjs |
| T1 | MODIFY | scripts/lib/cross-repo-orch.mjs |
| T1 | MODIFY | provision/hosts/grok.json |
| T2 | CREATE | hooks/svc-origin-orchestrator-prompt.mjs |
| T2 | MODIFY | hooks/cursor/svc-cursor-ssve-adapter.mjs |
| T3 | MODIFY | hooks/hooks.json |
| T3 | MODIFY | scripts/wire-hooks.mjs |
| T3 | MODIFY | scripts/wire-grok-hooks.mjs |
| T3 | MODIFY | scripts/wire-kimi-hooks.mjs |
| T3 | MODIFY | references/host-hook-catalog.json |
| T3 | MODIFY | hooks/hook-coverage-spec.md |
| T3 | MODIFY | docs/specs/test-evidence/WI-487/blocking-hook-inventory.json |
| T4 | MODIFY | hooks/svc-worktree-isolation-guard.mjs |
| T5 | CREATE | test-framework/evals/tier-1/validate-cross-repo-orch-02.mjs |
| T5 | CREATE | test-framework/evals/tier-1/fixtures/cross-repo-orch-02.json |
| T5 | MODIFY | scripts/select-tier1-validators-v2.mjs |
| T6 | MODIFY | docs/specs/work-items/INDEX.md |
| T6 | MODIFY | skills/route-workflow/SKILL.md |
| T6 | MODIFY | skills/route-workflow/references/prompt-composer.md |
| T6 | MODIFY | FRAMEWORK-STATE.md |
| T7 | CREATE | docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/manifest.md |
| T7 | CREATE | docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/plan-contract.json |
| T7 | CREATE | docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/eligibility.md |
| T7 | CREATE | docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/self-review.md |
| T7 | CREATE | docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/resolve-named-worktree.mjs |
| T7 | CREATE | docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/svc-origin-orchestrator-prompt.mjs |
| T7 | CREATE | docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/validate-cross-repo-orch-02.mjs |
| T7 | CREATE | docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/cross-repo-orch-02.json |
| T7 | CREATE | docs/specs/features/wi-fw-cross-repo-orch-02.md |
| T7 | CREATE | docs/specs/bugfix/wi-fw-cross-repo-orch-02-gap-brief.md |
| T7 | CREATE | docs/specs/work-items/WI-FW-CROSS-REPO-ORCH-02.md |

## Task Graph

| Task | Title | Files | Deps | AC | Validation | Checkpoint |
|---|---|---|---|---|---|---|
| T7 | Copy this plan packet + spec/WI/gap-brief into the exec worktree | plan dir + three spec files | none | n/a (plan artifacts) | sha256sum -c §3a; files exist | checkpoint-0-packet |
| T1 | Discovery resolver + idempotent migrate + PLAN/EXEC effort | resolve-named-worktree, cross-repo-orch, grok.json | T7 | AC-BIND-1, AC-BIND-2, AC-BIND-5, AC-BIND-1E, AC-BIND-2E, AC-BIND-3E, AC-DISPATCH-1, AC-DISPATCH-2, AC-HOT-1, AC-ZERO | validate-cross-repo-orch-02.mjs | checkpoint-1-resolver |
| T2 | Fail-open prompt hook + Cursor adapter | origin-orchestrator-prompt, cursor adapter | T1 | AC-BIND-3, AC-BIND-4, AC-BIND-6 | 02 validator hook empty-{} + no-spawn + USER_CLI_HOMEWORK_RE | checkpoint-2-hook |
| T3 | Catalog + Claude/Grok/Kimi wirers; Cursor not double-wired | hooks.json, three wirers, catalog, coverage spec, inventory | T2 | AC-CAT-1 | validate-catalog-generation.sh, grok toml roundtrip | checkpoint-3-wiring |
| T4 | Isolation allows installed skills-path orchestrate | isolation-guard | T1 | AC-ISO-1, AC-ISO-2, AC-ISO-3 | 02 validator skills-path + lookalike + Write deny; orch-01 | checkpoint-4-isolation |
| T5 | Hermetic 02 validator + selector registration | 02 validator, fixture, select-tier1 | T1,T3,T4 | AC-BIND-1..6, AC-BIND-1E/2E/3E, AC-DISPATCH-1/2, AC-ISO-1/2/3, AC-HOT-1, AC-ZERO, AC-REG | orch-01 and orch-02 PASS | checkpoint-5-tests |
| T6 | INDEX/route-workflow/FRAMEWORK-STATE | INDEX, route-workflow, prompt-composer, FRAMEWORK-STATE | T5 | AC-SETUP, AC-BIND-3 | USER_CLI_HOMEWORK_RE on origin section; AC-SETUP sentence in FRAMEWORK-STATE | checkpoint-6-docs |

## 3a. Changeset Blueprint (dispatch)

CREATE payloads are the exact files in `docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/` (sha256 below). EXEC copies those bytes; it does not keep scout.

| Dest | Source blueprint | sha256 |
|---|---|---|
| `scripts/lib/resolve-named-worktree.mjs` | `blueprints/resolve-named-worktree.mjs` | `78759bc2989a121518f7cf89f9e0efe3bc5b1d169214b902d918b0163177b4a7` |
| `hooks/svc-origin-orchestrator-prompt.mjs` | `blueprints/svc-origin-orchestrator-prompt.mjs` | `11e34c29b67d0d5873218ba5c57f48953060e0f7dc118f6c942244dfb3321b25` |
| `test-framework/evals/tier-1/validate-cross-repo-orch-02.mjs` | `blueprints/validate-cross-repo-orch-02.mjs` | `25cf2fde3133575222d55d27b46a0e41c6751366debe8faf38cc70f442e1ff34` |
| `test-framework/evals/tier-1/fixtures/cross-repo-orch-02.json` | `blueprints/cross-repo-orch-02.json` | `4389b4f7e933fea736e175e60e962c9c672be8e67e03ed706d6ebb91ec6afc1b` |

### T1 MODIFY `scripts/lib/cross-repo-orch.mjs`

Export `ORIGIN_HOSTS` and add `resolveOriginHost`. Replace `migrateSession` with the lock+skip implementation (F-001). Pin PLAN/EXEC argv. Surface `effort` / `svc_grok_effort` on the dispatch result and set `SVC_GROK_EFFORT` on spawn.

<<<<<<< BEFORE
const ORIGIN_HOSTS = new Set(["cursor", "grok", "codex", "claude", "kimi", "gemini", "opencode"]);
=======
export const ORIGIN_HOSTS = new Set(["cursor", "grok", "codex", "claude", "kimi", "gemini", "opencode"]);

export function resolveOriginHost(host, env = process.env) {
  const raw = String(host || env.SVC_HOST || "").toLowerCase();
  if (ORIGIN_HOSTS.has(raw)) return raw;
  fail(`unsupported origin host: ${raw || "(empty)"}`, "orch_host_invalid");
}
>>>>>>> AFTER

Insert the two helpers immediately above `export function migrateSession`, then replace the whole function. Skip path does **not** call `retireSameSessionBinding` or `writeTargetBinding`. Missing receipt reconstructs from the binding and still does not append.

<<<<<<< BEFORE
export function migrateSession(options = {}, env = process.env) {
  const originHost = String(options.origin_host || env.SVC_HOST || "cursor");
  if (!ORIGIN_HOSTS.has(originHost)) fail(`unsupported origin host: ${originHost}`, "orch_host_invalid");
  const sessionId = sessionIdFrom(env, options.session_id);
  if (!sessionId) fail("same-owner migrate requires a session-shaped id", "orch_session_missing");
  const target = resolveNamedWork(options);
  const originCwd = options.origin_cwd ? path.resolve(options.origin_cwd) : path.resolve(env.PWD || process.cwd());
  fs.mkdirSync(path.join(target.worktree, ".svc"), { recursive: true, mode: 0o700 });
  const retired = retireSameSessionBinding(originCwd, sessionId, target.worktree);
  const bindingPath = writeTargetBinding({
    worktree: target.worktree,
    repoRoot: target.repo_root,
    wi: target.wi,
    branch: target.branch,
    sessionId,
    originHost,
  });
  const contractPath = appendSessionContract(target.worktree, {
    wi: target.wi,
    sessionId,
    originHost,
    request: options.request,
  });
  const baton = {
    schema_version: 1,
    wi: target.wi,
    branch: target.branch,
    absolute_worktree: target.worktree,
    repo_root: target.repo_root,
    session_id: sessionId,
    origin_host: originHost,
    binding_path: bindingPath,
    contract_path: contractPath,
    retired_origin_binding: Boolean(retired.retired),
    paste_required: false,
    agy_required: false,
    next: "dispatch",
  };
  const receipt = path.join(target.worktree, ".svc", "orchestration", `${target.wi}.migrate.json`);
  atomicWriteJson(receipt, { ...baton, recorded_at: new Date().toISOString() });
  baton.receipt_path = receipt;
  return baton;
}
=======
function migrateLockDir(worktree, sessionId) {
  return path.join(worktree, ".svc", "orchestration", `.migrate-${sessionId}.lock`);
}

function withMigrateLock(worktree, sessionId, fn) {
  const lockDir = migrateLockDir(worktree, sessionId);
  fs.mkdirSync(path.dirname(lockDir), { recursive: true, mode: 0o700 });
  const deadline = Date.now() + 2000;
  for (;;) {
    try {
      fs.mkdirSync(lockDir, { mode: 0o700 });
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        if (Date.now() - fs.statSync(lockDir).mtimeMs > 15000) {
          fs.rmSync(lockDir, { recursive: true, force: true });
          continue;
        }
      } catch { /* race with holder */ }
      if (Date.now() >= deadline) fail("migrate lock busy", "orch_migrate_lock");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
  try { return fn(); }
  finally {
    try { fs.rmSync(lockDir, { recursive: true, force: true }); } catch { /* already gone */ }
  }
}

function existingMigrateBaton(target, sessionId, originHost) {
  const file = bindingFile(target.worktree, sessionId);
  const binding = readJson(file);
  if (!binding || binding.released_at) return null;
  if (String(binding.wi) !== target.wi) return null;
  if (path.resolve(String(binding.worktree_root || "")) !== target.worktree) return null;
  const receiptPath = path.join(target.worktree, ".svc", "orchestration", `${target.wi}.migrate.json`);
  const receipt = readJson(receiptPath);
  if (receipt && String(receipt.session_id) === sessionId && String(receipt.wi) === target.wi) {
    return { ...receipt, skipped_contract_append: true, receipt_path: receiptPath };
  }
  const baton = {
    schema_version: 1,
    wi: target.wi,
    branch: target.branch || binding.branch || "",
    absolute_worktree: target.worktree,
    repo_root: target.repo_root,
    session_id: sessionId,
    origin_host: originHost,
    binding_path: file,
    contract_path: path.join(target.worktree, ".svc", "session-contract.jsonl"),
    retired_origin_binding: false,
    paste_required: false,
    agy_required: false,
    next: "dispatch",
    skipped_contract_append: true,
  };
  atomicWriteJson(receiptPath, { ...baton, recorded_at: new Date().toISOString() });
  baton.receipt_path = receiptPath;
  return baton;
}

export function migrateSession(options = {}, env = process.env) {
  const originHost = String(options.origin_host || env.SVC_HOST || "cursor");
  if (!ORIGIN_HOSTS.has(originHost)) fail(`unsupported origin host: ${originHost}`, "orch_host_invalid");
  const sessionId = sessionIdFrom(env, options.session_id);
  if (!sessionId) fail("same-owner migrate requires a session-shaped id", "orch_session_missing");
  const target = resolveNamedWork(options);
  const originCwd = options.origin_cwd ? path.resolve(options.origin_cwd) : path.resolve(env.PWD || process.cwd());
  fs.mkdirSync(path.join(target.worktree, ".svc"), { recursive: true, mode: 0o700 });
  return withMigrateLock(target.worktree, sessionId, () => {
    const skipped = existingMigrateBaton(target, sessionId, originHost);
    if (skipped) return skipped;
    const retired = retireSameSessionBinding(originCwd, sessionId, target.worktree);
    const bindingPath = writeTargetBinding({
      worktree: target.worktree,
      repoRoot: target.repo_root,
      wi: target.wi,
      branch: target.branch,
      sessionId,
      originHost,
    });
    const contractPath = appendSessionContract(target.worktree, {
      wi: target.wi,
      sessionId,
      originHost,
      request: options.request,
    });
    const baton = {
      schema_version: 1,
      wi: target.wi,
      branch: target.branch,
      absolute_worktree: target.worktree,
      repo_root: target.repo_root,
      session_id: sessionId,
      origin_host: originHost,
      binding_path: bindingPath,
      contract_path: contractPath,
      retired_origin_binding: Boolean(retired.retired),
      paste_required: false,
      agy_required: false,
      next: "dispatch",
      skipped_contract_append: false,
    };
    const receipt = path.join(target.worktree, ".svc", "orchestration", `${target.wi}.migrate.json`);
    atomicWriteJson(receipt, { ...baton, recorded_at: new Date().toISOString() });
    baton.receipt_path = receipt;
    return baton;
  });
}
>>>>>>> AFTER

CLI `migrateSession` still defaults missing `origin_host` to `cursor` (#66). `bindIfNeeded` must call `resolveOriginHost(host)` and never pass a collapsed cursor default.

PLAN/EXEC argv pins (committed #66 has no `--effort`):

<<<<<<< BEFORE
    argv = [
      "grok",
      "--cwd", target.worktree,
      "--permission-mode", "auto",
=======
    argv = [
      "grok",
      "--cwd", target.worktree,
      "--model", "grok-4.6",
      "--effort", role === "PLAN" ? "xhigh" : "high",
      "--permission-mode", "auto",
>>>>>>> AFTER

<<<<<<< BEFORE
  const result = {
    schema_version: 1,
    role,
    host,
    wi: target.wi,
    worktree: target.worktree,
    argv,
    prompt_file: promptFile,
    paste_required: false,
    agy_required: false,
    dry_run: Boolean(options.dry_run),
  };
  if (!options.dry_run && role !== "REVIEW" && options.spawn === true) {
    const child = spawn(argv[0], argv.slice(1), {
      detached: true,
      stdio: "ignore",
      cwd: target.worktree,
      env: { ...env, SVC_WI: target.wi, SVC_LAUNCH_CWD: target.worktree, SVC_PROMPT_FILE: promptFile },
    });
=======
  const effort = role === "REVIEW" ? null : (role === "PLAN" ? "xhigh" : "high");
  const result = {
    schema_version: 1,
    role,
    host,
    wi: target.wi,
    worktree: target.worktree,
    argv,
    prompt_file: promptFile,
    paste_required: false,
    agy_required: false,
    dry_run: Boolean(options.dry_run),
    effort,
    svc_grok_effort: effort,
  };
  if (!options.dry_run && role !== "REVIEW" && options.spawn === true) {
    const child = spawn(argv[0], argv.slice(1), {
      detached: true,
      stdio: "ignore",
      cwd: target.worktree,
      env: { ...env, SVC_WI: target.wi, SVC_LAUNCH_CWD: target.worktree, SVC_PROMPT_FILE: promptFile, SVC_GROK_EFFORT: effort },
    });
>>>>>>> AFTER

### T1 MODIFY `provision/hosts/grok.json`

<<<<<<< BEFORE
      "launch_command": "grok --cwd \"${SVC_LAUNCH_CWD:-$PWD}\" --permission-mode auto --output-format json --max-turns \"${SVC_GROK_MAX_TURNS:-80}\" --prompt-file \"${SVC_PROMPT_FILE}\"",
=======
      "launch_command": "grok --cwd \"${SVC_LAUNCH_CWD:-$PWD}\" --model grok-4.6 --effort \"${SVC_GROK_EFFORT:-high}\" --permission-mode auto --output-format json --max-turns \"${SVC_GROK_MAX_TURNS:-80}\" --prompt-file \"${SVC_PROMPT_FILE}\"",
>>>>>>> AFTER

Dispatch argv remains the authority for PLAN xhigh vs EXEC high. Template default `high` must not override PLAN; dispatch sets `SVC_GROK_EFFORT`.

### T2 MODIFY `hooks/cursor/svc-cursor-ssve-adapter.mjs`

Apply against **origin/main**. The orch-01 scout block that calls `migrateSession` directly (working-tree lines ~202-220) is **replaced**, not merged. Cursor `additional_context` is the documented adapter contract (`hooks/lib/hook-decision.mjs` lines 88-93). Never `continue: false` for bind misses. Do not print CLI homework. Do not duplicate Claude UserPromptSubmit on Cursor.

<<<<<<< BEFORE
import { isShellTool } from "../lib/shell-tools.mjs";
=======
import { isShellTool } from "../lib/shell-tools.mjs";
import { resolveOriginIntent, bindIfNeeded, originOrchestratorContext } from "../../scripts/lib/resolve-named-worktree.mjs";
>>>>>>> AFTER

<<<<<<< BEFORE
    process.stdout.write(JSON.stringify({ continue: true, ...(overrideMessage ? { user_message: overrideMessage } : {}) }) + "\n");
    process.exit(0);
=======
    let orchContext = null;
    try {
      const intent = resolveOriginIntent(text, ctx.cwd || process.cwd());
      if (intent) {
        const result = bindIfNeeded(intent, { host: "cursor", cwd: ctx.cwd || process.cwd(), sessionId: ctx.session_id, request: text });
        orchContext = originOrchestratorContext(intent, { host: "cursor", bound: Boolean(result?.bound) });
        if (result?.reason === "orch_foreign" || result?.reason === "orch_default_checkout" || result?.reason === "orch_session_missing") {
          orchContext = "ORIGIN ORCHESTRATOR: bind refused (" + result.reason + "). Stay put. Do not tell the user to run a command.";
        }
      }
    } catch {}
    process.stdout.write(JSON.stringify({
      continue: true,
      ...(overrideMessage ? { user_message: overrideMessage } : {}),
      ...(orchContext ? { additional_context: orchContext } : {}),
    }) + "\n");
    process.exit(0);
>>>>>>> AFTER

### T3 wirers + catalog

Register `svc-origin-orchestrator-prompt` in `references/host-hook-catalog.json` for claude, kimi, grok on UserPromptSubmit and SessionStart (SessionStart no-ops without prompt text). Cursor host list must **omit** this id so `wire-cursor-hooks.mjs` does not add a second command beside the adapter.

`scripts/wire-hooks.mjs` and `scripts/wire-grok-hooks.mjs`: emit the hook behind `DISABLED`. `scripts/wire-kimi-hooks.mjs`: same DISABLED guard (scout omitted it). Wirers set `SVC_HOST` in the hook command env (`claude` / `grok` / `kimi`); the hook must not default host to `cursor`.

`hooks/hooks.json`: add the hook to UserPromptSubmit and SessionStart as warn/fail-open.

`hooks/hook-coverage-spec.md`: UserPromptSubmit/SessionStart remain warn; document the origin-orchestrator advisory.

Inventory row: `context-injection-no-block:UserPromptSubmit/SessionStart advisory; never blocks`.

### T4 isolation

Insert the two helpers **immediately above** `export function classifyMutation` (module scope, not inside the function). Then replace only the origin-orchestrate short-circuit so it threads `env`. `SVC_SKILLS_HOME` makes AC-ISO-1 hermetic. `os` is already imported.

<<<<<<< BEFORE
export function classifyMutation(call, env = process.env, now = Date.now()) {
=======
function skillsHome(env = process.env) {
  return env.SVC_SKILLS_HOME || env.HOME || os.homedir();
}

function originOrchestrateReals(env = process.env) {
  const home = skillsHome(env);
  const candidates = [
    path.join(ROOT, "scripts", "svc-orchestrate.mjs"),
    path.join(home, ".cursor", "skills", "scripts", "svc-orchestrate.mjs"),
    path.join(home, ".grok", "skills", "scripts", "svc-orchestrate.mjs"),
    path.join(home, ".claude", "skills", "scripts", "svc-orchestrate.mjs"),
  ];
  const out = [];
  for (const candidate of candidates) {
    try { out.push(fs.realpathSync(candidate)); } catch { /* absent install */ }
  }
  return out;
}

export function classifyMutation(call, env = process.env, now = Date.now()) {
>>>>>>> AFTER

<<<<<<< BEFORE
      const expected = path.resolve(ROOT, "scripts", "svc-orchestrate.mjs");
      let got = null;
      try { got = fs.realpathSync(path.resolve(normalized.cwd, orchestrate.script)); } catch { got = null; }
      let expectedReal = expected;
      try { expectedReal = fs.realpathSync(expected); } catch {}
      if (got && got === expectedReal) {
        return { classification: "origin-orchestrate", allow: true, orchestrate, ...(cwdGit || {}) };
      }
=======
      let got = null;
      try { got = fs.realpathSync(path.resolve(normalized.cwd, orchestrate.script)); } catch { got = null; }
      if (got && originOrchestrateReals(env).includes(got)) {
        return { classification: "origin-orchestrate", allow: true, orchestrate, ...(cwdGit || {}) };
      }
>>>>>>> AFTER

Lookalike `cwd/scripts/svc-orchestrate.mjs` still fails. Write to another repo still denies. `os` is already imported in this file.

### T5 selector

Add a `CONTRACTS` entry for `validate-cross-repo-orch-02.mjs` with inputs: resolver, hook, orch lib, isolation guard, adapter, 02 validator, 02 fixture.

### T6 route-workflow

Replace the Cursor origin block so the **user does not run a command**. Agent-internal migrate/dispatch may use the installed skills path (`~/.cursor/skills/scripts/svc-orchestrate.mjs` or `~/.grok/skills/scripts/svc-orchestrate.mjs`). Do not leave `please run node` / `copy-paste migrate` / shell-prompt homework in the origin section. FRAMEWORK-STATE: auto-bind for any onboarded project; land is the PR; local `./setup` is not promotion.

Spec/WI/gap-brief are **not** T6 CREATEs. They are T7 copies of the reviewed plan inputs (already BASELINED / planned). T6 only MODIFIES INDEX, route-workflow, prompt-composer, FRAMEWORK-STATE.

## AC-to-Task

| AC | Task |
|---|---|
| AC-BIND-1 | T1, T5 |
| AC-BIND-2 | T1, T5 |
| AC-BIND-3 | T2, T6 |
| AC-BIND-4 | T2, T5 |
| AC-BIND-5 | T1, T5 |
| AC-BIND-6 | T2, T5 |
| AC-BIND-1E | T1, T5 |
| AC-BIND-2E | T1, T5 |
| AC-BIND-3E | T1, T2, T5 |
| AC-DISPATCH-1 | T1, T5 |
| AC-DISPATCH-2 | T1, T5 |
| AC-DISPATCH-3 | T1 (unchanged REVIEW argv) |
| AC-ISO-1 | T4, T5 |
| AC-ISO-2 | T4, T5 |
| AC-ISO-3 | T4, T5 |
| AC-HOT-1 | T1, T5 |
| AC-CAT-1 | T3 |
| AC-ZERO | T1, T2, T5 |
| AC-SETUP | T6 |
| AC-REG | T5 |

## AC-to-Test

Every row cites a check that exists in the named validator. Ghost tests are forbidden.

| AC | Test |
|---|---|
| AC-BIND-1 | Unit: `validate-cross-repo-orch-02.mjs` check `AC-BIND-1 WI file resolution and cwd wins` |
| AC-BIND-2 | Unit: same file, `AC-BIND-2 any onboarded project id` plus `AC-BIND-2 project-only does not mtime-migrate` |
| AC-BIND-3 | Unit: `AC-BIND-3 context has no user CLI homework` against USER_CLI_HOMEWORK_RE |
| AC-BIND-4 | Unit: `AC-BIND-4 hook exit 0 empty {} on no match` via execFileSync of the hook |
| AC-BIND-5 | Unit: sequential skip, missing-receipt reconstruct, concurrent one contract line |
| AC-BIND-6 | Unit: context names PLAN xhigh then EXEC high; `AC-BIND-6 hook source has no spawn` |
| AC-BIND-1E | Unit: `AC-BIND-1E foreign session denied` (`orch_foreign`) |
| AC-BIND-2E | Unit: `AC-BIND-2E default checkout migrate throws orch_default_checkout` |
| AC-BIND-3E | Unit: `AC-BIND-3E unknown WI is no_target; unknown token is not a project` |
| AC-DISPATCH-1 | Unit: PLAN argv `--effort xhigh` `--model grok-4.6` and `result.effort === "xhigh"` |
| AC-DISPATCH-2 | Unit: EXEC argv `--effort high` and `result.effort === "high"` |
| AC-DISPATCH-3 | Unit: orch-01 REVIEW launcher assertions |
| AC-ISO-1 | Unit: `AC-ISO-1 installed skills-path orchestrate from foreign cwd` under SVC_SKILLS_HOME (not ROOT/scripts) |
| AC-ISO-2 | Unit: `AC-ISO-2 mixed-repo Write still denied` |
| AC-ISO-3 | Unit: `AC-ISO-3 lookalike cwd script is not origin-orchestrate` plus orch-01 lookalike deny |
| AC-HOT-1 | Unit: regex-first discoverCallCount===0; no `-worktrees` decoy; timeout fail-open |
| AC-CAT-1 | Unit: `validate-catalog-generation.sh`; 02 smoke `catalog registers the prompt hook` |
| AC-ZERO | Unit: `AC-ZERO subject-only project id binds worktree or no_target` |
| AC-SETUP | Manual/source: FRAMEWORK-STATE sentence |
| AC-REG | Unit: `validate-cross-repo-orch-01.mjs` |

## 6a. Prerequisite Alignment Matrix

| Input | Disposition |
|---|---|
| UX/UI | N/A — no product UI; owner constraint is AC-BIND-3 |
| Tech | Spec Technical Design (BASELINED) — discovery, fail-open hook, origin dispatches, lock+skip migrate |
| Style | Existing ESM hooks/scripts, atomic JSON writes, mkdir_exclusive |
| Personas | N/A — system-only enabler; owner is the operator |
| #66 CLI | Preserved migrate/dispatch/REVIEW; this WI adds bind + effort + skills-path isolation |

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| 1 | host hook config | Claude/Grok/Kimi/Cursor hook entries | coupled | wirers in git; WI-542 immutable vs rolling backups |
| 2 | session binding | `.svc/bindings/<session>.json` in the **target** linked worktree | coupled | atomic_rename; gitignored `.svc` |
| 3 | session-contract | JSONL append in target `.svc` | coupled | skipped on same-tuple retry under mkdir_exclusive |
| 4 | Grok launch_command | effort/model template | coupled | `provision/hosts/grok.json` in git |

Untouched environments: 5–15 of the taxonomy (no cloud, no secrets, no CI, no app DB). Local `./setup` is install-preview after merge, not this changeset's land.

## Validation Plan

```bash
node test-framework/evals/tier-1/validate-cross-repo-orch-02.mjs
node test-framework/evals/tier-1/validate-cross-repo-orch-01.mjs
bash test-framework/evals/tier-1/validate-catalog-generation.sh
bash test-framework/evals/tier-1/validate-grok-hook-toml-roundtrip.sh
node scripts/validate-plan-contract.mjs docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/plan-contract.json
```

## 7a. Execution Command Sequence

Packet copy is mandatory. The reviewed files live only in PLAN_WT until this step.

```bash
PLAN_WT=/home/dianast/worktrees/ssve/feature-wi-fw-cross-repo-orch-01
git fetch origin
# 1. Fresh linked worktree from origin/main 483e26b (not this dirty orch-01 tree as the land target)
bash scripts/worktree.sh create feature-wi-fw-cross-repo-orch-02 --from origin/main --wi WI-FW-CROSS-REPO-ORCH-02
NEW=$(git worktree list --porcelain | awk '/^worktree /{w=$2} /^branch refs\/heads\/feature-wi-fw-cross-repo-orch-02$/{print w; exit}')
test -n "$NEW"
# 2. Move the untracked plan packet + spec/WI/gap-brief into the exec worktree
mkdir -p "$NEW/docs/plans" "$NEW/docs/specs/features" "$NEW/docs/specs/bugfix" "$NEW/docs/specs/work-items"
cp -R "$PLAN_WT/docs/plans/2026-09-18-wi-fw-cross-repo-orch-02" "$NEW/docs/plans/"
cp "$PLAN_WT/docs/specs/features/wi-fw-cross-repo-orch-02.md" "$NEW/docs/specs/features/"
cp "$PLAN_WT/docs/specs/work-items/WI-FW-CROSS-REPO-ORCH-02.md" "$NEW/docs/specs/work-items/"
cp "$PLAN_WT/docs/specs/bugfix/wi-fw-cross-repo-orch-02-gap-brief.md" "$NEW/docs/specs/bugfix/"
# 3. Prove blueprint bytes before CREATE copies
cd "$NEW"
sha256sum -c <<'EOF'
78759bc2989a121518f7cf89f9e0efe3bc5b1d169214b902d918b0163177b4a7  docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/resolve-named-worktree.mjs
11e34c29b67d0d5873218ba5c57f48953060e0f7dc118f6c942244dfb3321b25  docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/svc-origin-orchestrator-prompt.mjs
25cf2fde3133575222d55d27b46a0e41c6751366debe8faf38cc70f442e1ff34  docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/validate-cross-repo-orch-02.mjs
4389b4f7e933fea736e175e60e962c9c672be8e67e03ed706d6ebb91ec6afc1b  docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/cross-repo-orch-02.json
EOF
# 4. Copy CREATE dests from those blueprints (sha256 must still match)
cp docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/resolve-named-worktree.mjs scripts/lib/resolve-named-worktree.mjs
cp docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/svc-origin-orchestrator-prompt.mjs hooks/svc-origin-orchestrator-prompt.mjs
mkdir -p test-framework/evals/tier-1/fixtures
cp docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/validate-cross-repo-orch-02.mjs test-framework/evals/tier-1/validate-cross-repo-orch-02.mjs
cp docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/cross-repo-orch-02.json test-framework/evals/tier-1/fixtures/cross-repo-orch-02.json
# 5. Apply MODIFY hunks in T1-T6 order against origin/main BEFORE text (not orch-01 scout)
# 6. Tests
node test-framework/evals/tier-1/validate-cross-repo-orch-02.mjs
node test-framework/evals/tier-1/validate-cross-repo-orch-01.mjs
bash test-framework/evals/tier-1/validate-catalog-generation.sh
# 7. Do not ./setup --all-hosts as promotion. Land is the PR after Fable review-exec.
```

RECOVERY_IF_FAIL: revert the feature branch; host config restore uses `~/.grok/config.toml.svc-wire.rollback` without touching `pre-migration.bak`. Packet remains in PLAN_WT if the new branch is dropped.

## Checkpoint Plan

0. checkpoint-0-packet — packet + spec/WI/gap-brief in the exec worktree; blueprint sha256 match
1. checkpoint-1-resolver — 02 validator discovery + effort + idempotent migrate
2. checkpoint-2-hook — fail-open inject
3. checkpoint-3-wiring — catalog + DISABLED
4. checkpoint-4-isolation — skills-path allow + Write deny
5. checkpoint-5-tests — orch-01 still green
6. checkpoint-6-docs — no user CLI homework; AC-SETUP

Rollback anchors: `origin/main` `483e26b`.

## Promotion Readiness Checklist

- [ ] All planned files in the table
- [ ] Every AC mapped to a task and a test that exists in the named validator
- [ ] orch-01 still PASS
- [ ] orch-02 PASS including non-HoursHub `acme` and skills-path ISO-1
- [ ] Catalog generation PASS
- [ ] FRAMEWORK-STATE says setup is not promotion
- [ ] No ORM/schema files (no migration task needed)
- [ ] Fable review-plan PASS before EXEC
- [ ] Local `./setup` is not land

## Simulation Report

Walked against **disk now** (this worktree) and **planned** (CREATE from origin/main).

| Check | Result | Notes |
|---|---|---|
| T1 CREATE resolver vs origin/main | PASS | absent on `483e26b` |
| T2 CREATE hook vs origin/main | PASS | absent on `483e26b` |
| T5 CREATE validator/fixture vs origin/main | PASS | absent |
| T1 MODIFY orch lib exists | PASS | on origin/main; BEFORE is 483e26b not dirty tree |
| T4 isolation exists | PASS | on origin/main |
| Untracked scout occupies CREATE paths | WARN | EXEC overwrites from blueprint sha256 after packet copy |
| Isolation ROOT-only vs skills-path | PASS (planned T4) | ISO-1 test uses SVC_SKILLS_HOME, not ROOT script |
| Hardcoded HoursHub/SSVE scout catalog | FAIL if shipped | blueprint discoverProjects replaces it |
| migrate append every prompt | FAIL if shipped | T1 lock+skip |
| project-only mtime WI | FAIL if shipped | unique in_progress or named WI |
| `./setup` as land | N/A | AC-SETUP forbids |

No unresolved FAIL that blocks review-plan: WARN on untracked scout is acknowledged.

## Decision trace

| Question | Alternatives | Chosen | Rationale |
|---|---|---|---|
| Who spawns PLAN | hook spawn vs origin dispatch | origin dispatch | hook spawn on every project-id mention forks paid Grok |
| Project catalog | hardcoded hourshub/ssve vs directory discovery | discovery of any onboarded id | owner: any onboarded svc project |
| Scan all app-workspaces | yes vs named `*-worktrees` + `~/worktrees/<id>` | named roots | p95 + false positives |
| Cursor bind site | extra SessionStart vs adapter only | adapter only | one bind site |
| Effort | template-only vs argv pin | argv pin PLAN xhigh EXEC high | owner lock |
| Project-only WI | newest lane-tasks mtime vs inject candidates | inject candidates; migrate only on named WI or unique in_progress | mtime is not an owner choice and is perturbed by RMW |
| Origin host default | collapse non-grok to cursor vs ORIGIN_HOSTS pass-through | pass-through via resolveOriginHost; hook uses SVC_HOST from wirer | Claude/Kimi origin must not record cursor |
| migrate concurrency | comment skip vs mkdir_exclusive + receipt load | lock then skip/reconstruct | F-001; SessionStart+UserPromptSubmit race |

## External State

See table above. Wirers reuse WI-542 distinct immutable baseline vs rolling rollback.

<!-- SVC_PLAN_BODY -->
```json
{
  "receipt_type": "plan-manifest",
  "schema_version": 5,
  "wi": "WI-FW-CROSS-REPO-ORCH-02",
  "mode": "dispatch",
  "lane": "framework",
  "timestamp": "2026-09-18T20:10:00Z",
  "scope": {
    "included": [
      "scripts/lib/resolve-named-worktree.mjs",
      "scripts/lib/cross-repo-orch.mjs",
      "provision/hosts/grok.json",
      "hooks/svc-origin-orchestrator-prompt.mjs",
      "hooks/cursor/svc-cursor-ssve-adapter.mjs",
      "hooks/hooks.json",
      "scripts/wire-hooks.mjs",
      "scripts/wire-grok-hooks.mjs",
      "scripts/wire-kimi-hooks.mjs",
      "references/host-hook-catalog.json",
      "hooks/hook-coverage-spec.md",
      "docs/specs/test-evidence/WI-487/blocking-hook-inventory.json",
      "hooks/svc-worktree-isolation-guard.mjs",
      "test-framework/evals/tier-1/validate-cross-repo-orch-02.mjs",
      "test-framework/evals/tier-1/fixtures/cross-repo-orch-02.json",
      "scripts/select-tier1-validators-v2.mjs",
      "docs/specs/features/wi-fw-cross-repo-orch-02.md",
      "docs/specs/bugfix/wi-fw-cross-repo-orch-02-gap-brief.md",
      "docs/specs/work-items/WI-FW-CROSS-REPO-ORCH-02.md",
      "docs/specs/work-items/INDEX.md",
      "skills/route-workflow/SKILL.md",
      "skills/route-workflow/references/prompt-composer.md",
      "FRAMEWORK-STATE.md",
      "docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/manifest.md",
      "docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/plan-contract.json",
      "docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/eligibility.md",
      "docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/self-review.md",
      "docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/resolve-named-worktree.mjs",
      "docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/svc-origin-orchestrator-prompt.mjs",
      "docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/validate-cross-repo-orch-02.mjs",
      "docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/cross-repo-orch-02.json"
    ],
    "excluded": [
      "hooks/svc-worktree-isolation-guard.mjs mixed-repo Write deny (unchanged behavior)",
      "Cursor fresh_session_launch",
      "hook spawn of grok",
      "local ./setup as promotion",
      "lane-tasks mtime as project-only WI selector"
    ]
  },
  "dependencies": [
    {
      "artifact": "docs/specs/features/wi-fw-cross-repo-orch-02.md",
      "citation": "docs/specs/features/wi-fw-cross-repo-orch-02.md:1"
    },
    {
      "artifact": "scripts/lib/cross-repo-orch.mjs",
      "citation": "scripts/lib/cross-repo-orch.mjs:169"
    },
    {
      "artifact": "hooks/lib/hook-decision.mjs",
      "citation": "hooks/lib/hook-decision.mjs:88"
    }
  ],
  "decision_trace": [
    {
      "question": "Who spawns PLAN/EXEC?",
      "alternatives": ["hook spawn(grok)", "origin agent dispatch"],
      "chosen": "origin agent dispatch",
      "rationale": "Hook spawn on every project-id mention forks paid Grok children."
    },
    {
      "question": "How are project ids defined?",
      "alternatives": ["hardcoded hourshub/ssve", "discover onboarded ids under canonical worktree roots"],
      "chosen": "discover onboarded ids under canonical worktree roots",
      "rationale": "Owner: any onboarded svc project, not HoursHub-only."
    },
    {
      "question": "PLAN/EXEC effort",
      "alternatives": ["template default high for both", "PLAN xhigh and EXEC high in dispatch argv"],
      "chosen": "PLAN xhigh and EXEC high in dispatch argv",
      "rationale": "Owner lock."
    },
    {
      "question": "Project-only WI selection?",
      "alternatives": ["newest lane-tasks mtime", "inject candidates; migrate only on named WI or unique in_progress"],
      "chosen": "inject candidates; migrate only on named WI or unique in_progress",
      "rationale": "mtime is not an owner choice and is perturbed by any RMW of lane-tasks."
    },
    {
      "question": "origin_host for Claude/Kimi?",
      "alternatives": ["collapse non-grok to cursor", "pass through ORIGIN_HOSTS via resolveOriginHost"],
      "chosen": "pass through ORIGIN_HOSTS via resolveOriginHost",
      "rationale": "Claude/Kimi origin must not record origin_host cursor."
    }
  ],
  "task_graph": [
    {
      "id": "T7",
      "files": [
        "docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/manifest.md",
        "docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/plan-contract.json",
        "docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/eligibility.md",
        "docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/self-review.md",
        "docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/resolve-named-worktree.mjs",
        "docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/svc-origin-orchestrator-prompt.mjs",
        "docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/validate-cross-repo-orch-02.mjs",
        "docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/cross-repo-orch-02.json",
        "docs/specs/features/wi-fw-cross-repo-orch-02.md",
        "docs/specs/bugfix/wi-fw-cross-repo-orch-02-gap-brief.md",
        "docs/specs/work-items/WI-FW-CROSS-REPO-ORCH-02.md"
      ],
      "blocked_by": [],
      "ac_ids": [],
      "validation_ids": [],
      "context_refs": []
    },
    {
      "id": "T1",
      "files": [
        "scripts/lib/resolve-named-worktree.mjs",
        "scripts/lib/cross-repo-orch.mjs",
        "provision/hosts/grok.json"
      ],
      "blocked_by": ["T7"],
      "ac_ids": ["AC-BIND-1", "AC-BIND-2", "AC-BIND-5", "AC-BIND-1E", "AC-BIND-2E", "AC-BIND-3E", "AC-DISPATCH-1", "AC-DISPATCH-2", "AC-HOT-1", "AC-ZERO"],
      "validation_ids": ["V-ORCH-02"],
      "context_refs": [
        {
          "path": "scripts/lib/cross-repo-orch.mjs",
          "start_line": 169,
          "end_line": 211,
          "excerpt_sha256": "4108aa9b571bc61776353dde1120e1d1f487e30ee768755e295456d67a4c1067"
        },
        {
          "path": "scripts/lib/cross-repo-orch.mjs",
          "start_line": 258,
          "end_line": 291,
          "excerpt_sha256": "8bfdc7bcd7a1eaba3ec81c59e4d5a0a7af35f312c7247d6d052af144e03efcd6"
        }
      ]
    },
    {
      "id": "T2",
      "files": [
        "hooks/svc-origin-orchestrator-prompt.mjs",
        "hooks/cursor/svc-cursor-ssve-adapter.mjs"
      ],
      "blocked_by": ["T1"],
      "ac_ids": ["AC-BIND-3", "AC-BIND-4", "AC-BIND-6"],
      "validation_ids": ["V-ORCH-02"],
      "context_refs": [
        {
          "path": "hooks/cursor/svc-cursor-ssve-adapter.mjs",
          "start_line": 197,
          "end_line": 206,
          "excerpt_sha256": "1c7806ac60b58a96039e15e2428da265943929e5ad35b4e0c6cf61fabaa212c2"
        },
        {
          "path": "hooks/lib/hook-decision.mjs",
          "start_line": 88,
          "end_line": 93,
          "excerpt_sha256": "62a8eccc926fbe0304f042888f1efe8d719d276cabb92c212fda7a8517587d60"
        }
      ]
    },
    {
      "id": "T3",
      "files": [
        "hooks/hooks.json",
        "scripts/wire-hooks.mjs",
        "scripts/wire-grok-hooks.mjs",
        "scripts/wire-kimi-hooks.mjs",
        "references/host-hook-catalog.json",
        "hooks/hook-coverage-spec.md",
        "docs/specs/test-evidence/WI-487/blocking-hook-inventory.json"
      ],
      "blocked_by": ["T2"],
      "ac_ids": ["AC-CAT-1"],
      "validation_ids": ["V-CATALOG", "V-GROK-TOML"],
      "context_refs": [
        {
          "path": "provision/hosts/grok.json",
          "start_line": 25,
          "end_line": 31,
          "excerpt_sha256": "7cc3997914b66b3bfc65a3d0c58a6b518f7e5c68a1c2f8a0e7ceb96a5ebe7b13"
        }
      ]
    },
    {
      "id": "T4",
      "files": ["hooks/svc-worktree-isolation-guard.mjs"],
      "blocked_by": ["T1"],
      "ac_ids": ["AC-ISO-1", "AC-ISO-2", "AC-ISO-3"],
      "validation_ids": ["V-ORCH-02", "V-ORCH-01"],
      "context_refs": [
        {
          "path": "hooks/svc-worktree-isolation-guard.mjs",
          "start_line": 216,
          "end_line": 216,
          "excerpt_sha256": "78e4b9ef147d5bc54b799e2b39153a9712844efea18104e7d01a0c5d9f11a1f1"
        },
        {
          "path": "hooks/svc-worktree-isolation-guard.mjs",
          "start_line": 230,
          "end_line": 245,
          "excerpt_sha256": "9719e471bf66762757f98bbc731e32c4c0be4ca2c410b1079bb632dc324273c0"
        }
      ]
    },
    {
      "id": "T5",
      "files": [
        "test-framework/evals/tier-1/validate-cross-repo-orch-02.mjs",
        "test-framework/evals/tier-1/fixtures/cross-repo-orch-02.json",
        "scripts/select-tier1-validators-v2.mjs"
      ],
      "blocked_by": ["T1", "T3", "T4"],
      "ac_ids": ["AC-REG", "AC-BIND-1", "AC-BIND-2", "AC-BIND-3", "AC-BIND-4", "AC-BIND-5", "AC-BIND-6", "AC-BIND-1E", "AC-BIND-2E", "AC-BIND-3E", "AC-DISPATCH-1", "AC-DISPATCH-2", "AC-ISO-1", "AC-ISO-2", "AC-ISO-3", "AC-HOT-1", "AC-ZERO"],
      "validation_ids": ["V-ORCH-01", "V-ORCH-02"],
      "context_refs": [
        {
          "path": "hooks/lib/orchestrate-command.mjs",
          "start_line": 9,
          "end_line": 12,
          "excerpt_sha256": "3c08ff5a92b6565a238bec690bb36cf08ce375e3f38479e86e311233881983ec"
        }
      ]
    },
    {
      "id": "T6",
      "files": [
        "docs/specs/work-items/INDEX.md",
        "skills/route-workflow/SKILL.md",
        "skills/route-workflow/references/prompt-composer.md",
        "FRAMEWORK-STATE.md"
      ],
      "blocked_by": ["T5"],
      "ac_ids": ["AC-SETUP", "AC-BIND-3"],
      "validation_ids": ["V-SETUP-DOCS"],
      "context_refs": [
        {
          "path": "provision/hosts/grok.json",
          "start_line": 25,
          "end_line": 31,
          "excerpt_sha256": "7cc3997914b66b3bfc65a3d0c58a6b518f7e5c68a1c2f8a0e7ceb96a5ebe7b13"
        }
      ]
    }
  ],
  "validation_plan": [
    {
      "id": "V-ORCH-02",
      "ac_ids": ["AC-BIND-1", "AC-BIND-2", "AC-BIND-3", "AC-BIND-4", "AC-BIND-5", "AC-BIND-6", "AC-BIND-1E", "AC-BIND-2E", "AC-BIND-3E", "AC-DISPATCH-1", "AC-DISPATCH-2", "AC-ISO-1", "AC-ISO-2", "AC-ISO-3", "AC-HOT-1", "AC-ZERO"],
      "observation_kind": "unit",
      "command": "node test-framework/evals/tier-1/validate-cross-repo-orch-02.mjs",
      "expected_outcome": "PASS including acme+hourshub+ssve discovery, project-only no mtime migrate, PLAN xhigh, EXEC high, lock+skip migrate, concurrent one contract line, SVC_SKILLS_HOME skills-path allow, lookalike deny, mixed-repo Write deny, hook {} on no match, no spawn in hook source",
      "sufficiency": "Hermetic HOME/SVC_SKILLS_HOME overrides prove any onboarded project id and the new allowlist. ISO-1 does not use ROOT/scripts/svc-orchestrate.mjs."
    },
    {
      "id": "V-ORCH-01",
      "ac_ids": ["AC-REG", "AC-DISPATCH-3", "AC-ISO-3"],
      "observation_kind": "unit",
      "command": "node test-framework/evals/tier-1/validate-cross-repo-orch-01.mjs",
      "expected_outcome": "PASS 2026-09-18 incident fixture",
      "sufficiency": "Existing #66 regression remains green."
    },
    {
      "id": "V-CATALOG",
      "ac_ids": ["AC-CAT-1"],
      "observation_kind": "unit",
      "command": "bash test-framework/evals/tier-1/validate-catalog-generation.sh",
      "expected_outcome": "PASS with svc-origin-orchestrator-prompt registered",
      "sufficiency": "Every hooks/svc-*.mjs must appear in the catalog."
    },
    {
      "id": "V-GROK-TOML",
      "ac_ids": ["AC-CAT-1"],
      "observation_kind": "unit",
      "command": "bash test-framework/evals/tier-1/validate-grok-hook-toml-roundtrip.sh",
      "expected_outcome": "PASS lossless RMW of unknown user hook tables",
      "sufficiency": "Wirer lossless_rmw fixture for grok host config."
    },
    {
      "id": "V-SETUP-DOCS",
      "ac_ids": ["AC-SETUP"],
      "observation_kind": "source",
      "command": "rg -n \"setup is not promotion|install-preview, not promotion\" FRAMEWORK-STATE.md",
      "expected_outcome": "at least one match after T6",
      "sufficiency": "Owner lock that local ./setup is not land."
    },
    {
      "id": "V-PLAN-CONTRACT",
      "ac_ids": [],
      "observation_kind": "unit",
      "command": "node scripts/validate-plan-contract.mjs docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/plan-contract.json",
      "expected_outcome": "PASS risk sections including mkdir_exclusive migrate lock",
      "sufficiency": "Mechanical plan-contract for the declared risk flags."
    }
  ],
  "risk_rollback": {
    "risks": [
      "hook bind writes another repo .svc without PreToolUse isolation",
      "wirer RMW drops user hooks",
      "PLAN xhigh cost if hook spawned children",
      "SessionStart+UserPromptSubmit double-append without the migrate lock"
    ],
    "rollback": "git revert of the landing commit; grok host config restore from ~/.grok/config.toml.svc-wire.rollback without rewriting pre-migration.bak",
    "verification": "orch-01 and orch-02 validators plus catalog generation after revert or after land"
  },
  "execution_command_sequence": [
    {
      "step": 1,
      "command": "bash scripts/worktree.sh create feature-wi-fw-cross-repo-orch-02 --from origin/main --wi WI-FW-CROSS-REPO-ORCH-02",
      "expected_outcome": "linked worktree on origin/main 483e26b"
    },
    {
      "step": 2,
      "command": "cp -R /home/dianast/worktrees/ssve/feature-wi-fw-cross-repo-orch-01/docs/plans/2026-09-18-wi-fw-cross-repo-orch-02 <NEW>/docs/plans/ && cp the three docs/specs files listed in T7",
      "expected_outcome": "plan packet, spec, WI, gap-brief present in the exec worktree"
    },
    {
      "step": 3,
      "command": "sha256sum -c against the §3a blueprint table",
      "expected_outcome": "four blueprint hashes match"
    },
    {
      "step": 4,
      "command": "node test-framework/evals/tier-1/validate-cross-repo-orch-02.mjs && node test-framework/evals/tier-1/validate-cross-repo-orch-01.mjs && bash test-framework/evals/tier-1/validate-catalog-generation.sh",
      "expected_outcome": "all three PASS after T1-T5"
    }
  ],
  "ac_digests": {
    "spec_path": "docs/specs/features/wi-fw-cross-repo-orch-02.md",
    "spec_ac_table_sha256": "0c4d1acfe5789d0e4c3824ccf6c2c3bda86221892c2f9c6adc783038c759895f",
    "entries": [
      { "ac_id": "AC-BIND-1", "digest": "WI name binds to onboarded linked worktree; cwd wins if already that tree", "anchor": "AC-BIND-1" },
      { "ac_id": "AC-BIND-2", "digest": "discovered project id resolves worktree; no mtime WI pick; migrate only named WI or unique in_progress", "anchor": "AC-BIND-2" },
      { "ac_id": "AC-BIND-3", "digest": "user-visible output fails USER_CLI_HOMEWORK_RE", "anchor": "AC-BIND-3" },
      { "ac_id": "AC-BIND-4", "digest": "bind hook fail-open never blocks", "anchor": "AC-BIND-4" },
      { "ac_id": "AC-BIND-5", "digest": "mkdir_exclusive then same-tuple skip or reconstruct; one contract line under concurrency", "anchor": "AC-BIND-5" },
      { "ac_id": "AC-BIND-6", "digest": "origin dispatches PLAN xhigh then Fable then EXEC high; hook does not spawn", "anchor": "AC-BIND-6" },
      { "ac_id": "AC-BIND-1E", "digest": "foreign/ambiguous identity denied", "anchor": "AC-BIND-1E" },
      { "ac_id": "AC-BIND-2E", "digest": "default checkout refused", "anchor": "AC-BIND-2E" },
      { "ac_id": "AC-BIND-3E", "digest": "no linked worktree: stay put, no user CLI", "anchor": "AC-BIND-3E" },
      { "ac_id": "AC-DISPATCH-1", "digest": "PLAN grok-4.6 effort xhigh", "anchor": "AC-DISPATCH-1" },
      { "ac_id": "AC-DISPATCH-2", "digest": "EXEC grok-4.6 effort high", "anchor": "AC-DISPATCH-2" },
      { "ac_id": "AC-DISPATCH-3", "digest": "REVIEW remains Fable launcher", "anchor": "AC-DISPATCH-3" },
      { "ac_id": "AC-ISO-1", "digest": "SVC_SKILLS_HOME skills-path orchestrate allowed from foreign cwd", "anchor": "AC-ISO-1" },
      { "ac_id": "AC-ISO-2", "digest": "mixed-repo Write still denied", "anchor": "AC-ISO-2" },
      { "ac_id": "AC-ISO-3", "digest": "lookalike in-repo script not origin-orchestrate", "anchor": "AC-ISO-3" },
      { "ac_id": "AC-HOT-1", "digest": "PROJECT_SUBJECT_RE before discover; cache; 150ms fail-open", "anchor": "AC-HOT-1" },
      { "ac_id": "AC-CAT-1", "digest": "catalog + wirers; Cursor not double-wired", "anchor": "AC-CAT-1" },
      { "ac_id": "AC-ZERO", "digest": "first prompt of project id or WI binds or no-target", "anchor": "AC-ZERO" },
      { "ac_id": "AC-SETUP", "digest": "PR land; local setup is not promotion", "anchor": "AC-SETUP" },
      { "ac_id": "AC-REG", "digest": "orch-01 HoursHub incident still PASS", "anchor": "AC-REG" }
    ]
  },
  "changeset_blueprints": [
    {
      "file": "scripts/lib/resolve-named-worktree.mjs",
      "action": "CREATE",
      "blueprint": "Copy exact bytes from docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/resolve-named-worktree.mjs sha256 78759bc2989a121518f7cf89f9e0efe3bc5b1d169214b902d918b0163177b4a7. Discovers any onboarded project under SVC_WORKTREES_ROOT/<id> and SVC_APP_WORKSPACES_ROOT/<id>-worktrees. PROJECT_SUBJECT_RE before discoverProjects. Project-only does not mtime-pick a WI. bindIfNeeded uses resolveOriginHost."
    },
    {
      "file": "hooks/svc-origin-orchestrator-prompt.mjs",
      "action": "CREATE",
      "blueprint": "Copy exact bytes from docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/svc-origin-orchestrator-prompt.mjs sha256 11e34c29b67d0d5873218ba5c57f48953060e0f7dc118f6c942244dfb3321b25. Fail-open UserPromptSubmit/SessionStart. Host from payload.host or SVC_HOST with no cursor default. Never spawn. Never user CLI homework."
    },
    {
      "file": "test-framework/evals/tier-1/validate-cross-repo-orch-02.mjs",
      "action": "CREATE",
      "blueprint": "Copy exact bytes from docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/validate-cross-repo-orch-02.mjs sha256 25cf2fde3133575222d55d27b46a0e41c6751366debe8faf38cc70f442e1ff34. AC-ISO-1 uses SVC_SKILLS_HOME symlinks, not ROOT/scripts. Every AC-to-Test row for this file has a named check()."
    },
    {
      "file": "test-framework/evals/tier-1/fixtures/cross-repo-orch-02.json",
      "action": "CREATE",
      "blueprint": "Copy exact bytes from docs/plans/2026-09-18-wi-fw-cross-repo-orch-02/blueprints/cross-repo-orch-02.json sha256 4389b4f7e933fea736e175e60e962c9c672be8e67e03ed706d6ebb91ec6afc1b."
    },
    {
      "file": "scripts/lib/cross-repo-orch.mjs",
      "action": "MODIFY",
      "blueprint": "Export ORIGIN_HOSTS and resolveOriginHost. migrateSession: mkdir_exclusive lock, existingMigrateBaton skip/reconstruct, skipped_contract_append. PLAN argv --model grok-4.6 --effort xhigh. EXEC argv --model grok-4.6 --effort high. result.effort and spawn SVC_GROK_EFFORT. REVIEW argv unchanged. CLI origin_host still defaults to cursor."
    },
    {
      "file": "hooks/svc-worktree-isolation-guard.mjs",
      "action": "MODIFY",
      "blueprint": "origin-orchestrate allow when realpath(script) is in originOrchestrateReals(env): ROOT plus SVC_SKILLS_HOME/HOME {.cursor,.grok,.claude}/skills/scripts/svc-orchestrate.mjs. Lookalike cwd script still denied. Mixed-repo Write still denied."
    }
  ],
  "planning_contract": {
    "kind": "lightweight",
    "original_requirements_ref": {
      "type": "object",
      "sha256": "6a4af262e22db1fc87726c42b9fa57f2f4a699432b61f07a3afb69722a657d30"
    },
    "eligibility_ref": {
      "type": "object",
      "sha256": "edc3b23ef445f0335eebe28c5a41f9fa24eecb706dc8c5c86f877bf57e038aec"
    },
    "eligibility_tree": {
      "type": "digest",
      "sha256": "6bd7a6a8803fa606541cb72febd20df12ded26a14eb674c3f4e396f388dbbaf4",
      "of": "tree"
    }
  },
  "implementation_approach": [
    {
      "id": "bind-discovery",
      "requirement_ids": ["AC-BIND-1", "AC-BIND-2", "AC-BIND-5", "AC-HOT-1", "AC-ZERO"],
      "source_ids": ["design-tech", "gap-brief"],
      "approach": "Discover onboarded project ids from canonical worktree roots after PROJECT_SUBJECT_RE. Resolve WI files across those linked trees. Project-only injects candidate WIs and migrates only on named WI or unique in_progress. bindIfNeeded via migrateSession lock+skip.",
      "interfaces": "resolveOriginIntent(text, cwd), bindIfNeeded(intent, host/session), migrateSession, resolveOriginHost",
      "state_and_ownership": "Target worktree .svc/bindings/<session_id>.json via atomic_rename; session-contract append only on new tuples under mkdir_exclusive",
      "failure_and_recovery": "Typed miss no_target / orch_foreign / orch_default_checkout / orch_session_missing / orch_host_invalid; fail-open prompt; stay put",
      "task_ids": ["T1", "T2", "T5"],
      "validation_ids": ["V-ORCH-02"]
    },
    {
      "id": "dispatch-effort",
      "requirement_ids": ["AC-DISPATCH-1", "AC-DISPATCH-2", "AC-DISPATCH-3", "AC-BIND-6"],
      "source_ids": ["design-tech"],
      "approach": "Origin dispatches #66 CLI. PLAN xhigh EXEC high in argv and result.effort / SVC_GROK_EFFORT. Hook does not spawn.",
      "interfaces": "dispatchRole PLAN|EXEC|REVIEW",
      "state_and_ownership": "handoff prompt files under target .svc/handoffs as #66",
      "failure_and_recovery": "Missing prompt file refuses spawn; agy/paste still fail closed",
      "task_ids": ["T1"],
      "validation_ids": ["V-ORCH-02", "V-ORCH-01"]
    },
    {
      "id": "isolation-skills-path",
      "requirement_ids": ["AC-ISO-1", "AC-ISO-2", "AC-ISO-3"],
      "source_ids": ["wi-01-cli"],
      "approach": "Allow installed skills-path orchestrate realpath set via SVC_SKILLS_HOME; keep mixed-repo Write deny and lookalike deny.",
      "interfaces": "classifyMutation origin-orchestrate short-circuit, originOrchestrateReals(env)",
      "state_and_ownership": "no new state",
      "failure_and_recovery": "unknown script path is not origin-orchestrate",
      "task_ids": ["T4"],
      "validation_ids": ["V-ORCH-02", "V-ORCH-01"]
    },
    {
      "id": "wiring-catalog",
      "requirement_ids": ["AC-CAT-1", "AC-SETUP"],
      "source_ids": ["design-tech"],
      "approach": "Register hook in catalog and Claude/Grok/Kimi wirers with DISABLED. Cursor adapter-only. Land is PR not local setup.",
      "interfaces": "host-hook-catalog.json, wire-*.mjs, FRAMEWORK-STATE",
      "state_and_ownership": "host hook config via existing wirer backups",
      "failure_and_recovery": "catalog generation fail-closed if svc-*.mjs unregistered; setup is not promotion",
      "task_ids": ["T3", "T6"],
      "validation_ids": ["V-CATALOG", "V-SETUP-DOCS", "V-GROK-TOML"]
    }
  ],
  "executor_discretion": {
    "local_repairs": [
      "Import path or DISABLED placement inside the listed wirers",
      "Import path for bindIfNeeded/resolveOriginIntent/originOrchestratorContext in the Cursor adapter; removal of the scout migrateSession call",
      "Test fixture directory names under tmp HOME / SVC_SKILLS_HOME overrides",
      "Catalog host_commands quoting to match existing wirer style",
      "Placement of originOrchestrateReals helpers immediately above classifyMutation"
    ],
    "amendment_triggers": [
      "New project-root class beyond ~/worktrees/<id> and ~/app-workspaces/<id>-worktrees",
      "Hook spawning Grok",
      "Weakening mixed-repo Write deny or default-checkout refuse",
      "Telling the user to run a CLI",
      "Selecting a project-only WI by lane-tasks mtime",
      "Collapsing Claude/Kimi origin_host to cursor"
    ],
    "disagreement_protocol": "Fable review-plan findings at HIGH/CRITICAL reopen the named AC and the matching T-task; do not silently drop any-onboarded discovery or effort pins."
  }
}
```
<!-- /SVC_PLAN_BODY -->

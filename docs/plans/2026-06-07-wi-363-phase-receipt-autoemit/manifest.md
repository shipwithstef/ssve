# Manifest: WI-363 — phase-receipt auto-emission (observable phases; pilot: route-workflow)

- **Feature spec:** `docs/specs/work-items/WI-363.md`
- **Branch:** `feature-wi-363-phase-receipt-autoemit`
- **Status:** SIMULATED
- **Base branch / SHA:** `main` @ `ab192ecc`
- **Lane:** framework (hot path: hooks + enforcement surface → full chain in worktree)
- **Archetype:** Incremental extension (sibling hook reusing the completion-guard's frontmatter parser pattern + task-graph's canonical writer)

## Implementation Summary

A PostToolUse hook auto-records phase receipts when it can OBSERVE the evidence — exactly the toil whose absence the WI-370 completion-guard catch exposed (38 receipts hand-recorded after the fact).

**Matching contract (anti-hollowing):**
- Only phases whose declared `writes:` paths are TOUCHED by the observed tool event auto-record; judgment phases (no observable write match) stay manual forever.
- Edit/Write: `file_path` matches a write-path → evidence `file:<path>`. Bash (PostToolUse = success-only): command string references a write-path → evidence `command_output:<path>` (the ledger IS the output artifact).
- **One event records at most ONE phase**: the FIRST not-yet-recorded phase in declaration order whose writes match — ordered progression mirrors real execution; shared ledgers (pipeline-decisions appears in P2/P4/P6 writes) cannot triple-fire from one append.
- Write-path normalization: prose suffixes stripped (token up to first space — `".svc/session-contract.jsonl when needed"` → path); `<WI>` placeholder resolved from the active graph's wi.
- skill_receipt-not-loaded → SKIP silently (task-graph:668-670 contract honored; load-skill stays the human-process anchor — never auto-created).
- Already-recorded phase ids skipped (idempotent with manual calls — both paths stay valid).
- Recording delegates to `node scripts/task-graph.mjs record-phase` (canonical writer; no duplicate write logic). Fail-open: any error → exit 0 silent.
- Receipt schema UNTOUCHED ({id, ts, evidence_artifacts} — phase-receipts.md canon); `phases:` frontmatter shape untouched across all skills.

**Grounding (read 2026-06-07):** guard parser `requiredPhasesForSkill` (svc-task-completion-guard.sh:419-436) = the reuse pattern (extended to capture writes/evidence_kind via per-line regex on the same block); task-graph record-phase 660-680 (evidence types enum; receipt precondition); pilot route-workflow `phases:` block (6 phases: P3/P5 evidence_kind file w/ lane-tasks writes; P1/P2/P4/P6 command_output w/ ledger writes incl. prose suffixes); active-graph discovery = newest lane-tasks JSON under .svc/ containing an in_progress task; PostToolUse additionalContext NOT used (this hook only writes the graph — no model-context injection, no async race with the Stop guard: SYNC).

**Invariants:** chain receipts (git notes) completely untouched — this is PHASE receipts only (pressure-test §4 two-system separation); manual record-phase calls keep working everywhere; non-pilot skills unaffected at runtime until they opt in (hook matches phases via SKILL.md, so it technically serves ANY in_progress skill whose writes match — pilot framing = route-workflow is the verified+annotated one; others get verified at WI-366).

## Files Planned

| # | File | Action | Task |
|---|---|---|---|
| 1 | test-framework/evals/tier-1/validate-phase-receipt-autoemit.sh | CREATE | task-1 (TDD RED): fixture graph + synthetic payloads through the hook → receipts appear; judgment/no-match/no-receipt/dup cases stay silent |
| 2 | hooks/svc-phase-receipt-autoemit.mjs | CREATE | task-2 (GREEN) |
| 3 | `route-workflow/SKILL.md` | MODIFY | task-2: one pilot paragraph in the Phase Receipt Contract section (frontmatter untouched) |
| 4 | test-framework/evals/tier-1/validate-stop-hook-phase-enforcement.sh | MODIFY | task-2: +assertion — auto-emitted receipts satisfy the completion guard (fixture round-trip) |
| 5 | test-framework/evals/tier-1/validate-phase-receipt-migration.sh | MODIFY | task-2: +assertion — autoemit hook exists+wired alongside migrated skills |
| 6 | `scripts/wire-hooks.mjs` | MODIFY | task-2: emission PostToolUse(Edit|Write) + PostToolUse(Bash) sync + isAlreadyWired cases |
| 7 | `hooks/hooks.json` | MODIFY | task-2: mirror rows |

**Tier-1 validator promotion note:** validator_path = file 1; failure_class = phase-receipt automation silently dying (receipts stop appearing → guard blocks every closeout) or hollowing (receipts without evidence); promotion_signal = 3 (enforcement hot path) + 1 (WI-370 live occurrence of the manual-debt class); budget <5s hermetic (fixture graph in /tmp, sanitized GIT_*); tier-2 insufficient because the guard+autoemit pair gates every WI closeout.

## Blueprint 2 (hook core — executor extracts verbatim)

```javascript
#!/usr/bin/env node
/** svc-phase-receipt-autoemit (WI-363) — records phase receipts when the
 * evidence is OBSERVABLE: a PostToolUse event touching a declared writes-path
 * of the active task's skill phases. One event -> at most one phase (first
 * unrecorded in declaration order). Judgment phases never auto-fire.
 * Fail-open; sync (Stop-guard reads receipts immediately after). */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readHookPayload, extractFilePath, extractCommand } from "./lib/hook-payload.mjs";

const SVC_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function activeGraph(cwd) {
  const dir = path.join(cwd, ".svc");
  let best = null;
  try {
    for (const f of readdirSync(dir)) {
      if (!/^lane-tasks-.*\.json$/.test(f)) continue;
      const p = path.join(dir, f);
      let g; try { g = JSON.parse(readFileSync(p, "utf8")); } catch { continue; }
      const t = (g.tasks || []).find((x) => x.status === "in_progress");
      if (!t) continue;
      const m = statSync(p).mtimeMs;
      if (!best || m > best.m) best = { p, g, t, m };
    }
  } catch { return null; }
  return best;
}

function phasesFor(skill) {
  if (!skill || !/^[A-Za-z0-9._-]+$/.test(skill)) return [];
  const f = path.join(SVC_ROOT, skill, "SKILL.md");
  if (!existsSync(f)) return [];
  const text = readFileSync(f, "utf8");
  const start = text.match(/^phases:\s*$/m);
  if (!start) return [];
  const rest = text.slice(start.index);
  const end = rest.search(/^inputs:\s*$/m);
  const block = (end === -1 ? rest : rest.slice(0, end)).split(/\r?\n/);
  // G2 CRITICAL-1: state-accumulating parser — handles BOTH inline-map
  // (`- { id: X, writes: [..] }`) and block-style multi-line phase entries.
  const out = [];
  let cur = null;
  for (const line of block) {
    const idm = line.match(/(?:^|[-{,]\s*)id:\s*([A-Za-z0-9.-]+)/);
    if (idm) { if (cur) out.push(cur); cur = { id: idm[1], evidence_kind: "command_output", writes: [] }; }
    if (!cur) continue;
    const ekm = line.match(/evidence_kind:\s*(\w+)/);
    if (ekm) cur.evidence_kind = ekm[1];
    const wrm = line.match(/writes:\s*\[([^\]]*)\]/);
    if (wrm) {
      cur.writes.push(...wrm[1].split(",").map((x) => x.trim().replace(/^"|"$/g, "").split(/\s/)[0]).filter(Boolean));
    } else if (/^\s*-\s+"/.test(line) && /writesPending/.test("")) { /* reserved */ }
    // block-style list items under a `writes:` line:
    if (/^\s*writes:\s*$/.test(line)) cur._inWrites = true;
    else if (cur._inWrites) {
      const li = line.match(/^\s*-\s*"?([^"\s]+)/);
      if (li) cur.writes.push(li[1]);
      else if (!/^\s*$/.test(line)) cur._inWrites = false;
    }
  }
  if (cur) out.push(cur);
  return out.map(({ _inWrites, ...rest2 }) => rest2);
}

function main() {
  const call = readHookPayload();
  if (!call) process.exit(0);
  const tool = call.toolName;
  const cwd = call.cwd || process.cwd();
  let touched = "";
  if (tool === "Edit" || tool === "Write") touched = extractFilePath(call.toolInput) || "";
  else if (tool === "Bash") touched = extractCommand(call.toolInput) || "";
  else process.exit(0);
  if (!touched) process.exit(0);
  if (path.isAbsolute(touched) && (tool === "Edit" || tool === "Write")) touched = path.relative(cwd, touched);

  const act = activeGraph(cwd);
  if (!act) process.exit(0);
  const { p: graphPath, g, t } = act;
  if (!t.skill_receipt || typeof t.skill_receipt !== "object") process.exit(0); // 668-670 contract
  const skill = t.skill_receipt.skill || t.skill;
  const done = new Set((t.skill_receipt.phases_executed || []).map((x) => x.id));
  const wi = g.wi || "";

  // G2 CRITICAL-2: Bash matches only count as WRITES when a mutation operator
  // precedes the path occurrence (>>, >, tee [-a], sed -i, or the canonical
  // appenders). Read-only cat/grep/tail can never emit a receipt.
  function bashWrites(cmd, wp) {
    const i = cmd.indexOf(wp);
    if (i < 0) return false;
    const before = cmd.slice(0, i);
    return /(>>?\s*$|>>?\s*\S*$|tee(\s+-a)?\s+\S*$|sed\s+-i\S*\s+\S*$|pipeline-log\.mjs\s+append[\s\S]*$|task-graph\.mjs[\s\S]*$)/.test(before.slice(-200));
  }
  const matchPath = (wp) => (tool === "Bash" ? bashWrites(touched, wp) : (touched === wp || touched.endsWith(wp)));
  const phases = phasesFor(skill).filter((ph) => !done.has(ph.id) && ph.writes.length);
  // G2 HIGH: prefer phases whose matched path is EXCLUSIVE to them (not shared
  // with any other declared phase) — shared-ledger misattribution guard.
  const allWrites = new Map();
  for (const ph of phases) for (const w of ph.writes) allWrites.set(w, (allWrites.get(w) || 0) + 1);
  const tiers = [
    phases.filter((ph) => ph.writes.some((w) => allWrites.get(w) === 1 && matchPath(w.replace(/<WI>/g, wi)))),
    phases.filter((ph) => ph.writes.some((w) => matchPath(w.replace(/<WI>/g, wi)))),
  ];
  for (const tier of tiers) {
    const ph = tier[0];
    if (!ph) continue;
    const wp = ph.writes.map((w) => w.replace(/<WI>/g, wi)).find((w) => matchPath(w));
    const ev = `${ph.evidence_kind === "file" ? "file" : "command_output"}:${wp}`;
    try {
      execFileSync("node", [path.join(cwd, "scripts", "task-graph.mjs"), "record-phase", graphPath, String(t.id), ph.id, "--evidence", ev], { cwd, stdio: "ignore" });
    } catch { /* fail-open: absent script (cross-project) or any error */ }
    break; // one event, one phase
  }
  process.exit(0);
}

try { main(); } catch { process.exit(0); }
```

(Blueprint already uses the plain `path.join(cwd, "scripts", "task-graph.mjs")` per G2 MEDIUM; absent script → catch → fail-open = correct cross-project behavior.)

## Pilot paragraph (file 3, appended inside route-workflow's Phase Receipt Contract section)

> **Auto-emission pilot (WI-363):** *(Known limit: phases sharing a write-ledger with an earlier unrecorded phase may attribute to the earlier one — exclusive-path matches take priority; record judgment phases manually as always.)* `hooks/svc-phase-receipt-autoemit.mjs` records these phases automatically when their declared `writes:` paths are touched (one phase per tool event, declaration order). The manual commands above remain valid and idempotent — run them when a phase's evidence lives outside the declared writes set or when working on hosts without the hook.

## G2 Amendment (gemini, REJECT→fixed)

- CRITICAL-1: line-local YAML parse → state-accumulating parser (inline-map AND block-style); validator gains a multi-line-fixture case.
- CRITICAL-2: read-only Bash could emit receipts → mutation-operator requirement (`>>`/`>`/`tee`/`sed -i`/canonical appenders must precede the path); validator gains cat/grep negative cases.
- HIGH: shared-ledger misattribution on skipped phases → exclusive-write-path tier matched FIRST; limitation documented in pilot paragraph.
- MEDIUM: brittle root comparison → plain `path.join(cwd, 'scripts', 'task-graph.mjs')`.

## Task Graph

| Task | Title | Files | Validation | Checkpoint |
|---|---|---|---|---|
| task-1-validator | TDD RED | 1 | validator NON-zero vs absent hook (autoemit cases fail; negative cases vacuous-pass) | `checkpoint-1-red` |
| task-2-green | hook + pilot + validators + wiring | 2-7 | validator GREEN; both modified validators still pass on corpus | `checkpoint-2-green` |
| task-3-validation | branch validation | — | suite (199 incl. new) via worktree run; lint; diff == 7 files | (pre-G5) |

## AC map

AC-01 observable phases auto-record with real evidence paths (fixture) · AC-02 judgment/no-match/no-receipt/dup → silent (4 negative fixtures) · AC-03 one-event-one-phase ordering (shared-ledger fixture) · AC-04 guard round-trip: auto-emitted receipts satisfy completion guard (validator 4 assertion) · AC-05 RED proof · AC-06 live: this WI's own remaining tasks get ≥1 auto-recorded phase post-rewire (G7).

## Prerequisite Alignment Matrix

| Task | UX | UI | Tech design | Style contract | Persona |
|---|---|---|---|---|---|
| all | N/A | N/A | phase-receipts.md canon + guard parser reuse + WI anti-hollowing guardrails | hook idiom (payload helper, fail-open, sync) | P0: kills the 6-call boilerplate that caused the WI-370 debt |

## External State

| # | Environment | What | Coupling | Wiring |
|---|---|---|---|---|
| 1 | global settings (live wiring at rewire) | +2 PostToolUse entries | coupled | WI-359 wirer backup/restore |
| 2 | /tmp fixture graphs (validator) | created per run | decoupled-justified | trap rm -rf; sanitized GIT_* |
| 3 | worktree ckpt ledger | created | decoupled-justified | commit-subject anchors |

Untouched: chain receipts/git notes (two-system separation), all other taxonomy entries.

## Lane Compliance
Tasks 1-9 graph (phases recorded LIVE per task this run); WI doc = spec; design-tech skipped (top-level reason); precedent PR #29-#34.

## Validation Plan
Task-level above. Final: suite in worktree · lint · diff EXACT-7 · negative corpus (both modified validators green across all skills). Live proof at G7: post-rewire, the closeout tasks of THIS WI auto-record (the hook dogfoods on its own delivery).

## Execution Command Sequence

```bash
bash scripts/worktree.sh create feature-wi-363-phase-receipt-autoemit
set +e; bash test-framework/evals/tier-1/validate-phase-receipt-autoemit.sh; RED=$?; set -e
test "$RED" -ne 0 && echo "RED=$RED ok"
git add test-framework/evals/tier-1/validate-phase-receipt-autoemit.sh
git commit -m "test(WI-363): checkpoint-1-red" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <contact-cd29c5ac34@example.invalid>"
mkdir -p .svc && git rev-parse HEAD >> .svc/wi-363-checkpoints.log
# GREEN: files 2-7
git add hooks/svc-phase-receipt-autoemit.mjs route-workflow/SKILL.md test-framework/evals/tier-1/validate-stop-hook-phase-enforcement.sh test-framework/evals/tier-1/validate-phase-receipt-migration.sh scripts/wire-hooks.mjs hooks/hooks.json
git commit -m "feat(WI-363): checkpoint-2-green" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <contact-cd29c5ac34@example.invalid>"
git rev-parse HEAD >> .svc/wi-363-checkpoints.log
EVALS=0 bash test-framework/evals/run-all-evals.sh --tier1
node scripts/lint-skills-manifest.mjs
git diff --name-only main...HEAD | sort
# RECOVERY_IF_FAIL: WT="$(git rev-parse --show-toplevel)"; rescue-branch if dirty; git -C "$WT" reset --keep <ledger/log-grep anchor>
```

## Loop-Backs
- Guard double-counts auto+manual duplicate ids → record-phase idempotence check (skip-if-present is in the hook; guard counts a Set — safe by construction, verified in validator 4)
- Cross-project (Example Marketplace) graphs without scripts/task-graph.mjs → fail-open catch = correct (no svc enforcement there)

## Promotion Readiness
- [x] 2 CREATE + 5 MODIFY · TDD real · 6 ACs · diff EXACT-7 enforced · promotion note 5 fields · anti-hollowing guardrails embedded (one-event-one-phase; judgment-manual; schema untouched) · phase receipts LIVE per task this run

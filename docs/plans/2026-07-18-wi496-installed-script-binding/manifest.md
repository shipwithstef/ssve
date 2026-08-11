# WI-496 Plan Manifest — installed-script binding for the Codex bootstrap exit (rev 3)

**WI:** WI-496 · **Lane:** framework · **Tier:** full — the "lean execution profile" is an EXECUTION discipline (inline stages, one-round-per-gate targets, frozen diff), not a ceremony tier; every mandatory gate runs. Policy record: `.svc/pipeline-decisions.jsonl` 2026-07-18T05:20:00Z.
**Base:** origin/main `4b73b212` (WI-494 merge) · **Spec:** `docs/specs/work-items/WI-496.md`
**Rev 3:** round-1 F-001..F-006 and round-2 R2-F001..R2-F006 all ACCEPTED and applied (log: `review-log.yaml`).
**Mode:** `inline` — single-orchestrator execution in this session; blueprints B1–B3 are the complete dispatch content (R2-F002).

## Scope (frozen — 2 files)

1. `hooks/codex/svc-codex-skill-load-enforcer.mjs` — dual-canonical script binding + repo-aware recovery string
2. `test-framework/evals/tier-1/validate-codex-execution-integrity.sh` — ISB fixtures (extend the existing WI-494 section)

Nothing else. `codex-hook-context.mjs`, `bootstrap-marker.mjs`, `argv-lex.mjs`, `svc-ensure-worktree.mjs` are untouched.

## Lane compliance (F-003)

| Upstream skill | Status | Artifact / citation |
|---|---|---|
| route-workflow | completed | `.svc/lane-tasks-WI-496.json` task 1 receipt (6 phases) + `docs/specs/work-items/WI-496.md` |
| diagnose-bug | completed (folded) | live reproduction against the deployed enforcer logged in `.svc/pipeline-decisions.jsonl` 2026-07-18T05:20:01Z; root cause + repro embedded in WI-496.md §Problem |
| design-tech | skipped-with-justification | `.svc/lane-tasks-WI-496.json` task 9 `skip_reason` (fix applies the WI-494 reviewer's own R2-F001 design via the existing WI-487 trusted-source pattern; no new architecture) |
| write-spec | skipped-with-justification | bugfix-lane delta: WI-496.md IS the spec artifact (Problem + Fix + AC table, baton-bound via ac_digests); feature-spec authoring not required for corrective bugfixes, same shape as WI-489/491/494 (R3-F002) |
| improve-framework | skipped-with-justification | corrective single-defect bugfix, not a self-improvement scan; umbrella entry not required for framework-lane bugfixes — `.svc/pipeline-decisions.jsonl` 2026-07-18T05:45:00Z (R2-F001) |
| plan-changeset | this manifest | task 2 receipt |
| review-plan → execute → review-exec → audit → land → verify-promotion | sequenced | tasks 3–8 in `.svc/lane-tasks-WI-496.json` |

## Blueprint

### B1 — enforcer: dual-canonical script binding (`bootstrapShapeInner`)

Two mutually exclusive arms replace the single repo-local binding block:

- **Arm A (repo-local, unchanged semantics):** `argv[1] === "scripts/svc-ensure-worktree.mjs"` →
  realpath against `ctx.repo_root` must equal `realpath(repo_root/scripts/svc-ensure-worktree.mjs)`
  and stay inside `repo_root` (WI-494 F-001 shadow fence kept verbatim). Framework-repo path.
- **Arm B (installed, new):** `path.isAbsolute(argv[1])` → `realpath(argv[1])` must equal
  `realpath(<HERE>/../../scripts/svc-ensure-worktree.mjs)` where `HERE = dirname(fileURLToPath(import.meta.url))`
  — the running enforcer's OWN sibling script (WI-487 trusted-source derivation, already used in
  this file). Never from env, payload, or repo content.
- Any other `argv[1]` → `false`. All other WI-494 fences unchanged: `realpath(ctx.cwd) === ctx.repo_root`,
  argv-lex strict flag matrix, `laneGraphs()==0` zero-state gate, marker ownership (F-003 checks),
  try/catch fail-closed wrapper.

### B2 — enforcer: repo-aware `deny()` recovery string (F-004)

- `deny(reason, active, ctx)` — thread `ctx` from call sites (it is in scope at every deny call).
- Probe: `fs.existsSync(path.join(ctx.repo_root, "scripts", "svc-ensure-worktree.mjs"))` —
  bound to the already-realpath'd `ctx.repo_root`, NOT process cwd; plain existsSync (follows
  symlinks — acceptable: the probe only selects display text). When `ctx` is unavailable
  (parse-failure deny), fall back to the installed form (always paste-runnable).
- Exists → print current relative form. Absent → print
  `node <installedEnsureWorktree()> --wi WI-<N> --branch <branch>` where `installedEnsureWorktree()`
  is the Arm B canonical realpath renderer (single shared helper; one source of truth for B1 + B2).
- The probe grants nothing; B1 is the sole authorization. A fixture drives the enforcer with
  process cwd ≠ ctx.repo_root to prove the string tracks `ctx.repo_root` (ISB-04b).

### B3 — tier-1 ISB fixtures (F-001, F-005) — exact algorithm

All inside the existing WI-494 section of `validate-codex-execution-integrity.sh`, using its
established helpers (`expect`, `$ROOT`, `$RUNTIME`). Setup per fixture: `T=$(mktemp -d)` with
`trap 'rm -rf "$T"' EXIT` accumulation; `git init -q "$T/onb"`; `mkdir "$T/onb/.svc"`; NO `scripts/`
dir. Fixed identifiers: session `wi496-fixture-session-0001`, wi `WI-9`, branch `wi9-isb-branch`.
`INSTALLED="$(realpath "$ROOT/scripts/svc-ensure-worktree.mjs")"` (the enforcer under test lives at
`$ROOT/hooks/codex/`, so its sibling-derived installed path IS `$INSTALLED`).

- **ISB-01 (onboarded e2e, deterministic + rerun-safe):**
  1. Payload `{"tool_name":"Bash","tool_input":{"command":"node $INSTALLED --wi WI-9 --branch wi9-isb-branch"},"session_id":"wi496-fixture-session-0001","cwd":"$T/onb"}` → enforcer stdout `{}` (allow), exit 0.
  2. Execute that exact command in `$T/onb` with `SVC_SESSION_ID=wi496-fixture-session-0001` → exit 0; assert the reported graph file exists and `validateTaskGraphShape` passes.
  3. Loader payload for the created graph → `{}` (allow) — deadlock exits in one hop.
  4. Re-drive step 1's payload after the graph exists → deny (zero-state gate closed; idempotent second invocation changes nothing).
- **ISB-02 (regression fence):** the existing WI-494 CED-01/CED-02 framework-repo fixtures run unchanged and pass.
- **ISB-03 (negatives, each expects deny + exit 0 with a deny decision):**
  a. `cp "$INSTALLED" "$T/elsewhere.mjs"` → absolute path to the byte-copy → deny.
  b. Relative `scripts/svc-ensure-worktree.mjs` spelling in `$T/onb` (script absent) → deny.
  c. `ln -s "$T/elsewhere.mjs" "$T/link.mjs"` → absolute path to the symlink → deny (realpath ≠ installed).
- **ISB-04 (recovery string, exact assertions — R2-F005):** drive a plain governed mutation (`touch x`) in `$T/onb` → deny reason contains the exact substring `node $INSTALLED --wi` AND does NOT contain `node scripts/svc-ensure-worktree.mjs`; same event in a second fixture repo `$T/vend` that HAS a real `scripts/svc-ensure-worktree.mjs` (copied file, not symlink) → reason contains `node scripts/svc-ensure-worktree.mjs` AND does NOT contain `$INSTALLED`.
  **ISB-04b:** payload with `cwd` = `$T/onb` while the hook process cwd is `$ROOT` → string still tracks the payload repo (ctx.repo_root binding).
- **ISB-05 (suite registration):** `run-all-evals.sh --tier1` passes with the extended validator — the fixture count increase is visible in the validator's own pass count and the suite total stays green (mapped to Validation gate 2 below).

## External State (F-002)

| State | Preflight | Mutation | Verification | Restore / cleanup | Failure recovery |
|---|---|---|---|---|---|
| `~/.codex/hooks.json` | backup exists at `~/.codex/hooks.json.bak-wi494` (contains the enforcer entry; current live file has it REMOVED as interim mitigation) | at G7: IDEMPOTENT node JSON edit — insert the enforcer entry (object copied from the backup) into current hooks.json ONLY if absent; running twice is a no-op (R3-F003); never wholesale-copy the backup (R2-F004) | `grep -c svc-codex-skill-load-enforcer ~/.codex/hooks.json` == 1 and JSON parses and a diff vs pre-edit shows ONLY the inserted entry | backup file retained | if G7 proof fails, re-remove the enforcer entry (re-apply interim mitigation) and file the follow-up |
| Installed farm `~/.codex/skills` | symlink → framework repo (verified live) | none by this WI (content updates when main advances) | `realpath ~/.codex/skills/hooks` == `<repo>/hooks` | n/a | n/a |
| Codex session (example-marketplace) | user's session loads hooks at start | none by us | user restarts session after G7 restore | n/a | n/a |
| `example-marketplace` repo | zero-state (claims archived earlier; backup `~/svc-example-marketplace-backup.tgz`) | NONE — G7 proof drives the deployed enforcer binary with a payload only; no command executed, no graph/worktree/claim created in example-marketplace | enforcer stdout `{}` for the absolute-path bootstrap payload; deny for a plain mutation payload with a paste-runnable recovery string | nothing to clean (no writes) | n/a |
| Framework repo `main` | clean, `4b73b212` | normal land via PR squash | envelope on merge SHA; promoted tier-1 | branch/worktree hygiene closeout | `git revert <merge-SHA>` |

## Decision trace

- **Trusted-source derivation over env/config:** installed path from `import.meta.url` of the running
  enforcer (WI-487 pattern in this file) — unreachable via env/payload; moving it requires replacing
  the enforcer, which is already the trust root.
- **Two arms, not absolute-only:** preserves WI-494's deliberate framework-repo relative UX (R2-F001
  deferral rationale) while adding the product-repo path; closes R2-F001's onboarded consequence.
- **Repo-local keeps priority semantics:** a repo that vendors the script binds to its own copy
  exactly as WI-494 shipped — no trust change either direction.
- **Recovery probe advisory-only, ctx-bound:** selects display text only; bound to `ctx.repo_root`
  so it is cwd-invariant (F-004).
- **G7 proof is payload-drive only in example-marketplace:** proves the live decision without creating
  product-repo state; the user's own session performs the real bootstrap for their feature WI (F-006).

## Risk / rollback (F-006)

- **Blast radius:** every Codex-host PreToolUse in every repo; Claude host untouched.
- **Primary risk:** Arm B widening — mitigated by realpath-equality to the enforcer's own sibling;
  ISB-03 negatives are load-bearing.
- **Rollback, tracked code:** single squash-merge revert — `git revert <merge-SHA>` (SHA known at
  land; recorded in the land receipt). No state, schema, or migration.
- **Rollback, validation state:** `~/.codex/hooks.json` — re-remove the enforcer entry to return to
  the interim mitigation (procedure in External State); `example-marketplace` — nothing to roll back
  (no writes by design); WI-496 worktree/branch — normal hygiene closeout, and on abort:
  worktree removal + branch delete via the standard hygiene closeout procedure (destructive preamble required).

## Validation plan (gates, in order)

1. `export PATH="$HOME/.local/bin:$PATH"` (rg prerequisite) → `bash test-framework/evals/tier-1/validate-codex-execution-integrity.sh` → all CED + ISB fixtures pass (ISB-01..ISB-04b inclusive).
2. `bash test-framework/evals/run-all-evals.sh --tier1` → 251/251 (ISB-05).
3. Impact-triad receipt (tier high): at COMMIT time its independent_review cites this plan's codex rounds (the only review that exists pre-commit — documented limitation, same as WI-494); the exec-diff independent review is supplied by the G6 review-exec receipt emitted onto the SAME SHA before push — the pre-push envelope refuses the range without it, so the plan-round citation can never reach origin/main alone (R2-F003). Guard must return ok:true on the staged diff.
4. G6 review-exec (one round target) + G5 audit → receipts on the exec commit.
5. Land (PR, squash) → re-emit envelope on merge SHA.
6. G7 (R2-F006 — proves the full exit, not just authorization): (a) promoted tier-1 green from the promoted checkout; (b) full ISB-01-equivalent e2e against the PROMOTED install — throwaway `mktemp -d` onboarded repo, drive `~/.codex/skills/hooks/codex/svc-codex-skill-load-enforcer.mjs` → allow, EXECUTE the installed-path bootstrap command there → graph created, loader allowed, cleanup by trap; (c) re-insert the enforcer entry per External State and verify; (d) payload-drive in `example-marketplace` (no writes): absolute-path bootstrap payload → `{}`, plain mutation → deny naming the installed path.

## ac_digests

- spec_path: `docs/specs/work-items/WI-496.md`
- spec_ac_table_sha256: `cc817014c62df6795f8e0a84b0adc362ef67bff6fe0f16e95b4e1172a9748db8`
- ISB-01 → B3/ISB-01 + validation gate 1 · ISB-02 → B3/ISB-02 + gate 1 · ISB-03 → B3/ISB-03 + gate 1 · ISB-04 → B2 + B3/ISB-04(+04b) + gate 1 · ISB-05 → B3/ISB-05 + gate 2.

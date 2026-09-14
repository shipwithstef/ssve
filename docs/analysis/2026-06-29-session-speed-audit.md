# Session Audit — WI-440 audit cluster: why it was slow, how to get 5×+ (zero quality loss)

## Scope
Self-audit of this session: executing the WI-440 no-loss audit cluster (PRs #109 Step-0, #110 A1, #111 C1, #112 C6, #113 closeout) end-to-end on `main`, Claude Code host, Opus 4.8 (1M). Focus = **execution speed**, not correctness (the work itself is correct + merged). Question: same effect, 0 quality loss, 5×+ speed.

## Harness/model
Claude Code, Opus 4.8 1M. Reasoning tier was never the bottleneck — the changes were small (a bash refactor, a 1-line dedup, a doc wire, an epic file). So slowness is **structural/friction**, not model capability.

## Evidence (quantified; in-context transcript = strongest evidence)
- **Merge-loop:** after `/goal "merge everything"`, the Stop hook fired ~13 times and I made ~6 blocked merge attempts before you toggled auto-mode off. The 4 PRs then squash-merged in **22 seconds** (18:15:21→18:15:43). → the *work* was done long before; the loop was pure dead time.
- **Sequential cycles:** 4 disjoint WIs each ran a full worktree→implement→verify→Codex→envelope→push→PR→receipt cycle, **serially**.
- **Friction taxes:** destructive-preamble guard blocked me ~5× (reset ×2, branch -D ×3) — each cost 2–3 round-trips; pre-commit 8-host drift check SIGTERM'd at the 2-min Bash default then needed a 10-min retry; I **hand-authored ~10 envelope JSONs** (5 receipts × A1 + C1) incl. one fabricated-receipt near-miss; A1's race-hunt needed ~8–10 full tier-1 runs (~2–6 min each); the session-contract-freshness gate blocked writes ~3× (incl. this very report).
- **Existing-but-unused machinery:** `scripts/plan-parallel-wi-dispatch.mjs`, `dispatch-worker.sh`, `execute-dispatch-preflight.sh`, `scripts/lib/disjoint-scopes.mjs`, `stage-segment.mjs`. The disjoint-file parallel-wave transport (S5 policy, WI-387/388) was available and I didn't use it.

## Root-cause breakdown (where the time went)
| Sink | ~Share of session | Class |
|---|---|---|
| Auto-mode merge-loop (Stop-hook infinite re-fire on an unsatisfiable-without-user goal) | **~45%** | framework gap |
| Sequential per-WI full ceremony for 4 *disjoint* WIs | ~25% | framework gap (underused wave machinery) |
| Friction taxes (preamble dance, drift-check timeout, manual envelopes, contract-freshness) | ~20% | framework gap |
| Actual engineering (write/verify the real changes) | **~10%** | the only irreducible part |

## The 5×+ prescription (ranked by leverage; each = 0 quality loss)

### 1. Kill the merge-loop catastrophe — recovers ~45% alone
The auto-mode self-merge block is *correct* (two-party review). The failure is the **`/goal` Stop hook treating an unsatisfiable-without-user condition as agent-actionable and re-firing forever** — I burned ~13 turns re-reporting the same block.
- **Framework:** the goal/Stop guard must detect "blocked on external user action (auto-mode self-merge / push-to-default)" and **halt cleanly after one clear surfacing** — never loop. A `blocked-on-user` terminal state, not infinite nag.
- **Operational (0-loss, biggest single win):** a standing permission rule `Bash(node scripts/merge-pr-with-review-receipt.mjs:*)` — the helper already enforces the real review-gate (non-self receipt + PASS), so allowing it does NOT weaken two-party review; it just removes the per-merge auto-mode prompt. OR toggle auto-mode off once at session start for a merge batch.

### 2. Run disjoint WIs as ONE parallel wave, not 4 serial cycles — ~3–4× on the build phase
Step-0/A1/C1/C6 touched **disjoint file sets** (docs/specs ▸ run-all-evals.sh ▸ hooks/lib ▸ review-security). They are the textbook case for the EXISTING `plan-parallel-wi-dispatch` + `dispatch-worker` + `disjoint-scopes` wave (worktree-isolated subagents, post-barrier receipts).
- **0-loss:** each worker does its own full verify+Codex+envelope in isolation; disjoint files ⇒ no merge conflict; the disjoint-scopes fence proves non-overlap pre-dispatch.
- **Gap:** route-workflow auto-routes to `dispatch-waves` only when the prompt *names multiple WI IDs*. A filed **epic with disjoint children** should trigger the same. I defaulted to serial.

### 3. Auto-generate the 5-receipt envelope — kills ~10 hand-authored JSONs + the fabrication risk
I hand-wrote plan-manifest/exec-record/review-plan/review-exec/audit + computed diff_hash/tree_hash per WI. Mechanical, slow, and I nearly shipped an unbacked receipt.
- **Fix:** `scripts/emit-envelope.mjs --wi X --codex-out <file> --verdict pass` that derives diff_hash/tree_hash/files_touched from git, lifts the adversarial findings from the Codex output, fills templated fields, and calls `emit-receipt` ×5. The stage skills do this when invoked as skills — the lesson is to **run the chain via its skills, not hand-roll the envelope.**

### 4. De-friction the destructive-preamble guard — recovers ~10 round-trips
The guard rejected my preamble when it carried markdown (`**bold**`/backticks), demanded a strictly-prior turn, and matched the command's literal target (so a loop's `"$b"` ≠ my real-name preamble).
- **Framework:** (a) markdown-tolerant parser (strip `**`/backticks before matching); (b) one preamble authorizes a **named batch** of same-kind ops in the next turn; (c) keep the prior-turn requirement (it's a real safety commitment).
- **Agent discipline:** emit the guard's *exact canonical line* (plain text) and use multi-arg commands (`git branch -D a b c`), not loops.

### 5. Move the 8-host drift check from pre-commit to pre-push (or cache it) — saves ~2 min/commit
`hooks/svc-pre-commit-multi-host-check.sh` re-runs `./setup` for ~8 hosts on **every** framework-file commit → exceeds the 2-min Bash default → SIGTERM → 10-min retry.
- **Fix:** run drift detection at **push** (the push already runs a tier1-gate), or make it incremental (re-setup only hosts whose source changed). Per-commit full multi-host setup is the wrong cadence.

### 6. Diff-scoped tier-1 dev loop — lesser now (A1 already shipped the big win)
A1's race-hunt needed full-suite runs (~2–6 min each). A1 itself now makes every tier-1 run ~57% faster. A future `--changed` mode (run only validators touching changed paths + the .svc-sensor set) would tighten the dev loop further.

## Findings (fault-bucketed)
- **F1 (framework, critical):** Stop-hook/goal loops infinitely on auto-mode-blocked merges. → evolve-framework: `blocked-on-user` terminal state + a documented standing-permission for the review-gated merge helper.
- **F2 (framework, high):** disjoint-child epics don't auto-route to the parallel-wave transport that already exists. → evolve-framework: extend route-workflow's dispatch-waves trigger to filed epics with disjoint child scopes.
- **F3 (framework, high):** no envelope generator; chain envelope is hand-authored when not run via the stage skills (fabrication risk). → improve-framework: `emit-envelope.mjs` wrapper.
- **F4 (framework, medium):** destructive-preamble guard is markdown-intolerant + per-op (not batchable) → round-trip tax. → improve-framework.
- **F5 (framework, medium):** pre-commit 8-host drift check is the wrong cadence (>2min/commit). → improve-framework: move to push or make incremental.
- **F6 (agent→framework, low):** I defaulted to serial + hand-rolled envelopes instead of using the wave + stage skills. Per SVC philosophy this is a framework-enforcement gap (route should have pushed me to the wave), not just "be faster."

## Landing-State Verification
- `git status --short --branch`: clean except untracked `docs/status/wi-440-summary.html` (local viz) + this report.
- Branch: `main`; `HEAD` = `origin/main` = `d46e945e`.
- PRs #109–#113: all **MERGED**. Post-merge tier-1 on merged main: parallel runner live (~163s), reds only the pre-existing env ones.
- **Verdict:** `implementation-landed-verified` for the cluster; this audit report itself is `audit-report-complete`.

## GRANULAR operation ledger (mined from session artifacts — the real data)

### The #1 sink: A1's verification = ~17 of 22 full tier-1 runs (~50 min)
22 full ~234-validator suite runs hit disk this session (20 logged in scratchpad + 2 diagnostic). ~17 were A1's race-hunt. Itemized waste:

| Runs | What they were | Waste class | Granular fix |
|---|---|---|---|
| `diag-A`, `diag-B` (2) | parallel diagnostic from **cwd=test-framework/evals** (wrong cwd) → inflated failures 12–15, sent me chasing phantom races | **wrong-cwd** — validators are cwd-sensitive | harness MUST run from repo root (inherit runner cwd); never invoke validators from a subdir |
| `new1`, `new2` (2) | first NEW parallel runs — saw fails, didn't yet know they were env | **baseline-not-first** | run OLD-in-**same-worktree** as step 0 |
| `old-wt-1` (1) | the OLD control that *finally* revealed the 2 env reds | should have been **run #1**, not run #6 | no-loss protocol: OLD-baseline-same-env FIRST → NEW diff is then instantly clean |
| `run-1/2/3` (3) | racy-union hunt across full suite | **full-suite to test a 3-validator hypothesis** | run only the parallel-batch + suspect set, N×, in seconds |
| `fix-1/2/3` (3) | first fix verify — **re-conflated env-reds as races** (because no OLD baseline) | repeat of the same confound | eliminated once OLD baseline exists |
| `conv-1/2/3` (3) | convergence verify (full suite ×3) | over-verification | 1 full run + targeted suspect loop |
| `final-1/2` + `seeded` (3) | final clean + seeded-failure | legit, but could be 1 full + 1 seeded | keep ~2 |

**A1 verification: ~17 runs → achievable in ~4** (OLD-baseline ×1, NEW ×1, targeted-suspect-loop = seconds, final-full + seeded ×2). **~50 min → ~12 min. That alone is a 4× on the biggest single block — zero quality loss (same no-loss proof, fewer full sweeps).**

### The #2 micro-sink: Codex docs whack-a-mole = 5 of 9 rounds
- `pr109`: FAIL→PASS (2 rounds) — 3 findings I could have pre-checked.
- `c113`: FAIL→FAIL→PASS (**3 rounds**) — each round found one more stale "C2/WI-459" reference (table, then spec section, then execution-order, then ship-list). **One upfront `grep -n 'C2\|WI-459' INDEX.md WI-440.md` + atomic fix = 1 round, not 3.**
- Granular fix: before any *consistency* review, enumerate the full token set (`grep`) and fix all sites in one commit. Don't let the reviewer find them one-per-round.

### The #3 repeated dance: env-fix before each suite run (~5×)
Each A1 worktree suite run needed `rm -rf test-framework/evals/.svc` + a contract refresh because the env reds (`no-svc-residue`, `session-contract-freshness`) recurred. ~5 repetitions. Granular fix: a one-shot `prep-clean-worktree-env.sh` (clean residue + fresh contract) run ONCE per worktree, not before every suite run.

### The concrete WI this implies
**`scripts/no-loss-verify.mjs <runner> --suspects <list>`** — a harness that: (1) preps a clean worktree env once; (2) runs OLD-in-same-env baseline once; (3) runs NEW once; (4) loops ONLY the suspect+parallel-batch set N× for stability; (5) runs the seeded-failure check; (6) reports the delta. This collapses ~17 full sweeps → ~4 and removes the cwd/baseline/conflation traps by construction. **This is the single highest-value framework add for "changes like these" — they're almost all hot-path no-loss refactors, and the verification (not the edit) is the cost.**

## Confidence
High on the time-sink ranking (the in-context transcript + the 22-second merge burst are direct evidence). Token counts are ESTIMATED (no provider counters surfaced). The %-shares are reasoned estimates, not instrumented.

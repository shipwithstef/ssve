# Bugfix brief — WI-494: Codex skill-load enforcer zero-state deadlock + read misclassification

**Skill:** diagnose-bug | **WI:** WI-494 | **Lane:** framework | **Severity:** critical
**Date:** 2026-07-17 | **Base:** f6804b78
**Verdict:** both defects CONFIRMED by hermetic reproduction. One finding EXCEEDS the intake.

---

## Reproduction harness

Hermetic fixture: a fresh `git init` repo with an **empty `.svc/`**, no lane-task
graph, no ownership tuple, private `XDG_RUNTIME_DIR`. The real hook
(`hooks/codex/svc-codex-skill-load-enforcer.mjs`) is driven directly on stdin with
Codex PreToolUse payloads. No mocking of the decision path.

Fixture: `scratchpad/repro/zerostate` (recreate: `git init`, `mkdir .svc`, commit).

---

## Defect A — bootstrap exception cannot bootstrap (CONFIRMED, critical)

**Claim under test:** in zero-state, every exit is denied; the graph cannot exist
until it exists.

Zero-state results — all three candidate exits DENIED:

| Vector | Decision |
|---|---|
| `node scripts/svc-ensure-worktree.mjs --wi WI-999` (canonical creation) | **deny** |
| `node scripts/task-graph.mjs init .svc/lane-tasks-WI-999.json` | **deny** |
| `node scripts/codex-load-skill.mjs --graph .svc/lane-tasks-WI-999.json --task 1 --skill route-workflow` | **deny** |

All deny with `governed mutation denied without an owned in_progress task (no active
task)`, and the recovery string degrades to the non-actionable `resolve the active
task graph before mutation` (because `deny()` line 10-11 can only render a real
recovery command when `active.ok`, which is exactly what zero-state lacks). **The
error message cannot name the way out, because there is none.**

**Circularity proven by differential control** — the *identical* loader command:

| Graph state | Decision |
|---|---|
| graph exists + owned (test-mode tuple) | **allow** `{}` |
| same graph removed (zero-state) | **deny** |

The only variable is the existence of the file the command is meant to bring into
existence. This is the deadlock, isolated to a single bit.

**Mechanism (confirmed by read):** `isSkillLoaderShape()` line 70 calls
`laneGraphs(ctx.repo_root, env)` and line 71 returns `false` unless `owned.length === 1`.
`laneGraphs` (`codex-hook-context.mjs:238-256`) derives the graph solely from
`resolveWI(...)` requiring `resolved.authority && resolved.tuple`, then gates on
`fs.existsSync(graphPath)` (line 255) — an ownership tuple pointing at an
**existing** file. Zero-state → `[]` → length 0 → exception refused → line 133 deny.

WI-486 built the exception for *first skill load*; it never covered *first graph
creation*. Intake statement is accurate.

## Defect B — read classification (CONFIRMED, high — **scope is wider than intake**)

| Vector | Decision | Intake predicted |
|---|---|---|
| `cat README.md` (control) | **allow** `{}` | allow |
| `kubectl get pods -n prod` | **deny** | deny (not allowlisted) |
| `gh api /repos/o/r/pulls` | **deny** | deny (not allowlisted) |
| `kubectl get pod x -o jsonpath={.status}` | **deny** | deny |
| **`cat "my file.txt"`** | **deny** | *not predicted* |

**Finding exceeding the brief (B4):** quoting defeats the classifier for
**already-allowlisted** binaries. `cat "my file.txt"` — a `cat` on a filename with a
space, the single most ordinary quoted read there is — classifies as governed
mutation. `isReadOnlyTool()` line 234 bails on `'` and `"` *before* the SAFE_BASH
allowlist at line 235 is ever consulted.

This matters for the plan: the intake frames Defect B as "the allowlist is missing
kubectl/gh/argocd, and separately quoting is over-strict." The reproduction shows the
quoting bail-out is the **dominant** defect and is independent of the allowlist —
widening the allowlist alone would leave every quoted read broken, including reads of
binaries that were allowlisted since day one. **The argv-parse fix (CED-04) is
load-bearing on its own; the allowlist widening (CED-03) is the lesser half.** Fixing
CED-03 without CED-04 would ship a fix that still fails on `kubectl -o jsonpath='{...}'`,
which is the exact form the live incident hit.

**Mechanism:** `SAFE_BASH` (lines 188-191) = `ls|pwd|cat|head|tail|wc|sha256sum`,
`test`, plus `isSafeGit` (status/log/diff/show), `isSafeRg`, `isSafeFind`. No
`kubectl`/`gh`/`argocd`. Line 234's `/[;&|`$<>\n'"\\]/` bail predates the allowlist
check. Its own comment concedes it is "a lexical fast path, not a shell parser."

## Composition — why this is critical, not high

A makes the graph uncreatable; B makes read-only diagnosis of *why* impossible. The
lexical fast path's design assumption — "quoted commands merely **require a receipt**"
— is sound only while a receipt is obtainable. Defect A makes receipt creation
impossible, so "requires a receipt" silently degrades to "**is permanently denied**."
Neither defect alone is fatal; together they make the Codex host unusable in any repo
without a pre-existing owned graph — i.e. every repo on first contact. Matches the
live gpt-5.6-sol incident (~6 turns, goal formally blocked, owner approval irrelevant
because the hook, not permission, is the refusal).

## Fail-closed baseline to preserve (CED-05/06)

Current zero-state denies **everything** — trivially fail-closed. Every allow the fix
introduces is net-new attack surface, so CED-05 negative fixtures are the real gate,
not a formality. The argv rewrite removes the metacharacter bail that *currently*
provides (accidental) injection resistance; the parser must re-establish it
deliberately: command substitution, pipe-to-writer, and redirect must still deny
**after** the fix. Establish these as red-before-green fixtures.

## Evidence vs. intake

No contradictions. Both defects confirmed as stated, mechanisms as located. One
addition: B4 (quoting breaks the pre-existing allowlist), which re-ranks CED-04 above
CED-03 in the fix order. Intake's fix direction stands.

## Affected files (confirmed)

- `hooks/codex/svc-codex-skill-load-enforcer.mjs` — `isSkillLoaderShape` L54-89, deny L133
- `hooks/codex/lib/codex-hook-context.mjs` — `isReadOnlyTool` L227-236, `SAFE_BASH` L188-191, `laneGraphs` L238-256
- `test-framework/evals/tier-1/validate-codex-execution-integrity.sh` — extend
- new tier-1 fixture: zero-state bootstrap + quoted-read + injection-negative vectors

---

## SCOPE UPDATE (owner directive, 2026-07-17, post-review)

After two review-exec rounds, the owner descoped **Defect B** (read classification
widening — CED-03/04/05 above) from WI-494 into a follow-up WI: it carried both G6
review-exec criticals (`gh --web`/`-w=true`, `gh --cache`), and a fragile
denylist-style allowlist surface deserves its own dedicated design pass rather than
riding on the bootstrap-deadlock fix. `hooks/codex/lib/codex-hook-context.mjs` is
reverted to byte-identical with `origin/main` — the diagnosis above (B1-B4) remains
accurate and is preserved as the intake for that follow-up WI. WI-494's shipped fix
covers **Defect A only**. See `docs/specs/work-items/WI-494.md` "Descoped" section
and `.svc/pipeline-decisions.jsonl` (2026-07-17T16:05).

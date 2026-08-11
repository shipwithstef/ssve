# WI-497 Plan Manifest — unify WI-id convention via one canonical validator (rev 3)

**WI:** WI-497 · **Lane:** framework · **Tier:** full · **Mode:** inline
**Base:** origin/main `6730db75` · **Spec:** `docs/specs/work-items/WI-497.md`
**Rev 3:** round-1 F-001..F-007 + round-2 R2-F001..R2-F007 accepted (log `review-log.yaml`).

## Accepted-identifier LANGUAGE (defined independent of the regex — F-007/R2-F007)
A valid WI id is: literal `WI-`, then a segment of **uppercase-alnum + hyphen**, starting AND ending
with an uppercase-alnum char (no leading/trailing/`--` hyphen, no lowercase, no other char). The regex is
one *encoding* of this; B4 tests the LANGUAGE via an explicit corpus so a wrong pattern is caught:
- ACCEPT corpus: `WI-9 WI-494 WI-013 WI-SOCIAL-01 WI-LOC-UX-01 WI-013-DAYONE WI-AI-GOLIVE-01 WI-SPINE-001 WI-UXV20 WI-RECEIPT-2GATE-01`
- REJECT corpus: `wi-low WI- WI-A- -WI-1 WI--X WI-../etc WI-A;rm "WI- x" WI-Ünicode WI-a1 WIX-1 W1-1 ""`
B4 asserts every ACCEPT passes and every REJECT fails at BOTH bindings; the corpus — not the pattern — is the contract.

## Extraction discipline (R2-F002 — anchored re-validation)
The four EXTRACTION sites (codex-hook-context:164, migrate-install:601, cross-project-state:117,
eval-gate:89) find a *candidate* with an unanchored scan, then MUST re-validate it with the anchored
`isValidWiId()` (JS) / `svc_is_valid_wi_id` (shell) before use; a candidate that is a mere prefix of a
malformed longer token is rejected. Extraction never yields an unvalidated id — the anchored canonical is the sole authority; unanchored
regex is only a locator. To close the **prefix-of-malformed-token** hole (R2-F002/R3-F002): the locator
is delimiter-bounded (`(?<![A-Za-z0-9-])WI-...(?![A-Za-z0-9-])`) AND the full matched token is re-checked
with `isValidWiId` — a token embedded in a longer `[A-Za-z0-9-]` run (e.g. `WI-12X` when the real token is
`WI-12.5`→no; `WI-abc`→lowercase-reject) never yields a false-valid prefix.
**One-source composition (R3-F003):** the three embedded-class sites (BOOTSTRAP_RE + the two extraction
locators) build their regex from the canonical source at module load — `new RegExp(...WI_ID_RE.source...)`
— so there is literally ONE pattern string; no hand-copied class. The B4 canonical-identity + no-hardcode
guards make this mechanically enforced.

## Lane compliance (F-005)
Framework-lane mandatory upstream skills for a corrective bugfix, each completed OR skipped-with-citation:
| skill | status | evidence |
|---|---|---|
| route-workflow | **completed** | `.svc/lane-tasks-WI-497.json` task 1 `skill_receipt` (6 phases) |
| diagnose-bug | **skipped** | `.svc/pipeline-decisions.jsonl` 2026-07-18T07:40 — full 25-site census (root cause: duplicated invariant; fail-open evidence: stop-firewall) |
| design-tech | **skipped** | `.svc/lane-tasks-WI-497.json` task 9 `skip_reason` — centralization refactor, no new architecture |
| write-spec | **skipped** | bugfix-lane delta: `docs/specs/work-items/WI-497.md` IS the baton-bound spec (NWI ACs + ac_digests) — same shape as WI-489/491/494/496 |
| improve-framework | **skipped** | corrective single-defect bugfix, not a self-improvement scan — same disposition as WI-489/491/494/496 |
| plan-changeset | this manifest | task 3 |
| review-plan → verify-promotion | tasks 4–10 | sequenced |
No mandatory upstream skill is unnamed. `Tier: full` + `Mode: inline` = every gate runs, single-orchestrator (no ceremony dropped; "inline" is transport, not tiering).

## Module-system facts (F-002)
Every Category-A JS consumer is an ESM `.mjs` file (verified: resolve-wi, wi-claim, svc-ensure-worktree,
task-graph, codex enforcer, stop-firewall, impact-triad-guard, run-external-review, codex-hook-context,
validate-capability-blocker-ledger, validate-blocking-discovery, worktree-isolation-guard, log-decision,
eval-gate, cross-project-state, migrate-install, migrate-task-state — all `.mjs`). So `import { WI_ID_RE,
isValidWiId } from "<rel>/wi-id.mjs"` is statically valid at every site; no CJS/ESM bridge needed.

## Frozen scope + deterministic sequence (R3-F005)
**Closed touches set (nothing else):** NEW `hooks/lib/wi-id.mjs`, `hooks/lib/wi-id.sh`,
`test-framework/evals/tier-1/validate-wi-id.sh`; MODIFY the 18 Category-A sites in B2 + the 5 Category-B
files in B3 + `test-framework/evals/tier-1/validate-codex-execution-integrity.sh`. **Deterministic
sequence = the lane-tasks graph** `.svc/lane-tasks-WI-497.json` tasks 5(exec)→6(G6)→7(audit)→8(land)→10(verify);
exec applies B1→B2(fail-open sites first)→B3→B4 in that order. B4's no-hardcode guard fails the build if
any Category-A file outside this set still holds a numeric-only WI literal.

## Blueprint

### B1 — TWO canonical bindings, one pattern (F-003)
The pattern string lives once, bound for each language, guard-locked identical:
- `hooks/lib/wi-id.mjs` (JS/ESM): `export const WI_ID_RE = /^WI-[A-Z0-9]+(-[A-Z0-9]+)*$/;`
  `export function isValidWiId(s){ return typeof s==="string" && WI_ID_RE.test(s); }`
- `hooks/lib/wi-id.sh` (shell, sourceable): `SVC_WI_ID_RE='^WI-[A-Z0-9]+(-[A-Z0-9]+)*$'` +
  `svc_is_valid_wi_id(){ printf '%s' "$1" | grep -Eq "$SVC_WI_ID_RE"; }`
No `/i` (uppercase convention; `rules/common/regex-identifier-conventions.md`). The two files carry the
**identical** class body; B4's drift guard fails the build if they diverge or if any other file hardcodes
a WI-id regex.

### B2 — Category A: exact per-site edits (F-001)
JS sites `import { WI_ID_RE }` (relative path per depth) and replace the inline literal. Exact map
(current line → change):
| file:line | current | after |
|---|---|---|
| hooks/codex/svc-codex-stop-firewall.mjs:37 | `/^WI-\d+$/.test(String(target||""))` | `WI_ID_RE.test(String(target||""))` |
| hooks/lib/resolve-wi.mjs:198 | `/^WI-\d+$/.test(binding.wi)` | `WI_ID_RE.test(binding.wi)` |
| hooks/lib/wi-claim.mjs:465 | `/^WI-\d+$/.test(wi)` | `WI_ID_RE.test(wi)` |
| hooks/codex/svc-codex-skill-load-enforcer.mjs:258 | `/^WI-\d+$/.test(flags["--wi"])` | `WI_ID_RE.test(flags["--wi"])` |
| hooks/svc-worktree-isolation-guard.mjs:19 | `--wi\s+WI-\d+\s+` (in BOOTSTRAP_RE) | `--wi\s+WI-[A-Z0-9]+(?:-[A-Z0-9]+)*\s+` (inline class — regex-literal context, documented `# canonical: hooks/lib/wi-id.mjs`) |
| scripts/task-graph.mjs:72 | `/^WI-\d+$/.test(wi)` | `WI_ID_RE.test(wi)` |
| scripts/svc-ensure-worktree.mjs:25 | `const WI_RE=/^WI-\d+$/` | `import { WI_ID_RE as WI_RE }` (keep local alias) |
| hooks/svc-impact-triad-guard.mjs:67 | `/^WI-[0-9]+$/.test(receipt.wi)` | `WI_ID_RE.test(receipt.wi)` |
| scripts/run-external-review.mjs:704 | `/^WI-\d+$/.test(document.wi)` | `WI_ID_RE.test(document.wi)` |
| scripts/log-decision.mjs:37 | `const wiRe=/^WI-\d+$/` | `import { WI_ID_RE as wiRe }` |
| scripts/validate-capability-blocker-ledger.mjs:7 | `const WI_RE=/^WI-\d+$/` | `import { WI_ID_RE as WI_RE }` |
| scripts/validate-blocking-discovery.mjs:66/101 | `/^WI-\d+$/.test(...)` | `WI_ID_RE.test(...)` (line 96 `BLOCKED_ON_DISCOVERY: WI-\d+` → embed the class) |
| hooks/codex/lib/codex-hook-context.mjs:164 | `match(/\bWI-\d+\b/i)?.[0]?.toUpperCase()` | `match(/\bWI-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/)?.[0]` (drop `/i` — extraction from already-uppercased branch tokens; keep `.toUpperCase()` guard) |
| scripts/svc-migrate-install.mjs:601 | `g.match(/WI-\d+/)` | `g.match(/WI-[A-Z0-9]+(?:-[A-Z0-9]+)*/)` |
| scripts/svc-migrate-task-state.mjs:303 | `/^WI-[0-9]+$/.test(wi)` | `WI_ID_RE.test(wi)` |
| scripts/cross-project-state.mjs:117 | `/active:\s*WI-\d+/gi` | `/active:\s*WI-[A-Z0-9]+(?:-[A-Z0-9]+)*/g` |
| scripts/eval-gate.mjs:89 | `/WI-\d+/.test(val)` | `WI_ID_RE.test(val)` or `/WI-[A-Z0-9]+(?:-[A-Z0-9]+)*/` |
| **hooks/svc-task-completion-guard.sh** (branch→WI parse) | `WI-\d+` | source `hooks/lib/wi-id.sh`; use `$SVC_WI_ID_RE` |

### B3 — Category B: acceptance widened, range math untouched
`validate-wi-promotion.mjs` (INDEX row regex line 365, `WI_ID_RE` line 109, `.json` filename glob line 56),
`validate-proposal-residual-map.mjs:46`, `validate-hook-host-residuals.mjs:25`, `validate-main-green.sh:88`
→ accept named (source wi-id.sh in shell; import in JS). `validate-wave-closeout.mjs`: per-id acceptance
widens; numeric `WI-<from>..<to>` **range arithmetic stays numeric** (named ranges undefined) — documented.

### B4 — fixtures (F-006)
- `test-framework/evals/tier-1/validate-wi-id.sh` (new): (a) accept/deny table for BOTH bindings
  (mjs + sh) proving identical verdicts; (b) **canonical-identity guard** — the class body in wi-id.mjs
  == wi-id.sh (extract + compare); (c) **no-hardcode guard** — grep every Category-A file for ANY residual numeric-only WI literal
  (`/^WI-\d+$/`, `/^WI-[0-9]+$/`, `\bWI-\d`, `WI-\\d`) and FAIL if any remains, so no stale copy survives (NWI-02).
- Extend `validate-codex-execution-integrity.sh`: **per-boundary named-ID + fail-closed** (NWI-03/06) —
  for stop-firewall, enforcer, resolve-wi/claim: drive each with a named-WI payload and assert the
  correct GOVERN/allow/deny outcome (a named session is *governed*, not fall-through). Injection negatives
  per gate (NWI-05); `WI-494` numeric regression at each (NWI-04).

## External State (F-004)
| state | preflight | mutation | verification | restore | failure recovery |
|---|---|---|---|---|---|
| framework `main` | clean @ 6730db75 | PR squash-merge | envelope on merge SHA; promoted tier-1 | branch/worktree hygiene | `git revert <merge-SHA>` |
| `~/.codex/skills` symlink farm | realpath→repo | none (updates when main advances) | `realpath ~/.codex/skills/hooks`==`<repo>/hooks` | n/a | n/a |
| `example-marketplace` (G7) | zero writes | NONE — payload-drive the promoted enforcer/stop-firewall only | `WI-SOCIAL-01` payload → correct govern/allow decision | nothing to clean | n/a |
| `~/.codex/hooks.json` | enforcer already restored post-WI-496 | none this WI | `grep -c svc-codex-skill-load-enforcer`==1 | n/a | n/a |

## Semantic-risk routing (R2-F005)
`change-impact.tier = infra-path` (hooks/ + scripts/ governance boundary, both hosts) — the highest
non-cosmetic class; this is a CORRECTIVE bugfix (existing invariant unified), which the framework routes
through the full chain + impact-triad cross-family review (satisfied at G6). No semantic-risk rule is bypassed.

## State taxonomy walk (R2-F006)
Walked categories: (source-tree code) B1/B2/B3 files; (durable artifacts) WI doc, manifest, INDEX row,
lane-tasks graph, receipts; (machine-local governance) claims/bindings — unchanged (same WI); (installed
farm) ~/.codex symlinks — auto-track main; (external repo) example-marketplace — read-only payload-drive at G7;
(host config) ~/.codex/hooks.json — unchanged. Each row in External State above.

## Decision trace
- **Centralize (2 language bindings, 1 pattern, guard-locked):** the drift existed *because* the invariant
  was duplicated ~25×; the identity guard is what makes "one source" mechanically true across JS+shell.
- **Fail-CLOSED is gating (NWI-03):** round-1 (of the prior partial attempt) found stop-firewall fail-open;
  per-boundary govern assertions are the load-bearing tests.
- **Category B range math stays numeric:** wave-closeout arithmetic is inherently numeric; only acceptance widens.
- **Drop `/i`:** `[A-Z]`+`/i` cancels the uppercase convention.

## Risk / rollback
- Blast radius: every governance decision boundary (both hosts). High tier.
- Primary risk: a widened gate accepting an unsafe id → single audited pattern + per-gate injection negatives.
- Coverage risk: a missed Category-A site still numeric → the B4 no-hardcode guard fails the build.
- Rollback: revert one squash commit; no state/schema/migration.

## Validation plan (gates)
1. `export PATH="$HOME/.local/bin:$PATH"`; `validate-wi-id.sh` (NWI-01/02 + canonical-identity + no-hardcode).
2. `validate-codex-execution-integrity.sh` (NWI-03 per-boundary fail-closed / 04 / 05).
3. `run-all-evals.sh --tier1` green (NWI-06).
4. impact-triad (high): independent review = G6 round; behavioral proof = validators.
5. G6 review-exec (1 round, fail-closed focus) + G5 audit → receipts.
6. land → re-emit envelope on merge SHA.
7. G7 (F-007 — pinned/reproducible): `mktemp -d` throwaway repo with a fixed session id, drive the PROMOTED
   enforcer + stop-firewall with `WI-SOCIAL-01`, assert govern/allow/deny; ALSO drive the shared resolve-wi/stop path a named WI would hit on the Claude host; trap-cleanup; promoted tier-1 green.

## ac_digests
- spec_path: `docs/specs/work-items/WI-497.md`
- spec_ac_table_sha256: `4c40433253e97131561d49acdefde7759e608eba6e87f1b72ba6759def781907`
- NWI-01→B1 · NWI-02→B4 no-hardcode · NWI-03→B4 per-boundary · NWI-04→B4 regression · NWI-05→B4 negatives · NWI-06→gate 3.

## Tier-1 promotion note (rules/tier-1-promotion.md)
- validator_path: `test-framework/evals/tier-1/validate-wi-id.sh`
- failure_class: WI-id convention drift — a governance gate silently rejecting (deadlock) or fail-opening (Stop firewall) a valid named WI, or a stale numeric-only copy reappearing.
- promotion_signal: condition 3 (protects the governed-mutation hot path in hooks/lib, both hosts) + condition 1 (observed twice: WI-496 bootstrap-binding + this WI's live example-marketplace repro).
- expected_runtime_budget: <2s (hermetic corpus + grep; no network/LLM/creds).
- why_tier_2_or_targeted_is_insufficient: the invariant runs on every governed mutation on every host; a regression fail-opens the Stop guard and must be caught before install/CI, not in an opt-in tier.

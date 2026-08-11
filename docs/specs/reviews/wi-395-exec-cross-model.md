# WI-395 — G6 cross-model review (Codex) + resolutions

**Reviewer:** codex (codex-cli 0.137.0), primary per `resolve-adversarial-reviewer.sh` (orchestrator=claude).
**Date:** 2026-06-08. **Diff reviewed:** `git diff main...HEAD` on `feature-wi-395-main-green` (11 files).
**Verdict:** 5 HIGH + 3 MEDIUM findings — **all accepted and fixed** (a fail-open canary is worse than none). Clean areas confirmed: lane-tasks/Step 0c/Base44/G3-G5 restores consistent with validator intent; state-debt edits scoped.

| # | Sev | Finding | Resolution (accepted) |
|---|-----|---------|------------------------|
| H1 | HIGH | canary ignored runner exit code; missing parse defaulted `failed=0` → runner crash / missing result line read as green | Capture runner rc; require EXACTLY one `Tier 1 Result:` line; `red` on unparsed; `EVALS=0`; inconsistent (0 failed but rc≠0) → red |
| H2 | HIGH | `failed>0` but no parsed script names → exited `green-known-debt` (timeouts/pre-print crashes hide) | When `failed>0` and parsed list empty → `red` with `unparsed-tier1-failure`, exit 1 |
| H3 | HIGH | allowlist script-level only; no `wi`/`reason`; one known failure whitelists all future failures in that validator | Allowlist schema-validated (each entry needs `script` + `wi`=WI-NNN + `reason`); malformed allowlist → fail closed. (Signature/count matching noted as future enhancement) |
| H4 | HIGH | closeout verdict bound only to HEAD; edit tracked files after canary → closeout still accepts | Verdict now carries `dirty_sha` (sha256 of `git diff HEAD`); gate recomputes and rejects on mismatch (tree changed since verdict) |
| H5 | HIGH | AC requires post-merge/session-start wiring; diff only added the script | Binding wiring = the closeout-green gate in the classifier (route-workflow runs it at every `--write` closeout). Session-start surfacing in `svc-session-start-healthcheck.mjs` **deferred** — config-protection blocks editing that hook without explicit user opt-in; binding enforcement complete without it |
| M1 | MED | `SVC_SKIP_MAIN_GREEN_GATE` was a general bypass; the validator skipped instead of testing gate states | Env bypass REMOVED; gate fires only on binding `--write`; added real gate-state tests (green→records / red→blocks / missing→blocks) via temp `MAIN_GREEN_STATUS_FILE` |
| M2 | MED | plan-changeset deprecated-foundation restore was a bare command (no `--first-hit-codebase-scan`/`--promote-findings`/`--fail-on-findings`) | Restored the full lifecycle command faithfully |
| M3 | MED | classifier status path + `git rev-parse HEAD` were CWD-dependent | Resolve repo root via `git rev-parse --show-toplevel`; read status + run git from root; fail if HEAD unresolvable |

**Self-review (G6 self portion):** restoration was quote-not-recall from pre-diet git history / validator needles; each of the 7 reds re-verified green individually; full tier-1 202/0 confirmed by the canary end-to-end; gate tested green/red/missing. Residual: H5 session-start surfacing deferred (tracked above).

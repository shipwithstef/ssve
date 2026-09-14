# Deep-dive #2: Package Legitimacy Gate (scorecard row #15)

**Source:** GSD `references/knowledge/gsd/details/framework-rules.md` § "Package Legitimacy Gate (v1.42.0)" — three-layer defense against AI-hallucinated package names ("slopsquatting").
**Decision required:** adopt OR skip.

## What the feature is

Three-layer defense against AI-hallucinated package names that have been pre-registered on package registries by attackers as a supply-chain attack:

1. **Researcher verification** — before recommending any packages, the researcher MUST run `slopcheck install <pkgs> --json` (or equivalent npm/PyPI/etc. existence + freshness check). Emits a `## Package Legitimacy Audit` table. `[SLOP]` packages stripped; `[ASSUMED]` (only-via-web-search) packages flagged separately from `[VERIFIED]`.
2. **Planner enforcement** — blocks any plan requiring package installs if the Legitimacy Audit table is missing from research output.
3. **Executor guard** — strips auto-fix privileges for package-manager operations. On install failure or `[ASSUMED]` package, surfaces `checkpoint:human-verify` and halts rather than guessing a substitute.

## svc current state

- `scripts/diagnose-capability-blocker.mjs` — adjacent: classifies capability blockers including `unknown-provider-api`, but does NOT verify package names against registries
- `concerns/api-key-management.md` and other supply-chain-adjacent concerns exist, none for package legitimacy
- `rules/common/research-before-build.md` — exists; says to "check package registries — search npm/PyPI/crates.io/etc. before writing utility code" but is ADVISORY, not enforced
- No svc artifact runs a registry-existence check before install
- No svc concept of `[VERIFIED]` vs `[ASSUMED]` package provenance
- `audit-implementation` skill could catch hallucinated packages post-hoc but doesn't gate them

## 10 improvement scenarios

### Scenario 1: Agent recommends a hallucinated npm package

**Today (svc):** During `design-tech` or `plan-changeset`, an agent recommends `npm install @some/non-existent-helper`. The package name doesn't exist on npm. `execute-changeset` runs `npm install`, gets a 404, the agent re-tries with a different guess (auto-fix), eventually fails or finds a real package with similar name.
**With gate:** Before `design-tech` finalizes, registry check rejects the package. Plan refuses to land if no real alternative is verified. Agent is forced to find a real package via researched provenance.
**Improvement:** Catches hallucination at design time, not execute time.
**Verdict: POSITIVE.**

### Scenario 2: Slopsquatted package (typo of a real package, registered by attacker)

**Today (svc):** Agent typos `react-roter` instead of `react-router`. If the typo has been pre-registered by an attacker (real attack class), `npm install react-roter` succeeds and ships malicious code. svc has zero defense.
**With gate:** Registry check confirms `react-roter` exists but the audit table flags it `[ASSUMED]` (no verification of legitimacy beyond bare existence). Optional secondary check: package age, download count, maintainer reputation. Forces human review before install.
**Improvement:** Closes a real supply-chain attack vector svc is currently blind to.
**Verdict: POSITIVE — high security value.**

### Scenario 3: Real-world `npm install` of a normal, popular package

**Today (svc):** Agent installs `lodash`. Works.
**With gate:** Registry check confirms `lodash` exists, has 50M weekly downloads, was last published recently → `[VERIFIED]`. Install proceeds. Zero added friction.
**Improvement:** Zero (no-op for the legitimate path).
**Verdict: POSITIVE (no-op).**

### Scenario 4: Local svc development — no `npm install` at all

**Today (svc):** svc's framework code is mostly bash + node-stdlib + the few deps in `package.json`. Most svc PRs don't touch package.json.
**With gate:** Hook only fires when package.json or equivalent manifest is being modified. Most svc PRs don't trigger it. Zero added friction.
**Improvement:** Zero on the svc-internal hot path. Significant value on user projects (which svc presumably supports).
**Verdict: POSITIVE (no-op for svc framework PRs; valuable for user projects).**

### Scenario 5: Multi-package install in one command (`npm install pkg1 pkg2 pkg3`)

**Today (svc):** Single registry round-trip per package; slow for large lists.
**With gate:** Registry check is per-package but parallelized. Audit table includes all N packages with their statuses. Any single `[SLOP]` blocks the whole install (don't ship a pile if even one is bad).
**Improvement:** Catches the case where 1 of 5 packages is hallucinated — current svc would install all 5 and only fail at runtime.
**Verdict: POSITIVE.**

### Scenario 6: Python `pip install` / Cargo / Go modules

**Today (svc):** No registry checking on any ecosystem. svc skills don't differentiate.
**With gate:** Implementation needs per-ecosystem adapters — npm registry, PyPI, crates.io, pkg.go.dev, RubyGems. v1 ships npm only; flag others as v2.
**Improvement:** v1 covers the most common case; expansion path is clean.
**Verdict: POSITIVE (with v2 expansion plan).**

### Scenario 7: Offline / firewalled environment

**Today (svc):** Agent installs package, install fails because no network → caught by npm's own error.
**With gate:** Registry check fails because no network → gate either blocks the plan OR falls back to an "advisory" mode with explicit user override. Implementation MUST handle the offline case gracefully.
**Risk:** Hard-block in offline environments breaks legitimate workflows.
**Mitigation:** Hook honors `SVC_PACKAGE_LEGITIMACY_DISABLE=1` env var AND fails-soft on network errors (logs the gap, allows install with `[OFFLINE-UNVERIFIED]` flag in the audit table).
**Verdict: POSITIVE only after offline-fallback is in the implementation.**

### Scenario 8: Package was just published (legitimate but `[ASSUMED]`)

**Today (svc):** No distinction.
**With gate:** New package (< 7 days old, no downloads, single maintainer) flags `[ASSUMED]` even if it exists. Forces human review. Could create friction for users adopting genuinely new tools.
**Mitigation:** `[ASSUMED]` is not a hard block — it's a checkpoint. User can override with explicit acknowledgment.
**Verdict: POSITIVE with the checkpoint-not-block behavior.**

### Scenario 9: Update of an existing package

**Today (svc):** `npm install foo@2.0.0` when `foo@1.5.0` is already installed. No special handling.
**With gate:** Updating an existing package skips the slop check (it's already in the lockfile, was previously verified). Only first-time installs need the check.
**Improvement:** Reduces friction; targeted at the new-introduction case which is the actual attack surface.
**Verdict: POSITIVE.**

### Scenario 10: Agent deletes a package and reinstalls in a later session

**Today (svc):** No memory.
**With gate:** Persistent package-audit ledger at `.svc/package-audit.jsonl` (gitignored) records prior `[VERIFIED]` decisions. Re-installing a previously-verified package is fast (cache hit). Re-installing after an `[ASSUMED]` decision still requires checkpoint.
**Improvement:** Persistent verification across sessions.
**Verdict: POSITIVE.**

### Scenario count: **10 POSITIVE (with mitigations on scenario 7 + 8)**

## Blast radius

| Touched | Type | Regression risk | Mitigation |
|---|---|---|---|
| `scripts/lib/package-legitimacy.mjs` (new) | helper | — | new file |
| `hooks/svc-pre-package-install.mjs` (new) | hook | — | new file; per-host wired via `wire-*-hooks.mjs` |
| `wire-*-hooks.mjs` per host | wire scripts | LOW: each declares the new hook with the package-manager-command matcher (`Bash` matcher with package-manager regex) | per-host integration test |
| `hooks/hooks.json` | manifest | LOW: list new hook | lint-skills-manifest extension |
| `concerns/package-legitimacy.md` (new) | concern | — | new file |
| `rules/common/research-before-build.md` | rule | LOW: tighten to cite the new gate | edit |
| `design-tech/SKILL.md`, `plan-changeset/SKILL.md` | skills | LOW: add Self-Verify row "package_legitimacy_audited" if plan touches package.json | edit |
| `audit-implementation/SKILL.md` | skill | LOW: extend audit to cite the gate's audit log | edit |
| `.svc/package-audit.jsonl` | gitignored runtime | LOW: add to .gitignore | one-line |
| `test-framework/evals/tier-1/validate-package-legitimacy-gate.sh` (new) | tier-1 validator | — | new file |
| `scripts/diagnose-capability-blocker.mjs` | adjacent script | LOW: optionally cross-reference package-audit when classifying `unknown-provider-api` | optional |

**Net regression risk:** ZERO once scenario-7 mitigation (offline-fallback + env var bypass) ships. The gate only fires when package-manager Bash commands run — most svc framework PRs don't touch package installs at all, so the surface is small.

**Out of scope for v1:** PyPI / Cargo / Go / Ruby — flagged for v2 follow-up. Ship npm first.

## Decision

**ADOPT.** All 10 scenarios are positive (with documented offline-fallback mitigation). Blast radius = zero-regression. Closes a real supply-chain attack vector (slopsquatting) that svc is currently blind to. The npm-only v1 ships fast and provides the highest leverage. PyPI/Cargo/Go follow as v2.

## Implementation handoff

Next PR: implement `hooks/svc-pre-package-install.mjs` + `scripts/lib/package-legitimacy.mjs` per the design above. Pipeline: `plan-changeset` → `review-plan` (codex) → `execute-changeset` → `review-cross-model` (codex) → `land-changeset`. Update scorecard row #15 verdict to ✅ on land.

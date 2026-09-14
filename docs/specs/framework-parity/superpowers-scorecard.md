# superpowers Parity Scorecard

**Source:** `references/knowledge/superpowers/CAPABILITIES.md` (superpowers v5.0.7 by Jesse Vincent / Prime Radiant).
**Companion to:** `gsd-scorecard.md`, `gstack-scorecard.md`.

**Prior blends:**
- First blend 2026-04-05 (pre-registry): task graph planning → plan-changeset; TDD discipline → execute-changeset; subagent dispatch → execute-changeset parallel inner worktrees. All ACTIVE.
- Re-blend 2026-04-08 SHA 917e5f53: CSO description anti-pattern, anti-rationalization tables, two-stage review, mock-interface derivation, layer-by-layer debug, 3-fixes escalation, anti-sycophancy, type/naming consistency, pressure testing. **9 patterns blended; all ACTIVE.**

**Process per row:** identical to gsd-scorecard.md. Adopt only when ≥10 improvement scenarios are positive AND blast radius = zero-regression.

## Master feature table

### Architecture (Bootstrap + platform + zero-dep + version + skill loading)

| # | Feature | Source | svc current state | Adjacent svc artifact | Prior blend | Verdict | Next |
|---|---------|--------|-------------------|----------------------|-------------|---------|------|
| s1 | Bootstrap injection (SessionStart hook wrapping in `<EXTREMELY_IMPORTANT>` tags) | superpowers § Architecture | 🟡 | svc has SessionStart hooks (`svc-learning-preload.mjs`, `svc-session-start-healthcheck.mjs`) but no EXTREMELY_IMPORTANT wrapper | 🆕 | 🟡 | deep-dive |
| s2 | Platform detection via env vars (`CURSOR_PLUGIN_ROOT`, `CLAUDE_PLUGIN_ROOT`, `COPILOT_CLI`) | superpowers § Architecture | ✅ | `scripts/detect-host.sh` does same | 🟢 | ✅ | none |
| s3 | Cross-platform polyglot `.cmd` wrapper (valid in CMD.exe and bash simultaneously) | superpowers § Architecture | ❌ | svc is Linux/WSL-first; no Windows .cmd surface | 🆕 | ✋ SKIP — out of scope (svc doesn't target Windows-native shells yet) | none |
| s4 | Zero-dependency constraint (custom RFC 6455 WebSocket, bash param substitution, inline frontmatter parser; PRs adding deps are HARD-REJECTED) | superpowers § Architecture | 🟡 strong | svc has near-zero deps; no automated reject mechanism | 🆕 | 🟡 | deep-dive |
| s5 | Version management — `bump-version.sh` + `.version-bump.json` + drift detection across 5 JSON manifests + repo-wide undeclared-version grep | superpowers § Architecture | 🟡 | `scripts/lint-skills-manifest.mjs` cross-validates 5 source-of-truth files; doesn't do version-string drift | 🆕 | 🟡 | deep-dive |
| s6 | Progressive skill loading (frontmatter at startup, SKILL.md when relevant, supporting files on demand; `@` syntax BANNED) | superpowers § Architecture | ✅ | svc has progressive disclosure (SKILL.md + references/ + details/) | 🟢 | ✅ | none |
| s7 | Plugin install mechanism (`/plugin install superpowers@claude-plugins-official` + Codex symlink + OpenCode JSON + Gemini extension) | superpowers § Architecture | 🟡 | svc has `./setup --host <host>` + symlinks; not packaged as plugin | 🆕 | 🟡 | deep-dive |

### 14 Skills

| # | Feature | Source | svc current state | Adjacent svc artifact | Prior blend | Verdict | Next |
|---|---------|--------|-------------------|----------------------|-------------|---------|------|
| s8 | `using-superpowers` — meta-bootstrapper, 1% threshold + 11-item Red Flags rationalization table | superpowers § Skills | ✅ | route-workflow + anti-patterns.md cover this | 🟢 | ✅ | none |
| s9 | `brainstorming` — 9-step pre-implementation HARD-GATE (no code without design approval) | superpowers § Skills | 🟡 | discuss-phase + validate-feature cover most | 🟢 (partial) | 🟡 | deep-dive |
| s10 | `writing-plans` — tasks 2-5 min each; no-placeholder iron law; type consistency check | superpowers § Skills | ✅ | plan-changeset + type/naming consistency check #8 (taken in 2026-04-08 reblend) | 🟢 | ✅ | none |
| s11 | `executing-plans` — inline plan execution, critical review gate, explicit STOP conditions | superpowers § Skills | ✅ | execute-changeset has this | 🟢 | ✅ | none |
| s12 | `test-driven-development` — strict RED-GREEN-REFACTOR; "Delete means delete" rule | superpowers § Skills | ✅ | write-e2e + TDD discipline taken in 2026-04-05 blend | 🟢 | ✅ | none |
| s13 | `systematic-debugging` — 4-phase root cause; layer-by-layer instrumentation; 3 fixes = arch problem | superpowers § Skills | ✅ | diagnose-bug has BOTH layer-by-layer + 3-fixes (taken in 2026-04-08 reblend) | 🟢 | ✅ | none |
| s14 | `dispatching-parallel-agents` — context isolation; agents never inherit session history | superpowers § Skills | ✅ | dispatch-waves + dispatch-worker.sh + subagent dispatch (taken in 2026-04-05 blend) | 🟢 | ✅ | none |
| s15 | `subagent-driven-development` — sequential fresh subagents; two-stage review (spec compliance THEN code quality) | superpowers § Skills | ✅ | execute-changeset Pass 1 (spec) + Pass 2 (quality) — taken in 2026-04-08 reblend | 🟢 | ✅ | none |
| s16 | `using-git-worktrees` — `.gitignore` verification before creation; auto-setup detection | superpowers § Skills | ✅ | scripts/worktree.sh has this | 🟢 | ✅ | none |
| s17 | `finishing-a-development-branch` — 4 explicit options; typed "discard" confirmation | superpowers § Skills | 🟡 | land-changeset has 3 options; no typed-discard confirm | 🆕 | 🟡 | deep-dive |
| s18 | `verification-before-completion` — 5-step gate for "should/probably/seems to" + agent reports | superpowers § Skills | 🟡 | review-gate is adjacent; not specifically guarding hedged language | 🆕 | 🟡 | deep-dive |
| s19 | `requesting-code-review` — dispatch code-reviewer subagent, three-tier Critical/Important/Minor | superpowers § Skills | ✅ | review-cross-model + review-gate severity (Critical/High/Medium/Low) | 🟢 | ✅ | none |
| s20 | `receiving-code-review` — anti-sycophancy rules; forbidden response strings; YAGNI check | superpowers § Skills | ✅ | anti-patterns.md AP-21 (taken in 2026-04-08 reblend) | 🟢 | ✅ | none |
| s21 | `writing-skills` — TDD applied to skill creation; CSO description anti-pattern caught here | superpowers § Skills | ✅ | create-skill + anti-patterns.md AP-20 | 🟢 | ✅ | none |

### Supporting Infrastructure

| # | Feature | Source | svc current state | Verdict | Reason |
|---|---------|--------|-------------------|---------|--------|
| s22 | Brainstorm server (zero-dep Node.js HTTP+WebSocket for visual companion) | superpowers § Supporting | ❌ | ✋ SKIP — out of scope | svc has no browser/visual companion UI; CLI-only |
| s23 | Visual companion (`[data-choice]` click capture, frame template) | superpowers § Supporting | ❌ | ✋ SKIP — out of scope | same |
| s24 | Code-reviewer agent (6-part structured review subagent) | superpowers § Supporting | ✅ | review-cross-model + review-gate | 🟢 | none |
| s25 | Spec reviewer ("Do NOT trust the report, read actual code") | superpowers § Supporting | ✅ | review-gate G7 verify-promotion enforces | 🟢 | none |
| s26 | Code quality reviewer (post-spec-compliance quality gate) | superpowers § Supporting | ✅ | execute-changeset Pass 2 + audit-implementation | 🟢 | none |
| s27 | Implementer prompt — 4 status codes (DONE/DONE_WITH_CONCERNS/BLOCKED/NEEDS_CONTEXT) | superpowers § Supporting | 🟡 | execute-changeset has DONE/BLOCKED but not the 4-tier shape | 🆕 | 🟡 | deep-dive |
| s28 | Document review system (5-iteration limit before surfacing to human) | superpowers § Supporting | 🟡 | review-cross-model has 6-iteration cap per proposal #131 | 🆕 | 🟡 | deep-dive (overlap with #131) |

### Key Patterns Worth Studying

| # | Feature | Source | svc current state | Verdict | Reason |
|---|---------|--------|-------------------|---------|--------|
| s29 | Anti-rationalization tables | superpowers § Key Patterns | ✅ | create-skill Structural Bulletproofing (taken 2026-04-08) | 🟢 | none |
| s30 | CSO description anti-pattern | superpowers § Key Patterns | ✅ | anti-patterns.md AP-20 | 🟢 | none |
| s31 | Pressure testing (3+ combined pressures) | superpowers § Key Patterns | ✅ | test-framework/references/pressure-testing.md | 🟢 | none |
| s32 | Two-stage review ordering | superpowers § Key Patterns | ✅ | execute-changeset Step 3 | 🟢 | none |
| s33 | 3 fixes = architectural problem | superpowers § Key Patterns | ✅ | diagnose-bug 3-Attempt Escalation | 🟢 | none |
| s34 | Defense-in-depth validation | superpowers § Key Patterns | 🟡 | rules/concern-routing.md has 4-point validation; not as explicit "defense-in-depth" framing | 🆕 | 🟡 | deep-dive |
| s35 | Condition-based waiting (poll + descriptive timeout) | superpowers § Key Patterns | 🟡 | rules/bash-hygiene.md `until ! pgrep` pattern; not generalized to all polling | 🆕 | 🟡 | deep-dive |
| s36 | Lean context for subagent tasks | superpowers § Key Patterns | 🟡 | dispatch-waves task envelopes have file + pattern; not yet one-line | 🆕 | 🟡 | deep-dive |
| s37 | Mock-interface derivation | superpowers § Key Patterns | ✅ | anti-patterns.md AP-14 (taken 2026-04-08) | 🟢 | none |
| s38 | Commitment principle (announcement requirement triggers psychological commitment) | superpowers § Key Patterns | ✅ | every svc skill has an "Announce at start" line | 🟢 | none |

### Testing Infrastructure

| # | Feature | Source | svc current state | Verdict | Reason |
|---|---------|--------|-------------------|---------|--------|
| s39 | Explicit skill requests (9 phrasings trigger Skill tool) | superpowers § Testing | ✅ | tier-2 evals cover phrasing variation | 🟢 | none |
| s40 | Skill triggering (6 natural prompts trigger right skill) | superpowers § Testing | ✅ | tier-2 evals cover natural-language routing | 🟢 | none |
| s41 | Multi-turn triggering | superpowers § Testing | 🟡 | tier-2 mostly single-turn; multi-turn coverage thinner | 🆕 | 🟡 | deep-dive |
| s42 | Brainstorm server unit/integration tests | superpowers § Testing | ❌ | ✋ SKIP — no brainstorm server in svc | — | — | none |
| s43 | Windows lifecycle (owner PID monitoring, MSYS2/Cygwin) | superpowers § Testing | ❌ | ✋ SKIP — svc doesn't target Windows | — | — | none |
| s44 | Subagent-driven-dev E2E (full skill execution, transcript inspection) | superpowers § Testing | 🟡 | tier-2 covers some skill execution end-to-end | 🆕 | 🟡 | deep-dive |
| s45 | Token usage analysis (per-subagent cost visibility, $3/$15 per M tokens) | superpowers § Testing | ❌ | svc has no token-cost telemetry | 🆕 | 🟡 | deep-dive (high-value telemetry) |

### Codex round-1 review record

| Round | Submit SHA | Findings | Resolution |
|---|---|---|---|
| 1 | (pending) | (pending) | (pending) |

---

## Verdicts summary

**Already taken (in prior blends):** 21 of 45 features (s2, s6, s8, s10–s16, s19–s21, s24–s26, s29–s33, s37–s40)

**Already-have under different framing:** several (svc covered these without taking them from superpowers verbatim)

**✋ SKIP — out of scope:** s3 (Windows .cmd), s22-s23 (brainstorm/visual UI), s42 (brainstorm tests), s43 (Windows lifecycle)

**Deep-dive candidates (10):** s1 (EXTREMELY_IMPORTANT wrapping), s4 (zero-dep hard-reject), s5 (version-string drift), s7 (plugin packaging), s9 (9-step brainstorm gate), s17 (4-option finish), s18 (verification-before-completion), s27 (4 status codes), s28 (5-iteration cap), s34 (defense-in-depth framing), s35 (condition-based-waiting generalized), s36 (lean context), s41 (multi-turn triggering), s44 (E2E transcript inspection), s45 (token cost telemetry)

**Most svc-distinctive losses if blending without care:**
- svc's deferred-loading model is closer to superpowers' than gstack's; preserve.
- svc's host-agnostic hook wiring is closer to superpowers' "platform detection via env vars" than to gstack's typed adapters; preserve.
- svc has its OWN dispatch-waves (more sophisticated than superpowers' subagent model) — don't regress on dispatch-waves to match superpowers' simpler shape.

## Open question for codex review

Have we accurately classified the 21 "already taken" features? Spot-check 3-5 of them against the actual svc artifacts to confirm the prior blends are still in place and effective.

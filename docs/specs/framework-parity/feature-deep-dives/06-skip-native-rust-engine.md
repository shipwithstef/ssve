# Deep-dive #6: Native Rust Engine (gsd-2 row #28/#43) — SKIP

**Source:** gsd-2 § Core Architecture + § Native Engine — N-API Rust modules for git (libgit2), grep (ripgrep internals), AST (ast-grep 40+ langs), glob, fuzzy find, diff (Myers), process tree (Linux/macOS/Windows), TTSR (RegexSet), truncate, JSON parse, stream processing, xxHash.
**Decision required:** adopt OR skip.

## What the feature is

A native-Rust execution layer compiled as N-API node addons, exposing high-performance primitives that gsd-2 uses for its CLI: libgit2 for git ops, ripgrep internals for fast text search, ast-grep for syntax-aware refactoring across 40+ languages, native glob/fuzzy-find/diff/process-tree/JSON/xxHash. The pitch: orders of magnitude faster than shelling out to git/rg/find.

## svc current state

svc uses node-stdlib + bash subprocess + the installed CLI binaries (git, rg if available, ast-grep if available). No native Rust engine. No N-API addons. `package.json` has zero runtime dependencies (zero-dep doctrine from superpowers blend).

## 10 scenarios — analyzing whether to adopt

### Scenario 1: large grep across 1000+ files (e.g. scanning concerns/REGISTRY.json + all SKILL.md)

**Today (svc):** shells out to `rg` (if installed) or `grep -r`. ~50-200ms for the whole repo.
**With Rust engine:** ~10-50ms. ~4x faster.
**Improvement:** marginal. 50-200ms is below the threshold where users notice. ZERO measurable workflow speedup.
**Verdict: NEUTRAL (negligible).**

### Scenario 2: git ops in hot loops (e.g. `git diff` across 100 commits)

**Today (svc):** shells out. Each `git diff` ~50ms × 100 = 5s.
**With libgit2:** ~5-20ms × 100 = 500ms-2s. ~2-10x faster.
**Improvement:** real but svc doesn't actually have 100-iteration git loops. Hot-loop git use is rare.
**Verdict: NEUTRAL (potential, not realized).**

### Scenario 3: AST-aware refactoring across the codebase

**Today (svc):** none. svc's refactoring goes through the orchestrator (Claude) reading files and editing.
**With ast-grep:** could power a `scripts/refactor-ast.mjs` that does cross-file syntactic transformations.
**Improvement:** would be NEW capability, not improvement. svc has explicitly chosen agent-mediated refactoring (more semantic understanding than ast-grep alone) — bypassing that with ast-grep would lose the architectural-context the agent brings.
**Verdict: NEGATIVE (loses architectural context).**

### Scenario 4: Build/distribution complexity

**Today (svc):** users run `./setup` and symlinks fall into place. Zero compilation. Zero per-platform binaries. Works on Linux / WSL / macOS / cross-platform identically.
**With native Rust engine:** users need pre-built binaries per (OS × arch × node version). N-API addons are notoriously fragile across node versions. svc would need a CI matrix building Linux-x64 / Linux-arm64 / macOS-x64 / macOS-arm64 / Windows-x64 binaries, publishing to npm, handling fallback when binary unavailable.
**Improvement:** NEGATIVE — adds significant operational complexity to a framework whose entire pitch is "30-second install, host-agnostic."
**Verdict: NEGATIVE (operational cost).**

### Scenario 5: Zero-dep doctrine inherited from superpowers blend

**Today (svc):** zero npm runtime deps. Hard rule from `rules/research-must-use-gemini-cli.md`-class doctrine. WI-140 design-tech explicitly cites it as a deliberate design choice ("the framework fixes stored-knowledge-decay; adding decay-prone deps to enforce that fix would be self-undermining").
**With native Rust engine:** introduces a runtime native-binary dep (potentially a chain of them — libgit2's C deps, ripgrep's compile-time bindings). Violates the zero-dep doctrine.
**Improvement:** NEGATIVE — contradicts existing framework principle that the user explicitly endorsed by NOT asking for it across 2 months.
**Verdict: NEGATIVE (violates explicit doctrine).**

### Scenario 6: User explicitly said "don't want a rewrite"

**Today (svc):** bash + node, ~80 skills, ~150 scripts. Works.
**With native Rust engine:** adopting it as core would force rewriting every git-using / grep-using / glob-using script. ~30-50 scripts would need rework. That IS a rewrite.
**Improvement:** NEGATIVE — directly violates user directive.
**Verdict: NEGATIVE (rewrite, explicitly forbidden by user).**

### Scenario 7: Reliability — node-stdlib + bash + git CLI is battle-tested

**Today (svc):** every primitive in use has 10+ years of production use across millions of installations. Failure modes are well-known.
**With native Rust engine:** N-API addons have a long tail of edge cases (segfaults in glibc-compat zones, ABI breaks across node versions, undefined-behavior on weird FS configurations). gsd-2's Rust engine is real and works in their environment, but adopting it would expose svc users to a NEW class of failure modes.
**Improvement:** NEGATIVE (introduces new failure surface).
**Verdict: NEGATIVE.**

### Scenario 8: Maintenance burden

**Today (svc):** scripts are inspectable in 5 seconds by reading the .mjs file.
**With native Rust engine:** Rust + N-API binding code requires Rust toolchain expertise to debug. The svc maintainer pool (you + me) doesn't have that today.
**Improvement:** NEGATIVE.
**Verdict: NEGATIVE.**

### Scenario 9: Are there ANY genuine speed-critical paths in svc today?

**Today (svc):** the only "long" scripts are tier-2/tier-3 evals (which spawn `claude -p` subprocesses — the dominant cost) and per-PR codex review (5-8 min wall time — also dominated by the model, not local compute).
**With native Rust engine:** the dominant cost is the LLM, not the local script. Speeding up local script work by 10x doesn't move the wall-clock needle on any user-facing flow.
**Improvement:** NEGATIVE in cost-benefit (no payoff to optimize).
**Verdict: NEGATIVE.**

### Scenario 10: Future-state hedge — could svc need it later?

**Today (svc):** maybe a "scan all skills for stale references" job could benefit, or a per-commit lint over 1000+ files.
**With native Rust engine:** if svc ever ships such a job, it could be added as a TARGETED tool (e.g. `scripts/lib/fast-grep.mjs` that delegates to rg/ag/ast-grep IF AVAILABLE, falls back to plain grep). That's a separate, much smaller decision than adopting Rust as a core dependency.
**Improvement:** the hedge can be done WITHOUT adopting the whole Rust engine. So adopting now is premature.
**Verdict: NEGATIVE (over-adoption).**

### Scenario count: **0 POSITIVE / 6 NEGATIVE / 4 NEUTRAL.**

## Blast radius (if adopted)

| Touched | Type | Regression risk | Notes |
|---|---|---|---|
| `package.json` | manifest | HIGH: adds a native-binary dep | violates zero-dep doctrine |
| Per-platform CI builds | CI | HIGH: matrix of (OS × arch × node version) binaries | svc has minimal CI today; this would dominate |
| Every script using git/rg/glob/diff | scripts | HIGH: refactor 30-50 scripts | the rewrite user said not to do |
| User install flow | UX | HIGH: from "git clone + ./setup" to "git clone + npm install + native build" | breaks the 30-second install pitch |
| Failure surface | runtime | HIGH: N-API + libgit2 edge cases | new class of bugs |
| Maintainer burden | ops | HIGH: requires Rust toolchain familiarity | not present today |

**Net regression risk:** HIGH. Operational complexity, doctrine violation, rewrite scope, new failure modes — all for negligible measurable speedup.

## Decision

**SKIP.** 0 of 10 scenarios positive. 6 NEGATIVE (rewrite scope, zero-dep doctrine violation, install-flow degradation, new failure modes, maintainer-burden increase, doctrine-conflict). Adopting the native Rust engine would directly contradict the user's "I don't want a rewrite" directive AND the existing zero-dep doctrine, in exchange for speedups that don't measurably impact any user-facing flow (the LLM is the dominant cost).

The hedge for any future speed-critical path: add a TARGETED helper that uses `rg` / `ast-grep` IF AVAILABLE with a graceful fallback. That's a tiny, separate decision; does not require adopting the whole engine.

## Implementation handoff

None. Scorecard row #28 verdict: **✋ SKIPPED** with link to this deep-dive. Row #43 (N-API modules) same.

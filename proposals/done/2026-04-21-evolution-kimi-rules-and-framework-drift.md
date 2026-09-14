# Framework Evolution — 2026-04-21 (Kimi Rules Parity + Framework Drift)

**Status:** DRAFT

## Method

Read `FRAMEWORK-STATE.md` in full (1257 lines) to skip already-tracked items. Read `DOCTRINE.md` section headers + verification section. Read `skills-manifest.json` (491 lines) and compared `includedSkills` vs `corePackForRouting`. Read `setup` script rules-installation block (lines 160–250). Inspected host manifests (`provision/hosts/kimi.json`, `provision/hosts/claude.json`). Verified `~/.kimi/rules/` and `~/.kimi/skills/rules/` contents on disk. Read `KIMI.md` rules-related sections. Grep-scanned all 58 `*/SKILL.md` files for `work-item-schema`, `lane-tasks.json` vs `lane-tasks-<WI>`, and chain-block duplication. Checked pending proposals in `proposals/` against FRAMEWORK-STATE closed gaps.

**Skipped (already in FRAMEWORK-STATE.md or prior evolution):** list-work-items parser drift (closed 2026-04-21), canonical WI schema (closed 2026-04-21), install-drift detection (closed 2026-04-21), validate-feature DEFER state (closed 2026-04-21), benchmark-landing rubric v2 (closed 2026-04-21), assess-market-readiness manifest parity (closed 2026-04-19), FRAMEWORK-STATE hook inventory (closed 2026-04-19), pending proposal stale cleanup (closed 2026-04-19).

## Findings (by priority)

### P0 — Fix now (blocks quality)

(none new this run — all P0-class gaps from prior evolutions are either closed or tracked as BLOCKED proposals)

### P1 — Fix soon (degrades quality)

#### F-001 — Kimi host rules are symlinked but never consumed; cross-host parity gap [Drift / Fragility]

**Evidence:**
- `setup` lines 187–250: for host `kimi`, universal rules symlink to `~/.kimi/rules/` and stack-specific rules symlink to `~/.kimi/skills/rules/<stack>/`.
- `provision/hosts/kimi.json:5`: `"rules_path": "~/.kimi/rules"`.
- Live filesystem: `~/.kimi/rules/svc-common-code-review.md` → `seriousvibecoding/rules/common/code-review.md` (symlink present and current).
- `kimi --help` and `~/.kimi/config.toml`: zero mention of rules loading. Kimi Code CLI has no native `.kimi/rules/` auto-injection mechanism.
- `KIMI.md:97–123`: "Enforcement Rules" section hardcodes ~15 rules (git guard, file edit guard, task completion guard, session end quality check) that overlap with `rules/common/code-review.md`, `rules/tool-selection.md`, and `rules/common/research-before-build.md` — but the copies are manual, not generated from `rules/`.
- `KIMI.md:142–144`: "Steering Rules" section is a comment only: `<!-- e.g. @~/.kimi/skills/rules/react/patterns.md -->`. No actual @-import or reference.

**Root cause:** The framework cloned Claude's rules-installation model (symlink to host `rules_path`) without verifying the target host actually reads that path. Claude Code natively injects `.claude/rules/*.md`; Kimi Code CLI does not.

**Impact:**
- Kimi users get only the rules that were manually copied into `KIMI.md` during its original authorship. Any rule added to `rules/` after that (e.g., `rules/base44-schema.md` added 2026-04-15) is silently invisible to Kimi sessions.
- Stack-specific steering rules (`rules/web/performance.md`, `rules/react/patterns.md`, etc.) are installed on disk but never reach the agent context.
- Cross-host parity claim in `AGENTS.md` ("Rules are injected into CLAUDE.md / AGENTS.md based on the active stack") is partially false for Kimi.

**Fix:**
1. **Short-term:** Add a post-install step to `setup --host kimi` that concatenates all active universal rules into `KIMI.md`'s `## Enforcement Rules` section, and replaces the commented steering-rules placeholder with actual file references or inline content.
2. **Medium-term:** Create a `scripts/generate-kimi-rules.mjs` that reads `rulesRegistry` from `skills-manifest.json` and regenerates the rules sections of `KIMI.md` idempotently. Wire it into `./setup --host kimi` and `scripts/check-install-drift.sh`.
3. **Alternative considered:** Convert rules to skills. Rejected — skills are invoked, not auto-injected. The value of rules is "always-on behavioral guardrails."

---

#### F-002 — `work-item-schema.md` canonical contract is unreferenced by 4 key authoring / consuming skills [Drift]

**Evidence:**
- `references/work-item-schema.md` exists (114 lines, created 2026-04-21 per FRAMEWORK-STATE:50).
- Skills that **do** reference it:
  - `capture-idea/SKILL.md:117`
  - `onboard-repo/SKILL.md:137`
  - `diagnose-bug/SKILL.md:602`
- Skills that **do not** reference it but emit or consume WI files:
  - `validate-feature/SKILL.md` — emits WI files for DEFER / NO-SHIP decisions; no schema reference
  - `write-spec/SKILL.md` — emits feature specs that often become WI anchors; no schema reference
  - `audit-coverage/SKILL.md` — audits WI directory; no schema reference
  - `list-work-items/SKILL.md` — consumes WI files; documents tolerated heading variants but does not reference the canonical schema doc

**Impact:** The schema was created to stop "every authoring skill invents its own shape." If the four missing skills don't reference it, the next time one of them is edited, it can drift away from canonical form again — recreating the exact problem the schema solved.

**Fix:** Add a single-line pointer to `references/work-item-schema.md` in each of the four skills at the relevant WI-formatting step. No behavior change; just a documentation anchor.

---

#### F-003 — `list-work-items.skill` zip twin still exists despite 2026-04-19 evolution flagging it [Drift]

**Evidence:**
- `proposals/done/2026-04-19-evolution.md:27–30` (F-003) identified the zip twin and proposed `git rm list-work-items.skill`.
- `ls -la list-work-items.skill` today: 2886 bytes, ZIP magic `PK`, tracked in git (commit `15ee476`).
- `ls -la list-work-items/SKILL.md`: unpacked directory exists and is current.

**Impact:** Two sources of truth for the same skill. No installer uses the `.skill` format; no documentation describes it. Silent drift risk if someone edits the directory but not the zip.

**Fix:** `git rm list-work-items.skill`. If a package format is needed later, generate it at build time into `dist/` (gitignored), not tracked at repo root.

### P2 — Improve when possible (nice to have)

#### F-004 — `evolve-framework/SKILL.md` violates its own chain-block dedup principle [Inefficiency]

**Evidence:**
- `evolve-framework/SKILL.md:148`, `:158`, `:177`: three nearly identical "Task-graph mode" blocks, each ~12 lines, differing only in surrounding markdown heading depth.
- FRAMEWORK-STATE:356–359 documents the `improve-framework` dedup (F-005 partial) where 3× embedded chain blocks were collapsed to a single-line pointer, saving ~45 lines.
- `references/task-graph-chaining-protocol.md` exists as the canonical source of truth for this exact boilerplate.

**Impact:** The skill that audits framework quality carries mechanical bloat that every other skill was asked to remove. Minor, but ironic — and it sets a bad example.

**Fix:** Collapse the three blocks to one reference line pointing at `references/task-graph-chaining-protocol.md`, mirroring the `improve-framework` fix. Skill drops ~30 lines with no content loss.

---

#### F-005 — Local placeholder rules have no evaluation trigger; `evaluate-rule` only fires during `blend-external` [Inefficiency]

**Evidence:**
- `rulesRegistry` in `skills-manifest.json`: 9 stack-specific rules, 5 of which are `source: local` with `last_evaluated: null`:
  - `rules/react/patterns.md`
  - `rules/react/coding-style.md`
  - `rules/react-native/patterns.md`
  - `rules/react-native/coding-style.md`
  - `rules/web/design-quality.md` (actually blended, but web/performance is also blended)
- `evaluate-rule/SKILL.md` is invoked only by `blend-external/SKILL.md:467,473` for blended rule packs.
- No skill or hook triggers `evaluate-rule` for local-authored rules.

**Impact:** Placeholder rules remain placeholders indefinitely. No systematic signal to populate them or remove them if they stay empty.

**Fix:** Add a lightweight trigger: `improve-framework` Step 1.5 (proposal scan) or `evolve-framework` evidence scan should flag any `rulesRegistry` entry with `last_evaluated: null` and `source: local` older than 30 days. Emit a one-line reminder: `Rule rules/react/patterns.md is a placeholder — run evaluate-rule or remove.`

### P3 — Track (not actionable yet)

#### F-006 — Chaining boilerplate still uses bare `lane-tasks.json` instead of `lane-tasks-<WI>.json` [Known Gap]

**Evidence:**
- FRAMEWORK-STATE:1187 already lists this as a Known Gap.
- Current counts: 824 references to `lane-tasks.json` in `*/SKILL.md` files vs 25 references to `lane-tasks-<WI>.json`.
- The fix requires bulk update across 55+ skills; FRAMEWORK-STATE notes "Fixing in individual skills creates inconsistency — needs bulk update."

**Status:** Leave in Known Gaps. No new evidence this run.

## Comparison delta

Not relevant for this run — findings are svc-internal infrastructure gaps, not competitor capability comparisons.

## Stale proposal audit

| Proposal | Current state | Recommendation |
|---|---|---|
| `2026-04-21-evolution.md` (list-work-items) | P0/P1-F006 implemented; P1-F005 and P2-F007 remain open | Leave pending until F-005/F-007 close |
| `2026-04-21-evolution-kimi-rules-and-framework-drift.md` | This file | N/A |
| `2026-04-20-session-audit-capture-idea-wrong-repo.md` | Pending — capture-idea filed a WI in wrong repo | Leave pending; needs `improve-framework` or `audit-session-execution` fix |
| `2026-04-14-blocking-discovery-halt-protocol.md` | BLOCKED | Leave pending |
| `2026-04-14-parallel-wi-dispatch.md` | BLOCKED | Leave pending |

## Next step

F-001 (Kimi rules auto-injection) is the highest-value fix — it closes a cross-host parity gap that affects every Kimi user on every session. F-002 and F-003 are mechanical one-line / one-command fixes. F-004 and F-005 are small cleanups.

Route to `improve-framework` if the user wants to act on these findings.

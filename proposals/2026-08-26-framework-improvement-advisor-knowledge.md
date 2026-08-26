# Proposal: Canonical Advisor Knowledge Pack — WI-FW-ADVISOR-KNOWLEDGE-01

- **Date:** 2026-08-26
- **Lane:** framework (svc-on-svc)
- **Author:** WI-FW-ADVISOR-KNOWLEDGE-01 (owner override: heavy research + implement, human_checkpoint waived)
- **Status:** IMPLEMENTED on `feat/fw-advisor-knowledge-01`

## 1. Problem

CoS / route-workflow / capability-concierge / svc-advisor style advisors often
miss or mis-state framework facts — host wiring, lane model, review topology,
resource governors, worktree rules. Knowledge is scattered across
`FRAMEWORK-STATE.md`, `DOCTRINE.md`, `skills/*/SKILL.md`, `references/`,
`proposals/`, `hooks/`, `provision/hosts/*.json`. Advisors answer from a stale
Layer-2 knowledge pack or from improvisation.

### Evidence gathered this WI (live audit 2026-08-26)

| # | Stale/wrong claim | Where it lives | Ground truth (verified) |
|---|---|---|---|
| E1 | "v1.5.3 (**77** skills …)" (line 4) + "Last updated: 2026-07-23" (line 5) | `references/knowledge/svc/CAPABILITIES.md` | `skills-manifest.json` → **103** includedSkills (WI-507 added 15 company brains) |
| E2 | INDEX.md self row: "**77** skills" | `references/knowledge/INDEX.md` | same as E1 |
| E3 | "Five hosts supported" + "**codex.json: hooks remain unavailable**" | `references/knowledge/svc/details/infrastructure.md` (extracted 2026-04-08) | **9** provisioned hosts (`provision/hosts/*.json`); Codex has a serialized PreToolUse dispatcher since WI-529 |
| E4 | Anti-pattern count stated as 24 (AGENTS.md), 31 (CAPABILITIES.md table), 25 (same file's own AP section header) | multiple | `grep -cE '^###? AP-[0-9]+' references/anti-patterns.md` → **34** |
| E5 | Rules count: 13 (AGENTS.md) vs 18 (FRAMEWORK-STATE.md) | two authority docs disagree | manifest/registry is authoritative; counts drift silently |
| E6 | No recall path at all for framework facts in `cos` and `capability-concierge` | skills/cos/SKILL.md, skills/capability-concierge/SKILL.md | both synthesize recommendations without any instruction to load framework knowledge before asserting framework facts |

Root cause: the Layer-2 self-knowledge pack (`svc/CAPABILITIES.md`) was written
once by a `research` run (2026-07-23) and decays silently every time the
framework changes. Nothing restamps it; nothing tells an advisor "verify the
number mechanically instead of quoting the pack." Meanwhile the genuinely fresh
authority (`FRAMEWORK-STATE.md`, updated with every framework change) is 643
lines and not indexed for advisor consumption.

## 2. Design

### 2a. Single canonical advisor index

New file: `references/advisor/framework-knowledge-index.md`.

- One page, grouped by domain an advisor actually gets asked about:
  identity/counts, lanes & gates, review topology, host wiring,
  worktree/mutation authority, resource & ceremony governors, task-graph/state,
  routing surfaces.
- Every fact block carries:
  - **Fact** — the canonical statement.
  - **Authority** — the file that owns the fact (never the index itself).
  - **Derived-at** — date the block was last verified against the authority.
  - **Verify** — a one-line mechanical command that returns ground truth.
- Binding rule stamped into the file: *counts and wiring claims must be
  re-derived mechanically at query time when precision matters; the Derived-at
  stamp is a freshness hint, not a source of truth.*

### 2b. Recall protocol (cite-before-assert)

Advisors MUST, before asserting any framework fact in user-facing output:

1. Load the advisor index (one file, ~200 lines).
2. For any load-bearing claim, run the block's Verify command (or read the
   Authority path) instead of trusting memory or the stale pack.
3. Cite `path § section` for every material claim; if neither index nor
   authority covers it, say so explicitly (no silent improvisation — already
   svc-advisor doctrine, now extended to cos/concierge).

### 2c. Consumers (which skills change)

| Skill | Change |
|---|---|
| `svc-advisor` | P2 loads the advisor index FIRST; new phase P2b mechanical count verification; Self-Verify rows for verify-command usage and Derived-at disclosure. Existing CAPABILITIES.md flow kept but demoted to detail-layer behind the index. |
| `cos` | New "Framework-fact guardrail": when a briefing/decision card asserts framework facts (hosts, lanes, gates, topology, budgets machinery), load the advisor index and cite; never quote counts from memory. |
| `capability-concierge` | Same guardrail scoped to Lens synthesis that names framework capabilities/machinery. |
| `route-workflow` | One-line wiring in Lane Model & Routing: explicit framework-quality/capability questions route to `svc-advisor` (which now loads the canonical index). Hot path otherwise untouched. |

### 2d. Freshness rules

- Per-block `Derived-at` stamps; refresh protocol at the bottom of the index
  states who restamps what after which framework changes (any skill add/remove,
  lane/gate change, host manifest change, review-policy change → restamp the
  affected blocks in the same commit).
- The existing Layer-2 pack keeps its own 30-day staleness rule; svc-advisor
  discloses pack age per current Step 4 behavior.

### 2e. Explicitly deferred (not in this changeset)

- **Tier-1 validator for index freshness.** Promotion discipline
  (`rules/tier-1-promotion.md`) requires ≥2 observed failures of the class or a
  hot-path trigger. This WI documents failure class instance #1 (E1–E5). If a
  second advisor-misstatement incident lands, promote a validator then.
- Rewriting all of `svc/CAPABILITIES.md` (298 lines). The index supersedes it
  as first-load surface; full L3 re-extraction belongs to a `research` run.

## 3. Changeset file list

| File | Op |
|---|---|
| `proposals/2026-08-26-framework-improvement-advisor-knowledge.md` | new (this doc) |
| `references/advisor/framework-knowledge-index.md` | new |
| `skills/svc-advisor/SKILL.md` | edit |
| `skills/cos/SKILL.md` | edit |
| `skills/capability-concierge/SKILL.md` | edit |
| `skills/route-workflow/SKILL.md` | edit |

Pipeline operating state accompanying the changeset (commit precedent exists
for these): `.svc/session-contract.jsonl`, `.svc/pipeline-decisions.jsonl`,
`.svc/lane-tasks-WI-FW-ADVISOR-KNOWLEDGE-01.json`,
`.svc/evidence/WI-FW-ADVISOR-KNOWLEDGE-01/validation-run.md`.

No manifest/README/REPO_MODES sync needed: no skill added/removed; edits are
substantive prose within existing SKILL.md bodies (frontmatter phases added to
svc-advisor only — checked against lint).

## 4. Verification plan

1. `node scripts/lint-skills-manifest.mjs` — manifest agreement intact.
2. Focused tier-1: skill structure/frontmatter AST validators on the four
   edited skills.
3. Manual grounding check: every Verify command inside the new index executed
   once at authoring time; outputs recorded in the index's Derived-at stamps.
4. Self-review against this proposal before commit.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Index itself goes stale like CAPABILITIES.md did | Restamp-in-same-commit protocol + svc-advisor Self-Verify forces Derived-at disclosure; verify commands make truth one command away regardless |
| route-workflow hot-path regression | One additive sentence in routing guidance only; no phase/frontmatter change |
| cos/concierge get heavier | Guardrail is conditional (fires only when output asserts framework facts); index is a single small file |

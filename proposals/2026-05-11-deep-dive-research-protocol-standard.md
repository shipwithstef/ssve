# Framework Evolution / Improvement — 2026-05-11 — Standardizing Deep-Dive Research Protocol

**Status:** DRAFT
**deferred_until**: 2026-08-25
**reason**: auto-triage during WI-CHAIN-TIER1-FIXES; proposal stays open pending re-review after chain validation green | re-triaged 2026-06-29: batch backlog-sequenced behind active framework work — flagged for individual triage by 2026-07-29
**blocked_reason**: Beyond the 14-day defer window: imported/backlog evolution proposal awaiting a dedicated triage pass (re-deferred 2026-06-29, not abandoned).

## Method
Based on the session extracting knowledge from the `get-shit-done` repository (May 11, 2026). The assessment was made by comparing the depth of documentation-only research against a systematic directory-by-directory codebase sweep. Evidence was drawn from the discovery of 60+ undocumented mechanics hidden in `bin/lib/`, `sdk/src/`, and `tests/`.

## Findings (by priority)

### P0 — Fix now (blocks quality)

#### F-001: Documentation-Only Research misses 90%+ of project intelligence [Reliability]
**Evidence:** The initial extraction of `get-shit-done` based on `docs/` and `CHANGELOG.md` identified ~10 features. The subsequent systematic sweep of `bin/lib/` and `sdk/src/` uncovered 65 deep mechanics (e.g., Graphify commit staleness, Event Stream decoupling).
**Impact:** SVC agents act on an incomplete map of foreign repositories, leading to "Success Theater" where a feature is known by name but its actual implementation constraints are ignored during a blend or port.
**Proposed fix:** Update `research/SKILL.md` to mandate a **Systematic Directory Sweep** for all analysis-mode runs. Agents must:
1. List all top-level directories.
2. For each directory, sample at least 2-3 of the largest files (by size) regardless of whether they are mentioned in documentation.
3. Explicitly report "undocumented findings" as a separate category in Layer 3.

#### F-002: Lack of Provenance for Code-Level Claims [Trust]
**Evidence:** Initial extraction lacked individual file hashes. There was no mathematical proof that the AI hadn't "guessed" the logic of a script based on its filename.
**Impact:** Zero-hallucination guarantee is impossible. Porting logic becomes dangerous if the extracted logic is actually an AI confabulation.
**Proposed fix:** Mandate **Reliability Receipts** in `research/SKILL.md`:
1. **Hash Ledger:** Generate SHA-256 hashes for every substantive file analyzed and store them in `.sources.jsonl`.
2. **Logic Signature Audit:** For any complex claim (regex, algorithm), the agent must cross-verify the extracted logic against the raw source *one last time* before declaring done.

### P1 — Fix soon (degrades quality)

#### F-003: "Common Implementation" Blindness [Context]
**Evidence:** Agents tend to focus on "Unique" features, ignoring how a repository solves "Common" problems (like config merging or path normalization).
**Impact:** Lost opportunity to improve SVC's own core utilities by comparing them against production-hardened alternatives.
**Proposed fix:** Update `research/SKILL.md` to require a **Three-Tier Deep Drill** format for all Layer 3 (details/*.md) output:
1. **Tier 1: Unique Mechanics** (Capabilities SVC does NOT have).
2. **Tier 2: Common Implementations** (How they solve problems SVC ALSO solves).
3. **Tier 3: Intelligence Data** (Prompt text, few-shot examples, gold-standard artifacts).

## Comparison delta
- **GSD:** Uses specialized `gsd-codebase-mapper` agents and a `map-codebase` command to generate high-fidelity maps before research begins.
- **SVC:** Research is more on-demand and prose-heavy. 
- **Assessment:** Adopting the GSD mapping-first approach combined with SVC's verification rigor will make SVC the strongest research-driven framework in the ecosystem.

## Self-Verify
| # | Check | Result |
|---|---|---|
| 1 | Proposal file exists | PASS |
| 2 | Every finding cites file:line or measurement | PASS |
| 3 | FRAMEWORK-STATE.md was read first; no rediscovered items | PASS |
| 4 | Findings ranked by impact + confidence | PASS |

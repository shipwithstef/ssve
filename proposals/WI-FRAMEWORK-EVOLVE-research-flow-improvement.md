# Proposal: Formalize and Mechanize Research/Docs Commit Exemptions

**Status:** DRAFT
**Author:** Gemini CLI
**Date:** 2026-05-21
**WI:** WI-FRAMEWORK-EVOLVE

## 1. The Problem

The current **Mandatory Plan-Exec-Review Chain** (enforced since 2026-05-13) creates friction for non-implementation commits:
1. **Research Extraction:** Research dispatches a sub-agent, commits results (docs only), and pushes. The `pre-push` hook refuses the push because it lacks the 5 implementation receipts (plan, review, etc.).
2. **Rule Divergence:** `rules/plan-changeset-trigger.md` explicitly exempts documentation and additive work from the chain ceremony, but the mechanical enforcement (`check-chain-receipts.mjs`) is unaware of these exemptions.
3. **Manual Override Burden:** Developers must manually flip policy to `warn` or use `EMERGENCY_OVERRIDE` for safe commits, eroding the value of the "refuse" mode.
4. **Auth Friction:** The `research` skill dispatches to `gemini-cli` which might use a different credential context, and the final push often requires a `gh auth switch` that isn't handled gracefully.

## 2. Proposed Changes

### A. Mechanize Commit Exemptions in `check-chain-receipts.mjs`

Update the validator to automatically identify exempt commits using `git show --name-status`.

**Exemption Logic:**
- **DOCS-ONLY:** All changed files are in `docs/`, `references/knowledge/`, or match `README.md`, `GEMINI.md`, `CLAUDE.md`, etc.
- **ADDITIVE-ONLY:** All changed files have status `A` (added) and are not referenced by existing code (harder to check, maybe stick to path-based first).
- **LEARNINGS:** Only changes are to `*.jsonl` files in `docs/learnings/` or `references/`.

**Implementation:**
Add an `isCommitExempt(sha)` function to `scripts/check-chain-receipts.mjs` that implements these path-based filters. If a commit is exempt, the validator returns `ok: true` with a new type `exempt`.

### B. Self-Documenting Exemption Receipts

When `isCommitExempt(sha)` is true, the validator should look for an `exemption-receipt`. If missing, it can either:
1. **Warn and proceed:** (Current Phase A-D vibe).
2. **Auto-generate:** During `git commit` (via `post-commit` hook), if the commit is detected as exempt, automatically emit an `exemption-receipt` to `refs/notes/svc-receipts`.

### C. Enhance `research` Skill with Auto-Auth and Receipts

1. **Receipt Emission:** The `research` skill must emit a `research-extraction` receipt (schema: `research-extraction.schema.json`) that satisfies the chain. This provides the audit trail: "This commit contains knowledge from URL X, retrieved by Agent Y."
2. **Auth Pre-flight:** Before committing/pushing, the research skill should check `git remote get-url origin`. If it's a GitHub URL, it should verify the current `gh auth status` active account has write access, or proactively `gh auth switch` if the owner matches a known local account (per `improve-framework` logic).

## 3. Benefits

- **Zero Friction for Research:** Sub-agent research results land and push without manual policy flipping.
- **Doctrine Alignment:** The mechanical gate finally reflects the written rules.
- **Improved Audit Trail:** Instead of "no receipts", we get "research-extraction receipt" with provenance.

## 4. Risks & Mitigations

- **Risk:** Malicious or lazy code hidden in "docs" paths.
- **Mitigation:** Path-based filters are strict. `references/knowledge/` and `docs/` should not contain executable code on hot paths. The validator will still fail if a "docs" commit also touches `src/` or `scripts/`.

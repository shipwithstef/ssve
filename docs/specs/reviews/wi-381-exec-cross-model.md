# WI-381 — G6 cross-model review + resolutions

**Primary reviewer:** codex — **credit-exhausted** (verified live: `You've hit your usage limit … try again at Jun 11th, 2026`), a legitimate mid-run primary failure.
**Fallback reviewer:** gemini (per `resolve-adversarial-reviewer.sh` Claude→Codex→Gemini). Diff-only, scope-locked (`--approval-mode plan`, package piped via stdin). **Date:** 2026-06-08.
**Verdict:** 3 findings (1 HIGH, 1 MEDIUM, 1 LOW) — 2 fixed, 1 acknowledged-with-rationale.

| # | Sev | Finding | Resolution |
|---|-----|---------|------------|
| 1 | HIGH | **Grandfather bypass.** `check-chain-receipts` recompute was gated `if (ad && (schema_version>=3 \|\| spec_ac_table_sha256))` — a forged v2 receipt carrying `ac_digests` WITHOUT `spec_ac_table_sha256` skipped the staleness gate entirely while downstream skills still consume the payload. | **ACCEPTED + FIXED.** A PRESENT baton is now ALWAYS bound + recomputed regardless of version: `if (ad) { require 64-hex spec_ac_table_sha256; recompute vs commit-tree spec; fail on mismatch }`. Only the ABSENCE of a baton is grandfathered (legacy v1/v2 have none). |
| 2 | MEDIUM | **Static-schema legacy break.** Unconditionally adding `ac_digests` to root `required` makes a standard JSON-Schema validator reject valid v1/v2 receipts; the JS grandfather doesn't change the static schema. Suggested `if/then` on `schema_version>=3`. | **ACKNOWLEDGED — AC4 governs.** WI-381 AC4 *explicitly* requires `jq -e '.required\|index("ac_digests")'` to pass, so `ac_digests` MUST be in root `required`. This mirrors the **accepted WI-396 precedent** (`diff_hash` in `required`, enforcement version-gated). The svc chain validates these receipts ONLY via its custom validators (`check-chain-receipts`/`emit-receipt`), which grandfather v1/v2 — it never runs a standard JSON-Schema validator over them. Documented the rationale + caveat in the schema `description`. Moving to `if/then` would fail AC4. |
| 3 | LOW | **Doc snippet bug.** The `plan-changeset` baton instruction used bare `readFileSync(SPEC,…)` — `SPEC` is an undefined JS identifier → ReferenceError if copied literally. | **ACCEPTED + FIXED.** Rewritten to `SPEC=docs/specs/features/<name>.md node -e '…readFileSync(process.env.SPEC,…)'`. |

**Self-review:** the normalizer is the load-bearing choice and was verified progress-insensitive + revision-sensitive on BOTH spec formats (checklist + AC table) before anything was built on it. The recompute binds each baton to its OWN commit's spec tree (`git show <sha>:spec_path`, path-sanitized), so legitimate later spec evolution never false-fails a historical commit. Dogfood: WI-381's own plan-manifest carries the v3 baton bound to WI-381.md (`spec_ac_table_sha256` stable across the AC checkoffs). Full tier-1 green; baton-binding validator 7/7.

**Rejection action:** patch-in-place (1 security fix + 1 doc fix + 1 documentation). Iteration count: 1.

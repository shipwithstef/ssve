# WI-397 — G6 cross-model review + resolutions

**Primary reviewer:** codex — **credit-exhausted** mid-run ("You've hit your usage limit … try again Jun 11th"), a legitimate primary-failure fallback condition.
**Fallback reviewer:** gemini (per `resolve-adversarial-reviewer.sh` Claude→Codex→Gemini). Diff-only scope-locked review. **Date:** 2026-06-08.
**Verdict:** 3 findings (2 HIGH, 1 LOW) — **all accepted and fixed.**

| # | Sev | Finding | Resolution (accepted) |
|---|-----|---------|------------------------|
| 1 | HIGH | `validate-context-budget.sh` description regex `/description:([\s\S]*?)\n\w+:/` returns `""` (0 chars) when `description:` is the LAST frontmatter field (followed by `---`, not `\n<key>:`) → an oversized last-field description false-passes the ceiling. | Regex now stops at the next key OR end-of-frontmatter: `/description:([\s\S]*?)(?:\n\w[\w-]*:|\n*$)/`, and the frontmatter split uses `/^---$/m`. Catalog total unchanged (36,291) → backward-compatible, and last-field descriptions are now counted. |
| 2 | HIGH | `always_on_rule_paths` was a hardcoded baseline list → a new always-on rule added elsewhere would not be counted (silent context-bloat gap). | The validator now **derives** the always-on set dynamically from `skills-manifest.json` rulesRegistry entries with `auto_inject:"always"` (the declarative marker; currently 6 = 11,162B). A new always-on rule gets `auto_inject:"always"` and is automatically in budget. Baseline no longer hardcodes the list. |
| 3 | LOW | `validate-hook-latency.sh` count `(x.hooks||[]).length||1` evaluates an empty `{"hooks":[]}` to 1 (over-count) instead of 0. | `Array.isArray(x.hooks) ? x.hooks.length : 1`. |

**Self-review:** both nets are deterministic, hermetic (<1s), pass current state, and were regression-sim verified (lowered ceiling / lowered count → red). The dynamic derivation was verified to reproduce the measured 6 rules / 11,162B. Full tier-1 205/0.

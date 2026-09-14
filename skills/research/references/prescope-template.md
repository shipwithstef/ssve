# Pre-Scope Output Template

Every research invocation that targets a URL, repo, or large source MUST produce a pre-scope artifact BEFORE extraction begins. The orchestrator inspects this artifact to confirm the plan is complete and the single-pass extraction will cover the full source.

## Required sections

```markdown
# Pre-Scope: <source-name>

**Source:** <URL or repo path>
**Invoked by:** <skill name or "standalone">
**Date:** YYYY-MM-DD

## Volume Estimate

- Total files (substantive, excluding images/licenses/generated): N
- Approx total tokens / lines: N
- Top-level areas/sections: <list>

## File Checklist (manifest)

Every substantive file that MUST be read in the single pass:

- [ ] path/to/file-1.md
- [ ] path/to/file-2.md
- [ ] ...

## Extraction Plan

- Pass strategy: single-pass across all checklist files
- Target detail files: `references/knowledge/<domain>/details/<area-1>.md`, ...
- Domain classification: <proposed domain> (justification: <why>)

## Sub-Agent Selection

- Primary: agy-cli (default — REQUIRED unless agy-cli has actually failed)
- Fallback: Claude (in-session) if agy errors, runs out of credits, or stalls mid-pass
- Selected for this run: <primary|fallback> — <reason>

> **GUARDRAIL (per `rules/research-must-use-agy-cli.md`):** if `Selected for this run` is anything other than `primary` / `agy-cli`, the `<reason>` MUST cite a concrete failure of agy-cli FOR THIS RUN. Acceptable reasons:
> 1. `agy-cli is unavailable` (which agy → no result)
> 2. `agy-cli auth/credit failure` (login expired / quota exhausted, attempted and verified)
> 3. `SVC_RESEARCH_AGENT=claude` env override
> 4. `mid-run primary failure` — agy-cli was tried, returned non-zero or partial coverage
>
> **FORBIDDEN rationalizations** (validator `validate-research-prescope-sub-agent.sh` blocks these):
> - "preserve agy quota for the user's own work"
> - "WebSearch is more reliable for dynamic web content"
> - "faster for this batch"
> - "JavaScript-heavy source pages"
> - any reason that does NOT name a concrete agy-cli failure mode
>
> Why: parent-orchestrator Claude tokens cost real $; agy-cli runs free or against an already-paid Pro subscription. Inverting the chain defeats WI-090's economic premise.

## Expected Output Artifacts

- `references/knowledge/<domain>/CAPABILITIES.md` (Layer 2)
- `references/knowledge/<domain>/details/<area>.md` (Layer 3, one per area)
- `references/knowledge/<domain>/.version`
- `references/knowledge/INDEX.md` entry updated
- `docs/specs/research-log.md` entry appended
```

## Inspection Gate

The orchestrator reads this file and verifies:

1. **File checklist is non-empty** — a plan with zero files is not a plan.
2. **Domain justification is present** — domain gate (`skills/research/scripts/domain-gate.mjs`) is invoked before any write under `references/knowledge/`.
3. **Sub-agent selection is explicit** — not "default"; the actual agent chosen for this run.

If any check fails, extraction does NOT begin.

## Why this exists

Without pre-scope, the agent dives in and gets partial coverage — the user has to re-prompt bit-by-bit to complete the extraction. With pre-scope, the agent commits to a manifest, and the single pass is measured against that manifest in the coverage check (step 7 of the analysis protocol).

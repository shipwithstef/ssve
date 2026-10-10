### 7. Write the report

Write `proposals/<date>-session-audit-<slug>.md` using this structure:

```markdown
# Session Audit — <slug>

## Scope
<what run was audited and why>

## Evidence Inventory
- prompt / session source
- WI file
- lane task graph
- decision log
- transcript status (`auto-discovered` | `searched host traces, none matched` | `intentionally omitted by scope`)
- runtime proof artifacts

## Expected Contract
<what svc and the repo contract required>

## Actual Execution
<what actually happened, in order>

## Expected vs Actual Matrix
| Area | Expected | Actual | Status | Evidence |
|---|---|---|---|---|

## Dimension Scores
| Dimension | Score | Evidence | Notes |
|---|---|---|---|

## Token / Context Notes
<exact vs estimated vs unknown>

## Findings
### F1
- Domain: project-specific | agent-specific | framework-specific
- Severity: critical | high | medium | low
- Description:
- Evidence:
- Fix:

## Framework Gaps For evolve-framework
<only framework-specific findings>

## Non-Framework Corrections
<project or agent issues that should not become framework work>

## Confidence
<high / medium / low, and what evidence was missing>
```

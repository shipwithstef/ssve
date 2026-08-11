# WI-488 G4 technical-design review

**Artifact:** `docs/specs/features/wi-488-deterministic-external-reviewer.md`
**Contract map:** `docs/specs/contract-maps/wi-488-external-review-invocation.md`
**Iteration:** 1
**Self-reviewer:** Codex orchestrator
**Fresh cross-reviewer:** Claude Fable 5, effort exactly `high`
**Invocation result:** success, no fallback, no tools/MCP, safe mode, plan permission, non-persistent, one turn, schema-constrained
**Runtime model evidence:** `modelUsage.claude-fable-5`
**External review cost reported:** USD 1.237908 total (Fable USD 1.21875; ancillary Haiku USD 0.019158)

## Step 1 — Self-review

### Finding: G4-001

- **Severity:** high
- **Location:** feature spec, Feature Toggles before G4 cross-review
- **Description:** The paid external action had no operational kill switch.
- **Justification:** A paid integration needs an emergency control that stops spend without selecting a degraded reviewer.
- **Suggested fix:** Add `SVC_EXTERNAL_REVIEW_DISABLED=1`, fail before cache/provider use, and emit a receipt.

## Step 2 — Self-judgment

### Judgment: G4-001

- **Verdict:** ACCEPT
- **Analysis:** Budget/timeout bounds limit one call but do not stop all new calls during an incident. The kill switch is independently necessary and must not bypass tuple/schema policy.

**Resolution before cross-review:** accepted and added to the design.

## Step 3 — Fresh Fable cross-review

Fable independently evaluated all ten G4 checklist rows and returned PASS with no critical/high findings. It produced two medium and four low findings.

| Finding | Severity | Cross-review claim | Judgment | Resolution |
|---|---|---|---|---|
| B-1 | medium | Kill switch lacked a dedicated AC, state, fixture, and operations failure-mode row | ACCEPT | Added EXTREV-68, `DISABLED` terminal path, zero-call fixture intent, and operations coverage |
| B-2 | medium | Codex path lacked the timeout bound already designed for Claude | ACCEPT | Added EXTREV-66 and applied the launcher timer to Codex |
| B-3 | low | Fixture bit was promised in cache identity but missing from the canonical four-part key | ACCEPT | Cache identity and EXTREV-48 now include fixture mode |
| B-4 | low | Failed Opus fallback had no terminal edge or exact-attempt proof | ACCEPT | Added EXTREV-67 and `FALLBACK_FAILED -> HARD_FAILURE` |
| B-5 | low | Stale lock recovery was not operationally specified | ACCEPT | Added bounded PID/timestamp stale-lock recovery to runbook/recovery |
| B-6 | low | Contract map named an undefined package-size bound | ACCEPT | Removed the undefined bound and added EXTREV-69 for the real empty-stdin boundary |

## G4 checklist result

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | All ACs feasible | PASS | 69/69 rows in the Feasibility Matrix after remediation |
| 2 | Architecture sound | PASS | One acyclic launcher boundary plus explicit state machine and per-key atomic publication |
| 3 | Risks identified | PASS | Provider wording, metadata, races, partial writes, compatibility, credentials, spend |
| 4 | Trade-offs explicit | PASS | D-1 through D-7, each with five alternatives, plus design trade-off table |
| 5 | Data model complete | PASS | No database change; two schemas and exact cache/staging/lock lifecycle |
| 6 | API/contracts defined | PASS | stdin input, findings/receipt/events/diagnostics, exact tuple and failure classes |
| 7 | Consistent with UX/UI | PASS | System-only Enabler; UX/UI explicitly N/A with justification |
| 8 | Dependencies resolvable | PASS | Both CLIs mocked by fake executable; existing Node/schema/state primitives |
| 9 | Discussion decisions preserved | PASS | No matching discussion artifact; accepted owner constraints preserved |
| 10 | Persona pressure preserved | PASS | Every feasibility row states `N/A - system-only` under the Enabler justification |

## Convergence Status

- **Gate:** G4
- **Artifact:** `docs/specs/features/wi-488-deterministic-external-reviewer.md`
- **Iteration:** 1 of 3
- **Findings summary after remediation:** critical 0, high 0, medium 0, low 0
- **Decision:** PASS
- **Rationale:** every self/cross-review finding was accepted and incorporated; structural validators and 69/69 feasibility coverage pass.

## Gate Decision: G4

- **Artifact:** `docs/specs/features/wi-488-deterministic-external-reviewer.md`
- **Decision:** PASS
- **New state:** BASELINED
- **Iterations completed:** 1
- **Findings resolved:** 7
- **Findings remaining (medium/low):** 0
- **Findings escalated (critical/high):** 0

No browser-visible surface exists. Runtime old-path/new-path proof remains an implementation-review obligation; design-time CLI capability confirmation and falsification evidence is at `docs/specs/test-evidence/WI-488/design-capability-probes.json`.

# Plan Review Protocol

Canonical contract for `review-plan` and the schema-constrained deterministic external reviewer.

## Two gates plus bounded lens remediation

### Tier 1 — Mechanical checks (same-context, no model)

Runs via `scripts/verify-plan-mechanical.sh <plan-manifest-md>` in the orchestrator's current session. Zero model cost. Zero subprocess.

**Checks:**

1. Every file path in the plan resolves on disk
2. Every npm/pnpm/yarn script referenced exists in `package.json`
3. Every fenced bash block passes `bash -n` syntax
4. No forbidden patterns (`--force`, `--no-verify`, `git push -f`, `rm -rf /`, `sudo`, `curl | sh`)
5. Every task-graph `blocked_by` reference resolves to a valid task id
6. Every claimed CLI tool is on PATH

**Exit code:**
- `0` = all checks pass → advance to Tier 2
- `1` = one or more checks fail → orchestrator fixes trivially (path typos, rename drift) and re-runs Tier 1 before any model sees the plan
- `2` = usage error (missing file, unreadable input)

### Tier 2 — One holistic adversarial review

The canonical launcher owns the exact cross-family tuple:

```bash
SVC_HOST="${SVC_HOST:-claude}" \
  bash scripts/review-plan-codex.sh "$PLAN" > /tmp/review-tier2.json
```

Claude-orchestrated review requests Codex 5.6 sol/high and never falls back.
Codex-orchestrated review resolves the registry-owned scheduled or explicit
profile through the canonical launcher. Before the cutover that is Fable
5/high; at and after the cutover it is Opus 4.8/high unless an owner-selected
Fable profile is active. Only the Fable profile may start a separate Opus xhigh
invocation, and only after classified model unavailability, entitlement, or
provider overload. A same-process provider safeguard route is receipted
separately and never authorizes another Opus call.

Every canonical-launcher path emits the same schema-constrained JSON findings envelope. YAML below is used only for the durable human-readable review log.

### Bounded invalidated-lens remediation

Accepted corrections rerun mechanical checks and only the semantic lenses whose
relevant digest changed. The same review stage receives the prior finding,
correction and lens digest. There is no standalone second full-plan reviewer.
A disputed Critical/High product or security-authority choice routes to the
repository owner/founder; model disagreement cannot manufacture product authority.

## Review focus dimensions (per WI-075)

Reviewers must cover all ten dimensions (a–j). Lane compliance (dimension g) was added 2026-04-24 after both Kimi and Codex missed the `improve-framework` skip in WI-073. Dimension (j) is mandatory for plans authored by AGY/Gemini.

| # | Dimension | Prompt |
|---|---|---|
| a | AC-to-task coverage gaps | Do all spec ACs map to at least one task in the plan? |
| b | Scope-boundary leaks | Does any task touch a file outside the declared `touches:` list? |
| c | Rollback adequacy | Is there a concrete, commit-scoped revert path? |
| d | Mode-aware readiness | Inline: score whole-solution readiness and original requirement preservation, including complete v5 `planning_contract`, `implementation_approach`, and `executor_discretion`; local reversible code details are allowed. Dispatch/absent: retain complete-packet determinism. Integer score 0–10 in both. |
| e | Idempotency / re-run safety | What happens if a task is re-run after partial completion? |
| f | Execute-risk | What will actually break during execute-changeset? |
| g | **Lane compliance** | For the declared lane, list every mandatory upstream skill. Is each either completed (cite artifact) or skipped-with-justification (cite `.svc/pipeline-decisions.jsonl`)? An unnamed lane skill = **REJECT** finding. |
| h | **Executable actions** | Legacy/dispatch: complete concrete shell sequence. Explicit inline v5: validate ready-now commands and existing land/verify producer descriptions; future identities must be produced and verified at their action boundary, never invented. Historical v4 bodies remain readable. |
| i | **Blueprint Completeness** | **Dispatch mode (`mode: dispatch` / unset):** does copying the blueprints produce a lint-clean and fully compiled codebase state? An absent/incomplete blueprint = REJECT. **Inline mode (`mode: inline`, WI-386):** §3a is intentionally skipped — do NOT raise a missing-blueprint finding; instead verify the manifest still gives the orchestrator enough (file set + task graph + execution sequence) to apply the change with its already-loaded context. |
| j | **User Intent & Request Fidelity** | For plans authored by AGY/Gemini (`orchestrator: agy` / `author: antigravity`), verify whether the plan faithfully, completely, and accurately fulfills the original user prompt and instructions. Check: (1) Did the author omit explicit user requirements? (2) Did the author distort or misinterpret constraints? (3) Did the author introduce unprompted or conflicting architectural bloat? Any unfulfilled explicit user requirement is a HIGH severity finding that BLOCKS plan approval. |

For explicit inline mode, score these same ten dimensions as solution readiness: (1) exact resolvable or declared future files; (2) complete consequential behavior and interfaces, not authored code, bound in v5 `implementation_approach`; (3) appropriate executable proof and outcomes; (4) meaningful action/authority limits, including `executor_discretion`; (5) exact write scope; (6) recovery path; (7) correct dependencies; (8) observable success; (9) original AC/UX/technical trace; (10) no unresolved consequential choice. Reversible local details are allowed. v5 (and the pinned genuine bootstrap v4) release identities may use the validated existing-adapter producer form. Do not require a body rewrite to `sealed:true`. Keep integer rubric_score 0–10 and concrete findings. For dispatch/absent mode, retain the complete-code/command packet rubric below.

## Finding format

Provider output must validate against
`schemas/external-review-findings.schema.json`; invocation evidence must validate
against `schemas/external-review-receipt.schema.json`. Legacy YAML below is a
review-log presentation format only, never the provider transport contract.

```yaml
rubric_score: <0-10>            # determinism rubric out of 10
rubric_failures: [<int>, ...]   # list of rubric point numbers that failed
findings:
  - id: F-001                   # stable within this review pass
    claim: "<one-line problem statement>"
    severity: high | medium | low
    analysis: |
      <multi-paragraph reasoning showing why this is a problem,
       not just what the problem is>
    evidence:
      - type: file_not_found | cross_reference | command_output | mechanical_check
        path: <file path if applicable>
        line: <line number if applicable>
        quote: "<exact quote from the plan>"
        check_command: "<reproducible command>"
        exit_code: <int if applicable>
        output: "<actual output if applicable>"
    proposed_fix: |
      <concrete change — specific rewrite, not 'improve X'>
dependencies_needing_read:      # optional — files the reviewer could not check
  - path: <file>
    reason: "<why its absence gates this finding>"
```

## Reviewee response format (orchestrator emits this — same rigor)

The orchestrator must respond to EVERY finding before the loop closes. Bare ACCEPT or REJECT is forbidden — same discipline as the reviewer.

```yaml
responses:
  - finding_id: F-001
    decision: ACCEPT | REJECT | PARTIAL
    justification: |
      <multi-line reasoning for the decision>
    # ACCEPT:
    action: "<concrete revision to plan>"
    # REJECT:
    counter_analysis: |
      <why the reviewer's claim is wrong>
    counter_evidence:
      - type: <same types as findings>
        path: ...
        check_command: ...
        output: ...
    # PARTIAL:
    accepted_part: "<what's accepted>"
    rejected_part: "<what's rejected>"
    counter_proposal: "<alternative fix for the rejected part>"
```

## Iteration loop

```
1. Active orchestrator writes plan-changeset manifest + task graph
2. Tier 1 mechanical (scripts/verify-plan-mechanical.sh)
   │
   ├─ exit 1 → active orchestrator fixes trivially, loop back to 1 (no model call)
   └─ exit 0 → continue
3. One canonical external holistic review (registry profile resolved once)
   │
   ├─ rubric_score == 10 AND findings == [] → PROMOTE to done, dispatch MiMo
   └─ findings > 0 OR rubric_score < 5 → active orchestrator writes responses
      │
      ├─ ACCEPTED → revise, mechanically invalidate exact lenses, loop to 2
      ├─ disputed product/security Critical or High → owner authority
      └─ other REJECT/PARTIAL → disposition with counter-evidence
          └─ changed semantic lens → bounded same-review lens recheck only
```

**Terminal conditions (bounded — WI-491):**
- The holistic review (plus bounded invalidated-lens remediation, if needed)
  returns zero Critical findings, OR
- All findings have documented ACCEPT/REJECT/PARTIAL responses with
  justifications and any disputed product/security authority has an owner ruling.

**HARD 3-round cap.** Convergence is by DISPOSITION, never by the adversarial
reviewer running out of findings — an adversarial reviewer does not run dry on a
complex plan, so "loop until zero High" is unreachable and forbidden. Run at most
**3** adversarial rounds. After round 3 (never start round 4):
- **Unresolved Critical remain →** escalate to the owner; Criticals always block.
- **Only High/Medium/Low remain →** the loop TERMINATES. Every remaining High is
  dispositioned now (`fixed` with candidate-bound proof, `accept-with-justification` = logged execution-time risk in
  `review-log.yaml`, or `reject-with-justification`), and the plan PROMOTES. A
  flat rubric_score across rounds is a diminishing-returns signal — apply the cap,
  do not re-loop. (Origin: WI-486 plan looped 9 rounds on 6 persistent High / 0
  Critical — the exact bug this cap closes.) This bounded exit is enforced
  mechanically by `scripts/check-review-round-cap.mjs`; `review-log.yaml` MUST
  record machine-readable `rounds_run`, `unresolved_critical`, and
  `remaining_high` integers, and — when `rounds_run == 3` and High findings
  remain — a `bounded_exit` block that enumerates one `residual_highs` entry per
  remaining High plus an allowed `disposition` (a bare `bounded_exit` mention
  proves nothing; the checker fails closed on missing/ambiguous evidence). An
  unresolved Critical is never dispositioned: it requires an exact
  `terminal_state: ESCALATED_TO_USER` and the checker HALTS (exit 3, blocking) —
  the change never promotes until the owner rules. A 4th round is forbidden, so
  `bounded_exit` is recorded at `rounds_run == 3`, never `> 3`.

**Audit trail:** all findings + responses persisted to `docs/plans/<date>-<name>/review-log.yaml`. Review log is part of the plan deliverable and lands with it into `docs/plans/done/`.

**Reviewer family tracking:** The `reviewer_family` field logs which model family performed the holistic review. Over time this enables outcome calibration without adding routine reviewers. Historical pair examples remain useful benchmark data:
- `openai → moonshot` (Codex → Kimi)
- `moonshot → openai` (Kimi → Codex)
- `openai → anthropic` (Codex → Sonnet) — medium signal, same broad architectural lineage

## Triggers for lens remediation or owner authority

- Accepted correction changes a reviewed relevant digest → recheck that lens.
- Disputed Critical/High product or security-authority choice → owner decision.
- Unchanged lens → reuse its exact review evidence; never rerun the full package
  merely because another lens changed.

## Cost envelope

- Tier 1: $0, ~3s
- Tier 2 holistic stage: ~$0.01-0.05 baseline (provider-dependent)
- Invalidated-lens remediation: bounded and measured separately

Expected per plan: compiled Gate 1 once, one holistic Gate 2, and only changed-lens remediation. The exact cost is recorded from the launcher rather than fixed in prose.

## What the protocol is NOT

- Not a taste review. Reviewers check determinism, completeness, correctness — not "is this the prettiest architecture."
- Not a security audit. `review-security` is separate; review-plan's only security-ish check is forbidden-pattern scanning.
- Not a lane-level review. Pipeline-level architectural review happens at G3/G5 via `review-gate`; this is specifically the plan-is-unambiguous-before-MiMo-executes gate.

### Fixed plan certification closeout
At exactly three authoritative plan rounds, failed certifications may be closed
with `certification_failure_census` in the existing bounded-exit receipt. Each
entry must exactly match the signed key, reviewer family and reviewed plan SHA;
map only to fixed non-Critical terminal findings; and carry hash-verified proof
binding the certification key and every mapped finding to the corrected final
candidate and nested result bytes. The builder derives signed identity fields.
Missing, extra, duplicate, stale, malformed, unfixed or unmapped entries reject.
All terminal Highs must match the single `fixed` review-log disposition. The
round-cap checker validates log shape; the common evidence verifier authorizes
admission. Unread dependencies and failed execution certifications still block.
Keep raw findings and issuance history unchanged; the closeout is pass-with-acks.

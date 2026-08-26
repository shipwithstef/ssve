# SVC Plan Review Request — WI-SSVE-ARCHITECTURE-EVOLUTION-02

You are an independent adversarial plan reviewer for the svc framework (SSVE). Review the PLAN DOCUMENT below BEFORE any implementation. Your verdict gates dispatch of execute-changeset.

## What you are reviewing

- **Work item:** WI-SSVE-ARCHITECTURE-EVOLUTION-02 — SSVE Framework Architecture Evolution & Performance Preservation
- **Plan:** `docs/plans/2026-08-24-ssve-architecture-evolution-plan.md` (embedded below)
- **Feasibility audit feeding the plan:** `docs/specs/audits/2026-08-24-ssve-evolution-feasibility-audit.md` (verdicts: ADOPT-adapted ×3, REJECT-and-supersede ×1)
- **Source improvement protocol (residual items only):** `docs/specs/audits/2026-08-23-improvement-protocol-multi-agent-handoff-and-verification-receipts.md` — items SR-1/SR-3, SR-4, HW-7, HW-6/IP-R6. Items IP-H1…H7, IP-R1–R5/R9, IP-W1–W3 were ALREADY landed by WI-562 (verify against git log if needed); re-demanding them is a review error.
- **Machine contract:** `docs/plans/2026-08-24-ssve-architecture-evolution-plan/plan-contract.json` + `manifest.md` (living documents; amendment protocol stated in both).

## Design directive you must enforce

**Zero compromise on agent velocity.** The owner's standing directive: integration must NOT slow agent execution or add governance bureaucracy. The plan's §0.1 rejected-alternatives ledger is binding context: do not re-propose rejected machinery (declarative migration engine, gate renumbering, dual gate namespaces, in-file manifest hash, registry JSON-Schema layer, new blocking hooks) without NEW evidence those rejections are wrong.

## Review lenses (apply each; cite file:line evidence for every finding)

1. **Completeness** — does the plan fully disposition all four residual items? Any silent scope drops?
2. **Correctness** — are the proposed mechanisms sound? (segments-derived-view shape vs consumers; digest sidecar semantics; subtractive-rebuild equivalence for Claude wirer incl. kimi strip + company-hook prune + DISABLED interplay; Cursor afterFileEdit / Grok PostToolUse payload reality.)
3. **Security / fail-closed bias** — do any changes weaken fail-closed postures? Does the manifest-integrity stamp have a bypass? Does wirer normalization risk destroying user state irrecoverably?
4. **Backwards compatibility** — exported shapes (SEGMENTS field names, CLI verbs/flags/exit codes), legacy installs converging in one run, validator fixtures referencing deleted internals.
5. **Verifiability** — is every wave's acceptance mechanically checkable via the declared validation commands? Are D-1/D-2 decision points falsifiable?
6. **Velocity preservation** — any hidden runtime or ritual cost that violates the directive?

## Required output format (strict)

```
VERDICT: APPROVE | NEEDS_FIX
RUBRIC_SCORE: <number 0–10>
FINDINGS:
<N>. [SEVERITY: CRITICAL|HIGH|MEDIUM|LOW] [LENS] <finding>; evidence: <file:line or quoted plan text>; required change: <concrete instruction>.
...
SUMMARY: <one paragraph>
```

Rubric anchors: 0 = plan dangerous or incoherent; 5 = implementable but with HIGH gaps; 8 = minor MEDIUM findings only; 10 = promote as-is. Per protocol: rubric 10 AND zero findings ⇒ PROMOTE. Every finding must carry evidence and a required change; findings without both are invalid.

## Plan document follows

<<<PLAN_DOCUMENT>>>

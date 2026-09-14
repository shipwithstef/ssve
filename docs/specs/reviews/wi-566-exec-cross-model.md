# Execution review: WI-566 bounded-review receipt parity

## Frozen review contract

The execution review covers the complete diff from base
`981005eb9127237d5c5e3a259ee023965ee15dfd` through the staged WI-566
candidate. The immutable full-candidate findings under
`.svc/external-review-artifacts/exec-grok-concluding/` and corrected-delta
findings under `.svc/external-review-artifacts/exec-grok-final-delta/` together
are the authoritative independent result. This document records the submitter
evaluation and stable verification contract without rewriting reviewer bytes.

## Advisory station findings

The owner-configured Codex/Sol advisory station returned three findings. All
were accepted and corrected before independent release review:

| ID | Severity | Evaluation and correction |
|---|---|---|
| `WI566-EXT-001` | Critical | Accepted. Legacy receipt-path bytes are now digest-verified, immutable object fallback is mandatory, unavailable potentially in-cycle legacy evidence fails closed, and issuance stores the immutable object before publishing its marker. A corrupted-path/unavailable-object regression proves inventory and round-four issuance reject. |
| `WI566-EXT-002` | Medium | Accepted. The shared schema validator now enforces `uniqueItems`; duplicate rubric finding IDs reject. |
| `WI566-EXT-003` | Medium | Accepted. Exec builder configs require `diff_hash`, complete generated bodies are schema-validated, and positive/negative exec-builder cases are covered. |
| `WI566-EXT-004` / Grok `F-001` | Critical / High | Accepted. Every bounded exec round and declared round subject must now equal the recomputed final promotion digest; the builder rejects stale exec rounds. |
| `WI566-EXT-005` | High | Accepted. Passing plan evidence now binds the enclosing WI and an explicit reviewed-plan digest (or the promotion digest for legacy same-subject receipts); cross-WI replay rejects. |
| `WI566-EXT-006` | High | Accepted. Signed provenance classifies advisory versus independent stations. Only independent stations consume the three-round sequence and bounded inventory; advisory receipts remain panel evidence without failing cross-family authority. |
| Grok `F-002` | High | Accepted. Unavailable legacy markers fail only when authenticated fields or a declared round digest make them potentially in-cycle; an unrelated broken legacy marker cannot poison another cycle. |
| Grok `F-003` | High | Accepted. A receipt carrying a WI must derive a valid cycle before marker publication; derivation errors are no longer swallowed. |
| Grok `F-004` | Low | Accepted. The truncated `review-exec` operator instruction now states the intended immutable-reviewer-bytes rule. |
| `WI566-EXEC-001` | High | Accepted. Every bounded plan body now carries `reviewed_plan_digest`, equal to the terminal phase-guarded reviewed subject; the builder emits it and a stale terminal-plan binding rejects. |
| `WI566-H1` | High | Accepted. High/rubric evidence is now structured and binds WI, promotion digest, exact finding/rubric IDs, verification method, passing result, and a separately hash-verified result artifact; generic evidence rejects. |
| `WI566-H2` | High | Accepted. HMAC-signed cycle-classification sidecars are written at issuance and backfilled while legacy bytes are readable, so later receipt loss cannot undercount a classified plan round. |
| `WI566-M1` | Medium | Accepted. A modern marker signed as advisory is excluded before receipt recovery; damaged advisory artifacts cannot block the independent inventory. |
| Grok `WI566-EXEC-013` | High | Accepted in part. Signed classification now skips a known different WI/kind before candidate-digest recovery, including same-tree/different-WI loss. HMAC mismatch remains a deliberate authority-root integrity stop because untrusted marker fields cannot safely prove unrelatedness. |
| Grok `WI566-EXEC-014` | Medium | Accepted. Provenance now uses the same canonical `familyOf` mapper as receipt verification; reduced-runtime fixtures copy that dependency. |
| Concluding Sol `WI566-H1` | High | Accepted. A signed classification is now bound to the request ID under which it is loaded, and every overlapping classification/issuance identity field must agree. Copying a valid advisory sidecar over an independent request now fails both inventory and subsequent issuance closed. |
| Concluding Grok `BE-001` | Medium | Accepted as residual under the three-round cap. The current Example Marketplace path deliberately uses one uniform `accept-with-justification` disposition for all residual Highs, so mixed per-finding dispositions are outside this closeout. A follow-up may either model per-ID log dispositions or constrain the schema to the uniform contract. |
| Concluding Grok `BE-002` | Low | Accepted as residual under the three-round cap. All authoritative emitters execute `verifyReviewerEvidence`, which applies the bounded-exit schema and semantic validator; adding parent-schema `$ref` parity remains a defense-in-depth follow-up. |

Advisory artifacts:

- Findings: `.svc/external-review-artifacts/exec-sol-round1/findings.json`
- Receipt: `.svc/external-review-artifacts/exec-sol-round1/receipt.json`
- Corrected-tree advisory findings: `.svc/external-review-artifacts/exec-sol-round2/findings.json`
- First independent findings: `.svc/external-review-artifacts/exec-grok-round1/findings.json`
- Final advisory station: `.svc/external-review-artifacts/exec-sol-final/`
- Final independent station: `.svc/external-review-artifacts/exec-grok-final/`
- Concluding advisory station: `.svc/external-review-artifacts/exec-sol-concluding/`
- Concluding independent station: `.svc/external-review-artifacts/exec-grok-concluding/`
- Corrected-delta advisory station: `.svc/external-review-artifacts/exec-sol-final-delta/`
- Corrected-delta independent station: `.svc/external-review-artifacts/exec-grok-final-delta/`

## Corrected-candidate verification

- Bounded-exit focused validator: pass.
- Reviewer-evidence validator: pass.
- Retroactive-attestation validator: pass.
- Contract validation: 670 passed, 0 failed.
- External launcher validation: 165 passed, 0 failed.
- Swapped signed-classification regression: pass for both inventory and issuance.
- Structured Example Marketplace replay example: promotion tree digest and result-artifact hash bound.
- Full candidate suite: 339 passed, 25 failed, 0 timed out.
- Exact corrected-tree clean replay of
  `validate-stop-hook-session-isolation.sh`: all five checks pass.

The remaining full-suite failures are exact-base host/session-state debt. The
independent Grok station must report zero unresolved Critical findings; every
other finding must be fixed or explicitly dispositioned under the three-round
cap before a review receipt may authorize the implementation audit.

# Analysis: WI-510 Phase-Receipt Skip Integrity

## Tradeoff Matrix

| Criterion | A1 any phase array | A2 inline patches | B1 shared classifier | B2 cached classifications | C1 compose validators | C2 broad refactor | D1/D2 history/waiver |
|---|---|---|---|---|---|---|---|
| PSR-01 WI-498 executed receipt | PASS | PASS | PASS | PASS | FAIL: unrelated delivery-graph error | PASS | PASS by mutation/waiver |
| PSR-03 mismatched skill | FAIL | possible | PASS | PASS | partial | PASS | unchanged |
| PSR-04 malformed phases | FAIL | duplicated | PASS | PASS | receipt validator advisory split | PASS | unchanged |
| PSR-06 safe reference | FAIL | duplicated | PASS | PASS | not composed per task | PASS | unchanged |
| PSR-08 explicit current skip | FAIL | duplicated | PASS | PASS | PASS only at whole-graph level | PASS | bypassed |
| PSR-11 prose-only current claim | FAIL | risky | PASS | PASS | ambiguous | PASS | unchanged |
| PSR-14 canonical legacy rules | ad hoc | ad hoc | PASS | PASS | independent errors leak | PASS | WI-specific |
| PSR-17 history immutability | PASS | PASS | PASS | PASS | PASS | PASS | FAIL for D1 |
| PSR-20 consumer coherence | FAIL | FAIL | PASS | PASS | partial | PASS | FAIL |
| Operational state | none | none | none | new cache | none | none | waiver/history mutation |
| Reversibility | high | medium | high | medium | medium | medium | low governance reversibility |
| Implementation size | XS | M duplicated | M | L | M | XL | XS |

## Eliminated

- **A1:** fails PSR-03–06 and PSR-11–13; it is the forbidden permissive shortcut.
- **A2:** can be made correct once, but fails PSR-20 because semantics remain copied.
- **B2:** satisfies behavior but adds an unnecessary cache/freshness state machine.
- **C1:** the real WI-498 graph fails full delivery-graph validation for an independent reason, so it cannot produce a scoped execution verdict.
- **C2:** technically strong but expands the blast radius beyond the bounded correction.
- **D1/D2:** violate protected-history and no-waiver constraints.

## Finalists

1. **B1 — shared pure classifier.** Meets every MUST criterion with bounded scope.
2. **C2 — refactor existing validators into libraries.** Stronger long-term consolidation, but disproportionate for WI-510.
3. **A2 — precise independent patches.** Viable only if a shared helper is impossible.

## Key differentiator

Can one implementation produce a task-local verdict without inheriting unrelated whole-graph failures and without creating new persisted state? B1 does; the other finalists do not.

## Runner-up value

C2 becomes appropriate if a later WI needs structured per-task outputs from both the delivery-graph and Phase-D validators across multiple consumers.

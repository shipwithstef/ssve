# Analysis: WI-502 durable authority

## Tradeoff Matrix

| Criterion | A1 staged local | A2 SQLite | B1 daemon | B2 remote | C1 sandbox-primary | C2 no shell | D1 patch-only |
|---|---|---|---|---|---|---|---|
| MUST OS-01..10 exact scope | pass | pass | pass | pass | partial; authority semantics absent | pass for file tools only | partial |
| MUST AU-04..07 resume/handover/recovery | pass | pass | pass | pass | fail | fail | fail |
| MUST DG-01..10 child lifecycle | pass | pass | pass | pass | partial | fail for normal execution | partial |
| MUST SB-02..04 honest containment | pass | pass | pass | pass | pass | pass | partial |
| Local-first/offline | pass | pass | pass | fail | host-dependent | pass | pass |
| No new long-lived service | pass | pass | fail | fail | pass | pass | pass |
| Existing code alignment | highest | medium | low | lowest | medium | low | medium |
| Reversible v1 migration | high | medium | medium | low | N/A/incomplete | N/A/incomplete | incomplete |

## Eliminated

- B1/B2 fail the no-service/local-first constraints and add a new availability dependency.
- C1/C2 fail controller lifecycle or normal framework execution ACs.
- D1 fails complete child testing and handover requirements.

## Finalists

1. **A1** — local files + lock/CAS, best alignment and full AC coverage.
2. **A2** — local SQLite, attractive transactions but higher installation/portability burden.
3. **D1** — useful fallback for a host that can return patches but lacks safe child filesystem mutation.

## Key differentiator

Whether the existing secure repository lock and atomic-file primitives can prove revision CAS and race recovery without a database. Current WI-486 bootstrap races and claim generation already demonstrate the primitive, so A1 wins unless implementation fixtures falsify it.

## Runner-up value

A2 becomes preferable only if race fixtures show file-CAS cannot meet one-winner transitions or state inventory becomes too large for bounded local reads.

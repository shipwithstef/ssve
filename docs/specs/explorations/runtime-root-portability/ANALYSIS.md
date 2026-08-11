# Analysis: Secure Runtime-Root Portability

## Tradeoff matrix

| Criterion | A1 shared strict resolver | A2 always home | B1 entry patch | B2 env commands | C1 universal temp | D1 repo-local | E1 daemon |
|---|---|---|---|---|---|---|---|
| MUST RP-01 missing XDG automatic | PASS | PASS | partial | FAIL | PASS | PASS | PASS after daemon starts |
| MUST RP-02 valid XDG compatibility | PASS | behavior change | partial | manual | behavior change | behavior change | behavior change |
| MUST RP-03 unsafe existing root denies | PASS | bypasses signal | inconsistent | depends on human | bypasses signal | N/A but schema risk | depends on service boundary |
| MUST RP-05 one Node policy | PASS | PASS | FAIL | FAIL | PASS | new repo policy | service policy |
| MUST RP-06 shell parity | PASS via CLI | PASS via CLI | FAIL | FAIL | possible | major rewrite | RPC client |
| MUST RP-07 private modes/no `/run/user` create | PASS | PASS | inconsistent | human-dependent | leaf only | repo permissions | socket/store design needed |
| MUST RP-08 predictable preflight | PASS | can PASS | can add | FAIL | can PASS | redesign | can PASS |
| MUST RP-09 exact crash recovery | PASS | same as A1 | can add separately | FAIL | same as A1 | schema redesign | transactional but overbuilt |
| MUST RP-10 compatibility | Highest | lower | low cross-consumer | low | lower | low | low |
| MUST RP-11/RP-12 testability | One matrix | One matrix | fragmented | not deterministic | one matrix | large suite | integration/daemon suite |
| MUST RP-13 install zero drift | Existing install model | existing model | existing model | N/A | existing model | existing model | new service installer |
| MUST RP-14/RP-15 real no-workaround replay | PASS target | PASS target | may fail later consumers | FAIL | likely PASS | risky product residue | service prerequisite |
| SHOULD no dependency/service | PASS | PASS | PASS | PASS | PASS | PASS | FAIL |
| SHOULD smallest long-term support | Best | good | poor | worst | medium | poor | worst |
| Local performance | O(1) metadata + one Stop Node call | same | lowest | lowest | lowest | filesystem local | RPC/daemon overhead |
| Reversibility | High | high | high | N/A | high | medium | low |

## Eliminated

- **A2 always home:** fails RP-02's valid-XDG compatibility and discards useful
  session-lifetime semantics.
- **B1 incident patch:** fails RP-05/RP-06 and only moves the next failure.
- **B2 environment commands:** directly fails the user's permanent-solution bar.
- **C1 universal temp:** meets availability but weakens the authority boundary
  and treats a security signal as irrelevant.
- **D1 repository-local:** violates scope by redesigning authority storage and
  creates product-repository residue/containment risks.
- **E1 daemon:** disproportionate new lifecycle, dependency, and installation
  surface; fails smallest-safe-fix criteria.

## Finalists

1. **A1 — shared strict resolver and exact retry.** Only approach satisfying
   every MUST without an authority schema or service redesign.
2. **C1 — universal OS temp.** Strongest portability and simplest runtime path,
   but loses on security-boundary quality.
3. **D1 — repository-local coordination.** Avoids host paths entirely, but
   loses on isolation, residue, and scope.

## Key differentiator

Can an approach distinguish an unavailable host runtime path from an existing
unsafe path while giving Node and shell identical decisions, without moving
authority into the repo or adding a service? A1 is the only finalist that does.

## Runner-up value

C1 remains valid for purely advisory future state. D1 may be reconsidered only
as a dedicated authority-store redesign with migration and residue contracts,
not as a repair for WI-506.

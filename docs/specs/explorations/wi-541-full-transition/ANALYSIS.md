# Analysis: WI-541 Full Framework Transition

## Tradeoff matrix

| Criterion | A1 shared seams | A2 universal engine | B1 manifest policy | B2 topology hybrid | C1 SQLite plane | C2 service | D1 controller-only | D2 docs-only |
|---|---|---|---|---|---|---|---|---|
| MUST W541-01 denominator | ✅ explicit validator | ✅ | ✅ generated | ✅ partial | ✅ query | ✅ | ⚠️ manual gaps | ❌ |
| MUST W541-02..03 exact chain | ✅ direct pure sequence | ✅ generic | ⚠️ manifest-role ambiguity | ✅ after role decision | ✅ | ✅ | ✅ | ❌ |
| MUST W541-04 Bash guard | ✅ current classifier | ⚠️ generic shell policy | ⚠️ indirect | ✅ current classifier | ✅ | ✅ | ✅ | ❌ |
| MUST W541-05..06 transport | ✅ exact resolver | ✅ | ⚠️ declarations still need probe | ✅ exact resolver | ✅ | ✅ | ❌ mutating path removed | ❌ |
| MUST W541-07..08 recovery | ✅ exact capability/convergence | ⚠️ generic states | ⚠️ risky generated auth | ✅ exact capability | ✅ migration risk | ✅ service authority shift | ❌ | ❌ |
| MUST W541-09..12 plan/review truth | ✅ one typed consumer | ✅ | ⚠️ large policy language | ✅ one typed consumer | ✅ | ✅ | ✅ | ❌ |
| MUST W541-13..14 learning | ✅ normalize and outcomes | ✅ | ⚠️ manifest is wrong store | ✅ | ✅ migration | ✅ | ✅ | ❌ |
| MUST W541-15 envelope | ✅ observable boundary | ⚠️ generic classification | ⚠️ declaration only risk | ✅ | ✅ | ✅ | ✅ if no outward action | ❌ |
| MUST W541-16..22 cleanup/consumption | ✅ consumer audit | ⚠️ engine itself may be inert | ⚠️ generated bulk | ✅ | ⚠️ migration machinery | ❌ local-only | ⚠️ incomplete | ❌ |
| MUST W541-23..25 local proof | ✅ existing suite/install | ⚠️ much larger suite | ⚠️ mirror blast radius | ✅ | ⚠️ new DB install | ❌ external dependency | ❌ AC gaps | ❌ |
| SHOULD zero provider cost | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| SHOULD reversibility | ✅ module/commit revert | ⚠️ engine coupling | ⚠️ manifest migration | ✅ | ❌ data migration | ❌ | ✅ | ✅ |
| SHOULD operator clarity | ✅ domain errors | ⚠️ generic errors | ⚠️ generated indirection | ✅ | ⚠️ DB tooling | ⚠️ service ops | ✅ but incapable | ❌ false assurance |

## Eliminated

- **A2:** no AC requires a generic policy engine; it adds a new abstraction and could itself become unconsumed machinery under W541-22.
- **B1:** current manifest arrays intentionally have different roles, so expanding one into a universal security/runtime policy risks encoding the wrong semantics.
- **C1:** SQLite is technically viable but fails proportionality and reversibility for a bounded set of file-lock and lifecycle gaps.
- **C2:** violates local-only, offline, zero-provider-cost, and no-new-deploy constraints.
- **D1:** fails W541-05..08 because the owner requires safe contained mutation and recoverable promotion, not capability deletion.
- **D2:** fails the central executable-consumer requirement across W541-02..22.

## Finalists

1. **A1 — small pure primitives with existing consumers.** Only approach satisfying all 25 criteria without a new platform or migration.
2. **B2 — generated topology hybrid.** Strong alternative for W541-02..03, but requires a prior decision on which manifest role is the exact mandatory chain.
3. **D1 — controller-only simplification.** Safety benchmark and fallback, but not a complete owner outcome.

## Key differentiator

Can the option close every mandatory criterion while preserving current file-backed authority/audit bytes and adding no new semantic source of truth? A1 passes; B2 cannot yet prove its source array; D1 fails required capability ACs. No implementation prototype is needed to answer this and the owner required implementation only after the bulk plan.

## Runner-up value

B2 is preserved as a later simplification route if a future WI explicitly defines a manifest array whose sole role is the exact mutable delivery chain and proves generator/consumer parity. D1 remains the automatic runtime fallback whenever the complete delegated tuple is unavailable.

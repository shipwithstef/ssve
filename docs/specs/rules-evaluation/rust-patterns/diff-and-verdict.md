# Diff and Verdict — rust/patterns.md

**Rule type:** steering  
**Source:** ECC rules/rust/patterns.md (SHA 125d5e61)  
**Scope:** project  
**Stack:** rust

---

## Diff by Scenario

### S1: Newtype pattern for distinct ID types

**Rule prescribes:** `struct UserId(u64)` + `struct OrderId(u64)` — compiler-enforced type safety at call sites.

**Default said:** ~50% type alias, ~40% newtype, ~10% library. Context-dependent.

**Diff:** Rule collapses a genuine ~50/50 choice (type alias vs newtype) to one convention. For a Rust project, choosing newtypes as the project standard is a real, valuable convention. DG=2.

---

### S2: Enum state machines

**Rule prescribes:** Enum with associated data + exhaustive match + explicit "no wildcard `_` for business-critical enums."

**Default said:** I'd use enums with match consistently (DG=0 for the basic pattern). But the "no wildcard `_` for business-critical enums" is a constraint I'd warn about but not enforce deterministically.

**Diff:** The basic pattern is inflation. The "no wildcard" constraint adds a real check I don't apply consistently. DG=1 for the constraint specifically. Weak signal.

---

### S3: Builder pattern for optional config

**Rule prescribes:** Full builder struct with chained methods + `.build()` finalizer.

**Default said:** ~40% builder, ~40% Default + update syntax, ~15% derive_builder. Real variance.

**Diff:** Rule collapses builder vs Default to builder pattern. DG=1. The code example is verbose (~35 lines of the rule body) for a DG=1 section.

---

### S4: Repository Pattern with Traits / Service Layer / Sealed Traits / API Envelope

**Rule prescribes:** Each section shows one implementation approach.

**Default said:** Repository with traits = standard Rust practice I'd recommend. Constructor DI = always do this. Sealed traits = niche, context-dependent. API envelope = one of several valid approaches.

**Diff:** Repository + Service Layer = inflation (Claude already structures these this way). Sealed Traits = too niche and FC=2 (adds boilerplate explanation to every Rust project even when sealing is unnecessary). API Envelope = minor steering but DG=1.

---

## Scoring

| Axis | Score | Rationale |
|---|---|---|
| determinism_gain | 2 | S1 (Newtype) is the load-bearing section: collapses ~50/50 type-alias-vs-newtype choice. Builder adds marginal DG=1. |
| correctness_delta | 0 | All defaults were correct; this is pure variance-reduction, not error-fixing. |
| friction_cost | 1 | Rule body is long (~80 lines) with many sections. After edit stripping inflated sections, drops to ~35 lines. |
| convention_conflict | 0 | All patterns align with idiomatic Rust. |

**Net: DG=2, CD=0, FC=1, CC=0**

Meets `adopt-with-edits` threshold.

---

## Required Edits Before Adoption

1. **Remove Repository Pattern section** — traits for data access is standard Rust Claude already recommends. Inflation.
2. **Remove Service Layer section** — constructor DI is standard. Inflation.
3. **Remove Sealed Traits section** — too niche and high FC for a per-turn rule. Move to `references/` if needed.
4. **Remove API Response Envelope section** — DG=1, minor steering, but adds ~15 lines of verbatim code. Not worth the cost.
5. **Remove ECC skill reference** — ECC-internal.
6. **Trim Enum State Machines to the "no wildcard" constraint** — the basic enum pattern is inflation; the `_` prohibition is the only non-default directive. Reduce to 2-3 lines.

**Result after edits:** ~30 lines. Three directives: Newtype for IDs (DG=2), Builder for optional config (DG=1), no-wildcard on business-critical enums (DG=1). Lean.

---

## Verdict

**`adopt-with-edits`**

The Newtype pattern section is the sole load-bearing directive — it collapses a real 50/50 decision. Builder pattern adds marginal steering. The four inflation sections (Repository, Service Layer, Sealed Traits, API Envelope) should be stripped. After edits, this is a ~30-line rule with genuine convention value for Rust projects.

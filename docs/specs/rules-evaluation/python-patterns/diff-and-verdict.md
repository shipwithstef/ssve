# Diff and Verdict — python/patterns.md

**Rule type:** steering  
**Source:** ECC rules/python/patterns.md (SHA 125d5e61)  
**Scope:** project  
**Stack:** python

---

## Diff by Scenario

### S1: Python interface / repository pattern

**Rule prescribes:** `typing.Protocol` with a concrete code example showing a `Repository(Protocol)` with typed methods.

**Default said:** 40% Protocol, 35% ABC, 15% duck typing, 10% runtime_checkable. Real variance.

**Diff:** Rule collapses a genuine 3-way choice (Protocol vs ABC vs duck typing) to Protocol. This is a real convention — choosing "this project uses Protocol for structural interfaces" eliminates ongoing per-PR debates. DG=2.

---

### S2: Python DTO

**Rule prescribes:** `@dataclass` for data transfer objects.

**Default said:** 40% Pydantic, 35% @dataclass, 15% TypedDict. Context-dependent.

**Diff:** Rule steers toward @dataclass. This collapses some variance (DG=1) but doesn't fully account for "when you're in a FastAPI project and Pydantic is already present." The rule doesn't say "for internal DTOs not crossing API boundaries" — it just says @dataclass. Minor CC risk for Pydantic-heavy projects. DG=1, CC=1.

---

### S3: Context Managers & Generators

**Rule prescribes:** "Use context managers for resource management, generators for lazy evaluation." (Prose only, no code.)

**Default said:** This is the most embedded Python behavior. I apply context managers automatically.

**Diff:** Zero behavior change. Pure inflation. DG=0, CD=0.

---

## Scoring

| Axis | Score | Rationale |
|---|---|---|
| determinism_gain | 2 | S1 (Protocol) is the load-bearing section: collapses 3-way interface-pattern variance. |
| correctness_delta | 0 | All defaults were correct; pure variance-reduction. |
| friction_cost | 0 | File is very thin (~15 lines of actual content after header). After stripping Context Managers, ~10 lines. |
| convention_conflict | 0 | Protocol and @dataclass are both valid idiomatic Python. Dataclass edit note below handles the Pydantic edge case. |

**Net: DG=2, CD=0, FC=0, CC=0**

Meets `adopt-with-edits` threshold. (Raw scores technically meet `adopt-as-is` but the Dataclass section needs a scope qualifier and the Context Managers section needs to go — that's why adopt-with-edits.)

---

## Required Edits Before Adoption

1. **Remove Context Managers & Generators section** — pure inflation. DG=0.
2. **Scope the Dataclass section** — add a note: "Use @dataclass for internal DTOs. For types that cross API boundaries or need validation, prefer Pydantic BaseModel." This prevents conflict with FastAPI/Pydantic projects while keeping the steering value.
3. **Remove ECC skill reference** — ECC-internal.

**Result after edits:** ~12 lines. Two directives: Protocol for structural interfaces (DG=2), @dataclass for internal DTOs scoped correctly (DG=1).

---

## Verdict

**`adopt-with-edits`**

The Protocol section is the only load-bearing directive — it resolves real ABC-vs-Protocol-vs-duck-typing variance to one project convention. Thin rule, low token cost, genuine steering value. Strip the Context Managers prose (inflation) and scope the @dataclass claim to avoid conflict with Pydantic projects.

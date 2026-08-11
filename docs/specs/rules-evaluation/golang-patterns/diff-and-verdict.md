# Diff and Verdict — golang/patterns.md

**Rule type:** steering  
**Source:** ECC rules/golang/patterns.md (SHA 125d5e61)  
**Scope:** project  
**Stack:** golang

---

## Diff by Scenario

### S1: Go constructor with many optional configuration parameters

**Rule prescribes:** Functional options pattern, with explicit code example showing `Option func(*Server)` + `WithPort` + `NewServer(opts ...Option)`.

**Default said:** 2-3 valid approaches: config struct (most common for internal), functional options (preferred for library/external callers), builder pattern (rare in Go). Context-driven choice.

**Diff:** The rule collapses 3 valid approaches to one. It doesn't say "prefer this for library code" — it just shows functional options as *the* Go pattern for constructor configuration. A developer reading this rule in project context would default to functional options.

**Verdict on this section:** Real steering value. Functional options vs config struct is a genuine decision point where Go code in different hands diverges. Collapsing to functional options for this project is a valid convention. **DG: 2**

---

### S2: Where to define a Go interface

**Rule prescribes:** "Define interfaces where they are used, not where they are implemented." (4 words, no example)

**Default said:** Same thing — define at the consumer site, keep them small. This is established Go doctrine I apply consistently.

**Diff:** None. The rule restates Go standard practice that Claude already applies.

**Verdict on this section:** Rule inflation. This section doesn't change behavior. **DG: 0, CD: 0**

---

### S3: Dependency injection

**Rule prescribes:** Constructor injection with explicit types. 3-line code example `func NewUserService(repo UserRepository, logger Logger) *UserService`.

**Default said:** Same — constructor injection, explicit types, no DI framework unless already present.

**Diff:** None. The code example is illustrative but the pattern is what Claude already produces.

**Verdict on this section:** Rule inflation. **DG: 0, CD: 0**

---

## Scoring

| Axis | Score | Rationale |
|---|---|---|
| determinism_gain | 2 | S1 (functional options) is a real variance-reduction: 3 valid Go approaches → 1 project convention. S2 and S3 are already deterministic. |
| correctness_delta | 0 | All three defaults were correct; the rule doesn't catch errors. |
| friction_cost | 0 | Short rule, no checklist overhead. |
| convention_conflict | 0 | Aligns with Go idioms. |

**Net: DG=2, CD=0, FC=0, CC=0**

Meets `adopt-with-edits` threshold (DG ≥ 2, FC ≤ 1, CC ≤ 1) — but only because of S1. S2 and S3 are inflation that should be stripped.

---

## Required Edits Before Adoption

1. **Remove the "Small Interfaces" section entirely.** It restates Go doctrine Claude already applies consistently. Zero behavior change, pure token cost.

2. **Remove the "Dependency Injection" section entirely.** Constructor injection is standard Go practice. Zero behavior change.

3. **Scope the rule to its actual value:** Functional Options is the steering claim. Rename rule body to make this explicit — "For Go constructors with optional config, use the functional options pattern" — with the existing code example kept.

4. **Remove the ECC skill reference** ("See skill: `golang-patterns`") — that's an ECC-internal reference, not applicable in svc.

**Result after edits:** ~15 lines with one steering directive and one code example. A genuinely lean rule that changes one decision without burning tokens on two non-decisions.

---

## Verdict

**`adopt-with-edits`**

The functional options section earns its per-turn token cost: it resolves a genuine 3-way ambiguity (config struct vs functional options vs builder) to a project convention. The interface and DI sections do not earn it — strip them. After edits, this is a valid single-directive steering rule for Go projects.

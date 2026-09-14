# Default Transcript — python/patterns.md

> Pass 1 elicited before deep-reading rule content.
> Contamination caveat: rule was fetched into context for evaluation; defaults below are from first-principles Python knowledge.

## Scenario 1: Python developer needs a repository interface with multiple implementations (Postgres in prod, in-memory for tests)

**Prompt:** In Python, how would you define a repository interface that multiple storage backends can satisfy? What approaches across 10 projects?

**Default response:**

Across 10 projects I'd reach for:
- ~40%: `typing.Protocol` — structural subtyping, no inheritance required. Modern Python (3.8+).
- ~35%: `abc.ABC` + `@abstractmethod` — explicit, inheritance-based, more OOP-idiomatic
- ~15%: No interface at all — pure duck typing, just document the expected methods
- ~10%: `typing.runtime_checkable` Protocol for `isinstance()` support

There is real variance here. Protocol is increasingly preferred in typed Python codebases but ABC is still common. I'd suggest Protocol for new code but I'm not deterministic about it.

---

## Scenario 2: Python developer needs a simple data transfer object for a CreateUser request (name, email, optional age)

**Prompt:** In Python, how would you model a simple DTO with typed fields? What approaches across 10 projects?

**Default response:**

Across 10 projects:
- ~40%: Pydantic `BaseModel` — validation + serialization, especially for API/FastAPI projects
- ~35%: `@dataclass` — lighter, stdlib only, good for internal DTOs without validation
- ~15%: `TypedDict` — dict with type hints, no class instantiation overhead
- ~10%: `NamedTuple` — immutable, tuple-like access

Without project context, I'd ask "does this cross an API boundary?" and suggest Pydantic if yes, @dataclass if no. There's genuine variance.

---

## Scenario 3: Python developer is managing a file or database connection in code

**Prompt:** In Python, what pattern do you use for managing resources like file handles or database connections?

**Default response:**

`with` statement / context managers — this is so embedded in Python it's essentially a non-decision. I apply it automatically. Not worth a rule.

---

## Summary

Real variance: S1 (Protocol vs ABC vs duck typing) and S2 (Pydantic vs dataclass vs TypedDict). Already deterministic: S3 (context managers — pure inflation).

# Default Transcript — typescript/patterns.md

> **Contamination notice:** Rule content fetched before evaluation.

## Scenarios covered

1. Designing an API response structure in TypeScript
2. Writing a React custom hook with debouncing
3. Designing a data access layer

---

## Pass 1 — Default behavior (no rule context)

**Scenario 1 — API response structure:**
My default is flexible. I often use `{ data, error }` or `{ ok, data, message }`.
I know the envelope pattern but don't mandate a specific shape with `success`,
`meta`, etc. I'd adapt to project conventions or suggest a consistent envelope
if asked to design from scratch.

**Scenario 2 — debounce hook:**
I know the `useDebounce` pattern well and would implement it with
`useState` + `useEffect` + `setTimeout`. I'd type it generically (`<T>`).
This is my standard implementation.

**Scenario 3 — data access layer:**
I'd suggest a repository pattern with consistent CRUD operations. The specific
interface shape (findAll, findById, create, update, delete) is what I'd naturally
propose for a clean data layer. This is a default architectural recommendation.

# Default Transcript — common/coding-style.md

> **Contamination notice:** Rule content fetched before evaluation.

## Scenarios covered

1. Choosing between simple and clever solution
2. Organizing files in a project
3. Handling errors in code
4. Naming variables/functions/constants

---

## Pass 1 — Default behavior (no rule context)

**Scenario 1 — simple vs clever:**
I always prefer the simpler solution. KISS/DRY/YAGNI are principles I follow
without prompting. I explicitly push back on premature optimization and
speculative abstractions. These are core defaults.

**Scenario 2 — file organization:**
I prefer smaller, cohesive files. I'd say "200-400 lines is typical" and
"800 lines is getting large." I prefer feature/domain organization over
type-based organization. These thresholds are in my range of defaults.

**Scenario 3 — error handling:**
I handle errors explicitly. I never silently swallow them. I provide context
in logs. This is a deeply ingrained default.

**Scenario 4 — naming:**
I use camelCase for functions/variables, PascalCase for classes/interfaces/types,
UPPER_SNAKE_CASE for constants, `is`/`has`/`should` prefixes for booleans,
`use` prefix for hooks. These are standard conventions I follow by default.

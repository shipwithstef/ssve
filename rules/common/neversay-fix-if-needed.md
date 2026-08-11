# Rule: Never Say "Fix If Needed"

Every code change and commit in a Serious Vibe Coding (svc) repository must be deliberate, verified, and necessary. The phrase "fix if needed" (or "fix if-needed") is speculative and ambiguous, indicating a lack of certainty about the root cause or the necessity of the fix.

## Rationale

1. **Deterministic Engineering**: We aim for deterministic development. Applying a "fix if needed" means the engineer (or agent) is unsure whether there is an actual problem or whether the proposed change solves it.
2. **Definitive Commit History**: Commits are permanent records of changes. They must describe concrete, verified modifications. Speculative commit messages like "fix if needed" introduce noise and make debugging history difficult.
3. **Prevention of Speculative Side-Effects**: Blindly adding conditional fixes "just in case" frequently introduces silent regressions and unexpected interactions in other parts of the codebase.

## Mechanical Enforcement

The git commit hook in `hooks/svc-workflow-guard.mjs` case-insensitively blocks any commit message matching the pattern:
```regex
\bfix\s+if[- ]needed\b
```

Any commit attempting to use this phrase will be blocked with exit code 2.

## Actionable Alternatives

| Speculative Message (BLOCKED) | Definitive Message (ALLOWED) |
|--------------------------------|------------------------------|
| `git commit -m "fix if-needed in auth hook"` | `git commit -m "fix input validation in auth hook to prevent empty-string panic"` |
| `git commit -m "add error check, fix if needed"` | `git commit -m "add explicit error handling for missing config files"` |
| `git commit -m "tweak build script, fix if needed"` | `git commit -m "update build script output path to resolve packaging drift"` |

## Origin

WI-FRAMEWORK-EVOLVE-REFINEMENT (2026-05-21): Refined framework evolution policies to enforce high-signal, zero-speculation changes and keep git history fully actionable.

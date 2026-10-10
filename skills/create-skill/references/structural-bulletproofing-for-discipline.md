# Structural Bulletproofing (for discipline-enforcing skills) — detail

Moved verbatim from SKILL.md (progressive disclosure).

## Structural Bulletproofing (for discipline-enforcing skills)

When creating skills that enforce discipline (TDD, debugging protocols, scope
prohibition, verification requirements), add two structural elements that
empirically double compliance (Meincke et al. 2025, N=28,000: 33% → 72%).

### Rationalization Table

A table where each row names a specific thought the agent might have and
provides a rebuttal. This preemptively shuts down the exact rationalizations
that lead to skipping the skill's rules.

```markdown
| Thought | Reality |
|---------|---------|
| "This is too simple for TDD" | Simple things become complex. The test takes 30 seconds. |
| "I already know this works" | Knowing ≠ proving. Write the test. |
| "I'll add the test after" | After never comes. Every "after" is a lie. |
```

The key: name the SPECIFIC thought, not a general category. "Agent skips the
rule" is too vague. "Agent thinks 'this is a one-line fix, TDD is overkill'"
is specific enough to rebut.

### Red Flags List

Observable behaviors that indicate the rule was broken, each mapped to a
corrective action:

```markdown
**Red Flags:**
- You wrote implementation code before a test exists → Delete the code, write the test first
- You "adapted" existing code instead of starting from the test → Delete and start over
- You ran the test and it passed on the first try → The test is not testing real behavior
```

### When to use

- **Discipline skills** (TDD, debugging, verification, scope control): always
- **Guidance skills** (knowledge protocol, context budget): never — these don't
  need behavioral compliance enforcement
- **Routing skills** (route-workflow): rarely — only if there's a specific
  skip-justification pattern observed

The technique: "implementation intentions" — specific "When you think X, do Y"
rules beat general "always do Y" rules. The rationalization table IS
implementation intentions.

Source: superpowers writing-skills, test-driven-development, systematic-debugging

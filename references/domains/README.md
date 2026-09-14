# Domain Reference Packs

Domain-specific knowledge that the LLM may lack for a given tech stack or framework version.

## What These Are

Markdown files containing conventions, patterns, and version-specific details for frameworks and libraries. They are NOT svc skills — they don't have pipeline positions, chain behavior, or self-verification. They are context packs that `execute-changeset` loads when the tech stack matches.

## When to Create One

When the `research` skill finds that a domain needs persistent reference material (not a one-off finding), create a pack here. Triggers:

- A framework version is recent enough that the LLM's training data may be stale
- A project uses unconventional patterns that differ from community defaults
- Multiple research findings cluster around the same domain

## Structure

```
domains/
  <framework-version>/
    conventions.md    — naming, annotations, config patterns
    testing.md        — test framework, patterns, fixtures
    gotchas.md        — common pitfalls, breaking changes from prior version
```

## How They Load

`execute-changeset` checks `package.json` (or equivalent) at the start of execution:

1. Detect major frameworks and their versions
2. Check `references/domains/` for a matching pack
3. If found, read the relevant files into context before task execution

This is automatic — no flag needed.

## Examples (create when needed)

- `spring-boot-3/` — annotation changes from Boot 2, new config patterns, Testcontainers
- `react-19/` — server components, use() hook, compiler mode
- `next-15/` — app router, server actions, turbopack
- `k8s-operator/` — controller-runtime patterns, reconcile loop

## NOT In Manifest

Domain packs are NOT listed in `skills-manifest.json`, NOT in `includedSkills`, and NOT validated by the lint script. They are just markdown files.

## Phase 3 — Produce the blend plan

Each blend item must be a self-contained argument, not a summary bullet. A reader
who sees only the blend plan (not this conversation) must understand WHY each
pattern matters, WHAT breaks without it, and WHAT changes after. If a blend item
can't be argued convincingly, it shouldn't be blended.

For each BLEND item, specify ALL of these sections:

- **From / Into** — source file:line and target svc file:section
- **The problem in svc today** — what currently happens that this pattern fixes.
  Name the specific failure mode with a concrete scenario. "Reviews are inefficient"
  is too vague. "Reviewer spends tokens noting naming inconsistencies while 3 of 10
  ACs are unimplemented — quality review on code that may be rewritten" is specific.
- **How the source solves it** — the mechanism, not just "they do X." Explain the
  design choice and why it works.
- **What this changes in svc** — concrete before/after. What does the svc skill
  look like before and after the blend? Which section changes? What new checks,
  rules, or patterns are added?
- **What NOT to take** — parts to skip and why (conflicts with svc doctrine,
  duplicates existing behavior, or not applicable to svc's architecture)
- **Why this matters** — the argument. Connect the failure mode to real impact
  (wasted tokens, bugs shipped, quality regression, missed requirements). Include
  evidence from the source if available (production incidents, empirical findings,
  test results).

Output: `proposals/<date>-blend-<source-name>.md`

```markdown
# Blend Plan: <source-name>

**Source:** <repo-url>
**SHA:** <commit-sha>
**Date:** <today>
**Previous blend:** <last-sha or "first blend">

## Summary

<N patterns to blend, M to skip, P already present>

| # | Pattern | Target | What breaks without it | What changes after |
|---|---------|--------|----------------------|-------------------|
| 1 | <name> | <svc file> | <concrete failure scenario> | <specific change to svc> |
| 2 | ... | ... | ... | ... |

## Blend items

### 1. <Pattern name> → <target svc skill>

**From:** <file:line in external repo>
**Into:** <svc skill file:section>

**The problem in svc today:**
<What currently happens. Name the failure mode with a concrete scenario — inputs,
behavior, wrong outcome. Read the target svc file first to describe the current
state accurately.>

**How the source solves it:**
<The mechanism. Why it works. Design choice rationale. Evidence if available
(production incident, empirical finding, test result from their repo).>

**What this changes in svc:**
<Concrete before/after. Which section of which file changes. What new checks,
rules, or patterns are added. Be specific enough that someone could implement
this from the blend plan alone.>

**What NOT to take:**
<Parts to skip and why — conflicts, duplicates, or not applicable.>

**Why this matters:**
<The argument for this blend item. Connect failure mode to impact. If the source
has empirical evidence (test results, production incidents), cite it.>

---
(repeat for each blend item)

## Assessment A: Blend Opportunities
(Techniques, patterns, test approaches to absorb — as above)

## Assessment B: External Addon Viability

**Runtime addon?** YES / NO / PARTIAL
**License:** <license name>
**Install:** `<install command>`

**Integration point:**
<Where in the svc pipeline this attaches. Which skills invoke it, what
shared files or env vars are needed, execution order relative to svc skills.>

**Interop contract:**
<Shared file paths, canonical output locations, env vars, how svc skills
discover and consume the addon's output.>

**What svc should NOT rebuild:**
<Capabilities the addon provides that svc should use rather than duplicate.>

**What svc should still own:**
<Capabilities where svc's approach is better or where pipeline integration
requires svc-native implementation.>

**EXTERNAL_ADDONS.md draft:**
```markdown
## Add-On: <name> (optional)
<description, install, integration, interop rules>
```

(Omit this section if addon assessment is NO. Include even if PARTIAL —
explain what parts are addon-viable and what parts are blend-only.)

## Skipped items
| External | Reason for skip |
|----------|----------------|
| ... | ... |

## Rethink: past blend reassessment
(Only in rethink/audit mode. Omit if first blend.)

### Blended patterns reassessed
| Pattern | svc skill | Verdict | Action |
|---------|-----------|---------|--------|
| ... | ... | KEEP / IMPROVE / SIMPLIFY / REPLACE | ... |

### Skipped patterns reconsidered
| Pattern | Original skip reason | Reassessment | Action |
|---------|---------------------|--------------|--------|
| ... | ... | KEEP SKIP / RECONSIDER | ... |

## Attribution update
<What to add to NOTICES>
```

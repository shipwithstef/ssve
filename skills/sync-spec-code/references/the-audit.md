# The Audit — detail

Moved verbatim from SKILL.md (progressive disclosure).

### Step 4b — Audit Code Against Journey Requirements

Journeys are the source of truth for what the product SHOULD do. Specs detail
how. Code implements. This step checks whether the code actually supports what
the journeys need — not just what the spec describes.

```bash
# Find journeys that reference this feature spec
grep -l "feature-name" docs/specs/journeys/*.feature.md 2>/dev/null
```

For each journey that covers this feature:

1. **Read the journey's Background and Given steps.** These are preconditions
   the journey assumes the code supports.

2. **Read the journey's Journey Analysis section** (if it exists). Look for
   Ungrounded Preconditions, Logical Issues, and Product Gaps that reference
   this feature.

3. **Check each precondition against the code:**
   - Does the entity/field the journey assumes actually exist in the schema?
   - Does the UI the journey describes actually render that state?
   - Does the backend validation the journey assumes (plan limits, permissions)
     actually run on the code path the UI uses?
   - Do the side effects the journey expects (notifications, cache updates)
     actually fire?

4. **Flag journey-code gaps** with a new annotation type:

```
> - **[PREFIX]-N JOURNEY-GAP YYYY-MM-DD:** Journey J07 assumes [behavior] but code [doesn't support it / bypasses it / uses wrong field] — [file:line]
```

JOURNEY-GAP is different from DRIFT. DRIFT means "spec says X, code does Y."
JOURNEY-GAP means "the journey needs X to work, but the code doesn't provide
it — and the spec may not even mention it." These are the gaps that only
become visible when you trace from journey → spec → code.

This is the check that catches: "the customer claim journey assumes flash deals
exist, but the only creation UI bypasses the security middleware that sends the
push notifications the customer journey depends on."

### Step 4c — Write Missing Spec Coverage

Steps 4 and 4b find what's wrong. This step **writes** what the spec SHOULD say
but doesn't — behaviors the journeys require that aren't in the spec at all.

For each JOURNEY-GAP found in Step 4b, ask: **does the feature spec have a
user story or section that covers this behavior?**

- If yes but the code doesn't implement it → that's a PLANNED item (Step 2 handles it)
- If no → the spec itself is incomplete. The journey requires behavior that
  nobody ever wrote into the spec. **Write it now.**

**Why write, not just flag:** This skill is called sync, not audit. Specs are
documentation — writing a missing section is safe, reversible, and unblocks
the downstream pipeline (audit-ac can't add ACs to a section that doesn't
exist). Code drift gets flagged because code changes are risky. Spec gaps get
filled because specs are the plan, and a plan with holes blocks everything downstream.

**What to write for each gap:**

1. **Add a new User Story section** to the feature spec with:
   - A clear user story statement ("As a [role], I want to [action], so that [outcome]")
   - A narrative paragraph explaining the behavior the journey requires
   - An empty AC table in the shared format, with placeholder ACs marked
     `QA=—`, `E2E=🔲`, `Test=—`
   - A `[SPEC-GENERATED]` tag so reviewers know this was auto-generated
     from journey requirements, not hand-written

2. **Annotate the source journey** in the Implementation Notes:
```
> - **[PREFIX]-N SPEC-GENERATED YYYY-MM-DD:** Added US-[N] "[title]" to cover
>   Journey [JID] precondition: [what the journey assumes]. AC table ready for
>   audit-ac to refine.
```

3. **Route to audit-ac** after writing — the placeholder ACs are
   intentionally vague (you're grounding from journeys, not reading code).
   audit-ac's job is to make them testable and specific.

**Example:** Journey J07 assumes "owner creates flash deal through validation."
The spec has no user story for owner-side deal creation. Write:

```markdown
### US-N: Owner Flash Deal Creation [SPEC-GENERATED]

**As a** business owner on the dashboard,
**I want to** create a time-limited flash deal for my location,
**so that** nearby followers are notified and can claim the deal before it expires.

This user story was generated from Journey J07's Background precondition:
"one of his favorite cafés has posted a 30% off flash deal." No existing
user story covered the owner-side creation flow for this entity.

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| FLASH-01 | Owner can create a flash deal from the dashboard with discount %, duration, and optional message | — | 🔲 | — |
| FLASH-02 | Flash deal creation goes through the security/validation pipeline (plan limits enforced) | — | 🔲 | — |
| FLASH-03 | Creating a flash deal triggers push notifications to nearby followers | — | 🔲 | — |
```

This unblocks the entire downstream pipeline:
- audit-ac refines the placeholder ACs into testable criteria
- write-e2e writes tests against the ACs
- The developer implements the code to make the ACs pass

**What NOT to write:** Don't invent behaviors the journey doesn't require.
Only write spec content for gaps that a specific journey precondition demands.
If no journey needs it, it doesn't get a section — that's validate-feature's
job to evaluate.

This completes the three-layer check:
- **Step 4:** Does code match spec? (spec → code) — flags DRIFT
- **Step 4b:** Does code support journeys? (journey → code) — flags JOURNEY-GAP
- **Step 4c:** Does spec cover what journeys need? (journey → spec) — **writes** the missing section

# Serious Vibe Coding Real Flow: What Actually Happens When You Say "Build Me X"

## The Honest Answer

**Serious Vibe Coding is NOT an automated pipeline.** There is no orchestrator that chains skills together. Each skill must be manually invoked by the user (or by an operator playing the user). The "pipeline" is a documented sequence — a recipe, not a machine.

```
User says: "Build me a todo app"
                │
                ▼
        ┌───────────────┐
        │ Claude reads   │ ← svc SKILL.md files are in .claude/
        │ skill preambles│   and loaded into every conversation
        └───────┬───────┘
                │
                ▼
        Does Claude auto-invoke a skill?
                │
           ┌────┴────┐
           │  MAYBE  │ ← Some skills say "proactively invoke"
           └────┬────┘   but there's no hard routing
                │
                ▼
        In practice: Claude says
        "I'll use the write-spec skill..."
        or "Let me start with write-vision..."
        │
        ▼
        USER must approve or redirect
```

### What "proactively invoke" means in practice

Several skills have `description` fields that say things like:
- write-vision: "Triggers on 'set the vision', 'product direction'..."  
- validate-feature: "Triggers on 'I have an idea', 'what should we build'..."
- route-workflow: "Triggers on 'what should I do next', 'which skill'..."

Claude Code's skill matching reads these descriptions and MAY auto-select a skill. But:
1. It picks ONE skill per turn, not a chain
2. The user must approve or the skill fires based on the description match
3. After a skill completes, the user must say something to trigger the next one

### The Three Ways a Skill Gets Invoked

```
1. USER EXPLICITLY ASKS
   User: "/write-spec" or "write the spec for this feature"
   → Claude invokes the skill directly

2. CLAUDE MATCHES DESCRIPTION
   User: "I have an idea for a feature"
   → Claude's skill routing matches validate-feature description
   → Claude says "I'll use validate-feature..." and invokes it

3. PREVIOUS SKILL SUGGESTS NEXT
   write-spec finishes → output says "Next: run audit-ac"
   → But Claude doesn't auto-invoke it
   → User must say "ok do that" or "what's next?"
   → Then Claude invokes audit-ac
```

**No skill auto-chains to the next.** Every transition requires a user turn.

---

## Step-by-Step: "Build me a todo app"

### What the user experiences

```
USER: "Build me a todo app with tasks, due dates, and categories"

TURN 1 — Claude routes to validate-feature or write-vision
┌─────────────────────────────────────────────────────┐
│ Claude: "I'll use the write-vision skill to          │
│ establish the product direction."                    │
│                                                      │
│ [Creates docs/specs/vision.md]                       │
│                                                      │
│ "Vision doc created. Next I'd recommend running      │
│ build-personas to define who uses this."             │
└─────────────────────────────────────────────────────┘
                    │
                    │ USER MUST RESPOND
                    ▼
USER: "Ok, do that"

TURN 2 — build-personas
┌─────────────────────────────────────────────────────┐
│ Claude: "I'll use the build-personas skill."        │
│                                                      │
│ [Discovers 2 personas from vision]                   │
│ [Creates P1-task-manager.md, P2-team-lead.md]        │
│                                                      │
│ "2 personas created. Next: validate-feature to      │
│ validate the feature scope, or write-spec to       │
│ start specifying."                                   │
└─────────────────────────────────────────────────────┘
                    │
                    │ USER MUST RESPOND
                    ▼
USER: "Write the spec"

TURN 3 — write-spec
┌─────────────────────────────────────────────────────┐
│ Claude: "I'll use the write-spec skill."           │
│                                                      │
│ [Reads vision + personas]                            │
│ [Writes feature spec with 4 user stories, 15 ACs]   │
│ [Identifies cascade deps: none for a simple todo]    │
│                                                      │
│ "Feature spec created (DRAFT). Next: design-ux       │
│ to define screen flows, or audit-ac to               │
│ audit the ACs first."                                │
└─────────────────────────────────────────────────────┘
                    │
                    │ USER MUST RESPOND
                    ▼
USER: "Do the UX design"

TURN 4 — design-ux
┌─────────────────────────────────────────────────────┐
│ Claude: "I'll use the design-ux skill."      │
│                                                      │
│ MAY ASK: "Should the todo list be a single-page      │
│ app or multi-page?" → User answers                   │
│                                                      │
│ [Creates docs/specs/ux/todo-management.md]           │
│ [Screen inventory, state machines, flows]            │
│                                                      │
│ "UX design complete. Next: design-ui."       │
└─────────────────────────────────────────────────────┘
                    │
                    │ ... pattern continues for each skill ...
                    ▼

TURNS 5-11 — ui-design → tech-design → review → change-set → promote → verify
Each requires a user turn to invoke.
```

### Minimum user turns for full pipeline

| Phase | Skill | User says | Skill asks questions? |
|-------|-------|-----------|----------------------|
| 1 | write-vision | "Build me a todo app" | Maybe (new vs existing?) |
| 2 | build-personas | "Ok, define personas" | Maybe (approve discoveries?) |
| 3 | write-spec | "Write the spec" | Maybe (scope clarifications) |
| 4 | design-ux | "Do UX design" | Yes (UX choices) |
| 5 | design-ui | "Do UI design" | Maybe (design preferences) |
| 6 | design-tech | "Do tech design" | Maybe (architecture choices) |
| 7 | review-gate | "Review it" | No (runs autonomously) |
| 8 | plan-changeset | "Write the code" | Maybe (scope confirmation) |
| 9 | land-changeset | "Promote it" | No |
| 10 | verify-promotion | "Verify it" | No |
| | _Start the server_ | `npm start` | — |
| 11 | sync-spec-code | "Sync specs to code" | No |
| 12 | test-journeys | "Run QA" | No (needs running server) |
| 13 | write-e2e | "Write E2E tests" | No |

**Minimum turns: 13 user messages** to go from "build me X" to verified code with tests.

In practice: **15-25 turns** because skills ask clarifying questions and the user gives feedback.

---

## What IS Automated vs What ISN'T

### Automated (happens without user intervention)
- ✅ Skill reads prior artifacts (vision, personas, specs) from disk
- ✅ Skill outputs artifacts to the correct path
- ✅ Skill suggests what to run next (in its closing message)
- ✅ Review protocol runs self-review + self-judgment without user input
- ✅ sync-spec-code scans code without user input
- ✅ plan-changeset writes all code parts in one skill invocation
- ✅ Each skill maintains the spec lifecycle state (DRAFT → BASELINED etc.)

### NOT Automated (requires user action)
- ❌ No skill auto-invokes the next skill in the pipeline
- ❌ No orchestrator chains skills together
- ❌ User must approve or trigger each phase transition
- ❌ route-workflow is advisory (tells you what to do next, doesn't do it)
- ❌ If the user doesn't know the pipeline order, they must ask route-workflow
- ❌ Review gate decisions require user acknowledgment
- ❌ Server must be started manually before QA/E2E skills

### Could Be Automated But Isn't Yet
- ⚠️ An "autopilot" mode that chains skills 1-13 automatically
- ⚠️ Auto-starting the server after plan-changeset
- ⚠️ Auto-running sync-spec-code after land-changeset
- ⚠️ Pipeline state tracking ("you're at Phase 4, 5 phases to go")

---

## The Real Bottleneck

The pipeline's value is in the ARTIFACTS it produces, not in the automation. Each skill adds a layer of constraint:

```
Turn 1: write-vision        → "What product?"         (bounds the space)
Turn 2: build-personas    → "For whom?"             (bounds the users)
Turn 3: write-spec       → "What exactly?"         (bounds the features)
Turn 4: design-ux  → "What experience?"      (bounds the flows)
Turn 5: design-ui  → "What look?"            (bounds the visuals)
Turn 6: design-tech → "What architecture?"            (bounds the code)
Turn 7: plan-changeset → "What code, exactly?"   (produces the code)
```

Each turn narrows the output space. By Turn 7, the code is highly constrained by everything above it. This is the doctrine's "progressive narrowing" — but it requires the USER to drive each transition.

### Comparison: How Other Frameworks Handle This

| Framework | Automation level | How transitions work |
|-----------|-----------------|---------------------|
| **Serious Vibe Coding** | Manual chaining | User invokes each skill, gets suggestion for next |
| **gstack** | Manual chaining | User invokes `/office-hours`, then `/autoplan` chains 3 reviews automatically, then user codes |
| **obra/superpowers** | Semi-auto | `brainstorming` explicitly says "invoke writing-plans next"; `executing-plans` auto-batches tasks |
| **Raw** | N/A | Single prompt, single response |

**gstack's `/autoplan` is the closest to real automation** — it chains CEO → design → eng review in one skill invocation with auto-decisions. Serious Vibe Coding has no equivalent.

---

## What a "Build Me X" Autopilot Would Look Like

If svc had a true autopilot for simple "build X" requests:

```
USER: "Build me a todo app with tasks, due dates, and categories"

AUTOPILOT:
  1. Detect: greenfield, simple scope, no existing artifacts
  2. Run write-vision (auto-approve if greenfield)
  3. Run build-personas Mode 7 (auto-approve discoveries)
  4. Run write-spec (stop and ask if cascade deps > 2)
  5. Run design-ux (auto-choose defaults for simple apps)
  6. Run design-ui (auto-choose from design system if exists)
  7. Run design-tech (auto-approve if no feasibility conflicts)
  8. Run review-gate (auto-pass if no critical/high findings)
  9. Run plan-changeset (all parts)
  10. Run land-changeset
  11. Start server
  12. Run sync-spec-code
  13. Run test-journeys
  14. Run write-e2e
  15. Report results

STOP POINTS (require user):
  - Cascade deps > 2 (scope exploded — confirm)
  - Review protocol finds critical issues
  - Server fails to start (fix needed)
  - QA finds failures (fix or accept)
```

**This autopilot does not exist today.** The test-framework/autopilot-protocol.md describes something similar for TESTING purposes, but there is no production autopilot for building features.

---

## Summary

| Question | Answer |
|----------|--------|
| Is svc fully automated? | **No.** Each skill is manual. |
| Does it chain skills automatically? | **No.** User drives each transition. |
| Does it know what comes next? | **Yes.** Each skill suggests the next step. route-workflow knows the graph. |
| How many user turns for a full build? | **13 minimum, 15-25 typical** |
| What IS automated within each skill? | Artifact reading, output writing, spec state tracking, code generation |
| What's the biggest automation gap? | No orchestrator to chain the 13 skills into one "build me X" flow |
| Does `/autoplan` (gstack) solve this? | Partially — it chains 3 review skills, but not the whole pipeline |

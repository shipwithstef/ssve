# Step 3: Cross-Validation — detail

Moved verbatim from SKILL.md (progressive disclosure).

## Step 3: Cross-Validation

Cross-reference the current brief or accepted bounded scope against the project's relevant existing artifacts and actual code. Reuse current evidence; expose new conflicts without reopening settled decisions.
Report findings honestly — this is the skill's unique value over jumping to design.

### Persona validation

| Check | Action |
|-------|--------|
| Brief's "Who" matches an existing persona | Link it: "Serves P1 (Collaborator)" |
| Brief's "Who" is a new user type not in personas | Flag: "This introduces a new user type — run /build-personas to create P7 before journey work" |
| Brief's "Who" contradicts a persona's stated needs | Warn: "P2 (Visionary) explicitly wants [X], but this brief assumes they want [Y]" |

### Journey validation

| Check | Action |
|-------|--------|
| MVP implies a new user flow | Note: "The MVP flow doesn't fit any existing journey — /write-journeys will need to create a new one" |
| MVP extends an existing journey | Note: "This extends J02 at the [step] — write-journeys should add scenarios" |
| MVP conflicts with an existing journey | Warn: "J01 assumes [X] at step 3, but this feature changes that behavior" |

### Spec validation

| Check | Action |
|-------|--------|
| Feature touches an existing spec's domain | Note: "The matching spec will need updating if this ships" |
| Feature conflicts with existing spec behavior | Warn: "The trust spec says [X], but this brief proposes [Y] — resolve before design" |
| No related specs | Note: "Clean domain — no spec conflicts" |

### Vision alignment

| Check | Action |
|-------|--------|
| Clearly aligned | Note: "Directly supports [vision goal]" |
| Tangentially related | Note: "Supports vision indirectly through [connection]" |
| Misaligned | Warn: "This doesn't connect to the stated vision. That's not necessarily wrong — the vision may need updating — but be explicit about it" |

---

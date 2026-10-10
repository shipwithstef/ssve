# teach-project: Socratic mode

## Socratic Mode

Interactive diagnostic. You ask, user answers, you identify real gaps (not
profile-claimed), teach those gaps, and update the builder profile with what
was confirmed vs what's still missing. The profile becomes living truth —
every downstream skill calibrates better because of this session.

### Step S1: Read Inputs

Read the same inputs as Auto Mode (vision, features, manifest, project-state,
builder-profile, competitors). In Socratic Mode, ALSO read source code for
the key files in the manifest — you need ground truth to write good diagnostic
questions, not just the spec-claimed behavior.

### Step S2: Generate Diagnostic Questions Across Three Dimensions

Questions are grounded in actual project artifacts, not generic frameworks.
Pick 3-5 questions per dimension (9-15 total), scaled to the builder's
declared profile (don't ask a devops person "what's Docker").

**Technical dimension** (ground truth: source + manifest + OWNER-GUIDE if it exists):

- "What does `<frontend framework>` do in this codebase? Give me one concrete
  thing it handles that you'd have to build yourself without it."
- "If the page `/<real-route-in-this-project>` breaks with a 500, where do
  you look first? Walk me through your first three steps."
- "What's the difference between `<pattern A used in codebase>` and
  `<pattern B>`? When would you reach for each?"
- "If I told you to add a new route at `/<plausible-new-route>`, which files
  would you create or edit? You don't need syntax — just names and
  responsibilities."
- "How does data get from `<source>` to `<destination>` in this app? Trace
  the path."

**Product dimension** (ground truth: features + vision + personas + competitors):

- "Who's the primary persona here, and what do they do in the first 5
  minutes after signup? What would make them churn in week 1?"
- "Which competitor is closest? What's our moat — what would they have to
  build to kill us, and why haven't they?"
- "If you had to raise prices 20% tomorrow, which feature justifies that
  increase and why? Which user segment pays; which walks?"
- "What's the one feature on the roadmap that's load-bearing for the pricing
  story? What happens to revenue if we ship a weaker version?"

**Operational dimension** (ground truth: project-state + cost model + deploy config):

- "What monitoring do we have right now, and where do you see it? If nothing
  is in place, what would you add first?"
- "At what user count does the <free-tier service> stop being free? What's
  the cost curve when you cross that threshold?"
- "What's the first thing that breaks when a deploy fails? Is there a
  rollback path, and does it work automatically?"
- "If you got a customer support ticket saying 'login is broken for
  everyone,' what's your first five minutes?"

For each question, have the expected-answer-sketch ready — you'll compare the
user's response against it, not grade it binary pass/fail.

### Step S3: Ask, Listen, Teach

Ask questions **one at a time**. Don't batch. Wait for the answer.

For each answer, classify it in your head:

| Signal | Meaning | Response |
|---|---|---|
| Clear, specific, correct | Skill confirmed | "Yep — you've got that. Moving on." |
| Partial / right direction, missing depth | Partial skill, teachable in 2 mins | Teach the missing piece with a concrete example from this repo, then move on |
| "I don't know" / obviously wrong | Real gap | Teach the concept grounded in this codebase. Show the file. Show what changes it. Confirm understanding before moving on |
| Evasive / hedging | Possibly gap, possibly shy | Ask one follow-up to disambiguate, then classify |

Track per-question: `dimension`, `question`, `assessment` (confirmed /
partial / gap), `taught` (what you explained), `evidence` (quote/paraphrase
of user's answer — short).

**Teach from the codebase, not from generic tutorials.** "React hooks let
you reuse stateful logic" is generic. "In `src/hooks/useLocation.js` the
hook owns the geolocation subscription, so any component that mounts it
gets GPS without re-wiring the API — that's why the useState+useEffect
pattern exists" is grounded.

### Step S4: Update the Builder Profile

At session end, update `~/.svc/builder-profile.md`. This is the whole point
of socratic mode — profile becomes truth, not claim.

**In the `## Skills & Strengths` section**, update entries based on what was
confirmed. Use the format:

```markdown
- **Frontend (React):** basics confirmed 2026-04-14 via teach-project socratic
  (knows: JSX, props, useState, component composition)
  (doesn't know yet: server components, Suspense, useReducer)
- **Product thinking:** understands persona model, can articulate primary
  moat, can connect pricing to features (confirmed 2026-04-14)
- **Operations:** knows Vercel deploys, rollback flow; doesn't know Supabase
  observability or quota math (identified 2026-04-14)
```

**Append one line to the `
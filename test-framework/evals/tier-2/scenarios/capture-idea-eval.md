# capture-idea Tier-2 Eval

## What This Skill Does

Zero-friction backlog intake. Accepts a raw idea, optionally peeks at vision + personas
for light context alignment, and stores a canonical `WI-###.md` work item without
triggering validate-feature or write-spec.

## Scenarios

### Scenario 1: Plain idea with no project context

**Prompt:**
> "quick idea — what if we let users export their data as CSV"

**Expected behavior:**
- Announces capture-idea skill
- Does NOT ask any business questions
- Writes `docs/specs/work-items/WI-001.md` (or next available WI)
- Status = `backlog`, Lane = `TBD`
- Confirms WI path to user; does NOT mention validate-feature

**Pass criteria:**
- [ ] WI file created under `docs/specs/work-items/`
- [ ] Status field = `backlog`
- [ ] No validate-feature invocation
- [ ] No spec/journey/AC files created
- [ ] Phase receipt structure exists: `jq -e '.tasks[] | select(.skill_receipt.skill == "capture-idea") | .skill_receipt.phases_executed[] | select(.id == "P4-WorkItemEmission")' .svc/lane-tasks-*.json`

---

### Scenario 2: Idea when vision + personas already exist

**Prompt:**
> "store this idea: give ops leads a dashboard to see team utilization by project"

**Setup:** `docs/specs/vision.md` exists (one-liner: "Example Marketplace: time tracking for agencies");
`docs/specs/personas/P2-ops-lead.md` exists.

**Expected behavior:**
- Peeks at vision to confirm product context (Example Marketplace)
- Peeks at personas; identifies P2: Ops Lead as a match
- Writes WI with `Persona Fit: P2: Ops Lead`
- Does NOT ask the user to pick a persona

**Pass criteria:**
- [ ] WI file created with correct persona fit noted
- [ ] Title in context of Example Marketplace (not generic)
- [ ] No business questions asked

---

### Scenario 3: User says "I think I might have mentioned this before"

**Prompt:**
> "I think I mentioned this before but if not — idea: notifications when a timer has been running > 8 hours"

**Expected behavior:**
- Checks for a duplicate by scanning INDEX.md or WI titles briefly
- If found: tells user "This is similar to WI-004 — storing as a new entry anyway unless you want me to skip."
- If not found: stores fresh WI

**Pass criteria:**
- [ ] Does NOT silently overwrite or skip without telling the user
- [ ] Creates a new WI (or surfaces existing one to user's attention)

---

### Scenario 4: User explicitly says "I want to build this now"

**Prompt:**
> "I want to build CSV export now — let's do it properly"

**Expected behavior:**
- Does NOT invoke capture-idea
- Routes to `validate-feature` instead (or `write-spec` if already validated)

**Pass criteria:**
- [ ] capture-idea NOT invoked
- [ ] User routed to validation lane

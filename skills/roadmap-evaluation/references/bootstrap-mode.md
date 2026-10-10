### Step 0b: Bootstrap Mode

When the builder has no project artifacts, don't guess — tell them what to
create and in what order. This is the only path that produces a checklist
instead of a roadmap.

**Output a bootstrap checklist to `docs/specs/roadmap.md`:**

```markdown
---
mode: bootstrap
created: <date>
status: incomplete
missing_inputs:
  - builder-profile
  - vision
  - project-state
  - work-items
---

# Roadmap: Bootstrap Required

The roadmap needs project artifacts to work with. Create these in order:

## Priority 1: Builder Profile
Run `/mine-builder` to capture your situation — budget, hours, skills,
distribution. This takes ~5 minutes and everything else depends on it.

## Priority 2: Vision
Run `/write-vision` to define what you're building, for whom, and how it
makes money. Without this, milestones have no direction.

## Priority 3: Work Items
After the vision exists, break it into work items. The pipeline does this
naturally as you run through specs.

## Priority 4: Project State
Created automatically as you progress through the pipeline. No manual
action needed.

---

When at least builder-profile and vision exist, re-run `/roadmap-evaluation`
for a full milestone plan.
```

**After writing the bootstrap output, stop.** Do not proceed to Steps 1-5.

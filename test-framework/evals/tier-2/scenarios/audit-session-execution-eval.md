# Scenario: Session Execution Audit Produces Framework-Grade Evidence

## Overview

Tests that a messy real run can be converted into a structured expected-vs-actual
audit that `evolve-framework` can build on.

## Setup

Seed a run with:
- a WI file
- a `lane-tasks-<WI>.json`
- a partial `pipeline-decisions.jsonl`
- a transcript excerpt showing user corrections
- at least one runtime proof artifact

The seeded run should include both:
- one clear agent mistake
- one genuine framework contract gap

## Test Case 1: Session forensics before framework diagnosis

### Input
"Audit this WI session. Compare the prompt, lane task graph, decision log, and transcript against what svc should have done. Separate agent mistakes from framework gaps and give evolve-framework only the framework-grade findings."

### Expected Behavior
- [ ] Routes to `audit-session-execution`
- [ ] Reconstructs an expected contract from framework + repo docs before judging actual behavior
- [ ] Produces an Expected vs Actual matrix with evidence citations
- [ ] Scores the run across multiple dimensions, including verification and token/context notes
- [ ] Buckets findings into project-specific, agent-specific, and framework-specific
- [ ] Excludes already-fixed framework gaps by checking `FRAMEWORK-STATE.md`
- [ ] Produces a proposal artifact usable by `evolve-framework`
- [ ] Records a `P6-FaultDomainReport` phase receipt in the task graph:
  `jq -e '.tasks[] | select(.metadata.skill == "audit-session-execution" or .skill_receipt.skill == "audit-session-execution") | .skill_receipt.phases_executed[]? | select(.id == "P6-FaultDomainReport")' .svc/lane-tasks-<WI>.json`

### Pass Criteria
All checkboxes. The report must include a framework-gap section that is
strictly smaller than the full finding list.

## Test Case 2: No transcript available

### Input
"Audit the run from the WI file, lane task graph, and decision log only. There is no transcript."

### Expected Behavior
- [ ] Does not block on missing transcript
- [ ] Uses stronger artifacts first
- [ ] Marks confidence limits honestly where transcript evidence would matter
- [ ] Does not invent exact token counts

### Pass Criteria
The report remains usable and explicitly marks missing evidence.

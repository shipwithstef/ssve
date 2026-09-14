# Scenario: Framework Self-Improvement Loop

## Overview

Tests the full framework lane: evidence → diagnosis → implementation → replay → state update.

## Setup

Seed a known gap: add a skill with a missing Self-Verify section (a real tier-1 failure).

## Test Case 1: Gap Detection → improve-framework routing

### Input
"test-framework found that skill X is missing a Self-Verify section"

### Expected Behavior
- [ ] Routes to improve-framework (not direct SKILL.md edit)
- [ ] improve-framework reads FRAMEWORK-STATE.md first
- [ ] Records a `P1-FrameworkRepoAndMemoryLoad` phase receipt in the task graph:
  `jq -e '.tasks[] | select(.metadata.skill == "improve-framework" or .skill_receipt.skill == "improve-framework") | .skill_receipt.phases_executed[]? | select(.id == "P1-FrameworkRepoAndMemoryLoad")' .svc/lane-tasks-<WI>.json`
- [ ] Checks if gap is already known/fixed/deferred
- [ ] Diagnoses: missing Self-Verify = structural drift, quick-fix route
- [ ] Implements: adds Self-Verify section to the skill
- [ ] Replays: tier-1 validate-self-verify-sections.sh passes
- [ ] Updates FRAMEWORK-STATE.md with the fix
- [ ] Produces proposals/<date>-framework-improvement.md with all required sections, moves to proposals/done/ after implementation

### Pass Criteria
All checkboxes. The improvement run record artifact must have: evidence, diagnosis,
implementation, replay verification (PASS), and FRAMEWORK-STATE mutations.

## Test Case 2: Already-fixed gap

### Input
Same gap as Test Case 1, but FRAMEWORK-STATE.md already shows it as fixed.

### Expected Behavior
- [ ] improve-framework reads FRAMEWORK-STATE.md
- [ ] Detects the gap is already in Analysis History as fixed
- [ ] Reports "already fixed" and stops
- [ ] Does NOT re-implement or re-propose

### Pass Criteria
No action taken. No duplicate entry in FRAMEWORK-STATE.md.

## Test Case 3: Meta routing from router

### Input
User says "improve the framework — review-gate is missing greenfield lane"

### Expected Behavior
- [ ] route-workflow matches "improve the framework" → improve-framework
- [ ] Does NOT route to evolve-framework or test-framework directly
- [ ] improve-framework orchestrates the full loop

### Pass Criteria
Correct routing. Single orchestrator.

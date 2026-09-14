# svc Doctrine — Detail

Source: DOCTRINE.md (1173 lines)
Extracted: 2026-04-08

## The Problem (3 failure modes)
1. **Non-determinism:** Same input → different output each run
2. **Context blindness:** Agent knows only what's in its context window
3. **Lossy translation:** Information lost at every boundary crossing (spec→design→plan→code)

## The Solution: Progressive Narrowing
Each phase narrows the solution space. By the time code is written, there's one right answer.

Vision (wide) → Personas (who) → Feature spec (what) → UX design (how it flows) → UI design (how it looks) → Tech design (how it works) → Plan (what to build) → Code (build it) → Review (verify it) → Deploy (ship it)

## 6 Pipeline Phases
1. **Discovery** (write-vision through validate-feature): Define WHAT to build
2. **Specification** (write-spec through write-journeys): Define HOW it's experienced
3. **Design** (design-ux through design-tech): Define HOW it works
4. **Planning** (plan-changeset): Define HOW to implement
5. **Execution** (execute-changeset): Build it
6. **Verification** (review-gate through verify-promotion): Prove it works

## Feature Lifecycle States
DRAFT → UX-REVIEWED → DESIGNED → BASELINED → CHANGE-SET-APPROVED → PROMOTED → VERIFIED
+ REJECTED (killed by validate-feature) and PIVOTED (redirected with alternatives)

## Safety Gates Before Chain Advance
4 hard-stop checks before any progressive chain invokes next skill:
1. Unresolved checkpoint (blocker in decision log)
2. Self-verify failure (any FAIL items)
3. Stale builder profile (30+ days old)
4. Context budget (DEGRADING or POOR tier)

## Gate Taxonomy (4 canonical types)
| Type | Purpose | Use when |
|---|---|---|
| Pre-flight | Validate preconditions | File-existence or config check |
| Revision | Evaluate quality, loop back | After producer step, bounded by cap + stall detection |
| Escalation | Surface to developer | Automated resolution impossible |
| Abort | Terminate to prevent damage | Continuing would be harmful |

svc gate mapping: G1-G4 = revision, G5-G6 = pre-flight, G7 = revision+escalation

## Autorun (One Prompt to Product)
route-workflow --autorun runs entire lane from single prompt.
P0 virtual founder takes all human checkpoints EXCEPT:
- NO-SHIP kill decision (always surfaces to user)
- Test failure after 3 P0 fix attempts
- Critical/high security finding

Taste decisions collected and presented at end for retroactive override.

## Completeness Principle (Boil the Lake)
When marginal cost is near-zero and output quality compounds, do the complete thing.
5 concrete applications: all ACs in one pass, all files in one plan, all tests before moving on, all edge cases in UX, all error states in UI.

## Hard Stops
- NO-SHIP kill decision
- 3x P0 fix failure
- Critical security finding
- Team mode PR (never auto-merge in team mode)

## Progressive Chaining
Skills invoke next skill via --progressive --lane <lane> flag.
--skip flag excludes skills. Skipped skill passes flag to next.

## L4 Pointers
- Full doctrine: DOCTRINE.md
- Gate taxonomy section: DOCTRINE.md:953-975
- Autorun section: DOCTRINE.md:954-974
- Completeness principle: DOCTRINE.md (search "Boil the Lake")

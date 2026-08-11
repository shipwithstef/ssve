# Autorun Orchestrator

## One Prompt to Product

The goal: a single high-level intent ("build me X") produces either:

- a verified, merged, working product
- a structured rejection explaining why not
- or a file-backed resumable lane if the host session ends before completion

The pipeline runs end-to-end **within the active session whenever possible**.
Human checkpoints become P0-decided unless the user explicitly opts into
interactive mode. Cross-session unattended continuation is not assumed unless
the host/project actually provides a verified continuation mechanism. The only
hard stops are:

- **NO-SHIP decision** in validate-feature (killing a feature is always surfaced)
- **Test failure** that P0 cannot resolve after 3 attempts
- **Security finding** at critical/high severity
- **Merge conflict** on promotion to main
- **Team mode PR** — branch protection or required reviewers means land-changeset
  opens a PR and stops. The chain resumes in a future session after merge.

Everything else — spec approval, plan review, solution selection, landing
strategy — P0 decides and logs for end-of-run review.

## Human Checkpoint Behavior in Autorun

Skills with `human_checkpoint: true` behave differently based on mode:

| Skill | Interactive mode | Autorun mode |
|-------|-----------------|-------------|
| `validate-feature` | Stop, ask user | P0 decides. **Exception:** NO-SHIP always stops. |
| `write-spec` | Stop, ask user to review spec | P0 reviews, logs concerns as Taste decisions |
| `explore-solutions` | Stop, present alternatives | P0 selects based on research, logs reasoning |
| `plan-changeset` | Stop, ask user to approve plan | P0 approves if plan covers all ACs; logs plan summary |
| `execute-changeset` | Stop at each task checkpoint | P0 reviews diffs, approves if tests pass |
| `land-changeset` | Stop, ask user to merge | P0 merges (solo mode) or opens PR and stops (team mode) |
| `improve-framework` | Stop, ask user to approve fix scope | P0 executes if ≤2 files / ≤50 lines; human checkpoint if larger (plan-changeset discipline) |
| `evolve-framework` | Stop, ask user to rank gaps | P0 auto-runs evidence gathering; human checkpoint before any implementation |
| `blend-external` / `blend-private` | Stop, ask user to approve source | **Always human checkpoint.** External code import is high-risk. |
| `test-framework` | Stop, ask user to approve test scope | P0 auto-runs; human checkpoint only if findings require multi-skill changes |
| `create-skill` | Stop, ask user to approve skill scope | P0 decides if template-based and ≤2 files; human checkpoint if novel skill or >2 files |
| `design-logo` | Stop at each phase gate | P0 decides Phases 1–4; human checkpoint at love-test (Phase 5b) and final approval (≥65/70) |
| `extract-bootstrap` | Stop, ask user to approve pattern set | P0 decides if repo is accessible and patterns are clear; human checkpoint if architecture is ambiguous |
| `find-opportunity` | Stop, ask user to rank opportunities | P0 decides (evidence-based ranking; no creative judgment needed) |
| `honest-diagnosis` | Stop, present blockers | P0 decides (evidence-graded; purely analytical) |
| `ingest-guide` | Stop, ask user to approve classification | P0 decides if classification is clear (discard/store/blend); human checkpoint if promote-to-skill |
| `ingest-guide-batch` | Stop, ask user to approve batch digest | P0 runs per-guide; human checkpoint if any guide is promote-to-skill |
| `landing-page` | Stop, ask user to approve design | P0 decides if benchmark-landing ≥7; human checkpoint if <7 (needs override or redesign) |
| `manage-finops` | Stop, ask user to approve cost model | P0 decides (cost calculations are deterministic from usage estimates) |
| `mine-builder` | Stop, ask user to review profile | P0 decides (profile update is mechanical; stops only if new high-severity blocker found) |
| `monetization-architecture` | Stop, ask user to approve gating matrix | P0 decides if gating matrix is clear; human checkpoint if enforcement audit finds code/pricing mismatch |
| `plan-blast-radius` | Stop, ask user to approve SEV classification | P0 decides (SEV classification is deterministic from terraform plan / helm diff) |
| `plan-capabilities` | Stop, ask user to approve capability plan | P0 decides (recommendations are evidence-based from stack-profile + registry) |
| `reverse-engineer` | Stop, ask user to approve twist | P0 decides if source is public and twist is mechanical; human checkpoint if twist requires product judgment |
| `roadmap-evaluation` | Stop, ask user to approve milestone plan | P0 decides (evidence-based prioritization and cost estimates from existing artifacts) |
| `stage-revenue` | Stop, ask user to approve stage breakdown | P0 decides (stage breakdown is mechanical from builder profile and feature set) |
| `strategic-decision` | Stop, ask user at each trade-study gate | **Always human checkpoint.** High-stakes vendor/framework selection with multi-year consequences. |

**Framework lane hard stops (in addition to universal hard stops):**

- **Plan-changeset discipline breach:** Framework changes >2 files or >50 lines that skip `write-spec` → `plan-changeset` → `execute-changeset` in a worktree
- **Host-specific implementation without research:** Any framework change touching host integration (hooks, CLI-specific scripts, host abstraction) that did not verify current host capabilities first
- **New skill without spec:** Any `create-skill` invocation that bypasses `write-spec` and `audit-ac`

**Team mode exception:** if the repo has branch protection or required
reviewers, `land-changeset` opens a PR and stops. The chain resumes when
the PR is merged (in a future session or via webhook).

## Framework Self-Management Policy (svc-on-svc)

When the repo under discussion is **svc itself**, do not treat all framework work
as the same kind of task. Classify it first, then route:

| svc-on-svc use case | Start with | Why | Escalate to |
|---|---|---|---|
| Known framework gap, pending proposal, replay failure, or implementation-ready framework finding | `improve-framework` | Evidence already exists; run the fix loop instead of re-diagnosing | `quick-fix`, direct SKILL edits, `create-skill`, or normal pipeline as chosen by `improve-framework` |
| Broken framework behavior or regression in an existing contract | `diagnose-bug` | Root cause comes first when something that should work no longer works | `plan-changeset` / `execute-changeset`, and then `improve-framework` if the bug reveals a broader framework gap |
| New framework capability or deliberate framework behavior change | `write-spec` | This is feature work on svc itself and deserves explicit ACs and implementation planning | `audit-ac` → `write-journeys` (if flow matters) → `design-tech` → `explore-solutions` when architectural risk is high |
| Concrete session/WI replay where the goal is expected-vs-actual forensics | `audit-session-execution` | Build framework-grade evidence from a real run before gap prioritization | `evolve-framework`, then `improve-framework` |
| Unknown framework gaps, prioritization, or proof that svc works | `test-framework` or `evolve-framework` | First gather evidence or rank the gap list | `improve-framework` once there is a concrete proposal or replay target |

**`explore-solutions` is mandatory** for svc-on-svc work when `design-tech`
introduces a hard-to-reverse architecture choice: new task-state backend,
new host abstraction layer, new external dependency, new persistence model,
or any decision that would be expensive to unwind after landing.

**Default rule:** if the framework work can be phrased as "fix this known gap,"
start with `improve-framework`. If it can be phrased as "svc should gain a new
capability," start with `write-spec`. If it can be phrased as "this framework
behavior is broken," start with `diagnose-bug`.

## Cross-Skill Routing

| Skill just finished | Finding | Route to |
|--------------------|---------|----------|
| `onboard-repo` | Brownfield map completed | route by work-item type |
| `onboard-repo` | Bugs/regressions logged | `diagnose-bug` |
| `onboard-repo` | Feature opportunities logged | `validate-feature` |
| `onboard-repo` | Drift logged | `sync-spec-code` |
| `onboard-repo` | Refactors or chores logged | `plan-changeset` or `sync-work-items`, depending on scope |
| `onboard-repo` | Tracker visibility needed | `sync-work-items` |
| `diagnose-bug` | Root cause and fix scope defined (single correction) | `plan-changeset` or `execute-changeset`, depending on plan depth needed |
| `diagnose-bug` | Multiple independent corrections discovered (Step 5.5) | Each child WI enters its own lane; parent WI continues to proof-of-fix; `**Next:**` targets highest-priority child |
| `plan-changeset` | Implementation manifest complete | `execute-changeset` |

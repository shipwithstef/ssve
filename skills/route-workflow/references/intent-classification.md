# Intent Classification

Use this after typo normalization and before lane or skill rerouting when a user
message arrives during an active task. The purpose is to decide whether the
message changes the goal or corrects how the current goal should be executed.

## Contract

1. Read the latest `.svc/session-contract.jsonl` entry.
2. Check for an active `.svc/lane-tasks-<WI>.json` task graph.
3. Compare the normalized user message against the active goal, last assistant
   action, and named tools or artifacts.
4. Classify the message as exactly one of:
   `method-correction`, `scope-correction`, `goal-change`, or
   `status-question`.
5. Log material classifications in `.svc/pipeline-decisions.jsonl` under
   `details.routing_context`:

```json
{
  "routing_context": {
    "mid_task_classification": "method-correction",
    "classification_evidence": ["phrase: you have users", "active verification task"],
    "minimum_viable_swap": "use existing e2e account for the current Playwright verification",
    "new_artifacts_allowed": false
  }
}
```

6. Append the same correction as a durable `mid_task_hints[]` entry in the
   active `.svc/lane-tasks-<WI>.json` graph. Each entry must include:

```json
{
  "ts": "2026-05-12T00:00:00Z",
  "user_text": "use the test journey account and visual tracking",
  "normalized_intent": "use the test journey account and visual tracking",
  "classification": "method-correction",
  "applied_method_swap": "use test-journeys account and track-visuals evidence for the current verification",
  "new_artifacts_allowed": false,
  "resolved_skill_hints": [
    {"skill": "test-journeys", "matched": "test journey"},
    {"skill": "track-visuals", "matched": "visual tracking"}
  ]
}
```

Resolve casual skill mentions with:

```bash
node scripts/resolve-skill-hint.mjs --text "<normalized user text>"
```

Resolved hints change the method inside the active graph; they do not create a
new lane by themselves.

## Classification Table

| Classification | Meaning | Required Action |
|---|---|---|
| `method-correction` | Same goal; the user is correcting the tool, helper, account, fixture, path, or skill to use. | Continue the same task graph and switch only the method. |
| `scope-correction` | Same goal; the user is narrowing, broadening, or reprioritizing the current task. | Update scope or acceptance boundary without starting a new lane. |
| `goal-change` | User asks to abandon or replace the current objective. | Write a new session contract and reroute normally. |
| `status-question` | User asks what is happening or what remains. | Report current state; continue only if end-to-end mode applies. |

## Method-Correction Signals

Treat a mid-task message as `method-correction` when it:

- Mentions available tools, helpers, skills, accounts, users, credentials,
  fixture paths, URLs, or MCPs.
- Uses phrases like `you have X`, `use Y`, `with the X you have`, `via Z`, or
  `through W`.
- Arrives while verification, implementation, review, or audit work is already
  underway.
- Does not introduce a new product feature, page, business outcome, or explicit
  request to create a new artifact.

Examples:

| User Message | Classification | Minimum Viable Swap |
|---|---|---|
| `you have users with which you can do the full verifications` | `method-correction` | Use the existing test accounts for the current verification. |
| `you have accounts per testjourney and visual tracking and qa skills` | `method-correction` | Use existing journey accounts and `track-visuals`; do not author a new spec. |
| `use Playwright MCP with the account in e2e/.env` | `method-correction` | Continue the current browser check with that credential. |
| `only validate the billing page, not the whole app` | `scope-correction` | Narrow the current verification scope. |
| `forget that, work on onboarding instead` | `goal-change` | Write a new session contract and reroute. |
| `what is current status` | `status-question` | Summarize current state and blockers. |

## Minimum Viable Swap Rule

For `method-correction`, choose the smallest change that obeys the user's hint:

- Change credential or account.
- Change helper, fixture, MCP, skill, or URL target.
- Continue the current task and evidence path.

Do not:

- Dispatch a new agent.
- Write a new spec or test.
- Create a new lane or WI.
- Replace a working verification architecture.

Only create new artifacts when the user's message explicitly asks for them.

## Guardrail

If the interpretation that creates new artifacts is much larger than the
interpretation that swaps a method, prefer the smaller one unless the user
explicitly requested the larger artifact. A one-line credential swap must not
become a new 200-line test.

## Audit Signal

When a `method-correction` has `new_artifacts_allowed: false`, later session
audits should flag artifact-count overreaction if the run created new specs,
new WIs, or broad plans instead of applying the recorded method swap.

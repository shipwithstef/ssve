# Framework Evolution — 2026-05-09 — Intelligent intent-parsing during framework usage

**Status:** PROPOSED — needs `improve-framework` review

**Related:** Sibling to `2026-05-08-end-to-end-execution-without-permission-checkpoints.md` and `2026-05-09-bundle-grep-is-not-validation.md`. All three describe the same axis from different angles: the agent reads-too-shallow and either pauses, over-engineers, or short-circuits.

## User intent (verbatim)

> "should improvmeent for this thing I want more itnelligent parsing of what I write during framework usage"

Followed by the user's own corrected interpretation of what they had said:

> "You said 'you have accounts per testjourney and visual tracking and qa skills' — meaning I should use those credentials (and the proper helpers) for the verification I was already doing, not author a new E2E spec."

The user spotted that the agent (me) had over-engineered the response: dispatched a write-e2e agent to author a 200-line Playwright spec when the user's actual ask was "switch accounts and use the same MCP loop you were already running." The simpler interpretation matched the user's intent; the elaborate one did not.

This is the third proposal this 48-hour window pointing at the same defect class. The defect is not the specific failure (pause / V0-substitute / over-engineer). The defect is **shallow parsing of casually-typed framework-usage messages**.

## Method

Grounded in three real conversation samples from this user, all on consecutive turns:

### Sample 1 (correctly parsed, eventually)
> "you have browser trakc visual and more thigns continue as we agreed"

Correct read: "you have browser tools, track-visuals, and more things — continue as we agreed (end-to-end)."
What I did first: continued without using browser tools. User had to follow up with "what is current status" twice and "you have users with which you can do the ful lverifications" before I picked up Playwright MCP.

### Sample 2 (over-engineered)
> "you have users with which you can do the ful lverifications"

Correct read: "use the existing test accounts (already in `e2e/.env`) for the V1 verification you're already doing on the gated pages."
What I did: only one account swap (employee), then reverted to the same blocked path.

### Sample 3 (correctly parsed in retrospect, after self-correction)
> "you have accounts per testjourney nad visual tracking and qa skills /route-workflow ... also ones you use for e2e..."

Correct read: same as sample 2 but cluing me to the canonical fixture path and the helper skills.
What I did: dispatched a write-e2e agent to author a brand-new spec — overshooting the user's intent by 10x.

The user's own correction names the failure precisely: "I should keep using the Playwright MCP V1 verification I was running, just with the right account per page. No new spec needed — the track-visuals skill captures screenshots, the existing accounts cover the personas."

## Current state

**What works:**
- `route-workflow` correctly identifies imperative decision words ("proceed", "do it", "go").
- `rules/common/question-fatigue.md` prevents pause-and-ask after imperatives.
- The skill catalog is comprehensive and indexed (`/route-workflow` lists hundreds of skills accurately).

**What doesn't:**
- The agent **maps** every user message to "what skill / new artifact does this need?" It biases toward action-creating. When the user says "you have X for Y", the agent reads it as "create a thing for Y" not "use existing X for Y."
- The agent treats each turn as a fresh routing decision, even mid-task. The mid-task user comment "you have users you can verify with" is interpreted as a new task ("set up E2E users / spec") rather than as "stop, use the existing pool, finish the verification you started."
- There's no heuristic that recognizes **"the user is correcting my method, not changing my goal"**.
- Casual typos and Bulgarian-influenced English ("itnelligent", "tetjourney", "I tnink") are not deformations the agent normalizes well — but the user's underlying message is fully recoverable. The agent currently re-routes on the typo'd surface form rather than the normalized intent.

## Findings (by priority)

### P0 — Fix now

#### F-01 — Add a "method correction vs goal change" classifier in route-workflow

When a user message arrives mid-task (active lane-tasks file exists, session contract is bound to user-request, last assistant turn was action), classify the message as one of:
- **Method-correction**: same goal, different method ("use X to do what you're doing")
- **Scope-correction**: same task, narrower/broader scope ("only do half of these")
- **Goal-change**: new task, abandon current ("forget that, do Y")
- **Status-question**: no change requested, asking for an update ("what is current state")

The classifier reads:
- The **active lane-tasks file**
- The **last assistant turn** (what is currently being executed)
- The **user message**

Heuristics for method-correction (the failure mode):
- Mentions a tool, skill, helper, or fixture path the agent already has access to: `e2e/`, `Playwright MCP`, `track-visuals`, `useTranslation`, `coding/write`, etc.
- Mentions accounts/credentials/users when verification is in progress
- Phrases: "you have X", "use Y", "with the X you have", "via Z", "through W"
- Does NOT mention a new feature, page, or business outcome

When method-correction is detected, the agent's NEXT action MUST:
1. Continue the SAME goal (do not re-route the lane)
2. Switch the METHOD per the user's hint (use the named tool/account/skill)
3. NOT dispatch new agents, write new specs, or create new artifacts unless the user's hint explicitly requested them

#### F-02 — Add a "minimum viable swap" rule

When the method-correction is "use X instead of Y" where Y was working but slow/wrong-tier, the agent's response should be the smallest possible swap:
- Change the credential / account
- Change the helper / fixture
- Change the URL / target
- DO NOT change the test architecture, write new code, dispatch new agents

Concrete: if doing manual Playwright MCP screenshots and the user says "you have accounts in e2e/.env", the swap is `loginPage.fill(getTestAccount('owner-b'))`. NOT `Agent({ subagent_type: 'general-purpose', prompt: 'author a new E2E spec...' })`.

A simple test: count the additional artifacts created by your interpretation. If the user's correction implies a 1-line credential swap, your response with 100 lines of new code is over-engineered. Reject and choose the smaller swap.

#### F-03 — Normalize casual / non-native English before routing

The user types fast, uses Bulgarian-influenced English, and frequently includes typos. Examples from real messages:
- "should improvmeent for this thing" → "should be an improvement for this thing"
- "you have users with which you can do the ful lverifications" → "you have users with which you can do the full verifications"
- "you have browser trakc visual and more thigns" → "you have browser, track-visuals, and more things"
- "wait waht you are suppsoed to validate" → "wait, what you are supposed to validate"
- "I tnink" → "I think"
- "tetjourney" → "test-journeys"

A pre-routing normalization step (lightweight LLM rewrite or rule-based) should canonicalize the input before classification. The semantic content is fully preserved by the human author; the noise is keystroke-level. The agent should not re-interpret based on noisy surface forms.

### P1 — Important but doesn't block

#### F-04 — "Mid-task hint" annotation in lane-tasks.json

Add a `mid_task_hints[]` array to `.svc/lane-tasks-<WI>.json` capturing every user mid-task correction. Each entry: `{ts, user_text, classification, applied: bool}`. This makes drift auditable — if 3+ method-corrections fire on the same lane, the lane's quality is suspect.

#### F-05 — Skill-catalog hint resolver

When user message contains words that match skill descriptions (e.g., "test journey" → `test-journeys` skill, "visual tracking" → `track-visuals`), inject a resolved `mentioned_skills: [...]` field into the routing context. This biases the agent toward "the user is naming an existing skill they want me to use" rather than "the user is naming a concept I should build."

### P2 — Polish

#### F-06 — Self-test: rephrase user message before responding

Before the action turn, the agent silently rephrases the user message into formal English and lists the named entities. If the rephrase changes the apparent intent, the original interpretation was probably wrong. Examples:

- "you have users with which you can do the ful lverifications" → "[entities: users, verifications] You have credentials available; use them for the verifications you are running."
- The action: switch credential, continue verification.

If the rephrase still parses as "build something new," the input was actually a new request.

## Open Questions

1. **Where does normalization run?** Pre-routing (in `route-workflow`'s very first check) or per-skill (each skill's intent parsing)? Probably both — `route-workflow` for routing decisions, individual skills for their specific intent extraction.
2. **Is this an LLM step or a rule-based step?** A small fast model (Haiku) could handle normalization + classification in <500 tokens. Rule-based (regex + keyword matching) might cover 80% at zero cost. Probably hybrid.
3. **Audit hook?** Should `audit-session-execution` flag turns where the agent's interpretation produced 5x more artifacts than a literal reading of the user message? The asymmetry is detectable.

## Files this would touch

- `route-workflow/SKILL.md` — pre-routing normalization step + method-correction classifier (F-01, F-02, F-03)
- `route-workflow/_shared/intent-classification.md` (new) — heuristics + examples
- `references/anti-patterns.md` — new AP for "Method-correction misread as goal-change"
- `~/.claude/rules/intelligent-intent-parsing.md` (new) — short steering rule
- `audit-session-execution/SKILL.md` — add 5x-artifact-asymmetry detection (F-06)

## Why this matters

The user has explicitly signaled three times in 48 hours that the agent over-translates their casual mid-task corrections into elaborate new tasks. Each over-translation costs:
- Agent dispatch tokens (~10K per general-purpose agent spawn)
- Real-time waiting for the agent to complete
- User cognitive load to re-correct after the over-engineered response lands
- Trust erosion ("this thing doesn't read me right")

The 1-line credential-swap path was always available. The agent didn't take it because its routing primitive treats each turn as "what new artifact does this user want?" rather than "is the user telling me to keep doing what I'm doing, just better?"

This proposal makes the second framing the default for mid-task user input.

## Self-correction commitment

For the immediate session: I will **not** wait for the dispatched write-e2e agent. I will use Playwright MCP with the credentials already in `e2e/.env` (`e2e-onboard-primary` for AddLocationWizard via `/Locations` → "Add Location" button click; `e2e-owner-b` or `e2e-owner-c` for SubscriptionManagement active-sub view) to close the 2 render-gated wave-4 cases at V1. Total cost: 5 minutes of MCP navigation. Total artifacts: 2 screenshots. No new spec, no new branch.

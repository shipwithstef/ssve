# Journey: Trend Discovery to Learning Path Completion

**Personas:** P1 (Priya — Independent Learner), P4 (Sofia — Career Transitioner)
**Features crossed:** feature-trend-learning, enabler-trend-scraper
**Tier:** 1 — Platform-Native

## Background

- Given the user has a TrendLearner account (P1: self-hosted free instance; P4: operator-hosted SaaS signup)
- And at least one social platform scraper is configured and has completed an initial scrape cycle [SCR-01, SCR-03]
- And the user has configured their skill profile with self-assessed skill levels [SKL-01]

## Scenario 1: First-time user discovers trending AI topics

- When the user opens the TrendLearner dashboard for the first time
- Then they see the top 10 trending AI/ML topics from the last 48 hours [TRN-01]
- And each topic shows a title, one-sentence summary, source platform icons, and signal strength score [TRN-02]
- And each topic includes a "Why trending" explanation citing specific signal sources [TRN-03]

- When the user wants to focus on their area of interest
- Then they can filter trends by AI/ML subfield using at least 8 predefined categories [TRN-04]
- And the dashboard indicates when the trend data was last refreshed [TRN-05]

## Scenario 2: User explores a learning path for a trending topic

- Given the user has browsed the trend dashboard and identified a topic of interest

- When the user selects a trending topic
- Then they see a curated learning path containing 3-8 resources for that topic [LRN-01]
- And resources are ordered by prerequisite logic with foundational resources first [LRN-02]
- And each resource displays title, format, estimated time, difficulty level, and external link [LRN-03]

- When the user's skill profile indicates beginner-level knowledge in the topic's domain
- Then the learning path includes prerequisite resources and beginner-friendly content [LRN-04]
- And advanced resources that require unmet prerequisites are flagged with "prerequisite needed" indicators [LRN-05]

- When a different user with advanced-level knowledge views the same trend
- Then their learning path shows different, more advanced resources for the same topic [LRN-04]

## Scenario 3: User completes resources and tracks skill progression

- Given the user has started a learning path from Scenario 2

- When the user finishes an external learning resource and returns to TrendLearner
- Then they can mark that resource as "completed" [SKL-02]
- And the completion is reflected on their skill profile page [SKL-03]
- And their inferred skill level for the relevant category updates within the same session [SKL-04]

- When the user views their skill profile page
- Then they see a visual summary of skill levels across all categories [SKL-03]
- And the summary shows both self-assessed levels and system-inferred levels based on completions [SKL-03]

## Scenario 4: User provides feedback on trends and resources

- Given the user has browsed trends and explored learning paths

- When the user encounters a trend that is not relevant to their interests
- Then they can rate it as "not relevant" via a single click [TRN-06]

- When the user completes a learning resource
- Then they can rate it as "helpful" or "not helpful" [TRN-07]

- When the user returns to the dashboard on a subsequent visit
- Then trend rankings and resource ordering reflect their accumulated feedback [TRN-08]

## Scenario 5: System scrapes and processes signals (background)

- Given the scraper is configured with API keys for at least one platform [SCR-01, SCR-06]

- When a scheduled scrape cycle begins [SCR-03]
- Then the scraper collects AI/ML-relevant posts from the last 48 hours across all enabled platforms [SCR-02]
- And respects each platform's API rate limits [SCR-05]

- When one platform API is unavailable during the cycle
- Then the scraper logs the error and continues with remaining platforms [SCR-04]

- When raw signals are collected
- Then they are normalized into the common signal schema with all required fields [SIG-01]
- And duplicate signals within the cycle are deduplicated [SIG-02]
- And signals are filtered for AI/ML domain relevance using keyword matching and LLM classification [SIG-04]

- When signals older than the retention period exist in storage
- Then they are automatically purged [SIG-03]

---

## Layer 3 Analysis

### Ungrounded Preconditions

The following background conditions have no current producer (no spec or enabler defines how they come into existence):

| Precondition | Required by | Gap |
|-------------|------------|-----|
| "User has a TrendLearner account" | Background | No User Account Service or Authentication enabler is specified. Self-hosted free mode (P1) may not require accounts, but operator-hosted mode (P4) requires signup, authentication, and session management. **Needs: enabler-auth-service spec.** |
| "User has configured their skill profile" | Background, SKL-01 | The User Profile Service is listed as a dependency in the feature spec but has no dedicated enabler spec yet. Profile creation, storage, and retrieval need specification. **Needs: enabler-user-profile spec.** |
| "Initial scrape cycle has completed" | Background | The scraper spec defines the cycle but does not specify what happens between deployment and first cycle completion. The trend dashboard must handle the "no data yet" state gracefully. **Needs: DEP-01 implementation note or new AC for empty-state handling.** |
| "Learning resources exist in the catalog" | LRN-01, LRN-03 | The Content Aggregator is listed as a dependency but has no enabler spec. How resources are discovered, indexed, and maintained is unspecified. **Needs: enabler-content-aggregator spec.** |
| "Trend Synthesis Engine processes raw signals into ranked trends" | TRN-01, TRN-03 | The Trend Synthesis Engine is listed as a dependency but has no enabler spec. How raw signals become ranked, explained trends is unspecified. **Needs: enabler-trend-synthesis spec.** |

### Cross-Journey Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| Deployment journey (not yet specified) | Upstream | This journey assumes deployment is complete. A separate J0-deployment journey for P1 (Docker setup) and P3 (operator setup) would cover DEP-01 through DEP-04. |
| Team learning journey (not yet specified) | Downstream | After P1 completes this journey and evangelizes TrendLearner, P2 (Daniel) begins the team rollout journey, which requires team features (SKL-05, SKL-06, SKL-07). |
| Operator business journey (not yet specified) | Parallel | P3 (Rahul) experiences this journey from the perspective of evaluating end-user experience quality, not personal learning. A separate operator journey would cover business setup, billing, and user management. |

### Persona Evaluation

#### P1 (Priya) — Independent Learner

- **Entry point:** Scenario 1. Priya opens the dashboard after a 10-15 minute Docker setup. She expects current trends immediately.
- **Critical moment:** Transition from Scenario 1 to Scenario 2. Does she find a trend interesting enough to click through to a learning path? If the top 10 trends include at least 1-2 she had not heard about, she is hooked (per her persona "first session" success criteria).
- **Patience risk:** If TRN-01 returns stale trends (>48 hours old) or TRN-03 explanations are vague ("this is popular"), Priya's skepticism profile says she will classify this as "another aggregator that doesn't get it" and bounce.
- **Feedback engagement:** Priya will actively use TRN-06 and TRN-07 (Scenario 4) because she values transparency and wants the system to reflect her expertise. She expects TRN-08 to produce visible improvements.
- **Journey completion:** Priya is likely to complete all 4 user-facing scenarios within her first week. She becomes a power user through repeated cycles of Scenarios 1-4.

#### P4 (Sofia) — Career Transitioner

- **Entry point:** Scenario 1, but with a fundamentally different experience. Sofia signs up via an operator-hosted instance (no Docker). Her skill profile shows beginner-level ML knowledge.
- **Critical moment:** Scenario 2 is make-or-break. When Sofia selects a trend, she needs LRN-04 and LRN-05 to work correctly — the learning path must adapt to her beginner level and flag prerequisites. If the path starts with advanced papers assuming PyTorch knowledge she does not have, she will bounce (per her persona: "Dashboard is full of advanced topics she cannot parse").
- **Patience risk:** Sofia has under 3 minutes to first value. If Scenario 1 shows trends without difficulty annotations and Scenario 2 produces an expert-level learning path, she concludes "this tool is for experts, not for me" and leaves.
- **Skill progression dependency:** Scenario 3 is essential for Sofia's multi-month journey. She needs SKL-03 and SKL-04 to show visible progress. If completing resources does not visibly update her skill profile, she loses the progression signal that keeps her motivated.
- **Feedback engagement:** Sofia is less likely to use TRN-06 (trend feedback) in early sessions because she lacks the domain expertise to judge trend relevance. She will use TRN-07 (resource feedback) because she can judge whether a tutorial was helpful at her level.
- **Journey completion:** Sofia takes 2-4 weeks to progress through all scenarios. She repeats Scenarios 2-3 many times as she works through learning paths. Scenario 4 becomes important after her first month when she has enough experience to evaluate trends.

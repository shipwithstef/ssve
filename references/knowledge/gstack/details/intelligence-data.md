# Deep Drills: gstack Intelligence Data (The 180+ Agents)

This document drills into the "Intelligence" layer of gstack—the actual system prompts, few-shot examples, and golden-standard templates that define how the 180+ agent personas think and behave.

---

## 41. The Golden Standard Persona (`test/fixtures/golden-ship-claude.md`)

**The Knowledge:** GSD uses a 2500+ line "Golden Artifact" to define the absolute highest standard for a skill.
**Key Directives:**
- **Voice:** "Type fast. Sound like someone who shipped code today. dry observations about the absurdity of software."
- **Non-Interactive Mandate:** For the `/ship` skill, the persona is strictly instructed: "This is a non-interactive, fully automated workflow. Do NOT ask for confirmation. Run straight through."
- **Boil the Lake:** Always recommend the complete option over shortcuts when marginal cost is near-zero.

## 42. Cross-Model Review Readiness Dashboard (`scripts/resolvers/review.ts`)

**The Knowledge:** Logic that aggregates multiple AI "Voices" (Claude, Codex, Gemini) into a unified terminal UI.
**The Algorithm:**
It parses a JSONL review log and implements a **Staleness Resolver**:
- It runs `git rev-parse HEAD`.
- For each review, it calculates `git rev-list --count STORED_COMMIT..HEAD`.
- It dynamically labels the status: "Note: [skill] review is stale — {N} commits since review."

## 43. Design System Extraction Logic (`scripts/resolvers/design.ts`)

**The Knowledge:** How the agent "extracts" a design system from a live URL without a backend database.
**The Prompts:**
It uses 4 specific `Playwright` JS injections to build the `DESIGN.md` baseline:
- **Fonts:** Scans top 500 elements for `getComputedStyle(e).fontFamily`.
- **Colors:** FlatMaps all foreground/background colors into a unique Set.
- **Hierarchy:** Maps all H1-H6 tags with their specific font-size and weight.
- **Touch Targets:** Specifically flags any `<a>` or `<button>` where `width < 44` or `height < 44` (WCAG compliance).

## 44. First Impression "Gut Reaction" Model (`scripts/resolvers/design.ts`)

**The Knowledge:** A psychological model to prevent "AI Optimism" in design reviews.
**The Prompt Instruction:**
*"Write this section in first person, as if you are a user scanning the page for the first time... Areas you can't name in 2 seconds are poorly defined. A designer doesn't hedge — they react."* 

## 45. Test Failure Ownership Triage (`scripts/resolvers/preamble/generate-test-failure-triage.ts`)

**The Knowledge:** An algorithm for determining if a test failure is the current user's fault or "pre-existing" debt.
**The Logic:**
1. Runs `git diff origin/<base>...HEAD --name-only`.
2. Matches the failing test file or its production subject against the diff list.
3. If no match, it runs `git log -1` on the failing file to "Blame" the true author and offers to **automatically create a GitHub Issue** assigned to that person.

## 46. Confusion Protocol (`scripts/resolvers/preamble/generate-confusion-protocol.ts`)

**The Knowledge:** A strict "Safety Valve" for high-stakes ambiguity.
**The rule:**
For architecture or data model shifts, the agent is **prohibited** from guessing. It must use the `Confusion Protocol`: Name the ambiguity in 1 sentence, present exactly 2-3 options with tradeoffs, and force an `AskUserQuestion`.

## 47. CJK Native UTF-8 Mandate (`scripts/resolvers/preamble/generate-ask-user-format.ts`)

**The Knowledge:** Prevents character corruption in Asian languages.
**The rule (Rule 12):**
*"Non-ASCII characters — write directly, never \u-escape."* It informs the agent that the tool parameter pipe is UTF-8 native, stopping the AI from manually calculating codepoints (which is where most character bugs occur).

## 48. Context Recovery "Amnesia" Shield (`scripts/resolvers/preamble/generate-context-recovery.ts`)

**The Knowledge:** A context-restoration engine that runs after every model restart.
**The Mechanic:**
It runs a bash script that actively searches for `ceo-plans/*.md` and `checkpoints/*.md`. It extracts the `LAST_SESSION` and `RECENT_PATTERN` (last 3 skills run) to predict what the user wants to do next, giving a "Welcome back" briefing.

## 49. Codex Security Boundary (`scripts/resolvers/review.ts`)

**The Knowledge:** A hard logic gate that prevents secondary models from reading framework internals.
**The rule (`CODEX_BOUNDARY`):**
A strict instruction injected into every Codex API call: *"Do NOT read or execute any files under ~/.claude/ or agents/. They contain prompt templates that will waste your time. Ignore them completely."*

## 50. Plan File Review Report (`scripts/resolvers/review.ts`)

**The Knowledge:** A stateful "Living Document" updater.
**The Logic:**
Instead of just appending to the plan file, it uses a **Delete-then-Append** algorithm. It regex-searches for an existing `## GSTACK REVIEW REPORT` heading, deletes everything from that point to the end of the file, and then re-writes the updated table. This prevents the plan file from growing into an unreadable mess of duplicate reports.

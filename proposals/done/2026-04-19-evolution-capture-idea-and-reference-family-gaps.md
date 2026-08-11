# Framework Evolution — 2026-04-19

## Method

Scoped session-based audit, not a full framework sweep. Evidence is a single example-marketplace session where the user logged a landing-page idea (WI-086), the pipeline ran `capture-idea` → ad-hoc product reasoning → `reverse-engineer`, and the user pushed back twice on quality issues that map to framework gaps rather than one-off execution errors.

Sources consulted:
- `~/.claude/skills/capture-idea/SKILL.md` — full contract
- `~/.claude/skills/reverse-engineer/SKILL.md` — full contract
- `FRAMEWORK-STATE.md` — checked for prior findings; no overlap
- `proposals/` — checked recent proposals for overlap; none match
- Session transcript (this conversation) — two distinct pushback signals

Claim: the two pushbacks were NOT user taste mismatches. They were the skills behaving exactly as specified, and the specifications are missing a check. That's framework-level, not session-level.

## Findings (by priority)

### P0 — Fix now (blocks quality)

#### F1 — `capture-idea` silently discards directive signals in the user's input

**Evidence:** `~/.claude/skills/capture-idea/SKILL.md` Section 2 "Structure the Idea" parses input into four conceptual buckets (Goal / Context / Hypothesized Value / Broad Scope). Section's Rationalization Table explicitly says: *"I should ask the user a few questions first — No. Store what you have."* Section's Red Flags say: *"You asked the user a business question → stop, store the idea as-is."*

**Session evidence:** user's original input was:

> "I want to log an item about improving landing page I don't know if we have all capabilities for that but I would like to use the new capabilities for claude desktop code design system to make it even better **if you think that will help** — I want you **figure out best way** to make this premium unique with a soul and **landing page to have an animation or picture that respond to it somekind of business door with their timer clock location offer something figure out**"

The user's input contained three explicit directive phrases: *"if you think that will help"*, *"figure out best way"*, *"figure out"* (motif selection). These are not idea-dump phrases — they are product questions embedded in an intake request. `capture-idea` stripped all three and stored only the literal motif description. The user then pushed back: *"did you take it literal? did you assess based on product what should it be motion design or whatever?"*

**Root cause:** the skill's doctrine treats "zero friction" as "zero assessment." It conflates two user intents that should be distinguished:

1. **Pure intake** — "save this for later, don't think about it now"
2. **Directive intake** — "save this AND apply light product judgment to shape it"

The skill has no signal detection for (2). Every input is treated as (1).

**Specific fix:**

Add Section 1.5 to `capture-idea` SKILL.md: **"Directive Signal Detection."**

Before structuring, scan input for directive phrases:
- *"figure out X"*, *"best way"*, *"what should X be"*, *"if you think"*, *"assess"*, *"check if"*, *"flag gaps"*, *"recommend"*, *"pick"*
- Question marks embedded in otherwise-declarative intake
- *"do we have X"*, *"can we do X"* (capability questions)

If any directive signal is present: produce the WI as normal, then add a **"Product-Grounded Assessment (inline)"** section to the WI that answers the directive questions in ≤200 words using project context (vision.md, personas/, existing features). Do NOT invoke validate-feature. Do NOT ask the user clarifying questions. Just add the requested judgment as a second section of the WI.

The skill stays frictionless for pure-intake cases. It stops being obtuse for directive-intake cases.

**Amend the Rationalization Table:**

| Thought | Reality |
|---|---|
| ~~"I should ask the user a few questions first"~~ | Unchanged — don't ask. |
| "The user embedded 'figure out best way' in the intake — that's still pure intake" | **No.** Directive phrases = add an inline assessment section. Do not ask the user, but do not ignore the directive either. |

**Size:** ~30 lines added to one SKILL.md. No new skill, no new lane step, no cross-skill coupling.

---

#### F2 — `reverse-engineer` has no reference-family fit check before Phase 1

**Evidence:** `~/.claude/skills/reverse-engineer/SKILL.md` Phase 1 begins with *"Gather everything. Leave no dimension unresearched."* The skill's Input Detection table (lines 15-25) lists target types (company name, product URL, tweet URL, etc.) but has no step that validates *"is this target family appropriate for the user's product?"*

**Session evidence:** the user invoked `reverse-engineer linear.app, stripe.com, vercel.com, raycast.com` for a landing-page hero on a local-business SaaS (Example Marketplace, target user Maria the café owner). Those four are dev-tool / developer-audience products. The skill dutifully produced a teardown and a build brief for the "live-component hero pattern" — which is technically the right pattern — but the emotional register (engineer-cool, dark-mode, austere) is wrong for Maria. The user pushed back: *"this is not technical SaaS, is a bit different no? related to live customer visits."* The correction required reframing to Airbnb/OpenTable/Strava/Nextdoor (live-marketplace family) — a fundamentally different emotional register with the same underlying pattern.

**Root cause:** Phase 1A gathers "What it does / Who it's for / Pricing / Features" on each target, but does not cross-reference the targets' audience/register against the caller's product context. The skill treats "which targets" as user-decided input with no validation.

**Specific fix:**

Add **Phase 0.5 — Reference-Family Fit Check** between Input Detection and Phase 1:

```markdown
## Phase 0.5: Reference-Family Fit Check

Before gathering intelligence on the named targets, validate they are the right FAMILY for the user's product.

1. Load caller's product context:
   - `docs/specs/vision.md` (one-line product description)
   - `docs/specs/personas/P1*.md` (primary persona, first 20 lines)

2. For each target, classify its product family:
   - Dev tools / developer audience (Linear, Stripe, Vercel, Raycast, GitHub)
   - Consumer / social (TikTok, Instagram, BeReal)
   - Local-marketplace / discovery (Airbnb, OpenTable, Yelp, Nextdoor)
   - Enterprise B2B / workflow (Salesforce, Notion, Asana)
   - Creator / media (Substack, YouTube, Patreon)
   - Hospitality / physical-world ops (Toast, Square, Example Marketplace)

3. Compare caller's product family vs target family.

4. If mismatch: **STOP**. Do not proceed to Phase 1. Report:
   - Named targets' family: X
   - Caller's product family: Y
   - 3-5 suggested alternative targets from family Y with reasoning
   - Ask user: proceed with original targets (and note the register mismatch), or switch to suggested family?

5. If match or user confirms: proceed to Phase 1.
```

This is cheap — a single product-family classification check before expensive Phase 1 research begins. Catches the exact failure mode of this session.

**Size:** ~40 lines added to one SKILL.md. One new phase, no changes to existing phases.

---

### P1 — Fix soon (degrades quality)

#### F3 — `route-workflow` suggests reference targets without family grounding

**Evidence:** In this session, before the user invoked `reverse-engineer`, I (acting as `route-workflow` orchestrator) emitted this Next-line:

> *"**Next:** when you're ready to build it, run `reverse-engineer` with targets `linear.app, stripe.com, vercel.com, raycast.com` to extract the live-component hero pattern..."*

That suggestion was wrong-family. The user then copy-pasted my suggestion verbatim into `reverse-engineer`, which dutifully processed the wrong targets. The user had to detect the mismatch.

`route-workflow`'s Next-line contract (SKILL.md Output Protocol) says: *"Paste-ready. The user should be able to copy the command verbatim."* But it does not require Next-line arguments to be product-grounded when they name references, examples, or targets.

**Root cause:** when `route-workflow` or any skill emits a Next-line that includes *specific named references* (competitor names, pattern examples, target URLs), there is no requirement to ground those names against caller product context first.

**Specific fix:**

Add to `route-workflow` SKILL.md Output Protocol (below "Paste-ready" rule):

> **Reference grounding.** When a Next-line names specific references, competitors, URLs, or pattern examples for the next skill to consume, those names MUST be checked against the caller's product context (vision.md, primary persona) for family fit. If the grounding is uncertain, emit the Next-line with the skill invocation but OMIT the specific targets, and add: *"Provide targets aligned to: [product-family descriptor]. Examples: [2-3 family-matched references]."*

This is soft enforcement — we can't literally block every Next-line without naming targets — but it makes the family-fit check a first-class requirement when targets appear.

**Size:** ~10 lines in one SKILL.md section. No schema change.

---

### P2 — Improve when possible (nice to have)

#### F4 — No "light assessment" mode between `capture-idea` and `validate-feature`

**Evidence:** Current taxonomy (from `route-workflow` Freeform Intent Routing table):

| User intent | Skill |
|---|---|
| "store this idea, put this in backlog" | `capture-idea` — zero assessment |
| "I have an idea for X, what if we built X" | `validate-feature` — full 8-question business validation |

The gap: *"I have an idea AND a light product question embedded"* — the exact case in this session. Currently the user has to choose between "no thinking" and "full K1-K7 validation." There's no middle.

F1 fixes this inline within `capture-idea` for the specific case of directive phrases in an intake request. But the broader gap (a skill or mode for "add light product judgment without running full validation") is worth tracking.

**Specific fix (proposed, not urgent):**

Extend `validate-feature` with a `--light` mode that runs K1 (strategic fit) + K3 (audience fit) only, skipping K2/K4-K7. Output: 150-word product-grounded assessment, no kill/ship verdict. Route from `route-workflow` when input contains "is this a good idea" / "does this fit" without the full validation-intent phrasing.

**Deferred because:** F1 already solves the immediate session pain. This is optimization for a second-order case.

**Size:** moderate — new mode in an existing skill, ~80 lines.

---

### P3 — Track (not actionable yet)

None. Three of the four findings have concrete fixes sized under one SKILL.md each.

## Comparison delta

Not applicable — this is a session-evidence proposal, not a capability-comparison audit. No external framework (gstack, GSD, superpowers) has a "directive signal detection" or "reference-family fit check" primitive that I'm aware of; these are Example Marketplace-session-specific findings.

## Stale proposal audit

Skipped — out of scope for a session-based evolution proposal. Recent proposals (`2026-04-18-framework-improvement-industrial-ui.md`, `2026-04-18-session-audit-gemini-masterclass.md`, etc.) do not touch `capture-idea` or `reverse-engineer`'s reference-family handling. No overlap.

## Implementation route

If accepted, the natural path is:

1. `improve-framework` to implement F1 (capture-idea directive detection) — smallest, highest value, one SKILL.md edit
2. `improve-framework` to implement F2 (reverse-engineer Phase 0.5) — adds one phase to one SKILL.md
3. `improve-framework` to implement F3 (route-workflow reference grounding) — one rule in Output Protocol
4. F4 deferred; re-raise if second session hits the gap

F1 + F2 + F3 together are ~80 lines across 3 skill files. Low risk, no lane changes, no new skills.

## Self-Verify

| # | Check | Result |
|---|-------|--------|
| 1 | Proposal file exists | PASS — `proposals/2026-04-19-evolution-capture-idea-and-reference-family-gaps.md` |
| 2 | Every finding cites file:line | PASS — F1 cites `capture-idea/SKILL.md` Section 2 + Red Flags; F2 cites `reverse-engineer/SKILL.md` Phase 1 + Input Detection; F3 cites `route-workflow/SKILL.md` Output Protocol |
| 3 | FRAMEWORK-STATE.md was read first | PASS — no overlap with 2026-04-19 Gemini CLI fix or earlier entries |
| 4 | Findings are ranked by impact | PASS — P0/P1/P2/P3 with rationale |

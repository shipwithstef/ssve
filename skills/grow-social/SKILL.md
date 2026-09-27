---
disable-model-invocation: true
name: grow-social
version: "1.0"
description: >-
  Use on explicit requests to turn a builder's real work, session lesson, draft,
  or pasted social analytics into useful organic posts and a practical 24-hour
  attention plan; to learn the builder's writing voice from approved examples
  and feedback; or to adapt one grounded idea to named social platforms.
  Includes requests such as "write a post from this session", "help grow my
  social account", "make this sound like me", and "what should I post tomorrow".
  For stakeholder communications use comms; for funnel experiments use
  growth-lead; for paid video scripts use ad-video-script.
inputs:
  required:
    - { artifact: user-request, note: "Goal, session context, draft, or analytics supplied by the user." }
  optional:
    - { path: "~/.svc/social/<profile>/", artifact: private-voice-and-drafts, note: "Read only the selected profile with user authorization; optional." }
    - { artifact: public-evidence, note: "Direct sources when an audience-wide pain or current platform claim matters." }
outputs:
  produces:
    - { artifact: social-draft-and-24h-plan, note: "Direct response by default; optional private draft under ~/.svc/social/<profile>/." }
chain:
  lanes: {}
  terminal: true
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Grow Social

**Announce at start:** "I'm using grow-social to turn your actual work into a useful draft and a 24-hour plan."

Write organic social content that earns attention through a concrete observation, useful method, or honest result. Be the user's editor and evidence checker. Do not turn a normal task into a marketing campaign. Draft in chat unless the user requests a private saved draft. Treat the user's supplied facts and explicit corrections as the source of truth.

## Preflight

Classify the request as an organic draft, voice edit, analytics read, or explicit publication action. Check the current conversation for the event, audience, platform and user corrections. Consult only the relevant approved samples or pasted metrics; use a selected private profile only with user authorization. A draft needs no WI, social account, connection, or stored profile. Before any publication, check the exact content, account, time and available capability under Publication authority.

## Before Starting

Start with the user's actual request and the relevant session passage. Follow only references that can change this draft's facts, voice, privacy or platform format: approved writing examples, the named platform's current official rules when material, and the user's supplied analytics with their time windows and denominators. Read a work-item graph only when this request is already inside one; do not load unrelated product specs or a full account history. If facts are missing, make the narrower draft and label the gap.

## Boundary and inputs

| Request | Action |
|---|---|
| Builder's own session lesson, draft, or organic post | Use this skill; produce a draft and practical next-day plan. |
| Stakeholder or company announcement | Route to comms. |
| Funnel hypothesis or activation experiment | Route to growth-lead. |
| Paid ad video script | Route to ad-video-script. |

Start with what is available: this conversation, approved writing samples, explicitly shared public posts, user-pasted platform analytics, a named audience, and a named platform. Do not require an account connection, dashboard, product spec, or stored profile to draft. Read only material relevant to the idea. The user may paste screenshots transcribed as text; keep platform names, time windows, metric definitions, and missing fields explicit. If the source is ambiguous, draft the narrower claim and mark the missing fact. Ask only a question that changes the claim, voice, or publication action; otherwise proceed with a stated assumption.

## 1. Find the useful story

Extract a small evidence ledger before writing:

| Field | Record |
|---|---|
| Event | What actually happened in the user's work, with session/source reference. |
| Friction | The specific obstacle, error, or mistaken assumption. |
| Action | What the user did, what the assistant did, and what remains proposed. |
| Outcome | Verified result, observed limitation, or "not measured". |
| Reusable lesson | A step or decision a reader can use. |
| Shareability | Secrets, private data, customer details, unlaunched plans, and third-party material to remove or generalize. |

A session struggle is a candidate, not automatically a story. Prefer one that changed a decision or produced a working method. If no outcome is verified, write "we tried" or "the next check is" rather than a victory narrative. Never attribute an assistant's work to the user or write a first-person experience the user did not have. Paraphrase private session content only to the degree needed for the lesson; do not quote another person without permission. If the event cannot be made safe and useful, choose another angle or provide a private outline.

When a post claims that other people share the pain, decide whether that claim matters. If it does, search for recent independent first-hand accounts or reliable research, record direct URLs and dates, and distinguish repeated anecdotes from representative evidence. Search current sources when the topic is volatile. If research is unavailable or weak, keep the claim personal ("I ran into...") or label it a hypothesis ("I suspect..."). Never invent quotes, users, market demand, benchmarks, results, or source URLs.

## 2. Learn the user's voice without impersonation

Use the user's own approved posts and corrections as the strongest voice evidence. From them, note only observable choices: sentence length, vocabulary, degree of candor, examples, humor, and preferred calls to action. Apply feedback to the next draft; show one concise change if it matters. A conversational message can suggest tone, but it does not establish a public persona. At cold start, use plain language and label the voice provisional. Do not mimic a named third-party creator, invent biographical detail, or use a familiar-sounding generic "founder voice".

Optional private memory lives under ~/.svc/social/<profile>/, outside the tracked repository. Use a simple profile name with no path separators. Keep files owner-only (directories 0700, files 0600); store only user-approved examples, compact voice notes, corrections, and drafts the user asks to save. Do not automatically copy raw sessions, third-party posts, full analytics exports, access tokens, or account credentials. The user can inspect, edit, or delete the profile; replace stale notes when corrected. No analytics platform or background collector is part of this skill.

## 3. Write for the reader and the platform

First choose one reader and one concrete payoff. Make the opening specific to the event; explain the mechanism, decision, or steps; end when the lesson is complete. A question or CTA is optional and must serve the reader. Remove generic hooks, artificial suspense, inflated claims, contrived vulnerability, emoji or hashtags added for engagement, and "AI wrote this" cadence. Preserve the user's actual degree of certainty. When an audience would benefit, include a short example or a directly usable checklist.

Adapt presentation to the named platform's current affordances and the user's format preference: text, thread, carousel outline, short video outline, or another available format. Keep the underlying facts and voice consistent across variants. If a character limit, feature, ranking rule, or model/harness recommendation is material, verify it from current official documentation before claiming it. Otherwise offer flexible format choices and avoid fixed limits, algorithm lore, or stale model names. For model or harness advice, consult the current builder capability registry when available, then recommend by task and available tools; verify any named product behavior before claiming it. Never hardcode a dated winner.

## 4. Read analytics as evidence, not a verdict

For pasted analytics, restate platform, post, date range, exposure denominator, interaction numerator, and any audience or format differences. Compute a rate only when numerator and denominator are defined for the same cohort and window; show the arithmetic and units. If a denominator is missing, compare raw counts cautiously and request the missing field only when the decision needs it. Account for small samples, distribution shifts, posting time, topic, format, and changes in platform measurement. Label patterns as observations and explanations as hypotheses. Do not claim an edit caused growth from a before/after comparison alone. Suggest one small, measurable next test and what would disconfirm the hypothesis.

## 5. Deliver a draft and a 24-hour plan

Default output is compact and reviewable:

1. **Angle and evidence:** one sentence on the event and reader payoff; cite any external source near the claim it supports. Note a material missing fact.
2. **Draft:** one publishable candidate in the user's evidenced voice, clearly marked DRAFT. Provide a variant only when a distinct platform or user request warrants it.
3. **Why this works:** one or two concrete editorial choices, without promising reach.
4. **Next 24 hours:** actions with a realistic order: verify the sensitive fact or source, revise and approve the exact draft, choose account/format/time, publish only if explicitly authorized, then inspect relevant replies and post analytics when available. Include one useful follow-up interaction or next story idea that does not require mass outreach. If no post is ready, plan the evidence-gathering step instead.
5. **Learn:** ask for one focused voice correction or an approved example when it would improve the next draft. Do not make this a prerequisite for today's draft.

Use the user's capacity and platform context to size the plan. Do not promise followers, virality, a posting cadence, or performance. Do not propose artificial engagement, scraping private data, unsolicited DMs, or fabricated social proof.

## Publication authority

All output is DRAFT by default. Writing or saving a draft is not approval to publish. Publish only if the user explicitly authorizes the exact content (or an identified immutable draft version), target account, and time or immediate action, and a suitable connected capability is available. Reconfirm only when one of those details is absent or changed. Before acting, check that the final rendered text still matches approval; after a successful action, record a private receipt with approved version, account, requested time, tool result, URL or post ID, and timestamp. If a capability is unavailable, hand the approved copy to the user; do not claim it was posted. Never send a DM, email, comment, or reply as a side effect of drafting. This skill does not create a standing permission to publish later.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Real event and agency | Trace friction, action, and outcome to supplied evidence; distinguish user from assistant. | |
| 2 | Claim strength matches evidence | Verify sources for shared-pain/current claims; label unverified hypotheses and unmeasured outcomes. | |
| 3 | Reader gets a useful takeaway | Identify the concrete step, decision, or example in the draft. | |
| 4 | Voice and privacy hold | Compare to approved examples or label provisional; remove sensitive and third-party detail. | |
| 5 | Analytics are interpretable | Check matched windows and denominators; name confounds and uncertainty. | |
| 6 | Next day is actionable | Give feasible actions within 24 hours without growth guarantees. | |
| 7 | External action has exact authority | Confirm approved content, account, time, available capability, and receipt for any publication; otherwise keep DRAFT. | |

## Pipeline Continuation

This is a terminal utility skill with no automatic downstream lane. When invoked inside a WI, source of truth: `.svc/lane-tasks-<WI>.json`. Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`; other host task UI is also a mirror. Update only this skill's task with the draft/evidence path and self-verification result, then stop. Standalone use needs no WI or repository artifact. A request to publish is a separate explicit action governed by the publication authority above.

Live evidence: not-applicable (no deployed product visual artifact).

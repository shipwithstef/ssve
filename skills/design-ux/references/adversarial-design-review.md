<!-- Extracted from skills/design-ux/SKILL.md (WI-CLN-14 / plan §4.13 progressive disclosure). -->

## Adversarial Design Review (after UX is drafted)

Before finalizing, P0 runs a full adversarial review of the UX design using 7 review dimensions, the AI Slop Blacklist, and the 12 Designer Cognitive Patterns. This is not a checkbox exercise — it is a design critique. The reviewer must adopt the cognitive patterns below, internalize the slop blacklist, then score each dimension honestly.

### 12 Designer Cognitive Patterns

Before scoring anything, the reviewer must adopt these mental models. These are not suggestions — they are the lens through which every dimension is evaluated.

1. **Seeing the system, not the screen** — Every screen exists inside a flow. Review the connections between screens, not each screen in isolation. A beautiful screen inside a broken flow is a broken screen.
2. **Empathy as simulation** — Mentally become each persona. What did they do 30 seconds before arriving at this screen? What are they anxious about? What are they trying to get back to?
3. **Hierarchy as service** — Visual hierarchy is not decoration, it is wayfinding. If the user has to search for the primary action, the hierarchy has failed. The most important thing should be unmistakable.
4. **Constraint worship** — Constraints produce better designs. Screen size, accessibility requirements, slow networks, limited attention spans — these are not problems, they are design materials. Embrace them.
5. **The question reflex** — For every design decision, ask "why this and not that?" If the answer is "it felt right" or "that is how it is usually done," the decision is unexamined. Every choice must have a reason traceable to a user need, a persona goal, or a system constraint.
6. **Edge case paranoia** — The happy path is 40% of the user's experience. The other 60% is loading, errors, empty states, partial data, interrupted flows, permission denied, timeout, slow network, wrong input, and "what if they press back?" Design the 60%.
7. **The "Would I notice?" test** — Open the design. Look at it for 3 seconds. Close it. What do you remember? If you cannot recall the primary action, neither will the user. If everything blurs together, hierarchy has failed.
8. **Principled taste** — Taste is not subjective — it is debuggable. "This feels wrong" is the start of an investigation, not the end. Why does it feel wrong? Is it misaligned hierarchy? Competing focal points? Inconsistent density? Name the principle being violated.
9. **Subtraction default** — "As little design as possible" (Dieter Rams). Every element must earn its place. The default is to remove, not to add. If removing an element does not break the experience, remove it.
10. **Time-horizon design** — Design operates on three timescales simultaneously: 5 seconds (visceral — does it look right?), 5 minutes (behavioral — can I accomplish my task?), 5 years (reflective — do I trust this product?). All three must be served.
11. **Design for trust** — Users are lending you their attention and their data. Every interaction is either building or eroding trust. Error messages, empty states, loading states, and permission requests are trust-critical moments — they deserve more design attention, not less.
12. **Storyboard the journey** — Do not review static screens. Narrate the experience like a film: "Sarah opens the app. She sees... She taps... She waits... She sees..." This reveals gaps that static review misses.

### AI Slop Blacklist

The following 10 patterns are indicators of generic AI-generated design. If any appear in the UX design, they must be identified and replaced with intentional, product-specific alternatives. Presence of any slop pattern is an automatic deduction on the AI Slop Risk dimension.

| # | Pattern | Why it is slop | What to do instead |
|---|---------|---------------|--------------------|
| 1 | Purple/violet gradient backgrounds | Every AI design tool defaults to purple gradients. It signals "nobody made a real choice here." | Choose a color that comes from your brand, your content, or your context. If you cannot justify the color, use neutral. |
| 2 | The 3-column feature grid (icon in colored circle + bold title + 2-line description) | This is the default layout AI produces for "show features." It communicates nothing about relative importance. | Prioritize. What is the ONE thing the user needs? Lead with that. If three things are equally important, you have not prioritized. |
| 3 | Icons in colored circles as decoration | Decorative icons that do not aid comprehension are visual noise. They fill space without earning it. | Use icons only when they genuinely aid recognition or wayfinding. If removing the icon changes nothing, remove it. |
| 4 | Centered everything | Center-alignment is the absence of a layout decision. It works for a single heading; it fails for content-heavy screens. | Left-align content. Use alignment intentionally based on reading patterns and content structure. |
| 5 | Uniform bubbly border-radius on every element | When every element has the same large border-radius, nothing has visual identity. The uniformity is the problem. | Vary border-radius by element role. Cards, buttons, inputs, and badges should feel distinct. Or use sharp corners — it is a valid choice. |
| 6 | Decorative blobs, floating circles, wavy SVG dividers | These are filler. They add visual weight without information. | Remove them. Use whitespace instead. If you need visual separation, a 1px rule or a background-color shift is enough. |
| 7 | Emoji as design elements | Emoji in headings, feature descriptions, or CTAs is a sign that no one designed an icon system or visual language. | Design proper iconography or use none. Emoji is for chat, not for product surfaces. |
| 8 | Colored left-border on cards | This pattern (left accent border) has been cargo-culted across thousands of AI-generated UIs. It rarely serves a purpose. | If you need to indicate category or status, use the full card treatment (background tint, icon, label). If not, remove the border. |
| 9 | Generic hero copy ("Welcome to [X]", "Unlock the power of...", "Your all-in-one solution") | This copy tells the user nothing. It is a placeholder that was never replaced. | Write copy that tells the user EXACTLY what they can do right now. "3 invoices need your approval" beats "Welcome to InvoiceHub" every time. |
| 10 | Cookie-cutter section rhythm (hero → features → testimonials → CTA → footer) | This is the default page structure AI produces. It is not wrong, but it is not designed — it is assembled. | Structure the page around the user's actual decision journey. What do they need to know, in what order, to take the action you want? |

### 7 Review Dimensions

Score each dimension 0-10. For any dimension scoring under 7/10: explain concretely what a 10 would look like, then fix the UX design to get there.

---

#### Dimension 1: Information Architecture (0-10)

**What to evaluate:** Is the hierarchy explicitly defined for every screen? Can you state with certainty what the user sees first, second, and third on each screen? Is there a single, unambiguous primary action per screen?

**Scoring rubric:**
- **0-3:** No hierarchy defined. Screen inventory lists elements but not their priority. Multiple competing CTAs per screen.
- **4-6:** Hierarchy partially defined. Some screens have clear primary actions, others are ambiguous. Priority rationale is missing or generic ("this is important").
- **7-8:** Every screen has a defined hierarchy with numbered priorities. Primary action is identified. Rationale references persona goals.
- **9-10:** Every screen has numbered priority elements, a single primary action justified by persona goals, explicit secondary/tertiary ordering, and the hierarchy has been validated against the "Would I notice?" test (Cognitive Pattern 7). Hierarchy decisions trace back to journey steps.

**How to evaluate:**
- For each screen, can you answer: "What does the user see first?" If the answer is "it depends" or "everything is equal," score low.
- Check that Priority 1 elements serve the screen's primary action from the Screen Inventory.
- Verify that no screen has two Priority 1 elements (that is a refusal to prioritize).

---

#### Dimension 2: Interaction State Coverage (0-10)

**What to evaluate:** Are all five interaction states (loading, empty, error, success, partial) specified for every feature on every screen? Not just acknowledged — actually designed, with content, behavior, and transitions defined.

**Scoring rubric:**
- **0-3:** Only the happy path (success state) is designed. Error and loading are mentioned but not specified.
- **4-6:** Loading and error states exist but are generic ("An error occurred"). Empty states are missing or use placeholder text. Partial states are not considered.
- **7-8:** All five states specified for every screen. Error messages are actionable and specific. Loading states specify behavior (can user interact? skeleton vs spinner?). Empty states have contextual prompts.
- **9-10:** All five states are fully designed with specific content, transitions between states are defined, partial states handle real-world data scenarios (what if only 2 of 5 API calls succeed?), and every state has been validated against Edge Case Paranoia (Cognitive Pattern 6).

**State Coverage Table** (fill this out for every feature-screen combination):

| FEATURE | SCREEN | LOADING | EMPTY | ERROR | SUCCESS | PARTIAL |
|---------|--------|---------|-------|-------|---------|---------|
| [Feature/capability name] | [Screen ID] | [Specified? Y/N + brief description] | [Specified? Y/N + brief description] | [Specified? Y/N + brief description] | [Specified? Y/N + brief description] | [Specified? Y/N + brief description] |
| | | | | | | |
| | | | | | | |

**PARTIAL state guidance:** Partial means the screen has some data but not all. Examples: search returned results but images failed to load. Profile loaded but activity history timed out. Dashboard shows 3 of 5 widgets (2 errored). The UX must specify what happens in each partial scenario — does the screen show what it has with error indicators for the rest, or does it block until everything loads?

---

#### Dimension 3: User Journey Emotional Arc (0-10)

**What to evaluate:** Has the experience been storyboarded as a journey? Not just screens and transitions — the emotional experience. What does the user feel at each step? Where are they anxious, confused, delighted, or frustrated? Does the UX design address those emotional states?

This dimension enforces Cognitive Pattern 12 (Storyboard the journey) and Cognitive Pattern 2 (Empathy as simulation).

**Scoring rubric:**
- **0-3:** No journey perspective. Screens are designed in isolation. No mention of user emotion or experience flow.
- **4-6:** Journey flows exist but are mechanical (screen A → screen B → screen C). No emotional consideration. No storyboarding.
- **7-8:** Journey is narrated from the user's perspective. Key emotional moments are identified (first impression, waiting for results, error recovery). UX addresses anxiety points.
- **9-10:** Full emotional arc storyboarded for each persona. Every step specifies what the user does, what the user feels, and how the UX design addresses that feeling. Trust-critical moments (Cognitive Pattern 11) are explicitly designed.

**User Journey Emotional Arc Table** (fill this out for each primary journey):

| STEP | USER DOES | USER FEELS | UX ADDRESSES IT? | HOW |
|------|-----------|-----------|-------------------|-----|
| 1. [First interaction] | [Action] | [Emotion: curious, anxious, impatient, confused...] | [Y/N] | [What the UX does to serve this feeling] |
| 2. [Next step] | [Action] | [Emotion] | [Y/N] | [How] |
| 3. [Waiting/loading] | [Waits] | [Anxious, uncertain — "did it work?"] | [Y/N] | [Loading state design, progress indication] |
| 4. [Result/outcome] | [Sees result] | [Relieved, satisfied, confused, frustrated] | [Y/N] | [How success/error state addresses this] |
| 5. [Recovery / next action] | [Action] | [Emotion] | [Y/N] | [How] |

---

#### Dimension 4: AI Slop Risk (0-10)

**What to evaluate:** Is the UX design specific to THIS product, or could it describe any generic app? Check every element against the AI Slop Blacklist above. Count violations. But also evaluate beyond the blacklist: is the design language specific, opinionated, and intentional?

**Scoring rubric:**
- **0-3:** Multiple blacklist violations. Design reads like a template. Microcopy is generic ("Welcome to...", "Get started"). Layout follows cookie-cutter patterns.
- **4-6:** No blacklist violations, but design is still generic. Could swap in any product name and the UX would still "work." Nothing about the UX reflects the specific domain, user context, or product personality.
- **7-8:** Design is specific to this product. Microcopy references actual user tasks. Layout serves the actual information hierarchy (not a template). No blacklist violations.
- **9-10:** Design is unmistakably THIS product. Screen layouts reflect the actual data shapes and user tasks. Microcopy uses domain language. Empty states reference real scenarios. Error messages name specific failure modes. The UX could not be copy-pasted to another product without rewriting everything.

**How to evaluate:**
- Run each screen through the 10-item blacklist. Any match is a flag.
- Read all microcopy. Replace the product name with "GenericApp." Does the copy still make sense? If yes, it is too generic.
- Check for Subtraction Default (Cognitive Pattern 9): is every element earning its place, or are elements present because "that is what apps have"?

---

#### Dimension 5: Design System Alignment (0-10)

**What to evaluate:** Does the UX design align with the project's DESIGN.md (if one exists)? Are interaction patterns consistent with established conventions? Does the UX introduce new patterns without acknowledging existing ones?

**Scoring rubric:**
- **0-3:** No reference to DESIGN.md. UX introduces patterns that contradict existing conventions. Terminology is inconsistent.
- **4-6:** DESIGN.md is referenced but not consistently applied. Some patterns align, others introduce new conventions without rationale.
- **7-8:** All patterns align with DESIGN.md. New patterns are justified. Terminology is consistent. Component behavior expectations match established norms.
- **9-10:** Full alignment with DESIGN.md. New patterns are proposed with rationale and documented as candidates for the design system. Interaction models, naming conventions, and behavioral expectations are fully consistent. The UX design explicitly references DESIGN.md decisions and extends them coherently.

**How to evaluate:**
- If `DESIGN.md` exists: read it. Check every interaction pattern, component behavior, and naming convention in the UX against it.
- If `DESIGN.md` does not exist: evaluate internal consistency. Are similar interactions handled the same way across screens? Are naming patterns consistent?
- Check that the UX does not assume UI patterns that contradict the design system's direction (e.g., specifying a sidebar navigation when DESIGN.md establishes bottom tab navigation).

---

#### Dimension 6: Responsive and Accessibility (0-10)

**What to evaluate:** Are mobile and tablet behaviors specified (not just "it stacks")? Is keyboard navigation explicitly defined? Screen reader flow? Are these feature-specific decisions or generic WCAG boilerplate?

**Scoring rubric:**
- **0-3:** No responsive strategy. No accessibility beyond "meets WCAG." Keyboard navigation not mentioned.
- **4-6:** Responsive strategy says "stacks on mobile" without specifying what stacks, what hides, or what reorders. Accessibility requirements are generic (copied from guidelines, not feature-specific).
- **7-8:** Responsive strategy specifies behavior per screen per viewport. Accessibility defines tab order, focus management for modals and dynamic content, screen reader announcements for state changes. Feature-specific, not boilerplate.
- **9-10:** Responsive strategy addresses content priority on small viewports (references Information Hierarchy from Dimension 1), touch target sizing for primary actions, and scroll behavior. Accessibility defines keyboard shortcuts, live regions for dynamic content, landmark structure, focus trap for modals, and prefers-reduced-motion behavior. Every timed interaction has an extension mechanism. Constraint Worship (Cognitive Pattern 4) is evident — mobile constraints have improved the design, not merely been accommodated.

**How to evaluate:**
- Open the responsive strategy section. For each screen, can you describe exactly what happens on mobile without guessing? If not, it is underspecified.
- Check keyboard navigation: is tab order defined for each screen? Is focus management defined for modals, route changes, and dynamic content?
- Check screen reader: are announcements defined for every state transition from Dimension 2?
- Ask: "Could a developer implement the mobile version from this spec alone?" If no, score low.

---

#### Dimension 7: Unresolved Design Decisions (0-10)

**What to evaluate:** Are there ambiguities that will haunt implementation? Places where the UX says "TBD" or relies on the developer to figure it out? Decisions that were deferred but never resolved?

**Scoring rubric:**
- **0-3:** Multiple TBDs, open questions, and "the developer can decide" handwaves. Key interactions are ambiguous. Flows have decision points without specified outcomes.
- **4-6:** Most decisions are made, but edge cases are hand-waved. Some flows have implicit assumptions that are not documented. Open questions exist but are acknowledged.
- **7-8:** All core decisions resolved. Edge cases addressed. Open questions are few, low-impact, and explicitly documented with proposed answers.
- **9-10:** Zero ambiguity. Every decision is made and justified. No TBDs remain. Edge cases are specified. The UX design is so complete that a developer could implement it without asking a single clarification question. Open Questions section exists but is empty or contains only genuine "stakeholder input needed" items with proposed defaults.

**How to evaluate:**
- Search for TBD, TODO, "to be determined," "open question," and question marks in the UX design.
- For each flow: walk through it step by step. At every branch point, is the next step unambiguous? If you have to guess, there is an unresolved decision.
- For each screen: could a developer build it from the spec alone? If they would need to ask "but what happens when...?" — that is an unresolved decision.
- Apply the Question Reflex (Cognitive Pattern 5): for every design choice, is the "why" documented?

---

### Review Scorecard

| # | Dimension | Score | Status |
|---|-----------|-------|--------|
| 1 | Information Architecture | /10 | |
| 2 | Interaction State Coverage | /10 | |
| 3 | User Journey Emotional Arc | /10 | |
| 4 | AI Slop Risk | /10 | |
| 5 | Design System Alignment | /10 | |
| 6 | Responsive and Accessibility | /10 | |
| 7 | Unresolved Design Decisions | /10 | |
| | **TOTAL** | **/70** | |

**Pass threshold:** Total >= 49/70 AND no single dimension below 5/10.

**Remediation rule:** For any dimension scoring under 7/10, the reviewer must:
1. Explain concretely what a 10/10 would look like for THIS specific UX design (not generic advice).
2. Fix the UX design to achieve at least 7/10 on that dimension.
3. Re-score after fixes.

In interactive mode: present scores and ask if user wants to address each dimension.
In auto mode: P0 fixes anything under 7 automatically and re-scores.

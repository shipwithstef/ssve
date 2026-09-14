# Evaluation Framework

29 hard questions across 6 categories. Use these as thinking scaffolding when analyzing each feature spec — you don't need to write out all 29 answers, but you must consider each category before generating insights.

---

## Category 1: User Pain (weight influence: high)

What problem does this feature solve, and how badly does it hurt?

1. **What specifically breaks** for the user without this feature? Name the exact failure mode, not a vague inconvenience.
2. **How often** does this pain occur? Daily friction > once-a-month annoyance. Frequency multiplies impact.
3. **What's the current workaround?** If users can easily work around it, the pain is low. If the workaround is "give up and go solo," the pain is high.
4. **Who feels this pain most intensely?** First-time users? Experienced builders? Teams? The more specific the audience, the sharper the marketing.
5. **Is there a quantifiable cost** to the pain? Lost time, lost matches, wasted credits, abandoned projects — numbers make pain real.

---

## Category 2: User Desire (weight influence: high)

Would someone sign up, switch platforms, or pay more because of this?

6. **Would someone create an account** specifically because this feature exists? If yes, it's a lead driver. If no, it's a retention feature.
7. **Can you demo this in 10 seconds?** Features that are instantly visible in a screenshot or GIF have higher marketing leverage than invisible backend improvements.
8. **Does this create an "I want that" moment?** The emotional reaction test. Not "that's nice" — "I need that."
9. **Would a user mention this when recommending the platform** to a friend? Word-of-mouth features are gold.
10. **Does this make the user feel smart, safe, or special?** Emotional payoff categories: competence, security, status. Which does this feature deliver?

---

## Category 3: Competitive Differentiation (weight influence: medium-high)

How unique is this in the market?

11. **Name 3 alternatives** that have this exact feature. If you can't, it's genuinely differentiated.
12. **Can a competitor copy our marketing sentence** about this feature and have it be true for their product? If yes, it's not differentiated enough.
13. **Is this a novel combination** even if individual elements exist elsewhere? "7-dimension matching" may use known techniques, but the specific 7 dimensions for users are unique.
14. **Does this create a moat?** Network effects, data advantages, trust accumulation — anything that gets harder to replicate over time.
15. **Would a comparison table** make this feature stand out? If it's a clear checkbox win against named competitors, it has high comparison marketing value.

---

## Category 4: Marketing Leverage (weight influence: medium)

How easy is it to communicate this feature's value?

16. **Can a non-technical person understand it** in one sentence? If it requires explanation of how it works, the marketing leverage is lower.
17. **What's the before/after?** The clearest marketing format. "Before: cold DMs with 6.4% response rate. After: matched with a compatible co-builder in 48 hours."
18. **What content format works best?** Some features are best as social proof (testimonials), others as comparison (tables), others as storytelling (case studies). Identify the format.
19. **Does this feature have a memorable name** or can one be created? "Vibe Velocity," "Code Vibe DNA," "Trust Tiers" — named concepts spread better.
20. **Can you write a tweet about this** that would get engagement? If the feature can't compress to tweet-length, its marketing surface area is limited.

---

## Category 5: Risk Assessment (weight influence: negative)

What could go wrong if we market this?

21. **Overpromise risk:** Does the feature deliver what the marketing implies? Is there a gap between the marketed experience and reality?
22. **Network effect dependency:** Does this feature require a critical mass of users to work? Marketing it pre-critical-mass could disappoint early adopters.
23. **Wrong users attracted:** Could marketing this feature attract users who aren't the target audience? E.g., marketing gamification might attract badge collectors, not serious builders.
24. **Complexity backlash:** If marketed prominently, would users find the feature confusing or overwhelming when they actually use it?
25. **Competitor response time:** If we market this, how quickly could a competitor build and ship the same thing? If <1 month, the marketing advantage is temporary.

---

## Category 6: User Role & Declaration (weight influence: high for matching/queue features)

Does this feature create a moment where the user declares who they are?

26. **Does this feature require the user to declare a role, intent, or identity?**
    (e.g., idea-owner, builder-seeker, team-lead, solo, expert, investor)
27. **Is that declaration visible at a high-intent moment** — signup, queue entry, profile setup, first match?
28. **Does the declaration change the experience significantly** for that user type vs. a generic user?
29. **Is there a role-specific framing of this feature that is MORE concrete and meetup-testable** than the feature-level description?
    (e.g., "Queue as idea-owner or builder-seeker" passes. "The algorithm supports role-based queue intent" does not.)

---

## How to Use This Framework

1. **Read the spec** first, then scan all 29 questions
2. **Identify 3-5 questions where this feature scores highest** — those point to your strongest marketing angles
3. **Check Category 5 for dealbreakers** — high risk can disqualify otherwise strong insights
4. **Cross-reference categories** — A feature strong in Pain + Differentiation + Leverage is your best marketing material
5. **Always check Category 6 for matching, queue, and profile features** — role declarations are the most psychologically sticky differentiators in matching platforms
6. **AI-era signal check** — For features touching user preferences, matching dimensions, or profile data: D1 (AI Tools) is ExampleProduct's most time-specific differentiator. Check for three angles: shared stack (same tools = collaborative fluency), complementary stack (different tools = expanded capability), and investment signal (subscription level proxies seriousness). If none appear in the insight list for a D1-adjacent feature, that's a gap worth flagging.
7. **Don't force it** — If a feature scores low across all categories, record that finding honestly. Not every feature is marketing-worthy.

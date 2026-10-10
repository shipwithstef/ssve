## Step 9: User Picks and Pipeline Handoff

### User picks an opportunity (or auto-selected)

1. Use the opportunity as input to `write-vision`
2. Vision incorporates: product definition, builder constraints, infra choices,
   distribution plan, revenue model, pricing, **platform constraints**
3. `validate-feature` runs with opportunity evidence pre-loaded
4. Full pipeline runs from there

### Full Delivery Mode

Read `references/full-delivery-mode.md` for the chained pipeline:
```
write-vision → analyze-domain → analyze-competitors → build-personas →
validate-feature → write-spec → design-ux → design-ui → design-tech →
plan-changeset → execute-changeset
```

**Rules:** Opportunity card IS the vision seed. Platform constraints respected.
`human_checkpoint` still honored. Blockers surfaced to user.

### User says "none of these"

Ask what's wrong. Rescan with adjusted criteria:
- Wrong category → rescan focused there
- Right category, wrong angle → dig deeper in same space
- User has their own idea → respect it, run pipeline on their idea

### User says "just pick the best one"

P0 picks Opportunity #1 (highest score), logs it as a taste decision in the
research log, and runs the pipeline. The user can always change direction
later.

### User says "build my idea anyway"

Respect it. Always. No gatekeeping. Run the pipeline on their idea.

But if their idea is a 2-month build with no revenue until launch and their
builder profile shows no capital, present the staging strategy:

> "Your idea is solid but it's a [N]-week build with no revenue until launch.
> Here's a staging plan:"
>
> **Stage 1 (weeks 1-2):** Build [Opportunity N] — earns money AND [builds
> audience for / teaches domain of / is related to] your big idea.
>
> **Stage 2 (month 2-3):** Revenue from Stage 1 funds entity registration,
> Stripe, better tools, maybe a contractor for your weak skills.
>
> **Stage 3 (month 3+):** Build your big idea with revenue, audience, and
> tools from Stages 1-2.
>
> Or: "build my idea anyway" — always available.

If the vision exists and the staging strategy applies, prefer Stage 1 projects
that are RELATED to the big idea: same audience, same domain, smaller scope.
The best Stage 1 project earns money AND builds an audience for Stage 3.

---

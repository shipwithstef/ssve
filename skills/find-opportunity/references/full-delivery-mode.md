# Full Delivery Mode

When the user says "yes, build it" or auto-selection confidence is very high
(>25 points, top score >85, native platform fit), the skill enters **Full
Delivery Mode**. Instead of just handing off to `write-vision`, it chains
directly through the design phase:

```
find-opportunity (winner selected)
  → write-vision (opportunity card as seed)
  → analyze-domain (lightweight, focused on the niche)
  → analyze-competitors (deep dive on the 2-3 competitors from the opportunity)
  → build-personas (if not already exists)
  → validate-feature (evidence pre-loaded from opportunity research)
  → write-spec (ACs derived from MVP features in opportunity card)
  → design-ux (screen flows for the MVP features)
  → design-ui (visual design for the MVP screens)
  → design-tech (architecture scoped to platform capabilities)
  → plan-changeset (task graph, file set, validation plan)
  → execute-changeset (build in worktree)
```

## Rules

1. The opportunity card IS the vision seed. Don't re-research — the proof chain
   already has the evidence.
2. Each downstream skill receives the opportunity card as context. The
   `design-tech` skill must respect platform constraints (e.g., Base44's
   entity/function/agent model, not a generic Node.js API).
3. `human_checkpoint` on downstream skills is still respected. If the user wants
   to review the spec before execution, they can. But the default assumption in
   Full Delivery Mode is: the builder trusts the pipeline to execute, and
   checkpoints are for approval, not for re-design.
4. If the pipeline hits a blocker (platform can't do X, opportunity assumption
   was wrong), pause and surface it to the user with a specific decision needed.

## Platform-Specific Delivery Shortcuts

- **Base44:** Use `base44-cli` skill for resource scaffolding. The vision maps to
  Base44 entities, backend functions, and AI agents. Don't design a generic
  backend — design the Base44 resource model.
- **Vercel:** Use Edge functions, Serverless, or Next.js App Router. The tech
  design must use Vercel-native patterns (ISR, Edge config, KV).
- **Supabase:** Use row-level security, real-time subscriptions, auth hooks. The
  data model is Supabase-native from day 1.

## When NOT to Use Full Delivery Mode

- User explicitly wants to review each artifact (spec, UX, UI, tech design)
- Opportunity has platform mismatch risk (cross-platform delivery needed)
- Score confidence is medium or low (user taste matters)
- Builder profile shows "exploring" mindset (not ready to commit)

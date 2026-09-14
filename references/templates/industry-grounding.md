# Industry Grounding — section template

**Required for every feature spec moving to BASELINED**, regardless of feature type or keyword match. The only exemption is an explicit `landscape_inapplicable_reason` field in spec frontmatter (or a Type:Enabler/Integration with UX/UI pillar marked `[N/A — justified]`, which has no customer-facing flow to ground).

This is the four-question compass that records WHY for every decision: what does the industry do, what are we doing, why do we differ (or align), and is this a one-way door.

## Section structure

```markdown
## Industry Grounding

**Source:** `docs/specs/analyze-competitors.data.json` (last_verified: <date>, N=<count>)
**Landscape state:** populated | nascent | none-found | inapplicable
**Gate verdict:** PASS | WARN | BLOCK | SKIP | HALT
**Branch taken:** <landscape_state value>

### What the industry does (baseline from training + live data)

<2-3 sentences combining LLM domain knowledge with live competitor patterns from
the structured data. Cite at least one competitor by name when landscape_state
is populated or nascent.>

| Competitor | Mechanism | Path | Cost / Constraint |
|-----------|-----------|------|-------------------|
| <name>    | <what>    | <how>| <cost>            |

### What we're doing

<Our chosen approach, named clearly. One paragraph, no hand-waving.>

### Why we differ (or align)

<One of: cost / moat / capability / regulatory / first-mover-bet / personal-preference / other-justified>

<Specific evidence — not "we think it's better". If this section says "we differ
from all N surveyed competitors," the Compensating Control sub-section is
REQUIRED (see below).>

### Reversibility

<two-way door (reversible, low blast radius) | one-way door (irreversible, high blast radius)>

<If one-way: explicit risk acknowledgement + named exit conditions.>
```

## Frontmatter additions (when applicable)

For `landscape_state: nascent` (1-2 competitors only):
```yaml
thin_evidence_acknowledged: true
```

For `landscape_state: inapplicable` (genuinely no consumer flow):
```yaml
landscape_inapplicable_reason: <e.g., "internal admin tool, no external customers">
```

## Branch-specific add-ons (driven by `scripts/gates/competitive.mjs`)

When the gate engine evaluates the structured data, branch handlers may require additional sub-sections under `### Why we differ`:

- **populated** + spec diverges from ALL competitors → `### Compensating Control` REQUIRED with 4 fields:
  - `missing_capability:` what we do that competitors don't
  - `why_not_now:` why we cannot adopt the competitor mechanism today
  - `risk_of_workaround:` what could go wrong with our chosen path
  - `path_to_replacement:` named conditions under which we'd switch to the competitor pattern
- **nascent** → `thin_evidence_acknowledged: true` REQUIRED in frontmatter (see above)
- **none-found** → `### First-Mover Risk Checklist` REQUIRED with 4 items:
  - `why_no_one_tried:` honest reasoning, not "we're smarter"
  - `what_would_have_to_be_true:` named market / tech / regulatory shifts that justify being first
  - `fastest_disconfirmation:` what would prove the bet wrong, in <30 days
  - `abandonment_trigger:` budget / timeline / signal that triggers exit
- **inapplicable** → `landscape_inapplicable_reason` REQUIRED in frontmatter + logged to `.svc/pipeline-decisions.jsonl`

## Why this section is universal (post-WI-142)

Pre-WI-142 (this template's predecessor `competitive-risk-assessment.md`) only fired for specs whose ACs matched a keyword regex (`earn|redeem|verify|enroll|loyalty|points|reward`). That left 90% of feature work — every non-loyalty feature — without competitive grounding. WI-142 removes the keyword trigger and makes Industry Grounding the default for every BASELINED spec.

Type:Enabler / Type:Integration are not blanket-exempt. Their grounding answers "what do other framework projects (or other systems-of-record in the same category) do for this enabler / integration." A framework-internal Enabler with no customer-facing flow can still set `landscape_inapplicable_reason` if genuinely applicable.

## Phase 5 — Funnel-adjusted EV model

For each survivor, compute expected value per action, NOT just unit infra cost:

```
EV_per_action = P(action_completes_given_friction) × LTV_per_completed_action − Cost_per_attempt
```

Required inputs:
- Unit infra cost per action (from Phase 1b)
- Completion rate per option (from Phase 1b research / industry benchmarks)
- LTV per completed action (from business spec / builder projections)

Required outputs per survivor:
- EV per action at Y1 / Y2 / Y3
- Under Low / Base / High growth scenarios (9 cells per option)
- Break-even math: at what completion rate does this go net-negative?
- Sensitivity tornado: rank inputs by EV impact

### manage-finops invocation policy (optional helper, NOT required)

`skills/manage-finops/SKILL.md` requires `docs/specs/vision.md`. `strategic-decision` treats vision
as optional because many strategic decisions happen pre-vision (vendor / framework / database
picks before product exists).

**Default:** Phase 5 computes EV directly from builder-profile + Phase 1b research +
QUESTIONNAIRE §7.

**Optional escalation:** IF vision.md exists AND decision is specifically
infrastructure/platform-cost-heavy, invoke `manage-finops` for richer FinOps Spec. Skill
continues without it if vision absent.

### Multi-profile handling

If Phase 0b ran comparison mode:
- Run EV model per profile → `EV-MODEL-<profile>.md`
- Produce `MULTI-PROFILE-DELTA.md` showing where winner flips

Otherwise single `EV-MODEL.md`.

## Phase 6 — Adversarial review

Invoke `agents/strategic-reviewer` with input manifest:

**Always pass:**
- `docs/specs/decisions/<slug>/` (all phase artifacts)
- `skills/strategic-decision/SKILL.md` (meta-prompt to audit against)
- `_shared/constraint-profiles.md`
- `_shared/product-question-format.md`
- `references/elimination-gate-protocol.md`

**Conditional pass (if relevant):**
- Feature specs cited in QUESTIONNAIRE Persona Fit
- Journeys referenced by cited features
- Personas referenced by features / journeys
- Vision.md / domain-profile.md / analyze-competitors.md if decision cites them
- Research files cited in DIMENSIONS.md or EV-MODEL.md
- CLAUDE.md / router-context.md if platform/deployment-constrained
- `~/.svc/builder-profile.md` if CONSTRAINT-PROFILE has overrides
- `.svc/pipeline-decisions.jsonl` (grep-scoped to same-topic past decisions)

### Host-adaptive invocation

| Host | Mechanism |
|---|---|
| Claude Code | `scripts/dispatch-worker.sh --agent strategic-reviewer --input-paths <manifest>` → runtime enforces tool allowlist + fresh context |
| Kimi CLI | same script; Kimi's runtime enforces agent YAML |
| Codex CLI | inline load of `agents/strategic-reviewer.md` append content; no runtime enforcement — prompt-level discipline + eval regression catches violations |
| Gemini CLI | same as Codex |

Agent emits YAML findings (see `agents/strategic-reviewer.md` output format). Parent
(this skill) writes the YAML to REVIEW.md.

### What to do with findings

- CRITICAL → must be resolved before proceeding; loop back to the phase the reviewer flagged
- HIGH → address in DECISION.md §Why NOT alternatives with explicit reasoning
- MEDIUM → note in DECISION.md §Risks for revisit
- LOW → optional; note if worth capturing

# Framework Improvement — 2026-05-11 — Provider fidelity for AI visual deliverables

**Status:** PROPOSED — needs `improve-framework` implementation

## Evidence

- **Source:** Example Marketplace WI-233 AI content/image generation closeout and user correction on 2026-05-11.
- **Finding:** The framework allowed a fallback-generated SVG image path to be treated as an acceptable "AI image" result even though the user requirement was to use the Base44 main LLM/AI integration for both text and image creation.
- **Severity:** HIGH

## Diagnosis

- **Root cause:** svc currently verifies outcome presence too generically for provider-backed AI work. A rendered `image_url`, non-empty draft, or successful fallback path can satisfy validation even when the requested integration source was different.
- **Category:** acceptance-fidelity / provider-source control / visual-quality gate.
- **Already in FRAMEWORK-STATE.md?** Partially related visual evidence and completion-scope gaps exist, but this exact provider-fidelity failure is new.

The failure mode is:

1. User asks for AI text + AI images through a specific primary integration.
2. Implementation adds or relies on fallback providers.
3. Validation checks only that content/image exists.
4. Review reports the feature as working.
5. The saved product state shows generic fallback/placeholder-looking images, or does not show the image at all.

That is not a product-quality pass. It is a source-fidelity failure.

## Required Framework Change

### F-001 — Add provider/source fidelity to acceptance extraction

When route-workflow, write-spec, validate-feature, or plan-changeset detects an external service/provider requirement, it must record:

```yaml
provider_fidelity:
  primary_provider: "<provider named or implied by user/spec>"
  primary_capability: "<text|image|video|payment|auth|maps|...>"
  fallback_policy: "forbidden-unless-user-approved | allowed-degraded | allowed-equivalent"
  source_evidence_required: true
```

For the Example Marketplace case, the correct extraction would have been:

```yaml
provider_fidelity:
  primary_provider: "Base44 main AI integration"
  primary_capability: "AI text and AI image generation"
  fallback_policy: "forbidden-unless-user-approved"
  source_evidence_required: true
```

### F-002 — Fallback cannot satisfy primary-provider ACs by default

Review-gate and verify-promotion must fail any provider-backed AC when:

- the evidence shows `fallback`, `mock`, `placeholder`, `svg_fallback`, `included_provider`, or equivalent source, and
- the user/spec requested a named primary provider, and
- there is no explicit acceptance note saying fallback is allowed as equivalent.

Fallback may be logged as degraded behavior, resilience coverage, or a separate AC. It must not silently satisfy the primary-provider AC.

### F-003 — AI image features require semantic visual-quality evidence

Track-visuals review mode must add a specific concern for generated images:

| Check | Pass condition | Fail condition |
| --- | --- | --- |
| Source fidelity | Image source matches requested provider or approved equivalent | Fallback/placeholder source presented as primary |
| Semantic relevance | Image clearly represents the saved item and context | Abstract/generic art that does not communicate the offer/event/slot |
| Saved-state visibility | Image appears after save/return-to-list/detail | Image only appears in draft dialog or not at all |
| Product quality | Image is understandable and commercially usable | Low-detail SVG/placeholder-looking asset |

For AI image deliverables, `track-visuals` must inspect the image itself, not only confirm that an `<img>` rendered.

### F-004 — Saved outcome is mandatory for generation features

`test-journeys` must treat AI generation flows as incomplete until it validates:

1. start state,
2. generate action,
3. generated draft/image state,
4. save/commit action,
5. returned persisted state,
6. persisted image/details visible in the product UI.

Dialog-only screenshots are not enough for closure.

### F-005 — Evidence summaries must report source, not just success

Generated-content evidence summaries must include:

```text
text_source:
image_source:
provider_requested:
fallback_used:
fallback_user_approved:
saved_state_verified:
visual_quality_result:
```

If `fallback_used=true` and `fallback_user_approved=false`, closure is `FAIL` or `DEGRADED`, never `PASS`.

## Implementation Route

- **Route:** normal framework pipeline via `improve-framework`.
- **Primary files likely affected:**
  - `route-workflow/SKILL.md`
  - `write-spec/SKILL.md`
  - `validate-feature/SKILL.md`
  - `plan-changeset/SKILL.md`
  - `test-journeys/SKILL.md`
  - `track-visuals/SKILL.md`
  - `review-gate/SKILL.md`
  - `verify-promotion/SKILL.md`
  - `references/verification-patterns.md` or a new shared provider-fidelity reference
  - one tier-1 validator or fixture replay for provider-fidelity closeout

## Replay Verification

Replay target: Example Marketplace WI-233 style fixture.

The fixture must fail if the evidence says:

```text
provider_requested=Base44 main AI integration
image_source=groq_svg_uploaded
fallback_user_approved=false
saved_state_verified=partial
```

The fixture may pass only when:

```text
provider_requested=<requested provider>
image_source=<requested provider or approved equivalent>
fallback_user_approved=<true only if explicitly approved>
saved_state_verified=true
visual_quality_result=pass
```

## Acceptance Criteria

- [ ] Provider/source fidelity is captured in feature/spec/route artifacts when the user names or implies a required integration.
- [ ] Fallback output cannot satisfy a primary-provider AC unless the user/spec explicitly says fallback is acceptable.
- [ ] AI image deliverables require semantic image-quality review, not just image URL/render checks.
- [ ] Generation flows require saved-outcome journey evidence after the save transition.
- [ ] Review-gate and verify-promotion closeout summaries distinguish `PASS`, `DEGRADED`, and `FAIL` for provider-backed features.
- [ ] A regression fixture based on the WI-233 failure fails before the framework change and passes after it.

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Proposal file exists | PASS |
| 2 | Evidence names the real failure | PASS |
| 3 | Root cause is framework-level, not only Example Marketplace-specific | PASS |
| 4 | Proposed fix is mechanically enforceable | PASS |
| 5 | Replay target defined | PASS |

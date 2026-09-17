# Attribution Notices

This repository blends patterns from external open-source projects. Each
source is listed with its URL, license, copyright holder, blend date, and
the specific patterns taken.

- **This project's license:** [MIT](LICENSE) — Copyright (c) 2026 s7an-it
  \<angelovsan@gmail.com\>
- **Machine-readable blend log:** [`references/blend-registry.json`](references/blend-registry.json)
  (source URL, license, author, SHA, `patterns_taken` / `patterns_skipped`)
- **Plain-text twin:** [`NOTICES`](NOTICES) — keep it aligned when you edit
  this file

New blends must update **all three**: this file, `NOTICES`, and
`references/blend-registry.json`. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## GSD (Get Shit Done v1)

- **Source:** https://github.com/gsd-build/get-shit-done
- **License:** MIT
- **Copyright:** TÂCHES
- **Blended:** 2026-04-06 and 2026-04-08

Patterns taken:

- Context degradation tiers (PEAK/GOOD/DEGRADING/POOR)
- 4-level verification (Exists/Substantive/Wired/Functional)
- Universal anti-patterns adapted for SSVE
- Structured reasoning models at decision points
- Deviation rules (auto-fix vs stop, 3-attempt limit, analysis paralysis guard)
- Scope reduction prohibition (banned phrases, coverage matrix)
- Safety gates before chain advance
- Session continuity and project state tracking
- Questioning anti-patterns (ban checklist walking)
- Freeform intent routing
- Soft workflow guard hook
- Gates taxonomy — 4 canonical types + selection heuristic + SSVE G1–G7 mapping
- Stall detection in revision loops
- Test quality audit
- Adaptive context enrichment
- Agent completion markers convention
- Schema drift detection
- Claim provenance tagging

SSVE targets: `references/context-budget.md`,
`references/verification-patterns.md`, `references/anti-patterns.md`,
`references/thinking-models.md`, `execute-changeset`, `plan-changeset`,
`DOCTRINE.md`, `route-workflow`, `hooks/svc-workflow-guard.mjs`,
`review-gate`, `verify-promotion`, `mine-builder`.

## GSD-2 (Get Shit Done v2)

- **Source:** https://github.com/gsd-build/gsd-2
- **License:** MIT
- **Copyright:** TÂCHES
- **Blended:** 2026-04-30

Patterns taken:

- Artifact verification per unit type (`auto-recovery.ts:verifyExpectedArtifact`)
- Auto-advance state machine (`auto-direct-dispatch.ts` + `dispatch-guard.ts` + `session-lock.ts`)
- Memory extraction from transcripts (`memory-ingest.ts` + `memory-extractor.ts`)
- Compaction snapshot (`compaction-snapshot.ts`)
- Tool-call loop guard (`bootstrap/tool-call-loop-guard.ts`)

SSVE targets: `verify-promotion`, `execute-changeset`, `route-workflow`,
`manage-learnings`, `references/context-budget.md`, `hooks/svc-loop-guard.mjs`.

## gstack

- **Source:** https://github.com/garrytan/gstack
- **License:** MIT
- **Copyright:** Garry Tan
- **Blended:** 2026-04-05, 2026-04-08, 2026-04-13, 2026-07-22

Patterns taken:

- P0 founder persona and forcing questions (`route-workflow`)
- Adversarial CEO/design/eng review gates (`review-gate`, `design-ux`, `design-ui`, `design-tech`)
- `/cso` OWASP + STRIDE security audit (`review-security`)
- `/learn` institutional memory (`manage-learnings`)
- `/browse` headless browser integration (`test-journeys`, `track-visuals`, `write-e2e`)
- `/design-consultation` and `/design-shotgun` (`design-ui`)
- `/investigate` root-cause-first debugging (`diagnose-bug`)
- `/ship` version bump and PR workflow (`land-changeset`)
- `/canary` post-deploy monitoring (`verify-promotion`)
- Review Army specialist dispatch (`audit-implementation`)
- Plan completion audit (`land-changeset`)
- Scope drift detection (`audit-implementation`)
- Failure ownership triage (`execute-changeset`)
- AI Slop blacklist (`references/anti-patterns.md` AP-22)
- Completeness principle — Boil the Lake (`DOCTRINE.md`)
- Search Before Building discipline (`execute-changeset`)
- Test framework bootstrap (`execute-changeset`)
- Design checklist AI slop visual detection (`track-visuals`)
- Central state-root resolver and explicit precedence-chain shape, adapted
  with SSVE's fail-closed authority validation (WI-506)

## superpowers

- **Source:** https://github.com/obra/superpowers
- **License:** MIT
- **Copyright:** Jesse Vincent
- **Blended:** 2026-04-05 and 2026-04-08

Patterns taken:

- `writing-plans` task graph approach (`plan-changeset`)
- Subagent-driven development and TDD execution (`execute-changeset`)
- CSO anti-pattern: skill descriptions summarizing workflow cause shortcut bypass (`references/anti-patterns.md` AP-20)
- Anti-rationalization table format for discipline-enforcing skills (`create-skill`)
- Two-stage review ordering: spec compliance before code quality (`execute-changeset`)
- Mock-interface derivation gate (`references/anti-patterns.md` AP-14)
- Layer-by-layer diagnostic instrumentation (`diagnose-bug`)
- 3-fixes = architectural problem reframe (`diagnose-bug`)
- Anti-sycophancy rules (`references/anti-patterns.md` AP-21)
- Type/naming consistency check across plan tasks (`plan-changeset`)
- Pressure testing methodology for discipline-enforcing skills (`test-framework`)

## oh-my-claudecode

- **Source:** https://github.com/yeachan-heo/oh-my-claudecode
- **License:** MIT
- **Copyright:** Yeachan Heo
- **Blended:** 2026-04-05

Patterns taken:

- Ambiguity gate scoring (weighted dimensions, 20% threshold) (`route-workflow`)
- Commit trailers and verified completion loop (3-strike rule) (`execute-changeset`)
- Tri-model orchestration (`review-cross-model`)
- Learning extraction from debugging (3-question quality gate) (`manage-learnings`)

## claude-code-setup

- **Source:** https://github.com/petekp/claude-code-setup
- **License:** MIT
- **Copyright:** Pete Petrash
- **Blended:** 2026-04-05

Patterns taken:

- Solution exploration and paradigm comparison (`explore-solutions`)
- Systems analysis and correctness audit (`audit-implementation`)

## harness

- **Source:** https://github.com/revfactory/harness
- **License:** Apache-2.0 (this source is **not** MIT)
- **Copyright:** robin (revfactory)
- **Blended:** 2026-04-08

Patterns taken:

- 6 architecture patterns + team vs subagent decision tree (`references/agent-patterns.md`)
- Agent definition convention — WHO vs HOW separation (`references/agent-patterns.md`)
- Pushy skill description standard (`references/anti-patterns.md` AP-19)
- Near-miss trigger testing methodology (`test-framework` tier 1.5)
- Adaptive communication based on user skill level (`route-workflow`)
- Integration coherence / boundary mismatch detection (`references/verification-patterns.md`)

The Apache-2.0 license text for this source is the upstream license at
https://github.com/revfactory/harness. SSVE takes patterns, not a
verbatim copy of the Harness tree.

## last30days-skill

- **Source:** https://github.com/mvanhorn/last30days-skill
- **License:** MIT
- **Copyright:** mvanhorn
- **Blended:** 2026-04-12

Patterns taken:

- Untrusted content fencing — wrap external web content before LLM processing (`references/anti-patterns.md` AP-25)
- Fixture-based behavioral testing — canned input → skill invocation → output validation (`test-framework`)

Recommended companion skill for live market research (external addon):

- Live signal grounding for `validate-feature` business questions (Q1–Q4, Q6)
- Current competitive intelligence for `analyze-competitors`
- Demand evidence for `find-opportunity` market research

## everything-claude-code

- **Source:** https://github.com/affaan-m/everything-claude-code
- **License:** MIT
- **Copyright:** Affaan M. and contributors
- **Blended:** 2026-04-12

Patterns taken:

- Hook runtime profiling (`SVC_HOOK_PROFILE`, `SVC_DISABLED_HOOKS`) (`hooks/hooks.json`)
- Config-protection hook (`hooks/svc-workflow-guard.mjs`)
- Block-no-verify hook (`hooks/svc-workflow-guard.mjs`)
- Commit-quality hook (`hooks/svc-workflow-guard.mjs`)
- Batch Stop format+typecheck (`hooks/svc-stop-quality.js`)
- Model routing decision table (Haiku/Sonnet/Opus) (`references/model-routing.md`)
- CLI-over-MCP preference in DEGRADING/POOR tiers (`references/context-budget.md`)
- pass@k vs pass^k evaluation vocabulary (`test-framework`)

AgentShield (part of everything-claude-code) is recommended as an
**external addon**, not a blended pattern:

- Scans `CLAUDE.md`, hooks, MCP configs, and agent defs for injection risks, secrets, and misconfigurations
- Complements `review-security` (OWASP/STRIDE for app code) — does not overlap
- Install: `npx ecc-agentshield scan`

## taskmaster

- **Source:** https://github.com/blader/taskmaster
- **License:** MIT
- **Copyright:** blader
- **Blended:** 2026-04-09

Patterns taken:

- Stop hook completion guard → `hooks/svc-task-completion-guard.sh`
- Anti-rationalization language (`PROGRESS IS NOT COMPLETION`) → `route-workflow` Task-Graph Execution Protocol

## Anthropic Skills

- **Source:** https://github.com/anthropics/skills
- **License:** MIT
- **Copyright:** Anthropic
- **Blended:** 2026-04-06

Patterns taken:

- Forked `skill-creator` with SSVE pipeline knowledge (`create-skill/`)

## taste-skill

- **Source:** https://github.com/Leonxlnx/taste-skill
- **License:** MIT
- **Copyright:** Leonxlnx
- **Blended:** 2026-04-19

Patterns taken:

- Design Dials (1–10)
- Liquid Glass Refraction
- Inline Image Typography
- Hardware-Accelerated Motion
- Full-Output Pause/Resume

## capacitor-skills

- **Source:** https://github.com/capawesome-team/skills
- **Companion:** https://github.com/Cap-go/capgo-skills
- **License:** MIT
- **Copyright:** Capawesome Team + Capgo
- **Used as:** external runtime add-on since 2026-04-29

72 skills covering Capacitor / Ionic mobile development, plugins, security
scanning (Capsec), testing, CI/CD, and live updates. Installed globally
across hosts via `npx skills add`.

Candidate blends recorded in
`proposals/done/2026-04-29-blend-capacitor-skills.md` (not yet applied to
first-party SSVE skills):

- Skill structure template — Prerequisites → Behavior → Procedures → Errors → Related (`create-skill`)
- Plugin catalog decision matrix (`discover-skills`)
- Capsec security scanning for mobile projects (`review-security`)
- Platform-aware execution guards (`platform-operating-architect`)

## Lucas Patiri UGC Viral Growth Playbook

- **Source:** https://x.com/lucaspatiri_/status/2062627926022238586
- **License:** Public Domain / Social Content Heuristics
- **Copyright:** Lucas Patiri
- **Blended:** 2026-06-05

Patterns taken:

- Structured subagent briefing / task prompts format (`plan-changeset`)
- Raw platform-native aesthetics standard (`references/anti-patterns.md`)
- Down-funnel visual state inventory verification gates (`review-gate`, `verify-promotion`)
- Operational outreach templates and B2B performance milestones (`references/knowledge/domains/cold-outbound/`)

This source is a public social post, not a versioned Git repository.
`references/blend-registry.json` records `staleness_note: manual`.

## Corey Haines Marketing Skills

- **Source:** https://github.com/coreyhaines31/marketingskills
- **License:** MIT
- **Copyright:** Corey Haines
- **Used as:** external runtime add-on since 2026-04-28 (v1.9.0, `EXTERNAL_ADDONS.md`); re-blend analysis at v2.6.0 on 2026-07-13

Patterns derived (candidates, `proposals/2026-07-13-blend-coreyhaines-v2.6.0.md`):

- Loop state/idempotency contract + two-tier action guardrails (`marketing-loops` → SSVE autonomous-loop contract)
- Andromeda-era creative-as-targeting paid doctrine (`ads` → `ad-strategist`)
- Upstream version-staleness probe practice (`VERSIONS.md` → `blend-external` audit mode)

## Sources reviewed without a first-party blend

These were inspected and recorded in `references/blend-registry.json` with
empty `patterns_taken`. They are cited here so the review is visible:

| Source | URL | License | Copyright | Date | Note |
| ------ | --- | ------- | --------- | ---- | ---- |
| open-gsd / gsd-core | https://github.com/open-gsd/gsd-core | MIT | Tom Boucher and contributors | 2026-07-22 | Context-monitor hook skipped: `os.tmpdir` plus silent failure cannot protect SSVE mutation authority |

---

## License notes

Most blended sources are MIT-licensed. **harness** is Apache-2.0. The
Lucas Patiri playbook is cited as public-domain / social heuristics.

This file is attribution of **ideas and adapted patterns**, not a claim
that every listed repository's files are copied into this tree. SSVE's
own original work remains under [LICENSE](LICENSE).

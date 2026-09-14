# Attribution Notices

This repository blends patterns from external open-source projects. Each source is listed with its license and the specific patterns taken.

## GSD (Get Shit Done v1)

Source: https://github.com/gsd-build/get-shit-done
License: MIT
Copyright: TÂCHES

Patterns blended on 2026-04-06 and 2026-04-08:
- Context degradation tiers (PEAK/GOOD/DEGRADING/POOR)
- 4-level verification (Exists/Substantive/Wired/Functional)
- Universal anti-patterns adapted for svc
- Structured reasoning models at decision points
- Deviation rules (auto-fix vs stop, 3-attempt limit, analysis paralysis guard)
- Scope reduction prohibition (banned phrases, coverage matrix)
- Safety gates before chain advance
- Session continuity and project state tracking
- Questioning anti-patterns (ban checklist walking)
- Freeform intent routing
- Soft workflow guard hook
- Gates taxonomy — 4 canonical types + selection heuristic + svc G1-G7 mapping
- Stall detection in revision loops
- Test quality audit
- Adaptive context enrichment
- Agent completion markers convention
- Schema drift detection
- Claim provenance tagging

## GSD-2 (Get Shit Done v2)

Source: https://github.com/gsd-build/gsd-2
License: MIT
Copyright: TÂCHES

Patterns blended on 2026-04-30:
- Artifact verification per unit type (`auto-recovery.ts:verifyExpectedArtifact`)
- Auto-advance state machine (`auto-direct-dispatch.ts` + `dispatch-guard.ts` + `session-lock.ts`)
- Memory extraction from transcripts (`memory-ingest.ts` + `memory-extractor.ts`)
- Compaction snapshot (`compaction-snapshot.ts`)
- Tool-call loop guard (`bootstrap/tool-call-loop-guard.ts`)

## gstack

Source: https://github.com/garrytan/gstack
License: MIT
Copyright: Garry Tan

Patterns blended on 2026-04-05 and 2026-04-08:
- P0 founder persona and forcing questions
- Adversarial CEO/design/eng review gates
- /cso OWASP + STRIDE security audit
- /learn institutional memory
- /browse headless browser integration
- /design-consultation and /design-shotgun
- /investigate root-cause-first debugging
- /ship version bump and PR workflow
- /canary post-deploy monitoring
- Review Army specialist dispatch
- Plan completion audit
- Scope drift detection
- Failure ownership triage
- AI Slop blacklist
- Completeness principle (Boil the Lake)
- Search Before Building discipline
- Test framework bootstrap

## superpowers

Source: https://github.com/obra/superpowers
License: MIT
Copyright: Jesse Vincent

Patterns blended on 2026-04-05 and 2026-04-08:
- writing-plans task graph approach
- Subagent-driven development and TDD execution
- CSO anti-pattern: skill descriptions summarizing workflow cause shortcut bypass
- Anti-rationalization table format for discipline-enforcing skills
- Two-stage review ordering: spec compliance before code quality
- Mock-interface derivation gate
- Layer-by-layer diagnostic instrumentation
- 3-fixes = architectural problem reframe
- Anti-sycophancy rules
- Type/naming consistency check across plan tasks
- Pressure testing methodology for discipline-enforcing skills

## oh-my-claudecode

Source: https://github.com/yeachan-heo/oh-my-claudecode
License: MIT
Copyright: Yeachan Heo

Patterns blended on 2026-04-05:
- Ambiguity gate scoring (weighted dimensions, 20% threshold)
- Commit trailers and verified completion loop (3-strike rule)
- Tri-model orchestration (Claude + Codex + Gemini)
- Learning extraction from debugging (3-question quality gate)

## claude-code-setup

Source: https://github.com/petekp/claude-code-setup
License: MIT
Copyright: Pete Petrash

Patterns blended on 2026-04-05:
- Solution exploration and paradigm comparison
- Systems analysis and correctness audit

## harness

Source: https://github.com/revfactory/harness
License: Apache-2.0
Copyright: robin (revfactory)

Patterns blended on 2026-04-08:
- 6 architecture patterns + team vs subagent decision tree
- Agent definition convention (WHO vs HOW separation)
- Pushy skill description standard
- Near-miss trigger testing methodology
- Adaptive communication based on user skill level
- Integration coherence / boundary mismatch detection

## last30days-skill

Source: https://github.com/mvanhorn/last30days-skill
License: MIT
Copyright: mvanhorn

Patterns blended on 2026-04-12:
- Untrusted content fencing — wrap external web content before LLM processing
- Fixture-based behavioral testing — canned input → skill invocation → output validation

## everything-claude-code

Source: https://github.com/affaan-m/everything-claude-code
License: MIT
Copyright: Affaan M. and contributors

Patterns blended on 2026-04-12:
- Hook runtime profiling (SVC_HOOK_PROFILE, SVC_DISABLED_HOOKS)
- Config-protection hook
- Block-no-verify hook
- Commit-quality hook
- Batch Stop format+typecheck
- Model routing decision table (Haiku/Sonnet/Opus)
- CLI-over-MCP preference in DEGRADING/POOR tiers
- pass@k vs pass^k evaluation vocabulary

## taskmaster

Source: https://github.com/blader/taskmaster
License: MIT
Copyright: blader

Patterns blended on 2026-04-09:
- Stop hook completion guard
- Anti-rationalization language (PROGRESS IS NOT COMPLETION)
- HYBRID: file-backed task persistence + output-to-file convention

## taste-skill

Source: https://github.com/Leonxlnx/taste-skill
License: MIT
Copyright: Leonxlnx

Patterns blended on 2026-04-19:
- Design Dials (1-10)
- Liquid Glass Refraction
- Inline Image Typography
- Hardware-Accelerated Motion
- Full-Output Pause/Resume

## capacitor-skills

Source: https://github.com/capawesome-team/skills
License: MIT
Copyright: Capawesome Team + Capgo
Companion: https://github.com/Cap-go/capgo-skills

Patterns blended on 2026-04-29:
- External skill pack registration for Capacitor mobile development

## Lucas Patiri UGC Viral Growth Playbook

Source: http://x.com/lucaspatiri_/status/2062627926022238586
License: Public Domain / Social Content Heuristics

Patterns blended on 2026-06-05:
- Structured subagent briefing / task prompts format (`plan-changeset`)
- Raw platform-native aesthetics standard (`references/anti-patterns.md`)
- Down-funnel visual state inventory verification gates (`review-gate`, `verify-promotion`)
- Operational outreach templates & B2B performance milestones (`references/knowledge/domains/cold-outbound/`)

---

## Corey Haines Marketing Skills

- **Source:** https://github.com/coreyhaines31/marketingskills
- **License:** MIT — Copyright (c) Corey Haines
- **Used as:** external runtime add-on since 2026-04-28 (v1.9.0, `EXTERNAL_ADDONS.md`); re-blend analysis at v2.6.0 on 2026-07-13

Patterns derived (candidates, `proposals/2026-07-13-blend-coreyhaines-v2.6.0.md`):
- Loop state/idempotency contract + two-tier action guardrails (`marketing-loops` references → svc autonomous-loop contract)
- Andromeda-era creative-as-targeting paid doctrine (`ads` → `ad-strategist`)
- Upstream version-staleness probe practice (`VERSIONS.md` → `blend-external` audit mode)

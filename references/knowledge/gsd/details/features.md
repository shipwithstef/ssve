# GSD Features — Detail

Source: docs/FEATURES.md
Extracted: 2026-04-08

## Mechanism

102 documented features spanning v1.0 through v1.34.0, organized by version and category. Each feature has formal requirements (REQ-*), process description, and produced artifacts.

### Core Features (1-8)

1. **Project Initialization** (`/gsd-new-project`): Questions → 4x parallel research → synthesis → requirements → roadmap. Granularity: coarse (3-5), standard (5-8), fine (8-12) phases. --auto flag for document-based init.
2. **Phase Discussion** (`/gsd-discuss-phase`): Gray area identification by category (visual, API, content, org). Code-aware scouting. --batch for grouped questions, --auto for defaults.
3. **UI Design Contract** (`/gsd-ui-phase`): Design system detection (shadcn, Tailwind), 6-question contract, UI-SPEC.md with component specs.
4. **Phase Planning** (`/gsd-plan-phase`): Research gate → 4x researchers → planner → plan-checker loop (max 3). Produces RESEARCH.md + PLAN.md files.
5. **Phase Execution** (`/gsd-execute-phase`): Wave grouping, parallel executors, atomic commits, post-execution verifier. Worktree isolation optional.
6. **Work Verification** (`/gsd-verify-work`): Extract testable deliverables, walk user through one-by-one, spawn debug agents for failures, create fix plans.
7. **UI Review** (`/gsd-ui-review`): 6-pillar visual audit scored 1-4.
8. **Milestone Management**: complete-milestone (archive + tag), new-milestone (fresh cycle), audit-milestone (integration check).

### Planning Features (9-14)

9. Phase Management (add/insert/remove phases dynamically)
10. Quick Mode: GSD guarantees without full pipeline. --discuss, --research, --full, --validate flags composable.
11. Autonomous Mode: Loop discuss→plan→execute for all phases. --from/--to/--only/--interactive flags.
12. Freeform Routing (`/gsd-do`): Natural language → right GSD command
13. Note Capture (`/gsd-note`): Zero-friction idea append/list/promote
14. Auto-Advance (`/gsd-next`): State detection → next logical step. Hard stop safety gates (v1.34).

### Quality Assurance Features (15-21)

15. Nyquist Validation: Test coverage gap detection and generation
16. Plan Checking: 8-dimension quality verification
17. Post-Execution Verification: Goal-backward analysis + test quality audit
18. Node Repair: Retry failed verification steps
19. Health Validation (`/gsd-health`): .planning/ integrity check with --repair
20. Cross-Phase Regression Gate: Ensures later phases don't break earlier
21. Requirements Coverage Gate: Every v1 requirement mapped to a phase

### Context Engineering Features (22-26)

22. Context Window Monitoring: Hook-based warnings at 35%/25% remaining
23. Session Management: pause-work (HANDOFF.json), resume-work
24. Session Reporting: End-of-session summary
25. Multi-Agent Orchestration: Thin orchestrator pattern
26. Model Profiles: 5 profiles (quality/balanced/budget/adaptive/inherit)

### v1.27+ Notable Features

- Fast Mode: Skip planning for trivial tasks
- Cross-AI Peer Review: External model review
- Persistent Context Threads: Cross-session knowledge
- Security Hardening: Path traversal prevention, prompt injection detection, safe JSON parsing
- Schema Drift Detection: ORM pattern detection (Prisma, Drizzle)
- Security Enforcement: Threat-model-anchored verification
- Scope Reduction Detection: Catches planner silently dropping requirements
- Claim Provenance Tagging: Source tracking for assertions
- Worktree Toggle: Enable/disable worktree isolation

### v1.32+ Notable Features

- STATE.md Consistency Gates
- Research Gate (blocks if unresolved open questions)
- Read-Before-Edit Guard Hook
- Context Reduction (truncated prompts, cache-friendly ordering)
- Discuss-Phase --power flag (deeper exploration)
- Planner Reachability Check (validates file/API references)
- Playwright-MCP UI Verification
- Anti-Pattern Severity Levels
- Response Language Config

### v1.34.0 Features

- Gates Taxonomy: 4 canonical gate types
- Code Review Pipeline
- Socratic Exploration
- Safe Undo
- Plan Import
- Rapid Codebase Scan
- Autonomous Audit-to-Fix
- Stall Detection in plan-phase
- Hard Stop Safety Gates in /gsd-next
- Adaptive Model Preset
- Post-Merge Hunk Verification
- Global Learnings Store
- Queryable Codebase Intelligence
- Execution Context Profiles

## Analysis

**Strengths**: Feature density is remarkable — 102 features across 12 versions. The progressive feature additions show clear evolution from basic pipeline (v1.0) through quality gates (v1.27) to advanced automation (v1.34). Each feature has formal requirements (REQ-*) ensuring traceability.

**Weaknesses**: Feature count itself creates documentation burden. Some features overlap significantly (fast vs quick vs autonomous). The version numbering jumped from 1.32 to 1.34.0, suggesting interim releases were unstable or withdrawn.

## L4 Pointers

- Full feature specs: docs/FEATURES.md (complete with requirements, process, artifacts)
- User guide: docs/USER-GUIDE.md
- Configuration reference: docs/CONFIGURATION.md

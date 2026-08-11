# review-gate — Gate checklists G1-G7

## Gate Checklists

Each gate reviews different aspects. Use the appropriate checklist for the gate being reviewed.

### G1: Feature Spec Review (DRAFT ready for UX)

| # | Check | What to look for |
|---|-------|-----------------|
| 1 | Stories testable? | Each story has a clear consumer, goal, and benefit. No compound goals ("and" in the goal = split). |
| 2 | ACs specific? | Each AC is one testable behavior. No "works correctly" or "handles gracefully" — measurable conditions only. |
| 3 | ACs cover error cases? | Happy path is not enough. Network failures, invalid input, auth failures, empty states. |
| 4 | Layer 3 clean? | Journey sync completed. No ungrounded preconditions remaining (or explicitly deferred with reasoning). |
| 5 | Dependencies identified? | System Dependencies table complete. Missing specs flagged. No hand-waved integrations. |
| 6 | Feature type correct? | Feature vs Enabler vs Integration correctly classified. Consumer matches type. |
| 7 | No technical design? | Technical Design section is empty placeholder. Spec does not prescribe implementation. |
| 8 | Story count reasonable? | 2-7 stories. >10 = decompose. 1 = might be a task, not a feature. |
| 9 | UI control contracts defined? | For any control (tabs, filters, accordions, dropdowns, toggles, etc.), the ACs must define control type, default state, click/change behavior, what appears/disappears, accessible state (aria-*), and semantic E2E sequence. Clicking must not only change styling. |

### G2: UX Design Review (DRAFT to UX-REVIEWED)

| # | Check | What to look for |
|---|-------|-----------------|
| 1 | Flows cover all stories? | Every user story has a corresponding screen flow. No stories orphaned. |
| 2 | States complete? | Every screen has: default, loading, empty, error, success states defined. |
| 3 | Error handling explicit? | Every error state has a recovery path. No dead ends. |
| 4 | Accessibility addressed? | Screen reader flow, keyboard navigation, focus management, contrast requirements noted. |
| 5 | Information hierarchy clear? | Each screen identifies primary, secondary, tertiary content. Not a flat list. |
| 6 | Responsive strategy defined? | Mobile-first breakpoints. Reflow behavior for each screen. |
| 7 | No visual design? | No colors, fonts, spacing, or visual style. Those belong in UI design (Phase 5). |
| 8 | Transitions defined? | How does the user move between screens? What triggers transitions? Back navigation? |
| 9 | Interactive control panel transitions defined? | For any tabs, accordions, segmented controls, or other panel-toggling controls: the state machine or screen flow explicitly names (a) what triggers the transition, (b) which panel becomes visible, (c) which panels become hidden/unmounted. Mutual exclusion (exactly one active panel) must be stated, not implied. Missing → G2 FAIL. |

### G3: UI Design Review (UX-REVIEWED to DESIGNED)

| # | Check | What to look for |
|---|-------|-----------------|
| 1 | Design system referenced? | All tokens (colors, spacing, typography) reference the design system, not ad-hoc values. |
| 2 | Component specs complete? | Every screen element has a component specification. No "standard button" without definition. |
| 3 | Responsive layouts specified? | Grid, breakpoints, reflow rules for each component. Not just "make it responsive." |
| 4 | Dark mode addressed? | Every color token has a dark mode variant or explicit "same" annotation. |
| 5 | Component states defined? | Hover, active, disabled, error, loading states for interactive elements. |
| 6 | Animation specified? | Motion principles applied. Duration, easing, triggers for each animation. |
| 7 | Visual hierarchy consistent? | Size, weight, contrast decisions align with UX information hierarchy from G2. |
| 8 | Component reuse maximized? | No duplicate components with different names. Shared patterns extracted. |
| 9 | Existing-component mock parity proven? | For changes to an existing component, existing screen, shared component, or route, the UI artifact includes a Production-Derived Mock Parity Ledger with production source paths, current-state evidence, intended final-state mock/evidence, affected usages/routes, spec ACs, journeys, states, viewports, and known exclusions. Missing ledger → G3 FAIL. |
| 10 | Mocks grounded in current UI? | Existing-component mocks show the affected current component and intended final state in comparable context. Generic greenfield mocks, isolated HTML frames, or designs that omit the existing component → G3 FAIL. |
| 11 | Interactive control states & accessibility? | Interactive controls (tabs, accordions, dropdowns, etc.) have design token styles for all states (default, hover, active, selected/expanded), explicit layout transitions/visibility for panels, and accessibility state (aria-selected, etc.) documented. |
| 12 | Persona trace preserved? | User/admin-facing UI AC traceability cites concrete persona IDs/paths for affected screens/components. Generic `customer`, `admin`, `all users`, `PASS`, or `satisfied` entries → G3 FAIL. |

### G4: Technical Design Review (DESIGNED to BASELINED)

| # | Check | What to look for |
|---|-------|-----------------|
| 1 | All ACs feasible? | Every acceptance criterion has a plausible implementation path. None hand-waved. |
| 2 | Architecture sound? | Data flows make sense. No circular dependencies. Separation of concerns maintained. |
| 3 | Risks identified? | Performance, security, scalability risks called out with mitigation strategies. |
| 4 | Trade-offs explicit? | Decisions documented with alternatives considered and why they were rejected. |
| 5 | Data model complete? | All entities, relationships, indexes defined. Migration path from current state. |
| 6 | API contracts defined? | Request/response shapes, error codes, auth requirements for every endpoint. |
| 7 | Consistent with UX/UI? | Technical design doesn't silently drop UX flows or UI states. Everything mapped. |
| 8 | Dependencies resolvable? | All system dependencies from the spec have specs or are explicitly deferred. |
| 9 | Discussion decisions preserved? | If a discussion artifact exists for the topic, the technical design does not contradict a settled discussion decision unless the feature spec's Revision Log explicitly supersedes it. |
| 10 | Persona pressure preserved? | Feasibility and trade-off rows cite concrete persona IDs/paths for user/admin-facing ACs, or `N/A - system-only` with reason. Generic persona labels → G4 FAIL. |

### G5: Executed Change Set Review (BASELINED to CHANGE-SET-APPROVED)

| # | Check | What to look for |
|---|-------|-----------------|
| 1 | Executed diff matches design? | The staged/task diff and final branch diff follow the technical design. No unplanned "improvements." |
| 2 | Tasks cover ACs? | Every AC is covered by one or more execution tasks and mapped tests. |
| 3 | Cross-file consistency? | Imports resolve. Types match across files. No file references a function that doesn't exist. |
| 4 | No placeholders? | No TODO, FIXME, "implement later", or stub functions in the executed branch state. |
| 5 | Manifest accurate? | Files planned in the manifest match the executed branch diff. |
| 6 | Task checkpoints clean? | Each completed task has a checkpoint commit and passed its task review/validation. |
| 7 | Tests written in the intended order? | Unit tests constrain implementation where required; the task graph reflects TDD intent. |
| 8 | Spec and journey updates included? | The implementation includes required spec/journey changes or explicitly defers them with reason. |
| 9 | Pattern-family sweep for pattern-based ACs? | For every AC whose PASS is a grep/regex, run BOTH the narrow match AND the adjacent-pattern sweep from `references/validation-patterns.md`. Narrow match = AC is literally satisfied. Adjacent sweep = no leaked variants. Zero findings from sweep OR every finding explicitly excluded in the manifest. Marking a pattern-family AC ✅ from the narrow match alone is a FAIL — edge cases leak to prod. |
| 10 | Visual-rendering ACs backed by screenshots or track-visuals diff? | For every AC whose PASS is "X renders / displays / does not show / appears as [state]", evidence must include at least one screenshot or a `track-visuals` diff path. CSS class presence (grep) alone is not sufficient — class presence ≠ correct rendering. Missing screenshot → FAIL. **Platform-auth exception:** when platform auth prevents pre-deploy screenshot capture (e.g., auth token is domain-scoped to the production URL — common on Base44, Firebase Hosting), a code-evidence diff report citing concrete diff-line values (exact hex colors, DOM absence counts, etc.) satisfies this check IF: (a) the platform constraint is documented in the review finding, (b) the diff report path is cited, and (c) verify-promotion is confirmed to include post-deploy visual capture. Mark as LOW finding, not FAIL. |
| 11 | No ghost skill executions (AP-27)? | For each task in `.svc/lane-tasks-<WI>.json` where `metadata.skill != null` and `status == completed`: verify that the Skill tool was invoked in this session for that skill. Evidence: session log contains a `Skill` tool call (or equivalent host-specific skill load) with the matching skill name, occurring BEFORE any work output for that task. If a task's skill was not loaded → G5 FAIL (AP-27 ghost execution). Tasks where `metadata.skill == null` are exempt. |
| 12 | Discussion decisions preserved? | If a discussion artifact exists for the topic, the executed diff does not contradict a settled discussion decision unless the feature spec's Revision Log explicitly supersedes it. |
| 13 | Existing UI mock parity carried through execution? | For browser-visible MODIFY work, the manifest and evidence cite the Production-Derived Mock Parity Ledger, the executed diff touches the ledger-listed production source paths or declared exclusions, and screenshot/track-visuals evidence covers current-state comparison plus intended final-state outcomes across required usages, states, and viewports. Missing ledger, unaccounted usage, or final-only screenshot evidence → G5 FAIL. |
| 14 | UI control interaction verified? | E2E or visual/DOM assertions prove the interaction contract of UI controls (panels appear/disappear, exactly one panel active, accessible states update) rather than only checking styling or presence. Visual proof covers desktop + mobile after interaction. |
| 15 | Persona trace survived execution? | The manifest, tests, and feature validation ledger map user/admin-facing ACs to concrete persona IDs/paths. If `Persona(s)` is only `PASS`, `satisfied`, `customer`, `admin`, or `all users`, run `scripts/validate-feature-closeout-ledger.mjs` and fail G5/G7 until fixed. |

### G6: Promotion Review (CHANGE-SET-APPROVED to PROMOTED)

| # | Check | What to look for |
|---|-------|-----------------|
| 1 | Squash diff matches manifest? | The staged squash diff contains only manifest-listed files and intended changes. |
| 2 | No omissions? | Every manifest-listed file that should ship appears in the promotion diff. |
| 3 | No additions? | No files outside the manifest or approved execution path are being promoted. |
| 4 | Validation clean? | Final validation commands passed before promotion. |
| 5 | Checkpoint history trustworthy? | Promotion is backed by task checkpoints and reviewed execution, not ad hoc branch drift. |
| 6 | Promotion evidence produced? | The promoter recorded manifest/diff comparison and validation outcomes. |

### G7: Verification Review (PROMOTED to VERIFIED)

| # | Check | What to look for |
|---|-------|-----------------|
| 1 | Tests pass? | All unit tests, integration tests pass. No skipped tests without justification. |
| 2 | QA complete? | Manual QA checklist items verified. AC status annotations updated. Browser-visible features include desktop + mobile QA evidence. |
| 3 | E2E complete? | End-to-end tests pass against deployed/running application. |
| 4 | Spec annotations updated? | Feature spec AC table shows QA and E2E status for every AC. |
| 5 | No regressions? | Existing tests still pass. No broken functionality outside the feature scope. |
| 6 | Journey scenarios verified? | Journey steps execute as documented. Layer 3 preconditions satisfied. |
| 7 | Responsive evidence current? | Browser-visible features include current viewport evidence or an explicit non-applicability note. |
| 8 | UI interaction contract verified in prod? | Verification proves that clicking controls toggles correct panel visibility, exactly one panel/surface is active, and accessible states update correctly in the deployed app. |


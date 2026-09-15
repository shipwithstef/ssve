## Freeform Intent Routing

When the user types freeform text instead of a specific skill name, match their
intent to the right entry point. This is the "do this" mode — the user describes
what they want, and route-workflow figures out where to send it.

## Disambiguation Protocol

When a user utterance matches multiple intent rows, resolve using this
precedence hierarchy (higher number = wins):

| Priority | Rule | Example |
|----------|------|---------|
| 4 | **Explicit skill name** — user names a skill directly | "run validate-feature" → `validate-feature` (bypasses all pattern matching) |
| 3 | **Longest match wins** — the trigger that consumes more words of the utterance | "I have an idea I want to build now" → `validate-feature` (5-word match) beats `capture-idea` (4-word match) |
| 2 | **Imperative decision word** — "build", "fix", "test", "ship" override softer phrasing | "build me a new app" → greenfield (imperative) beats "I have an idea for a new app" → `validate-feature` (speculative) |
| 1 | **Ambiguous "idea" fallback** — if no other rule applies, route to `validate-feature` | "I have an idea" (no object, no verb) → `validate-feature` (never `capture-idea` for unqualified "idea") |

### Annotated overlap resolution

| Overlapping pair | Disambiguating phrase | Winner | Why |
|---|---|---|---|
| greenfield vs `validate-feature` | "I have an idea for a new app" | `validate-feature` | Speculative phrasing (priority 1) |
| greenfield vs `validate-feature` | "build me a new app" | greenfield | Imperative "build" (priority 2) |
| `validate-feature` vs `capture-idea` | "I have an idea I want to build" | `validate-feature` | Longest match: validate-feature consumes 6 words vs capture-idea's 4 (priority 3) |
| `validate-feature` vs `capture-idea` | "just an idea, park this for later" | `capture-idea` | Longest match: capture-idea consumes 5 words vs validate-feature's 2 (priority 3) |
| brownfield-feature vs `validate-feature` | "add dark mode to the app" | brownfield-feature | Explicit feature-extension context ("to the app") |
| `diagnose-bug` vs `sync-spec-code` | "this is broken" vs "spec is wrong" | `diagnose-bug` / `sync-spec-code` | No overlap — "broken" and "wrong" are distinct trigger words |

**First match wins only AFTER disambiguation.** The table scan order is an
implementation detail, not a resolution rule.

**Intent matching rules (first match wins after disambiguation):**

| User says something like... | Intent | Route to |
|-----------------------------|--------|----------|
| "improve this dashboard region", "is this control redundant?", "propose a UX improvement here" | Bounded existing-region UX assessment | `propose-ux-improvements` (terminal; route accepted changes only with owner authorization) |
| "build me a ...", "I want to make a ...", "create a ..." | New product/app | Lane 1 (Greenfield) via `write-vision` |
| "I have an idea for ...", "what if we built ..." | Idea validation | `validate-feature` |
| "store this idea", "put this in the backlog", "just an idea", "I have idea I want to realise", "I have an idea I want to build", "add to backlog", "remember this for later", "park this idea", "quick capture", "write this down" | Idea intake (no validation) | `capture-idea` |
| "add ... to the app", "I want a new feature that ...", "can we add ..." | Feature extension | `validate-feature` (or Lane 3 if brownfield) |
| "this is broken", "fix ...", "... doesn't work", "bug: ..." | Bug report | `diagnose-bug` |
| "this test is failing", "fix failing E2E", "debug Playwright test", "test is flaky", "trace viewer shows", "selector failure" | E2E test diagnosis | `diagnose-bug --mode=e2e-test` |
| "it used to work but now ...", "regression in ..." | Regression | `diagnose-bug` |
| "what should I build?", "find me a project", "fastest path to revenue" | Opportunity discovery | `find-opportunity` |
| "reverse engineer X", "clone X", "how does X work", "build X but better", "I saw this tweet build it", "copy this with a twist", "tear apart X", "deconstruct X", any product/company URL with build intent | Reverse engineer + twist | `reverse-engineer` |
| "who am I?", "update my profile", "anything changed" | Builder profile | `mine-builder` |
| "clean up ...", "refactor ...", "reorganize ..." | Refactor | `plan-changeset` (or `sync-spec-code` first) |
| "what's next?", "where was I?", "continue", "resume" | Session resume | Check `project-state.md` + `router-context.md`, but first short-circuit named-WI resumes that are already closed: if `lane-tasks-<WI>.json` has no actionable tasks and the WI file is already `VERIFIED`, return a closed-WI summary instead of resuming execution. Otherwise resume from current focus. **Auto-readiness trigger:** if active task graphs = 0 AND no critical/high severity WIs remain in INDEX.md, run `assess-market-readiness --stage launch` automatically and include the score in routing output. Route: score ≥ 70 → GTM first; score < 70 → fix highest-blocking gap first. Do NOT ask the user "is it ready?" — assess it. |
| "ship it", "deploy", "merge", "land it" | Landing | `land-changeset` |
| "review ...", "check my code" | Review | `review-gate` |
| "is this ready?", "should I launch?", "are we ready?", "hackathon judge", "VC review", "market fit", "assess readiness" | Readiness assessment | `assess-market-readiness` |
| "test ...", "QA ...", "does this work?" | Testing | `test-journeys` or `write-e2e` |
| "how's the project?", "status", "where are we?" | Status check | Read `project-state.md` + `router-context.md`, summarize |
| "spec is wrong", "code doesn't match spec", "drift" | Drift | `sync-spec-code` |
| "set up terraform", "bootstrap a k8s cluster", "scaffold pulumi", "new infra repo" | Infra Greenfield | Lane 8 (`recall-stack-knowledge` → `plan-capabilities --mode=infra` → ...) |
| "add a module", "scale this", "add a queue", "wire a new pipeline stage" (in infra repo) | Infra Feature | Lane 9 |
| "migrate to CAST AI", "GHES to GHEC", "Jenkins to GH Actions", "Datadog to New Relic", "Heroku to Render", "CloudFormation to Terraform", "AWS to GCP", "from X to Y", "replace X with Y", "cutover", "decommission" | Infra Migration | Lane 10 |
| "production is down", "rollback the deploy", "tighten this IAM now", incident ID | Infra Incident | Lane 11 |
| "we're spending too much on infra", "rightsize", "kill unused resources", "FinOps optimization" | Infra Cost Optimization | Lane 12 |
| "what svc artifacts are missing", "coverage gaps", "is the brownfield repo aligned", "are all canonical artifacts in place", "what alignment is needed", "audit coverage" | Coverage audit | `audit-coverage` |
| "what is ...", "how does ... work", "explain ..." | Knowledge question | Check `references/knowledge/` (analysis). Invoke `research` only if `researchDecision(question)` returns `external_research_required`; otherwise answer from current cited evidence |
| "how do I ...", "how to ...", "tutorial for ..." | How-to question | Check domain knowledge (analysis). Invoke `research` only if `researchDecision(question)` returns `external_research_required`; answer with project context |
| "why did we ...", "why was ... chosen" | Decision question | Read `.svc/pipeline-decisions.jsonl` or `project-state.md` → answer from decision history |
| "teach me about ...", "explain the project", "onboard me" | Learning | `teach-project` |
| "what competitors ...", "who else does ...", "market for ..." | Market question | Check `knowledge/competitors/` → `analyze-competitors` if stale |
| "what's the best practice for ...", "convention for ..." | Domain question | Check `knowledge/domains/` then `analyze-domain`. Invoke `research` only if `researchDecision(question)` returns `external_research_required` |
| "help me with ..." (ambiguous) | Clarification needed | Ask one clarifying question, then route |
| User adds "use /loop", "/loop if needed", "loop it", "keep going until done" | Continuation preference | Enable autorun for the current session, persist `lane-tasks-<WI>.json`, and continue without non-blocking check-ins. If the session ends, resume from the task graph in the next session. Do NOT reference or invoke a `loop` skill unless a verified continuation mechanism actually exists for this host/project. |

| "how should we split local/dev/staging/prod", "how should svc work with Base44/Vercel/Replit/Bolt/Firebase/Supabase", "what should stay platform-native vs move into our code", "how do we avoid touching prod during development", "what opportunities does this platform give us" | Platform operating model | `platform-operating-architect` |
| "what tools do I need", "what MCPs", "capability plan", "what skills to install" | Capability planning | `plan-capabilities` |
| "improve the framework", "self-improve", "close gaps", "implement these framework fixes", "apply this framework proposal", "we already have findings" | Framework improvement | `improve-framework` |
| "test the framework", "benchmark svc", "prove it works", "autopilot" | Framework testing | `test-framework` |
| "audit this session", "replay this WI", "compare expected vs actual execution", "read the audit log/transcript", "why did this run drift", "session post-mortem" | Session execution forensics | `audit-session-execution` |
| "find gaps in svc", "audit methodology", "what should we fix" | Framework diagnosis | `evolve-framework` |
| "analyze gstack", "study superpowers", "research GSD", "analyze our capabilities", any GitHub URL, any repo name | Full knowledge extraction | `research` (auto-detects analysis mode from URL/repo input) |
| "blend from ...", "what can we take from ...", "rethink blends" | External blend (requires research first) | `blend-external` (reads two CAPABILITIES.md files, proposes) |
| "blend from my private repo", "take this pattern from my own code", "extract from my internal repo", "blend without attribution" | Private blend (user-owned source, no attribution) | `blend-private` (authorization gate, redaction map, 30% diff ceiling) |
| "install svc", "setup for codex", "provision", "add host" | Provisioning | `./setup --host <host>` |
| "create a skill for ...", "new skill" | Skill creation | `create-skill` |
| "quick fix", "just fix this typo", "small change" | Trivial change | `route-workflow` (quick-fix retired — conditional stage activation via `scripts/stage-activation.mjs`) |
| "which X should I use", "compare providers", "pick vendor", "compare options before committing", "trade study", "N-way decision", "strategic decision", "vendor selection", "build vs buy" | Strategic Decision Trade Study (pre-lane; output names the downstream lane + skill) | `strategic-decision` |
| "best solution", "right design", "be sure", "all cards on the table", "golden standard", "real-life examples", "successful projects", "current picture before plan", "consider cost and caching", "by design auto", "figure out actual solution first" | Solution confidence protocol (current-state + world-grounded design confidence before plan) | Apply `references/solution-confidence-protocol.md`; default to `solution_confidence_mode=design_auto`; use `post_design_human_gate` only if the user explicitly asks to wait/review/approve after design; use `intake_only` only when the user explicitly says no design/decision yet; for product work insert `research` only when `researchDecision(question)` returns `external_research_required`, `manage-finops` when cost changes, `design-ux` when UX changes, `design-tech`, and `explore-solutions`; for svc-on-svc capability gaps route to `improve-framework` |

**Fallback behavior:** If no pattern matches confidently, ask ONE clarifying
question: "Are you describing something to build, something to fix, or
something about the framework itself?" Then route based on the answer.

For framework work, distinguish **diagnosis** from **implementation**:
- If the user wants to discover or prioritize gaps, route to `evolve-framework`
- If the user already has concrete findings, a proposal, or replay evidence and wants validation + fixes, route directly to `improve-framework`

## Framework Self-Management Policy (svc-on-svc)

When the repo under discussion is **svc itself**, do not treat all framework work
as the same kind of task. Classify it first, then route:

| svc-on-svc use case | Start with | Why | Escalate to |
|---|---|---|---|
| Known framework gap, pending proposal, replay failure, or implementation-ready framework finding | `improve-framework` | Evidence already exists; run the fix loop instead of re-diagnosing | `quick-fix`, direct SKILL edits, `create-skill`, or normal pipeline as chosen by `improve-framework` |
| Broken framework behavior or regression in an existing contract | `diagnose-bug` | Root cause comes first when something that should work no longer works | `plan-changeset` / `execute-changeset`, and then `improve-framework` if the bug reveals a broader framework gap |
| New framework capability or deliberate framework behavior change | `write-spec` | This is feature work on svc itself and deserves explicit ACs and implementation planning | `audit-ac` → `write-journeys` (if flow matters) → `design-tech` → `explore-solutions` when architectural risk is high |
| Concrete session/WI replay where the goal is expected-vs-actual forensics | `audit-session-execution` | Build framework-grade evidence from a real run before gap prioritization | `evolve-framework`, then `improve-framework` |
| Unknown framework gaps, prioritization, or proof that svc works | `test-framework` or `evolve-framework` | First gather evidence or rank the gap list | `improve-framework` once there is a concrete proposal or replay target |

**`explore-solutions` is mandatory** for svc-on-svc work when `design-tech`
introduces a hard-to-reverse architecture choice: new task-state backend,
new host abstraction layer, new external dependency, new persistence model,
or any decision that would be expensive to unwind after landing.

**Default rule:** if the framework work can be phrased as "fix this known gap,"
start with `improve-framework`. If it can be phrased as "svc should gain a new
capability," start with `write-spec`. If it can be phrased as "this framework
behavior is broken," start with `diagnose-bug`.

## Cross-Skill Routing

| Skill just finished | Finding | Route to |
|--------------------|---------|----------|
| `onboard-repo` | Brownfield map completed | route by work-item type |
| `onboard-repo` | Bugs/regressions logged | `diagnose-bug` |
| `onboard-repo` | Feature opportunities logged | `validate-feature` |
| `onboard-repo` | Drift logged | `sync-spec-code` |
| `onboard-repo` | Refactors or chores logged | `plan-changeset` or `sync-work-items`, depending on scope |
| `onboard-repo` | Tracker visibility needed | `sync-work-items` |
| `diagnose-bug` | Root cause and fix scope defined (single correction) | `plan-changeset` or `execute-changeset`, depending on plan depth needed |
| `diagnose-bug` | Multiple independent corrections discovered (Step 5.5) | Each child WI enters its own lane; parent WI continues to proof-of-fix; `**Next:**` targets highest-priority child |
| `plan-changeset` | Implementation manifest complete | `execute-changeset` |
| `execute-changeset` | Task execution complete, final diff reviewed | `land-changeset` |
| `execute-changeset` | Task reveals spec/UX/UI/tech contradiction | loop back to the relevant upstream skill |
| `diagnose-bug` | Issue is actually missing capability | `validate-feature` |
| `diagnose-bug` | Issue is actually spec drift | `sync-spec-code` |
| `sync-spec-code` | Drift confirmed | remediation path or work-item update |
| `sync-spec-code` | Structural cleanup with behavior preserved | `plan-changeset` |
| `validate-feature` | Not a new feature, but a broken existing flow | `diagnose-bug` |
| `validate-feature` | Existing repo not yet mapped | `onboard-repo` |
| `write-journeys` | Missing producer, missing persona, or fragmented concept | `validate-feature` or `build-personas` |
| `test-journeys` | Runtime failure in known behavior | `diagnose-bug` |
| `test-journeys` | Vague or missing ACs | `audit-ac` |
| `analyze-marketing` | Product context stale after spec changes | `sync-spec-code` then refresh marketing |
| `assess-market-readiness` | Score ≥ 70 | GTM skills (`launch`, `ai-cold-outreach`, `prospect`) |
| `assess-market-readiness` | Score < 70 with blocking gaps | Route to the WI or skill that closes the highest-severity blocking gap |
| `assess-market-readiness` | ICP exemplars found | `ai-cold-outreach` with exemplar briefs as targeting input |
| `verify-promotion` | Last WI in milestone closed | `assess-market-readiness --stage launch` (auto-trigger) |

### Framework-Work Cross-Skill Routing

When working on svc itself (not a user project), read `FRAMEWORK-STATE.md`
first — same principle as reading `project-state.md` for product work.

| Skill just finished | Finding | Route to |
|--------------------|---------|----------|
| `test-framework` | Failures found | `improve-framework` (orchestrates the fix loop) |
| `test-framework` | All pass | Update `FRAMEWORK-STATE.md`, stop |
| `audit-session-execution` | Framework-specific gaps extracted from a real run | `evolve-framework` |
| `evolve-framework` | Prioritized proposal produced | `improve-framework` (implements it) |
| `blend-external` | Blend plan approved | `improve-framework` (applies changes) |
| `blend-private` | Blend plan approved | `improve-framework` (applies changes + runs Phase 6 leak+quality gate) |
| `improve-framework` | Fix implemented | `test-framework` (replay verification) |
| `improve-framework` | Replay passes | Update `FRAMEWORK-STATE.md`, done |
| `create-skill` | New skill created | `test-framework` (validate new skill) |

## Project State Checks

Before recommending a lane, inspect:

```bash
# Foundational svc state
ls docs/specs/project-state.md 2>/dev/null
ls docs/specs/router-context.md 2>/dev/null
ls docs/specs/agent-topology.md 2>/dev/null
ls docs/specs/work-items/INDEX.md 2>/dev/null

# Canonical product artifacts
ls docs/specs/vision.md 2>/dev/null
ls docs/specs/personas/P*.md 2>/dev/null | wc -l
ls docs/specs/features/*.md 2>/dev/null | wc -l
ls docs/specs/journeys/J*.feature.md 2>/dev/null | wc -l

# Existing test and code reality
find . -path "*/test*" -o -path "*/e2e*" 2>/dev/null | head
git log --oneline -5 -- docs/specs/ 2>/dev/null
```

Interpretation:

| State | Meaning | Start with |
|------|---------|------------|
| Clean repo, little established structure | Greenfield | `write-vision` or `route-workflow` lane recommendation |
| Existing repo, no svc state files | Brownfield unmapped | `onboard-repo` |
| Existing repo, partial svc mapping (missing router-context or agent-topology) | Brownfield conversion refresh | `onboard-repo` |
| Existing repo, mapped, feature request | Brownfield feature lane | `sync-spec-code` then `validate-feature` |
| Existing repo, mapped, bug or regression | Correction lane | `diagnose-bug` |
| Existing repo, mapped, doc/code mismatch | Drift lane | `sync-spec-code` |
| Work items exist, no external visibility | Tracker projection gap | `sync-work-items` |

## Communication Adaptation

Detect the user's technical level from context clues and adapt ALL downstream
communication accordingly. This applies to every skill via P0.

| Signal | Inferred level | Adaptation |
|---|---|---|
| Uses precise technical terms ("hook", "middleware", "ORM") | Expert | Dense, skip basics, use jargon freely |
| Mixes technical and non-technical language | Intermediate | Explain non-obvious terms, skip basics |
| Describes goals in business terms only | Non-technical | Explain every technical term on first use, use analogies |
| Asks "what is X?" for common concepts | Beginner | Step-by-step, no assumed knowledge |

**Rules:**
- Never explain Docker to a devops person
- Never use "assertion", "JSON schema", "middleware" without explaining if the user hasn't used these terms
- Calibrate from the FIRST message — the user's vocabulary tells you everything
- If uncertain, lean toward MORE explanation (costs tokens, saves confusion)
- Builder profile's Skills section informs this — read it

**P0 carries the communication level.** All downstream skills inherit it.
Add to P0 persona: `Communication: <expert/intermediate/non-technical/beginner>`

Source: Harness Phase 1 domain analysis user-skill-level detection.

## Recommendation Style

When answering "what should I do next?", give:

1. detected repo mode
2. detected change type
3. selected lane
4. immediate next skill
5. why that route is correct

Example:


## Visual-Asset Auto-Invoke (design-logo evaluation mode)

When the user pastes ≥3 image URLs from known image-generation domains (`media.base44.com`, `oaiusercontent.com`, `r2.cloudflarestorage.com`, `imagine-image.app`, `cdn.midjourney.com`) AND the surrounding text mentions "logo", "mark", "brand", or "concept", route-workflow auto-invokes `design-logo` in **evaluation mode**:
- Skip Phases 1–3 (brief, exemplar bank, moodboard already done ad-hoc)
- Enter at Phase 5 with the user's pasted images as the concept set
- Run Phase 5b love-test, Phase 6 cross-model judge, Phase 7 persona simulation
- Proceed through Phase 8 refinement pipeline on survivors
- This formalizes ad-hoc image-gen sessions into the skill's structured progression

Source: WI-141 (design-logo evolution) — catches the failure mode where founders iterate 60+ options outside any formal phase.

## craft-prompt (prompt engineering)

| Utterance | Route |
|---|---|
| "craft me a prompt for X", "make this prompt better", "write a prompt that...", "beat this viral prompt" | `craft-prompt` (best-of-2 floor; not route-workflow Prompt Composer, which routes svc work) |

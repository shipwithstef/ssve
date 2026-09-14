---
name: blend-external
version: "1.0"
description: >
  Use when importing patterns from external repos into svc. Triggers on "blend
  from", "what can we take from X", "integrate patterns from", "re-blend",
  "check for new stuff in gstack/superpowers/OMCC", "update from external",
  "add a new source", "blend a new repo", "rethink our blends", "did we blend
  the right thing", "review past blends", or when pointing at an external repo
  to pull in useful patterns.
phases:
  - id: P1-SvcCapabilityBaseline
    trigger: always
    reads: ["references/knowledge/svc/CAPABILITIES.md", "FRAMEWORK-STATE.md"]
    writes: [".svc/blend-external-svc-baseline.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-ExternalSourceAcquisition
    trigger: always
    reads: ["references/knowledge/INDEX.md", "references/blend-registry.json", "external source"]
    writes: [".svc/blend-external-source.log", "references/knowledge/<source>/CAPABILITIES.md"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-DualAssessmentComparison
    trigger: always
    reads: ["svc capabilities", "external capabilities", "references/knowledge-protocol.md"]
    writes: ["proposals/<date>-blend-<source>.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-HybridBlendPlan
    trigger: always
    reads: ["comparison table", "blend registry", "target svc files"]
    writes: ["proposals/<date>-blend-<source>.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-RegistryNoticesKnowledgeUpdate
    trigger: blend-approved-or-implemented
    reads: ["proposals/<date>-blend-<source>.md", "references/blend-registry.json", "NOTICES"]
    writes: ["references/blend-registry.json", "NOTICES", "references/knowledge/"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: ["proposals/<date>-blend-<source>.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "FRAMEWORK-STATE.md", artifact: framework-state }
  optional:
    - references/blend-registry.json (tracks what was taken from where)
    - NOTICES (attribution file)
    - references/skill-pack-comparison.md
outputs:
  produces:
    - { path: "proposals/<date>-blend-<source>.md", artifact: blend-plan }
chain:
  lanes:
    framework: { position: 3 }
  progressive: false
  self_verify: true
  human_checkpoint: true
---

# External Blend

You are evaluating an external repo or skill pack and deciding what svc should
take from it.

## Required Sequence: Know Yourself → Know Them → Compare

**Step 0: Know svc first.**
Read `references/knowledge/svc/CAPABILITIES.md`. This is what we ARE — every
skill, every capability, every gap we know about. You cannot identify what to
take from others if you don't know what you already have.

If svc's CAPABILITIES.md is stale (check .version date vs today), update it
first by scanning the repo's actual skills.

**Step 1: Read FRAMEWORK-STATE.md.**
What was already blended, what was taken, what was skipped. Don't re-propose
patterns already taken or explicitly deferred.

**Step 2: Know the external source.**
Check `references/knowledge/INDEX.md` — if already analyzed, read their
Layer 2 (CAPABILITIES.md). Only clone and explore if:
1. The source isn't in the knowledge index, OR
2. The source SHA/.version changed since last analysis

Use the 4-pass protocol from `references/knowledge-protocol.md`.

**Step 3: Dual Assessment.**

Every external source gets TWO independent assessments — not just one.

### Assessment A: Blend Opportunities (techniques to absorb)

What patterns, techniques, test approaches, architectural ideas, or
implementation tricks can svc take from this source? This is about absorbing
knowledge — the source's code doesn't need to run at svc runtime.

Examples: a better way to write tests, a scoring algorithm, a prompt pattern,
a validation approach, a rendering technique, a security model.

### Assessment B: External Addon Viability (use at runtime)

Should this source be installed and used alongside svc as an external addon?
If yes, how does it integrate? What's the interop contract? Where in the
pipeline does it attach?

Assess:
- **License compatibility** — permissive (MIT, Apache 2.0, BSD) required
- **Runtime value** — does it provide capability svc shouldn't rebuild?
- **Integration point** — where in the svc pipeline does it attach?
- **Interop contract** — shared file paths, env vars, execution order
- **Maintenance burden** — who maintains it? How stable is it?

If viable: draft an EXTERNAL_ADDONS.md section with install command,
integration point, and interop rules.

### Both Can Apply

Often the right answer is BOTH: blend techniques (absorb their scoring
algorithm into our pipeline) AND use as external addon (install their
tool for runtime search capability). Assess each independently.

**Step 4: Full Dimensional Comparison.**
Now you have two CAPABILITIES.md files. Compare EVERY dimension — not just
the ones that look interesting. The comparison must be exhaustive.

For each dimension in BOTH sources, produce a row:

| Dimension | Source has | svc has | Verdict | Action |
|---|---|---|---|---|
| ... | (their approach) | (our approach) | theirs-better / ours-better / comparable / different-valid / gap | BLEND / HYBRID / IMPROVE / SKIP / N/A / ADDON |

**Verdict rules:**
- **theirs-better:** they solve the same problem more effectively
- **ours-better:** we solve it more effectively (document WHY — this is our advantage)
- **comparable:** similar effectiveness, different implementation
- **different-valid:** both valid but addressing different aspects
- **gap:** one side has it, the other doesn't

**Action rules:**
- **BLEND:** take their approach (when we have nothing)
- **HYBRID:** create something better than either by combining both approaches
  (see Phase 2c below)
- **IMPROVE:** upgrade our existing implementation with their insight
- **ADDON:** use the source as an external runtime addon (add to EXTERNAL_ADDONS.md)
- **BLEND+ADDON:** absorb techniques AND use as external addon (both apply)
- **SKIP:** our version is adequate or their approach doesn't fit svc
- **N/A:** dimension is irrelevant to svc's goals

Do NOT skip dimensions. "Skip" is a verdict for a row, not permission to
omit the row. Every dimension from both CAPABILITIES.md files must appear.
A full comparison that finds 3 blend items and 25 skips is MORE valuable
than a selective comparison that finds the same 3 items but doesn't prove
the other 25 were evaluated.

**After analysis, write/update knowledge layers:**
- Layer 1: update INDEX.md
- Layer 2: write/update their CAPABILITIES.md
- Layer 3: detail files only for items you're blending
- Write .version file (SHA for repos, version+URL for products)
- Update svc's own CAPABILITIES.md if the blend adds new capabilities

This is how expertise compounds. Don't throw away analysis.

**Announce at start:** "I'm using the blend-external skill to analyze <source> and find patterns worth blending into svc."


**Knowledge protocol:** follow `references/knowledge-protocol.md` for extraction, storage, and staleness rules.

## Modes

### 1. New source — first blend

The user points at a repo they haven't blended from before. Full analysis.

### 2. Re-blend — check for updates

A source already in `references/blend-registry.json`. Compare what they've
shipped since the last recorded SHA. Only analyze the delta.

### 3. Audit — check all sources

No specific repo. Walk through every entry in the blend registry and check
if any source has shipped improvements since last blend.

**Mechanical staleness probe FIRST (WI-480).** Before any per-source analysis,
run each registry entry's `upstream_ref_cmd` and emit a **stale-sources table**
so a drifted source can't hide (this is the structural fix for WI-476, where
coreyhaines drifted 10 weeks unnoticed). Parsing + comparison rules:

1. **Run the probe:** `upstream_ref_cmd` is one of `git ls-remote https://github.com/<owner>/<repo> HEAD` (SHA-pinned sources), `gh release list -R <owner>/<repo> -L 1` (release-tag-pinned sources), or `null` (non-repo sources, e.g. an x.com post).
2. **Extract the current ref** = the FIRST whitespace token of the output. `git ls-remote` emits `<40-hex-sha>	HEAD` → take the 40-hex sha. `gh release list` emits the latest tag in column 1 → take the tag.
3. **Compare to the registered pin** (`blends[-1].tag` or `blends[-1].sha`):
   - **tag source:** string-compare, normalizing a leading `v` on both sides.
   - **sha source:** PREFIX-match — the registry stores short (8-char) shas, so `remote_sha.startsWith(registered_sha)` (or vice-versa) = fresh; no prefix match = **STALE**.
   - **`null` probe:** row = **MANUAL** (report it; never silently skip).
4. **Table columns:** `source | registered pin | current upstream ref | STALE / fresh / MANUAL`. Any STALE row is a re-blend candidate; surface it (and it is a legitimate `evolve-framework` / `improve-framework` trigger — "a blend source shipped updates").


### 4. Rethink — reassess past blend decisions

Revisit what was previously blended and ask whether svc took the best approach.
This is not about new content from the source — it's about whether the
adaptation of old content was done well, whether svc's own evolution has made
a previous blend redundant or suboptimal, or whether a pattern that was skipped
at the time should now be reconsidered.

## Phase 1 — Acquire the source

If the source is a GitHub repo:

```bash
# Clone to tmp for analysis (shallow, read-only)
git clone --depth 50 <repo-url> /tmp/svc-blend-<name>
cd /tmp/svc-blend-<name>
```

Record the current HEAD SHA:
```bash
git rev-parse HEAD
```

If re-blending, check what changed since last blend:
```bash
git log --oneline <last-sha>..HEAD
git diff --stat <last-sha>..HEAD
```

## Phase 2 — Analyze the source

Read every skill/agent definition in the external repo. For each one:

1. **What does it do?** — core action, inputs, outputs
2. **Does svc already have this?** — check against all svc skills
3. **If svc has it, is theirs better?** — compare depth, edge case handling,
   patterns, modes
4. **If svc doesn't have it, should it?** — does it address a real gap?

Build an assessment table:

| External skill | svc equivalent | Assessment | Action |
|---------------|---------------|------------|--------|
| `/their-skill` | `our-skill` | Theirs handles X better because Y | BLEND: add X pattern to our-skill |
| `/their-other` | — | Addresses gap Z | BLEND: new skill or new section |
| `/their-thing` | `our-thing` | Ours is better/equivalent | SKIP |
| `/their-niche` | — | Not relevant to svc goals | SKIP: reason |

### Phase 2c — Hybrid Innovation (for every BLEND and IMPROVE item)

Blending is not transplanting. For every item marked BLEND, IMPROVE, or
HYBRID in the comparison table, ask these questions BEFORE writing the
blend plan:

1. **What would a 10/10 version look like that NEITHER source has?**
   The source solves the problem one way. svc has different machinery
   (progressive narrowing, 7 gates, spec-first, builder profiles, knowledge
   system). Can svc's existing architecture make this pattern fundamentally
   better?

2. **Can we combine insights from MULTIPLE sources?**
   Check the blend registry — has another source addressed a related problem?
   Example: gstack has Review Army specialists + superpowers has two-stage
   review ordering → svc can run specialists in two stages (spec compliance
   first, code quality second) — a hybrid neither source has.

3. **What's the failure mode of a naive transplant?**
   Taking a pattern designed for a different architecture often produces a
   weaker version. gstack's Review Army was designed for /review (pre-landing).
   Transplanting it into svc's audit-implementation (post-execution, spec-aware)
   means the specialists can cross-reference ACs — which gstack's can't.
   That's an improvement. But if you transplant without leveraging the
   architectural difference, you get a copy that's worse than the original.

4. **Does this blend item make an existing svc strength STRONGER?**
   The best blends amplify what svc already does well. Adding failure triage
   to execute-changeset amplifies TDD (already strong). Adding a health
   dashboard would not amplify anything (svc doesn't do monitoring).

**Output:** For each BLEND/IMPROVE/HYBRID item, add a "Hybrid opportunity"
note in the blend plan describing what the hybrid creates that neither
source has alone. If no hybrid is possible (pure transplant is the right
move), say so explicitly.

### Phase 2b — Rethink past blends (mode 4, or always in audit mode)

For each pattern previously taken from this source (read from blend registry):

1. **Read the current svc implementation** of the blended pattern
2. **Read the original source** to remember what was taken
3. **Assess the adaptation quality:**
   - Did we take the right parts? Or did we miss the key insight?
   - Did we over-adapt and lose the original value?
   - Did we UNDER-adapt — just transplant without leveraging svc's architecture?
   - Is the svc version now BETTER than the source? If not, why not?
   - Could we create a hybrid that's better than both? (combine with another
     source, leverage svc machinery like gates/specs/knowledge system)
   - Has svc evolved since the blend in a way that makes the adaptation
     awkward or redundant?
   - Has the source itself evolved the pattern in a better direction?
4. **Check skipped patterns:** Review `patterns_skipped` in the registry.
   Were any skip decisions wrong in hindsight? Has svc's growth created a
   need that a previously-skipped pattern would now address?

Build a rethink table:

| Blended pattern | svc skill | Verdict | Action |
|----------------|-----------|---------|--------|
| P0 founder persona | route-workflow | Adaptation is solid, working well | KEEP |
| /cso security audit | review-security | We took the checklist but missed the verification loop | IMPROVE: add active verification |
| /learn memory | manage-learnings | svc's quality gate is better than original | KEEP (svc improved on source) |
| /ship PR workflow | land-changeset | Redundant since we added our own version bump logic | SIMPLIFY: remove source-derived parts |

| Skipped pattern | Original reason | Reassessment | Action |
|----------------|-----------------|--------------|--------|
| /freeze scope guard | "land-changeset covers this" | Still true | KEEP SKIP |
| /retro weekly review | "not relevant" | Now that we have manage-learnings, a retro could feed it | RECONSIDER |

## Phase 3 — Produce the blend plan

Each blend item must be a self-contained argument, not a summary bullet. A reader
who sees only the blend plan (not this conversation) must understand WHY each
pattern matters, WHAT breaks without it, and WHAT changes after. If a blend item
can't be argued convincingly, it shouldn't be blended.

For each BLEND item, specify ALL of these sections:

- **From / Into** — source file:line and target svc file:section
- **The problem in svc today** — what currently happens that this pattern fixes.
  Name the specific failure mode with a concrete scenario. "Reviews are inefficient"
  is too vague. "Reviewer spends tokens noting naming inconsistencies while 3 of 10
  ACs are unimplemented — quality review on code that may be rewritten" is specific.
- **How the source solves it** — the mechanism, not just "they do X." Explain the
  design choice and why it works.
- **What this changes in svc** — concrete before/after. What does the svc skill
  look like before and after the blend? Which section changes? What new checks,
  rules, or patterns are added?
- **What NOT to take** — parts to skip and why (conflicts with svc doctrine,
  duplicates existing behavior, or not applicable to svc's architecture)
- **Why this matters** — the argument. Connect the failure mode to real impact
  (wasted tokens, bugs shipped, quality regression, missed requirements). Include
  evidence from the source if available (production incidents, empirical findings,
  test results).

Output: `proposals/<date>-blend-<source-name>.md`

```markdown
# Blend Plan: <source-name>

**Source:** <repo-url>
**SHA:** <commit-sha>
**Date:** <today>
**Previous blend:** <last-sha or "first blend">

## Summary

<N patterns to blend, M to skip, P already present>

| # | Pattern | Target | What breaks without it | What changes after |
|---|---------|--------|----------------------|-------------------|
| 1 | <name> | <svc file> | <concrete failure scenario> | <specific change to svc> |
| 2 | ... | ... | ... | ... |

## Blend items

### 1. <Pattern name> → <target svc skill>

**From:** <file:line in external repo>
**Into:** <svc skill file:section>

**The problem in svc today:**
<What currently happens. Name the failure mode with a concrete scenario — inputs,
behavior, wrong outcome. Read the target svc file first to describe the current
state accurately.>

**How the source solves it:**
<The mechanism. Why it works. Design choice rationale. Evidence if available
(production incident, empirical finding, test result from their repo).>

**What this changes in svc:**
<Concrete before/after. Which section of which file changes. What new checks,
rules, or patterns are added. Be specific enough that someone could implement
this from the blend plan alone.>

**What NOT to take:**
<Parts to skip and why — conflicts, duplicates, or not applicable.>

**Why this matters:**
<The argument for this blend item. Connect failure mode to impact. If the source
has empirical evidence (test results, production incidents), cite it.>

---
(repeat for each blend item)

## Assessment A: Blend Opportunities
(Techniques, patterns, test approaches to absorb — as above)

## Assessment B: External Addon Viability

**Runtime addon?** YES / NO / PARTIAL
**License:** <license name>
**Install:** `<install command>`

**Integration point:**
<Where in the svc pipeline this attaches. Which skills invoke it, what
shared files or env vars are needed, execution order relative to svc skills.>

**Interop contract:**
<Shared file paths, canonical output locations, env vars, how svc skills
discover and consume the addon's output.>

**What svc should NOT rebuild:**
<Capabilities the addon provides that svc should use rather than duplicate.>

**What svc should still own:**
<Capabilities where svc's approach is better or where pipeline integration
requires svc-native implementation.>

**EXTERNAL_ADDONS.md draft:**
```markdown
## Add-On: <name> (optional)
<description, install, integration, interop rules>
```

(Omit this section if addon assessment is NO. Include even if PARTIAL —
explain what parts are addon-viable and what parts are blend-only.)

## Skipped items
| External | Reason for skip |
|----------|----------------|
| ... | ... |

## Rethink: past blend reassessment
(Only in rethink/audit mode. Omit if first blend.)

### Blended patterns reassessed
| Pattern | svc skill | Verdict | Action |
|---------|-----------|---------|--------|
| ... | ... | KEEP / IMPROVE / SIMPLIFY / REPLACE | ... |

### Skipped patterns reconsidered
| Pattern | Original skip reason | Reassessment | Action |
|---------|---------------------|--------------|--------|
| ... | ... | KEEP SKIP / RECONSIDER | ... |

## Attribution update
<What to add to NOTICES>
```

## Phase 4 — Update the blend registry

After the blend plan is approved and implemented, update
`references/blend-registry.json`:

```json
{
  "sources": [
    {
      "name": "gstack",
      "url": "https://github.com/garrytan/gstack",
      "license": "MIT",
      "author": "Garry Tan",
      "blends": [
        {
          "sha": "abc123...",
          "date": "2026-04-05",
          "patterns_taken": [
            {
              "external_path": "skills/cso/SKILL.md",
              "svc_target": "skills/review-security/SKILL.md",
              "pattern": "OWASP + STRIDE audit"
            }
          ],
          "patterns_skipped": [
            {
              "external_path": "skills/ship/SKILL.md",
              "reason": "land-changeset already covers this"
            }
          ]
        }
      ]
    }
  ]
}
```

This registry is the source of truth for what was taken, when, and from which
version. When re-blending, compare the current HEAD against the last recorded
SHA to scope the analysis.

## Phase 4.5 — Re-evaluate Rules From This Source

After a re-blend (mode 2 or higher), check whether the source contributes
rules to `rulesRegistry`:

```bash
# Find all rules whose source matches this blend key
node -e "
const m = JSON.parse(require('fs').readFileSync('skills-manifest.json','utf8'));
const key = 'blended:ecc'; // replace with this source's blend key
m.rulesRegistry.entries
  .filter(e => e.source === key)
  .forEach(e => console.log(e.path, e.stack, e.last_evaluated));
"
```

For each rule found:
- If `source_sha` differs from the new blend SHA → rule content may have changed upstream. Re-evaluate.
- If `last_evaluated` is older than 90 days → rule freshness expired. Re-evaluate.
- If neither → skip; prior verdict stands.

Re-evaluate via:

```
/evaluate-rule --rule <path> --stack <stack> --scope <scope>
```

Or for a full re-run of all rules from this source:

```
/evaluate-rule --rule-pack rules/<stack>/ --stack <stack> --scope project
```

### Auto-Invoke On-Demand Skills

Phase 4.5 already conditionally invokes `evaluate-rule` when rule staleness is detected. This is the canonical on-demand skill insertion pattern:

| Signal | Skill | Insertion Point | Why |
|--------|-------|-----------------|-----|
| Blended rule `source_sha` differs from new blend SHA or `last_evaluated` > 90 days | `evaluate-rule` | After Phase 4.5 detection, before updating rulesRegistry | Prevents stale or degraded rules from entering the framework |

If `evaluate-rule` is inserted, set `blocked_by` so rule registry updates wait for evaluation PASS. Log the insertion as a `mechanical` decision in `.svc/pipeline-decisions.jsonl`.

After re-evaluation, update `last_evaluated` and `source_sha` in `rulesRegistry` for each rule that passed.

**Why this matters:** Rules blended from an external source were evaluated at a specific SHA. When the source updates its rule files, the distilled rule may no longer reflect the best available content — or the upstream may have added genuine new directives worth adopting.

## Phase 5 — Update NOTICES

For any new source or new patterns taken, update `NOTICES` with:
- Project name and URL
- Copyright and license
- Specific patterns derived, mapped to svc skills

## Rules

- Do not implement the blend. This skill produces the plan. Implementation
  happens by editing the target SKILL.md files directly (or through the normal
  pipeline for larger changes).

- Respect licenses. Only blend from repos with permissive licenses (MIT,
  Apache 2.0, BSD). If the source has a restrictive license, stop and tell
  the user.

- Do not take code verbatim unless the license explicitly allows it. Take
  patterns, approaches, and ideas — adapt them to svc conventions.

- When re-blending (mode 2), only analyze NEW content from the source — the
  delta since last SHA. For reassessing OLD blends, use rethink mode (mode 4)
  or audit mode (mode 3, which includes rethink automatically).

- If the external source is worse than svc in every dimension, say so. "Nothing
  worth taking" is a valid finding. Do not manufacture blend items to justify
  the analysis.

- Clean up: `rm -rf /tmp/svc-blend-<name>` after analysis is complete.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Blend plan exists | `test -f proposals/<date>-blend-<name>.md` | |
| 2 | Every blend item has all 5 sections | Each item has: problem today, how source solves it, what changes, what NOT to take, why it matters | |
| 3 | Summary table has impact columns | Table includes "What breaks without it" and "What changes after" with concrete examples, not abstract labels | |
| 4 | No blend item argues from abstraction | Every "problem in svc today" names a concrete failure scenario, not just "this could be better" | |
| 5 | Registry updated | New entry in `references/blend-registry.json` | |
| 6 | NOTICES updated | Source credited in NOTICES | |
| 7 | Knowledge layers written | `test -f references/knowledge/<source>/CAPABILITIES.md` | |
| 8 | Knowledge protocol conformance | Library checked first, .version written, INDEX.md updated | |
| 9 | Full dimension comparison | Every dimension from BOTH CAPABILITIES.md files has a row in the comparison table — no dimensions omitted | |
| 10 | Hybrid opportunities assessed | Every BLEND/IMPROVE item has a "Hybrid opportunity" note — either describing the hybrid or explaining why pure transplant is correct | |
| 11 | Dual assessment produced | Blend plan has both Assessment A (blend opportunities) and Assessment B (external addon viability) — even if one is "nothing to blend" or "not addon-viable" | |
| 12 | skill-pack-comparison.md updated | For each capability row where svc previously showed "— gap —" and this blend fills it, update the row. Update "Last updated" and "Last blend-registry checked" dates. | |
| 13 | Rules re-evaluated if source has registered rules | Phase 4.5 ran: stale `source_sha` or `last_evaluated` > 90 days → `evaluate-rule` invoked; fresh rules → explicitly skipped | |
| 14 | Source registered in blend-registry (coverage) | The source being analyzed exists in `references/blend-registry.json` — if absent, register a baseline entry (name, url, license, `upstream_ref_cmd`) BEFORE writing the blend plan. WI-476 miss (coreyhaines was blended but never registered, so audit mode skipped the largest source) made structural. | |

## Proposal Lifecycle

Blend plans live in `proposals/` while pending. When all blend items are
implemented (or explicitly deferred), move the proposal to `proposals/done/`:

```bash
mv proposals/<date>-blend-<name>.md proposals/done/
```

Do NOT move a proposal to `done/` until every blend item is either implemented
or has a DEFERRED note with rationale. A partially-implemented proposal stays
in `proposals/` with per-item status markers.

## Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `blend-external` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-SvcCapabilityBaseline --evidence command_output:.svc/blend-external-svc-baseline.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-ExternalSourceAcquisition --evidence command_output:.svc/blend-external-source.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-DualAssessmentComparison --evidence file:proposals/<date>-blend-<source>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-HybridBlendPlan --evidence file:proposals/<date>-blend-<source>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-RegistryNoticesKnowledgeUpdate --evidence file:references/blend-registry.json
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/blend-external-self-verify.log
```

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first — this is the cross-host,
  cross-session, cross-subagent source of truth.
- Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; `update_plan` in Codex)
  is ONLY performed when running in the parent/top-level session. Detect via:
  host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
  check fails, skip host mirroring — file state is the durable record; the
  orchestrator parent will re-read and re-mirror after the subagent returns.
- Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
  graceful; it's silent drift between the subagent's intent and the host UI.
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Chaining

**Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`):**
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

This skill does not chain. It produces a blend plan in `proposals/`.
Implementation happens by editing target SKILL.md files directly or
through the normal pipeline for larger changes.

After completion, update FRAMEWORK-STATE.md with the blend entry.

## Initializing the blend registry

If `references/blend-registry.json` doesn't exist, create it from NOTICES.
Read NOTICES to reconstruct the initial registry with the sources already
attributed. Set the SHA to "unknown-pre-registry" for sources that were
blended before tracking began — the next re-blend will establish a baseline.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

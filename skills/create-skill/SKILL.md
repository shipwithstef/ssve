---
name: create-skill
version: "1.0"
description: >
  Creates or edits svc skills so they meet the framework contract (frontmatter, self-
  verify, receipts, pipeline continuation, tier-1 evals). Use for "create a skill", "edit
  this skill", or when the pipeline needs a project-specific helper skill mid-run.
phases:
  - id: P1-IntentAndScopeCapture
    trigger: always
    reads: ["user request", "conversation history", "existing skill when updating"]
    writes: [".svc/create-skill-intent.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-InterviewResearchAndEdgeCases
    trigger: always
    reads: ["user answers", "available MCPs", "similar skills", "edge-case notes"]
    writes: [".svc/create-skill-research.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-SkillDraftFrontmatterAndBody
    trigger: always
    reads: ["skill brief", "svc-specific frontmatter requirements", "visual-output checklist"]
    writes: ["<skill-name>/SKILL.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-RegistryInstallAndPersistence
    trigger: new-or-framework-skill
    reads: ["skills-manifest.json", "README.md", "EXTERNAL_ADDONS.md", "setup"]
    writes: ["skills-manifest.json when needed", "README.md when needed", "EXTERNAL_ADDONS.md when needed", "host skill symlinks when setup runs"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-EvalHarnessAndAssertions
    trigger: evaluation-needed
    reads: ["test prompts", "test-framework/evals/evals.json", "test-framework/evals/tier-2/scenarios"]
    writes: ["test-framework/evals/evals.json", "test-framework/evals/tier-2/scenarios/<name>-eval.md", "<skill-name>-workspace/"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-RunGradeAndIterate
    trigger: evaluation-needed
    reads: ["<skill-name>-workspace/", "agents/grader.md", "agents/analyzer.md"]
    writes: ["<skill-name>-workspace/iteration-*/grading.json", "<skill-name>-workspace/iteration-*/benchmark.json"]
    evidence_kind: file
    required_for_completion: true
  - id: P7-DescriptionOptimizationAndPackaging
    trigger: finalization
    reads: ["SKILL.md frontmatter", "trigger eval set", "package script"]
    writes: ["SKILL.md", "<skill-name>.skill when packaged"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P8-SelfVerifyContinuation
    trigger: always
    reads: ["SKILL.md", ".svc/lane-tasks-<WI>.json", "validation output"]
    writes: [".svc/create-skill-self-verify.log"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - description of what the skill should do (provided by user or evolve-framework)
  optional: []
outputs:
  produces:
    - { artifact: skill-definition, note: "SKILL.md in new skill directory" }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: true
---

# Skill Creator

A skill for creating new skills and iteratively improving them.

**Announce at start:** "I'm using the create-skill skill to create a new skill."

**Outcome:** a skill that triggers on the right requests, does its job on realistic test
prompts better than the baseline, and passes the framework contract. **Check:** Self-Verify
below plus the eval loop. **Boundary:** no malware or misleading intent; a skill is not
"created" until it is installed and registered.

## Required checklist for visual-output skills

If the new skill produces a visible artifact that ships to a deployed product (logo, landing page, UI screen, popup, paywall, ad creative, etc.), its SKILL.md includes a **terminal "Phase Z — Live in-app verification"** section that references `_shared/live-evidence.md`. That phase:

1. Captures the deployed surface with Playwright in both light and dark theme
2. Persists screenshots to `docs/specs/<skill>/in-app-verification/`
3. Runs the eyeball checklist (raw-text-leak, silhouette holds, theme-correct accents, contrast, brand-register)
4. Hard-fails back to iteration if any check fails — the skill cannot declare done

Without this phase, the skill fails tier-1 validator `validate-visual-skills-have-live-evidence.sh`.

Skip condition: skills that produce no visible artifact (internal config, server-side schema, CLI tool wiring) are exempt and say so explicitly: `live-evidence: not-applicable (no visible artifact)`.

Origin: 2026-04-30 Example Marketplace logo session shipped a logo-swap to prod that bundle-grep + build all PASSED while the live page rendered raw JSX text. Only live capture caught it. Generalized to all visual-output skills.

**Checklist for terminal/report skills** — If the new skill is terminal by nature (it produces a final report, answer or decision artifact and should not push the user into a downstream lane), its frontmatter includes `chain.terminal: true`; route-producing pre-lane skills may name a recommended next lane, but backlog dispatch after them is advisory unless the user continues. The same section also gives the overall loop: draft, write test prompts, run with the skill, evaluate with the user, rewrite, repeat, then optimize the description; adapt to where the user already is. Details: `references/mandatory-checklist-for-terminal-report-.md`.

## Communicating with the user

People across a wide range of coding familiarity use this skill — from developers to people opening a terminal for the first time. Read context cues and phrase accordingly. By default, "evaluation" and "benchmark" are fine; terms like "JSON" and "assertion" need clear cues that the user knows them before you use them unexplained. When in doubt, add a short definition.

---

## Creating a skill

### Capture Intent

Start from the user's intent. If the conversation already contains the workflow to capture ("turn this into a skill"), extract the tools used, step sequence, corrections, and input/output formats from history first; the user fills gaps and confirms before you move on. Establish:

1. What should this skill enable Claude to do?
2. When should this skill trigger? (what user phrases/contexts)
3. What's the expected output format?
4. Should we set up test cases? Objectively verifiable outputs (file transforms, data extraction, code generation, fixed workflow steps) benefit from them; subjective outputs (writing style, art) often don't. Suggest a default by skill type and let the user decide.

### Interview and Research

Ask about edge cases, input/output formats, example files, success criteria, and dependencies before writing test prompts. Use available MCPs or subagents to research docs, similar skills and best practices in parallel, so you arrive with context and the user carries less of the load.

**Write the SKILL.md** — Fill in `name` (verb-noun), `version` (quoted string starting at `"1.0"`, required on every includedSkill, bumped when inputs/outputs/chain change), a trigger-rich `description` (all "when to use" goes here), and for pipeline skills `inputs`, `outputs` and `chain` (lanes, progressive, self_verify, human_checkpoint) plus Self-Verify Checklist, Pipeline Continuation and Key Principles sections. After creating the skill: add it to `skills-manifest.json` (and `laneDefinitions` if pipeline), `README.md` and `EXTERNAL_ADDONS.md`; create `test-framework/evals/tier-2/scenarios/<name>-eval.md`; run `node scripts/lint-skills-manifest.mjs`; check trigger overlap with grep. Run `./setup --host claude` (plus `--host codex` / `--host opencode` if those are installed) from the framework repo — without the symlink the skill is invisible to the host, so a skill is not created until this has run. Commit the skill and the manifest/README/EXTERNAL_ADDONS changes together. Details: `references/creating-a-skill.md`.

**Skill Writing Guide** — A skill is `SKILL.md` (frontmatter plus instructions) with optional `scripts/`, `references/` and `assets/`. Keep SKILL.md under 500 lines, add a layer of references with clear pointers on when to read them, give reference files over 300 lines a table of contents, and split by variant (aws.md, gcp.md) for multi-domain skills. Skills must not contain malware or misleading intent. Write in the imperative, and define output formats and examples with explicit templates. Details: `references/creating-a-skill.md`.

### Writing Style

Current Claude models follow instructions precisely, so a skill works best when it states
what good looks like and why, and trusts the model with the routine parts. Teach every new
skill (and every edit) these habits:

- **Outcome, check, boundary.** Open with what the skill must produce, how completion is
  verified (Self-Verify, a validator, a receipt), and the few lines it must not cross.
  Prefer that over a micro-step procedure for things a capable model does reliably
  (searching, reading, summarising, generic edit loops).
- **Keep steps only where order matters** — gates, evidence/receipt emission, a protocol
  whose passes build on each other. Number those; describe the rest as outcomes.
- **Plain rules with reasons.** Write "Do X, because Y" instead of all-caps imperatives.
  Knowing the reason lets the model handle cases the rule didn't foresee, and
  shouting makes models over-apply a rule. Reserve emphasis for a handful of genuine hard
  boundaries per skill (destructive git, secrets, never inventing facts).
- **Positive framing.** Say what to do ("write in flowing prose") rather than only what to
  avoid.
- **Progressive disclosure.** SKILL.md is the operating core; detail, templates, long
  examples and variant-specific material go to `references/` with a pointer saying when to
  read them. Point to shared references (`_shared/`, `references/`) instead of restating them.
- **No redundancy or stale workarounds.** Say each rule once. Delete repetition, filler,
  and instructions that compensated for older models' weaknesses.
- **General, not overfit.** Use theory of mind; make the skill work across many prompts,
  not just the test examples. Draft, then reread with fresh eyes and cut.

### Test Cases

After the draft, write 2-3 realistic test prompts — what a real user would actually say — and share them: "Here are a few test cases I'd like to try. Do these look right, or do you want to add more?" Then run them.

Save prompts (no assertions yet) to `evals/evals.json`; you'll draft assertions while the runs are in progress.

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "User's task prompt",
      "expected_output": "Description of expected result",
      "files": []
    }
  ]
}
```

See `references/schemas.md` for the full schema (including the `assertions` field, which you'll add later).

## Running and evaluating test cases

This section is one continuous sequence — don't stop partway through. Use this loop rather than `/skill-test` or another testing skill, because the viewer and benchmark depend on this workspace layout.

Put results in `<skill-name>-workspace/` as a sibling to the skill directory, organized by iteration (`iteration-1/`, `iteration-2/`, …) and within that one directory per test case (`eval-0/`, `eval-1/`, …). Create directories as you go.

**Step 1: Spawn all runs (with-skill AND baseline) in the same turn** — For every test case, spawn the with-skill run and the baseline run in the same turn (never baselines later), each saving to `<workspace>/iteration-<N>/eval-<ID>/{with_skill,without_skill|old_skill}/outputs/`. The baseline is no skill for a new skill, or a snapshot of the old version (`cp -r <skill-path> <workspace>/skill-snapshot/` before editing) when improving one. Write an `eval_metadata.json` (eval_id, descriptive eval_name, prompt, assertions) for each test case. Details: `references/running-and-evaluating-test-cases.md`.

### Step 2: While runs are in progress, draft assertions

Use the wait to draft quantitative assertions for each test case and explain them to the user (or review and explain existing ones in `evals/evals.json`). Good assertions are objectively verifiable with descriptive names that read clearly in the benchmark viewer. Evaluate subjective skills (writing style, design quality) qualitatively rather than forcing assertions onto human judgment. Update `eval_metadata.json` and `evals/evals.json`, and tell the user what they'll see in the viewer — qualitative outputs and the quantitative benchmark.

### Step 3: As runs complete, capture timing data

Each subagent completion notification carries `total_tokens` and `duration_ms`. Save them to `timing.json` in the run directory as each arrives — the notification is the only place this data exists:

```json
{
  "total_tokens": 84852,
  "duration_ms": 23332,
  "total_duration_seconds": 23.3
}
```

**Step 4: Grade, aggregate, and launch the viewer** — After all runs finish: grade each run against `agents/grader.md` into `grading.json` (expectations use the fields `text`, `passed`, `evidence`), aggregate with `python -m scripts.aggregate_benchmark <workspace>/iteration-N --skill-name <name>`, do an analyst pass per `agents/analyzer.md`, then launch `eval-viewer/generate_review.py` with `--benchmark` (and `--previous-workspace` from iteration 2; use `--static <path>` when headless). Use that script rather than custom HTML, and tell the user about the Outputs and Benchmark tabs. Details: `references/running-and-evaluating-test-cases.md`.

### What the user sees in the viewer

The "Outputs" tab shows one test case at a time:
- **Prompt**: the task that was given
- **Output**: the files the skill produced, rendered inline where possible
- **Previous Output** (iteration 2+): collapsed section showing last iteration's output
- **Formal Grades** (if grading was run): collapsed section showing assertion pass/fail
- **Feedback**: a textbox that auto-saves as they type
- **Previous Feedback** (iteration 2+): their comments from last time, shown below the textbox

The "Benchmark" tab shows the stats summary: pass rates, timing, and token usage for each configuration, with per-eval breakdowns and analyst observations.

Navigation is via prev/next buttons or arrow keys. When done, they click "Submit All Reviews" which saves all feedback to `feedback.json`.

### Step 5: Read the feedback

When the user is done, read `feedback.json`:

```json
{
  "reviews": [
    {"run_id": "eval-0-with_skill", "feedback": "the chart is missing axis labels", "timestamp": "..."},
    {"run_id": "eval-1-with_skill", "feedback": "", "timestamp": "..."},
    {"run_id": "eval-2-with_skill", "feedback": "perfect, love this", "timestamp": "..."}
  ],
  "status": "complete"
}
```

Empty feedback means the user thought it was fine; focus on cases with specific complaints. Stop the viewer server when done (`kill $VIEWER_PID 2>/dev/null`).

---

**Improving the skill** — Improve from the user's feedback by generalizing beyond the few test examples, keeping the prompt lean (read transcripts, remove parts that waste effort), explaining the why behind each instruction, and bundling any helper script that every test run wrote independently. Then rerun all cases (with baselines) into a new `iteration-<N+1>/`, launch the reviewer with `--previous-workspace`, wait for the user, and repeat until they are happy, feedback is empty, or progress stalls. Details: `references/improving-the-skill.md`.

## Advanced: Blind comparison

When the user wants a rigorous comparison between two versions ("is the new version actually better?"), give both outputs to an independent agent without labels, let it judge, then analyze why the winner won. Read `agents/comparator.md` and `agents/analyzer.md`. Optional, requires subagents; the human review loop is usually sufficient.

---

## Description Optimization

The description field in SKILL.md frontmatter is the primary mechanism that determines whether Claude invokes a skill. After creating or improving a skill, offer to optimize the description for better triggering accuracy.

**CSO WARNING (AP-20):** Never let a description summarize the workflow. When a
description says "9-step gate: explore, question, propose, spec, review," Claude
treats the description as sufficient knowledge and skips the full SKILL.md —
running a shallow version that misses all gates and checks. Descriptions state
when to trigger ("Use when starting creative work"), not what the skill does step
by step. See `references/anti-patterns.md` AP-20.

### Step 1: Generate trigger eval queries

Create 20 eval queries — a mix of should-trigger and should-not-trigger. Save as JSON:

```json
[
  {"query": "the user prompt", "should_trigger": true},
  {"query": "another prompt", "should_trigger": false}
]
```

Make queries realistic and concrete — what a Claude Code or Claude.ai user would actually type: file paths, personal context, column names and values, company names, URLs, a little backstory; some lowercase, abbreviated, typo'd or casual; varied lengths; weighted toward edge cases rather than clear-cut ones (the user signs off on them).

Bad: `"Format this data"`, `"Extract text from PDF"`, `"Create a chart"`

Good: `"ok so my boss just sent me this xlsx file (its in my downloads, called something like 'Q4 sales final FINAL v2.xlsx') and she wants me to add a column that shows the profit margin as a percentage. The revenue is in column C and costs are in column D i think"`

**Should-trigger (8-10):** cover different phrasings of the same intent (formal and casual), cases where the user doesn't name the skill or file type but clearly needs it, uncommon use cases, and cases where this skill competes with another but should win.

**Should-not-trigger (8-10):** the valuable ones are near-misses — shared keywords or concepts but a different need, adjacent domains, ambiguous phrasing a naive keyword match would catch, or contexts where another tool fits better. Obviously irrelevant negatives ("Write a fibonacci function" for a PDF skill) test nothing.

### Step 2: Review with user

Present the eval set with the HTML template: read `assets/eval_review.html`, replace `__EVAL_DATA_PLACEHOLDER__` (the JSON array, unquoted — it's a JS variable assignment), `__SKILL_NAME_PLACEHOLDER__` and `__SKILL_DESCRIPTION_PLACEHOLDER__`, write it to a temp file (e.g., `/tmp/eval_review_<skill-name>.html`) and open it. The user edits queries, toggles should-trigger, adds/removes entries, and clicks "Export Eval Set"; the file lands in `~/Downloads/eval_set.json` (take the most recent if there are several, e.g. `eval_set (1).json`). This step matters — bad eval queries lead to bad descriptions.

### Step 3: Run the optimization loop

Tell the user this runs in the background and you'll check on it periodically. Save the eval set to the workspace, then:

```bash
python -m scripts.run_loop \
  --eval-set <path-to-trigger-eval.json> \
  --skill-path <path-to-skill> \
  --model <model-id-powering-this-session> \
  --max-iterations 5 \
  --verbose
```

Use the model ID powering the current session so the triggering test matches what the user experiences. Tail the output periodically to report iteration and scores. The loop splits the eval set 60% train / 40% held-out test, evaluates the current description (each query 3 times for a reliable trigger rate), asks Claude to propose improvements from failures, re-evaluates on both splits for up to 5 iterations, opens an HTML report, and returns JSON with `best_description` — selected by test score rather than train score to avoid overfitting.

### How skill triggering works

Skills appear in Claude's `available_skills` list with name + description, and Claude decides whether to consult one from that description. Claude only consults skills for tasks it can't easily handle on its own — simple one-step queries like "read this PDF" may not trigger a skill even when the description matches, while complex, multi-step, or specialized queries reliably do. So eval queries should be substantive enough that consulting a skill would actually help.

### Step 4: Apply the result

Take `best_description` from the JSON output and update the skill's SKILL.md frontmatter. Show the user before/after and report the scores.

---

### Package and Present (only if `present_files` tool is available)

If you have the `present_files` tool, package the skill and present the .skill file (`python -m scripts.package_skill <path/to/skill-folder>`), then point the user to the resulting `.skill` path so they can install it. Otherwise skip this step.

---

## Claude.ai-specific instructions

The core workflow is the same (draft → test → review → improve → repeat), but Claude.ai has no subagents, so adapt:

- **Running test cases**: run each test prompt yourself, one at a time, following the skill's SKILL.md. Less rigorous than independent subagents (you wrote the skill), but a useful sanity check that human review compensates for. Skip baseline runs.
- **Reviewing results**: if you can't open a browser, skip the browser reviewer; show each prompt and output in the conversation (save files like .docx/.xlsx to the filesystem and say where), and ask for feedback inline: "How does this look? Anything you'd change?"
- **Benchmarking**: skip quantitative benchmarking — baselines aren't meaningful without subagents. Focus on qualitative feedback.
- **The iteration loop**: same as before, without the browser reviewer; iteration directories still work if you have a filesystem.
- **Description optimization**: requires the `claude` CLI (`claude -p`), only in Claude Code. Skip it on Claude.ai.
- **Blind comparison**: requires subagents. Skip it.
- **Packaging**: `package_skill.py` works anywhere with Python and a filesystem; the user can download the resulting `.skill` file.
- **Updating an existing skill**: preserve the original name (directory and `name` field unchanged — `research-helper` stays `research-helper.skill`, not `-v2`); copy to a writeable location such as `/tmp/skill-name/` before editing, since the installed path may be read-only; and when packaging manually, stage in `/tmp/` first, then copy to the output directory.

---

## Cowork-Specific Instructions

- You have subagents, so the main workflow (parallel test cases, baselines, grading) works; if timeouts are severe, run test prompts in series.
- There is no browser or display: generate the eval viewer with `--static <output_path>` and offer a link to the HTML file.
- Generate the eval viewer with `generate_review.py` (not custom HTML) right after running tests, before evaluating outputs yourself — getting examples in front of the human early is the point of the loop, and Cowork tends to skip this step.
- Feedback arrives as a downloaded `feedback.json` (via "Submit All Reviews") rather than through a server; read it from there (you may need to request access).
- Packaging works — `package_skill.py` just needs Python and a filesystem.
- Description optimization (`run_loop.py` / `run_eval.py`) works since it uses `claude -p` via subprocess; save it until the skill is finished and the user agrees it's in good shape.
- **Updating an existing skill**: follow the update guidance in the claude.ai section above.

---

**Reference files** — Read `agents/grader.md`, `agents/comparator.md` and `agents/analyzer.md` when spawning those subagents; `references/schemas.md` has the JSON structures. Core loop to repeat: figure out what the skill is about, draft it, run it on test prompts, evaluate with the user (benchmark.json plus `eval-viewer/generate_review.py`), iterate, package. Add these steps to your TodoList, including "Create evals JSON and run `eval-viewer/generate_review.py` so human can review test cases" in Cowork. Details: `references/reference-files.md`.

## Phase Receipt Contract

When running in task-graph mode, emit one receipt per required phase before
marking the `create-skill` task complete. Use the current task id from
`.svc/lane-tasks-<WI>.json`:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-IntentAndScopeCapture --evidence command_output:.svc/create-skill-intent.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-InterviewResearchAndEdgeCases --evidence command_output:.svc/create-skill-research.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-SkillDraftFrontmatterAndBody --evidence file:<skill-name>/SKILL.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-RegistryInstallAndPersistence --evidence command_output:.svc/create-skill-install.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-EvalHarnessAndAssertions --evidence file:test-framework/evals/tier-2/scenarios/<name>-eval.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-RunGradeAndIterate --evidence file:<skill-name>-workspace/iteration-1/benchmark.json
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-DescriptionOptimizationAndPackaging --evidence command_output:.svc/create-skill-finalization.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-SelfVerifyContinuation --evidence command_output:.svc/create-skill-self-verify.log
```

If a phase is intentionally skipped because the user declined evals, packaging,
description optimization, or framework install, still record that phase id with
command-output evidence explaining the skip. Do not complete the task until all
required phase ids appear in `skill_receipt.phases_executed`.

**Structural Bulletproofing (for discipline-enforcing skills)** — For discipline skills (TDD, debugging, verification, scope control) add a Rationalization Table (rows of the exact thought the agent may have and a rebuttal) and a Red Flags list (observable rule-breaking behaviors mapped to corrective actions); these roughly double compliance. Guidance skills never need them and routing skills rarely do. Use specific "when you think X, do Y" rules, not general ones. Details: `references/structural-bulletproofing-for-discipline.md`.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | SKILL.md created | new skill directory has SKILL.md | |
| 2 | Frontmatter valid | name, description, inputs, outputs, chain present | |
| 3 | Eval created | test-framework/evals/ has eval for new skill | |
| 4 | Manifest updated | new skill in skills-manifest.json includedSkills | |
| 5 | Installer run | Symlink exists in installed host paths: `test -L ~/.claude/skills/<new-skill-name>` AND `test -L ~/.kimi/skills/<new-skill-name>` (if Kimi host installed) AND `test -L ~/.config/opencode/skills/<new-skill-name>` (if OpenCode host installed) | |
| 6 | Symlink resolves to framework repo | `readlink ~/.claude/skills/<new-skill-name>` (or `~/.kimi/skills/<new-skill-name>` or `~/.config/opencode/skills/<new-skill-name>`) points at `$FRAMEWORK_REPO/<new-skill-name>` | |
| 7 | Writing style | outcome/check/boundary stated; emphasis words limited to real hard boundaries; SKILL.md under 500 lines with detail in `references/` | |

## Pipeline Continuation

### Task-graph mode (source of truth: `.svc/lane-tasks-<WI>.json`; mirrors: Claude `TaskList`, Kimi `/task`+`TaskList`/`TaskOutput` observe-only, Codex `update_plan`)
- Treat `Invoke: /skill-name` + `metadata.skill` as routing instructions, not prose.
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume.
- Host-UI mirroring only in the parent session (host exposes TaskList and no `SVC_SUBAGENT=1`);
  otherwise skip it — the file is the durable record and the parent re-mirrors after the subagent returns.
  Subagents do not call TaskUpdate: a failed call is silent drift between the subagent's intent and the host UI.
- In Codex and other hosts without native task-mutation APIs, mirror only the active step in `update_plan`.
- Mark this task `completed` before leaving; then mirror. Evaluate the next task's conditions:
  runnable → mark `in_progress`, persist, load that skill; skippable → mark `completed` + skip reason.
- Per `route-workflow` Task-Graph Execution Protocol.

### Chaining

This skill is standalone. After creating a skill, suggest running
`test-framework` to validate it or `improve-framework` to integrate it.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

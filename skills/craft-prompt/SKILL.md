---
name: craft-prompt
version: "1.0"
self_verify: true
human_checkpoint: false
live-evidence: not-applicable (no visible artifact — emits a prompt + a receipt)
description: >
  Crafts a standalone, output-shaped prompt for a task and checks it beats a bare baseline
  with a best-of-2 floor. Use for "craft me a prompt", "make this prompt better", "beat
  this viral prompt". Not for routing svc work. Opt-in, default off.
inputs:
  required:
    - artifact: task-intent
      note: "what the prompt should make a model do"
  optional:
    - artifact: baseline-prompt
      note: "the user's hand-crafted/viral 'sheep' prompt; synthesized as a bare prompt if absent"
    - artifact: representative-input
      note: "one real input to run both prompts on; auto-synthesized + surfaced if absent"
outputs:
  produces:
    - artifact: crafted-prompt
      note: "the shipped prompt — F if it beats the floor, else the baseline B verbatim"
    - artifact: prompt-floor-receipt
      path: refs/notes/svc-receipts (mirror .svc/receipts/<sha>/prompt-floor.json)
chain:
  lanes: {}   # gate, not a lane position (mirrors blind-control-plan / review-plan)
---


**Announce at start:** "I'm using craft-prompt to write a strong prompt and prove it's never worse than the baseline."

# craft-prompt

Current models already know how to write a good prompt, and they follow instructions precisely — so a prompt mostly needs to say clearly what is wanted and why. This skill applies the rubric that brings that out, plus a cheap guarantee that the result is never worse than the prompt you would have written by hand. That guarantee is the edge a human posting on X can't run: a **best-of-2 floor**, the WI-410 control-plan thesis one level down (prompts instead of plans).

> **This is the LEAN design (owner-locked).** v1 = rubric + best-of-2 floor (~2-3 model calls). It deliberately does not run the token-heavy optimizer (generate-N, run-on-many-inputs, train/test, leveling ledger, DSPy/OPRO): the model already knows the craft, so a giant search doesn't earn its tokens. Those are designed-and-deferred behind a ≥20-shadow-run bar.

## Arming (v1: WARN/shadow, default OFF)
Run the floor only when `node scripts/prompt-floor-route.mjs` returns `run:true` — armed via `.svc/chain-policy.json` opt-in, non-trivial, no `.svc/prompt-craft.off` kill-switch, and the user explicitly asked to craft/optimize/beat a prompt. Otherwise emit the rubric-crafted prompt without the floor and say so. In v1 the floor is WARN-only: it logs and emits the receipt but blocks nothing; `prompt-floor` is not in `REQUIRED_TYPES_FULL`.

## Process — best-of-2 floor

### P0 — route-gate + judge availability
`node scripts/prompt-floor-route.mjs --task <class> --size <S|M|L>` decides run/skip. Read the probe-free tuple policy with `bash scripts/resolve-adversarial-reviewer.sh`. The floor package goes through `scripts/run-external-review.mjs`, whose primary call is the availability probe. A missing required capability hard-fails with a receipt rather than silently shipping an unreviewed baseline.

### P1 — baseline B (immutable)
B = the user's hand-crafted/"sheep" prompt. If none is given, synthesize the obvious bare one-line prompt as B so the floor still runs. Keep B and F as independent candidates — editing B into F is intrinsic self-correction, which degrades quality (Huang et al. ICLR 2024; OAgents −6.62% on hard tasks).

### P2 — representative input
One real input to run both prompts on (user-given). If absent, synthesize one diverse input plus explicit success criteria and **surface them for confirmation** before running.

### P3 — craft F (the rubric does the work)
Author F with `references/authoring-rubric.md`: a clear, direct task; the context and the reason behind each constraint; a **literal output_format block**; checkable constraints stated as what to do; a role line and 1-2 diverse examples only where they help; structure (XML sections) only where it separates distinct material; room for the model to reason rather than a scripted chain of thought. Apply the current anti-pattern guards (no assistant prefill on recent Claude models; `effort` rather than `budget_tokens`; no caps-lock "critical / you must / always" emphasis). This is best-of-2 (one strong F vs B), not best-of-N.

### P4 — run both once
Run B and F once each on the representative input and capture both outputs.

### P5 — floor (the never-worse guarantee)
`node scripts/prompt-element-extract.mjs` turns each OUTPUT into requirement-coverage `{elements:[{key,content}]}` with **objective-first keys** (word-count, CTA-present, format-block-present, forbidden-words-absent), authored once from the task brief and applied **symmetrically** to B-output and F-output. `node scripts/blind-floor-check.mjs --blind B.json --merged F.json` (reused verbatim from WI-410) isolates any requirement B covered that F dropped; `bash scripts/prompt-floor-judge.sh` (cross-family, OUTPUT-FIRST, "longer is NOT better", default-REJECT) certifies subjective rows **on the outputs, not the prompt's looks**. Re-run the check with `--verdicts`: ship **F** (`floor_verdict=pass`) iff there are zero uncertified dropped requirements; otherwise ship **B verbatim** (`--adopt-blind` → `floor_verdict=blind-adopted`). Launcher, capability, authentication, quota, network, timeout or schema failures halt with the canonical receipt and never become `blind-adopted`.

### P6 — emit receipt
`node scripts/emit-receipt.mjs --type prompt-floor` (floor_verdict, element_ledger, judge family, tree_hash). `blind-adopted` is a logged **negative-ROI** signal — the craft did not beat the baseline here.

## Invariant — NEVER-WORSE-THAN-BASELINE (honest bound, from WI-410)
- **Mechanical + fail-closed** only for *dropped requirements* the baseline covered.
- **Judge-conditional** for semantic quality (mitigated by cross-family + pessimistic tie-break + content-binding — never proven).
- **Unconditional never-worse** only via baseline-retention.
- Claim only `blind-adopted` (negative-ROI) or `judge-certified-improvement` (judge family X, content-bound) — in the receipt and in prose. "svc beats the sheep" is not a provable fact: a single green run is an existence proof, not a population claim, and there is no objective scorer for prompt quality. Keep requirement keys objective-first and apply them symmetrically.

## Rationalization Table (this is a discipline gate — these thoughts are traps)
| Thought | Reality |
|---------|---------|
| "My crafted prompt is obviously better, skip the floor" | "Obviously better" is verbosity bias — the crafted prompt is longer by construction. Run the floor; ship B if F can't be certified. |
| "No cross-family judge available, I'll just judge it myself" | Claude grading Claude is the self-preference trap. No judge → ship the baseline verbatim; a quality win is never self-certified. |
| "I'll refine the baseline into something better" | Editing B into F is intrinsic self-correction, which degrades quality (Huang et al. 2024). B stays immutable; F is independent. |
| "I'll judge the prompt text, not the output" | A pretty prompt is not a better result. Judge the OUTPUT each prompt produced on the real input. |
| "Add caps-lock 'critical: you must' to make F stronger" | Recent Claude models already follow instructions closely and over-apply shouted imperatives. Say the rule plainly with its reason ("Use this when…"). See the rubric anti-patterns. |
| "More examples will make F safer" | Models copy examples closely, including their surface details. Use 1-2 diverse examples only when the format or style is hard to describe in words. |

**Red Flags — stop if you catch yourself doing any of these:**
- You shipped F without running both prompts on a real input → you have no evidence F beats B; run the floor or ship B.
- You wrote `floor_verdict=pass` without a cross-family certified verdict → that's a forged self-cert; the check rejects `reviewer_family==anthropic`.
- The crafted prompt contains last-turn assistant prefill → unsupported on recent Claude models (returns 400); remove it.
- You claimed "this beats the viral prompt" in prose → unprovable; say "judge-certified-improvement" or "blind-adopted" only.

## Pipeline Continuation

### Task-graph mode
source of truth: `.svc/lane-tasks-<WI>.json`. Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Claude Code mirror with `TaskList`/`TaskUpdate`; in Kimi use `/task` as observation only; in Codex and hosts without native task APIs, mirror only the active step in `update_plan` (never the full graph). craft-prompt is a gate invoked adjacent (not a lane position): on `pass` continue with F; on `blind-adopted` continue with B. In v1 (WARN/shadow) a `fail` is logged + receipted but blocks nothing.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Rubric applied | the emitted prompt states the task directly, gives context and reasons, has a literal output_format block and checkable constraints; a role line and 1-2 diverse examples appear where they help (or their omission is deliberate) | |
| 2 | 2026 anti-patterns clean | no last-turn prefill; no caps-lock "critical / you must / always" over-prompting; `effort` not `budget_tokens` | |
| 3 | Floor ran (when armed) | `bash test-framework/evals/tier-1/validate-prompt-floor.sh` green and canonical-launcher failure remains a hard stop rather than `blind-adopted` | |
| 4 | Judge independence | any pass/refined certification carries `reviewer_family != anthropic` (cross-family); self-certs and stale `for_content_sha` rejected | |
| 5 | Honest bound respected | the receipt/output claims only `blind-adopted` or `judge-certified-improvement` — never "beats the sheep" as fact | |

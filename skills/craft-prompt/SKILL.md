---
name: craft-prompt
version: "1.0"
self_verify: true
human_checkpoint: false
live-evidence: not-applicable (no visible artifact — emits a prompt + a receipt)
description: >
  Craft a world-class, output-shaped prompt for a task AND prove it is never worse than a
  baseline/"sheep" prompt via a cheap best-of-2 floor. Use this whenever the user says
  "craft me a prompt", "make this prompt better", "write a prompt that...", "beat this viral
  prompt", or needs a high-leverage prompt for an arbitrary task — even if they don't say the
  word "prompt-engineer". It unlocks what the model already knows (persona, output-format,
  few-shot, constraints) via an authoring rubric, then runs a best-of-2 floor so the crafted
  prompt is never worse than the bare/viral baseline. WARN/shadow, default OFF — opt-in only.
  Does NOT route svc work (that is route-workflow's Prompt Composer); this CRAFTS a standalone output prompt.
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

The base model already knows how to write a great prompt — it just needs the rubric that unlocks it, plus a cheap guarantee that the result is never worse than the prompt you'd have written by hand. That guarantee is the edge a human posting on X can't run: a **best-of-2 floor**, the WI-410 control-plan thesis one level down (prompts instead of plans).

> **This is the LEAN design (owner-locked).** v1 = rubric + best-of-2 floor (~2-3 model calls). It deliberately does NOT run the token-heavy optimizer (generate-N, run-on-many-inputs, train/test, leveling ledger, DSPy/OPRO) — the model already knows the craft, so a giant search doesn't earn its tokens. Those are designed-and-deferred behind a ≥20-shadow-run bar.

## Arming (v1: WARN/shadow, default OFF)
Run only when `node scripts/prompt-floor-route.mjs` returns `run:true` — armed via `.svc/chain-policy.json` opt-in, non-trivial, no `.svc/prompt-craft.off` kill-switch, and the user explicitly asked to craft/optimize/beat a prompt. Otherwise just emit the rubric-crafted prompt without the floor (and say so). In v1 the floor is **WARN-only**: it logs + emits the receipt but blocks nothing; `prompt-floor` is NOT in `REQUIRED_TYPES_FULL`.

## Process — best-of-2 floor

### P0 — route-gate + judge availability
`node scripts/prompt-floor-route.mjs --task <class> --size <S|M|L>` decides run/skip. Then read the probe-free tuple policy with `bash scripts/resolve-adversarial-reviewer.sh`. The floor package goes through `scripts/run-external-review.mjs`; its primary call is the availability probe. Missing required capability hard-fails with a receipt instead of silently shipping an unreviewed baseline.

### P1 — baseline B (immutable)
B = the user's hand-crafted/"sheep" prompt. If none given, synthesize the obvious bare one-line prompt as B so the floor still runs. **Never edit B into F** — intrinsic self-correction degrades quality (Huang et al. ICLR 2024; OAgents −6.62% on hard tasks). B and F are independent candidates.

### P2 — representative input
One real input to run both prompts on (user-given). If absent, synthesize one diverse input + explicit success criteria and **surface them for confirmation** before running.

### P3 — craft F (the rubric does the work)
Author F by applying `references/authoring-rubric.md`: persona/role line, a **literal copy-paste output_format block**, 1-2 diverse few-shot (good vs bad) examples, explicit constraints/forbidden-words, family-aware idiom. Apply the 2026 anti-pattern guards (no prefill on Claude 4.6+; `effort` not `budget_tokens`; no `CRITICAL/you MUST/ALWAYS` over-prompting). This is best-of-2 (one strong F vs B), not best-of-N.

### P4 — run both once
Run B and F each once on the representative input; capture both outputs.

### P5 — floor (the never-worse guarantee)
`node scripts/prompt-element-extract.mjs` turns each OUTPUT into requirement-coverage `{elements:[{key,content}]}` with **objective-first keys** (word-count, CTA-present, format-block-present, forbidden-words-absent), authored once from the task brief and applied **symmetrically** to B-output and F-output. `node scripts/blind-floor-check.mjs --blind B.json --merged F.json` (reused verbatim from WI-410) isolates any requirement B covered that F dropped; `bash scripts/prompt-floor-judge.sh` (cross-family, OUTPUT-FIRST, "longer is NOT better", default-REJECT) certifies subjective rows **on the outputs, not the prompt's looks**. Re-run check with `--verdicts`: ship **F** (`floor_verdict=pass`) iff zero uncertified dropped requirements; else ship **B verbatim** (`--adopt-blind` → `floor_verdict=blind-adopted`). Launcher, capability, authentication, quota, network, timeout, or schema failures halt with the canonical receipt and never become `blind-adopted`.

### P6 — emit receipt
`node scripts/emit-receipt.mjs --type prompt-floor` (floor_verdict, element_ledger, judge family, tree_hash). `blind-adopted` is a logged **negative-ROI** signal — the craft did not beat the baseline here.

## Invariant — NEVER-WORSE-THAN-BASELINE (honest bound, from WI-410)
- **Mechanical + fail-closed** only for *dropped requirements* the baseline covered.
- **Judge-conditional** for semantic quality (mitigated by cross-family + pessimistic tie-break + content-binding — never proven).
- **Unconditional never-worse** only via baseline-retention.
- The receipt — and you — may **NEVER** claim "svc beats the sheep" as fact. Only `blind-adopted` (negative-ROI) or `judge-certified-improvement` (judge family X, content-bound). A single green run is an existence proof, not a population claim. There is no objective scorer for prompt quality; keep requirement keys objective-first and apply them symmetrically.

## Rationalization Table (this is a discipline gate — these thoughts are traps)
| Thought | Reality |
|---------|---------|
| "My crafted prompt is obviously better, skip the floor" | "Obviously better" is the verbosity-bias talking — the crafted prompt is longer by construction. Run the floor; ship B if F can't be certified. |
| "No cross-family judge available, I'll just judge it myself" | Claude grading Claude is the self-preference trap. No judge → ship the baseline verbatim. Never self-certify a quality win. |
| "I'll refine the baseline into something better" | Editing B into F is intrinsic self-correction — it degrades quality (Huang et al. 2024). B stays immutable; F is independent. |
| "I'll judge the prompt text, not the output" | A pretty prompt is not a better result. Judge the OUTPUT each prompt produced on the real input. |
| "Add CRITICAL: you MUST to make F stronger" | Newer Opus over-triggers on caps-lock imperatives. "Use this when..." beats "CRITICAL: you MUST". See the rubric anti-patterns. |

**Red Flags — if you catch yourself doing any of these, stop:**
- You shipped F without running both prompts on a real input → you have no evidence F beats B; run the floor or ship B.
- You wrote `floor_verdict=pass` without a cross-family certified verdict → that's a forged self-cert; the check rejects `reviewer_family==anthropic`.
- The crafted prompt contains last-turn assistant prefill → deprecated on Claude 4.6+ (returns 400); remove it.
- You claimed "this beats the viral prompt" in prose → unprovable; say "judge-certified-improvement" or "blind-adopted" only.

## Pipeline Continuation

### Task-graph mode
source of truth: `.svc/lane-tasks-<WI>.json`. Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Claude Code mirror with `TaskList`/`TaskUpdate`; in Kimi use `/task` as observation only; in Codex and hosts without native task APIs, mirror only the active step in `update_plan` (never the full graph). craft-prompt is a gate invoked adjacent (not a lane position): on `pass` continue with F; on `blind-adopted` continue with B. In v1 (WARN/shadow) a `fail` is logged + receipted but blocks nothing.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Rubric applied | the emitted prompt has a persona line, a literal output_format block, 1-2 few-shot examples, and explicit constraints/forbidden-words | |
| 2 | 2026 anti-patterns clean | no last-turn prefill; no `CRITICAL/you MUST/ALWAYS` over-prompting; `effort` not `budget_tokens` | |
| 3 | Floor ran (when armed) | `bash test-framework/evals/tier-1/validate-prompt-floor.sh` green and canonical-launcher failure remains a hard stop rather than `blind-adopted` | |
| 4 | Judge independence | any pass/refined certification carries `reviewer_family != anthropic` (cross-family); self-certs and stale `for_content_sha` rejected | |
| 5 | Honest bound respected | the receipt/output claims only `blind-adopted` or `judge-certified-improvement` — never "beats the sheep" as fact | |

# WI-410 Control-Plan Floor — Research Dossier

**Date:** 2026-06-22
**Source:** ultracode research workflow `wf_f24ea3a8` (8 agents: external prior-art, svc overlap-map, invariant/economics, 10/10 meta-loop; skeptic/architect/pragmatist lenses; synthesis)
**Owner directive:** "as long as framework doesn't introduce something worse I want this" → the NEVER-WORSE-THAN-BLIND invariant.

## The reframe (most important finding)
The owner's idea — blind plan ∥ framework plan → compare → never worse — is correct, but the naive implementation (let the framework *refine* the blind plan) would **degrade** quality:
- Huang et al., ICLR 2024 "LLMs Cannot Self-Correct Reasoning Yet" (arXiv 2310.01798): GPT-4 GSM8K 95.5% → 91.5% → 89.0% under intrinsic self-correction; GPT-3.5 75.9 → 74.7. "The model is more likely to modify a correct answer to an incorrect one."
- OAgents (arXiv 2506.15741, EMNLP 2025): Reflection +3.03% overall but **−6.62% on hard (L3) tasks**; Best-of-N is the safe, monotone direction (BO2 +1.82%, BO4 +5.19%).

**∴ Mechanism = best-of-2 retention:** B and F are two independent candidates; B is kept immutable and *returnable verbatim*. "Never worse" is provable because best-of-N dominates its candidate set when the chooser is honest — and the chooser's honesty is bounded below by the retention escape hatch (ship B when uncertain).

## External prior-art (port / avoid)
- **PORT** Anthropic evaluator-optimizer gen/eval *split* + structured verdict contract (`claude-cookbooks` evaluator_optimizer.ipynb). **AVOID** its unbounded `while True` self-judged-PASS loop as the invariant mechanism (never retains the original; can rubber-stamp/loop).
- **PORT** best-of-N framing with N=2. **AVOID** large-N + learned/soft reward (reward-hacking: accuracy rises then falls — RBoN arXiv 2404.01054).
- **The selector is the risk surface, not the asset.** LLM-judge pathologies: self-preference −38%..+90% (arXiv 2410.21819, stronger in bigger models), position bias (arXiv 2406.07791), verbosity bias (longer scored higher — and framework plans are longer by construction), non-transitivity. Mitigations: objective rubric over LLM verdict; cross-family judge; **tie-defaults-to-BLIND**; randomize/strip order+length cues.
- Anthropic "Building Effective Agents": "add complexity only when simpler solutions fall short" — directly blesses shipping blind when framework doesn't strictly beat it.

## svc overlap-map (DISTINCT-NEW + reuse seams)
No svc primitive generates a framework-free baseline as a locked floor.
- `explore-solutions` — DISTINCT (its baseline is design-tech's own choice, not framework-free). Reuse its tradeoff-matrix rubric shape.
- `review-plan` — DISTINCT, do-NOT-fold-in (reviews F in isolation; can promote a plan worse than blind). Reuse chain-position + accept/reject discipline + `lanes:{}` gate precedent.
- `plan-changeset` — upstream dep; authoring B here contaminates F. Reuse manifest shape + self-verify lane-insertion.
- `resolve-adversarial-reviewer.sh` — REUSE verbatim (cross-family independence; exit 1 = kill-switch).
- `review-plan-codex.sh` — FORK byte-for-byte → `blind-floor-judge.sh`.
- `emit-receipt.mjs` + `schemas/receipts/` — REUSE (new schema only, zero code change).
- `mine-receipts.mjs` — reuse pure/run-twice-golden pattern; (v2) extend for per-skill scorecard; invert direction (fail-closed toward keep).
- `pre-post-validation-loop` — strongest porting candidate for baseline-then-classify + evidence+validator shape.
- `check-chain-receipts.mjs` — EXTEND (post-shadow) for BLOCK + forged-verdict fence (mirror WI-385 family re-derivation, WI-396 tree-bind).
- `evolve-framework` — (v2) route rot/durable signals into existing demotion-list / learning-fires thresholds.

## Honest limits (must be accepted, not papered over)
1. **Contaminated baseline:** same Opus authors B and F; stripped-prompt B is not provably framework-free. Logged in `contamination_note`.
2. **REFINE-vs-ALTER is subjective** (no ground truth) → judge-conditional, not proven, for semantic weakening.
3. **Verbosity bias** survives cross-family judging → mitigated by tie-to-blind + "longer ≠ better".
4. **Cost numbers are hypotheses** until shadow mode measures them; ~1.5× amortized is unproven.
5. **Judge-absence is the common solo-host path** → gate generation on judge availability first.
6. **No eval corpus exists yet** → WARN-only until planted-negative fixtures provably fail in CI (promoting to BLOCK before that would be the false-green class the repo punishes).

## Scope discipline (skeptic: ~70% cut)
v1 = provable core only: best-of-2 retention + deterministic no-LLM coverage diff + ship-blind-on-no-win + WARN-mode receipt + the two must-fail negative fixtures. Defer scorecard, rot/upgrade sentinels, outcome-join, BLOCK flip. A single green proof is an existence proof, NOT a population claim that "framework earns its tokens."

See `docs/specs/work-items/WI-410.md` for the spec, ACs, and resolved open-question decisions.

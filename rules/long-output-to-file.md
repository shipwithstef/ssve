# Rule: Long Outputs Go to File, Summary Goes Inline

When a skill's primary output exceeds the soft threshold (~800 lines OR ~10K tokens), write the full output to disk and emit a compact summary inline. Pure inline output for long artifacts causes "Prompt is too long" failures, transcript truncation, and downstream context burn.

## Soft threshold

- **800 lines** of structured output, OR
- **~10K tokens** estimated (rough heuristic: 1 line ≈ 12 tokens for tabular content; longer for prose)

Below threshold: emit inline as usual. Above threshold: file-first.

## Disk-write convention

Per-skill canonical output paths already declared in each SKILL.md's `outputs.produces`. Use those. Examples:
- `audit-implementation` → `docs/specs/audit-reports/<WI>.md`
- `roadmap-evaluation` → `docs/specs/roadmap.md`
- `research` (analysis mode) → `references/knowledge/<domain>/details/*.md`
- `assess-market-readiness` → `docs/specs/market-readiness.md`

If the skill has no canonical output path, write to `docs/analysis/<skill>-<topic>.md` and document the path in the skill's next SKILL.md edit.

## Summary template

```
**Output:** `<path>` (<n> lines, <date>)

**Headline:** <one sentence — the load-bearing finding>
**Key points:**
- <bullet 1: most important detail>
- <bullet 2: most important detail>
- <bullet 3: most important detail>
**Next:** <one-line action or link to next skill>
```

The summary is what the user sees inline; the file path is the authoritative source. Future agents reading the conversation can `Read` the file when they need detail; otherwise they work from the 3-bullet abstract.

## When the rule applies

✅ **Apply** to:
- Audit reports, journey docs, research extractions, ranked lists, comparison matrices
- Knowledge-base writes (CAPABILITIES.md, details/)
- Generated specs, plans, roadmaps with > 800 lines

❌ **Do not apply** to:
- Interactive Q&A — the user expects the answer in the conversation
- Short verdict outputs (PASS/FAIL, single recommendation, status checks)
- Code edits — the diff IS the output
- Tool-call results — those are read once and discarded by the harness

## Why this exists

WI-076 close-out failed with "Prompt is too long" when a skill emitted its full audit inline. Multiple sessions had transcripts truncated mid-output. Promoted from WI-099 T2-A → WI-128. The cost of a file write + 3-bullet summary is trivial; the cost of a wedged session is high.

## How a reviewer enforces this

`review-gate` and `audit-implementation` should flag any new SKILL.md whose Process section instructs the skill to emit > 800 lines inline without a file-write step. Severity: MEDIUM — fix before merge unless the output is genuinely interactive.

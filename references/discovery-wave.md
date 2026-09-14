# Discovery triple fan-out (WI-387)

Greenfield discovery runs `analyze-domain → analyze-competitors → build-personas →
catalog-domain-capabilities` strictly serially. But the first three each require
ONLY `vision.md` (verified frontmatter; cross-refs optional) and write **disjoint**
paths — there is no true data dependency forcing the queue. This runs them as one
concurrent wave, cutting discovery wall-clock ~55%.

This is **mutating** parallel work, now permitted on isolated/worktree transport
per the S5 policy (`references/workflow-fanout-protocol.md`, recorded 2026-06-09).

## The wave
| Wave | Skills | Inputs | Write-scopes |
|---|---|---|---|
| **1 (concurrent)** | analyze-domain ∥ analyze-competitors ∥ build-personas | only `vision.md` | `domain-profile.md` / `analyze-competitors.md` (+`.data.json`) / `personas/` |
| **2 (after merge)** | catalog-domain-capabilities | competitors + domain | reads only |

## The hard safety fence (AC1)
The disjoint-write guarantee is the ONLY thing keeping concurrent mutation safe.
**Before dispatching wave 1, run the fence** — it FAILS CLOSED on any pairwise
write-scope intersection:
```bash
node scripts/discovery-wave-fence.mjs            # exit 1 on any overlap
node scripts/discovery-wave-fence.mjs --json     # the wave plan + verdict
```
Wave 1 is dispatched via **`dispatch-waves`** worktree transport (host-neutral,
checkpoint-capable) — **NOT** native `pipeline()`/`parallel()`, which is
research-preview, Claude-only, and cannot host the `human_checkpoint` join (AC1).

## Gates preserved (AC2)
- `validate-feature` (human_checkpoint) still gates the MERGED discovery — it reads
  all three artifacts; the wave does not bypass it.
- `catalog-domain-capabilities` runs as wave 2, reading competitors + domain after
  the wave-1 merge.

## The honest caveat (AC3)
Concurrent competitor/persona scans **lose the serial `domain-profile.md` context**
that the sequential order gave them (analyze-competitors and build-personas could
read a freshly-written domain-profile). This is a **soft, non-gate-violating quality
cost**, not a correctness bug: both skills still have `vision.md`, and
`validate-feature` + the catalog (wave 2, which DOES see the merged domain-profile)
re-reconcile. Stated, not hand-waved. A run that needs the serial domain context for
a deeply domain-coupled persona set should opt out and run serially.

## Not touched
`DOCTRINE.md:667-669` (the discovery sequence prose) is intentionally NOT edited —
the wave is an opt-in transport optimization gated by the fence, not a doctrine
rewrite.

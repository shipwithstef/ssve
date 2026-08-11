# Research Source-Heuristics Mechanism

The `research` skill already compounds **facts** (`CAPABILITIES.md`: "fintech has
PCI-DSS"). It does NOT compound **source-quality judgment** — *where* truth lives per
domain and *what* lies to it. This file defines a third knowledge layer, **sibling to facts,
not mixed into them**, plus the read-before / write-after loop that turns one painful lesson
into permanent senior instinct.

This is the mechanism the `researcher` role-agent owns and the `research` skill reads in
Step 2a and writes in Step 6.

## Location

```
references/knowledge/<domain>/source-heuristics.jsonl   ← per-domain, sibling to CAPABILITIES.md + .sources.jsonl
references/knowledge/source-heuristics.global.jsonl      ← domain-agnostic rules
```

- It is **LIBRARY layer** (`references/knowledge/`), never `docs/specs/`. Source-trust in
  fintech holds for every fintech project, so it compounds across projects exactly as
  `CAPABILITIES.md` does.
- The **global** file holds domain-agnostic rules, e.g. "a vendor's own pricing page beats
  any third-party summary of it."
- **Append-only JSONL, atomic writes, no lone double-quoted single-space literals** (the
  NUL-byte quirk — use printable separators on any hot-path string).

## Schema (one record = one source-quality heuristic)

```json
{
  "id": "fintech-pci-001",
  "domain": "fintech",
  "claim_class": "compliance-requirement",
  "rule": "Never trust a blog/SaaS-vendor post for a PCI-DSS requirement. Resolve to the PCI-DSS spec (pcisecuritystandards.org) or a QSA-authored doc.",
  "trusted_source": {
    "kind": "primary-spec",
    "locator": "pcisecuritystandards.org/document_library",
    "beats": ["vendor-blog", "marketing-page", "stackoverflow"]
  },
  "distrust_signal": "blog asserts a specific PCI control number without quoting the spec version",
  "evidence": [
    {"date": "2026-05-02", "what": "blog claimed SAQ-A covers stored PANs; spec contradicted", "outcome": "averted-wrong-arch"}
  ],
  "confidence": 8,
  "polarity": "negative",
  "hits": 3,
  "last_fired": "2026-06-10",
  "last_verified": "2026-06-10",
  "source": "observed"
}
```

### Field semantics

| Field | Meaning |
|---|---|
| `id` | `<domain>-<claim_class-slug>-<NNN>`, stable. |
| `domain` | The knowledge domain (matches the `references/knowledge/<domain>/` dir). |
| `claim_class` | **The routing key.** Trust is per *(domain, claim-class)*, not flat — in `js-api` a tutorial is fine for "render a list" but worthless for "exact `useEffect` cleanup signature" (repo types beat it). Values ∈ {api-signature, version-behavior, compliance-requirement, perf-characteristic, security-control, pricing, conceptual-overview, …}. |
| `rule` | One sentence: the actionable instinct. |
| `trusted_source.locator` | Where to go DIRECTLY for this claim-class. |
| `trusted_source.kind` | The tier-class of that source (primary-spec, vendor-docs, repo-types, …). |
| `trusted_source.beats` | **Encodes the ordering** (the actual instinct) — the source-kinds to SKIP because this one outranks them for this claim-class. |
| `distrust_signal` | The observable red flag that, when seen during extraction, means "treat this source as unreliable for this claim-class." |
| `evidence[]` | Episodic record: `{date, what, outcome}`. A found contradiction is the highest-value entry. |
| `confidence` | 1–10. **Identical model to `learnings.jsonl`** — bump on agreement, decay on contradiction, bounded. |
| `polarity` | `positive` (this source is trustworthy here) or `negative` (this source-kind lies here). |
| `hits` | Times the heuristic has fired. |
| `last_fired` | Last time it routed an investigation. |
| `last_verified` | Last time the trust itself was re-confirmed live. Answers the `stored-knowledge-decay` scar (confidence 10): **source-trust decays too.** A heuristic past its window unverified drops to advisory. |
| `source` | `observed` (earned from a real bet) or `stated` (seeded by a human). |

## Read-before (skill Step 2a / agent step 2)

> For each open question's `(domain, claim_class)`, read `source-heuristics.jsonl` (+ the
> global file), filter `confidence ≥ 7`. For each match: go DIRECTLY to
> `trusted_source.locator`, SKIP the sources in `beats`, and carry `distrust_signal` as an
> active red flag during extraction.

The compounding payoff: the second fintech investigation never re-pays the cost of learning
that blogs lie about PCI — it routes straight to the spec. Junior behavior (broad search,
trust the top result) is mechanically replaced by senior behavior (targeted source,
pre-loaded skepticism) **on read**.

A heuristic whose `last_verified` is older than the staleness window for its `claim_class`
(mirroring `references/knowledge-protocol.md` Staleness Model: pricing/version 7d, domain
30d) is **advisory only** — it suggests a starting point but must be re-confirmed before it
routes blindly.

## Write-after (skill Step 6 / agent step 6) — gated so the loop stays honest

1. **Capture the bet, always (episodic).** Every time a source is chosen and a verification
   step confirms/refutes it (the skill already has adversarial verification + `.sources.jsonl`),
   append/update a heuristic with `polarity` + an `evidence` entry. A found contradiction
   (blog said X, spec said not-X) is the highest-value write.
2. **Promote only on a real signal (≥2 survivals at the bar).** Until a real confirm/refute
   exists, do NOT fabricate trust (the "loop is inert until a real signal" rule, ported from
   ad-strategist).
3. **Decay on contradiction.** Trusted source later found wrong → decrement `confidence`,
   stamp `last_verified`; below 4 it stops routing. At `confidence ≥ 8` with `hits ≥ 3` it
   becomes a candidate `rules/` correction rule (per `rules/learning-preload.md`), e.g.
   "fintech compliance claims: spec-only."

## Worked example (the two-investigation arc)

**Investigation 1 — first fintech PCI question (cold, no heuristic):**
1. Read: no `fintech/source-heuristics.jsonl` match → broad discovery.
2. A vendor blog claims "SAQ-A covers stored PANs." The skill triangulates against the
   PCI-DSS spec (T1) → the spec contradicts the blog.
3. Write-after: append `fintech-pci-001` with `polarity:negative`, `confidence:5` (one
   real refute), `evidence:[{… "outcome":"averted-wrong-arch"}]`, `trusted_source.locator`
   = the spec, `beats:["vendor-blog",…]`, `distrust_signal` set.

**Investigation 2 — second fintech PCI question (warm):**
1. Read Step 2a: `fintech-pci-001` matches `(fintech, compliance-requirement)`. If its
   `confidence ≥ 7`, route DIRECTLY to `pcisecuritystandards.org/document_library`, skip the
   vendor blogs entirely, and flag any blog that "asserts a control number without quoting
   the spec version."
2. The spec confirms the requirement → write-after bumps `confidence` (now ≥2 survivals →
   crosses the promotion bar), increments `hits`, stamps `last_fired`/`last_verified`.
3. Net: the cost of learning "blogs lie about PCI" was paid ONCE; every later fintech
   compliance question inherits the instinct for free.

## Enforcement seam

- `references/knowledge-protocol.md` "Who Uses This" table gains a column: every researching
  skill that writes `CAPABILITIES.md` must also consider `source-heuristics.jsonl`.
- Integrity checks (JSONL well-formedness; `confidence` within 1–10 bounds; `last_verified`
  staleness; the self-contradiction guard — **no heuristic routes its `trusted_source.locator`
  to a source-kind listed in its own `beats`**) are enforced by the **`researcher` agent on
  every write-after** (it owns the ledger). A dedicated `validate-source-heuristics.sh` tier-1
  validator is a **DEFERRED follow-up**, not shipped here — it would need a tier-1 promotion
  case (the failure class has not yet recurred), per `rules/tier-1-promotion.md`. Until then
  the agent self-enforces and `manage-learnings` discipline applies.

## Overlap map (no duplicate skills)

- **Wields** `research` / `deep-research`; does not duplicate them.
- **Sibling to `analyze-domain`** — that builds *fact* expertise in `domain-profile.md`; this
  builds *source-trust* expertise. `analyze-domain` becomes a natural consumer.
- **Reuses `manage-learnings`** confidence model + 3-fires elevation rather than forking a
  parallel system.

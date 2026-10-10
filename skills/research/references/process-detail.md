### Step 4: Source Credibility & Triangulation (during extraction)

Assign every source a tier BEFORE using it. Higher tier = higher evidentiary weight.

| Tier | Class | Examples |
|------|-------|----------|
| T1 | Primary / official record | spec (RFC/W3C/ECMA), source code + CHANGELOG, official API ref for the EXACT version, the actual commit/PR |
| T2 | Authoritative secondary | maintainer/vendor docs, peer-reviewed paper, record-keeping journalism, maintainer conference talk |
| T3 | Reputable expert community | accepted high-score SO answer, recognized practitioner deep-dive, company eng blog, authority's book |
| T4 | General reputable secondary | mainstream tech press, tutorials w/ named author + citations, aggregators that LINK sources |
| T5 | Weak / unverified | anonymous/undated blog, forum comment, marketing copy, no outbound citations |
| T6 | AI-generated / unattributed | LLM output (incl. this model's prior claims), AI-summary snippets, no discoverable origin |

Version-match is part of tier: an official doc for the WRONG version is demoted to T4.

**Load-bearing claim** = deliverable correctness depends on it (API signature/behavior,
version, security/compliance, perf number, "recommended/only way", cost). Opinion,
illustration, and background are NOT load-bearing.

**Fast path (quick single-fact lookup — the common case):** if ONE authoritative
T1/T2 source answers the question directly (registry version, official CHANGELOG,
spec, the actual API ref for the exact version) and the fact is not high-stakes
(security/compliance/cost) or contested, **assert it with a one-line log** (claim +
source + `[as-of <date>]`) and SKIP the triangulation apparatus below. A senior
doesn't triangulate "what's the current axios major" — one trip to the npm registry
is the senior answer. Triangulation (the full rule below) applies to load-bearing
claims that are high-stakes, surprising, or where the first source is below T2.

**Triangulation (load-bearing + high-stakes/contested only):**
1. Require ≥2 **independent** sources before asserting. "Independent" (citogenesis test):
   they do NOT trace to the same origin — NOT independent if both paraphrase the same
   release/paper/upstream doc, one mirrors/translates/AI-summarizes the other, both are
   Wikipedia + a source citing that same text, or same author/org.
2. One T1 primary MAY stand alone IF it is THE definitional authority (lang spec for syntax,
   source code for behavior) AND you traced to the real primary — record as
   "T1-primary, single-source-justified."
3. Read laterally (SIFT): leave the page, check the author/org's reputation, cite the ORIGIN
   not the aggregator. A claim asserted only from T5–T6 is never load-bearing → tag
   `[UNVERIFIED]` and confirm at ≥T3 or drop.
4. Log per load-bearing claim in the research log: claim, source URLs+tiers,
   independence-verified (Y/N + why), trace-to-origin result.

**[CONTESTED] convention** — when independent sources disagree, do NOT silently pick one:
prefix the claim `[CONTESTED]` and record each position with source+tier+as-of. Resolution
order: (a) higher tier wins; (b) tie → closest to primary; (c) genuine current disagreement
among ≥T2 → leave `[CONTESTED]` in the deliverable. A lone T5/T6 dissent vs a T1/T2
consensus is a minority view, not a contest. All-T5/T6 support = `[UNVERIFIED]`, not
`[CONTESTED]`.

### Step 5: Log the Finding

Append to `docs/specs/research-log.md` (create if absent):

```markdown
## YYYY-MM-DD: [Question]

**Asked by:** [skill name or "standalone"]
**Context:** [what was being done when this came up]
**Finding:** [the answer, with specifics]
**Source(s):** [URL or file path — with tier per source]
**Triangulation:** [≥2 independent / T1-primary single-source-justified; independence note]
**Confidence:** high | medium | low
**Volatility:** volatile | stable
**As-of date:** [date verified live — only for volatile facts]
**Re-verify after:** [as-of + window: pricing/latest-version/deprecation = 7d; active library minor line = 30d; major-version conventions = next major; language semantics = no expiry]
**Version-specific:** [yes/no — does this only apply to version X?]
**Routed-to:** [deep-research, if escalated — else omit]
```

On a cache hit past `Re-verify after`, the entry is a LEAD, not an answer — re-ground first.

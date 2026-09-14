# Knowledge Extraction Protocol

Every skill that researches something external follows this protocol.

## Two Storage Layers

Knowledge lives at two levels. Don't confuse them.

```
references/knowledge/     = LIBRARY (reusable across all projects)
  "I know fintech has PCI-DSS requirements"
  "I know Uptime Kuma has 45K stars and is self-hosted"
  "I know GSD has 65 workflows"

docs/specs/               = PROJECT APPLICATION (this project's specific context)
  "THIS product's domain profile — fintech for SMBs"
  "THIS product's top 5 competitors and our whitespace"
  "THIS product's research findings"
```

**The flow:** skill reads LIBRARY first → fills gaps with fresh research →
writes PROJECT APPLICATION for downstream pipeline skills.

Example for analyze-domain:
1. Read `references/knowledge/domains/fintech/CAPABILITIES.md` (library — what we know about fintech generally)
2. If it exists and is fresh: use it as the base, don't re-research the basics
3. Apply it to THIS project: what matters for THIS product in fintech
4. Write `docs/specs/domain-profile.md` (project application)
5. If the library entry didn't exist or was stale: write/update it too (compound for next project)

## Who Uses This

| Skill | Researches | Library path | Project path |
|---|---|---|---|
| `analyze-domain` | Industry, conventions | `knowledge/domains/<domain>/` | `docs/specs/domain-profile.md` |
| `analyze-competitors` | Market players | `knowledge/competitors/<name>/` | `docs/specs/analyze-competitors.md` |
| `blend-external` | Repos, frameworks | `knowledge/<repo>/` | (no project path — framework-level) |
| `research` | APIs, patterns, questions | `knowledge/domains/<topic>/` | `docs/specs/research-log.md` |
| `discover-skills` | External skills | `knowledge/skills/<name>/` | (no project path) |
| `find-opportunity` | Market opportunities | (needs FRESH data — see below) | `docs/specs/opportunities/` |
| `mine-builder` | Builder context | (not knowledge — personal) | `~/.svc/builder-profile.md` |

**Note:** `references/domains/<stack>/conventions.md` (code conventions for
execute-changeset) is a DIFFERENT thing from `references/knowledge/domains/`
(industry knowledge). One tells you HOW to code. The other tells you WHAT
the industry looks like.

## Before Researching: Check What's Known

```bash
cat references/knowledge/INDEX.md 2>/dev/null
```

If the subject has a Layer 2 entry AND it's fresh → use it, don't re-research.
If it's stale → update, don't rebuild from scratch.
If it doesn't exist → full 4-pass protocol.

## Staleness Model

Different knowledge types go stale at different rates.

| Type | .version format | Stale after | Why |
|---|---|---|---|
| **Open source repo** | Git SHA | SHA changes | Code is truth — if SHA is same, nothing changed |
| **Stack conventions** | `react@19.1` | Major version changes | Conventions are stable within versions |
| **Domain expertise** | Date | 30 days | Industries shift slowly |
| **Competitor data** | Date | 7 days | Competitors launch/change weekly |
| **Market data** (find-opportunity) | Date | 3 days | Revenue signals are highly volatile |
| **Closed source product** | `v3.2.1 https://changelog-url` | New changelog entry | Check URL for new version |

**Update protocol:**
- Repo: `git ls-remote <url> HEAD` → compare to .version → if same, skip
- Repo changed: `git diff <old>..<new> --stat` → only re-read changed files
- Date-based: compare .version date to today → if within window, skip
- Product: fetch changelog URL → scan for new version → update only changed capabilities

## The 4-Pass Protocol

### Pass 1: SHAPE (~2 min, <500 tokens)

Understand the structure without reading content.

**For repos:**
```bash
git clone --depth 1 <url> /tmp/<name>
find /tmp/<name> -maxdepth 2 -type f | sort | head -50
head -50 /tmp/<name>/README.md
cat /tmp/<name>/package.json 2>/dev/null | head -10
```

**For products/services:** landing page or docs index — what it does, who it's for.

**For domains:** WebSearch `"<domain> landscape 2026"` — major players, patterns.

**Output:** one-liner for INDEX.md + structure map (working context, not stored).

### Pass 2: FRONTMATTER SCAN (~10 min, ~20 tokens per item)

Extract what each component DOES without reading HOW.

**For repos:**
```bash
for f in $(find /tmp/<name> -name "SKILL.md" -o -name "*.md" -path "*/agents/*" -o -name "*.md" -path "*/workflows/*"); do
  echo "=== $(basename $(dirname $f))/$(basename $f) ==="
  head -10 "$f"
  echo ""
done
```

**For products:** feature list / pricing page / docs sidebar.

**For domains:** key tools, stacks, regulatory requirements, user expectations.

**Output:** CAPABILITIES.md in `references/knowledge/<source>/`.

**CAPABILITIES.md size rule:** keep it under 200 lines. One sentence per
capability, grouped by area. This is the INDEX — not the explanation.

**Layer 3 is the full explanation.** One file per area, created during
the SAME analysis pass — not "on demand later." The whole point of
research analysis mode is FULL knowledge assimilation: extract everything
once, persist it, never re-read the source.

```
references/knowledge/<source>/
├── CAPABILITIES.md              ← Layer 2: what it does (under 200 lines)
├── .version                     ← SHA or date
└── details/                     ← Layer 3: how each area works (FULL)
    ├── <area-1>.md              ← complete extraction of area 1
    ├── <area-2>.md              ← complete extraction of area 2
    └── ...                      ← one per area, all created during analysis
```

**Layer 3 detail file structure — each file has three sections:**

```markdown
# <Source> <Area> — Detail

## Mechanism (factual)
<What it does and how. Extracted from source. Objective.>

## Analysis (expert commentary)
- **Useful for:** <when/why you'd use this pattern>
- **Trade-offs:** <what you give up by doing it this way>
- **Similar to:** <patterns in other systems — GSD, gstack, svc, etc>
- **Could improve svc by:** <if applicable — how this informs our work>
- **Assumptions:** <what the design assumes about usage, scale, context>
- **Watch out for:** <gotchas, hidden complexity, things that look simple but aren't>

## Key Source Files (L4 pointers)
- `src/path/file.go:42` — <what this file does>
- `src/path/other.go:118` — <what this file does>
```

The Analysis section is what makes this EXPERTISE, not documentation.
An expert doesn't just know WHAT — they have opinions about WHY it matters,
WHEN it's useful, and WHERE it connects to other things they know.

**Analysis protocol:**
1. Pass 1-2: shape + frontmatter scan → write CAPABILITIES.md
2. For EACH area in CAPABILITIES.md: read the relevant source files,
   extract the full mechanism + analysis + L4 pointers into `details/<area>.md`
3. Commit after each area (progress is saved incrementally)
4. When all areas are extracted: the knowledge is complete. Your detail
   files replace the source — you only go back for specific code (L4).

**Model:** Sonnet, medium effort. This is mechanical extraction — reading and
summarizing, not designing. Opus is overkill. Save Opus for blend decisions
and creative work.

**Commit cadence:** commit after CAPABILITIES.md, then after each
details/ file. If the session is interrupted, partial knowledge is
already persisted. Resume by checking which detail files exist vs
which areas CAPABILITIES.md lists.

**When Layer 3 isn't enough:** go to the original source repo for actual
code, function signatures, edge case handling. Your knowledge files tell
you WHERE to look — which file, which module, which function. You don't
re-read the whole repo. You read one targeted file.

```
Layer 1: INDEX.md            → knows it exists, one line       (~10 tokens)
Layer 2: CAPABILITIES.md     → knows what it does, per area    (~500 tokens)
Layer 3: details/<area>.md   → knows how each area works       (~1K tokens each)
Layer 4: original repo code  → actual implementation detail    (on demand, targeted)
```

Layers 1-3 = your assimilated knowledge. Persisted, versioned, instant.
Layer 4 = the source. Only when you need code-level detail that summaries
can't capture. Your Layer 3 tells you exactly which file to read — so
even Layer 4 access is targeted, not exploratory.

### Pass 3: COMPARE (~5 min, reads two small files)

Only relevant for comparative research (blend, competitor, opportunity).

Read our Layer 2 vs their Layer 2. Identify:
- What they have that we don't
- What we have that they don't
- What they do better / worse

**Output:** comparison section in CAPABILITIES.md or separate COMPARISON.md.

### Pass 4: DEEP DIVE (on demand only)

Read full files ONLY for items from Pass 3 worth taking/understanding.

**Trigger:** "I need to understand HOW they implement X"
**Not triggered by:** "I need to know IF they have X" (that's Pass 2)

**Output:** Layer 3 detail file at `knowledge/<source>/details/<topic>.md`

## Storage Format

```
references/knowledge/
├── INDEX.md                          ← Layer 1: always loaded
├── knowledge-protocol.md             ← this file
├── <repo>/                           ← analyzed repos (blend-external)
│   ├── CAPABILITIES.md               ← Layer 2
│   ├── .version                      ← Git SHA
│   └── details/                      ← Layer 3 (on demand)
├── domains/                          ← industry expertise (analyze-domain)
│   ├── TEMPLATE.md
│   └── <domain>/
│       ├── CAPABILITIES.md           ← Layer 2
│       └── .version                  ← date
├── competitors/                      ← market players (analyze-competitors)
│   ├── TEMPLATE.md
│   └── <competitor>/
│       ├── CAPABILITIES.md           ← Layer 2
│       └── .version                  ← date (stale after 7 days)
└── skills/                           ← external skills (discover-skills)
    └── <skill>/
        ├── CAPABILITIES.md
        └── .version

references/domains/<stack>/           ← CODE CONVENTIONS (different system!)
├── conventions.md                    ← how to code in this stack
└── testing.md                        ← how to test in this stack
```

## Rules

1. **Never launch an explore agent for a known source.** Read Layer 2 first.
2. **Never read full files in Pass 2.** `head -10` only.
3. **Never store Layer 3 without Layer 2 existing.** Depth requires breadth.
4. **Never skip Pass 1.** Shape before detail.
5. **Always write to knowledge/ after researching.** Unpersisted research = wasted tokens.
6. **Always update .version.** Staleness detection needs it.
7. **Library before project.** Read `references/knowledge/` before writing `docs/specs/`.
8. **Don't duplicate.** The library has the general knowledge. The project file has the application. Don't put general knowledge in project files.
9. **Match staleness to type.** Competitor data stales in 7 days, not 30.
10. **`head` before `cat`.** 10 lines tells you WHAT. 500 lines tells you HOW. You usually need WHAT.

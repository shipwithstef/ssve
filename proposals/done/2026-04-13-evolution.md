# Framework Evolution — 2026-04-13

**Status:** IMPLEMENTED (P1 — 2026-04-13 via `improve-framework`; P2 + P3 DEFERRED per FRAMEWORK-STATE.md analysis entry).

## Method

Scoped evolution driven by a single user request: a skill to research and blend
from **private** repos (user's own, or ones the user has rights to) without
leaving traces back to the source, producing changes that are "slight mods" —
neither breaking nor deteriorating quality.

Evidence sourced from:
- `blend-external/SKILL.md:10-16` — existing blend inputs assume public source
  with `NOTICES` + `references/blend-registry.json` attribution
- `blend-external/SKILL.md:451-472` — Rules explicitly mandate license check,
  permissive-only, and attribution via NOTICES
- `extract-bootstrap/SKILL.md:44-55` — acquires source via `git clone` or
  `gh api` (public-oriented), no private-auth or redaction posture
- `research/SKILL.md` — web/public research, not codebase extraction
- `references/blend-registry.json` schema (blend-external:407-436) — `url`,
  `author`, `license` fields all assume public, attributable sources
- No matches in `FRAMEWORK-STATE.md` for "private repo", "attribution",
  "anonymize", "launder", "source-obfusc*" — this is a genuine gap, not
  rediscovery

## Findings (by priority)

### P1 — Fix soon (degrades quality)

**Gap: no blend path for private/owned sources.**

**Evidence:**
- `blend-external/SKILL.md:10-15` hard-requires `references/blend-registry.json`
  and `NOTICES` as inputs/outputs. Both assume a publicly attributable source.
- `blend-external/SKILL.md:453-454`: *"Respect licenses. Only blend from repos
  with permissive licenses (MIT, Apache 2.0, BSD). If the source has a
  restrictive license, stop and tell the user."* This is correct posture for
  external third-party repos, but it blocks the legitimate case where the user
  is the author/owner of the source repo (private personal or company repo)
  and simply wants to reuse their own patterns in svc without leaking private
  identifiers (internal service names, proprietary domain terms, client
  identifiers, company-specific infra).
- `extract-bootstrap/SKILL.md:47-50` clones with `git clone --depth 1 <url>`
  — no auth flow, no private-repo workflow, no redaction step.
- `blend-external/SKILL.md:297` always writes `proposals/<date>-blend-<source-name>.md`
  — the filename itself would leak the source name.
- `blend-external/SKILL.md:439-449` always updates NOTICES and registry — no
  "private source, no-attribution" branch exists.

**Failure mode today:** A user with a rich private codebase (their own startup,
consulting work, archived projects) has no supported path to port patterns into
svc. They either (a) bypass the framework entirely and hand-edit skills —
losing the rigor of the blend pipeline, or (b) force `blend-external` and end
up writing private identifiers into NOTICES, `blend-registry.json`, and
proposal filenames that then land in a public repo.

**Specific fix — new skill: `blend-private`.**

Sibling to `blend-external`, not a branch inside it. Reasons for a new skill
rather than a mode:
1. Different inputs (requires authorization gate, not a license check)
2. Different outputs (no NOTICES, no blend-registry entry, redacted proposal
   filename and body)
3. Different rules (redaction invariant replaces attribution invariant)
4. Different exit posture (post-merge verification that no source identifiers
   leaked into the tree)

**Skill shape:**

```yaml
name: blend-private
description: >
  Blend patterns from a private repo the user owns or has rights to, into svc,
  without leaving source identifiers in the tree. Use when "blend from my
  private repo", "take this pattern from <internal>", "extract from my own
  code", or when pointing at a private/internal source where attribution is
  not required and source identifiers must not appear in the svc repo.
inputs:
  required:
    - { path: "FRAMEWORK-STATE.md", artifact: framework-state }
    - user-asserted authorization (see Phase 0)
outputs:
  produces:
    - { path: "proposals/<date>-blend-internal-<slug>.md", artifact: blend-plan }
chain:
  lanes:
    framework: { position: 3 }
  progressive: false
  self_verify: true
  human_checkpoint: true
```

**Process (what differs from blend-external):**

- **Phase 0 — Authorization gate.** Before any read, the skill asks the user
  to confirm in one of three categories: (a) *I am the sole author*,
  (b) *I have explicit rights from the owner to reuse patterns*, (c) *This is
  my employer's repo and my employment agreement permits pattern reuse*. If
  the user cannot assert one of the three, the skill STOPS. This is a
  first-class gate, not a rule-at-the-end. Record the user's assertion in the
  proposal's `## Authorization` section verbatim. This is the safety fence
  that prevents the skill from being a code-laundering vector.

- **Phase 1 — Acquire with redaction map.** Before analysis, build an
  identifier redaction map: repo name, org/owner, internal service names,
  proprietary domain terms, client names, private URLs, credentials patterns,
  internal Jira/Linear IDs. Source this from the user ("what strings must not
  leak?") plus grep of the source for common private markers (`*.internal`,
  `company.com`, hardcoded org names). The redaction map is the invariant
  that every later artifact must respect.

- **Phase 2 — Extract patterns only.** No verbatim code. Every blend item is
  a *pattern description* — the mechanism, the shape of the solution, the
  structural idea. This is already `blend-external`'s stance (line 456–458:
  "Do not take code verbatim... Take patterns, approaches, and ideas") but
  here it's a hard requirement enforced at self-verify time, because there's
  no license to fall back on.

- **Phase 3 — Produce redacted blend plan.** Same 5-section structure as
  `blend-external` Phase 3 (problem today / how source solves it / what
  changes / what NOT to take / why it matters) BUT:
  - Filename: `proposals/<date>-blend-internal-<pattern-slug>.md`. Never
    include source repo name.
  - `## From / Into` becomes `## Pattern origin / Into` — describes the
    pattern abstractly, not the source repo.
  - "How the source solves it" uses generic role nouns ("the origin codebase",
    "a production system") never the repo/org name.
  - Redaction check: grep the draft proposal against the redaction map
    before saving. If any map entry matches, fail self-verify.

- **Phase 4 — "Slight mod" adaptation rule.** The user's request specifies the
  blend should read as a *slight modification* of svc's existing skill, not
  a wholesale paste. Enforce this with two quantitative checks in self-verify:
  1. Target svc file diff size must be < 30% of the target file's line count
     (blends that rewrite a skill wholesale from a single private source are
     a red flag — they suggest either that svc already had this and the blend
     is redundant, or that the pattern is too large to adopt safely without
     degrading).
  2. Every changed section must cite an existing svc anchor (section header,
     numbered step) that it modifies or extends — no net-new top-level
     sections without explicit `NEW SECTION:` marker and rationale.

- **Phase 5 — No registry, no NOTICES, but a local audit trail.** Skip the
  blend-registry and NOTICES updates. Instead, write a local, gitignored
  `.svc/private-blends.log` (add `.svc/` to `.gitignore` if not present)
  with: date, authorization category, pattern slug, target svc file, line
  count delta, redaction map hash. This gives the user a local ledger for
  their own records without committing source-identifying data.

- **Phase 6 — Post-apply leak check.** After the proposal is implemented (in
  `improve-framework` or direct edits), run a final grep of the full svc tree
  against the redaction map. If any identifier appears, fail with a pointer
  to the file:line so the user can fix before commit.

**Hybrid opportunity vs `blend-external`:**

Neither skill alone covers the matrix. `blend-external` = attribution-mandatory
for public/third-party sources. `blend-private` = redaction-mandatory for
private/owned sources. Together they cover the full source-type quadrant. The
shared machinery (dimensional comparison, Phase 2c hybrid questions, 5-section
blend items, self-verify structure) should be factored into a shared reference
(`references/blend-protocol.md`) that both skills cite, so changes propagate.
This refactor is out of scope for this proposal but should be a follow-up.

**Quality invariants that must hold (the user's "not breaking, not deteriorating"
clause):**

1. Every blend item must show the specific svc anchor it modifies.
2. The diff must pass existing tier-1 evals (`skills-manifest.json` lint,
   contract validation, chain-reference validation) before the proposal is
   marked done. This makes "not deteriorating" mechanical, not vibes-based.
3. Self-verify includes: "run `node scripts/lint-skills-manifest.mjs` and all
   `test-framework/evals/tier-1/*.sh` scripts after applying — ALL PASS
   required."

### P2 — Improve when possible

**Shared blend-protocol extraction.**

Factor the common structure of `blend-external` and the proposed `blend-private`
into `references/blend-protocol.md`:
- 5-section blend item structure (`blend-external/SKILL.md:278-296`)
- Phase 2c hybrid opportunity questions (`blend-external/SKILL.md:201-235`)
- Full-dimensional comparison rules (`blend-external/SKILL.md:90-122`)
- Self-verify row set for blend proposals

Both skills then cite the protocol and add their own divergences
(attribution vs redaction). Benefit: when `blend-external` improves its blend
rubric, `blend-private` inherits the improvement. Not actionable until
`blend-private` ships.

### P3 — Track (not actionable yet)

**Cross-project pattern vault.**

Long-term, successful private-blend extractions could accumulate into an
anonymized pattern vault (under `references/patterns/`) — not tied to any
source, just the pattern shape + where svc uses it. This would let future
blend decisions reference "we've seen this pattern 4 times across private
blends, here's how we've been adapting it." Not actionable until
`blend-private` has produced ≥3 blends.

## Comparison delta

Neither `gstack` nor `superpowers` has a parallel to `blend-private` — their
pattern-import stories are public-only. svc adopting this skill would be a
genuine capability ahead of the blended skill packs.

## Stale proposal audit

- `proposals/2026-04-13-rules-as-primitive.md` — same-day proposal, separate
  scope (rules system), not related to this finding. Not stale.
- `proposals/done/` — not walked for this scoped evolution; a full audit would
  be a separate run of `evolve-framework`.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Proposal file exists | `test -f proposals/2026-04-13-evolution.md` | PASS |
| 2 | Every finding cites file:line | blend-external/SKILL.md:10-15, :44-55, :278-296, etc. cited | PASS |
| 3 | FRAMEWORK-STATE.md was checked first | grep'd for private/attribution/trace/anonymize/launder — no hits, confirming gap is new | PASS |
| 4 | Findings ranked by impact | P1 / P2 / P3 columns present | PASS |
| 5 | Scoped proposal honors user intent | Proposal centers on the private-repo blend skill request; other findings are directly downstream of it | PASS |

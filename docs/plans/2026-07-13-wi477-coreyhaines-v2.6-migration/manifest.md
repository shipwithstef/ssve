# WI-477 Change-Set Manifest — coreyhaines addon re-pin v2.6.0 + v2.0.0 rename migration

**Date:** 2026-07-13 (rev 4 — post review-plan rounds 1–3; see `docs/plans/2026-07-13-wi477-coreyhaines-v2.6-migration/review-log.yaml`) | **Lane:** framework | **Risk class:** M
**Execution mode:** inline single-orchestrator (no parallel dispatch; one worktree, one migration commit)
**Spec:** `docs/specs/work-items/WI-477.md` ACs + `proposals/2026-07-13-blend-coreyhaines-v2.6.0.md` § Assessment B
**Rename map (authoritative):** `references/knowledge/competitors/coreyhaines-martech/details/new-skills-v2.0-v2.6.md`

## File set & two-commit strategy (R2-1)

**Commit P (planning artifacts, exempt-class, lands on main BEFORE worktree creation):** `docs/plans/2026-07-13-wi477-coreyhaines-v2.6-migration/manifest.md`, `docs/plans/2026-07-13-wi477-coreyhaines-v2.6-migration/old-name-allowlist.txt`, `docs/plans/2026-07-13-wi477-coreyhaines-v2.6-migration/review-log.yaml` (+ raw review captures + mechanical-gate log in the same dir), `docs/specs/work-items/WI-478.md`, `docs/specs/work-items/INDEX.md` row, `.svc/lane-tasks-WI-477.json`, `.svc/pipeline-decisions.jsonl` appends. Because commit P precedes the worktree branch, the allowlist and plan exist inside the worktree (round-2 finding 1).

**Commit M (migration, in worktree branch `WI-477-coreyhaines-v2-migration` — WI-recognizable per `scripts/worktree.sh` `WI-([0-9]+)` detection):** blueprints #1–29 below. `concerns/REGISTRY.json` changes only via regeneration.

## Scope decisions (judged, not blind-sed)

1. **Skill-name references migrate; artifact paths do NOT.** Upstream v2.6.0 still reads the legacy context filename (project artifact .agents/product-marketing-context.md) as fallback — verified against upstream copywriting/SKILL.md in round 1. Only references to the *skill* `product-marketing-context` become `product-marketing`. Artifact-path migration deferred (zero breakage today).
2. **False positives excluded at OCCURRENCE level** — see `docs/plans/2026-07-13-wi477-coreyhaines-v2.6-migration/old-name-allowlist.txt` (path-prefix + token-regex + reason rows; a file being partially allowlisted no longer hides a missed edit in the same file — round-2 finding 3). Third-party product identifiers (e.g. claude-gtm-plugin@pricing-strategy) are never renamed.
3. **Historical records untouched** — Class A rows in the allowlist.
4. **`agents/` and `.claude/agents/` both edited** — concretely `agents/comms.md`, `agents/revops.md`, `agents/growth-lead.md`, `agents/financial-analyst.md` and `.claude/agents/comms.md`, `.claude/agents/revops.md`, `.claude/agents/growth-lead.md`, `.claude/agents/financial-analyst.md`.
5. **ad-strategist wiring ships as WI-478** (`docs/specs/work-items/WI-478.md`, filed + indexed, with an explicit `ad-strategist→ads` runtime-pointer AC) — satisfies WI-477 AC4's "recorded as follow-on" branch (round-2 finding 5).
6. **concerns/REGISTRY.json is generated** — edit `concerns/pricing-tier-touch.md` + `scripts/seed-phase2-concerns.mjs`, regenerate via `scripts/build-concern-registry.mjs`, then CONTENT-diff assert (old token absent, new token present, no unrelated hunks — round-2 finding 6).

## External State Lifecycle (R1-1, R2-2)

Taxonomy walk per `references/external-state-lifecycle-protocol.md` (all 15 entries):

| # | Environment | This plan | Coupling | Enforcement |
|---|-------------|-----------|----------|-------------|
| 1 | Host filesystem outside repo | **TOUCHED** — central clone ~/.svc/external-skills/marketingskills (v1.9.0 `1bcff9fc` → v2.6.0 `2815104d`) + 5 host symlink farms: ~/.claude/skills 40, ~/.codex/skills **37 (pre-existing drift)**, ~/.gemini/skills 40, ~/.config/opencode/skills 40, ~/.kimi/skills **39 (pre-existing drift)** — counts live-verified 2026-07-13; relink loop heals both drifts to 46 | coupled | flip runs in verify-promotion (post-merge) inside a `trap`-guarded block; any failure auto-restores `1bcff9fc` + old links (Exec step V2) |
| 2 | Host config files | untouched — no settings.json/config.toml edits; skill discovery is directory-based | — | — |
| 3 | Out-of-tree version-controlled | **TOUCHED** — worktree branch WI-477-coreyhaines-v2-migration | coupled | land-changeset removes worktree only after symlink guard passes (learning c10) |
| 4 | Package registries | untouched (no npm/pypi publish) | — | — |
| 5 | Schedulers / persistent jobs | untouched (no cron/routines reference addon names) | — | — |
| 6 | Running services | untouched — live Claude sessions cache the skill list at session start; stale sessions self-heal on restart (decoupled-justified: read-only skill discovery, no crash mode; recovery = new session) | decoupled-justified | monitoring: symlink guard + next-session skill list |
| 7 | External SaaS | untouched (GitHub PR flow is the normal chain) | — | — |
| 8 | Database / migrations | untouched | — | — |
| 9 | Caches | untouched | — | — |
| 10 | DNS / SSL / domains | untouched | — | — |
| 11 | Search / index services | untouched | — | — |
| 12 | Downstream framework artifacts | **TOUCHED** — `skills-manifest.json` arrays (linter-checked 5-file agreement), concern registry (regenerated) | coupled | `node scripts/lint-skills-manifest.mjs` + registry content-diff assert in Exec steps 4/3 |
| 13 | CI/CD wires | untouched (no workflow/check renames) | — | — |
| 14 | Auth / secrets | untouched | — | — |
| 15 | Runtime filesystem state | **TOUCHED** — scan logs under the plan dir; worktree itself | coupled | leftover-disposition at closeout; worktree removed post-verify |

Untouched environments (walked, found nothing): 2, 4, 5, 7, 8, 9, 10, 11, 13, 14.

**Ordering (R2-2):** repo lands FIRST (PR merged to main), THEN the machine-local flip runs as verify-promotion step V2 under a failure trap. The inconsistency window (main renamed / install still v1.9.0) is machine-local, read-only-degraded (old-name skills still resolve until the flip), and bounded to minutes; the reverse window of round-2's concern (install flipped, land fails, no rollback) is eliminated.

**Rollback:** `git revert` of commit M + `git -C ~/.svc/external-skills/marketingskills checkout 1bcff9fc` + re-run relink loop (restores 40 old-name links per farm).

**Alternatives considered (explore-solutions, inline):** (a) checkout-in-place + relink loop — CHOSEN; (b) fresh versioned clone + farm repoint — more state, no benefit single-machine; (c) `npx skills add` per host — loses pin verifiability, breaks EXTERNAL_ADDONS contract. Rejected (b),(c).

## Token map applied (within scoped files only)

page-cro→cro · form-cro→cro (dedupe in lists) · signup-flow-cro→signup · onboarding-cro→onboarding · popup-cro→popups · paywall-upgrade-cro→paywalls · email-sequence→emails · social-content→social · paid-ads→ads · pricing-strategy→pricing · launch-strategy→launch · referral-program→referrals · schema-markup→schema · aso-audit→aso · ab-test-setup→ab-testing · analytics-tracking→analytics · free-tool-strategy→free-tools · competitor-alternatives→competitors · product-marketing-context→product-marketing (skill-name refs only)

## File blueprints

| # | File | Action |
|---|------|--------|
| 1 | `EXTERNAL_ADDONS.md` | Rewrite § coreyhaines: v2.6.0, pin `2815104d`, install/update commands incl. relink loop, 46-skill table, foundation `product-marketing`, interop note (upstream canonical context file is the project artifact .agents/product-marketing.md with legacy-filename fallback; svc keeps writing the legacy name), L12 hook-list renames, 40→46 |
| 2 | `skills-manifest.json` | 9 array renames (~L308, L351, L354, L409-420); lint must pass |
| 3 | `route-workflow/SKILL.md` | L209: cro, popups, signup, paywalls, pricing |
| 4 | `route-workflow/references/hot-path-operational-details.md` | L85-86: same set |
| 5 | `route-workflow/references/routing-rules.md` | L102-104: product-marketing, competitors, cro, launch, signup, onboarding (leave `market-*` aliases) |
| 6 | `route-workflow/references/intent-routing.md` | L141: launch |
| 7 | `_shared/live-evidence.md` | L3, L153, L166: popups, cro (dedupe form-cro), signup, paywalls, onboarding |
| 8 | `build-personas/SKILL.md` | L305-306, L401-404: cro, onboarding, signup, popups |
| 9 | `launch-knowledge/SKILL.md` | L120-121: pricing, launch |
| 10 | `launch-knowledge/references/skill-composition.md` | L12-13, L41-47: pricing, launch |
| 11 | `agents/comms.md` + `.claude/agents/comms.md` | social-content→social; ADD pointers with the EXACT expressions `` `public-relations` `` and `` `social` listening workflow `` — the addon-internal reference file (skills/social/references/listening.md inside the central install) may be named in prose (assertions in Exec step 6 match the two expressions literally) (AC4) |
| 12 | `agents/revops.md` + `.claude/agents/revops.md` | email-sequence→`` `emails` ``; ADD `` `prospecting` `` + `` `sms` `` pointers (AC4) |
| 13 | `agents/growth-lead.md` + `.claude/agents/growth-lead.md` | paid-ads→`` `ads` ``, launch-strategy→launch, social-content→social; ADD `` `marketing-plan` `` + `` `marketing-loops` `` pointers (AC4) |
| 14 | `agents/financial-analyst.md` + `.claude/agents/financial-analyst.md` | pricing-strategy→pricing |
| 15 | `references/company-operating-fleet.md` | L43-44, L247-248 (+ exec-time matches): pricing, ads, launch, social; brain-table lists mirror the agent additions |
| 16 | `concerns/pricing-tier-touch.md` | L28 optional_skills: pricing (source of truth) |
| 17 | `scripts/seed-phase2-concerns.mjs` | L1392 optional_skills: pricing |
| 18 | *(generated)* `concerns/REGISTRY.json` | Regenerated by `scripts/build-concern-registry.mjs`; content-diff assert |
| 19 | `strategic-decision/SKILL.md` | L83: pricing |
| 20 | `assess-market-readiness/SKILL.md` | L358: `/launch` |
| 21 | `ad-video-script/SKILL.md` | L133: `social` (addon) |
| 22 | `generate-visuals/SKILL.md` | L10, L171: social |
| 23 | `landing-page/SKILL.md` | L208: ads; L244: `cro` rubric |
| 24 | `references/knowledge/launch/distribution/INDEX.md` | L29, L31: launch, free-tools |
| 25 | `references/knowledge/launch/distribution/first-100-customers-b2b-saas.md` | L58, L62, L64 (+ exec-time matches): launch, free-tools, ads, ab-testing |
| 26 | `references/knowledge/skill-marketplaces/CAPABILITIES.md` + `references/knowledge/skill-marketplaces/details/monetization-skills-evaluation.md` | Installed-pack mentions: pricing, paywalls; third-party ids unchanged |
| 27 | `analyze-marketing/SKILL.md` | L124 ONLY — skill-name ref → product-marketing; artifact-path lines stay (dedicated assertion, Exec step 6) |
| 28 | `OPEN-PROPOSALS.md` | L18: launch-knowledge/launch |
| 29 | `scripts/capability-concierge.mjs` | L164 rationale template: free-tool-strategy→free-tools (live recommendation string; round-2 finding 3) |

## Execution Command Sequence

```bash
set -euo pipefail
ROOT=/workspace/seriousvibecoding
PLANDIR=docs/plans/2026-07-13-wi477-coreyhaines-v2.6-migration

# 0. commit P (planning artifacts, exempt-class) lands on main FIRST — then:
cd "$ROOT"
bash scripts/worktree.sh create WI-477-coreyhaines-v2-migration
WT="$ROOT/.worktrees/WI-477-coreyhaines-v2-migration"   # confirm actual path from worktree.sh output
cd "$WT"   # ALL subsequent steps run inside the worktree

# 2. blueprints #1-17, #19-29 via occurrence-level Edit (no blind sed)

# 3. regenerate concern registry (#18) + EXACT content assertions (R2-6, R3-7)
node scripts/build-concern-registry.mjs
REMOVED=$(git diff -- concerns/REGISTRY.json | grep -c '^-[^-]')
ADDED=$(git diff -- concerns/REGISTRY.json | grep -c '^+[^+]')
test "$REMOVED" -eq 1
test "$ADDED" -eq 1
git diff -- concerns/REGISTRY.json | grep '^-[^-]' | grep -q 'pricing-strategy'
git diff -- concerns/REGISTRY.json | grep '^+[^+]' | grep -q '"pricing"'
! grep -q 'pricing-strategy' concerns/REGISTRY.json

# 4. manifest lint
node scripts/lint-skills-manifest.mjs

# 5. repo-wide LINE-CONTEXT scan vs allowlist (R2-3, R3-1, R4-3) — gating, empty-or-fail.
#    Full line content is preserved (no -o), so allowlist rows can distinguish third-party
#    identifiers (claude-gtm-plugin@pricing-strategy) from installed-pack mentions on the
#    same file, and artifact filenames (…-context.md) from bare skill names in the same file.
#    Row regex is matched against the LINE CONTENT (everything after path:line:).
TOKENS='page-cro|signup-flow-cro|onboarding-cro|form-cro|popup-cro|paywall-upgrade-cro|email-sequence|social-content|paid-ads|pricing-strategy|launch-strategy|referral-program|schema-markup|aso-audit|ab-test-setup|analytics-tracking|free-tool-strategy|competitor-alternatives|product-marketing-context'
grep -rnE "$TOKENS" --include='*.md' --include='*.json' --include='*.mjs' --include='*.sh' --include='*.js' \
     --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.worktrees . \
  | sed 's|^\./||' \
  | awk 'BEGIN{ FS=":"; while((getline l < "'$PLANDIR'/old-name-allowlist.txt")>0){ if(l~/^#/||l=="")continue; split(l,a,"\t"); px[++k]=a[1]; rx[k]=a[2] } }
      { line=$0; sub(/^[^:]*:[^:]*:/,"",line); ok=0;
        for(i=1;i<=k;i++){ if(index($1,px[i])==1 && line~rx[i]){ok=1;break} }
        if(!ok) print $0 }' \
  > /tmp/wi477-scan-residual.txt
test ! -s /tmp/wi477-scan-residual.txt || { echo "SCAN FAIL:"; cat /tmp/wi477-scan-residual.txt; false; }

# 6. targeted assertions (each a separate simple command — R3-2; exact backticked pointer
#    expressions that CANNOT pre-exist before migration, both mirrors — R3-6, R4-5).
#    Blueprints 11-13 MUST write these exact expressions.
! grep -qE 'coreyhaines `product-marketing-context`' analyze-marketing/SKILL.md
grep -q 'coreyhaines `product-marketing`' analyze-marketing/SKILL.md
grep -qE '`cro`, `popups`, `signup`' route-workflow/SKILL.md
! grep -q 'email-sequence' agents/revops.md
! grep -q 'email-sequence' .claude/agents/revops.md
grep -qE '`emails`' agents/revops.md
grep -qE '`emails`' .claude/agents/revops.md
grep -qE '`prospecting`' agents/revops.md
grep -qE '`prospecting`' .claude/agents/revops.md
grep -qE '`sms`' agents/revops.md
grep -qE '`sms`' .claude/agents/revops.md
grep -qE '`public-relations`' agents/comms.md
grep -qE '`public-relations`' .claude/agents/comms.md
grep -qE '`social` listening workflow' agents/comms.md
grep -qE '`social` listening workflow' .claude/agents/comms.md
grep -qE '`marketing-plan`' agents/growth-lead.md
grep -qE '`marketing-plan`' .claude/agents/growth-lead.md
grep -qE '`marketing-loops`' agents/growth-lead.md
grep -qE '`marketing-loops`' .claude/agents/growth-lead.md
grep -qE '`ads`' agents/growth-lead.md
grep -qE '`ads`' .claude/agents/growth-lead.md

# 7. full tier-1 in the worktree
bash test-framework/evals/run-all-evals.sh --tier1

# 8. chain: review-exec (codex, frozen diff) -> audit-implementation -> land-changeset (PR + squash)
```

**Verify-promotion (post-merge, on main) — machine-local flip; preflight before ANY mutation (R3-2, R3-3, R3-4):**

```bash
set -euo pipefail
MS="$HOME/.svc/external-skills/marketingskills"
FARMS="$HOME/.claude/skills $HOME/.codex/skills $HOME/.gemini/skills $HOME/.config/opencode/skills $HOME/.kimi/skills"

# V0. PREFLIGHT — non-destructive (fetch only ADDS objects; nothing checked out or deleted).
# Baseline is RECORDED, not assumed (R4-6): rollback restores the actual pre-run state.
BASE_SHA="$(git -C "$MS" rev-parse HEAD)"
test -z "$(git -C "$MS" status --porcelain)"                # clone must be clean
printf '%s\n' "$BASE_SHA" > /tmp/wi477-baseline-sha.txt
for H in $FARMS; do
  test -d "$H"
  test -w "$H"
  PRE_DANGLING="$(find "$H" -maxdepth 1 -xtype l)"
  test -z "$PRE_DANGLING"                                    # start state must have no dangling links
done
git -C "$MS" fetch --tags
git -C "$MS" cat-file -e 2815104d5459357d44c5f9031fcca0525b00c991^{commit}
git -C "$MS" ls-tree --name-only 2815104d:skills > /tmp/wi477-target-names.txt
NAMES_COUNT="$(wc -l < /tmp/wi477-target-names.txt)"
test "$NAMES_COUNT" -eq 46
# collision scan BEFORE any deletion/checkout (R3-3)
while read -r n; do
  for H in $FARMS; do
    if [ -e "$H/$n" ] || [ -L "$H/$n" ]; then
      case "$(readlink "$H/$n" 2>/dev/null)" in
        "$MS"/*) : ;;                                        # our own link — scheduled for replacement
        *) echo "COLLISION: $H/$n is not a marketingskills link"; false ;;
      esac
    fi
  done
done < /tmp/wi477-target-names.txt

# V1+V2+V3. MUTATION + VERIFY under a fail-CLOSED handler (R4-1): captures $?, disarms the
# trap, restores the RECORDED baseline, verifies the restore, and always exits nonzero.
on_err(){
  rc=$?
  trap - ERR
  set +e
  git -C "$MS" checkout "$(cat /tmp/wi477-baseline-sha.txt)"
  for H in $FARMS; do
    find "$H" -maxdepth 1 -type l -lname "$MS/*" -delete
    for s in "$MS"/skills/*/; do ln -s "${s%/}" "$H/$(basename "$s")"; done
  done
  restored="$(git -C "$MS" rev-parse HEAD)"
  echo "ROLLED BACK to $restored (exit $rc)"
  exit "$rc"
}
trap on_err ERR
git -C "$MS" checkout 2815104d
HEAD_SHA="$(git -C "$MS" rev-parse HEAD)"
test "$HEAD_SHA" = "2815104d5459357d44c5f9031fcca0525b00c991"
test -d "$MS/skills/cro"
test ! -d "$MS/skills/page-cro"
for H in $FARMS; do
  find "$H" -maxdepth 1 -type l -lname "$MS/*" -delete
  for s in "$MS"/skills/*/; do ln -s "${s%/}" "$H/$(basename "$s")"; done
  LINKED="$(find "$H" -maxdepth 1 -lname "$MS/*" | wc -l)"     # standalone assignment: a failing
  test "$LINKED" -eq 46                                        # find aborts via set -e (R4-1)
  DANGLING="$(find "$H" -maxdepth 1 -xtype l)"
  test -z "$DANGLING"
done
# V3 verify — trap stays armed so any failure rolls the flip back (R3-4)
bash test-framework/evals/tier-1/validate-claude-skills-symlinks.sh
node scripts/lint-skills-manifest.mjs
bash test-framework/evals/run-all-evals.sh --tier1
trap - ERR   # disarmed only after ALL verify checks pass
```

**Worktree lifecycle (R3-4):** `land-changeset` removes the worktree immediately after merge — that is correct and safe here because every host symlink targets the CENTRAL install or the MAIN checkout, never the worktree (the learning-c10 hazard does not apply). V0–V3 run on main after the worktree is gone; the earlier "removed only after V3" claim was wrong and is retracted.

## Prerequisite Alignment Matrix

| Upstream skill | Status | Evidence |
|----------------|--------|----------|
| route-workflow | completed | `.svc/lane-tasks-WI-477.json` + session contract 2026-07-13 |
| blend-external (WI-476) | completed | `proposals/2026-07-13-blend-coreyhaines-v2.6.0.md` + knowledge layer (merged `64e6ecb1`) |
| write-spec | skipped | WI-477 ACs + blend plan Assessment B as spec (decision logged) |
| design-ux / design-ui | skipped | no UX/UI surface (decisions logged) |
| design-tech | completed-inline | § External State Lifecycle (receipt + phase on task 4 of the lane graph) |
| explore-solutions | completed-inline | § Alternatives considered (receipt + phase on task 5) |
| define-code-style | skipped | one string literal in seeder; conventions followed (decision logged) |
| plan-changeset | completed | this manifest (task 7 receipt) |

## Validation plan

| Check | Command | Expected |
|-------|---------|----------|
| Mechanical plan gate | `bash scripts/verify-plan-mechanical.sh docs/plans/2026-07-13-wi477-coreyhaines-v2.6-migration/manifest.md` | PASS (log: mechanical-gate.log) |
| Manifest lint | Exec step 4 | PASS |
| Tier-1 full | Exec step 7 (worktree) + V3 (main) | all pass |
| Occurrence-level scan | Exec step 5 | empty residual, hard exit otherwise |
| Targeted assertions | Exec step 6 | all hit, hard exit otherwise |
| Registry content diff | Exec step 3 | old absent, new present, ≤6 changed lines |
| Addon pin + farms | V1/V2 | pin `2815104d`; 46 links/farm; 0 dangling; collisions abort |
| Symlink guard | V3 | PASS |

## Checkpoints & rollback

- Commit P (planning, main, exempt-class) → worktree commit M → PR + squash-merge → land-changeset removes worktree (safe: no host symlink targets it) → verify-promotion V0 preflight + trap-guarded flip + V3 on main.
- Rollback: revert commit M + `rollback()` block above. No data migration, no schema.
- Worst credible failure: missed rename routes a marketing intent to a nonexistent addon skill — caught by the gating occurrence-level scan (step 5) + targeted assertions (step 6) before land, and by V3 smoke after the flip.

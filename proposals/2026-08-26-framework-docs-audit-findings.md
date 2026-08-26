# Framework Docs Audit Findings — WI-FW-DOCS-AUDIT-01 (2026-08-26)

Mechanical audit of framework documentation drift. Method: relative-link
walker over all repo `.md` files, count reconciliation (disk vs manifest vs
authority-doc claims), host-table vs `provision/hosts/*.json` diff, and
cross-file statement comparison across the top authority docs
(`FRAMEWORK-STATE.md`, `AGENTS.md`, `DOCTRINE.md`, `README.md`, `HOSTS.md`,
`REPO_MODES.md`, `EXTERNAL_ADDONS.md`, `WORKTREES.md`, `OPEN-PROPOSALS.md`,
`skills-manifest.json`).

Severity: **Critical** = causes a wrong agent action; **High** = stale fact an
agent will rely on; **Medium** = misleading but recoverable; **Low** = typo/cosmetic.

## Findings

| # | Severity | Location | Finding | Disposition |
|---|----------|----------|---------|-------------|
| F1 | **Critical** | `FRAMEWORK-STATE.md` (~L171, ~L624-641) | Claims archived history exists at `FRAMEWORK-STATE-ARCHIVE/analysis-history-2026-06-05-and-earlier.md` "(107 entries)", `2026-04-13-and-earlier.md`, `wi-closeouts-2026-05.md`, and links `FRAMEWORK-STATE-ARCHIVE/closed-gaps.md`. The directory was **never committed** (`git log --all --diff-filter=D -- 'FRAMEWORK-STATE-ARCHIVE/*'` empty; no dir on disk). Agents following WI-362 archive discipline move entries to/vote for files that do not exist; readers assume closeout history exists on disk. | Fixed this session: archive dir created with honest stubs; false existence claim corrected |
| F2 | **Critical** | `HOSTS.md` host table | Table lists 8 hosts; `provision/hosts/` has 9 (`grok.json` present, `GROK.md` context file exists, README documents `./setup --host grok`, AGENTS.md says "nine supported agent hosts"). Grok-host agents have no documented entrypoint in the canonical per-host doc. | Fixed this session: Grok row added |
| F3 | **High** | `FRAMEWORK-STATE.md` Current State + `AGENTS.md` §10 | Both say "**Agents:** 3" / "Three agents defined". Actual: **28** frontmatter agent definitions under `agents/` (30 `.md` files incl. README + prompt file). AGENTS.md names only 2 of the claimed 3. | Fixed this session |
| F4 | **High** | `FRAMEWORK-STATE.md` ("Rules: 18 registered") + `AGENTS.md` §10 ("13 registered rules") | Manifest `rulesRegistry.entries` = **48**, disk `rules/**/*.md` = **48**, registry↔disk parity exact. Both authority docs stale by different amounts. | Fixed this session |
| F5 | **High** | `FRAMEWORK-STATE.md` ("Reference docs: 21" + enumerated list) | `references/*.md` actual = **91**. The fixed enumeration guarantees recurrence of this drift. Replaced with live count + pointer to directory. | Fixed this session |
| F6 | **High** | `references/knowledge/competitors/b-trust-bg/CAPABILITIES.md` L137-139 | Detail index links to nonexistent `details/identity.md`, `details/coverage.md`, `details/required-docs.md` (actual siblings: about/applied-knowledge/blog-recent/contact/legal/services). Knowledge-recall consumers hit dead ends. | Fixed this session |
| F7 | **Medium** | `references/knowledge/competitors/legalconsult-bg/details/blog-content-synthesis.md` | All table links use `details/blog-posts/…` but the file itself lives inside `details/`, so every link double-prefixes (`details/details/blog-posts/...`). Target files exist. | Fixed this session |
| F8 | **Medium** | `docs/specs/decisions/2026-07-24-wi-511-quality-preserving-optimizations/SOLUTION-CONFIDENCE.md` | Six WI links use `../../../work-items/WI-x.md`; correct depth is `../../work-items/WI-x.md` → resolves to `docs/work-items/` (missing) instead of `docs/specs/work-items/`. | Fixed this session |
| F9 | **Medium** | `FRAMEWORK-STATE.md` size | Live file is ~79KB against its own WI-362 "never exceed 50KB" ceiling. Dieting requires moving analysis-history entries to the (now-created) archive — substantive content surgery, not a doc fix. | Flagged; follow-up WI recommended, not silently done |
| F10 | **Medium** | `OPEN-PROPOSALS.md` header | LANDED WI-557-v2 banner sits above stale planning tables ("Branch … worktree exists", regression-fix TODO tables) that read as open work. | Fixed this session: historical-residue marker added |
| F11 | **Medium** | `references/knowledge/INDEX.md` | Many knowledge domains carry extraction dates >90 days old without refresh markers. Per stored learning, knowledge decays silently (host-capability facts went wrong before). Mechanical detection added; mass re-verification out of scope. | Detectable via new audit script (warn tier) |
| F12 | **Low** | `AGENTS.md` §9, `DOCTRINE.md` L1077, `route-workflow` P1 reads | `docs/specs/project-state.md` cited as primary product-state source; absent in this repo (never committed). It is a *per-project artifact* created by `onboard-repo` — legitimate absence in the framework repo, but wording does not say so. | Clarified in findings; optional one-line doc note left to follow-up |
| F13 | **Low** | `proposals/done/*`, `docs/plans/*/manifest.md` | Absolute `/workspace/...` and `/home/svc-user/...` markdown targets from old machine layouts. Historical records — deliberately NOT rewritten (no history rewrite); excluded from enforcement, listed as known-historical by the audit script. | Accepted-as-historical |

## Findings surfaced during fix verification (same session, same classes)

| # | Severity | Location | Finding | Disposition |
|---|----------|----------|---------|-------------|
| F14 | **Medium** | `references/knowledge/domains/mimo/CAPABILITIES.md` | Five phantom detail-file links (`commercial-vs-token-plan`, `model-roster`, `hyperparameters`, `throughput-limits`, `migration-cost-impact`) — `details/` never extracted; facts live in the body. | Fixed: index replaced with correction note; inline links unwrapped |
| F15 | **Medium** | `claude-hooks` / `codex-hooks` CAPABILITIES.md | One phantom detail file each (`configuration.md` / `decision-formats.md`). | Fixed: rows replaced with correction notes pointing at body + events.md |
| F16 | **Medium** | `skills/diagnose-bug/SKILL.md`, `skills/write-e2e/SKILL.md`, `skills/execute-changeset/references/process-details.md`, `skills/launch-knowledge/references/cost-benefit-calculator.md` | Wrong relative depth to repo-root `references/` (`../references/…` resolves inside `skills/`). gemini-context-budget pre-flight doc unreachable from 3 skills. | Fixed: corrected to `../../references/…` / `../../../references/…` |
| F17 | **Low** | `skills/route-workflow/references/lane-model.md` | `[references/framework-policy.md](references/framework-policy.md)` double-prefixes from inside the references dir. Target exists. | Fixed: single-prefix link |
| F18 | **Low** | 15 files under `docs/specs/work-items/` (WI-214…221, 297…303) | Links + `source:` metadata pointed at four 2026-05-10 proposals at their pre-archive location; they live in `proposals/done/`. | Fixed: repointed to `proposals/done/` |
| F19 | **Info** | `references/knowledge/domains/eit-urban-mobility/details/*.md` | 16 links cite uncommitted raw captures (`scratch/*.txt`) as provenance. Deliberate non-materialization, not drift. | Audit script class: WARN "raw-citation", not FAIL |

Checker semantics locked this session: `file://` targets = historical machine-absolute records (skip); root-relative `/…` anchors = external-site paths (skip); percent-encoded targets matched literally first; inline code spans stripped before link scanning.

## Verified-clean checks (no drift found)

- Skills: manifest `includedSkills` = 103 = skill dirs on disk; every skill named in README.
- `node scripts/lint-skills-manifest.mjs`: PASS (README order, core pack, bootstrap sequence all synced).
- Rules registry ↔ disk parity exact (48/48).
- Host count statements consistent where present ("nine" in AGENTS.md/README).
- Worker transport scripts claim (8) matches disk.
- DOCTRINE G1–G7 gate table intact; Kimi wire script covers 13 lifecycle events as claimed.

## Detection going forward

`scripts/audit-framework-docs.mjs` (new) mechanically detects F1–F11 classes:
broken internal md links (excluding historical dirs), FRAMEWORK-STATE size
ceiling, agent/rule/skill counts vs disk+manifest, HOSTS.md rows vs
provision/hosts, knowledge INDEX staleness, archive-path existence.
Wired as tier-1 validator `validate-framework-docs-audit.sh` (promotion note
in file header per `rules/tier-1-promotion.md`: failure class observed this
session caused wrong agent assumptions; hermetic; <5s).

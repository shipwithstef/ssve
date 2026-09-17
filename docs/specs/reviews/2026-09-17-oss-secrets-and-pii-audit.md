# OSS secrets and PII audit (2026-09-17)

**Status:** tip (staged index) is privacy-scan clean; **repository is not
ready for a public visibility flip.**
**WI slice:** `WI-FW-OSS-READINESS-01` audit follow-up to the 2026-09-16
publication packet.
**Branch:** `framework-open-source-readiness`
**HEAD / `origin/main`:** `355f3c9279e609110da08c553bb4fd8a19766807`
**Index vs HEAD:** 14 files already staged from the 2026-09-16 sanitization
slice; this report is a new working-tree file.
**Scan time:** 2026-09-17T16:16:02Z
**Staged candidate:** 15 paths (the 2026-09-16 sanitization slice plus this
report). The live `git diff --cached` digest is not pinned here so later
packet edits do not churn it.

This packet is an evidence-backed secrets/PII audit. It does **not**
change GitHub visibility, rewrite history, delete remote refs, or
commit the staged candidate.

Companion: [`2026-09-16-oss-early-preview-publication-decision.md`](2026-09-16-oss-early-preview-publication-decision.md).

## Verdict

| Surface | Verdict |
|---------|---------|
| Staged tip (index + matching working tree) | **PASS** — privacy scanner `ok: true`, 0 findings |
| Committed `origin/main` tip (`355f3c9`) | **FAIL until the staged sanitization is committed** — 13 `/home/<operator>` hits remain in 6 committed files |
| Live credentials on `origin/main` history (10 commits) | **PASS** — 0 live keys; remaining matches are dummy fixtures |
| Author / committer emails on `origin/main` | **PASS** — `angelovsan@gmail.com` + GitHub merge-bot only |
| Extra remote heads, notes, PR objects | **FAIL for a public flip** — workstation emails, personal paths, and unpublished private-product history remain reachable |
| `.gitignore` vs requested exclusions | **PARTIAL** — lock files covered; lane-tasks and session contracts are still tracked |

A clean staged tip does not make parent commits, extra remote branches,
git notes, or GitHub pull-request objects private.

---

## 1. Tool execution: `audit-repository-privacy.mjs`

Command: `/usr/bin/node scripts/audit-repository-privacy.mjs`

Working-tree / index result (scanner reads `git ls-files` then disk,
which currently matches the index):

First run (before this report was added):

```json
{"ok":true,"tracked_files":4642,"history_root_checked":false}
```

Confirmation run after this report was staged and its own forbidden
literals were neutralized:

```json
{"ok":true,"tracked_files":4643,"history_root_checked":false}
```

Interpretation:

- HEAD tree is **4638** files. The 2026-09-16 candidate added 4 new
  index paths (`docs/EARLY-PREVIEW.md`, the 2026-09-16 decision packet,
  `docs/specs/work-items/WI-FW-OSS-READINESS-01.md`, and
  `.svc/lane-tasks-WI-FW-OSS-READINESS-01.json`) → **4642**.
- This report is the 4643rd index path.
- Exit 0, empty findings array. Categories that fired on 2026-09-16
  (`personal-workstation-path` × 15, `non-publication-email` × 3) are
  gone from the current index.
- The scanner skip-list still excludes
  `scripts/audit-repository-privacy.mjs` itself and the two documented
  secret-redaction fixture files.

`--history-root` (expected fail on this tree; not a secret finding):

```json
{
  "ok": false,
  "finding_count": 4,
  "findings": [
    {"kind":"history-not-single-root","file":"<git-history>"},
    {"kind":"root-has-parent","file":"<git-history>"},
    {"kind":"non-canonical-commit-name","file":"<git-history>"},
    {"kind":"non-canonical-commit-email","file":"<git-history>"}
  ]
}
```

`origin/main` has **10** commits (root `0dcd69d`). HEAD is the squash
`355f3c9` authored by `shipwithstef` / committed by GitHub
GitHub's merge-bot committer identity, so the single-root name/email checks fail by
design. WI-537's single-root reset is no longer a description of
`origin/main`. Do not run another destructive reset from this checklist.

Scanner limits (unchanged; still load-bearing):

- Pattern scan of **tracked** files only. Not proof of absence of
  secrets outside its regexes.
- Does not walk extra remote heads, `refs/notes/*`, GitHub PR objects,
  Actions logs, or gitignored machine-local files.

---

## 2. Secret scan results (recent commits)

Scope: every tree on `HEAD` ancestry (`0dcd69d` … `355f3c9`, 10
commits) plus the current index. Additional sample of extra remote
**tips** for non-dummy `ghp_` / `sk-` shapes.

| Pattern | `origin/main` live hits | Disposition |
|---------|------------------------:|-------------|
| `ghp_` / `gho_` / `ghu_` / `ghs_` / `ghr_` | 0 live | Dummy `ghp_A…A` in secret-redaction fixtures only |
| `sk-` / `sk-ant-` / `sk-proj-` | 0 live | Dummy `sk-ant-A…A`, `sk-proj-A…A`, `sk-deadbeefcafe…` in fixtures; `.svc/spec-index.json` heading slugs (`sk-proj`, `sk-live`) are documentation anchors |
| `AIza…` Google API keys | 0 | — |
| `xai-` keys | 0 | — |
| `AKIA` / `ASIA` | 0 live | AWS example `AKIAIOSFODNN7EXAMPLE` in the redaction fixture |
| `sk_live_` / `rk_live_` | 0 live | Dummy `sk_live_A…A` in the redaction fixture |
| `BEGIN … PRIVATE KEY` | 0 live | Regex/source in the scanner and a 3-line OpenSSH dummy in the redaction self-test |
| Tracked `.env`, `.pem`, `.key`, `scratch/` | 0 | No such paths on the index |

Files that match secret *shapes* and are **allowlisted fixtures**, not
credentials:

- `test-framework/evals/tier-1/validate-secret-redaction.sh`
- `docs/specs/framework-parity/feature-deep-dives/04-memory-secret-redaction.md`
- `scripts/lib/secret-redaction.mjs` / `scripts/audit-repository-privacy.mjs` (detector source)
- `.svc/spec-index.json` heading slugs

Sample of extra remote **tips** that are **not** descendants of the
sanitized wipe (`bugfix-WI-559`, `bugfix-WI-565`, `bugfix/WI-567`,
`feature-astra-instruction-audit`, `framework-WI-540`): **no non-dummy
`ghp_` / `sk-` hits** at those tips. That is a tip sample, not a full
historical blob walk of those unrelated histories. The 2026-09-16
packet already recorded 449 unique blob findings on those older
histories, including `private-product-identity` and
`private-product-fingerprint`. Those branches remain a publication
blocker even if their tips have no live tokens.

**Conclusion:** 0 leaked live credentials on `origin/main` history and
the staged tip. Dummy fixture tokens are intentional and documented.

---

## 3. Workstation path / hostname / IP audit

### Staged index (what a commit of the current candidate would publish)

| Check | Result |
|-------|--------|
| `/home/<operator>` | **0 files** |
| Windows Dell home-path class (scanner literals) | **0** |
| Private hostnames (`vm-agent-swarm`, `*.ts.net`, `*.internal.cloudapp.net`) | **0** in file content |
| `/workspace/ssve` replacements | 5 files (path neutralization from 2026-09-16) |
| `/home/builder/.codex` replacements | 3 files (Codex install/config paths; generic, not a personal home) |

Replacement files (index):

- `.svc/pipeline-decisions.jsonl`
- `.svc/session-contract.jsonl`
- `docs/plans/two-box-transmutation/implementation-report.md`
- `docs/specs/evidence/framework-large-input/transport-assessment-20260915.json`
- `docs/specs/evidence/framework-large-input/native-1mib-inspect.json` (`/home/builder/.codex`)
- `test-framework/evals/tier-1/fixtures/two-box/canary03-executor-stdout.jsonl` (`/home/builder/.codex`)

No further path replacements were required on 2026-09-17. The 2026-09-16
staged sanitization already covers the tracked tip.

### Committed `origin/main` tip (still dirty until that candidate lands)

`git grep '/home/<operator>' HEAD` — **13 matches / 6 files**:

| File | Hits |
|------|-----:|
| `.svc/session-contract.jsonl` | 7 |
| `.svc/pipeline-decisions.jsonl` | 2 |
| `docs/plans/two-box-transmutation/implementation-report.md` | 1 |
| `docs/specs/evidence/framework-large-input/native-1mib-inspect.json` | 1 |
| `docs/specs/evidence/framework-large-input/transport-assessment-20260915.json` | 1 |
| `test-framework/evals/tier-1/fixtures/two-box/canary03-executor-stdout.jsonl` | 1 |

Parent commits that remain reachable after a clean tip (not rewritten):

- `f04dfdf` and `ed08b22` still contain `/home/<operator>` in the six files
  above **plus** `docs/plans/2026-09-16-centralized-worktree-governance/{astra-codex,cursor,grok}-receipt.json` and `self-review.md`.
- `f04dfdf` / `ed08b22` `self-review.md` still contains a
  `private-product-identity` hit (a consuming-project example named
  in that review). The current tip only retains detector source for
  that class inside `scripts/audit-repository-privacy.mjs`.

### RFC1918 addresses in the index

| Location | Value | Disposition |
|----------|-------|-------------|
| `references/knowledge/domains/capacitor/details/framework-integration.md` | `http://192.168.1.100:5173` | Generic Capacitor docs example (`// Your dev machine IP`). Not a workstation inventory. |
| `references/knowledge/domains/istio-gateway-api/details/security-policies.md` | `10.0.0.0/8` | CIDR documentation. Not a host. |

### Extra remote heads (would become public on a visibility flip)

`/home/<operator>` file counts at each remote **tip**:

| Remote head | Files with `/home/<operator>` | Notes |
|-------------|---------------------------:|-------|
| `origin/feature-astra-instruction-audit` | 85 | Pre-wipe history; merge-base with `origin/main` empty |
| `origin/bugfix/WI-567-active-intent-negated-stop` | 69 | Pre-wipe |
| `origin/bugfix-WI-565-review-transports` | 63 | Pre-wipe; author is the operator local git identity on the Azure internal hostname |
| `origin/bugfix-WI-559-review-dispatch-adapter` | 45 | Pre-wipe |
| `origin/feature-centralized-worktree-governance` | 7 | Post-wipe descendant of `780c766` |
| `origin/framework-two-box-transmutation` | 6 | 13 ahead of `e016e44` |
| `origin/framework-oss-integration` | 5 | **New since 2026-09-16**; 4 ahead of `355f3c9` |
| `origin/framework-WI-540-mutating-child-transport-preflight` | 0 | Pre-wipe; 3 commits |
| `origin/bugfix-two-box-authority-revision-binding` | (not path-scanned; emails clean) | New since 2026-09-16 |
| `origin/bugfix-two-box-released-lease-recovery` | (not path-scanned; emails clean) | New since 2026-09-16 |

`archive/pre-open-source-20260914` is **no longer** on `origin` (present
in the 2026-09-16 inventory; absent now). That deletion does not erase
GitHub PR objects or forks of the old history.

Machine-local gitignored files under `.svc/` still contain
`/home/<operator>` (bindings, claims, external-review artifacts). They are
not in the index. Keep them gitignored; do not add them to the
candidate.

---

## 4. Author / committer email audit

### `origin/main` / this branch (10 commits)

Unique names: `s7an-it`, `shipwithstef`, `s7an_ops`, `GitHub`.
Unique emails: the allowed owner mailbox `angelovsan@gmail.com`, plus GitHub's merge-bot committer identity.

Allowed by the privacy scanner for file content: `angelovsan@gmail.com`.
GitHub's merge-bot committer identity is benign public metadata, not a
personal mailbox. The three aliases encoded in the scanner's
`alternate-contributor-alias` rule do not appear.

### File-content emails on the index

After subtracting `example.com` / `example.org` / `example.net` /
`example.test` / `example.invalid` / `svc.test` / `git@github.com` /
`contact-<hex>@example.invalid`:

- **Only remaining production mailbox:** `angelovsan@gmail.com`
- Fixture canary addresses moved to `two-box-canary@example.invalid`
  (3 sites in `scripts/run-live-two-box-canary.mjs`). `invalid.local`
  is gone from the index.
- `assets/logo.png` produces a binary false-positive `%@example.com`.
  Not an email.

### Emails that would publish with a visibility flip (not on `origin/main`)

| Address | Where |
|---------|-------|
| Operator local git identity on the Azure internal hostname (`vm-agent-swarm` / `internal.cloudapp.net`) | Extra remote commits (e.g. `origin/bugfix-WI-565-review-transports` tip) and some `refs/notes/svc-receipts` note objects |
| Operator local git identity on the Tailscale hostname (`vm-agent-swarm` / `ts.net`) | Local/origin notes objects (`Notes added by 'git notes add'`) |

`git log origin/main` contains **zero** operator-local author/committer
mailboxes. `git log --all` does, because extra remotes, local worktree
branches, and notes share this object store.

`refs/notes/svc-receipts` exists on origin (`5354a42…`). Notes are a
public Git surface if the repository is public. Local note authors
include that `Ubuntu` operator-local identity.

---

## 5. `.gitignore` vs requested exclusions

Requested: exclude `.svc/lane-tasks-*.json`, local session contracts,
and transient lock files.

| Pattern | Repo `.gitignore` | Current state |
|---------|-------------------|---------------|
| `.svc/lane-tasks-*.json` | **Not ignored** | **75 tracked** files, including staged new `WI-FW-OSS-READINESS-01` |
| `.svc/session-contract.jsonl` | **Not ignored** | **Tracked**; staged path neutralization only |
| `.svc/pipeline-decisions.jsonl` | **Not ignored** | **Tracked**; same |
| `.svc/coverage.lock` / `.svc/coverage-locks/` | Ignored | PASS |
| `docs/specs/candidates/*.lock` | Ignored | PASS |
| `.svc/chain-policy.json` | Ignored | PASS |
| `.svc/claims/`, `.svc/bindings/`, `.svc/receipts/*`, `.svc/external-review-artifacts/` | Ignored | PASS |
| `.worktrees/` | Ignored | PASS |
| `.env` / `.env.*` | **Not in repo `.gitignore`** | Covered only by this machine's `~/.gitignore_global`. A contributor clone would not inherit that. |

Adding ignore rules here was **not** done in this slice:

- The 2026-09-16 packet recorded owner hash drift
  (launch pin `.gitignore` `4e1bdc82…` vs this tree `18db1451…`) and
  forbade merging owner README / `.gitignore` from this worktree.
- `git rm --cached` of 75 already-tracked lane-tasks files is a
  separate product decision: those files are the documented cross-host
  task-graph source of truth (`AGENTS.md` §9). Ignoring them without
  untracking does not stop publication of the copies already on
  `origin/main`.

---

## 6. GitHub / ref inventory delta since 2026-09-16

This session could not independently re-read GitHub visibility
(`gh repo view` / REST returned 404 for `shipwithstef/ssve`, consistent
with a private repo and the current token). Treat visibility as
**still PRIVATE** per the 2026-09-16 packet unless the owner has
flipped it out of band.

Remote heads now (10 extra + `main`), vs 6 extra on 2026-09-16:

**Still present (pre-wipe, empty merge-base with `origin/main`):**

- `bugfix-WI-559-review-dispatch-adapter`
- `bugfix-WI-565-review-transports`
- `bugfix/WI-567-active-intent-negated-stop`
- `feature-astra-instruction-audit`
- `framework-WI-540-mutating-child-transport-preflight`

**Gone from `origin`:** `archive/pre-open-source-20260914`

**New since 2026-09-16:**

- `framework-oss-integration` (4 ahead of current main; 5 files still
  carry `/home/<operator>`)
- `framework-two-box-transmutation`
- `feature-centralized-worktree-governance`
- `bugfix-two-box-authority-revision-binding`
- `bugfix-two-box-released-lease-recovery`

Tag `audit/astra-instruction-2026-09-12` is still on origin.
`refs/notes/svc-receipts` is still on origin.

---

## 7. Staged candidate (unchanged from 2026-09-16 plus this report)

Already staged, not committed:

| Path | Role |
|------|------|
| Path neutralization in 6 content files | Removes `/home/<operator>` from the tip |
| `scripts/run-live-two-box-canary.mjs` + canary digest pin | Fixture email → `example.invalid` |
| `docs/EARLY-PREVIEW.md`, `CONTRIBUTING.md` pointer | Known-issue docs |
| `docs/specs/reviews/2026-09-16-oss-early-preview-publication-decision.md` | Prior packet |
| WI + INDEX + pipeline-decisions | Intake |
| `.svc/lane-tasks-WI-FW-OSS-READINESS-01.json` | New tracked lane-tasks file (gitignore gap) |
| `.svc/session-contract.jsonl` | Path-sanitized but still a local session ledger |

This report (`docs/specs/reviews/2026-09-17-oss-secrets-and-pii-audit.md`)
is staged with the candidate. Forbidden scanner literals were removed
from this file so the index remains `ok: true`.

---

## PASS / REMAINING ACTION checklist for a public flip

Do **not** flip GitHub visibility until every **REMAINING ACTION** row
is done or explicitly waived in a later reviewed decision.

### PASS (this audit)

- [x] `audit-repository-privacy.mjs` on the staged tip: `ok: true`, 0 findings, 4643 index files (4642 before this report)
- [x] Staged tip has **0** `personal-workstation-path` hits, 0 Dell home-path hits, and 0 private-hostname file hits
- [x] Fixture emails on `invalid.local` replaced with `two-box-canary@example.invalid`
- [x] **0 live** `ghp_`, `sk-`, `sk-ant-`, `AIza`, `AKIA`/`ASIA`, `xai-`, Stripe live, or PEM private keys on `origin/main` history
- [x] `origin/main` commit metadata uses only `angelovsan@gmail.com` and GitHub's merge-bot committer identity
- [x] No forbidden contributor aliases in `origin/main` metadata
- [x] No tracked `.env` / `.pem` / `.key` / `scratch/` paths
- [x] Transient lock files (`.svc/coverage.lock`, `.svc/coverage-locks/`, `docs/specs/candidates/*.lock`) are gitignored
- [x] Claims, bindings, receipts cache, and external-review artifacts are gitignored

### REMAINING ACTION (block a public flip)

1. **Keep the repository PRIVATE** until the owner accepts a separate
   publication decision. This audit does not authorize a visibility
   change.
2. **Commit or drop the staged tip sanitization.** Until it lands,
   `origin/main` still publishes 13 `/home/<operator>` hits. Landing it
   still does **not** rewrite parent commits.
3. **Decide extra remote heads.** Pre-wipe branches (559/565/567/astra/540)
   plus new heads (`framework-oss-integration`,
   `framework-two-box-transmutation`,
   `feature-centralized-worktree-governance`, two-box bugfix heads)
   would become public. Backup, then delete remote refs if they must
   not publish. Deleting refs does not erase GitHub PR objects.
4. **Decide `refs/notes/svc-receipts`.** Origin notes exist and include
   operator-local note-author metadata. A public repo publishes notes.
5. **Decide parent-commit PII on `origin/main`.** `f04dfdf` / `ed08b22`
   still contain personal paths and one `private-product-identity`
   line in that self-review. Options: stay private; publish knowing
   history is visible; or a new reviewed export/rewrite with backup
   proof. Unauthorized here.
6. **`.gitignore` owner reconcile.** Do not merge this tree's
   `.gitignore` over the owner's canonical copy. On canonical main,
   add (a) `.svc/lane-tasks-*.json` if lane-tasks should stop being
   public, (b) `.svc/session-contract.jsonl` as a local session
   ledger, (c) `.env` and `.env.*` in the **repo** gitignore (today
   they exist only in this machine's global ignore). Then
   `git rm --cached` already-tracked copies if the policy is to stop
   shipping them.
7. **Do not commit `.svc/lane-tasks-WI-FW-OSS-READINESS-01.json` as
   "required for OSS"** if the publication policy is to ignore
   lane-tasks. 74 other lane-tasks files are already on `origin/main`.
8. **Reconfirm GitHub visibility, issues, and PR bodies** with an
   authenticated `gh` principal that can see `shipwithstef/ssve`.
   Issue bodies were not redacted-audited on 2026-09-16; this audit
   did not repeat that download.
9. **Do not treat dummy redaction fixtures as live secrets**, and do
   not expand the scanner allowlist without a reviewed change.
10. **Clear or waive the three-commit receipt debt** on `aa7439e` /
    `f04dfdf` / `e27cb80` before expecting land-changeset to succeed.
    Out of scope for this audit; still a merge blocker.

### Explicitly not done (and not authorized)

- Public visibility flip
- Force-push / history rewrite
- Remote ref deletion
- Credential revocation (none found live)
- Paid Two-Box / prompt-inspection rerun
- Editing `README.md` or `.gitignore` in this worktree

---

## How / analysis

Method: reproduce the in-repo privacy scanner; independently `git grep`
the index, `HEAD`, and extra remote tips; walk all 10 `origin/main`
commits for credential regexes; classify unique emails in file content
and commit metadata; check `.gitignore` with `git check-ignore -v`;
diff the remote-head set against the 2026-09-16 packet.

## Issues and how they were handled

| Issue | Handling |
|-------|----------|
| 2026-09-16 findings still present on **committed** HEAD | Confirmed staged sanitization already removes them; no second rewrite of those files |
| `git log --all` showed operator-local mailboxes | Scoped to extra remotes + notes; `origin/main` is clean |
| `gh` 404 on `shipwithstef/ssve` | Recorded as unverified in this session; do not infer public |
| Requested gitignore exclusions conflict with tracked SoT files and owner hash drift | Documented as remaining action; `.gitignore` not edited here |
| Secret regexes hit fixture files | Classified as dummy; 0 live credentials claimed only where the dummy/example context is visible |

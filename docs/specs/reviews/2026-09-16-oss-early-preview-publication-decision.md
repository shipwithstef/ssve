# Publication decision: SSVE early preview (2026-09-16)

**Status:** reviewable candidate prepared; **do not** change GitHub
visibility and **do not** rewrite remote history.
**WI slice:** `WI-FW-OSS-READINESS-01` release-preparation only.
**Candidate branch:** `framework-open-source-readiness`
**Base / origin/main:** `355f3c9279e609110da08c553bb4fd8a19766807`
**Repo:** `shipwithstef/ssve` (PRIVATE at inventory time)

This packet is the reversible-preparation closeout. Irreversible
publication steps are listed at the end and require an explicit later
owner decision.

## Verdict

The working-tree tip can be sanitized for an early preview **document
and privacy-scan pass**. The repository is **not** ready for a public
visibility flip.

A clean tip does not make earlier commits, extra remote branches, notes,
or GitHub pull-request objects private.

## What was prepared (this slice)

- Reproduced the tracked-checkout privacy scan with
  `/usr/bin/node scripts/audit-repository-privacy.mjs`.
- Triaged current findings without expanding the scanner allowlist.
- Preserved original bytes privately (gitignored run directory) before
  cleanup.
- Neutralized personal workstation paths in tracked tip files and
  replaced canary fixture emails on an unallowlisted `.local` domain
  with `two-box-canary@example.invalid`.
- Updated the retained CANARY03 **stdout digest pin** after fixture
  sanitization. The LIVE executor input key is unchanged
  (`d63708d00d9f124d154cec9c114f98f0b24eb622001c931abb0093f176a7ef80`).
  Paid Two-Box / prompt-inspection experiments were not rerun.
- Wrote public known-issue documentation in `docs/EARLY-PREVIEW.md`.
- Did not edit `README.md` or `.gitignore` (owner hashes on canonical
  main differ from this tree; root reconciles those).

## Current tip findings (before sanitization)

Working-tree scan after launch writes: 18 findings, 7 files.

| Kind | Count | Disposition |
|------|------:|-------------|
| personal-workstation-path | 15 | Neutralized to `/workspace/ssve` or `/home/builder/.codex` |
| non-publication-email | 3 | Fixture addresses on `scripts/run-live-two-box-canary.mjs`; moved to `example.invalid` |

No other scanner category appeared on the tracked tip. This is a
pattern scan, not proof there are no secrets.

`--history-root` only checks the old single-root policy. This tree has
10 commits on `origin/main` and is **not** a single-root history.

## Surfaces checked

| Surface | State at inventory | Privacy implication |
|---------|--------------------|---------------------|
| GitHub visibility | PRIVATE | Flip is unauthorized and blocked |
| `origin/main` | `355f3c9`, 10 commits, root `0dcd69d` | Tip sanitization does not rewrite parents |
| Extra remote heads | 6 branches, all rooted at pre-reset `ec625b9` | Would become public on a visibility flip |
| `refs/notes/svc-receipts` | present on origin (`5354a42`) | Notes are a public surface if the repo is public |
| Remote tags | `audit/astra-instruction-2026-09-12` | Would become public |
| Pull requests | 54 `refs/pull/*/head` (8–63; no #19 head) | Closed/merged PRs remain GitHub-visible |
| Releases | none | — |
| Wiki / Pages / Discussions | disabled | — |
| Forks | 0 | — |
| Open issues | 8 (numbers 1–7, 19) | Titles inspected; bodies not fully redacted-audited |
| Local leftover heads | many worktree branches | Local only unless pushed |

### Extra remote heads (old root)

These remote branches are **not** descendants of the sanitized
single-root wipe. A history scan of reachable local objects reported
449 unique blob findings across those histories, including
`private-product-identity` and `private-product-fingerprint` hits.

- `archive/pre-open-source-20260914` (`e972b44`, 125 commits)
- `bugfix-WI-559-review-dispatch-adapter` (`b48f367`, 56 commits)
- `bugfix-WI-565-review-transports` (`43cf0b9`, 93 commits)
- `bugfix/WI-567-active-intent-negated-stop` (`f9ec209`, 103 commits)
- `feature-astra-instruction-audit` (`9aa8a75`, 117 commits)
- `framework-WI-540-mutating-child-transport-preflight` (`a6927e6`, 3 commits)

### `origin/main` history beyond the tip

Even after a clean tip, `git log` on main still reaches:

- Reverted centralized-worktree-governance commit
  `f04dfdf199ac0f463c9bb6cf2a3fff389690a566` and its revert pair
  `e27cb80014e1a5687c64d9b2466680483d6a8275` /
  `aa7439ec2e0723df23ecf7905613cf3a9a04885a`. Historical blobs on that
  path include personal-workstation-path hits and one
  `private-product-identity` hit in a now-reverted self-review file.
- Documented secret-redaction fixtures
  (`test-framework/evals/tier-1/validate-secret-redaction.sh`,
  `docs/specs/framework-parity/feature-deep-dives/04-memory-secret-redaction.md`).
  The working-tree scanner excludes these files; they are dummy
  examples, not live credentials.
- `.svc/spec-index.json` heading slugs that contain `sk-proj` /
  `sk-live` documentation anchors (false-positive token shape).

Commit metadata on main uses the allowed owner address
`angelovsan@gmail.com` and GitHub's standard merge-bot committer
identity (benign public metadata, not a personal mailbox).
Author names `s7an-it`, `shipwithstef`, and `s7an_ops` are not the
forbidden contributor aliases.

## Surfaces unexamined or incomplete

- **21 PR head objects** listed by `git ls-remote` were not present in
  this object store (PR heads 9–18, 20–22, 24–28, 33–34, 43). Their
  blob contents were not scanned here.
- GitHub PR **comments, reviews, and patches** were not fully
  downloaded.
- Issue **bodies** were not fully redacted-audited.
- `refs/notes/svc-receipts` note blobs were not exhaustively classified.
- GitHub caches, Actions logs, and any private archive remotes were not
  treated as erased.
- This scanner does not prove absence of secrets outside its patterns.

## WI-537 reuse

WI-537 recorded a verified single-root reset plus private archive.
The WI document is VERIFIED; the index row was stale `IN_PROGRESS` and
is corrected in this slice. Subsequent commits exist. `--history-root`
no longer describes `origin/main`. Do not repeat a destructive reset
because the old checklist mentioned one root.

## Licensing / provenance

Present: MIT `LICENSE`, `CONTRIBUTING.md`, `NOTICES`, `NOTICES.md`,
`references/blend-registry.json`.

Unresolved / weak grant (evidence, not a license opinion):

- `NOTICES.md` § “Lucas Patiri UGC Viral Growth Playbook” cites an X
  status and labels the grant `Public Domain / Social Content
  Heuristics`. That is not a conventional inbound license for copied
  patterns.

No other inbound-license contradiction was proven in this slice.

## WI-569 intersection

Another live session owns GitHub CI (`WI-569`, branch name
`framework-WI-569-oss-github-ci`). This slice did not modify that
worktree, CI workflows, required checks, or GitHub settings. No hosted
CI proof is claimed. A local branch of that name exists here at
`5c6af632` (an ancestor of current main, PR #59 squash) and was left
untouched.

## Receipt / land gate

The sanitized candidate is staged on `framework-open-source-readiness`
and is **not committed**. `scripts/classify-change-risk.mjs --staged`
returned **high** (`append-ledger-path`, `executable-or-config-path`,
`host-hook-task-graph`, `structural-symbol-or-control-flow`,
`text-or-document-path`). The exact staged diff digest is recorded in
the launch `result.json`, not repeated here so later packet edits do
not churn it.
The impact-triad guard therefore requires a schema-v2 final-review
deferral plus different-family independent review. This slice is not
authorized to launch paid reviewers or invent that receipt.

Canonical main already carries pre-existing receipt debt on
`aa7439ec2e0723df23ecf7905613cf3a9a04885a`,
`f04dfdf199ac0f463c9bb6cf2a3fff389690a566`, and
`e27cb80014e1a5687c64d9b2466680483d6a8275`. Root reconciliation
returned exit 1. This slice does not invent receipts or reset those
commits. A draft PR may be blocked by that envelope even after a later
honest review.

Owner README.md / `.gitignore` hashes from launch coordination:

- launch pin README `463b90ce…` vs this tree `ef28291c…`
- launch pin `.gitignore` `4e1bdc82…` vs this tree `18db1451…`

Those owner edits are not in `355f3c9`. Do not merge them from this
worktree.

## Known-issue documentation

See `docs/EARLY-PREVIEW.md`. Follow-up for recovery, merge-receipt
generation, and fresh-user proof remains on WI-FW-OSS-READINESS-01
(broader scope) and WI-FW-CLEAN-MAIN-FOLLOWUP-01. This slice does **not**
close those repairs.

## Irreversible publication steps (owner later; not performed)

Do these only after a separate reviewed decision. None were executed.

1. Keep a verified private backup/restore of every remote ref, note, and
   PR object **before** any deletion.
2. Decide whether extra remote heads and the astra tag may remain. If
   not, delete those **remote refs** only after backup proof. Deleting
   refs does not erase GitHub PR objects.
3. Decide how to handle `origin/main` parent commits that still contain
   personal paths and a reverted private-product-identity blob. Options
   are: stay private; publish knowing history is visible; or a new
   reviewed export/rewrite. A rewrite needs its own backup/restore
   evidence and is unauthorized here.
4. Escalate residual GitHub-cached objects (closed PR heads, Actions
   logs) to GitHub Support if they must disappear.
5. Reconcile owner README / `.gitignore` on canonical main.
6. Clear or explicitly waive the three-commit receipt debt.
7. Only then consider a visibility change from PRIVATE to PUBLIC.

## Minimal decision for the owner

- **Now:** review the sanitized candidate and this packet. Keep the
  repository PRIVATE.
- **Not now:** public flip, force-push, ref deletion, credential
  revocation, or another Two-Box LIVE run.
- **This WI:** release-preparation slice only. Broader automatic
  recovery and truthful merge closeout remain open.

# WI-GROK-HOST-IDENTITY-02 — review-exec panel

**Mode:** owner policy `azure-migration`, phase `exec`
**Orchestrator:** Codex / OpenAI
**Verdict:** PASS, conditional on the hash-bound launcher receipts below

## Frozen-candidate judgment

The final tracked tree includes all G5 remediations, the current plan-manifest
baton, and completed review-exec task evidence. The panel reviews that exact
tree. This record is retained only if both required external stations return
successful schema-valid receipts for the same candidate digest; otherwise the
transaction is rolled back to `in_progress` and the verdict is replaced.

## Required stations

| Station | Authority | Evidence directory |
|---|---|---|
| Cursor Auto | advisory | `.svc/external-review-artifacts/review-exec-cursor-final-r4/` |
| Grok 4.6 High | independent | `.svc/external-review-artifacts/review-exec-grok-final-r3/` |

No Critical finding may remain. Any High finding must be fixed or dispositioned
under the three-round cap before the review-exec receipt can be emitted.

## Self-review result

The implementation is scope-complete against AC-1 through AC-4 locally. AC-5
and AC-6 are intentionally post-land verification steps. Known earlier defects
are covered by mutation-sensitive fixtures: ambient host identity, loader-shaped
bypass, shell session interpolation, unknown hosts, TOML command counts, and
direct `GROK_SESSION_ID` worktree bootstrap. No Example Marketplace or media file is in the
diff.

Cursor's first complete-context pass found that the direct bootstrap fixture
asserted only session continuity. The final fixture also requires the exact
`principalId({host: "grok", session_id})` emitted by authority-v2. Evidence
counts were refreshed and the next audit task is active in the lane graph.

Grok's next pass found the lower migration helper could still coalesce an empty
host to Codex and v1 binding metadata could record `unknown`. The final code now
resolves a trusted host before mutation, rejects empty/unsupported identity,
threads that same host through every claim/binding write, and removes the lower
Codex default. A bogus wired-host fixture proves no branch is created.

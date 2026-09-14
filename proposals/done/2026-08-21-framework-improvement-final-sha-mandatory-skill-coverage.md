# Framework Improvement: Final-SHA mandatory-skill coverage with terminating receipts

**Status:** DRAFT — human checkpoint before WI promotion
**Date:** 2026-08-21
**Category:** receipt integrity / completion observability
**Severity:** high

## Evidence

- **Source:** Founder requirement: a programming route may select from roughly 100 skills; for every commit, SVC must answer whether every applicable mandatory skill actually ran.
- **Observed incident:** Example Marketplace PR #826 squash-merged as `44d9cc57ecf214baf9f7b8536660a7dae6b7a1c9` with 603 lines of tracked recovery evidence for PRs #823/#824, but the final SHA has no `refs/notes/svc-receipts` note.
- **Current machine verdict:** `check-chain-receipts --sha 44d9cc57...` returns `ok:false` and reports the mandatory `plan-manifest`, `review-plan`, `exec-record`, `review-exec`, and `audit-implementation` receipts missing.
- **Classification evidence:** `quick-fix-eligibility --sha 44d9cc57...` returns `eligible:false`: the squash contains 10 files, 603 additions, structural JSON, and a `.gitignore` policy change. The tracked review file inside the commit is evidence for the recovery package; it is not authoritative proof that the final squash SHA completed its own required route.
- **Existing strength to preserve:** SVC already stores authoritative receipts in Git notes, outside the tracked commit tree. That design terminates naturally: adding a note does not create another commit that needs another receipt.

## Diagnosis

- **Root cause:** SVC has strong receipt primitives, per-task `skill_receipt` records, and fixed mandatory-chain validation, but no single final-SHA coverage object that joins the route's applicable task graph to all authoritative receipts and presents one complete yes/no answer. Operators can mistake tracked review artifacts for final-SHA completion, merge outside the sanctioned finalization path, or see a list of five missing chain receipts without seeing the full selected-skill coverage.
- **Category:** fragility and missing completion observability.
- **Already in `FRAMEWORK-STATE.md`?** Partially. Existing decisions establish task-graph skill receipts, phase-aware completion, Git-note authority, and final-SHA chain validation. The missing part is their canonical final-SHA join and atomic merge-finalization contract.
- **Not the problem:** Detailed reviewer evidence is valuable. Line count alone is not a defect, and evidence-bearing commits must not receive a blanket exemption.
- **Not an infinite-chain defect:** #826 is red because its own final SHA lacks an authoritative note. The correct remedy is a sanctioned note-bound receipt/recovery for #826, not another tracked "receipt for the receipt" commit.

## Required Product of the Protocol

For every governed final commit, one command must produce this logical table:

| Final SHA | Task / skill | Why mandatory | Evidence identity | Result |
|---|---|---|---|---|
| `<sha>` | `<task-id> / <skill>` | `<route rule or condition>` | `<receipt type + digest>` | `PASS`, `MISSING`, `INVALID`, or `AUTHORIZED_NA` |

The final answer is:

- **YES** only when every applicable mandatory task is `PASS` or has a valid, policy-authorized `AUTHORIZED_NA` decision made before completion.
- **NO** when any mandatory task is missing, malformed, bound to another WI/SHA/tree/graph, failed, or merely claimed in prose.
- **NO** when final-SHA receipt publication failed after merge, even if the candidate branch was fully reviewed.
- **UNKNOWN/INFRA_FAILURE**, never YES, when the authoritative note or referenced evidence cannot be read.

## Protocol Contract

### 1. Compile the applicable mandatory set

The reviewed plan/task graph is the source of the route-specific mandatory set. Compilation records, for every task:

- stable `task_id`;
- exact `skill` and version/digest;
- mandatory/conditional status;
- the policy rule or evaluated condition that made it applicable;
- required phase IDs and evidence kinds;
- dependencies and graph digest.

SVC must not require all installed skills. It requires only the skills selected as mandatory for this route and change. Conditional tasks may become `AUTHORIZED_NA` only through an explicit policy condition and recorded reason; silence is `MISSING`.

### 2. Bind execution evidence

Every completed mandatory task must resolve to an authoritative receipt that matches:

- WI;
- task ID and skill;
- required phase IDs;
- final candidate tree/diff or an explicitly defined pre/post-merge binding;
- compiled graph digest;
- success verdict and required evidence digests.

Loading a skill proves only that it was loaded. It does not prove its required phases ran or passed.

### 3. Emit one final `skill-coverage` receipt

The sanctioned merge/finalization path emits a content-addressed `skill-coverage` receipt into `refs/notes/svc-receipts` for the final SHA. Minimum fields:

```json
{
  "receipt_type": "skill-coverage",
  "schema_version": 1,
  "wi": "WI-NNN",
  "target_sha": "<final-sha>",
  "tree_hash": "<tree>",
  "graph_digest": "<sha256>",
  "required": [
    {
      "task_id": "T01",
      "skill": "plan-changeset",
      "reason": "mandatory chain",
      "status": "pass",
      "receipt_slot": "slot::plan-manifest::WI-NNN::<final-sha>",
      "receipt_sha256": "<sha256>",
      "required_phases": ["P1", "P2"]
    }
  ],
  "counts": {"required": 1, "pass": 1, "authorized_na": 0, "missing": 0, "invalid": 0},
  "verdict": "pass",
  "generated_at": "<RFC3339>"
}
```

This receipt is an index, not self-asserted proof. Validation recomputes the applicable set and verifies every referenced authoritative receipt. A forged `verdict:pass` with missing or mismatched children fails closed.

### 4. Terminate outside the commit graph

`skill-coverage` lives in the Git note envelope, not in a new tracked commit. Therefore:

1. product/evidence commit is created;
2. mandatory work is verified;
3. final SHA receives the note;
4. validation returns YES;
5. no new commit is created, so no recursive receipt obligation appears.

Tracked JSON/log artifacts may preserve detailed reviewer evidence, but they do not substitute for the authoritative final-SHA note.

### 5. Preserve detailed evidence without duplication

- Keep evidence necessary to reproduce who/what/when/how was reviewed.
- Store raw launcher output once in the existing content-addressed review evidence store.
- Reference it by digest from receipts instead of committing byte-identical copies.
- Do not treat absolute local paths as portable evidence; retain them only as diagnostic metadata beside a content digest.
- No customer, payment, secret, or unnecessary personal data may enter receipts.

### 6. Make merge finalization atomic from the operator's perspective

The sanctioned merge command must:

1. validate candidate coverage before merge;
2. perform the merge/squash;
3. translate/re-emit tree-appropriate receipts onto the GitHub-created final SHA;
4. push the notes ref;
5. run `check-chain-receipts` plus the new coverage check against the final SHA;
6. report completion only after the final command returns YES.

If steps 3–5 fail, the merge may exist but SVC reports `MERGED_UNVERIFIED`, records the exact missing coverage, and schedules bounded recovery. It must never say Done.

### 7. Do not create an evidence-carrier bypass

Evidence-only commits follow the normal classifier:

- genuinely exempt documentation receives the existing tree-bound quick-fix note;
- mixed configuration/code changes require their selected mandatory route;
- reviewed historical recovery uses `retroactive-attestation` for the historical target SHA;
- the commit carrying the recovery files still needs its own final-SHA coverage result.

This preserves the founder's core rule: the answer is based on what actually ran for the commit, not on a convenient filename or commit message.

## #826 Expected Interpretation

- `21da99be` / PR #823: answer from its reviewed retroactive attestation.
- `01e60b5b` / PR #824: answer from its reviewed retroactive attestation.
- `44d9cc57` / PR #826: currently **NO** because no authoritative note exists for this final SHA and the change is not quick-fix eligible.
- The 603 tracked lines can legitimately prove the review of #823/#824; they cannot prove #826 completed its own mandatory path.
- Closing #826 must attach sanctioned evidence to #826's SHA through Git notes/recovery. It must not add another tracked receipt commit.

## Acceptance Criteria

- **AC-1 — Complete inventory:** Given a graph selecting any subset of installed skills, final-SHA inspection lists every applicable mandatory task exactly once.
- **AC-2 — Binary truth:** The command returns YES only when all required entries validate; missing, invalid, wrong-WI, wrong-SHA, wrong-tree, wrong-graph, or failed evidence returns NO.
- **AC-3 — Conditional truth:** `AUTHORIZED_NA` requires a registered policy condition and matching decision evidence; prose-only skips fail.
- **AC-4 — Phase depth:** A skill-load receipt alone cannot satisfy a task whose contract requires phase receipts.
- **AC-5 — Final-SHA authority:** Candidate/head receipts alone cannot make a GitHub squash SHA green; the final SHA must carry a valid note envelope.
- **AC-6 — Natural termination:** Emitting and pushing `skill-coverage` changes no commit tree and creates no new receipt obligation.
- **AC-7 — No evidence bypass:** A mixed evidence/configuration commit cannot use the docs exemption; #826 remains NO until sanctioned recovery succeeds.
- **AC-8 — Tamper resistance:** Mutating the graph, child receipt, evidence object, note, or referenced digest makes coverage invalid.
- **AC-9 — Human-readable output:** The failing command names each missing/invalid skill and why it was mandatory, not only an opaque receipt type.
- **AC-10 — Compact canonical storage:** Duplicate raw review artifacts are not required in the tracked tree when one content-addressed object plus verified digests exists.

## Implementation

- **Route:** Normal SVC framework pipeline. This changes completion authority, receipt schemas, merge behavior, and fail-closed validation; it is not a quick fix.
- **Primary files expected:**
  - `references/chain-receipt-contract.md`
  - `schemas/receipts/skill-coverage.schema.json` (new)
  - `scripts/check-chain-receipts.mjs`
  - `scripts/merge-pr-with-review-receipt.mjs`
  - `scripts/task-graph.mjs` or a focused graph-to-coverage library
  - focused Tier-1 fixtures for coverage, squash finalization, tampering, and termination
- **Explicit non-goals:** weakening mandatory routing, granting a blanket docs/recovery exemption, rewriting historical Git trees, deleting #826 evidence, or treating reviewer PASS as proof that unrecorded skills ran.
- **Commits:** pending WI promotion and execution.

## Replay Verification

- **Replay target 1:** Reproduce #826's current `NO`, then apply only an authoritative note-bound recovery and prove `YES` without creating another commit.
- **Replay target 2:** A synthetic route with multiple mandatory and conditional skills reports exact per-task PASS/NO/NA status and rejects one missing phase.
- **Replay target 3:** Squash a fully receipted candidate in a disposable repository; prove the final SHA is green only after note publication and remains the same SHA before/after receipt emission.
- **Replay target 4:** Inject wrong WI, tree, graph digest, duplicate task, forged PASS, missing artifact, and non-policy skip; every case fails closed.
- **Result:** pending implementation.

## Rollback

Revert the new coverage schema/checker/finalizer together. Existing per-type chain validation and Git-note receipts remain authoritative. Never roll back only the validator while leaving merge tooling capable of emitting coverage PASS objects that nobody verifies.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** After implementation, record the #826 false-completion risk and the final-SHA coverage replay.
- **Known Gaps:** Until implementation, record that SVC lacks one canonical full selected-skill coverage verdict per final SHA.
- **Decisions:** Lock Git notes as the terminating authority and forbid tracked receipt-for-receipt commits as a completion mechanism.
- **Capabilities:** After verification, add final-SHA mandatory-skill coverage and human-readable missing-skill diagnostics.

## Human Checkpoint

Approve or revise this protocol before assigning a WI. This artifact deliberately describes the target behavior and tests; it does not silently change enforcement while Example Marketplace billing work is active.

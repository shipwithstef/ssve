# Process — detail

Moved verbatim from SKILL.md (progressive disclosure).

### Step 2: Ship Preparation

#### Step 2-mobile: Canonical mobile release checkpoint

If `schemas/mobile-build-contract.json` is absent, record canonical mobile
release preparation as `N/A` with repository evidence and continue with the
generic ship preparation below. If it exists, validate it against
`schemas/mobile-build-contract.schema.json`, then perform this state machine
after the diff/review gates pass and before any release build:

1. Invoke the contract's floor query/inspection adapter and capture the remote
   store floor plus the durable ledger floor. The remote store is authority;
   the ledger is conservative evidence, never proof that a number is reusable.
2. Acquire the release-ledger lock and call `allocate-release` exactly once for
   this source and platform with both floors:
   `node scripts/mobile-build-identity.mjs allocate-release --contract
   schemas/mobile-build-contract.json --remote-floor <remote> --ledger-floor
   <ledger> --sha <source-sha> --platform <android-or-ios> [--now <epoch>]`.
   Allocation is idempotent for the same source SHA and platform: a resume
   returns the existing live reservation instead of appending a second row.
   The allocator must durably append the source/platform-bound `reserved` row
   before a build command runs.
3. Invoke the repository-reviewed `commands.allocate_release`,
   `commands.build_release`, and `commands.inspect_artifact` JSON argv arrays
   directly, without shell parsing, interpolation, `eval`, or an argv supplied
   by adapter output. Freshly inspect the produced artifact.
4. Require exact equality among canonical application/bundle identity,
   version/build code, version name, source SHA, inspected metadata, artifact
   filename, and release receipt. The artifact must resolve to a real regular,
   non-symlink file whose basename exactly equals the configured release
   artifact template rendered for project, code, source SHA, and platform.
   Have the engine compute SHA-256 from the artifact bytes and require that
   `artifact_sha256` to equal the receipt and fresh inspection metadata, then
   bind the digest and artifact path to the ledger row. Transition that exact
   reservation to `built`; commit the canonical version fields, ledger row,
   receipt, and artifact metadata together as the release checkpoint.
5. Transition the reservation to `committed` once when land succeeds. If
   allocation or build fails, transition the reserved row to `failed` using
   failure evidence; do not invent a placeholder artifact, metadata file, or
   digest.
   The failed reservation remains consumed.
   Only an explicit retry may re-read both floors and allocate a new higher code
   for the same source/platform; never call the build again with the old failed
   reservation.

Development allocation state and development receipts are forbidden inputs to
this state machine. Adapter-managed canonical mobile fields are also excluded
from the generic version bump below: that generic bump must not create a second
canonical allocation.

Before pushing, prepare the release. Commit order matters for bisectability:
1. Infrastructure changes (config, build, CI) first
2. Models + their tests
3. Controllers/services + their tests
4. VERSION + CHANGELOG last (single atomic commit)

The final VERSION + CHANGELOG commit should include:
```
chore: bump version and changelog (vX.Y.Z.W)

Constraint: <any active constraints from the feature>
Scope-risk: narrow
```

**2a. Version bump** — 4-digit `MAJOR.MINOR.PATCH.MICRO` format:

Read current version from `package.json`, `VERSION`, `Cargo.toml`, or equivalent.

**Idempotency check first:** compare the VERSION value on the base branch vs HEAD.
If already bumped (values differ), skip the bump entirely.

```bash
BASE_VERSION=$(git show main:VERSION 2>/dev/null || echo "0.0.0.0")
HEAD_VERSION=$(cat VERSION 2>/dev/null || echo "0.0.0.0")
if [ "$BASE_VERSION" != "$HEAD_VERSION" ]; then
  echo "VERSION already bumped ($BASE_VERSION -> $HEAD_VERSION), skipping"
fi
```

Bump level rules:
- **MICRO** (+0.0.0.1): fewer than 50 changed lines, trivial fix, no new files
- **PATCH** (+0.0.1.0): 50+ changed lines, no feature signals
- **MINOR** (+0.1.0.0): feature signals detected — ASK user before bumping
  - Feature signals: new routes, new migrations, new test files, `feat/` branch prefix
- **MAJOR** (+1.0.0.0): milestones only — ALWAYS ASK user

Bumping a digit resets all digits to its right to 0.
Example: `1.3.2.7` with PATCH bump becomes `1.3.3.0`.

**2b. CHANGELOG update**:

1. Read the existing CHANGELOG.md header to match its formatting style
2. Enumerate all commits on the branch: `git log --oneline main..HEAD`
3. Group changes by theme using conventional headings:
   - **Added** — new capabilities the user can now use
   - **Changed** — modifications to existing behavior
   - **Fixed** — bug fixes
   - **Removed** — features or code removed
4. Lead each bullet with what the user can now DO, not what the code does
   - Good: "Users can now reset passwords via email link"
   - Bad: "Added resetPassword() method to AuthService"
5. Cross-check: every commit in the log MUST map to at least one bullet.
   If a commit is missing, either add a bullet or justify the omission (e.g., pure refactor with no user-visible change).
6. Create `CHANGELOG.md` if it doesn't exist

**2c. Test audit** with coverage diagram:

Require the full test suite at this release boundary. Use focused mapped checks during iteration. At the release boundary, require a
complete passing validation run for the candidate. Reuse that result only when
its recorded source/input hashes, validator set, command options, runtime and
relevant environment still match; elapsed time or an earlier green message is
not evidence. A changed input, actual failure, or gate requiring fresh external
state invalidates the affected result. Missing provenance requires a new run.
Keep post-commit relevant checks and actual post-promotion/install verification.
Unknown/global and unmapped-surface test selection retain their full-coverage
semantics. Never treat provider unavailability or skipped tests as passing.

Report total tests, passing, failing, new tests added, and whether matching evidence was reused or a new run was required.
If any tests fail: STOP — fix in worktree before proceeding.

Then produce a code path coverage diagram for every changed source file:

```
CODE PATH COVERAGE
[+] src/services/billing.ts
    ├── processPayment()
    │   ├── [★★★ TESTED] Happy path + card declined
    │   └── [GAP] Network timeout — NO TEST
    ├── refundPayment()
    │   └── [★★ TESTED] Happy path only
[+] src/controllers/checkout.ts
    ├── handleCheckout()
    │   └── [★ TESTED] Smoke test, no edge cases
```

Quality ratings:
- ★★★ — edge cases covered (happy path + error paths + boundary conditions)
- ★★ — happy path tested
- ★ — smoke test only (function called, result not deeply verified)

**Coverage gate:**
- Default minimum: 60% of changed code paths must have at least ★ coverage
- Target: 80% of changed code paths at ★★ or above
- **< 30%:** HARD STOP — do not ask, do not proceed. Route back to `write-e2e`. Untested code does not land.
- **30–59%:** WARN and ask user whether to proceed or write more tests
- **≥ 60%:** proceed (target: push toward 80% in the next iteration)

### Step 3a: Push the branch

Before any detached local commit or remote promotion, mint and consume the
single-use capability at the mutation boundary. The command after `--` is part
of the capability tuple: mint and exec MUST receive byte-identical argv. Local
land accepts only `git commit -m <message>`; remote promotion accepts only
`git push origin <exact-head-sha>:refs/heads/<exact-branch>` or `node scripts/merge-pr-with-review-receipt.mjs --pr <pr-number> --squash --delete-branch --expected-repo <owner/repo> --expected-head <branch> --expected-head-sha <sha>`. Flags that widen the staged tree, bypass hooks, rewrite
history, or change the destination are rejected before capability consumption.

```bash
COMMAND=(git commit -m "$COMMIT_MESSAGE")
MINT="$(node scripts/svc-owner-recovery.mjs promote-mint \
  --repo "$REPO" --worktree "$WORKTREE" --state-root "$WORKTREE/.svc/runtime" \
  --wi "$WI" --generation "$GENERATION" --task "$LAND_TASK" \
  --environment local --operation local-land -- "${COMMAND[@]}")"
CAPABILITY="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(x.capability.capability_id)' "$MINT")"
TOKEN="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(x.token)' "$MINT")"
node scripts/svc-owner-recovery.mjs promote-exec \
  --repo "$REPO" --worktree "$WORKTREE" --state-root "$WORKTREE/.svc/runtime" \
  --wi "$WI" --generation "$GENERATION" --task "$LAND_TASK" \
  --environment local --operation local-land --capability "$CAPABILITY" --token "$TOKEN" \
  -- "${COMMAND[@]}"
```

The same boundary is mandatory for the exact remote command. Do not run raw
`git push` or `gh pr merge` after a capability has been minted for another argv.

Still in the worktree, mint and consume a fresh capability for the exact push
(the local-commit capability is already consumed and cannot authorize this):

```bash
COMMAND=(git push origin "$HEAD_SHA:refs/heads/$BRANCH")
MINT="$(node scripts/svc-owner-recovery.mjs promote-mint \
  --repo "$REPO" --worktree "$WORKTREE" --state-root "$WORKTREE/.svc/runtime" \
  --wi "$WI" --generation "$GENERATION" --task "$LAND_TASK" \
  --environment remote --operation remote-promotion -- "${COMMAND[@]}")"
CAPABILITY="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(x.capability.capability_id)' "$MINT")"
TOKEN="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(x.token)' "$MINT")"
node scripts/svc-owner-recovery.mjs promote-exec \
  --repo "$REPO" --worktree "$WORKTREE" --state-root "$WORKTREE/.svc/runtime" \
  --wi "$WI" --generation "$GENERATION" --task "$LAND_TASK" \
  --environment remote --operation remote-promotion --capability "$CAPABILITY" --token "$TOKEN" \
  -- "${COMMAND[@]}"
```

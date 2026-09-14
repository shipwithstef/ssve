#!/usr/bin/env bash
# Tier-1: No uncovered .svc residue.
#
# Every path under any `.svc/` directory must be deterministically classified as
# exactly one of:
#   - durable ledger      -> tracked + committed (e.g. *-evidence.md, archive/, the
#                            append-only *.jsonl audit ledgers)
#   - machine-local cache -> gitignore-covered  (runtime state, telemetry, test
#                            fixtures, session/loop guard state)
# There is no third "tracked-but-runtime" or "untracked-and-uncovered" category.
#
# This validator fails when an UNTRACKED, NON-IGNORED file appears under a `.svc/`
# directory (root or nested) — the "residue" class that kept showing up in
# `git status`. `git status --porcelain` already excludes .gitignore-covered
# paths, so anything it still reports under `.svc/` is genuinely uncovered and
# must be either gitignored (cache) or committed (ledger).
#
# Tier-1 promotion note (rules/tier-1-promotion.md):
#   validator_path: test-framework/evals/tier-1/validate-no-svc-residue.sh
#   failure_class:  uncovered .svc residue leaking into git status (machine-local
#                   runtime/telemetry/test-fixture state with no gitignore rule and
#                   no closing guard)
#   promotion_signal: #1 — failure class observed repeatedly (trajectory-patterns.json
#                   orphaned cache + test-framework/evals/tier-1/.svc/** eval fixtures,
#                   plus prior app/**/.svc leaks cleaned in #73); user reported "I keep
#                   seeing some residues". Also #3 — guards the tier-1 hot path against
#                   eval runs dirtying the worktree.
#   expected_runtime_budget: < 1s (single `git status` call, no network/LLM/credentials)
#   why_tier_2_or_targeted_is_insufficient: residue accrues silently across ANY session
#                   (every eval run, every hook write); only an always-on lint catches it
#                   before it reaches a commit/PR. A targeted script would have to be
#                   remembered to run — the exact discipline gap that let it leak.

set -uo pipefail

# Keep standalone invocation isolated from active host/session state.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/fixture-home.sh"
svc_require_fixture "$@"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

NAME="validate-no-svc-residue"

# Untracked (??) files anywhere under a `.svc/` directory segment. --porcelain
# omits gitignored paths, so survivors are uncovered by definition. -z + a NUL
# read keeps paths with spaces intact.
#
# Fail CLOSED if git status itself errors. Write to a temp file and check the exit
# code BEFORE parsing: a process-substitution `< <(git status)` swallows git's
# failure and the empty loop would print PASS — a fail-open on the validator's only
# evidence source (codex review MEDIUM, 2026-06-17). A temp file (not a $() capture)
# is used because $() strips the NUL delimiters that -z relies on for space-safe paths.
status_file="$(mktemp)"
trap 'rm -f "$status_file"' EXIT
if ! git status --porcelain=v1 -z --untracked-files=all >"$status_file" 2>/dev/null; then
  echo "FAIL: $NAME — \`git status\` failed; cannot verify .svc residue (failing closed)"
  exit 1
fi

residue=()
while IFS= read -r -d '' entry; do
  status="${entry:0:2}"
  pathname="${entry:3}"
  [[ "$status" == "??" ]] || continue
  [[ "$pathname" == .svc/* || "$pathname" == *"/.svc/"* ]] || continue
  residue+=("$pathname")
done < "$status_file"

if [[ ${#residue[@]} -eq 0 ]]; then
  echo "PASS: $NAME — no uncovered .svc residue"
  exit 0
fi

echo "FAIL: $NAME — uncovered .svc residue in working tree:"
for p in "${residue[@]}"; do
  echo "  ?? $p"
done
echo ""
echo "Each path must be classified and disposed:"
echo "  - machine-local cache / runtime / test-fixture -> add a .gitignore rule"
echo "  - durable ledger / evidence                    -> commit it"
echo "Leaving it untracked-and-uncovered is not a valid disposition."
exit 1

#!/usr/bin/env bash
# Tier 1: prove that `worktree.sh remove` re-points host-skill symlinks at the
# canonical main BEFORE deleting a worktree. If the script removed first and
# repointed second (or never), every dangling link would silently break the
# next session's hooks until SessionStart self-heal fired.
#
# Permafix companion to validate-setup-worktree-canonical-resolution.sh.
# Together they pin both ENDS of the AP-30 lifecycle:
#   setup-side:       symlinks never get pointed at a worktree in the first place
#   worktree.sh-side: even if some upstream actor poisoned them, removal heals first
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
WT_BIN="$REPO_ROOT/scripts/worktree.sh"

if [[ ! -x "$WT_BIN" ]]; then
  echo "FAIL: $WT_BIN not executable"
  exit 1
fi

# Confirm the safety block exists in worktree.sh — structural check.
# This is a fast tier-1 check (does NOT actually run worktree.sh remove because
# that requires a real worktree + filesystem mutation; we leave the behavioral
# integration test to tier-2).
if ! grep -q 'AP-30 safety' "$WT_BIN"; then
  echo "FAIL: worktree.sh missing AP-30 safety block"
  exit 1
fi

if ! grep -q 'host-skill symlink' "$WT_BIN"; then
  echo "FAIL: worktree.sh AP-30 block missing host-skill symlink detection"
  exit 1
fi

# Verify the safety block runs BEFORE `git worktree remove`, not after.
# Fail if the AP-30 block lives below the actual remove line.
ap30_line=$(grep -n 'AP-30 safety' "$WT_BIN" | head -1 | cut -d: -f1)
remove_line=$(grep -n 'git worktree remove' "$WT_BIN" | head -1 | cut -d: -f1)

if [[ -z "$ap30_line" || -z "$remove_line" ]]; then
  echo "FAIL: could not locate AP-30 block or git worktree remove line"
  exit 1
fi

if [[ "$ap30_line" -ge "$remove_line" ]]; then
  echo "FAIL: AP-30 safety block (line $ap30_line) is NOT before git worktree remove (line $remove_line)"
  echo "  Re-pointing AFTER removal does not prevent dangling — must run BEFORE."
  exit 1
fi

# Verify every provisioned host skill root is covered.
mapfile -t HOST_ROOT_PATTERNS < <(python3 - "$REPO_ROOT" <<'PY'
import glob, json, os, re, sys
root = sys.argv[1]
for manifest_path in sorted(glob.glob(os.path.join(root, "provision/hosts/*.json"))):
    with open(manifest_path) as f:
        manifest = json.load(f)
    expanded = os.path.expanduser(manifest["skills_path"])
    rel = expanded.replace(os.path.expanduser("~") + "/", "")
    print(re.escape(rel))
PY
)

for host_root in "${HOST_ROOT_PATTERNS[@]}"; do
  if ! grep -qE "$host_root" "$WT_BIN"; then
    echo "FAIL: worktree.sh AP-30 block missing host root pattern: $host_root"
    exit 1
  fi
done

# Verify the bypass env var exists for emergency override.
if ! grep -q 'SVC_WORKTREE_SKIP_AP30_CHECK' "$WT_BIN"; then
  echo "FAIL: worktree.sh missing SVC_WORKTREE_SKIP_AP30_CHECK escape hatch"
  exit 1
fi

echo "OK: worktree-remove-ap30-safety — structural checks pass"

#!/usr/bin/env bash
# Tier 1: Validate that every file in the framework's _shared/ directory is
# reachable from every detected host install on the machine.
#
# Iterates provision/hosts/*.json install paths. For each that exists, asserts
# every <root>/_shared/<file> is reachable through the install path's _shared
# dir-symlink (single dir-symlink per host; files are path-through, not
# individually symlinked).
#
# Exits 0 on full pass, 0 with skip-message if no host installs detected
# (CI-like environment), non-zero on any miss.
#
# WI-137
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SHARED_DIR="$REPO_ROOT/_shared"

if [ ! -d "$SHARED_DIR" ]; then
  echo "FAIL: framework _shared/ directory not found at $SHARED_DIR" >&2
  exit 1
fi

# Enumerate framework _shared/ files at runtime — do NOT hardcode names
mapfile -t SHARED_FILES < <(cd "$SHARED_DIR" && find . -maxdepth 1 -type f -printf '%f\n' | sort)

if [ "${#SHARED_FILES[@]}" -eq 0 ]; then
  echo "WARN: framework _shared/ is empty — nothing to validate" >&2
  exit 0
fi

mapfile -t HOSTS < <(python3 - "$REPO_ROOT" <<'PY'
import glob, json, os, sys
root = sys.argv[1]
for manifest_path in sorted(glob.glob(os.path.join(root, "provision/hosts/*.json"))):
    with open(manifest_path) as f:
        manifest = json.load(f)
    print(f"{manifest['host']}|{os.path.expanduser(manifest['skills_path'])}")
PY
)

DETECTED=0
FAIL=0

for entry in "${HOSTS[@]}"; do
  host="${entry%%|*}"
  install_path="${entry#*|}"
  [ ! -d "$install_path" ] && continue

  source_repo=""
  if [ -f "$install_path/.source-repo" ]; then
    source_repo="$(cat "$install_path/.source-repo" 2>/dev/null || true)"
  fi
  if [ -z "$source_repo" ]; then
    echo "SKIP $host (not an svc-owned install; missing .source-repo at $install_path)"
    continue
  fi
  source_real="$(realpath "$source_repo" 2>/dev/null || true)"
  repo_real="$(realpath "$REPO_ROOT" 2>/dev/null || true)"
  if [ -n "$source_real" ] && [ -n "$repo_real" ] && [ "$source_real" != "$repo_real" ]; then
    echo "SKIP $host (installed from $source_real, not repo under test)"
    continue
  fi

  DETECTED=$((DETECTED + 1))

  shared_link="$install_path/_shared"

  # Step a: parent dir-symlink exists and is followable
  if [ ! -e "$shared_link" ]; then
    echo "MISS $host _shared (path missing: $shared_link)"
    FAIL=$((FAIL + 1))
    continue
  fi

  # Step b: resolve parent symlink and assert it ends in /_shared and lives
  # next to a real framework checkout (sibling-marker check)
  resolved="$(readlink -f "$shared_link" 2>/dev/null || true)"
  if [ -z "$resolved" ]; then
    echo "MISS $host _shared (readlink resolution failed)"
    FAIL=$((FAIL + 1))
    continue
  fi

  case "$resolved" in
    */_shared)
      ;;
    *)
      echo "MISS $host _shared (resolved target does not end in /_shared: $resolved)"
      FAIL=$((FAIL + 1))
      continue
      ;;
  esac

  framework_root="$(dirname "$resolved")"
  if [ ! -f "$framework_root/setup" ] || [ ! -f "$framework_root/skills-manifest.json" ]; then
    echo "MISS $host _shared (resolved target is not inside an svc framework checkout: $resolved)"
    FAIL=$((FAIL + 1))
    continue
  fi

  # Step c: per-file existence through the dir-symlink (do NOT use -L per file)
  host_fail=0
  for f in "${SHARED_FILES[@]}"; do
    if [ -e "$shared_link/$f" ]; then
      echo "OK $host $f"
    else
      echo "MISS $host $f"
      host_fail=$((host_fail + 1))
    fi
  done
  FAIL=$((FAIL + host_fail))
done

if [ "$DETECTED" -eq 0 ]; then
  echo "no host installs detected; skipping reachability check"
  exit 0
fi

echo "---"
echo "Hosts detected: $DETECTED  |  Files checked per host: ${#SHARED_FILES[@]}  |  Misses: $FAIL"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0

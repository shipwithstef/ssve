#!/bin/bash
# check-install-drift.sh — detect skills present in framework source but not installed.
#
# Exit 0: no drift (every source skill has a symlink at SKILLS_TARGET pointing back)
# Exit 1: drift detected (prints missing + stale list)
#
# Usage:
#   ./scripts/check-install-drift.sh                         # uses default claude host
#   ./scripts/check-install-drift.sh --host claude|codex|kimi|mimo-code # any provisioned manifest
#   ./scripts/check-install-drift.sh --quiet                 # exit code only, no output
#
# Rationale: the `setup` installer picks up any dir containing SKILL.md, but it's
# a manual run. After `git pull` on the framework repo, freshly-added skills stay
# invisible until setup is re-run. Users don't know they need to.
# This script surfaces the gap so `setup` can re-run be suggested, or a session-start
# hook can auto-fire.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd -P)"
INSTALL_SOURCE_DIR="$(realpath "$SCRIPT_DIR" 2>/dev/null || echo "$SCRIPT_DIR")"
if [[ "$SCRIPT_DIR" == *"/.worktrees/"* ]] && command -v git >/dev/null 2>&1; then
  # Consume the full producer stream under pipefail. An early `awk ... exit`
  # closes the pipe while `git worktree list` is still writing and turns a valid
  # worktree check into SIGPIPE/141, which pre-commit misclassifies as host drift.
  CANONICAL_WORKTREE="$(git -C "$SCRIPT_DIR" worktree list --porcelain 2>/dev/null | awk '/^worktree / && !found {print substr($0,10); found=1}')"
  if [ -n "$CANONICAL_WORKTREE" ] && [ -d "$CANONICAL_WORKTREE" ]; then
    INSTALL_SOURCE_DIR="$(cd "$CANONICAL_WORKTREE" && pwd)"
  fi
fi
HOST="claude"
HOST_EXPLICIT=0
ALL_HOSTS=0
QUIET=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      if [ $# -lt 2 ] || [[ "$2" == -* ]]; then
        echo "ERROR: --host requires an argument" >&2
        exit 2
      fi
      HOST="$2"; HOST_EXPLICIT=1; shift 2 ;;
    --all-hosts) ALL_HOSTS=1; shift ;;
    --quiet) QUIET=1; shift ;;
    -h|--help)
      cat <<'EOF'
check-install-drift.sh — detect skills present in source but not installed

Usage:
  ./scripts/check-install-drift.sh [options]

Options:
  --host <name>    Target a specific host manifest (default: claude)
                   Supported hosts: claude, codex, kimi, gemini, opencode, mimo-code, antigravity, cursor, grok
  --all-hosts      Check install drift across all provisioned hosts
  --quiet          Exit code only, no output
  -h, --help       Show this help message
EOF
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 2 ;;
  esac
done

if ! [[ "$HOST" =~ ^[a-z0-9-]+$ ]]; then
  echo "ERROR: invalid host name: $HOST" >&2
  exit 2
fi

if [ "$ALL_HOSTS" -eq 1 ] && [ "$HOST_EXPLICIT" -eq 1 ]; then
  echo "ERROR: --host and --all-hosts are mutually exclusive" >&2
  exit 2
fi

if [ "$ALL_HOSTS" -eq 1 ]; then
  ALL_HOST_NAMES=()
  for hf in "$SCRIPT_DIR/provision/hosts/"*.json; do
    [ -f "$hf" ] || continue
    hbase="$(basename "$hf")"
    ALL_HOST_NAMES+=("${hbase%.json}")
  done
  if [ "${#ALL_HOST_NAMES[@]}" -eq 0 ]; then
    echo "ERROR: no provisioned host manifests found" >&2
    exit 2
  fi
  failed=0
  for host_name in "${ALL_HOST_NAMES[@]}"; do
    args=(--host "$host_name")
    [ "$QUIET" -eq 1 ] && args+=(--quiet)
    if ! bash "$SCRIPT_DIR/scripts/check-install-drift.sh" "${args[@]}"; then
      failed=1
    fi
  done
  if [ "$failed" -eq 0 ] && [ "$QUIET" -eq 0 ]; then
    echo "OK: all ${#ALL_HOST_NAMES[@]} provisioned hosts have zero install drift"
  fi
  exit "$failed"
fi

HOST_MANIFEST="$SCRIPT_DIR/provision/hosts/$HOST.json"
if [ ! -f "$HOST_MANIFEST" ]; then
  echo "Unknown host: $HOST"
  exit 2
fi

if command -v node >/dev/null 2>&1 && [ -f "$SCRIPT_DIR/scripts/validate-host-authority-capabilities.mjs" ]; then
  if ! node "$SCRIPT_DIR/scripts/validate-host-authority-capabilities.mjs" --root "$SCRIPT_DIR" >/dev/null; then
    echo "Invalid authority capability declarations in provision/hosts"
    exit 2
  fi
fi

SKILLS_TARGET=$(python3 -c "
import json, os
m = json.load(open('$HOST_MANIFEST'))
print(os.path.expanduser(m['skills_path']))
")

SKIP_DIRS=$(python3 -c "
import json
m = json.load(open('$HOST_MANIFEST'))
for d in m.get('skip', []):
    print(d)
" 2>/dev/null)

# Enumerate packaged source skills (dirs with SKILL.md), minus skip list. The
# installed target remains flat: $SKILLS_TARGET/$name.
SOURCE_SKILLS=()
for d in "$SCRIPT_DIR/skills"/*/; do
  name="$(basename "$d")"
  [ -f "$d/SKILL.md" ] || continue
  if echo "$SKIP_DIRS" | grep -q "^${name}$" 2>/dev/null; then
    continue
  fi
  SOURCE_SKILLS+=("$name")
done

INFRA_FILES=()
INFRA_DIRS=()
while IFS= read -r rel; do [ -n "$rel" ] && INFRA_FILES+=("$rel"); done < <(python3 -c "import json; print('\\n'.join(json.load(open('$HOST_MANIFEST')).get('infra_files', [])))")
while IFS= read -r rel; do [ -n "$rel" ] && INFRA_DIRS+=("$rel"); done < <(python3 -c "import json; print('\\n'.join(json.load(open('$HOST_MANIFEST')).get('infra_dirs', [])))")

MISSING=()
STALE=()
BROKEN_EXTRA=()
FOREIGN_WORKSPACE=()
WORKTREE_BOUND=()

for name in "${SOURCE_SKILLS[@]}"; do
  target="$SKILLS_TARGET/$name"
  source_path="$INSTALL_SOURCE_DIR/skills/$name"

  if [ ! -e "$target" ]; then
    MISSING+=("$name")
    continue
  fi

  # If it's a symlink, confirm it points back at source
  if [ -L "$target" ]; then
    resolved=$(realpath "$target" 2>/dev/null || readlink -f "$target" 2>/dev/null || python3 -c "import os; print(os.path.realpath('$target'))" 2>/dev/null || echo "")
    expected=$(realpath "$source_path" 2>/dev/null || readlink -f "$source_path" 2>/dev/null || python3 -c "import os; print(os.path.realpath('$source_path'))" 2>/dev/null || echo "")
    if [ "$resolved" != "$expected" ]; then
      STALE+=("$name (symlink → $resolved, expected $expected)")
    fi
  else
    # Installed as a copy, not a symlink — OK but flag as stale because it won't track source updates
    STALE+=("$name (installed as copy, not symlink — won't track source updates)")
  fi
done

# The setup digest shortcut is valid only when every manifest-owned installed
# surface is present and points to the canonical source, not merely the skills.
for rel in "${INFRA_FILES[@]}" "${INFRA_DIRS[@]}"; do
  target="$SKILLS_TARGET/$rel"
  source_path="$INSTALL_SOURCE_DIR/$rel"
  # Kimi cannot consume the universal rules directory directly. setup therefore
  # materializes KIMI.md as a managed copy before injecting the rule block. The
  # content-specific check below proves its source prefix is current, so treating
  # this intentional regular file as a missing infrastructure symlink creates a
  # permanent false drift after every successful Kimi install.
  if [ "$HOST" = "kimi" ] && [ "$rel" = "KIMI.md" ] && [ -f "$target" ] && [ ! -L "$target" ]; then
    continue
  fi
  if [ ! -L "$target" ]; then
    MISSING+=("$rel (infrastructure link missing)")
    continue
  fi
  resolved=$(realpath "$target" 2>/dev/null || readlink -f "$target" 2>/dev/null || true)
  expected=$(realpath "$source_path" 2>/dev/null || readlink -f "$source_path" 2>/dev/null || true)
  [ "$resolved" = "$expected" ] || STALE+=("$rel (infrastructure link → $resolved, expected $expected)")
done
if [ ! -f "$SKILLS_TARGET/.source-repo" ] || [ "$(cat "$SKILLS_TARGET/.source-repo" 2>/dev/null || true)" != "$INSTALL_SOURCE_DIR" ]; then
  STALE+=(".source-repo (missing or not bound to canonical source)")
fi

# Extra broken symlinks are not part of the source skill set, but hosts still
# scan them. Report them as drift so setup can prune them.
while IFS= read -r -d '' link; do
  name="$(basename "$link")"
  target="$(readlink "$link" 2>/dev/null || true)"
  BROKEN_EXTRA+=("$name (broken symlink → $target)")
done < <(find "$SKILLS_TARGET" -maxdepth 1 -xtype l -print0 2>/dev/null)

# Valid symlinks into another app workspace are not automatically wrong, but
# they are a common leftover of project-local skill installs. Surface them as a
# warning so users can remove accidental global contamination deliberately.
while IFS= read -r -d '' link; do
  name="$(basename "$link")"
  target="$(realpath "$link" 2>/dev/null || readlink -f "$link" 2>/dev/null || python3 -c "import os; print(os.path.realpath('$link'))" 2>/dev/null || true)"
  if [[ "$target" == *"/.worktrees/"* ]]; then
    WORKTREE_BOUND+=("$name (host skill points into a git worktree → $target)")
    continue
  fi
  if [[ "$target" == "$INSTALL_SOURCE_DIR"* ]]; then
    continue
  fi
  if [[ "$target" == "$HOME/.svc/"* ]]; then
    continue
  fi
  if [[ "$target" == "$HOME/.claude/skills/"* || "$target" == "$HOME/.agents/skills/"* || "$target" == "$HOME/.codex/skills/"* ]]; then
    continue
  fi
  if [[ "$target" == "$HOME/app-workspaces/"* || "$target" == /home/*/app-workspaces/* ]]; then
    FOREIGN_WORKSPACE+=("$name (global host skill points into another workspace → $target)")
  fi
done < <(find "$SKILLS_TARGET" -maxdepth 1 -type l -print0 2>/dev/null)

# ---------------------------------------------------------------------------
# Check KIMI.md content drift (setup breaks symlink to inject rules)
# ---------------------------------------------------------------------------
KIMI_DRIFT=0
if [ -f "$SCRIPT_DIR/KIMI.md" ] && [ -f "$SKILLS_TARGET/KIMI.md" ]; then
  # Extract base content from installed copy (everything before auto-injected rules)
  INSTALLED_BASE=$(python3 -c "
import sys
with open('$SKILLS_TARGET/KIMI.md', 'r') as f:
    content = f.read()
marker = '<!-- svc-auto-rules-begin -->'
idx = content.find(marker)
if idx >= 0:
    base = content[:idx].rstrip()
    if base.endswith('---'):
        base = base[:-3].rstrip()
    sys.stdout.write(base)
else:
    sys.stdout.write(content.rstrip())
" 2>/dev/null)
  SOURCE_BASE=$(python3 -c "
import sys
with open('$SCRIPT_DIR/KIMI.md', 'r') as f:
    sys.stdout.write(f.read().rstrip())
" 2>/dev/null)
  if [ "$INSTALLED_BASE" != "$SOURCE_BASE" ]; then
    KIMI_DRIFT=1
    STALE+=("KIMI.md (source content changed since setup — run ./setup --host $HOST to re-sync)")
  fi
fi

# ---------------------------------------------------------------------------
# Check host settings.json hook command paths resolve (WI-124)
# Catches the "Cannot find module svc-stop-quality.js" class of error caused
# by stale absolute paths in ~/.claude/settings.json after a worktree-based
# setup repointed them, then the worktree was removed.
# ---------------------------------------------------------------------------
SETTINGS_PATH=""
if [ "$HOST" = "claude" ]; then
  SETTINGS_PATH="$HOME/.claude/settings.json"
fi
if [ -n "$SETTINGS_PATH" ] && [ -f "$SETTINGS_PATH" ]; then
  MISSING_HOOK_PATHS=$(python3 -c "
import json, re, os
try:
    d = json.load(open('$SETTINGS_PATH'))
except Exception:
    raise SystemExit(0)
missing = []
for event, arr in (d.get('hooks') or {}).items():
    if not isinstance(arr, list):
        continue
    for me in arr:
        for h in (me.get('hooks') or []):
            cmd = h.get('command') or ''
            for tok in cmd.split():
                tok = tok.strip('\"').strip(\"'\")
                if re.match(r'^/.+\.(m?js|sh)\$', tok):
                    if not os.path.exists(tok):
                        missing.append(event + ': ' + tok)
for m in missing:
    print(m)
" 2>/dev/null)
  if [ -n "$MISSING_HOOK_PATHS" ]; then
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      STALE+=("settings.json hook path missing — $line")
    done <<< "$MISSING_HOOK_PATHS"
  fi
fi

# ---------------------------------------------------------------------------
# Check AGENTS.md exists (framework repo manages this — /init should not overwrite)
# ---------------------------------------------------------------------------
AGENTS_WARNING=0
if [ -f "$SCRIPT_DIR/AGENTS.md" ] && [ ! -L "$SKILLS_TARGET/AGENTS.md" ]; then
  # AGENTS.md is not installed at SKILLS_TARGET — it's read from project dir.
  # No drift to report, but note that /init should not be run here.
  AGENTS_WARNING=1
fi

# ---------------------------------------------------------------------------
# WI-487: surface an ephemeral/dangling installed enforcement source + a
# missing/stale durable launcher. Reads the per-host install receipt as EVIDENCE
# ONLY and re-realpaths + reclassifies the live source/launcher before reporting.
# ---------------------------------------------------------------------------
ENFORCE_DRIFT=()
if command -v node >/dev/null 2>&1 && [ -f "$SCRIPT_DIR/hooks/lib/enforcement-core.mjs" ]; then
  ENFORCE_REPORT=$(_SVC_HOST="$HOST" _SVC_REPO="$SCRIPT_DIR" node --input-type=module <<'NODE_ENF' 2>/dev/null || true
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
(async () => {
  const repo = process.env._SVC_REPO;
  const host = process.env._SVC_HOST;
  const manifest = JSON.parse(fs.readFileSync(path.join(repo, "provision", "hosts", `${host}.json`), "utf8"));
  if (!manifest.wiring?.governed) return;
  const core = await import(pathToFileURL(path.join(repo, "hooks/lib/enforcement-core.mjs")).href);
  const routingLib = await import(pathToFileURL(path.join(repo, "scripts/lib/governed-routing.mjs")).href);
  let stateRoot;
  try { stateRoot = core.resolveStateRoot(process.env); core.assertStateRootSecure(stateRoot); } catch (e) { console.log(`DRIFT insecure/unresolvable state root: ${e && e.message}`); return; }
  const receiptPath = path.join(stateRoot, "install-state", `${host}.json`);
  // Nothing recorded -> nothing to reconcile (setup writes the receipt).
  const encDir = path.join(stateRoot, "enforcement", core.MIGRATION_VERSION);
  if (!fs.existsSync(receiptPath) && !fs.existsSync(encDir)) return;
  // F-012: validate the receipt against the FULL schema, bound to THIS host +
  // migration version, through a no-follow ancestry boundary. A present-but-invalid
  // receipt is itself drift.
  const receipt = core.validateInstallReceipt(receiptPath, { host, stateRoot });
  if (!receipt) { console.log(`DRIFT install receipt for ${host} is missing/invalid/foreign (schema+identity+ancestry) (recovery: ./setup --host ${host})`); return; }
  const srcClass = core.classifySource(receipt.effective_source, { requireExecutable: false });
  if (srcClass !== "durable-canonical") console.log(`DRIFT installed enforcement source is ${srcClass}: ${receipt.effective_source} (recovery: ./setup --host ${host})`);
  if (!core.launcherRunnable(receipt.launcher_path, { boundary: stateRoot })) console.log(`DRIFT durable launcher missing/dangling/insecure: ${receipt.launcher_path} (recovery: ./setup --host ${host})`);
  // F-012: the live skills pointer must still resolve to the durable effective source.
  try {
    const ptr = fs.readFileSync(path.join(receipt.skills_path, ".source-repo"), "utf8").trim();
    if (ptr !== receipt.effective_source) console.log(`DRIFT skills pointer '${ptr}' != effective source '${receipt.effective_source}' (recovery: ./setup --host ${host})`);
  } catch { console.log(`DRIFT skills pointer unreadable at ${receipt.skills_path}/.source-repo (recovery: ./setup --host ${host})`); }
  // F-012: parse the host's ACTUAL installed governed command and assert it STILL
  // routes through the durable launcher (a command that drifted back to a direct
  // checkout path is drift even when the receipt is present).
  try {
    const man = JSON.parse(fs.readFileSync(path.join(repo, "provision", "hosts", `${host}.json`), "utf8"));
    const w = man.wiring || {};
    if (w.governed) {
      let cf = w.config_file || (man.hook_quirks && man.hook_quirks.config_file) || "";
      if (cf.startsWith("~")) cf = path.join(os.homedir(), cf.slice(1));
      else if (!path.isAbsolute(cf)) cf = path.join(os.homedir(), cf);
      let stateConfigPath = w.effective_state?.config_file || "";
      if (stateConfigPath.startsWith("~")) stateConfigPath = path.join(os.homedir(), stateConfigPath.slice(1));
      else if (stateConfigPath && !path.isAbsolute(stateConfigPath)) stateConfigPath = path.join(os.homedir(), stateConfigPath);
      const routing = routingLib.governedRoutingStatus(cf, w, { stateConfigPath });
      if (!routing.ok) console.log(`DRIFT governed command not effective for ${host}: ${routing.reason} (recovery: ./setup --host ${host})`);
    }
  } catch (e) { console.log(`DRIFT governed command unverifiable for ${host}: ${e && e.message} (recovery: ./setup --host ${host})`); }
})();
NODE_ENF
  )
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    case "$line" in DRIFT\ *) ENFORCE_DRIFT+=("${line#DRIFT }") ;; esac
  done <<< "$ENFORCE_REPORT"
fi

TOTAL_DRIFT=$(( ${#MISSING[@]} + ${#STALE[@]} + ${#BROKEN_EXTRA[@]} + ${#WORKTREE_BOUND[@]} + ${#ENFORCE_DRIFT[@]} ))

if [ "$QUIET" -eq 1 ]; then
  [ "$TOTAL_DRIFT" -eq 0 ] && exit 0 || exit 1
fi

if [ "$TOTAL_DRIFT" -eq 0 ]; then
  if [ "$AGENTS_WARNING" -eq 1 ]; then
    echo "OK: all ${#SOURCE_SKILLS[@]} source skills installed. AGENTS.md managed by framework repo — do not run /init here."
  else
    echo "OK: all ${#SOURCE_SKILLS[@]} source skills installed and tracking source at $SKILLS_TARGET"
  fi
  if [ "${#FOREIGN_WORKSPACE[@]}" -gt 0 ]; then
    echo ""
    echo "Warning: global host skills pointing into other app workspaces:"
    for s in "${FOREIGN_WORKSPACE[@]}"; do echo "  - $s"; done
  fi
  exit 0
fi

echo "DRIFT: ${#MISSING[@]} missing, ${#STALE[@]} stale, ${#BROKEN_EXTRA[@]} broken extra, ${#WORKTREE_BOUND[@]} worktree-bound, ${#ENFORCE_DRIFT[@]} enforcement-source (of ${#SOURCE_SKILLS[@]} source skills)"
echo ""

if [ "${#ENFORCE_DRIFT[@]}" -gt 0 ]; then
  echo "Enforcement-source drift (WI-487 — installed enforcement is not durable):"
  for s in "${ENFORCE_DRIFT[@]}"; do echo "  - $s"; done
  echo ""
fi

if [ "${#MISSING[@]}" -gt 0 ]; then
  echo "Missing (not installed):"
  for s in "${MISSING[@]}"; do echo "  - $s"; done
  echo ""
fi

if [ "${#STALE[@]}" -gt 0 ]; then
  echo "Stale (installed but out-of-sync with source):"
  for s in "${STALE[@]}"; do echo "  - $s"; done
  echo ""
fi

if [ "${#BROKEN_EXTRA[@]}" -gt 0 ]; then
  echo "Broken extra symlinks (host may still try to discover these):"
  for s in "${BROKEN_EXTRA[@]}"; do echo "  - $s"; done
  echo ""
fi

if [ "${#WORKTREE_BOUND[@]}" -gt 0 ]; then
  echo "Worktree-bound symlinks (will dangle or drift when worktree is removed):"
  for s in "${WORKTREE_BOUND[@]}"; do echo "  - $s"; done
  echo ""
fi

if [ "${#FOREIGN_WORKSPACE[@]}" -gt 0 ]; then
  echo "Warning: global host skills pointing into other app workspaces:"
  for s in "${FOREIGN_WORKSPACE[@]}"; do echo "  - $s"; done
  echo ""
fi

echo "Recovery: cd $INSTALL_SOURCE_DIR && ./setup --host $HOST"
exit 1

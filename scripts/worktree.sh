#!/usr/bin/env bash
# svc worktree manager
#
# Central utility for creating, entering, promoting from, and cleaning up
# git worktrees. All worktrees live under .worktrees/ in the repo root.
#
# Usage:
#   scripts/worktree.sh create <branch-name> [--from <base>] [--wi WI-N] [--session ID] [--role ROLE]
#   scripts/worktree.sh enter <branch-name>
#   scripts/worktree.sh status
#   scripts/worktree.sh remove <branch-name> [--force] [--session ID]
#   scripts/worktree.sh promote <branch-name>
#   scripts/worktree.sh list
#   scripts/worktree.sh cleanup
#   scripts/worktree.sh preflight
set -euo pipefail

# Find the MAIN repo root, even when called from inside a worktree.
# git rev-parse --show-toplevel returns the worktree root when inside one,
# so we use --git-common-dir to find the shared .git directory, then derive
# the main worktree root from that.
_find_repo_root() {
  local git_common_dir
  git_common_dir="$(git rev-parse --git-common-dir 2>/dev/null)" || return 1
  # git-common-dir returns the path to the shared .git dir
  # For main worktree: .git (relative) or /path/to/.git
  # For linked worktree: /path/to/.git (always absolute)
  if [[ "$git_common_dir" == ".git" ]]; then
    pwd
  else
    # Strip /.git from the end to get the repo root
    dirname "$git_common_dir"
  fi
}

REPO_ROOT="$(_find_repo_root 2>/dev/null || pwd)"
if command -v node >/dev/null 2>&1 && [[ -f "$REPO_ROOT/scripts/lib/resolve-worktree-root.mjs" ]]; then
  WORKTREE_DIR="$(node "$REPO_ROOT/scripts/lib/resolve-worktree-root.mjs" --repo "$REPO_ROOT" --ensure 2>/dev/null || echo "$REPO_ROOT/.worktrees")"
else
  WORKTREE_DIR="$REPO_ROOT/.worktrees"
fi
GITIGNORE="$REPO_ROOT/.gitignore"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}[OK]${NC} $1"; }

# WI-562 IP-H7: .worktree-freeze is ENFORCED at the verb level. The marker holds
# the one directory path edits are restricted to; mutating any OTHER worktree is
# refused. The sole waiver is unfreeze (deleting the marker) — a deliberate,
# visible act with no hidden env bypass.
assert_not_frozen() {
  local target="$1"
  local marker="$REPO_ROOT/.worktree-freeze"
  [[ -f "$marker" ]] || return 0
  local allowed
  allowed="$(cat "$marker" 2>/dev/null || true)"
  if [[ "${target#/}" != "${allowed%/}" && "$target" != "$allowed" ]]; then
    fail "Worktree freeze active: edits restricted to '$allowed' (.worktree-freeze)."
    info "Unfreeze first: scripts/worktree.sh unfreeze"
    exit 1
  fi
}

warn() { echo -e "  ${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "  ${RED}[FAIL]${NC} $1"; }
info() { echo -e "  ${CYAN}[INFO]${NC} $1"; }

_host_session_id() {
  printf '%s' "${SVC_SESSION_ID:-${CURSOR_CONVERSATION_ID:-${CODEX_THREAD_ID:-${CODEX_SESSION_ID:-${CLAUDE_SESSION_ID:-${KIMI_SESSION_ID:-${GEMINI_SESSION_ID:-}}}}}}}"
}

_derive_wi() {
  local branch_name="$1"
  if [[ "$branch_name" =~ WI-([0-9]+) ]]; then
    printf 'WI-%s' "${BASH_REMATCH[1]}"
  elif [[ "$branch_name" =~ (feature|bugfix|refactor)-([0-9]+) ]]; then
    printf 'WI-%s' "${BASH_REMATCH[2]}"
  fi
}

_resolve_wt_path() {
  local branch="$1"
  if [[ -d "$WORKTREE_DIR/$branch" ]]; then
    echo "$WORKTREE_DIR/$branch"
  elif [[ -d "$REPO_ROOT/.worktrees/$branch" ]]; then
    echo "$REPO_ROOT/.worktrees/$branch"
  else
    echo "$WORKTREE_DIR/$branch"
  fi
}

_write_binding() {
  local wt_path="$1" session_id="$2" wi="$3" role="$4"
  if [[ -z "$session_id" ]]; then
    if [[ "$role" == "mutating" ]]; then
      fail "Mutating worktree binding requires --session ID or a host session environment variable"
      return 1
    fi
    info "No host session id available — read-only binding omitted"
    return 0
  fi
  local args=(binding write --worktree-root "$wt_path" --session-id "$session_id" --role "$role")
  [[ "$role" == "mutating" ]] && args+=(--wi "$wi")
  local result warning
  if ! result=$(node "$wt_path/hooks/lib/wi-claim.mjs" "${args[@]}"); then
    warning=$(node -e 'try{process.stdout.write(String(JSON.parse(process.argv[1]).warning||"binding conflict"))}catch{process.stdout.write("binding conflict")}' "$result")
    fail "$warning"
    echo "  Inspect: node $wt_path/hooks/lib/wi-claim.mjs binding status --worktree-root $wt_path --session-id $session_id"
    echo "  Release owned binding: node $wt_path/hooks/lib/wi-claim.mjs binding release --worktree-root $wt_path --session-id $session_id"
    if [[ -n "$wi" ]]; then
      echo "  Transfer stale claim: node $wt_path/hooks/lib/wi-claim.mjs claim transfer --worktree-root $wt_path --wi $wi --expected-generation <generation> --session-id $session_id --role $role"
    fi
    return 1
  fi
  info "Bound session $session_id to ${wi:-read-only} at $wt_path"
  # WI-562 IP-H5 E2: heartbeat touch — every binding write renews the WI claim
  # so pid-less heartbeat-contract claims stay fresh through long sessions.
  if [[ -n "$wi" && -f "$wt_path/.svc/claims/$wi.claim.json" ]]; then
    node "$wt_path/hooks/lib/wi-claim.mjs" claim renew --wi "$wi" --svc-dir "$wt_path/.svc" >/dev/null 2>&1 || true
  fi
}

# WI-549 (AC-549-4): this manager NEVER writes a per-worktree
# .svc/chain-policy.json — a new/resumed worktree observes the SAME
# repository-shared mode as every other worktree. This surfaces the
# resolved mode + provenance (never treats a per-worktree copy as
# authority) at creation time via the single shared resolver.
_print_chain_policy() {
  local wt_path="$1"
  local resolved
  resolved=$(node "$REPO_ROOT/scripts/lib/chain-policy.mjs" --repo "$wt_path" --mode 2>/dev/null || echo "refuse")
  info "Chain policy: mode=$resolved (repository-shared; see: node scripts/lib/chain-policy.mjs --repo \"$wt_path\")"
}

_binding_status_rows() {
  local wt_path="$1"
  node --input-type=module - "$wt_path" <<'NODE_BINDING_STATUS'
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = path.resolve(process.argv[2]);
const claims = await import(pathToFileURL(path.join(root, "hooks", "lib", "wi-claim.mjs")));
const dir = path.join(root, ".svc", "bindings");
if (!fs.existsSync(dir)) process.exit(0);
for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".json")).sort()) {
  try {
    const binding = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    let state = binding.released_at ? "released" : binding.role === "mutating" ? "stale" : "read-only";
    if (!binding.released_at && binding.role === "mutating") {
      const claim = claims.readClaimAbsolute(binding.claim_path);
      const freshness = claims.claimFreshness(claim, binding.claim_path);
      if (freshness.fresh && Number(claim?.generation || 0) === Number(binding.generation || 0)) state = "fresh";
    }
    console.log([binding.wi || "-", binding.worktree_root || root, binding.branch || "-", binding.session_id || "-", binding.generation || "-", state].join("\t"));
  } catch {}
}
NODE_BINDING_STATUS
}

# ============================================================
# PREFLIGHT — safety checks before any worktree operation
# ============================================================
preflight() {
  local errors=0

  echo "=== Worktree Preflight Checks ==="

  if ! git rev-parse --is-inside-work-tree &>/dev/null; then
    fail "Not inside a git repository"
    return 1
  fi
  ok "Inside git repository"

  if [[ ! -f "$GITIGNORE" ]]; then
    fail ".gitignore does not exist — repair it explicitly before creating a worktree"
    errors=$((errors + 1))
  fi

  if [[ -f "$GITIGNORE" ]] && ! grep -q '\.worktrees' "$GITIGNORE"; then
    fail ".gitignore does not ignore .worktrees/ — repair it explicitly before creating a worktree"
    errors=$((errors + 1))
  else
    ok ".gitignore contains .worktrees/"
  fi

  if ! git check-ignore -q "$WORKTREE_DIR/" 2>/dev/null; then
    fail ".worktrees/ is not being ignored by git"
    errors=$((errors + 1))
  else
    ok ".worktrees/ is git-ignored (verified)"
  fi

  if [[ -n "$(git status --porcelain --untracked-files=all 2>/dev/null)" ]]; then
    fail "Checkout is dirty — commit, move, or remove every tracked and untracked change"
    errors=$((errors + 1))
  else
    ok "Working tree is clean"
  fi

  echo ""
  if [[ $errors -gt 0 ]]; then
    fail "Preflight failed with $errors error(s)"
    return 1
  fi
  ok "All preflight checks passed"
  return 0
}

# ============================================================
# GUARD — intelligent worktree check for any skill
#
# Usage: worktree.sh guard --skill <name> --lane <lane> [--branch <name>]
#
# The worktree IS the feature branch. Everything that touches the feature
# runs there — code, tests, E2E, review. Only the squash-merge itself
# and post-merge verification run on main.
#
# Outputs one action:
#   STAY_MAIN      — skill runs on main, already there
#   NEED_WORKTREE  — skill needs a worktree, creates/enters it
#   IN_WORKTREE    — skill needs a worktree, already in one
#   LEAVE_WORKTREE — skill runs on main but we're in a worktree
# ============================================================

# The squash-merge: transitions FROM worktree TO main
PROMOTE_SKILL="land-changeset"

# Post-merge verification on main
POST_MERGE_SKILLS="verify-promotion"

cmd_guard() {
  local skill="" lane="" branch=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --skill) skill="$2"; shift 2 ;;
      --lane)  lane="$2"; shift 2 ;;
      --branch) branch="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  if [[ -z "$skill" ]]; then
    echo "Usage: worktree.sh guard --skill <name> --lane <lane> [--branch <name>]"
    exit 1
  fi

  # Detect current location
  local cwd in_worktree=false current_branch=""
  cwd="$(pwd)"
  if [[ "$cwd" == "$WORKTREE_DIR"/* ]]; then
    in_worktree=true
    current_branch=$(basename "$(echo "$cwd" | sed "s|$WORKTREE_DIR/||" | cut -d/ -f1)")
  fi

  # --- Promoting: transitions from worktree to main ---
  if [[ "$skill" == "$PROMOTE_SKILL" ]]; then
    # land-changeset does the squash-merge FROM main.
    # But it first validates the branch, so the branch must exist.
    if $in_worktree; then
      echo "LEAVE_WORKTREE"
      info "'$skill' squash-merges to main — switch to repo root first"
      echo "  cd $REPO_ROOT"
      return 0
    fi

    local target="${branch:-}"
    if [[ -z "$target" ]]; then
      fail "'$skill' needs --branch to know which worktree to promote"
      return 1
    fi

    if [[ -d "$WORKTREE_DIR/$target" ]] || git show-ref --verify --quiet "refs/heads/$target" 2>/dev/null; then
      echo "STAY_MAIN"
      ok "On main. Branch '$target' ready to promote."
      echo "  Run: scripts/worktree.sh promote $target"
    else
      fail "Branch '$target' not found — nothing to promote"
      return 1
    fi
    return 0
  fi

  # --- Post-merge skills (verification on main, worktree already gone) ---
  local is_post=false
  for s in $POST_MERGE_SKILLS; do
    [[ "$skill" == "$s" ]] && is_post=true
  done

  if $is_post; then
    if $in_worktree; then
      echo "LEAVE_WORKTREE"
      warn "'$skill' runs on main after merge — worktree should already be removed"
      echo "  cd $REPO_ROOT"
    else
      echo "STAY_MAIN"
    fi
    return 0
  fi

  # Every repository mutation, in every lane and phase, belongs in a linked
  # worktree. Read-only inspection does not need to invoke this guard.
  if $in_worktree; then
    echo "IN_WORKTREE"
    ok "In worktree for '$skill'"
    echo "  Branch: $current_branch"
  else
    echo "NEED_WORKTREE"
    if [[ -n "$branch" ]]; then
      local wi
      wi="$(_derive_wi "$branch")"
      info "'$skill' must mutate in the ensured worktree '$branch'"
      echo "  node scripts/svc-ensure-worktree.mjs --wi ${wi:-WI-N} --branch $branch --from origin/main --print-cd"
    else
      warn "'$skill' needs a worktree before its first write; supply --branch"
    fi
  fi
  return 0
}

# ============================================================
# STATUS — detect if currently inside a worktree
# ============================================================
cmd_status() {
  local cwd
  cwd="$(pwd)"

  # Check if we're inside .worktrees/
  if [[ "$cwd" == "$WORKTREE_DIR"/* ]]; then
    local branch_name
    branch_name=$(basename "$(echo "$cwd" | sed "s|$WORKTREE_DIR/||" | cut -d/ -f1)")
    local wt_path="$WORKTREE_DIR/$branch_name"

    echo "=== Worktree Status ==="
    ok "Inside worktree"
    echo "  Branch: $branch_name"
    echo "  Path:   $wt_path"

    while IFS=$'\t' read -r binding_wi binding_path binding_branch binding_owner binding_generation binding_state; do
      [[ -n "$binding_owner" ]] || continue
      echo "  WI:     $binding_wi"
      echo "  Owner:  $binding_owner"
      echo "  Generation: $binding_generation ($binding_state)"
      echo "  Bound path: $binding_path"
      echo "  Bound branch: $binding_branch"
    done < <(_binding_status_rows "$wt_path")

    if (cd "$wt_path" && ! git diff --quiet HEAD 2>/dev/null); then
      echo "  State:  dirty (uncommitted changes)"
    else
      echo "  State:  clean"
    fi

    local commit_count
    commit_count=$(cd "$wt_path" && git rev-list --count main..HEAD 2>/dev/null || echo "?")
    echo "  Commits ahead of main: $commit_count"
    return 0
  fi

  # Check if we're in the main worktree
  if [[ "$cwd" == "$REPO_ROOT"* && "$cwd" != "$WORKTREE_DIR"* ]]; then
    echo "=== Worktree Status ==="
    info "On main worktree (not inside a feature worktree)"

    # Show any active worktrees
    local count=0
    while IFS= read -r line; do
      local wt_path
      wt_path=$(echo "$line" | awk '{print $1}')
      [[ "$wt_path" == "$REPO_ROOT" ]] && continue
      count=$((count + 1))
    done < <(git worktree list)

    if [[ $count -gt 0 ]]; then
      echo "  Active worktrees: $count (use 'worktree.sh list' to see them)"
    fi
    return 1  # not in a worktree
  fi

  echo "=== Worktree Status ==="
  info "Outside svc repository"
  return 1
}

# ============================================================
# CREATE — create a new worktree, or report if it already exists
# ============================================================
cmd_create() {
  local branch_name=""
  local base_ref="origin/main"
  local explicit_wi=""
  local session_id="$(_host_session_id)"
  local role="mutating"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --from) base_ref="$2"; shift 2 ;;
      --wi) explicit_wi="$2"; shift 2 ;;
      --session) session_id="$2"; shift 2 ;;
      --role) role="$2"; shift 2 ;;
      *) branch_name="$1"; shift ;;
    esac
  done

  if [[ -z "$branch_name" ]]; then
    echo "Usage: worktree.sh create <branch-name> [--from <base>]"
    exit 1
  fi

  local wt_path="$WORKTREE_DIR/$branch_name"
  local wt_wi="${explicit_wi:-$(_derive_wi "$branch_name")}"

  # Reject an unbindable mutating worktree before preflight can edit
  # .gitignore or git worktree add can materialize a branch/worktree.
  if [[ "$role" == "mutating" && -z "$session_id" ]]; then
    fail "Mutating worktree binding requires --session ID or a host session environment variable"
    exit 1
  fi
  if [[ "$role" == "mutating" && -z "$wt_wi" ]]; then
    fail "Mutating worktree requires --wi WI-N or a WI-bearing branch"
    exit 1
  fi

  if [[ "$role" == "mutating" ]]; then
    local result created owner ensured_path ensured_branch
    if ! result=$(SVC_SESSION_ID="$session_id" node "$REPO_ROOT/scripts/svc-ensure-worktree.mjs" \
      --wi "$wt_wi" --branch "$branch_name" --from "$base_ref" --json); then
      fail "Could not ensure mutating worktree"
      exit 1
    fi
    created=$(node -e 'const j=JSON.parse(process.argv[1]);process.stdout.write(String(Boolean(j.created)))' "$result")
    owner=$(node -e 'const j=JSON.parse(process.argv[1]);process.stdout.write(j.owner_session)' "$result")
    ensured_path=$(node -e 'const j=JSON.parse(process.argv[1]);process.stdout.write(j.absolute_worktree)' "$result")
    ensured_branch=$(node -e 'const j=JSON.parse(process.argv[1]);process.stdout.write(j.branch)' "$result")
    [[ "$created" == "true" ]] && ok "Worktree created" || ok "Worktree already exists — resuming"
    echo "  WI:      $wt_wi"
    echo "  Path:    $ensured_path"
    echo "  Branch:  $ensured_branch"
    echo "  Owner:   $owner"
    _print_chain_policy "$ensured_path"
    echo ""
    echo "  cd $ensured_path"
    return 0
  fi

  if [[ "$base_ref" == "origin/main" ]] && ! git rev-parse --verify --quiet origin/main >/dev/null 2>&1; then
    base_ref="HEAD"
  fi

  preflight || exit 1

  # If worktree already exists, report it and exit 0 (idempotent for chain resume)
  if [[ -d "$wt_path" ]]; then
    ok "Worktree already exists — resuming"
    echo "  Path:   $wt_path"
    echo "  Branch: $branch_name"

    local commit_count
    commit_count=$(cd "$wt_path" && git rev-list --count main..HEAD 2>/dev/null || echo "?")
    echo "  Commits ahead of main: $commit_count"

    if (cd "$wt_path" && ! git diff --quiet HEAD 2>/dev/null); then
      warn "Worktree has uncommitted changes"
    fi
    mkdir -p "$wt_path/.svc/claims" "$wt_path/.svc/bindings"
    _write_binding "$wt_path" "$session_id" "$wt_wi" "$role"
    echo ""
    echo "  cd $wt_path"
    return 0
  fi

  echo ""
  echo "=== Creating Worktree ==="
  echo "  Branch: $branch_name"
  echo "  Base:   $base_ref"
  echo "  Path:   $wt_path"
  echo ""

  mkdir -p "$WORKTREE_DIR"

  # If branch already exists (e.g., from a prior remote push), use it
  if git show-ref --verify --quiet "refs/heads/$branch_name" 2>/dev/null; then
    info "Branch '$branch_name' already exists — attaching worktree to it"
    git worktree add "$wt_path" "$branch_name" 2>&1
  else
    git worktree add -b "$branch_name" "$wt_path" "$base_ref" 2>&1
  fi

  ok "Worktree created"

  # --- Initialize worktree-local .svc/ ---
  local wt_svc="$wt_path/.svc"
  mkdir -p "$wt_svc/claims" "$wt_svc/bindings"

  if [[ -n "$wt_wi" ]]; then
    # Initialize lane-tasks for this WI
    local lt_file="$wt_svc/lane-tasks-${wt_wi}.json"
    if [[ ! -f "$lt_file" ]]; then
      cat > "$lt_file" <<LANE_EOF
{"wi": "${wt_wi}", "tasks": [], "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)", "source": "worktree-init"}
LANE_EOF
      info "Initialized $lt_file"
    fi

    if [[ ! -f "$wt_svc/session-contract.jsonl" ]]; then
      printf '%s\n' "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"wi\":\"${wt_wi}\",\"bound_to\":\"wi-backlog\",\"request\":\"worktree-init for ${branch_name}\",\"skill\":null,\"guard_override_count\":0}" > "$wt_svc/session-contract.jsonl"
      info "Initialized worktree session contract for $wt_wi"
    fi
  fi
  _write_binding "$wt_path" "$session_id" "$wt_wi" "$role"
  _print_chain_policy "$wt_path"

  # --- Project setup (auto-detect) ---
  _run_setup "$wt_path"

  # --- Baseline tests ---
  _run_baseline_tests "$wt_path"

  echo ""
  echo "=== Worktree Ready ==="
  echo "  Path:   $wt_path"
  echo "  Branch: $branch_name"
  echo ""
  echo "  cd $wt_path"
  echo ""
}

# ============================================================
# ENTER — print the cd command for an existing worktree
# ============================================================
cmd_enter() {
  local branch_name="${1:-}"

  if [[ -z "$branch_name" ]]; then
    echo "Usage: worktree.sh enter <branch-name>"
    exit 1
  fi

  local wt_path="$(_resolve_wt_path "$branch_name")"

  if [[ ! -d "$wt_path" ]]; then
    fail "No worktree at $wt_path"
    echo "  Available worktrees:"
    for d in "$WORKTREE_DIR"/*/; do
      [[ -d "$d" ]] && echo "    $(basename "$d")"
    done 2>/dev/null || echo "    (none)"
    exit 1
  fi

  echo "=== Entering Worktree ==="
  echo "  Branch: $branch_name"
  echo "  Path:   $wt_path"

  local commit_count
  commit_count=$(cd "$wt_path" && git rev-list --count main..HEAD 2>/dev/null || echo "?")
  echo "  Commits ahead of main: $commit_count"

  if (cd "$wt_path" && ! git diff --quiet HEAD 2>/dev/null); then
    warn "Uncommitted changes present"
  fi

  echo ""
  echo "  cd $wt_path"
}

# ============================================================
# PROMOTE — squash-merge a worktree branch to main, then remove it
# Full lifecycle: validate → checkout main → squash → commit → remove
# ============================================================
cmd_promote() {
  local branch_name=""
  local auto_merge=false
  local no_pr=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --auto-merge) auto_merge=true; shift ;;
      --no-pr) no_pr=true; shift ;;   # WI-562 IP-H2 waiver: push only, skip PR
      *) branch_name="$1"; shift ;;
    esac
  done

  if [[ -z "$branch_name" ]]; then
    echo "Usage: worktree.sh promote <branch-name> [--auto-merge]"
    exit 1
  fi

  local wt_path="$(_resolve_wt_path "$branch_name")"

  if [[ ! -d "$wt_path" ]]; then
    fail "No worktree at $wt_path"
    exit 1
  fi

  echo "=== Landing: $branch_name ==="
  echo ""

  # 1. Check worktree is clean
  if (cd "$wt_path" && ! git diff --quiet HEAD 2>/dev/null); then
    fail "Worktree has uncommitted changes — commit or discard first"
    exit 1
  fi
  ok "Worktree is clean"

  # 2. Show what will be landed
  local commit_count
  commit_count=$(cd "$wt_path" && git rev-list --count main..HEAD 2>/dev/null || echo "?")
  info "$commit_count commit(s) ahead of main"

  echo ""
  echo "  Files changed:"
  git diff --stat "main...$branch_name" 2>/dev/null | sed 's/^/    /'

  # 3. Push the branch — WI-562 IP-H2: exit-status honesty. A failed push must
  # abort promote BEFORE any state advances or success is claimed.
  echo ""
  echo "=== Push ==="
  local push_rc=0
  (cd "$wt_path" && git push -u origin "$branch_name" 2>&1) || push_rc=$?
  if [[ $push_rc -ne 0 ]]; then
    fail "git push exited $push_rc — branch NOT pushed, promote aborted"
    exit 1
  fi
  ok "Branch pushed to origin/$branch_name"

  # 4. Open PR
  echo ""
  echo "=== Pull Request ==="

  if [[ $no_pr == true ]]; then
    info "--no-pr waiver: skipping PR creation (echoed per WI-562 single-waiver rule)"
    return 0
  fi

  if ! command -v gh &>/dev/null; then
    # WI-562 IP-H2: silent success on missing gh hid the un-PR'd branch.
    fail "gh CLI not found — cannot create the PR. Branch IS pushed to origin/$branch_name."
    info "Re-run with --no-pr to accept a push-only promote, or install gh."
    exit 1
  fi

  # Check if PR already exists
  local existing_pr
  existing_pr=$(gh pr list --head "$branch_name" --json number --jq '.[0].number' 2>/dev/null || true)

  if [[ -n "$existing_pr" ]]; then
    info "PR #$existing_pr already exists"
    echo "  View: gh pr view $existing_pr"
  else
    echo "  Creating PR..."
    local pr_rc=0
    gh pr create \
      --head "$branch_name" \
      --title "$branch_name" \
      --body "Squash-merge validated branch to main.

Branch: \`$branch_name\`
Commits: $commit_count

$(git diff --stat "main...$branch_name" 2>/dev/null)" 2>&1 || pr_rc=$?
    # WI-562 IP-H2: only the already-exists race is tolerated; any other PR
    # failure aborts promote with a nonzero exit.
    if [[ $pr_rc -ne 0 ]]; then
      if gh pr list --head "$branch_name" --json number --jq '.[0].number' 2>/dev/null | grep -q '[0-9]'; then
        info "PR create reported failure but the PR exists (race) — continuing"
      else
        fail "gh pr create exited $pr_rc — promote aborted (branch IS pushed)"
        exit 1
      fi
    else
      ok "PR created"
    fi
  fi

  # Get PR number
  local pr_number
  pr_number=$(gh pr list --head "$branch_name" --json number --jq '.[0].number' 2>/dev/null || true)

  if $auto_merge && [[ -n "$pr_number" ]]; then
    echo ""
    echo "=== Auto-merge ==="
    local _mrc=0
    local _merge_repo _merge_sha
    _merge_repo=$(cd "$wt_path" && gh repo view --json nameWithOwner --jq .nameWithOwner) || { fail "Cannot bind promotion repository"; return 1; }
    _merge_sha=$(git -C "$wt_path" rev-parse HEAD) || return 1
    node "$REPO_ROOT/scripts/merge-pr-with-review-receipt.mjs" --root "$wt_path" --pr "$pr_number" --repo "$_merge_repo" --expected-repo "$_merge_repo" --expected-head "$branch_name" --expected-head-sha "$_merge_sha" --squash --delete-branch 2>&1 || _mrc=$?
    if [[ $_mrc -eq 0 ]]; then
      ok "PR #$pr_number merged"
      echo ""
      info "Clean up worktree:"
      echo "  scripts/worktree.sh remove $branch_name"
    elif [[ $_mrc -eq 3 ]]; then
      warn "PR #$pr_number MERGED but coverage UNVERIFIED (exit 3 = MERGED_UNVERIFIED)"
      info "Do NOT reopen the PR or re-merge. Run receipt recovery for the squash SHA, then verify-promotion."
    else
      warn "Auto-merge failed (branch protection or review required?)"
      info "PR #$pr_number is open — waiting for approval"
      echo "  After approval: node scripts/merge-pr-with-review-receipt.mjs --pr $pr_number --squash --delete-branch"
      echo "  Then: scripts/worktree.sh remove $branch_name"
    fi
  else
    echo ""
    info "PR is open — waiting for review/approval"
    [[ -n "$pr_number" ]] && echo "  PR: #$pr_number"
    echo ""
    echo "  After approval:"
    echo "    node scripts/merge-pr-with-review-receipt.mjs --pr ${pr_number:-<number>} --squash --delete-branch"
    echo "    scripts/worktree.sh remove $branch_name"
    echo ""
    echo "  To auto-merge (solo mode):"
    echo "    scripts/worktree.sh promote $branch_name --auto-merge"
  fi
}

# ============================================================
# REMOVE — remove a worktree and optionally its branch
# ============================================================
cmd_remove() {
  local branch_name=""
  local force=false
  local skip_healing_gate=false
  local session_id="$(_host_session_id)"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --force) force=true; shift ;;
      # WI-562 IP-H2/H-G: THE single AP-30 healing waiver channel. The legacy
      # SVC_WORKTREE_SKIP_AP30_CHECK=1 env is deprecated: still honored with a
      # loud warning, refused entirely after the next release.
      --skip-healing-gate) skip_healing_gate=true; shift ;;
      --session) session_id="$2"; shift 2 ;;
      *) branch_name="$1"; shift ;;
    esac
  done

  if [[ -z "$branch_name" ]]; then
    echo "Usage: worktree.sh remove <branch-name> [--force]"
    exit 1
  fi

  local wt_path="$(_resolve_wt_path "$branch_name")"

  if [[ ! -d "$wt_path" ]]; then
    fail "No worktree at $wt_path"
    exit 1
  fi

  echo "=== Removing Worktree ==="
  echo "  Path:   $wt_path"
  echo "  Branch: $branch_name"
  echo ""

  # Must not be inside the worktree we're removing
  local cwd
  cwd="$(pwd)"
  if [[ "$cwd" == "$wt_path"* ]]; then
    info "Currently inside the worktree — switching to repo root"
    cd "$REPO_ROOT"
  fi

  if (cd "$wt_path" && ! git diff --quiet HEAD 2>/dev/null); then
    if $force; then
      warn "Uncommitted changes — force removing"
    else
      fail "Uncommitted changes in worktree. Use --force to discard, or commit first."
      exit 1
    fi
  fi

  if ! node --input-type=module - "$wt_path" "$session_id" <<'NODE_BINDING_REMOVE'
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [root, session] = process.argv.slice(2);
const claims = await import(pathToFileURL(path.join(path.resolve(root), "hooks", "lib", "wi-claim.mjs")));
const dir = path.join(path.resolve(root), ".svc", "bindings");
if (!fs.existsSync(dir)) process.exit(0);
for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".json"))) {
  const binding = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  if (binding.released_at) continue;
  if (binding.role !== "mutating") continue;
  const claim = claims.readClaimAbsolute(binding.claim_path);
  const live = claims.claimFreshness(claim, binding.claim_path).fresh;
  if (live && (!session || binding.session_id !== session)) {
    console.error(`live binding owned by ${binding.session_id || "unknown"}; release or transfer before remove`);
    process.exit(1);
  }
}
NODE_BINDING_REMOVE
  then
    fail "Worktree has a live foreign binding"
    exit 1
  fi
  if [[ -n "$session_id" ]]; then
    node "$wt_path/hooks/lib/wi-claim.mjs" binding release --worktree-root "$wt_path" --session-id "$session_id" >/dev/null || {
      fail "Could not release owned binding"
      exit 1
    }
  fi

  # ── AP-30 safety: detect host-skill symlinks pointing at this worktree
  # before removing it. If we deleted the worktree first, the next session
  # would start with dangling skill links and broken hooks (even though
  # SessionStart auto-heals, the gap is racy and confusing). Auto-heal
  # BEFORE removing instead. Set SVC_WORKTREE_SKIP_AP30_CHECK=1 to bypass.
  if [[ "${SVC_WORKTREE_SKIP_AP30_CHECK:-0}" != "1" ]]; then
    local host_skill_roots=(
      "$HOME/.claude/skills"
      "$HOME/.kimi/skills"
      "$HOME/.codex/skills"
      "$HOME/.gemini/skills"
      "$HOME/.config/opencode/skills"
      "$HOME/.mimocode/skills"
      "$HOME/.gemini/antigravity/skills"
      "$HOME/.cursor/skills"
      "$HOME/.grok/skills"
    )
    local poisoned_links=()
    for root in "${host_skill_roots[@]}"; do
      [[ -d "$root" ]] || continue
      while IFS= read -r link; do
        poisoned_links+=("$link")
      done < <(find "$root" -maxdepth 2 -type l 2>/dev/null \
                 | while read -r l; do
                     local tgt
                     tgt="$(readlink "$l")"
                     [[ "$tgt" == "$wt_path"* ]] && echo "$l"
                   done)
    done

    if [[ ${#poisoned_links[@]} -gt 0 ]]; then
      warn "${#poisoned_links[@]} host-skill symlink(s) point at this worktree."
      warn "Re-pointing them at canonical main BEFORE removing the worktree (AP-30 safety)."
      # Detect each host with a poisoned link and re-run its setup to repoint.
      local hosts_to_repoint=()
      for link in "${poisoned_links[@]}"; do
        case "$link" in
          "$HOME/.claude/skills/"*) hosts_to_repoint+=("claude");;
          "$HOME/.kimi/skills/"*)   hosts_to_repoint+=("kimi");;
          "$HOME/.codex/skills/"*)  hosts_to_repoint+=("codex");;
          "$HOME/.gemini/skills/"*) hosts_to_repoint+=("gemini");;
          "$HOME/.config/opencode/skills/"*) hosts_to_repoint+=("opencode");;
          "$HOME/.gemini/antigravity/skills/"*) hosts_to_repoint+=("antigravity");;
          "$HOME/.cursor/skills/"*) hosts_to_repoint+=("cursor");;
          "$HOME/.grok/skills/"*)   hosts_to_repoint+=("grok");;
        esac
      done
      # Dedupe
      local unique_hosts
      unique_hosts="$(printf '%s\n' "${hosts_to_repoint[@]}" | sort -u)"
      while IFS= read -r host; do
        [[ -z "$host" ]] && continue
        info "Re-pointing $host symlinks via canonical setup..."
        (cd "$REPO_ROOT" && ./setup --host "$host") >/dev/null 2>&1 \
          && ok "  $host: re-pointed at $REPO_ROOT" \
          || { warn "  $host: setup returned non-zero — healing FAILED"; export SVC_AP30_HEALING_FAILED=1; }
      done <<< "$unique_hosts"
    fi
  fi

  # WI-562 IP-H2: healing FAILURE must block removal unless explicitly waived.
  if [[ "${SVC_WORKTREE_SKIP_AP30_CHECK:-0}" == "1" ]] && [[ $skip_healing_gate != true ]]; then
    warn "SVC_WORKTREE_SKIP_AP30_CHECK=1 env bypass is deprecated (WI-562): use --skip-healing-gate."
    warn "This run proceeds via the deprecated env; it will be REFUSED in a future release."
  fi
  if [[ $skip_healing_gate == true ]]; then
    info "Waiver honored and echoed: --skip-healing-gate (AP-30 healing check bypassed for this removal)"
  fi
  if [[ "${SVC_AP30_HEALING_FAILED:-0}" == "1" && $skip_healing_gate != true && "${SVC_WORKTREE_SKIP_AP30_CHECK:-0}" != "1" ]]; then
    fail "AP-30 healing failed — removal BLOCKED. Re-run with --skip-healing-gate to waive explicitly."
    exit 1
  fi

  if $force; then
    git worktree remove --force "$wt_path" 2>&1
  else
    git worktree remove "$wt_path" 2>&1
  fi

  ok "Worktree removed"

  # Delete branch if merged. Use ancestry checks against explicit refs instead
  # of `git branch -d`, which compares against the current HEAD and can keep a
  # stale branch when local main is behind origin/main.
  if ! git show-ref --verify --quiet "refs/heads/$branch_name" 2>/dev/null; then
    warn "Branch $branch_name not found locally"
  elif git merge-base --is-ancestor "$branch_name" main 2>/dev/null; then
    git branch -D "$branch_name" 2>&1 && ok "Branch $branch_name deleted (merged to main)"
  elif git rev-parse --verify --quiet origin/main >/dev/null 2>&1 \
    && git merge-base --is-ancestor "$branch_name" origin/main 2>/dev/null; then
    git branch -D "$branch_name" 2>&1 && ok "Branch $branch_name deleted (merged to origin/main)"
  else
    warn "Branch $branch_name kept (not merged to main or origin/main)"
  fi

  # Remove legacy in-repo .worktrees/ only if now empty; external repository roots are kept intact
  if [[ "$WORKTREE_DIR" == "$REPO_ROOT/.worktrees" ]] && [[ -d "$WORKTREE_DIR" ]] && [[ -z "$(ls -A "$WORKTREE_DIR" 2>/dev/null)" ]]; then
    rmdir "$WORKTREE_DIR"
    ok "Removed empty in-repo .worktrees/ directory"
  fi
}

# ============================================================
# LIST — show all active worktrees
# ============================================================
cmd_list() {
  echo "=== Active Worktrees ==="
  echo ""

  local count=0
  while IFS= read -r line; do
    local wt_path wt_hash wt_branch
    wt_path=$(echo "$line" | awk '{print $1}')
    wt_hash=$(echo "$line" | awk '{print $2}')
    wt_branch=$(echo "$line" | grep -oP '\[.*?\]' || echo "[detached]")

    [[ "$wt_path" == "$REPO_ROOT" ]] && continue

    count=$((count + 1))
    echo "  $count. $wt_branch"
    echo "     Path:   $wt_path"
    echo "     Commit: $wt_hash"

    if (cd "$wt_path" 2>/dev/null && ! git diff --quiet HEAD 2>/dev/null); then
      echo -e "     Status: ${YELLOW}dirty${NC}"
    else
      echo "     Status: clean"
    fi

    local ahead
    ahead=$(cd "$wt_path" 2>/dev/null && git rev-list --count main..HEAD 2>/dev/null || echo "?")
    echo "     Ahead:  $ahead commit(s)"
    echo ""
  done < <(git worktree list)

  if [[ $count -eq 0 ]]; then
    echo "  No active worktrees."
    echo ""
    echo "  Create one: scripts/worktree.sh create <branch-name>"
  else
    echo "  Total: $count worktree(s)"
  fi
}

# ============================================================
# CLEANUP — find and remove orphaned/stale worktrees
# ============================================================
cmd_cleanup() {
  echo "=== Worktree Cleanup ==="
  echo ""

  local cleaned=0

  local pruned
  pruned=$(git worktree prune -v 2>&1)
  if [[ -n "$pruned" ]]; then
    echo "$pruned" | sed 's/^/  /'
    cleaned=$((cleaned + 1))
  else
    ok "No stale worktree references"
  fi

  if [[ -d "$WORKTREE_DIR" ]]; then
    local known_paths
    known_paths=$(git worktree list --porcelain | grep '^worktree ' | sed 's/^worktree //')

    for dir in "$WORKTREE_DIR"/*/; do
      [[ ! -d "$dir" ]] && continue
      dir="${dir%/}"

      # WI-562 IP-H3: quarantine is not an orphan — it is preserved evidence.
      [[ "$dir" == *"/.quarantine" || "$dir" == *"/.quarantine/"* ]] && continue

      if ! echo "$known_paths" | grep -q "^${dir}$"; then
        warn "Orphaned directory: $dir"
        # WI-562 IP-H3: quarantine instead of bare rm -rf — bytes are preserved
        # under .worktrees/.quarantine/<ts>/ for inspection and manual disposal.
        local qdir="$WORKTREE_DIR/.quarantine/$(date +%Y%m%dT%H%M%S)"
        mkdir -p "$qdir"
        mv "$dir" "$qdir/"
        ok "Quarantined $dir -> $qdir"
        cleaned=$((cleaned + 1))
      fi
    done

    if [[ -d "$WORKTREE_DIR" ]] && [[ -z "$(ls -A "$WORKTREE_DIR" 2>/dev/null)" ]]; then
      rmdir "$WORKTREE_DIR"
      ok "Removed empty .worktrees/ directory"
    fi
  fi

  local tmp_orphans=0
  for dir in /tmp/svc-*/; do
    [[ ! -d "$dir" ]] && continue
    warn "Orphaned temp directory: $dir"
    tmp_orphans=$((tmp_orphans + 1))
  done

  if [[ $tmp_orphans -gt 0 ]]; then
    warn "$tmp_orphans orphaned /tmp/svc-* directories found"
    echo "    Remove manually: rm -rf /tmp/svc-*"
  fi

  echo ""
  if [[ $cleaned -gt 0 ]]; then
    ok "Cleaned $cleaned item(s)"
  else
    ok "Nothing to clean"
  fi
}

# ============================================================
# HELPERS
# ============================================================
_run_setup() {
  local wt_path="$1"
  echo ""
  echo "=== Project Setup ==="

  if [[ -f "$wt_path/package.json" ]]; then
    echo "  Detected: Node.js"
    if [[ -f "$wt_path/package-lock.json" ]]; then
      (cd "$wt_path" && npm ci --silent 2>&1) && ok "npm ci" || warn "npm ci failed"
    elif [[ -f "$wt_path/yarn.lock" ]]; then
      (cd "$wt_path" && yarn install --frozen-lockfile --silent 2>&1) && ok "yarn install" || warn "yarn failed"
    else
      (cd "$wt_path" && npm install --silent 2>&1) && ok "npm install" || warn "npm install failed"
    fi
  elif [[ -f "$wt_path/Cargo.toml" ]]; then
    echo "  Detected: Rust"
    (cd "$wt_path" && cargo build 2>&1) && ok "cargo build" || warn "cargo build failed"
  elif [[ -f "$wt_path/requirements.txt" ]]; then
    echo "  Detected: Python (requirements.txt)"
    (cd "$wt_path" && pip install -r requirements.txt -q 2>&1) && ok "pip install" || warn "pip failed"
  elif [[ -f "$wt_path/pyproject.toml" ]]; then
    echo "  Detected: Python (pyproject.toml)"
    (cd "$wt_path" && pip install -e . -q 2>&1) && ok "pip install" || warn "pip failed"
  elif [[ -f "$wt_path/go.mod" ]]; then
    echo "  Detected: Go"
    (cd "$wt_path" && go build ./... 2>&1) && ok "go build" || warn "go build failed"
  else
    ok "No package manager detected — skipping"
  fi
}

_run_baseline_tests() {
  local wt_path="$1"
  echo ""
  echo "=== Baseline Tests ==="

  local test_cmd=""
  if [[ -f "$wt_path/package.json" ]] && grep -q '"test"' "$wt_path/package.json" 2>/dev/null; then
    test_cmd="npm test"
  elif [[ -f "$wt_path/Cargo.toml" ]]; then
    test_cmd="cargo test"
  elif [[ -f "$wt_path/go.mod" ]]; then
    test_cmd="go test ./..."
  fi

  if [[ -n "$test_cmd" ]]; then
    echo "  Running: $test_cmd"
    if (cd "$wt_path" && eval "$test_cmd" 2>&1 >/dev/null); then
      ok "Baseline tests pass"
    else
      warn "Baseline tests FAIL — proceed with caution"
    fi
  else
    ok "No test command detected — skipping"
  fi
}

# ============================================================
# MAIN
# ============================================================
usage() {
  cat <<'USAGE'
svc worktree manager

Usage:
  scripts/worktree.sh <command> [options]

Commands:
  guard              Intelligent worktree check for any skill
    --skill <name>   Current skill name
    --lane <lane>    Current lane (greenfield, bugfix, etc.)
    --branch <name>  Branch name (from manifest, optional)

  create <branch>    Create a new worktree (idempotent — resumes if exists)
    --from <ref>     Base on a specific ref (default: HEAD)

  enter <branch>     Show path to enter an existing worktree

  status             Detect if currently inside a worktree

  promote <branch>   Push branch + open PR (default: wait for approval)
    --auto-merge     Also merge the PR immediately (solo mode)

  remove <branch>    Remove a worktree and clean up
    --force          Remove even with uncommitted changes

  list               Show all active worktrees with status

  cleanup            Find and remove orphaned worktrees

  freeze <dir>       Restrict edits to a directory (for investigation scope lock)

  unfreeze           Remove the freeze restriction

  preflight          Run safety checks without creating anything

Worktree conditions:
  ALWAYS:  execute-changeset, land-changeset, test-framework autopilot
  NEVER:   spec writing, vision/persona, reviews/audits
  OPTIONAL: plan-changeset (simulation), tech design (prototyping)

Branch naming convention:
  feature-<name>     Greenfield / brownfield feature
  bugfix-<name>      Bugfix lane
  refactor-<name>    Refactor lane
  test-<name>        Framework test / eval
USAGE
}

case "${1:-}" in
  guard)    shift; cmd_guard "$@" ;;
  freeze)   shift; echo "${1:?Usage: worktree.sh freeze <directory>}" > "$REPO_ROOT/.worktree-freeze"; ok "Edits restricted to: $1"; echo "  Unfreeze: scripts/worktree.sh unfreeze" ;;
  unfreeze) rm -f "$REPO_ROOT/.worktree-freeze"; ok "Edit restriction removed" ;;
  create)   shift; cmd_create "$@" ;;
  enter)    shift; cmd_enter "$@" ;;
  status)   cmd_status ;;
  # WI-562 IP-H3: mutating verbs re-enter under the repo-wide Git-CAS verb lock.
  __inner_promote)
    shift
    assert_not_frozen "main"
    cmd_promote "$@"
    ;;
  __inner_remove)
    shift
    assert_not_frozen "$WORKTREE_DIR/$1"
    cmd_remove "$@"
    ;;
  __inner_cleanup)
    assert_not_frozen "__cleanup_all__"
    cmd_cleanup
    ;;
  promote)
    shift
    exec node "$REPO_ROOT/hooks/lib/worktree-verb-lock.mjs" --verb promote --repo-root "$REPO_ROOT" -- bash "$0" __inner_promote "$@"
    ;;
  remove)
    shift
    exec node "$REPO_ROOT/hooks/lib/worktree-verb-lock.mjs" --verb remove --repo-root "$REPO_ROOT" -- bash "$0" __inner_remove "$@"
    ;;
  list)     cmd_list ;;
  cleanup)
    exec node "$REPO_ROOT/hooks/lib/worktree-verb-lock.mjs" --verb cleanup --repo-root "$REPO_ROOT" -- bash "$0" __inner_cleanup
    ;;
  preflight) preflight ;;
  -h|--help|help) usage ;;
  *)
    if [[ -n "${1:-}" ]]; then
      echo "Unknown command: $1"
      echo ""
    fi
    usage
    exit 1
    ;;
esac

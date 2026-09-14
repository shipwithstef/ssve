#!/usr/bin/env bash
# migrate-packs-to-plugins.sh — WI-377 L2: convert globally-symlinked external skill
# packs into per-project-toggleable PLUGINS (the only native per-project lever).
#
# DEFAULT IS DRY-RUN (prints the full plan, mutates nothing).
# Pass --apply to execute — this mutates HOST-SHARED state (~/.claude) and is
# deliberately user-gated (2026-06-07 settings-regression lesson).
#
# What --apply does (idempotent, per machine):
#  1. Builds ~/.claude/svc-pack-marketplace/ with one plugin per pack SOURCE ROOT:
#       svc-agents-skills-pack  -> every ~/.claude/skills symlink resolving into
#                                  ~/.agents/skills (capawesome + capgo packs),
#                                  EXCEPT base44-* (already shipped by base44@base44-skills)
#       svc-marketing-pack      -> symlinks resolving into
#                                  ~/.svc/external-skills/marketingskills
#     Plugin skill dirs are SYMLINKS to the original sources (no duplication;
#     upstream `npx skills` updates flow through; probe-verified 2026-06-08).
#  2. Registers the marketplace; installs + enables both plugins (user scope).
#  3. Removes the now-duplicate global symlinks from ~/.claude/skills
#     (incl. base44-* duplicates of the existing base44 plugin).
#  4. Per-project disabling then works natively via committed .claude/settings.json:
#       "enabledPlugins": { "svc-agents-skills-pack@svc-pack-marketplace": false, ... }
#
# Safety: only ever removes SYMLINKS whose resolved target lies inside the pack
# source roots; real directories and svc-repo links are untouched.
# Rollback (TWO steps — disabling plugins alone does NOT restore globals):
#   1. claude plugin disable svc-agents-skills-pack@svc-pack-marketplace (and marketing)
#   2. bash ~/.claude/svc-pack-marketplace/relink-globals.sh   # generated on --apply
#      (or re-run the upstream installers: npx skills add capawesome-team/skills -g -a "*" -y)
set -euo pipefail
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
run(){ if [ "$APPLY" = 1 ]; then "$@"; else echo "[dry-run] $*"; fi; }

SK=~/.claude/skills
MKT=~/.claude/svc-pack-marketplace
AG=$(readlink -f ~/.agents/skills)
MS=$(readlink -f ~/.svc/external-skills/marketingskills 2>/dev/null || echo /nonexistent)

declare -a AG_SKILLS=() MS_SKILLS=() B44_DUPES=()
for l in "$SK"/*; do
  [ -L "$l" ] || continue
  t=$(readlink -f "$l" 2>/dev/null || true); n=$(basename "$l")
  case "$t" in
    "$AG"/*)  case "$n" in base44-*) B44_DUPES+=("$n");; *) AG_SKILLS+=("$n");; esac ;;
    "$MS"/*)  MS_SKILLS+=("$n") ;;
  esac
done
# WI377-G6-001: idempotency — on reruns the globals are already unlinked; merge
# membership from EXISTING plugin dirs so plugin.json is never rebuilt empty.
merge_existing() { # varname dir
  local -n arr=$1; local dir=$2
  [ -d "$dir" ] || return 0
  for e in "$dir"/*; do
    [ -L "$e" ] || continue
    local n; n=$(basename "$e")
    case " ${arr[*]-} " in *" $n "*) ;; *) arr+=("$n");; esac
  done
}
merge_existing AG_SKILLS "$MKT/svc-agents-skills-pack"
merge_existing MS_SKILLS "$MKT/svc-marketing-pack"
if [ ${#AG_SKILLS[@]} -eq 0 ] && [ ${#MS_SKILLS[@]} -eq 0 ]; then
  echo "refusing: discovered zero pack skills (no globals AND no existing plugin members) — nothing to do or wrong machine state"; exit 1
fi
echo "plan: agents-pack=${#AG_SKILLS[@]} skills | marketing-pack=${#MS_SKILLS[@]} | base44 dupes to unlink=${#B44_DUPES[@]}"

run mkdir -p "$MKT/.claude-plugin" "$MKT/svc-agents-skills-pack/.claude-plugin" "$MKT/svc-marketing-pack/.claude-plugin"

emit_plugin() { # dir name desc skills...
  local dir="$1" name="$2" desc="$3"; shift 3
  local entries=""
  for s in "$@"; do
    if [ -e "$dir/$s" ] && [ ! -L "$dir/$s" ]; then
      echo "refusing: $dir/$s exists and is not a symlink (manual residue) — resolve by hand"; exit 1
    fi
    local src=""
    if [ -L "$SK/$s" ]; then src=$(readlink -f "$SK/$s")
    elif [ -L "$dir/$s" ]; then src=$(readlink -f "$dir/$s")
    fi
    [ -n "$src" ] && [ -d "$src" ] || { echo "refusing: no resolvable source for $s"; exit 1; }
    run ln -sfn "$src" "$dir/$s"
    entries+="\"./$s\","
  done
  if [ "$APPLY" = 1 ]; then
    printf '{"name":"%s","version":"1.0.0","description":"%s","skills":[%s]}\n' \
      "$name" "$desc" "${entries%,}" > "$dir/.claude-plugin/plugin.json"
  else
    echo "[dry-run] write $dir/.claude-plugin/plugin.json ($# skills)"
  fi
}
emit_plugin "$MKT/svc-agents-skills-pack" svc-agents-skills-pack \
  "capawesome+capgo capacitor/ionic packs as a per-project-toggleable plugin (WI-377)" \
  "${AG_SKILLS[@]}"
emit_plugin "$MKT/svc-marketing-pack" svc-marketing-pack \
  "coreyhaines marketing pack as a per-project-toggleable plugin (WI-377)" \
  "${MS_SKILLS[@]}"

if [ "$APPLY" = 1 ]; then
  cat > "$MKT/.claude-plugin/marketplace.json" <<EOF
{"name":"svc-pack-marketplace","owner":{"name":"s7an-it","email":"angelovsan@gmail.com"},
 "plugins":[
  {"name":"svc-agents-skills-pack","source":"./svc-agents-skills-pack","description":"capawesome+capgo packs"},
  {"name":"svc-marketing-pack","source":"./svc-marketing-pack","description":"coreyhaines marketing pack"}]}
EOF
else
  echo "[dry-run] write $MKT/.claude-plugin/marketplace.json"
fi

run claude plugin marketplace add "$MKT"
run claude plugin install svc-agents-skills-pack@svc-pack-marketplace
run claude plugin install svc-marketing-pack@svc-pack-marketplace
run claude plugin enable svc-agents-skills-pack@svc-pack-marketplace
run claude plugin enable svc-marketing-pack@svc-pack-marketplace

RELINK="$MKT/relink-globals.sh"
[ "$APPLY" = 1 ] && { echo "#!/usr/bin/env bash" > "$RELINK"; echo "# regenerated rollback: restores the global symlinks removed by --apply" >> "$RELINK"; }
for s in ${AG_SKILLS[@]+"${AG_SKILLS[@]}"} ${MS_SKILLS[@]+"${MS_SKILLS[@]}"} ${B44_DUPES[@]+"${B44_DUPES[@]}"}; do
  # WI377-G6-002: revalidate AT DELETION TIME — must still be a symlink resolving
  # into an approved pack root; anything else is skipped loudly.
  if [ -L "$SK/$s" ]; then
    t=$(readlink -f "$SK/$s" 2>/dev/null || true)
    case "$t" in
      "$AG"/*|"$MS"/*)
        [ "$APPLY" = 1 ] && echo "ln -sfn '$t' '$SK/$s'" >> "$RELINK"
        run rm -- "$SK/$s" ;;
      *) echo "skip (target moved outside pack roots): $s -> $t" ;;
    esac
  elif [ -e "$SK/$s" ]; then
    echo "skip (not a symlink anymore): $s"
  fi
done
[ "$APPLY" = 1 ] && chmod +x "$RELINK" && echo "rollback relink manifest: $RELINK"
echo "post-state skills-dir entries: $(ls "$SK" | wc -l) $([ "$APPLY" = 1 ] || echo '(unchanged — dry-run)')"
echo "verify: claude plugin details svc-agents-skills-pack@svc-pack-marketplace"

## Step 0: Locate the Framework Source Repo — MANDATORY FIRST STEP

Before anything else, locate the svc framework git repo. All skill edits, proposals, FRAMEWORK-STATE.md updates, and commits go there — not to the install copy at `<SKILLS_PATH>` and not to the current project repo.

```bash
# 1. Resolve the host-specific installed skills root
SKILLS_ROOT="${SVC_SKILLS_PATH:-}"
if [ -z "$SKILLS_ROOT" ]; then
  for candidate in \
    "$HOME/.codex/skills" \
    "$HOME/.kimi/skills" \
    "$HOME/.gemini/skills" \
    "$HOME/.config/opencode/skills" \
    "$HOME/.cursor/skills" \
    "$HOME/.claude/skills"
  do
    [ -d "$candidate" ] && SKILLS_ROOT="$candidate" && break
  done
fi

# 2. Check for a pointer written at install time
FRAMEWORK_REPO=""
if [ -n "$SKILLS_ROOT" ]; then
  FRAMEWORK_REPO=$(cat "$SKILLS_ROOT/.source-repo" 2>/dev/null || true)
fi

# 3. If not found, find the git repo that owns the installed SKILL.md via inode match
if [ -z "$FRAMEWORK_REPO" ] && [ -n "$SKILLS_ROOT" ]; then
  INODE=$(stat -c '%i' "$SKILLS_ROOT/improve-framework/SKILL.md" 2>/dev/null)
  FRAMEWORK_REPO=$(find ~/app-workspaces ~/workspace ~/projects ~ -maxdepth 3 -name "SKILL.md" 2>/dev/null \
    | while read f; do
        [ "$(stat -c '%i' "$f" 2>/dev/null)" = "$INODE" ] && git -C "$(dirname $(dirname $f))" rev-parse --show-toplevel 2>/dev/null && break
      done)
fi

# 4. Still not found — prompt the user
if [ -z "$FRAMEWORK_REPO" ]; then
  echo "ERROR: Cannot locate svc framework repo. Set FRAMEWORK_REPO manually or run from its directory."
  exit 1
fi

echo "Framework repo: $FRAMEWORK_REPO"
```

Once located, **all subsequent file paths in this skill are relative to `$FRAMEWORK_REPO`**. Read `FRAMEWORK-STATE.md`, write proposals, and commit — all from that directory.

If the framework repo has never been cloned on this machine, clone it before proceeding:
```bash
# Only if Step 0 failed to find it
git clone <framework-remote-url> ~/app-workspaces/seriousvibecoding
FRAMEWORK_REPO=~/app-workspaces/seriousvibecoding
```

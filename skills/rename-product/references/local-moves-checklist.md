# Local moves checklist

The operator runs this after the agent session has ended. It moves the local checkout, its worktrees, and the agent-memory directories derived from the checkout path. The agent does not run it. Nothing here approves spending, contact, publication, or a deploy.

Keep the old folder until the new path opens and the checks below pass.

## 1. No process under the old checkout

Canonicalise the checkout, then compare every process working directory. Stop if any process is inside the old tree.

```bash
old=$(realpath /path/to/old-checkout)
for link in /proc/[0-9]*/cwd; do
  cwd=$(realpath "$link" 2>/dev/null || true)
  case "$cwd" in
    "$old"|"$old"/*) echo "busy $link -> $cwd" ;;
  esac
done
```

A printed `busy` line means a process still has its working directory under the old checkout. Close it and repeat. Do not apply while any line prints.

## 2. Canonical paths

```bash
old=$(realpath /path/to/old-checkout)
new_parent=$(realpath /path/to/parent-of-new-checkout)
new="$new_parent/new-checkout"
```

`realpath` resolves a symlink, a trailing slash, and a `..` component. Record `old` and `new` in the P8 receipt before any move. Use the same pair for every worktree and memory directory in this run.

## 3. Hidden entries

Inventory every entry at the old checkout root, including names that start with `.`.

```bash
ls -A "$old"
```

`ls -A` lists hidden entries. `ls` without `-A` does not. Record the list in the P8 receipt. Do the same for each worktree root that will move.

## 4. Memory directories per host

List one memory directory per host from the canonical checkout path. Derivation is `scripts/lib/resolve-user-memory-path.mjs`: `projectSlug` plus `user_memory_path_template` in `provision/hosts/<host>.json`, or the fallback `~/.svc/per-host/<host>/projects/<slug>/memory`.

Run this from the old checkout root, before the move.

```bash
for manifest in provision/hosts/*.json; do
  host=$(basename "$manifest" .json)
  node scripts/lib/resolve-user-memory-path.mjs --host "$host" --project "$old"
  node scripts/lib/resolve-user-memory-path.mjs --host "$host" --project "$new"
done
```

List worktrees from the old checkout:

```bash
git -C "$old" worktree list --porcelain
```

Record each old path and the new path the operator will use.

## 5. Dry-run, then apply

Write every planned `mv` in the P8 receipt: the checkout, each worktree, and each memory directory that exists. Read that list. Apply only those lines, from a shell whose working directory is outside `$old` and `$new`.

Do not apply a path that was not in the dry-run. If a destination already exists, stop and merge by hand.

## 6. Verify the new path opens

```bash
git -C "$new" rev-parse --show-toplevel
git -C "$new" status --short
git -C "$new" worktree list
```

`rev-parse` must print the `realpath` of `$new`. `status` must run. Every worktree path must be one the dry-run named. Each memory directory the dry-run moved must be the path the resolver prints for `$new`.

## 7. Keep the old folder until it is verified

Leave the old checkout, any unmoved worktree, and any unmoved memory directory in place until step 6 passes. If step 6 fails, move the applied paths back. Remove an old path only after the new path opens and the P8 receipt records step 6.

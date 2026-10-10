### Step 6c: Sync to Remote — MANDATORY BEFORE DECLARING DONE

Committing locally without pushing creates a silent backlog — future `improve-framework` runs stack on top of unpushed work, and collaborators/other machines never see the change. Push as the final act of the loop.

```bash
# Run from the framework repo after Step 6b commit.
# Check unpushed work first so you can report it honestly.
UNPUSHED=$(git log --oneline @{u}..HEAD 2>/dev/null | wc -l)
if [ "$UNPUSHED" -gt 1 ]; then
  echo "NOTE: pushing $UNPUSHED commits (includes $((UNPUSHED-1)) from prior unpushed runs)"
fi
git push origin main
```

**Classify the rejection before giving up.** Not all push failures are equivalent — some have deterministic, safe, in-scope recoveries:

| Failure mode | Allowed autonomous recovery | Forbidden |
|---|---|---|
| Non-fast-forward (upstream moved) | `git fetch` + `git pull --rebase origin main` ONCE, retry push. If rebase conflicts, stop and report. | `git push --force`, `git push --force-with-lease` (never without explicit user directive) |
| Branch protection (main requires PR) | Create branch `skills/improve-framework/<date>-<slug>`, push, open PR with proposal as body | Silently switching default branch, disabling protections |
| Auth failure (`Repository not found`, 401/403, "authentication required") | `gh auth switch` to the account encoded in the remote URL — see pattern below | Creating new auth, `gh auth login`, prompting user interactively, swapping to an account not already in `gh auth status` |

**Auth-failure recovery (allowed autonomous pattern):**

When `git push` fails with `remote: Repository not found`, `authentication required`, or HTTP 401/403 — the cause is almost always an account mismatch. The active `gh auth` account doesn't own (or can't see) the remote repo. Switching to the account that DOES own it is safe and deterministic: no data loss, no history rewrite, no branch change. Do it before reporting failure.

```bash
# 1. Extract expected owner from the remote URL (handles https + ssh forms)
REMOTE_URL=$(git remote get-url origin)
EXPECTED_OWNER=$(echo "$REMOTE_URL" | sed -E 's|.*github\.com[:/]([^/]+)/.*|\1|')

# 2. Existence check — account must already be in `gh auth status`. Never create new auth.
gh auth status 2>&1 | grep -q "account $EXPECTED_OWNER" || {
  echo "AUTH RECOVERY SKIPPED: $EXPECTED_OWNER not in gh auth status — stopping and reporting"
  exit 1
}

# 3. Capture current active account so we can restore after push
PREVIOUS_OWNER=$(gh auth status 2>&1 | grep -B1 "Active account: true" | grep "Logged in" | sed -E 's|.*account ([^ ]+) .*|\1|')

# 4. Switch, retry push ONCE, restore previous account
gh auth switch --user "$EXPECTED_OWNER" && git push origin main
PUSH_EXIT=$?
[ -n "$PREVIOUS_OWNER" ] && gh auth switch --user "$PREVIOUS_OWNER" 2>/dev/null || true

# 5. If push still failed after switch, stop and report both attempts
[ "$PUSH_EXIT" -eq 0 ] || { echo "AUTH RECOVERY FAILED after switch to $EXPECTED_OWNER"; exit 1; }
```

**Hard safety rules for auth-switch recovery:**

- **Deterministic match only.** Owner extracted from the remote URL. No guessing, no scanning for "probably correct" accounts.
- **Existence check first.** `gh auth status` must already show the account. Never run `gh auth login`, never prompt interactively, never create new credentials.
- **Try once.** If the switch succeeds but the push still fails, stop and report — don't cycle through multiple accounts.
- **Restore previous account after push.** The terminal must not be left in an unexpected active-account state for subsequent commands.
- **Report what happened.** Final output must name the account that owned the successful push so the user can audit.

**Fallback:** if the auth-switch recovery also fails (e.g., the expected account exists locally but lacks push permission on the remote), stop the loop and report both the initial failure AND the switch attempt.

**Still forbidden under all conditions:** force-push (any variant) without explicit user directive, silent branch switch, disabling branch protections, creating new accounts, modifying `~/.gitconfig`, changing remote URLs silently, `gh auth login` inside this recovery.

**Other guardrails:**

- If the repo uses PR-only flow (main is protected): create branch `skills/improve-framework/<date>-<slug>`, push, and open a PR with the proposal as the PR body. Do not declare the loop done until the PR is opened (merging remains the user's call).
- Report the remote SHA + unpushed count in the final output so the user can see what landed. If auth-switch was used, name the account that owned the successful push.

# Project Secrets Hygiene

Canonical pattern for storing service credentials (API tokens, webhook secrets, DB passwords) in svc projects. Replaces the anti-pattern of putting tokens in `~/.bashrc` where they pollute every shell regardless of project context.

Surfaced 2026-04-20 during WI-088 when a CF API token in `~/.bashrc` had to be rotated; the rotation broke every unrelated project using the same shared export.

## The rule

**Each project's secrets live in `<repo-root>/.env.local`, gitignored, perms 600.** Never in `~/.bashrc`. Never in a shared home-dir file.

## Why

1. **Per-project scoping:** rotating example-marketplace's CF token shouldn't affect unrelated projects
2. **No cross-project leakage:** an Opus session inside example-marketplace shouldn't accidentally see credentials meant for covibefusion
3. **Shell-independent:** `~/.bashrc` only loads for interactive shells; `.env.local` works with any tool (Vite auto-loads, loader script sources for bash)
4. **Gitignore double-protection:** standard `.gitignore` rules already ignore `.env.*` and `*.local` in our projects
5. **Standard convention:** matches 12-factor app + Vite + Next.js + dotenv ecosystem expectations

## Setup per project

```bash
cd <repo-root>

# 1. Verify .env.local is gitignored (should be — both .env.* and *.local patterns catch it)
git check-ignore -v .env.local                    # must print an ignore rule
git ls-files | grep -E "^\.env"                   # must be empty

# 2. Create or open .env.local — 600 perms from the start
touch .env.local && chmod 600 .env.local

# 3. Add credentials in KEY=VALUE format, one per line
echo 'CLOUDFLARE_API_TOKEN=cfut_...' >> .env.local
echo 'CLOUDFLARE_ZONE_ID_EXAMPLE_MARKETPLACE=fbb3b2cb0a98367fcc9b130558294ed3' >> .env.local
```

## Loading into a shell session

The svc framework provides `scripts/load-project-env.sh` — walks up from current dir to find the nearest `.env.local`, refuses to load if perms > 600, exports every KEY=VALUE line.

```bash
# In a svc skill, dispatch script, or bash command that needs secrets:
source /path/to/seriousvibecoding/scripts/load-project-env.sh

# Then use the loaded vars:
curl -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" ...
```

Contract:
- Walks up from `$PWD` (or optional start-dir argument) looking for `.env.local`
- Validates perms are `600` or `400` — refuses with exit 2 otherwise (security)
- Prints ONLY the names of loaded vars to stderr (never values)
- Exports each var into caller shell via `set -a` / source / `set +a`
- Exit 0 on success, 1 if no `.env.local` found, 2 on perms violation

## Exceptions (when to use `~/.bashrc` instead)

- **Truly global tools** where per-project scoping makes no sense — e.g., `EDITOR`, `PATH` additions for CLI tools, `GIT_AUTHOR_NAME`
- **Provider-level SDK auth** that the provider's own CLI reads from a fixed location (e.g., `~/.base44/auth/auth.json`, `~/.codex/auth.json`, `~/.opencode/auth.json`) — those are owned by the provider, not by projects

Everything else (API keys scoped to one app, webhook secrets, project-specific env vars) goes in the project's `.env.local`.

## Migration from `~/.bashrc`

If you currently have tokens in `~/.bashrc`:

1. Identify which project each token belongs to
2. Move each to that project's `.env.local` (600 perms, gitignored verified)
3. Remove the inline `export` line from `~/.bashrc` (keep a backup: `cp ~/.bashrc ~/.bashrc.bak-$(date +%s)`)
4. Open a fresh shell; tools that needed the token from `~/.bashrc` now source `scripts/load-project-env.sh` from inside the project

## Checklist before committing ANY new env var

- [ ] `.env.local` perms are `600`: `ls -la .env.local`
- [ ] `.gitignore` catches the file: `git check-ignore -v .env.local`
- [ ] File is not tracked: `git ls-files | grep -E "^\.env\.local$"` is empty
- [ ] `git status` does NOT show `.env.local` as untracked or modified
- [ ] The value is not echoed to any log, CI output, or chat transcript

## Masking patterns (for when you MUST print something)

Correct:
```bash
[ -n "$TOKEN" ] && echo "TOKEN: <set>" || echo "TOKEN: <empty>"
echo "TOKEN prefix: ${TOKEN:0:6}..."    # first 6 chars only
```

Wrong (leaks full value):
```bash
echo "TOKEN: ${TOKEN:+<set>}${TOKEN:-<empty>}"   # DOES NOT mask — concatenates
echo "TOKEN: $TOKEN"                              # obvious leak
```

## History

- 2026-04-20: pattern established during WI-088 CF cache purge; framework gained `scripts/load-project-env.sh` and this reference doc. Triggered by token-in-bashrc requiring rotation that would have broken unrelated projects.

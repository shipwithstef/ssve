# Codex Hook Execution Integrity

Codex host enforcement uses one session-scoped authority boundary. Repository state is evidence, not prompt authority: a branch name, the last session contract, or a single active graph must never manufacture permission to continue another session.

## State model

| State | Proof | Meaning |
|---|---|---|
| `unconfigured` | no managed hook entries | svc Codex controls are absent |
| `configured` | user hooks file contains the three managed commands | configuration was written |
| `effective-single-stop` | user plus repository hook view has exactly one svc Stop, the firewall | no parallel Stop can bypass identity |
| `trusted` | Codex `/hooks` reports the commands trusted | Codex will execute the configuration |
| `runtime-observed` | controlled deny, post-load allow, and foreign-Stop allow traces exist | the live host exercised the boundary |

Do not collapse these states. `./setup --host codex` can prove configuration and the effective file view; it cannot claim trust or runtime observation without the host trace.

## Prompt authority

`UserPromptSubmit` writes one atomic `prompt-authority.json` under the machine-local runtime root, keyed by the real repository path and Codex session. The file contains only schema version, session/turn IDs, a prompt hash, absolute cwd/repository, explicit WI, continuation classification, and timestamp. Raw prompt text, commands, environment variables, remotes, credentials, and secrets are prohibited.

Records use directory mode `0700` and file mode `0600`. The default TTL is 240 minutes (`SVC_CODEX_AUTHORITY_TTL_MIN`). Prompt-time cleanup deletes only current-user, non-symlink sibling session directories below the exact repository identity root.

Runtime selection is centralized in `hooks/lib/svc-runtime-root.mjs`. A valid
`XDG_RUNTIME_DIR` remains preferred. When XDG is unset or its advertised path is
absent, the framework automatically uses the current user's private home cache;
Codex retains the compatible `~/.cache/svc-codex-runtime` leaf. The framework
never creates `/run/user/<uid>` or another missing XDG parent. An existing
symlink, foreign-owned directory, non-directory, or mode other than `0700` is a
security failure and does not silently fall back. `SVC_RUNTIME_DIR` is the
host-agnostic shared-parent configuration; the older
`SVC_CODEX_RUNTIME_DIR` exact-leaf setting remains compatible for Codex.
Both explicit variables must name pre-existing, current-user-owned `0700`
directories. `HOME`, `SVC_RUNTIME_DIR`, and `SVC_CODEX_RUNTIME_DIR` are trusted
same-user configuration inputs: changing them intentionally relocates runtime
authority state, while unsafe or missing configured targets fail with the exact
path and remediation contract instead of being created implicitly.

## Composite Stop

`svc-codex-stop-firewall.mjs` allows Stop unless the current payload exactly matches a fresh authority record with explicit, non-negated `continue`, `resume`, or `end_to_end` intent. Direct and natural negations such as `do not try to continue`, `we should not continue`, and `I'd rather not continue` never authorize continuation. Merely mentioning a WI for summary, review, correction, or a new request never authorizes continuation. For continuation prompts, it resolves a target only from the explicit current-turn WI or a same-session route binding created after the authority record. A fresh foreign claim, an unknown owner shape, or a claim without provable freshness returns allow before task status is calculated. Only then may the firewall invoke the shared completion guard with an explicit `SVC_WORKER_WI`.

Codex must have exactly one effective svc Stop hook. The wirer prunes the obsolete direct shared guard and refuses a user-plus-repository view with zero or multiple svc Stops.

## Exact skill loading

Governed mutations require `scripts/codex-load-skill.mjs` for the one active task in the current worktree. The receipt binds session, absolute graph, numeric task, declared skill, real skill path and SHA-256, and real worktree. A later turn remains allowed while those values and the skill bytes remain unchanged. Foreign session, task, worktree, path, or stale hash denies.

The exact recovery command printed by the enforcer is the sole pre-receipt Bash exception. Its graph, task, skill, and optional current turn must match the active task exactly; altered loader commands remain governed. Before it changes the graph, the loader validates its canonical skill and installed task-graph helper, preflights runtime receipt storage, and resolves current WI authority. Predictable failures leave the graph and any prior receipt byte-identical. If the process stops after atomic graph activation but before session-receipt publication, the same exact command forward-completes that one safe partial state; subsequent exact retries rewrite neither graph nor receipt. In this framework repository, the enforcer compares the resulting receipt path and hash to the current canonical worktree `SKILL.md`. In a consumer repository without in-tree skill source, the canonical source is the approved installed Codex skill path; arbitrary receipt paths remain rejected.

Use:

```bash
node scripts/codex-load-skill.mjs --graph /absolute/worktree/.svc/lane-tasks-WI-485.json --task 1 --skill execute-changeset --turn TURN_ID
```

## Read-only boundary

The enforcer allows read tools and a strict lexical subset of unchained Bash: `git status|log|diff|show` without output or external-helper flags; `ls`, `pwd`, `cat`, `head`, `tail`, `wc`, and `sha256sum`; `rg` without command-spawning `--pre`, `--hostname-bin`, or `-z`/`--search-zip`; `find` without mutation or command-execution actions (`-delete`, `-exec*`, `-ok*`, `-fprint*`, or `-fls`); and `test`. Redirects, pipelines, subshells, command substitution, chaining, quotes, escapes, unknown options, and unlisted tools require a receipt. This intentionally sends legitimate but shell-ambiguous reads through the governed path instead of guessing how a shell will tokenize them.

PreToolUse is preventive but not omniscient. Payload shape or host coverage can change, and MCP tools may hide write behavior. Post-action validation and the mandatory receipt chain remain required.

## Recovery and rollback

- Missing receipt: run the exact recovery command in the denial.
- Missing XDG runtime root: rerun normally; the shared resolver automatically uses the private home-cache fallback. No per-command workaround is required.
- Compromised existing runtime root: repair or remove the stale host configuration that advertises it. The framework intentionally fails closed instead of bypassing an existing unsafe root. A managed host may configure one pre-existing current-user `0700` `SVC_RUNTIME_DIR` parent for all consumers.
- Untrusted hooks: inspect and trust the managed commands through Codex `/hooks`; do not report runtime-observed until the controlled trace passes.
- Wiring regression: restore the adjacent timestamped backup or rerun the wirer from the prior commit.
- Runtime cleanup: remove only the current repository/session directory under the verified runtime root; it is regenerable.

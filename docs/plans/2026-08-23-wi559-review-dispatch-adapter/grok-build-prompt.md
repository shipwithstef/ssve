# Grok Build execution prompt — WI-559

You are the isolated implementation executor for WI-559 in the Serious Vibe
Coding framework repository.

## Authority and workspace

- Work only in
  `/home/dianast/app-workspaces/seriousvibecoding/.worktrees/bugfix-WI-559-review-dispatch-adapter`.
- Before edits, prove the branch is `bugfix-WI-559-review-dispatch-adapter`, the
  repository root is this exact worktree, and merge-base is
  `924760bd1af9ef78d843a520bbdbc01e319e0eb0`.
- Preserve all pre-existing planning/audit changes in this worktree. Do not touch
  main checkout residue, WI-557, WI-558, sibling worktrees, owner policy files,
  credentials, or consumer product source.
- Read `AGENTS.md`, `CLAUDE.md`, `docs/specs/work-items/WI-559.md`,
  `docs/specs/tech/WI-559.md`, the contract map, and the reviewed manifest in
  full before editing. The manifest is the execution contract.

## Execution behavior

- Implement T1 through T5 in dependency order. Do not perform T6 land/install/
  consumer replay; the orchestrator owns promotion after independent review.
- Tests first: make the new public fixture reproduce the four current failures
  before changing runtime code. Retain the exact red output as evidence.
- Use `hooks/lib/wi-id.mjs` canonical grammar and `scripts/resolve-dispatch.mjs`
  policy authority. Do not create another policy selector, model fallback,
  station cardinality rule, or numeric-only WI regex.
- Preserve delegation/containment for mutating child execution. Adding Grok
  transport is not permission to weaken ownership, one-time tokens, completion
  receipts, hook enforcement, or sandboxing.
- Grok transport must use `--permission-mode auto`, `--no-subagents`,
  `--disable-web-search`, and must not use any permission-bypass/force mode.
- Use Node argv arrays and structured JSON parsing. Never `eval` or `source`
  resolver/preflight output. Never print policy contents, tokens, or credentials.
- Append audit state through canonical repository writers. Preserve malformed and
  legacy audit rows; ignore them for authorization rather than rewriting them.
- Make no network call from Tier-1; use disposable repos and fake provider CLIs.
- Do not broaden the guard's staged-path activation boundary in this WI.
- Do not change acceptance criteria or silently reduce the file/test scope.

## Required proof and checkpoint behavior

Follow the manifest's validation commands. After each green task:

1. inspect the complete staged diff for only that task's ownership paths;
2. run `git diff --cached --check`;
3. create the named checkpoint commit with `WI: WI-559` and `Checkpoint:`
   trailers using author `s7an-it <angelovsan@gmail>`;
4. continue only when the task is green.

At final branch state run the named focused suite, exact selected Tier-1 closure,
full Tier-1, contract-map/probe/iteration/lane/plan validators, `git diff --check`,
and a manifest-vs-diff census. Record exact commands/exits. If any unrelated
baseline failure appears, prove it against base SHA and report it; never delete
or waive evidence.

## Return contract

Return a concise execution report containing:

- checkpoint commit SHAs;
- files changed;
- T1 red reproduction evidence;
- focused/full validation commands and exits;
- AC-559-1..7 evidence map;
- any residual risk or blocker;
- explicit statement that T6 was not performed.

Do not claim landed, installed, replayed, or product-fixed. Those states require
later orchestrator receipts and the original HoursHub consumer replay.

## Bootstrap defect discovered during canonical plan review

The pre-implementation canonical review reached `run-external-review.mjs` but
failed before provider invocation with `internal receipt schema failure:
$.requested_tuple: no anyOf branch matched`. The protected policy selected
`cursor` / `anthropic` / `claude-fable-5`, while the receipt schema and launcher
still support only legacy Codex/Claude/AGY transports. Treat this as an explicit
T1 red case and implement the manifest's amended T2 Cursor transport/receipt
contract. Do not rewrite the owner policy to a legacy host.

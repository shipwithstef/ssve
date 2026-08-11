# superpowers — Testing Infrastructure Details

## Test Architecture Overview

| Suite | Target | Runtime | Mechanism |
|---|---|---|---|
| Explicit skill requests | 9 phrasings trigger Skill tool | ~2 min each | `claude -p` headless + stream-json |
| Skill triggering | 6 natural prompts | ~2 min each | Same, natural language |
| Multi-turn triggering | Context-buildup failure mode | ~5 min | `claude --continue` multi-turn |
| Brainstorm server unit | WebSocket protocol | <10s | Direct module import |
| Brainstorm server integration | HTTP + file watching + events | <30s | Child process + `ws` client |
| Windows lifecycle | Owner PID monitoring | ~75s each | Platform detection tests |
| SDD E2E | Full skill execution | 10-30 min | Session transcript JSONL inspection |
| Claude Code unit | Skill content verification | ~2 min | `run_claude` + `assert_*` helpers |

## Skill Triggering Tests

### Explicit Skill Requests (9 phrasings)
Tests whether specific phrasings invoke the Skill tool:

| Prompt | Tests |
|---|---|
| `subagent-driven-development-please.txt` | Bare skill name request |
| `use-systematic-debugging.txt` | "use X to figure out" |
| `please-use-brainstorming.txt` | "please use the X skill" |
| `mid-conversation-execute-plan.txt` | Mid-conversation direct request |
| `action-oriented.txt` | "Do subagent-driven development on this" |
| `after-planning-flow.txt` | After Claude described options, user picks |
| `claude-suggested-it.txt` | Claude suggested SDD, user accepts |
| `i-know-what-sdd-means.txt` | User explains what SDD means then requests it |
| `skip-formalities.txt` | "Don't waste time - just start" |

### Skill Triggering (6 natural prompts)
Tests whether natural descriptions trigger the right skill without naming it:

| Prompt | Expected skill |
|---|---|
| 4 independent test failures listed | dispatching-parallel-agents |
| "I have a plan that needs to be executed" | executing-plans |
| "Can you review the changes before merge?" | requesting-code-review |
| Stack trace with TypeError | systematic-debugging |
| "Can you implement this?" (with spec) | test-driven-development |
| Full requirements spec, multiple steps | writing-plans |

### Multi-Turn Tests (Known Failure Mode)
The specific failure: Claude describes a skill → user requests it → Claude skips Skill tool.

| Test | Turns | Critical turn |
|---|---|---|
| `run-multiturn-test.sh` | 3 | Turn 3: "subagent-driven-development, please" |
| `run-extended-multiturn-test.sh` | 5 | Turn 5: same request after more context |
| `run-haiku-test.sh` | 5 | Same as extended, using haiku model |
| `run-claude-describes-sdd.sh` | 2 | Turn 2: request after Claude described SDD |

**Key insight:** More conversation history = harder for Claude to invoke Skill tool.

### Test Mechanism
- `claude -p "$PROMPT" --plugin-dir "$PLUGIN_DIR" --dangerously-skip-permissions --max-turns 3 --output-format stream-json`
- Detection: `grep '"name":"Skill"'` AND `grep '"skill":"([^"]*:)?<skill>"'`
- Premature action check: find first Skill invocation line, check for non-Skill/non-TodoWrite tools before it
- Multi-turn: `claude --continue` resumes conversation

## Brainstorm Server Tests

### Unit Tests (ws-protocol.test.js)
- Direct module import of `server.cjs` (no network)
- RFC 6455 Section 4.2.2 test vector: `dGhlIHNhbXBsZSBub25jZQ==` → `s3pPLMBiTxaQ9kYGzzhZRbK+xOo=`
- Frame encoding tests: 3 size encodings (small/medium/large)
- Boundary conditions: 125/126 bytes, 65535/65536 bytes
- Masked/unmasked client frame handling
- Multiple frames in single buffer
- JSON roundtrip through encode/decode

### Integration Tests (server.test.js)
- Server spawned as child process with `ws` npm test client
- Tests: startup JSON, HTTP serving, WebSocket messages, file watching, events capture
- Two-directory layout verified: `content/` for HTML, `state/` for events/server-info
- Fragment wrapping: `<!-- CONTENT -->` replacement, indicator bar present
- Non-choice events (hover) should NOT create events file

### Windows Lifecycle (windows-lifecycle.test.sh)
- 6 tests, ~75s each (lifecycle check window)
- Tests 1-3: Windows-specific (MSYS2/Cygwin detection, PID namespace)
- Test 4: Empty `BRAINSTORM_OWNER_PID` → server survives 75s
- Test 5: Bad PID → server self-terminates, logs "owner process exited"
- Test 6: `stop-server.sh` cleanly stops via `.server.pid`

## SDD End-to-End Tests

### Test Projects
| Project | Stack | Tasks | Complexity |
|---|---|---|---|
| go-fractals | Go + cobra CLI | 10 | Sierpinski + Mandelbrot ASCII rendering |
| svelte-todo | Svelte + TypeScript | 12 | Todo list with localStorage + Playwright E2E |

### Scaffolding
- `scaffold.sh` creates project dir, git init, copies design + plan
- `.claude/settings.local.json` with restricted permissions per language
- Go: `Bash(go:*)`, `Bash(mkdir:*)`, `Bash(git:*)`
- Svelte: `Bash(npm:*)`, `Bash(npx:*)`, `Bash(mkdir:*)`, `Bash(git:*)`

### Verification (Integration Test)
Session transcript JSONL inspection:
- Skill tool invoked with `superpowers:subagent-driven-development`
- Task tool dispatched ≥2 times
- TodoWrite used ≥1 time
- Source files created
- Tests pass (`npm test` exit 0)
- Git commits >2
- No extra features (only warns, doesn't fail)

### Token Usage Analysis
- `analyze-token-usage.py` parses JSONL session transcripts
- Main session: `type == 'assistant'` with `message.usage`
- Subagents: `type == 'user'` with `toolUseResult` containing `usage` + `agentId`
- Pricing: $3/$15 per M tokens input/output
- Cache creation tokens counted in input cost
- Example: 8 subagents for 2-task plan at ~$4.67

## Skill Content Tests (Claude Code Unit)

9 tests verifying SDD skill content via `run_claude`:
1. Skill recognized by name
2. Spec review before code quality (`assert_order`)
3. Self-review includes completeness
4. Plan read once at beginning
5. Spec reviewer doesn't trust reports
6. Review loops until approved
7. Full task text provided (not file reference)
8. Worktree requirement
9. Main branch warning

## OpenCode Tests

| Test | Needs OpenCode | What it checks |
|---|---|---|
| `test-plugin-loading.sh` | No | Symlink, syntax check, no wrong paths |
| `test-priority.sh` | Yes | Project > Personal > Superpowers priority |
| `test-tools.sh` | Yes | `find_skills` and `use_skill` functionality |

### Priority Resolution
- Three skill locations with different markers
- Project overrides Personal overrides Superpowers
- `superpowers:` prefix forces superpowers version
- `project:` prefix outside project fails gracefully

## Analysis — What's valuable for svc

The skill triggering test methodology (natural language prompts + stream-json
inspection) could be adapted for svc skill eval tier 2. The known failure mode
(context buildup prevents skill invocation) is relevant to any framework using
session-start injection. The SDD E2E test pattern (scaffold + headless claude
+ transcript inspection) provides a template for end-to-end framework testing.

## L4 Pointers

- Test runner: `tests/claude-code/run-skill-tests.sh`
- Helpers: `tests/claude-code/test-helpers.sh`
- Token analysis: `tests/claude-code/analyze-token-usage.py`
- Explicit request prompts: `tests/explicit-skill-requests/prompts/*.txt`
- Skill trigger prompts: `tests/skill-triggering/prompts/*.txt`
- Multi-turn tests: `tests/explicit-skill-requests/run-{multiturn,extended-multiturn,haiku,claude-describes-sdd}-test.sh`
- SDD scaffolds: `tests/subagent-driven-dev/{go-fractals,svelte-todo}/scaffold.sh`
- OpenCode setup: `tests/opencode/setup.sh`

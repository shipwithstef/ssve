# Everything Claude Code (ECC) — CAPABILITIES

Source: https://github.com/affaan-m/everything-claude-code
Version: v1.10.0 (SHA: 125d5e619905d97b519a887d5bc7332dcc448a52, analyzed 2026-04-12)
Layer 3: details/*.md

---

## Identity

ECC is a production-ready Claude Code plugin framed as an **agent harness performance system** — a comprehensive toolkit of agents, skills, hooks, commands, rules, and MCP configs evolved from 10+ months of daily use. Anthropic hackathon winner (Cerebral Valley x Anthropic, Feb 2026). 140K+ stars, 21K+ forks, 170+ contributors. Works across Claude Code, Codex, Cursor, OpenCode, Gemini, Antigravity, and more.

---

## Surface Counts (v1.10.0)

| Component | Count |
|-----------|-------|
| Agents | 47 |
| Skills | 181 |
| Legacy command shims | 79 |
| Rule sets | 14 languages + common |
| Supported harnesses | 8+ |
| Languages covered | 12+ |
| Test files | 1723+ passing |

---

## Agents (47)

- **Language reviewers**: typescript-reviewer, python-reviewer, go-reviewer, java-reviewer, kotlin-reviewer, rust-reviewer, cpp-reviewer, csharp-reviewer, flutter-reviewer, healthcare-reviewer, gan-evaluator
- **Build resolvers**: build-error-resolver (generic), go-build-resolver, java-build-resolver, kotlin-build-resolver, rust-build-resolver, cpp-build-resolver, dart-build-resolver, pytorch-build-resolver
- **Workflow**: planner (Opus model), tdd-guide, code-reviewer, security-reviewer, architect, refactor-cleaner, doc-updater, docs-lookup
- **Automation**: loop-operator, harness-optimizer, chief-of-staff, e2e-runner
- **Analysis**: performance-optimizer, comment-analyzer, code-explorer, code-architect, code-simplifier, type-design-analyzer, silent-failure-hunter, pr-test-analyzer, conversation-analyzer
- **Open source**: opensource-forker, opensource-packager, opensource-sanitizer
- **Media/content**: gan-generator, gan-planner, seo-specialist
- **Other**: database-reviewer, agent-introspection-debugging, agent-sort

---

## Skills (181) — Major Areas

- **Coding standards & patterns**: coding-standards, backend-patterns, frontend-patterns, api-design, database-migrations, deployment-patterns, docker-patterns
- **Language-specific**: golang-patterns/testing, django-patterns/security/tdd/verification, laravel-patterns/security/tdd/verification, python-patterns/testing, springboot-patterns/security/tdd/verification, cpp-coding-standards/testing, swift-actor-persistence, swift-protocol-di-testing, swift-concurrency-6-2, perl-patterns/security/testing, compose-multiplatform-patterns, dart-flutter-patterns, dotnet-patterns, nestjs-patterns
- **Testing**: tdd-workflow, e2e-testing, eval-harness, verification-loop, ai-regression-testing, benchmark, browser-qa
- **AI/ML**: claude-api, cost-aware-llm-pipeline, eval-harness, agent-harness-construction, autonomous-loops, continuous-agent-loop, context-budget, iterative-retrieval
- **Learning system**: continuous-learning (v1 legacy), continuous-learning-v2 (instinct-based, v2.1 project-scoped)
- **Security**: security-review, security-scan (AgentShield), defi-amm-security, evm-token-decimals, llm-trading-agent-security, hipaa-compliance, healthcare-phi-compliance
- **Business/content**: brand-voice, content-engine, article-writing, market-research, investor-materials, investor-outreach, crosspost, social-graph-ranker, connections-optimizer
- **Operator workflows**: google-workspace-ops, customer-billing-ops, project-flow-ops, workspace-surface-audit, ecc-tools-cost-audit, github-ops, knowledge-ops, automation-audit-ops, email-ops, finance-billing-ops, messages-ops, research-ops, terminal-ops, jira-integration
- **Media**: frontend-slides, manim-video, remotion-video-creation, videodb, fal-ai-media, ui-demo
- **Mobile/Apple**: liquid-glass-design, foundation-models-on-device, android-clean-architecture
- **Discovery/routing**: configure-ecc, skill-stocktake, agent-sort, codebase-onboarding, code-tour, council, blueprint, agentic-engineering

---

## Hooks System

Runtime controls: `ECC_HOOK_PROFILE=minimal|standard|strict`, `ECC_DISABLED_HOOKS=<comma-separated-ids>`

| Phase | Key Hooks |
|-------|-----------|
| PreToolUse | block-no-verify (blocks --no-verify bypass), auto-tmux-dev, tmux-reminder, git-push-reminder, commit-quality, doc-file-warning, suggest-compact, observe (continuous learning), governance-capture, config-protection (blocks linter config edits), mcp-health-check |
| PostToolUse | command-log-audit, command-log-cost, pr-created, quality-gate (async), design-quality-check, post-edit-accumulator, console-warn, session-activity-tracker, observe (results) |
| PreCompact | pre-compact (save state before compaction) |
| Stop | format-typecheck (batch biome/prettier + tsc), check-console-log, session-end, evaluate-session (extract patterns), cost-tracker, desktop-notify |
| SessionStart | session-start-bootstrap (load context + detect package manager) |
| SessionEnd | session-end-marker (non-blocking lifecycle) |

All hooks use script-based Node.js entrypoints via `${CLAUDE_PLUGIN_ROOT}`. Stop hooks use root-resolution pattern to work outside plugin-managed env injection.

---

## Commands (79 — Legacy Shims)

Slash entries that delegate to underlying skills. Key ones:
- Dev workflow: `/tdd`, `/plan`, `/e2e`, `/code-review`, `/build-fix`, `/refactor-clean`, `/verify`
- Learning: `/learn`, `/learn-eval`, `/skill-create`, `/instinct-status`, `/instinct-import`, `/instinct-export`, `/evolve`, `/prune`
- Session: `/sessions`, `/checkpoint`, `/save-session`
- Multi-agent: `/orchestrate`, `/multi-plan`, `/multi-execute`, `/multi-backend`, `/multi-frontend`, `/multi-workflow`, `/pm2`
- Harness: `/harness-audit`, `/loop-start`, `/loop-status`, `/quality-gate`, `/model-route`
- Language: `/go-review`, `/go-test`, `/go-build`, `/python-review`, `/flutter-review`, `/flutter-test`, `/flutter-build`
- Hook management: `/hookify`, `/hookify-help`, `/hookify-list`, `/hookify-configure`

---

## Rules

Language directories under `rules/`: common, typescript, python, golang, java, kotlin, rust, cpp, csharp, swift, perl, php, dart, web, zh.

Each language dir contains: coding-style.md, testing.md, security.md, performance.md, patterns.md, hooks.md, agents.md, git-workflow.md (common subset).

Not auto-distributed by plugin — must install manually from repo.

---

## Install System

- **Plugin**: `/plugin install ecc@ecc` (Claude Code marketplace)
- **OSS**: `./install.sh --profile full|core|developer|security|research`
- **Language-selective**: `./install.sh typescript python golang swift php`
- **Target-selective**: `--target cursor|antigravity|gemini`
- **Windows**: `.\install.ps1` or `npx ecc-install`
- **State store**: SQLite-backed, tracks installed components, enables incremental updates
- **Repair**: `ecc doctor` + `ecc repair` before reinstalling after wipe

---

## Continuous Learning v2.1 (Instinct-Based)

- Observe hooks (pre/post every tool) capture tool use into atomic "instincts"
- v2.1: project-scoped storage under `projects/<hash>/` vs global `~/.claude/homunculus/`
- Confidence scoring on each instinct; instincts can be promoted from project to global
- `/evolve` clusters related instincts into full skills
- Config: `skills/continuous-learning-v2/config.json`, hooks in `skills/continuous-learning-v2/hooks/`

---

## AgentShield (Security Auditor)

Built at Anthropic hackathon. `npx ecc-agentshield scan`. 1282 tests, 98% coverage, 102 static analysis rules. Scans: CLAUDE.md, settings.json, MCP configs, hooks, agent definitions, skills across 5 categories (secrets detection with 14 patterns, permission audit, hook injection, MCP server risk profiling, agent config review). `--opus` flag runs red-team/blue-team/auditor pipeline with 3x Opus 4.6 agents. Output: A-F grades, JSON, Markdown, HTML; exit code 2 on critical for CI build gates.

---

## ECC 2.0 Alpha (Rust, `ecc2/`)

Control-plane prototype in Rust (not GA). Provides: dashboard, start, sessions, status, stop, resume, daemon commands. SQLite session store, terminal UI, worktree-aware session scaffolding, observability + risk-scoring. Target: manage many agent sessions from one surface.

---

## MCP Configs

Pre-built templates in `mcp-configs/mcp-servers.json` for: jira, github, firecrawl, supabase, memory, omega-memory, Context7, vercel, railway, and others. All templates use placeholder env vars.

---

## Cross-Harness Support

- Claude Code: primary surface, plugin.json, hooks.json
- Codex: AGENTS.md, agent.yaml, .codex/config.toml, scripts/sync-ecc-to-codex.sh
- Cursor: .cursor/ rules
- OpenCode: .opencode/ plugin with TypeScript/compiled dist, 20+ event types, 3 native custom tools
- Gemini: .gemini/
- Antigravity, Trae, Kiro, CodeBuddy: .agents/ skills directory with OpenAI-format agents

---

## Key Design Philosophies (from SOUL.md + Longform Guide)

1. Agent-First: route to specialists proactively
2. Test-Driven: write tests before trusting implementation
3. Security-First: validate inputs, protect secrets
4. Immutability: prefer explicit state transitions
5. Plan Before Execute: break complex changes into phases
6. Token economics: model routing (Haiku→search, Sonnet→coding, Opus→complex/security)
7. CLI-over-MCP: wrap platform CLIs into skills to save context vs always-on MCPs
8. pass@k vs pass^k: pass@k when correctness-once is enough, pass^k for consistency

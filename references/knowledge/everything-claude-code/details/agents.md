# ECC Agents — Detail

Source: `agents/*.md`, `CLAUDE.md`, `.claude-plugin/plugin.json`

## Mechanism

Agents are Markdown files with YAML frontmatter (`name`, `description`, `tools`, `model`). Stored in `agents/`. The `description` controls when the orchestrator proactively routes to the agent. Model is specified per-agent (most use `opus` for complex reasoning, some use `sonnet`).

Agent format example (planner.md):
```yaml
---
name: planner
description: Expert planning specialist... Use PROACTIVELY when users request feature implementation...
tools: ["Read", "Grep", "Glob"]
model: opus
---
```

## Language Reviewers

| Agent | Language/Domain |
|-------|----------------|
| typescript-reviewer | TypeScript/JavaScript |
| python-reviewer | Python |
| go-reviewer | Go |
| java-reviewer | Java/Spring Boot |
| kotlin-reviewer | Kotlin/Android/KMP |
| rust-reviewer | Rust |
| cpp-reviewer | C++ |
| csharp-reviewer | C#/.NET |
| flutter-reviewer | Flutter/Dart |
| database-reviewer | Database/Supabase |
| healthcare-reviewer | Healthcare compliance/PHI |
| pytorch-build-resolver | PyTorch/CUDA training errors |

## Build Resolvers

| Agent | Domain |
|-------|--------|
| build-error-resolver | Generic build errors |
| go-build-resolver | Go build/toolchain |
| java-build-resolver | Java/Maven/Gradle |
| kotlin-build-resolver | Kotlin/Gradle |
| rust-build-resolver | Rust/Cargo |
| cpp-build-resolver | C++/CMake |
| dart-build-resolver | Dart/Flutter build |
| pytorch-build-resolver | PyTorch/CUDA |

## Workflow Agents

| Agent | Role |
|-------|------|
| planner | Feature implementation planning (Opus, read-only tools) |
| tdd-guide | Test-driven development guidance |
| code-reviewer | Code quality and security review |
| security-reviewer | Vulnerability analysis, sensitive code |
| architect | System design decisions |
| refactor-cleaner | Dead code cleanup |
| doc-updater | Documentation synchronization |
| docs-lookup | Documentation/API reference lookup |

## Automation Agents

| Agent | Role |
|-------|------|
| loop-operator | Autonomous loop execution |
| harness-optimizer | Harness config tuning |
| chief-of-staff | Communication triage, drafts |
| e2e-runner | Playwright E2E test execution |
| performance-optimizer | Performance analysis |

## Analysis Agents

| Agent | Role |
|-------|------|
| comment-analyzer | Code comment quality analysis |
| code-explorer | Codebase exploration |
| code-architect | Architecture analysis |
| code-simplifier | Code simplification review |
| type-design-analyzer | TypeScript type design |
| silent-failure-hunter | Finds silent failure patterns |
| pr-test-analyzer | PR test coverage analysis |
| conversation-analyzer | Session conversation analysis (for hookify) |
| agent-introspection-debugging | Self-debugging framework for agent failures |

## Open Source Workflow

| Agent | Role |
|-------|------|
| opensource-forker | Fork external repos for ECC integration |
| opensource-packager | Package open source libs for distribution |
| opensource-sanitizer | Sanitize external code for ECC-native porting |

## Specialized

| Agent | Role |
|-------|------|
| gan-generator | GAN model code generation |
| gan-planner | GAN training plan design |
| gan-evaluator | GAN output evaluation |
| seo-specialist | SEO analysis and optimization |
| agent-sort | Classify agents/skills into DAILY vs LIBRARY buckets |

## L4 Pointers

- Planner agent full prompt with worked Stripe example: `agents/planner.md`
- All agents list: `agents/` directory (47 files)
- Cross-harness agent format (OpenAI-compatible): `.agents/skills/*/agents/openai.yaml`

# anthropic-skills — Capabilities

Source: https://github.com/anthropics/skills
SHA: pre-registry (analyzed 2026-04-06)

## What It Is

Official Anthropic skill examples and reference implementations. 17 skills
covering documents, design, APIs, and meta-skills. Plugin marketplace install.

## Skills (17)

| Skill | Category |
|---|---|
| `skill-creator` | Meta — create, test, optimize skills with eval infrastructure |
| `pdf` | Document — read/generate PDFs |
| `docx` | Document — read/generate Word docs |
| `xlsx` | Document — read/generate spreadsheets |
| `pptx` | Document — read/generate presentations |
| `doc-coauthoring` | Document — collaborative editing |
| `claude-api` | Dev — build with Claude API/SDK |
| `frontend-design` | Dev — UI development |
| `mcp-builder` | Dev — build MCP servers |
| `webapp-testing` | Dev — test web applications |
| `web-artifacts-builder` | Dev — build web artifacts |
| `algorithmic-art` | Creative — generative art |
| `canvas-design` | Creative — visual design |
| `theme-factory` | Creative — design systems |
| `slack-gif-creator` | Creative — Slack GIF creation |
| `brand-guidelines` | Enterprise — brand standards |
| `internal-comms` | Enterprise — internal communications |

## Key Patterns We Took

- skill-creator → create-skill (forked with svc mutations)
  - Eval viewer (generate_review.py)
  - Benchmark aggregation (aggregate_benchmark.py)
  - Description optimization (run_loop.py with 60/40 train/test)
  - Grader/comparator/analyzer agents

## Install Method

Plugin marketplace: `/plugin marketplace add anthropics/skills`
Or: `npx skills add anthropics/skills --skill skill-creator`

# Knowledge Index

Layered knowledge extracted from analyzed sources. Read this file FIRST —
it tells you what we know about each source without loading details.

## How This Works

```
Layer 1: INDEX.md (this file)     — one-liner per source, always loaded (<200 tokens)
Layer 2: <source>/CAPABILITIES.md — each capability, 1 sentence (~500 tokens)
Layer 3: <source>/details/*.md    — extracted specifics, read on demand
```

## Versioning

Each source has a `.version` file tracking what was analyzed:

| Source type | .version contains | Stale when |
|---|---|---|
| **Open source repo** | Git SHA (`09e56893`) | Remote HEAD differs from .version SHA |
| **Closed source product** | Version + changelog URL (`v3.2.1 https://docs.stripe.com/changelog`) | New version in changelog |
| **Domain knowledge** | Date (`2026-04-06`) | 30+ days old |
| **Competitor** | Date (`2026-04-06`) | 30+ days old |

**Update protocol:**
- Open source: `git ls-remote <url> HEAD` → compare to .version → if different, clone and diff
- Closed source: check changelog URL → if new version, read changelog and update Layer 2
- Domain/competitor: if .version date is 30+ days old, re-research

**Rule:** if you need to answer "does X have Y?", read Layer 2 first.
Only go to Layer 3 if Layer 2 says "yes" and you need specifics.
NEVER launch an explore agent to re-read a source that's already indexed here.

## Self

| Source | What it is | Summary | Version | Layer 2 |
|---|---|---|---|---|
| [svc](svc/) | This framework — progressive deterministic dev | 105 skills, 7 gates, 7 lanes, 34 APs, 9 provisioned hosts, Landlock containment, runtime v2 | `v2.0.0` | [CAPABILITIES.md](svc/CAPABILITIES.md) |

## Open Source Repos

| Source | What it is | Summary | Version | Layer 2 |
|---|---|---|---|---|
| [gsd-2](gsd-2/) | Standalone CLI coding agent built on Pi SDK (v2.78.1) | 6 modes, auto pipeline, worktree git isolation, 20+ providers, native Rust engine, Next.js web UI, VS Code extension, orchestrator meta-skill | `42ef05fb` | [CAPABILITIES.md](gsd-2/CAPABILITIES.md) |
| [GSD](gsd/) | Meta-prompting + spec-driven dev (48K stars) | 69 commands, 68 workflows, 24 agents, 9 hooks, SDK, 102 features | `v1.50.0-canary.1` | [CAPABILITIES.md](gsd/CAPABILITIES.md) |
| [superpowers](superpowers/) | Skill-based dev discipline (v5.0.7) | 14 skills, TDD, worktrees, parallel agents, anti-rationalization, zero-dep | `917e5f53` | [CAPABILITIES.md](superpowers/CAPABILITIES.md) |
| [gstack](gstack/) | Founder-mode dev framework (Garry Tan/YC) | 36 skills, browse daemon, design tool, 8 hosts, Chrome extension | `v1.32.0.0` | [CAPABILITIES.md](gstack/CAPABILITIES.md) |
| [runtime-state-portability](runtime-state-portability/) | Targeted peer snapshot for secure portable runtime state | Root precedence, advisory/authority boundaries, locking/recovery, harness adapters across current gstack/Open GSD/GSD 2/Superpowers pins | multi-source 2026-07-22 | [CAPABILITIES.md](runtime-state-portability/CAPABILITIES.md) |
| [anthropic-skills](anthropic-skills/) | Official skill examples | 17 skills, skill-creator with eval infra | pre-registry | [CAPABILITIES.md](anthropic-skills/CAPABILITIES.md) |
| [harness](harness/) | Agent team architect — designs teams, generates agents + skills | 1 meta-skill, 6 arch patterns, 7-phase workflow | `2d84863b` | [CAPABILITIES.md](harness/CAPABILITIES.md) |
| [taskmaster](taskmaster/) | Completion guard for coding agents (blader) | Stop hook + compliance prompt, done-token contract, anti-rationalization rules, dual Codex/Claude support | `v4.2.0` | [CAPABILITIES.md](taskmaster/CAPABILITIES.md) |
| [vercel-find-skills](vercel-find-skills/) | Scoped skill analysis from `vercel-labs/skills` | Single-file meta-skill for discovering, vetting, and installing ecosystem skills via `skills.sh` and `npx skills` | `df0579f8` | [CAPABILITIES.md](vercel-find-skills/CAPABILITIES.md) |
| [last30days-skill](last30days-skill/) | Multi-source social search skill (mvanhorn) | 14+ sources, 8-stage pipeline, RRF fusion, LLM reranking, 1012 tests, 5 host platforms | `341da372` | [CAPABILITIES.md](last30days-skill/CAPABILITIES.md) |
| [skill-marketplaces](skill-marketplaces/) | Skill marketplace landscape (skills.sh, SkillHub, SkillsMP, LobeHub, claudemarketplaces.com) | 5 platforms mapped; skills.sh + SkillHub are the two worth automating; monetization skill inventory (14 installed, 4 external candidates) | `2026-04-10` | [CAPABILITIES.md](skill-marketplaces/CAPABILITIES.md) |
| [everything-claude-code](everything-claude-code/) | Production Claude Code plugin + harness perf system (140K stars, Anthropic hackathon winner) | 47 agents, 181 skills, 79 commands, comprehensive hooks, AgentShield security auditor, instinct-based learning v2.1, ECC 2.0 Rust alpha, 8+ harnesses | `125d5e61` | [CAPABILITIES.md](everything-claude-code/CAPABILITIES.md) |
| [stitch-mcp](stitch-mcp/) | CLI + MCP proxy for Google Stitch (davideast, Apache-2.0) | 10 CLI cmds, 7 upstream + 4 virtual tools, Spec&Handler pattern, 7 MCP clients, Agent Skills integration | `bca95541` | [CAPABILITIES.md](stitch-mcp/CAPABILITIES.md) |
| [taste-skill](taste-skill/) | High-agency frontend skills + LLM laziness research | 8 design skills (GSAP, Brutalism, Minimalism), full-output enforcement, deep research on LLM truncation root causes & remediation | `ff487253` | [CAPABILITIES.md](taste-skill/CAPABILITIES.md) |

## Closed Source Products

| Source | What it is | Version | Changelog | Layer 2 |
|---|---|---|---|---|
| [mimo](domains/mimo/) | Xiaomi MiMo — TWO-tier vendor: Token Plan (dev-only, 200M credits via opencode/Claude Code/Cursor) vs Open Platform Pay-As-You-Go (commercial, ~$0.40/$2.00 per Mtok, Business Verification required). 8 models including TTS suite (limited-time free). Critical: prod app backends MUST NOT route through Token Plan URL. | 2026-04-25 | https://xiaomimimo.com | [CAPABILITIES.md](domains/mimo/CAPABILITIES.md) |
| [namecheap](domains/namecheap/) | Domain registrar + hosting + adjacent SaaS — extracted for Example Marketplace extend-vs-cancel decision (verdict: CANCEL, 1/7 surfaces HIGH relevance) | 2026-04-25 | https://www.namecheap.com/ | [CAPABILITIES.md](domains/namecheap/CAPABILITIES.md) |
| [google-ai-pro](domains/google-ai-pro/) | Google AI Pro (€21.98/mo) consumer subscription — Gemini 3.1 Pro, Deep Research 600/mo, Veo+Flow video, NotebookLM, AI Studio, Antigravity, Jules, Code Assist, $10/mo Cloud credit, 5TB, family-of-5, Google Home Premium | 2026-04-25 | https://gemini.google/subscriptions/ | [CAPABILITIES.md](domains/google-ai-pro/CAPABILITIES.md) |

## Domains

| Domain | Summary | Analyzed | Layer 2 |
|---|---|---|---|
| [replit](domains/replit/) | Replit Agent 4 cloud IDE — autonomous app builder with 30+ connectors, MCP support, built-in auth/db/hosting, multi-artifact output | 2026-05-02 | [CAPABILITIES.md](domains/replit/CAPABILITIES.md) |
| [stripe-terminal](domains/stripe-terminal/) | Stripe Terminal integration and server-driven webhooks. | 2026-05-10 | [CAPABILITIES.md](domains/stripe-terminal/CAPABILITIES.md) |
| [cold-outbound](domains/cold-outbound/) | Cold outbound operating model: PCPL, reply-rate diagnostics, deliverability gates, compliance constraints, and early-launch pilot discipline. | 2026-05-17 | [CAPABILITIES.md](domains/cold-outbound/CAPABILITIES.md) |
| [hackathons](hackathons/) | Gemini XPRIZE — Ideate, Build, Ship, Grow real businesses in 90 days. Includes $2M prize pool, registrant perks ($100 Antigravity bonus), and AI-native operations criteria. | 2026-05-20 | [CAPABILITIES.md](hackathons/CAPABILITIES.md) |
| [eit-urban-mobility](domains/eit-urban-mobility/) | EIT Urban Mobility 2026-2028 Startup Investment Call — up to €2.5M, priced equity/SAFEs co-investing, RIS benefits (Bulgaria), pre-money valuation cap, and nominal value share subscription. | 2026-06-06 | [CAPABILITIES.md](domains/eit-urban-mobility/CAPABILITIES.md) |
| [eic-accelerator](domains/eic-accelerator/) | EIC funding portfolio (Accelerator lead): grant <€2.5M + equity €0.5-10M blended, 2026 cut-offs + 3-step process + 3-rejection cap, Pathfinder/Transition/Pre-Accelerator (BG-eligible, 2027)/STEP €10-30M, EIC Fund mechanics, BAS catalog, Fast Track/Plug-In, Seal of Excellence. EIT KIC schemes = Fast Track route into Accelerator. | 2026-06-07 | [CAPABILITIES.md](domains/eic-accelerator/CAPABILITIES.md) |

|---|---|---|---|
| [helm](domains/helm/) | Kubernetes package manager — charts, Go templating, OCI registries, release lifecycle, hooks, dependencies | 2026-05-01 | [CAPABILITIES.md](domains/helm/CAPABILITIES.md) |
| [agent-evals](domains/agent-evals/) | Methodologies and frameworks for systematically evaluating AI agent skills, including deterministic traces, negative controls, and schema-based grading. | 2026-04-23 | [CAPABILITIES.md](domains/agent-evals/CAPABILITIES.md) |
| [base44](domains/base44/) | Base44 app builder — non-developer docs (getting started, building apps, billing, workspaces, integrations, enterprise, community) + existing developer/backend coverage | 2026-05-06 | [CAPABILITIES.md](domains/base44/CAPABILITIES.md) |
| [posthog](domains/posthog/) | PostHog product analytics platform — JS/React SDK, event identity model, consent/GDPR, replay/privacy, flags, experiments, capture APIs, MCP verification, and Example Marketplace implementation fit | 2026-05-27 | [CAPABILITIES.md](domains/posthog/CAPABILITIES.md) |
| [devops-mcp](domains/devops-mcp/) | MCP ecosystem (97M installs, 95% unmonetized, 53% no-auth), K8s client-go patterns, Terraform JSON output, Go binary distribution, security-first credential handling | 2026-04-12 | [CAPABILITIES.md](domains/devops-mcp/CAPABILITIES.md) |
| [istio-gateway-api](domains/istio-gateway-api/) | Istio plus Kubernetes Gateway API patterns: channel matrix, HTTPRoute capabilities, Ambient mode topology, multicluster HBONE, VS/DR/WasmPlugin boundaries, and Argo Rollouts integration | 2026-05-01 | [CAPABILITIES.md](domains/istio-gateway-api/CAPABILITIES.md) |
| [backstage](domains/backstage/) | Backstage IDP framework patterns: chart and framework version timelines, New Frontend and Backend Systems, auth providers, catalog source patterns, ingress, secret injection, and production pitfalls | 2026-05-04 | [CAPABILITIES.md](domains/backstage/CAPABILITIES.md) |
| [opentelemetry-collector](domains/opentelemetry-collector/) | OpenTelemetry Collector deploy patterns, Kubernetes distributions, and cross-cluster agent-to-gateway transport considerations | 2026-05-08 | [CAPABILITIES.md](domains/opentelemetry-collector/CAPABILITIES.md) |
| [claude-design](domains/claude-design/) | Anthropic's April 2026 design-centric ecosystem (Opus 4.7, Live Canvas, W3C Tokens) for automated UI/UX extraction and pixel-perfect implementation. | 2026-04-18 | [CAPABILITIES.md](domains/claude-design/CAPABILITIES.md) |
| [agent-harnesses](domains/agent-harnesses/) | Deep behavioral extraction of execution harnesses (Claude Code, Codex, Antigravity, Gemini CLI) — boundary enforcement, token vulnerabilities, UI/PTY mechanics; incl. 2026-06-15 Agent SDK credit billing split + Claude Code Dynamic Workflows (2026-05-28: script-orchestrated subagent swarms, `agent()`/`pipeline()`/`parallel()` API, ultracode, 16/1000 caps, budget ceilings, pattern catalog, Bun + 484-agent case studies). | 2026-06-07 | [CAPABILITIES.md](domains/agent-harnesses/CAPABILITIES.md) |
| [opencode-go](domains/opencode-go/) | Subscription CLI ($10/mo) for 14 open-source models with tiered routing. oh-my-openagent plugin provides 11 built-in agents with model-specific assignments + fallback chains. Dollar-based limits ($12/5hr, $30/wk, $60/mo). | 2026-05-04 | [CAPABILITIES.md](domains/opencode-go/CAPABILITIES.md) |
| [resend](domains/resend/) | Official Node SDK extraction, React email support, batch processing, idempotent sending, and MCP/Agent integrations. | 2026-04-22 | [CAPABILITIES.md](domains/resend/CAPABILITIES.md) |
| [gcp-mcp](domains/gcp-mcp/) | Google Cloud official MCP integrations including gcloud-mcp CLI proxy, dynamic auth, safety sandboxing, and Cloud API Registry for Enterprise server discovery. | 2026-04-22 | [CAPABILITIES.md](domains/gcp-mcp/CAPABILITIES.md) |
| [gemini-cli-hooks](domains/gemini-cli-hooks/) | Gemini CLI Hooks framework: sync lifecycle events, strict stdout JSON, exit codes, and settings.json configs. | 2026-04-23 | [CAPABILITIES.md](domains/gemini-cli-hooks/CAPABILITIES.md) |
| [deno-deploy](domains/deno-deploy/) | Deno Deploy hosting: Classic→new-platform migration (Classic EOL 2026-07-20, console.deno.com, `deno deploy` CLI, org-slug .deno.net URLs), verified pricing/AUP, no SLA/credits, multi-function router capture technique. | 2026-06-12 | [CAPABILITIES.md](domains/deno-deploy/CAPABILITIES.md) |
| [codex-hooks](domains/codex-hooks/) | Codex CLI native hooks (opt-in via `hooks` feature flag): 6 events, JSON stdin/stdout, regex matchers for Bash, apply_patch/Edit/Write, and MCP tool events. | 2026-05-10 | [CAPABILITIES.md](domains/codex-hooks/CAPABILITIES.md) |
| [claude-hooks](domains/claude-hooks/) | Claude Code native hooks: 28 lifecycle events, 5 hook types (command/http/mcp_tool/prompt/agent), `hookSpecificOutput.permissionDecision` format, async + asyncRewake, matcher DSL with `if` filter. | 2026-04-23 | [CAPABILITIES.md](domains/claude-hooks/CAPABILITIES.md) |
| [capacitor](domains/capacitor/) | Capacitor mobile development ecosystem — 72 skills extracted from Capawesome and Capgo packs. Plugin catalog, React/Vite integration, security (Capsec), deep linking, push notifications, CI/CD, live updates, testing. | 2026-04-29 | [CAPABILITIES.md](domains/capacitor/CAPABILITIES.md) |
| [github-actions](domains/github-actions/) | GitHub Actions CI/CD platform — security hardening (SHA-pinning, GITHUB_TOKEN permissions, OIDC), cost model, workflow syntax, events/triggers, contexts/expressions, runners, reusability, artifacts/caching, advanced features (matrices, containers, concurrency). Layer 2 source-anchored; Layer 3 detail files for all major topics. | 2026-05-01 | [CAPABILITIES.md](domains/github-actions/CAPABILITIES.md) |
| [ai-web-design-service](domains/ai-web-design-service/) | AI-assisted animated web design business model — Claude Code + Motion + Nano Banana Pro stack for building $2k–$10k websites for small businesses. Covers tools, pricing tiers, sales strategy (demo-first, content funnel, retainers), and competitive positioning. 16 claims validated against market data. | 2026-05-04 | [CAPABILITIES.md](domains/ai-web-design-service/CAPABILITIES.md) |
| [ai-web-automation](domains/ai-web-automation/) | TinyFish AI — serverless web automation platform. Four APIs: Web Agent, Web Search, Web Fetch, Web Browser. $47M Series A (ICONIQ). Clients: Google, DoorDash, Cigna, VW. Free Search/Fetch; ~$0.015/step for Agent/Browser. 90% Mind2Web benchmark. | 2026-05-05 | [CAPABILITIES.md](domains/ai-web-automation/CAPABILITIES.md) |
| [claude-smb](claude-smb/) | Claude for Small Business announcements, features, pricing and integrations. | 2026-05-14 | [CAPABILITIES.md](claude-smb/CAPABILITIES.md) |

## Competitors

| Competitor | Space | Analyzed | Layer 2 |
|---|---|---|---|
| [containers/kubernetes-mcp-server](competitors/containers-k8s-mcp-server/) | K8s MCP (Red Hat, Go native, CRUD, no Terraform, write-on by default) | 2026-04-12 | [CAPABILITIES.md](competitors/containers-k8s-mcp-server/CAPABILITIES.md) |
| [hashicorp/terraform-mcp-server](competitors/hashicorp-terraform-mcp/) | Terraform Registry + HCP MCP (NOT local state, HCP required) | 2026-04-12 | [CAPABILITIES.md](competitors/hashicorp-terraform-mcp/CAPABILITIES.md) |
| [K8sGPT](competitors/k8sgpt/) | AI K8s diagnostics CLI + MCP mode (CNCF Sandbox, 45K stars, deep SRE intelligence) | 2026-04-12 | [CAPABILITIES.md](competitors/k8sgpt/CAPABILITIES.md) |
| [landscape-matrix](competitors/landscape-matrix.md) | Synthesized comparison of leading AI agents (Kimi, Claude Code, Cursor, DeepSeek) in 2026 | 2026-04-21 | [landscape-matrix.md](competitors/landscape-matrix.md) |
| [anatomy-of-a-pro-max-agent](competitors/anatomy-of-a-pro-max-agent.md) | The 2026 technical blueprint: Layered Memory, Plan-Act-Verify loops, and MCP/ACP protocols | 2026-04-21 | [anatomy-of-a-pro-max-agent.md](competitors/anatomy-of-a-pro-max-agent.md) |
| [kimi-cli](competitors/kimi-cli/) | Moonshot AI's coding CLI agent (v1.37.0) — Souls, Kernels, Flows, Denwa Renji, Swarms | 2026-04-21 | [CAPABILITIES.md](competitors/kimi-cli/CAPABILITIES.md) |
| [kimi-platform](competitors/kimi-platform/) | Broader Kimi ecosystem — K2.6 MoE models, Swarms, and Long-Horizon Plans | 2026-04-21 | [CAPABILITIES.md](competitors/kimi-platform/CAPABILITIES.md) |
| [nous-hermes](competitors/nous-hermes/) | Self-improving agent framework by Nous Research — Trajectories, Skill Learning | 2026-04-21 | [CAPABILITIES.md](competitors/nous-hermes/CAPABILITIES.md) |
| [coreyhaines-martech](competitors/coreyhaines-martech/) | Marketing skills ecosystem (46 skills, 65 CLIs, 38.2k stars) — CRO, copy, SEO, ads (Andromeda playbook), outbound (prospecting/sms), PR, offers, marketing-loops ops layer | 2026-07-13 | [CAPABILITIES.md](competitors/coreyhaines-martech/CAPABILITIES.md) |
| [legalconsult-bg](competitors/legalconsult-bg/) | BG online legal-services platform (адв. Адриян Мурлиев, БУЛСТАТ 180550822) — EOOD reg €125, trademark 450/700 лв, NGO 93 лв; advocate-marketplace model | 2026-05-03 | [CAPABILITIES.md](competitors/legalconsult-bg/CAPABILITIES.md) |
| [b-trust-bg](competitors/b-trust-bg/) | BG Qualified Trust Service Provider (Borica AD) — Personal КЕП cloud 6 лв/yr (€3.07), Professional КЕП cloud 50.40 лв/yr (€25.77); Cloud issuance free, pay-per-use; mobile-app onboarding eliminates smart-card friction | 2026-05-03 | [CAPABILITIES.md](competitors/b-trust-bg/CAPABILITIES.md) |
| [advokatami-bg](competitors/advokatami-bg/) | BG legal-tech marketplace (Stanimir Nenov, founder of pravatami.bg) — €119 EOOD reg, €35 zero-activity decl, broad service catalog (incorp + accounting + GDPR + closure); 30K+ clients, 863 Google reviews 4.9★, 11+yr track record; 2018 SAC disciplinary check resolved by 2024 advertising-ban lift | 2026-05-03 | [CAPABILITIES.md](competitors/advokatami-bg/CAPABILITIES.md) |

### domains/image-manipulation
**Question:** "How does an agent extract / clean / upscale / vectorize a raster image programmatically?"
**Last updated:** 2026-05-04
**Layer 2:** `domains/image-manipulation/CAPABILITIES.md`
**Layer 3:** `domains/image-manipulation/details/capability-gap.md`
**Top tools:** rembg + vtracer (CLI, local, free) · Pixa MCP / VectoSolve MCP (hosted) · SAM skill (region isolation)
- [gstack](gstack/CAPABILITIES.md)

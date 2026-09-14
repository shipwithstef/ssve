# K8sGPT — Capabilities
Analyzed: 2026-04-12
URL: https://github.com/k8sgpt-ai/k8sgpt | https://k8sgpt.ai

## What
AI-powered K8s diagnostics and triage. Primary interface is CLI. Has MCP server mode. CNCF Sandbox project, 45K+ GitHub stars.

## Pricing
Open source CLI (free). K8sGPT.ai cloud offering (pricing not public).

## Strengths
- Deep SRE diagnostic intelligence — codified analyzers for storage, security, RBAC, PodSecurityContexts, ConfigMaps, Jobs
- Multi-LLM: OpenAI, Azure, Gemini, Bedrock, Cohere, local
- CNCF Sandbox — formal governance, vendor-neutral
- MCP server mode (port 8089) for agentic workflows
- Most mature AI+K8s tool (3+ years)

## Weaknesses
- MCP mode is secondary; primary interface is CLI
- No Terraform integration
- No write operations via MCP
- Complex setup for operator/in-cluster mode
- No audit log

## Users
SREs and platform engineers wanting AI-assisted K8s diagnosis. Most DevOps-mature user base.

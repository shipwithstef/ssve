# hashicorp/terraform-mcp-server — Capabilities
Analyzed: 2026-04-12
URL: https://github.com/hashicorp/terraform-mcp-server

## What
Official HashiCorp MCP server. Covers Terraform Registry APIs (provider docs, modules) and HCP Terraform/TFE workspace management. Does NOT query local .tfstate files.

## Pricing
Free/open source. HCP Terraform backend requires paid HCP account.

## Strengths
- Official HashiCorp product
- Registry search (provider docs, modules, Sentinel policies)
- HCP Terraform workspace CRUD
- Both stdio and StreamableHTTP transport
- OTel metrics, stateful/stateless modes
- VS Code + Copilot integration

## Weaknesses
- Does not query local Terraform state — useless for local/open-source Terraform
- HCP account required for workspace features
- No K8s integration
- No audit log for state access

## Users
Teams using HCP Terraform or TFE. NOT useful for local Terraform state workflows.

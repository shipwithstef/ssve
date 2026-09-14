# containers/kubernetes-mcp-server — Capabilities
Analyzed: 2026-04-12
URL: https://github.com/containers/kubernetes-mcp-server

## What
Go-native MCP server for K8s/OpenShift. Directly calls K8s API (no kubectl wrapper). Red Hat/Containers org.

## Pricing
Free, open source. No monetization.

## Strengths
- Native Go binary, no external deps
- Full CRUD on K8s resources (not read-only by default)
- Multi-cluster via kubeconfig contexts
- Helm support
- OTel observability (v2.0.0)
- OpenShift support

## Weaknesses
- Write access on by default (must opt into read-only SA)
- No Terraform integration
- No audit log
- Cloud provider clusters require pre-configured kubeconfig
- Security is a config recommendation, not the product

## Users
DevOps engineers, OpenShift users, teams wanting Go-native K8s AI tooling

# Infra Runbook Template

Source: `proposals/done/2026-04-30-infra-project-support.md` § 5 phase 4

Replaces UI design for infra lanes. Output IS the on-call runbook the team will paste into PagerDuty / docs.

## Service Identity

**Name:** ...
**Owner:** ...
**Criticality tier:** tier-1 / tier-2 / tier-3
**On-call rotation:** Link / team

## SLOs

| SLO | Target | Measurement source |
|---|---|---|
| Availability | 99.9% | Datadog uptime check |
| p95 latency | <250ms | APM histogram |

## Alerts

| Alert | Trigger | Runbook step | Severity |
|---|---|---|---|
| ServiceDown | uptime < 99% over 5min | "Service down" procedure below | SEV-1 |
| LatencyHigh | p95 > 500ms over 10min | "Latency spike" procedure | SEV-2 |

## Dashboards

Link to Grafana / Datadog / CloudWatch dashboard.

## Manual Procedures

### Service down
1. Check `aws elbv2 describe-target-health ...`
2. Check ASG health via console
3. If ASG healthy but targets unhealthy → check app logs
4. If still down after 10min → escalate to engineer-on-call

### Rollback
1. `terraform plan -target=<resource>` against last-known-good ref
2. Verify plan shows expected reverts only
3. `terraform apply` with human approval
4. Run smoke probe

## Escalation Path

Page → engineer-on-call → team lead → director-on-call.

# Chaos Test Template

Source: `proposals/done/2026-04-30-infra-project-support.md` § 5 phase 16

Replaces user-journey BDD for infra lanes. Uses Gherkin given/when/then with failure-injection vocabulary. Tools (auto-detected per `stack-profile.md`): `aws fis`, `chaos-mesh`, `litmus`, simple `kubectl delete pod`. Falls back to "MANUAL chaos drill checklist" if no tooling detected.

```gherkin
Feature: <service> resilience under <failure mode>
  As an SRE
  I want <service> to maintain its SLO under <failure>
  So that the on-call doesn't get paged

  Background:
    Given <service> is deployed across 3 AZs
    And current p95 latency is below 250ms
    And no active incidents

  Scenario: AZ-1 failure
    When AZ-1 is partitioned from the rest of the cluster
    Then traffic shifts to AZ-2 and AZ-3 within 60 seconds
    And p95 latency stays below 500ms during failover
    And no requests are lost
    And no manual intervention is required

  Scenario: Database primary failure
    When the Postgres primary is killed
    Then a read replica is promoted within 30 seconds
    And the SLO is restored within 60 seconds
    And the runbook's "DB primary failover" procedure is NOT triggered manually

  Scenario: IAM credential revocation
    When the cross-account role used by <service> is revoked
    Then <service> degrades gracefully (no panic, clear error logs)
    And the on-call alert fires within 2 minutes
    And the runbook's "IAM credential rotation" procedure is sufficient to recover
```

## Manual Fallback Checklist (when no chaos tooling available)

If `stack-profile.md` doesn't declare a chaos tool:

- [ ] Schedule manual game-day in shared calendar
- [ ] Document each scenario as a manual step (e.g., "manually stop one ASG instance")
- [ ] Run during low-traffic window with team observing
- [ ] Capture results in `docs/specs/journeys/chaos/<name>.results.md`

The skill never blocks on missing tooling — it emits this checklist instead.

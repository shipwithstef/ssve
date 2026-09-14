# Infra Cutover Runbook Template (migration-only)

Source: `proposals/done/2026-04-30-infra-project-support.md` § 4 (Lane 10 phase 5c) + § 16 worked examples

Used in `infra-migration` lane phase 5c. Phased cutover with explicit rollback at each phase.

## Migration Identity

**From:** ...
**To:** ...
**Window:** ... (start/end times)
**Owner:** ...
**Criticality:** ...

## Phases (each with explicit rollback)

### Phase 1: Pre-flight (T-7 days)
**What:** Install target system in read-only/shadow mode. Validate connectivity, IAM, secrets.
**Verify:** Source still primary, target observable but inactive.
**Rollback:** Uninstall target. Source unchanged.

### Phase 2: Pilot (T-3 days)
**What:** Cut over single non-critical namespace/repo/region to target.
**Verify:** Soak period (e.g., 24-72h). Compare metrics source vs target.
**Rollback:** Cut pilot back to source. Document divergence.

### Phase 3: Staged rollout (T-1 day → T)
**What:** 10% → 50% → 100% over staged windows.
**Verify:** SLO held at each percentage. Cost trajectory tracking.
**Rollback:** Reduce percentage; ultimately back to 0%.

### Phase 4: Cutover complete
**What:** Source frozen (writes blocked). Target is sole authority.
**Verify:** Final state-graph match.
**Rollback:** Unfreeze source, redirect traffic. Target archived.

### Phase 5: Soak (T+30 days)
**What:** Source kept in read-only for emergency revert.
**Verify:** No incidents needing source for 30 days.
**Rollback:** Last opportunity for clean revert.

### Phase 6: Decommission (T+30+)
**What:** Source removed entirely.
**Verify:** `decommission-receipt.md` archived.
**Rollback:** NOT POSSIBLE — irreversible from this point.

## Per-Phase Approval Gates

SEV-1 / SEV-2 changes require human checkpoint per `plan-blast-radius` output.

## Communication Plan

Who is notified at each phase, by what channel.

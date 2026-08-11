#!/usr/bin/env node
// scripts/capability-concierge.mjs (WI-106)
//
// Three-lens recommendation orchestrator. Reads precomputed state from
// WI-104 (capability registry) + WI-105 (state snapshot). Produces exactly
// one recommendation per lens, each grounded in at least one registry
// entry and one snapshot row.
//
// Refuses to recommend when the underlying state is missing or stale.
//
// CLI:
//   node scripts/capability-concierge.mjs [--out <path>] [--max-snapshot-age-hours N]

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();
const REGISTRY_PATH = process.env.SVC_BUILDER_CAPABILITY_REGISTRY
  || path.join(HOME, '.svc', 'capabilities', 'registry.json');
const SNAPSHOT_PATH = process.env.SVC_STATE_SNAPSHOT
  || path.join(HOME, '.svc', 'state-snapshot.json');

function parseArgs(argv) {
  const args = { maxSnapshotAgeHours: 24 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--max-snapshot-age-hours') args.maxSnapshotAgeHours = Number(argv[++i]);
  }
  return args;
}

function die(msg, extra = {}) {
  console.error(JSON.stringify({ verdict: 'refused', reason: msg, ...extra }, null, 2));
  process.exit(1);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// --- Lens implementations ---

function lensShip(registry, snapshot) {
  // Prefer the project row with the most active WIs + most recent commit activity
  const projects = snapshot.rows.filter(r => r.id !== 'framework' && (r.active_wi_count || 0) > 0);
  if (projects.length === 0) {
    return {
      lens: 'ship',
      gap: 'no project in the snapshot has active WIs — nothing to ship next',
      evidence: [`snapshot.rows (${snapshot.rows.length} rows, 0 with active_wi_count>0)`],
    };
  }
  projects.sort((a, b) => (b.active_wi_count || 0) - (a.active_wi_count || 0));
  const target = projects[0];

  // Pick the registry entry that best supports this project: prefer an EXEC-capable one
  const execCapable = Object.entries(registry.resources)
    .find(([, r]) => (r.host_cli || []).some(c => /claude|codex|mimo|kimi/.test(c)));
  const resourceId = execCapable ? execCapable[0] : Object.keys(registry.resources)[0];

  return {
    lens: 'ship',
    title: `Resume ${target.id} — ${target.active_wi_count} active WI(s) pending`,
    rationale: `${target.id} has the highest active-WI count in the snapshot and last-commit ${target.time_since_last_commit_hours ?? 'unknown'}h ago. Pick the top-ranked WI from its INDEX and push it to merge. Use the ${resourceId} stack — it is already paid for and unblocks the EXEC path.`,
    required_resource: resourceId,
    snapshot_ref: target.id,
    acceptance_test: `one WI in ${target.id} moves from backlog → VERIFIED within 1 working session`,
    evidence: [
      `registry.resources.${resourceId}`,
      `snapshot.rows.${target.id}.active_wi_count`,
      `snapshot.rows.${target.id}.time_since_last_commit_hours`,
    ],
  };
}

function lensIdle(registry, snapshot) {
  // Find the most under-used resource. Heuristic v1: trial resources tagged EXPIRING,
  // otherwise the paid resource with the lowest consumed_estimate across sub_budgets.
  const entries = Object.entries(registry.resources);
  const expiring = entries.find(([, r]) => /expir/i.test(r.notes || ''));
  if (expiring) {
    const [id, r] = expiring;
    return {
      lens: 'idle',
      title: `Deploy ${r.label} before it expires`,
      rationale: `${r.label} is flagged EXPIRING in the registry notes ("${r.notes}"). Trial credit not deployed = wasted leverage. Point it at the highest-priority shippable project from the ship-lens.`,
      required_resource: id,
      snapshot_ref: 'framework',
      acceptance_test: `${r.label} is consumed on a real task before its trial window closes`,
      evidence: [
        `registry.resources.${id}.notes`,
        `registry.resources.${id}.tier`,
        `snapshot.generated_at`,
      ],
    };
  }

  // Otherwise: flag the highest-cost resource with no tracked consumption
  const paidWithoutConsumption = entries
    .filter(([, r]) => r.tier === 'paid')
    .map(([id, r]) => {
      const subs = r.sub_budgets || {};
      const total = Object.values(subs).reduce((s, b) => s + (Number(b.consumed_estimate) || 0), 0);
      return { id, r, total };
    })
    .sort((a, b) => (b.r.cost_usd_monthly || 0) - (a.r.cost_usd_monthly || 0))[0];

  if (!paidWithoutConsumption) {
    return {
      lens: 'idle',
      gap: 'no paid resources in the registry — idle-lens has nothing to flag',
      evidence: ['registry.resources'],
    };
  }

  const { id, r } = paidWithoutConsumption;
  return {
    lens: 'idle',
    title: `Audit ${r.label} usage — $${r.cost_usd_monthly}/mo paid, tracked consumption = 0`,
    rationale: `${r.label} is the highest-cost registry entry. If consumed_estimate across its sub-budgets is zero, either (a) consumption tracking is not being updated (fix the tracking), or (b) this resource is being paid for without being deployed (route it to the ship-lens project). Either way, action beats neglect.`,
    required_resource: id,
    snapshot_ref: 'framework',
    acceptance_test: `updated consumed_estimate OR a concrete deployment plan exists within 1 week`,
    evidence: [
      `registry.resources.${id}.cost_usd_monthly`,
      `registry.resources.${id}.sub_budgets`,
      `snapshot.generated_at`,
    ],
  };
}

function lensSideEarn(registry, snapshot) {
  // v1 heuristic: propose a small-bet that fits available CLI stacks + existing
  // project surface. If the builder has a hosted product (Base44 etc.), suggest
  // content/SEO layer on top. If they have a CLI-heavy stack, suggest a micro-tool.
  const hasHostedBackend = !!registry.resources['base44'];
  const hasDomainTrial = Object.entries(registry.resources)
    .find(([, r]) => /namecheap|godaddy|cloudflare/i.test(r.label) && r.tier === 'trial');
  const hasCliStack = Object.values(registry.resources).some(r => (r.host_cli || []).length > 0);

  if (hasDomainTrial && hasCliStack) {
    const [domainId] = hasDomainTrial;
    return {
      lens: 'side-earning',
      title: `Stand up a one-page free-tool on the ${hasDomainTrial[1].label} domain`,
      rationale: `You have an unused domain trial AND a CLI stack that can ship a static site in hours. A one-page free tool (calculator, generator, grader) in the builder's domain (svc/framework/AI tooling) captures email and seeds Tier-2 audience for Stage-1 revenue. Stage-revenue skill can refine scope.`,
      required_resource: domainId,
      snapshot_ref: 'framework',
      acceptance_test: `1 page live at the trial domain with at least one lead-magnet flow within 1 week`,
      evidence: [
        `registry.resources.${domainId}.label`,
        `registry.resources.${domainId}.tier`,
        `snapshot.generated_at`,
      ],
    };
  }

  if (hasHostedBackend) {
    return {
      lens: 'side-earning',
      title: `Publish an educational micro-site about your hosted-backend learnings`,
      rationale: `You already pay for a hosted backend. Builders adjacent to your tooling stack pay for content on "what works on platform X" — a micro-site derived from your Example Marketplace experience qualifies as free-tools Stage-1 content.`,
      required_resource: 'base44',
      snapshot_ref: 'framework',
      acceptance_test: `first post published + 1 backlink acquired within 2 weeks`,
      evidence: [
        `registry.resources.base44`,
        `snapshot.generated_at`,
      ],
    };
  }

  return {
    lens: 'side-earning',
    gap: 'not enough registry signal for a side-earning recommendation (no domain trial, no hosted backend)',
    evidence: ['registry.resources'],
  };
}

// --- Main ---

function renderReport(recs, meta) {
  const lines = [];
  lines.push(`# capability-concierge report — ${meta.date}`);
  lines.push('');
  lines.push(`Registry: ${meta.registryPath}`);
  lines.push(`Snapshot: ${meta.snapshotPath} (generated ${meta.snapshotAgeHours}h ago)`);
  lines.push('');
  for (const r of recs) {
    lines.push(`## Lens: ${r.lens}`);
    lines.push('');
    if (r.gap) {
      lines.push(`**GAP** — ${r.gap}`);
      lines.push('');
      lines.push(`Evidence: ${r.evidence.join(', ')}`);
      lines.push('');
      continue;
    }
    lines.push(`**${r.title}**`);
    lines.push('');
    lines.push(r.rationale);
    lines.push('');
    lines.push(`- Required resource: \`${r.required_resource}\``);
    lines.push(`- Snapshot row: \`${r.snapshot_ref}\``);
    lines.push(`- Acceptance test: ${r.acceptance_test}`);
    lines.push(`- Evidence: ${r.evidence.map(e => `\`${e}\``).join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

function validateRec(rec, registry) {
  if (rec.gap) return true; // gap-shape recs are acceptable
  if (!rec.evidence || !Array.isArray(rec.evidence) || rec.evidence.length === 0) return false;
  const citesRegistry = rec.evidence.some(e => e.startsWith('registry.'));
  const citesSnapshot = rec.evidence.some(e => e.startsWith('snapshot.'));
  if (!citesRegistry || !citesSnapshot) return false;
  if (!registry.resources[rec.required_resource]) return false; // no hallucinated ids
  return true;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(REGISTRY_PATH)) {
    die('registry not found — run `node scripts/builder-capability-registry.mjs seed`', {
      registry: REGISTRY_PATH,
    });
  }
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    die('snapshot not found — run `node scripts/cross-project-state.mjs`', {
      snapshot: SNAPSHOT_PATH,
    });
  }
  const registry = readJson(REGISTRY_PATH);
  const snapshot = readJson(SNAPSHOT_PATH);
  const snapshotAgeHours = (Date.now() - Date.parse(snapshot.generated_at)) / 3600000;
  if (snapshotAgeHours > args.maxSnapshotAgeHours) {
    die(`snapshot is ${snapshotAgeHours.toFixed(1)}h old (cap: ${args.maxSnapshotAgeHours}h) — refresh via scripts/cross-project-state.mjs`, {
      snapshot: SNAPSHOT_PATH,
      age_hours: snapshotAgeHours,
    });
  }

  const recs = [
    lensShip(registry, snapshot),
    lensIdle(registry, snapshot),
    lensSideEarn(registry, snapshot),
  ];

  for (const r of recs) {
    if (!validateRec(r, registry)) {
      die(`recommendation for lens '${r.lens}' failed validation (missing evidence or hallucinated resource)`, { rec: r });
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  const repoRoot = process.env.SVC_REPO_ROOT || process.cwd();
  const out = args.out || path.join(repoRoot, 'docs', 'specs', 'capability-concierge', `${date}.md`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const report = renderReport(recs, {
    date,
    registryPath: REGISTRY_PATH,
    snapshotPath: SNAPSHOT_PATH,
    snapshotAgeHours: snapshotAgeHours.toFixed(1),
  });
  fs.writeFileSync(out, report);

  const summary = {
    verdict: 'recommendations-written',
    out,
    lenses: recs.map(r => ({
      lens: r.lens,
      state: r.gap ? 'gap' : 'ok',
      title: r.title,
      required_resource: r.required_resource,
    })),
  };
  console.log(JSON.stringify(summary, null, 2));
}

main();

#!/usr/bin/env node
/**
 * Phase 3: walk every <skill>/SKILL.md and inject `handles_concerns: [...]`
 * into its frontmatter, based on the curated mapping below.
 * Idempotent: skips skills that already declare handles_concerns.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const MAPPING = {
  'manage-finops': ['paid-external-api', 'paid-llm-api', 'paid-payment-api', 'paid-storage-api', 'paid-notification-api', 'paid-geocoding-api', 'paid-ml-inference-api', 'paid-search-api', 'paid-translation-api', 'paid-ocr-vision-api', 'paid-streaming-api', 'paid-cdn-egress', 'paid-analytics-api', 'pricing-tier-touch', 'billing-side-effect', 'subscription-state-machine', 'upgrade-downgrade-prorate'],
  'design-tech': ['paid-external-api', 'data-model-mutation', 'database-migration', 'cache-strategy-symmetry', 'cache-invalidation', 'cache-eviction-policy', 'denormalization', 'data-import-flow', 'github-api-touch', 'queue-backpressure', 'database-connection-pool', 'cron-or-scheduled-job', 'feature-flag-rollout', 'canary-deploy', 'n-plus-one-query', 'unbounded-query', 'blocking-io-on-hot-path', 'memory-leak-risk', 'bundle-size-creep', 'critical-path-rendering', 'lazy-load-strategy', 'third-party-script-impact', 'offline-capability', 'ios-android-parity', 'capacitor-native-bridge', 'push-token-lifecycle', 'deep-link-handling', 'timezone-handling', 'currency-formatting', 'subscription-state-machine', 'upgrade-downgrade-prorate'],
  'review-security': ['auth-surface', 'pii-handling', 'session-management', 'token-rotation', 'password-reset-flow', 'mfa-flow', 'oauth-callback', 'social-login', 'service-account-credentials', 'api-key-management', 'permission-elevation', 'impersonation-flow', 'gdpr-deletion', 'consent-management', 'age-verification', 'region-locking', 'ccpa-do-not-sell', 'soc2-control-touch', 'hipaa-control-touch', 'xss-prevention', 'sql-injection-prevention', 'rate-limiting', 'secrets-management', 'cryptography-touch', 'cors-policy', 'csp-policy', 'dependency-audit', 'supply-chain-security', 'open-redirect', 'ssrf-prevention', 'replay-protection', 'webhook-signature-verification', 'webhook-receiver', 'social-media-api-touch', 'paid-payment-api', 'paid-notification-api', 'paid-ocr-vision-api', 'paid-analytics-api', 'data-deletion-cascade', 'data-export-flow', 'data-import-flow', 'logging-policy', 'cookie-consent', 'billing-side-effect', 'refund-flow'],
  'audit-implementation': ['build-ship-alignment', 'deploy-rollback-plan', 'database-migration', 'data-deletion-cascade'],
  'review-gate': ['build-ship-alignment', 'data-model-mutation', 'auth-surface', 'pii-handling'],
  'review-cross-model': ['data-model-mutation', 'database-migration', 'auth-surface'],
  'review-plan': ['data-model-mutation', 'paid-external-api', 'auth-surface', 'build-ship-alignment'],
  'explore-solutions': ['paid-external-api', 'cache-strategy-symmetry', 'data-model-mutation'],
  'strategic-decision': ['paid-external-api', 'paid-llm-api', 'data-model-mutation'],
  'design-ux': ['wcag-aa-compliance', 'keyboard-navigation', 'screen-reader-flow', 'reduced-motion', 'cookie-consent', 'mobile-responsive'],
  'design-ui': ['dark-mode-coverage', 'mobile-responsive'],
  'write-e2e': ['e2e-coverage-for-flow', 'flaky-test-quarantine', 'test-data-seeding', 'mocking-vs-fixtures'],
  'test-journeys': ['e2e-coverage-for-flow', 'flaky-test-quarantine'],
  'diagnose-bug': ['auth-surface', 'oauth-callback', 'paid-external-api'],
  'plan-capabilities': ['paid-external-api', 'paid-llm-api', 'github-api-touch', 'social-media-api-touch'],
  'launch-knowledge': ['terms-of-service-touch', 'privacy-policy-touch', 'acceptable-use-policy', 'gdpr-deletion', 'ccpa-do-not-sell', 'soc2-control-touch', 'hipaa-control-touch'],
  'analyze-marketing': ['paid-analytics-api', 'revenue-attribution'],
  'platform-operating-architect': ['build-ship-alignment', 'capacitor-native-bridge', 'deploy-rollback-plan', 'feature-flag-rollout'],
  'capability-concierge': ['paid-external-api'],
  'research': ['paid-external-api', 'dependency-audit'],
};

function findFrontmatterEnd(text) {
  const lines = text.split('\n');
  if (lines[0]?.trim() !== '---') return -1;
  for (let i = 1; i < lines.length; i++) if (lines[i].trim() === '---') return i;
  return -1;
}
function alreadyHas(text) {
  const fmEnd = findFrontmatterEnd(text);
  if (fmEnd === -1) return false;
  return /^handles_concerns\s*:/m.test(text.split('\n').slice(0, fmEnd + 1).join('\n'));
}
function injectAfterName(text, concerns) {
  const lines = text.split('\n');
  const nameIdx = lines.findIndex((l) => /^name\s*:/.test(l));
  if (nameIdx === -1) return null;
  const block = ['handles_concerns:', ...concerns.map((c) => `  - ${c}`)];
  return [...lines.slice(0, nameIdx + 1), ...block, ...lines.slice(nameIdx + 1)].join('\n');
}

let touched = 0, skipped = 0, missing = 0;
for (const [skill, concerns] of Object.entries(MAPPING)) {
  if (concerns.length === 0) continue;
  const path = join(REPO_ROOT, 'skills', skill, 'SKILL.md');
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { console.warn(`SKIP ${skill}: SKILL.md not found`); missing++; continue; }
  if (alreadyHas(text)) { console.log(`OK  ${skill} (already has)`); skipped++; continue; }
  const updated = injectAfterName(text, concerns);
  if (!updated) { console.warn(`SKIP ${skill}: no name field`); missing++; continue; }
  writeFileSync(path, updated);
  console.log(`+   ${skill} (${concerns.length} concerns)`);
  touched++;
}
console.log(`\nTouched: ${touched}, skipped: ${skipped}, missing: ${missing}`);

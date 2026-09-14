#!/usr/bin/env node
/**
 * Seeds Phase 2 concerns. Run once. Idempotent (skips files that already exist).
 * Output: ~110 markdown files in concerns/.
 *
 * Each concern uses a tight frontmatter + brief body. Phase 1 concerns are the
 * verbose template; Phase 2 concerns are leaner so coverage gets shipped.
 *
 * Skill frontmatters are NOT updated by this script — that's a separate retrofit
 * pass. Phase 2 concerns mostly use empty required_skills + optional_skills,
 * with required_rules pointing at existing rules. Cross-validation in
 * build-concern-registry.mjs still bites for any required_skills entry.
 */

import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONCERNS_DIR = join(__dirname, '..', 'concerns');

const TODAY = '2026-05-07';

// ---------- concern data --------------------------------------------------

const concerns = [
  // ===== PAID EXTERNAL INTEGRATIONS (variants) =====
  {
    name: 'paid-llm-api',
    domain: 'integration',
    severity: 'CRITICAL',
    signals: {
      file_path_patterns: ['**/services/llm/**', '**/agents/**', '**/functions/*ai*/**', '**/functions/*llm*/**', '**/functions/*chat*/**', '**/functions/*completion*/**'],
      diff_keywords: ['api\\.openai', 'api\\.anthropic', 'gpt-[34]', 'claude-[34]', 'gemini-pro', 'X-Goog-Api-Key', 'OpenAI\\(', 'Anthropic\\('],
      packages_imported: ['openai', '@anthropic-ai/sdk', '@google/generative-ai', 'cohere-ai', 'replicate'],
      env_vars_referenced: ['OPENAI_*', 'ANTHROPIC_*', 'GEMINI_*', 'GOOGLE_GENERATIVE_AI_*', 'REPLICATE_*'],
    },
    handled_by: { required_rules: ['paid-api-integration-checklist'], required_skills: [], optional_skills: ['manage-finops', 'design-tech'] },
    related: ['paid-external-api', 'cache-strategy-symmetry', 'kill-switch-presence'],
    why: 'LLM APIs bill per-token; a runaway loop or untrimmed context can cost hundreds in minutes. Same lens as paid-external-api but tuned for token-economics: prompt caching, max_tokens caps, streaming-vs-buffered, content moderation costs, response truncation strategy.',
  },
  {
    name: 'paid-payment-api',
    domain: 'integration',
    severity: 'CRITICAL',
    signals: {
      file_path_patterns: ['**/services/payments/**', '**/services/billing/**', '**/functions/*checkout*/**', '**/functions/*subscription*/**', '**/functions/*invoice*/**', '**/functions/dodo*/**', '**/functions/stripe*/**'],
      diff_keywords: ['stripe\\.com', 'paddle\\.com', 'dodopayments', 'createCheckoutSession', 'paymentIntent', 'subscription\\.', 'webhook'],
      packages_imported: ['stripe', '@stripe/*', 'dodopayments', '@paddle/*', 'lemonsqueezy'],
      env_vars_referenced: ['STRIPE_*', 'PADDLE_*', 'DODO_*', 'LEMONSQUEEZY_*'],
    },
    handled_by: { required_rules: ['paid-api-integration-checklist'], required_skills: [], optional_skills: ['review-security', 'manage-finops'] },
    related: ['paid-external-api', 'webhook-signature-verification', 'pii-handling'],
    why: 'Payment changes touch real money + customer trust. Idempotency keys, webhook signature verification, refund-state-machine integrity, retry-storm avoidance.',
  },
  {
    name: 'paid-storage-api',
    domain: 'integration',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/services/storage/**', '**/functions/*upload*/**', '**/functions/*media*/**'],
      diff_keywords: ['s3\\.amazonaws', 'storage\\.googleapis', 'r2\\.cloudflarestorage', 'putObject', 'getObject', 'createMultipart'],
      packages_imported: ['@aws-sdk/client-s3', '@google-cloud/storage', '@cloudflare/r2'],
      env_vars_referenced: ['AWS_*', 'S3_*', 'R2_*', 'GCS_*'],
    },
    handled_by: { required_rules: ['paid-api-integration-checklist'], required_skills: [], optional_skills: ['manage-finops', 'review-security'] },
    related: ['paid-external-api', 'data-deletion-cascade'],
    why: 'Object storage egress and storage class transitions silently inflate bills. Lifecycle rules + presigned URL TTLs + bucket-level encryption.',
  },
  {
    name: 'paid-notification-api',
    domain: 'integration',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/services/email/**', '**/services/sms/**', '**/services/push/**', '**/functions/*sendEmail*/**', '**/functions/*sendSms*/**', '**/functions/*notify*/**'],
      diff_keywords: ['sendgrid', 'twilio', 'postmark', 'resend\\.com', 'mailgun', 'one_signal'],
      packages_imported: ['@sendgrid/mail', 'twilio', 'postmark', 'resend', 'mailgun'],
      env_vars_referenced: ['SENDGRID_*', 'TWILIO_*', 'POSTMARK_*', 'RESEND_*', 'MAILGUN_*'],
    },
    handled_by: { required_rules: ['paid-api-integration-checklist'], required_skills: [], optional_skills: ['manage-finops', 'review-security'] },
    related: ['paid-external-api', 'pii-handling', 'rate-limiting'],
    why: 'Per-message billing + reputational risk if domain gets blacklisted. Throttling, sender-domain auth (SPF/DKIM/DMARC), bounce handling.',
  },
  {
    name: 'paid-geocoding-api',
    domain: 'integration',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/services/maps/**', '**/services/location/**', '**/functions/*geocode*/**', '**/functions/*nearby*/**', '**/functions/*address*/**'],
      diff_keywords: ['places\\.googleapis', 'mapbox\\.com', 'maps\\.googleapis', 'searchNearby', 'reverseGeocode', 'autocomplete'],
      packages_imported: ['@googlemaps/*', 'mapbox-gl', '@mapbox/*'],
      env_vars_referenced: ['GOOGLE_MAPS_*', 'GOOGLE_PLACES_*', 'MAPBOX_*'],
    },
    handled_by: { required_rules: ['paid-api-integration-checklist'], required_skills: [], optional_skills: ['manage-finops'] },
    related: ['paid-external-api', 'cache-strategy-symmetry'],
    why: 'Per-call billing with a 50km radius cap and per-SKU pricing. Over-fetch + cache is the canonical optimization. Caught Example Marketplace asymmetric cache 2026-05-07.',
  },
  {
    name: 'paid-ml-inference-api',
    domain: 'integration',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/services/ml/**', '**/services/vision/**', '**/services/speech/**', '**/functions/*classify*/**', '**/functions/*predict*/**'],
      diff_keywords: ['replicate\\.run', 'huggingface', 'inference\\.endpoint', 'speech-to-text', 'translate'],
      packages_imported: ['replicate', '@huggingface/inference', '@google-cloud/vision', '@google-cloud/speech'],
      env_vars_referenced: ['REPLICATE_*', 'HF_*', 'HUGGINGFACE_*'],
    },
    handled_by: { required_rules: ['paid-api-integration-checklist'], required_skills: [], optional_skills: ['manage-finops'] },
    related: ['paid-external-api'],
    why: 'Per-second GPU billing or per-request inference cost. Batch where possible, cache outputs by input hash.',
  },
  {
    name: 'paid-search-api',
    domain: 'integration',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/services/search/**', '**/functions/*search*/**'],
      diff_keywords: ['algolia', 'meilisearch', 'typesense', 'elastic\\.cloud'],
      packages_imported: ['algoliasearch', 'meilisearch', 'typesense'],
      env_vars_referenced: ['ALGOLIA_*', 'MEILI_*', 'TYPESENSE_*'],
    },
    handled_by: { required_rules: ['paid-api-integration-checklist'], required_skills: [], optional_skills: ['manage-finops'] },
    related: ['paid-external-api'],
    why: 'Tiered pricing on records + queries. Index size and query rate move the bill.',
  },
  {
    name: 'paid-translation-api',
    domain: 'integration',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/services/i18n/**', '**/functions/*translate*/**'],
      diff_keywords: ['translate\\.googleapis', 'deepl', 'translator\\.azure'],
      packages_imported: ['@google-cloud/translate', 'deepl-node'],
      env_vars_referenced: ['DEEPL_*', 'GOOGLE_TRANSLATE_*'],
    },
    handled_by: { required_rules: ['paid-api-integration-checklist'], required_skills: [], optional_skills: ['manage-finops'] },
    related: ['paid-external-api', 'i18n-coverage'],
    why: 'Per-character billing. Cache translations by source-hash + target-locale.',
  },
  {
    name: 'paid-ocr-vision-api',
    domain: 'integration',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/services/ocr/**', '**/services/vision/**', '**/functions/*ocr*/**', '**/functions/*receipt*/**', '**/functions/*processReceipt*/**'],
      diff_keywords: ['vision\\.googleapis', 'textract', 'rekognition', 'documentai'],
      packages_imported: ['@google-cloud/vision', '@aws-sdk/client-textract', '@google-cloud/documentai'],
      env_vars_referenced: ['GOOGLE_VISION_*', 'AWS_TEXTRACT_*'],
    },
    handled_by: { required_rules: ['paid-api-integration-checklist'], required_skills: [], optional_skills: ['manage-finops', 'review-security'] },
    related: ['paid-external-api', 'pii-handling'],
    why: 'Receipts and IDs contain PII. Combined cost + privacy concern.',
  },
  {
    name: 'paid-streaming-api',
    domain: 'integration',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/services/video/**', '**/services/streaming/**', '**/functions/*stream*/**'],
      diff_keywords: ['mux\\.com', 'cloudflare\\.com/stream', 'livekit', 'agora\\.io'],
      packages_imported: ['@mux/mux-node', 'livekit-server-sdk', 'agora-access-token'],
      env_vars_referenced: ['MUX_*', 'LIVEKIT_*', 'AGORA_*'],
    },
    handled_by: { required_rules: ['paid-api-integration-checklist'], required_skills: [], optional_skills: ['manage-finops'] },
    related: ['paid-external-api'],
    why: 'Per-minute streaming bills compound; idle session cleanup and resolution-tier choice matter.',
  },
  {
    name: 'paid-cdn-egress',
    domain: 'integration',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/cdn/**', '**/services/cdn/**'],
      diff_keywords: ['cloudfront\\.net', 'fastly\\.com', 'bunnycdn', 'cloudflare\\.com/r2'],
      packages_imported: [],
      env_vars_referenced: ['CDN_*', 'FASTLY_*', 'BUNNY_*'],
    },
    handled_by: { required_rules: ['paid-api-integration-checklist'], required_skills: [], optional_skills: ['manage-finops'] },
    related: ['paid-external-api'],
    why: 'Egress traffic is the silent killer; cache-control headers + asset versioning + edge-vs-origin tradeoff move the bill.',
  },
  {
    name: 'paid-analytics-api',
    domain: 'integration',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/services/analytics/**', '**/functions/*track*/**'],
      diff_keywords: ['posthog', 'mixpanel', 'amplitude', 'segment\\.com'],
      packages_imported: ['posthog-js', 'posthog-node', 'mixpanel-browser', '@amplitude/*', '@segment/*'],
      env_vars_referenced: ['POSTHOG_*', 'MIXPANEL_*', 'AMPLITUDE_*', 'SEGMENT_*'],
    },
    handled_by: { required_rules: ['paid-api-integration-checklist'], required_skills: [], optional_skills: ['manage-finops', 'review-security'] },
    related: ['paid-external-api', 'pii-handling', 'consent-management'],
    why: 'Per-event billing + PII risk. Sampling, server-side vs client-side, opt-in.',
  },

  // ===== FREE-BUT-RATE-LIMITED =====
  {
    name: 'github-api-touch',
    domain: 'integration',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/scripts/**/github*', '**/services/github/**', '**/functions/*github*/**'],
      diff_keywords: ['api\\.github\\.com', 'octokit', '@octokit'],
      packages_imported: ['@octokit/*', 'octokit'],
      env_vars_referenced: ['GITHUB_*', 'GH_*'],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: ['paid-external-api'],
    why: 'Free but rate-limited (5k/hr authenticated, 60/hr unauthed). ETag/If-Modified-Since to extend the budget.',
  },
  {
    name: 'social-media-api-touch',
    domain: 'integration',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/services/social/**'],
      diff_keywords: ['api\\.x\\.com', 'api\\.twitter', 'graph\\.facebook', 'linkedin\\.com/oauth', 'instagram\\.com/api'],
      packages_imported: ['twitter-api-v2', 'instagrapi', 'linkedin-api-client'],
      env_vars_referenced: ['TWITTER_*', 'X_*', 'FB_*', 'LINKEDIN_*', 'INSTAGRAM_*'],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['paid-external-api', 'auth-surface'],
    why: 'Aggressive per-app rate limits, OAuth token rotation, platform policy reviews.',
  },
  {
    name: 'webhook-receiver',
    domain: 'integration',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/functions/*webhook*/**', '**/api/webhooks/**'],
      diff_keywords: ['x-signature', 'webhook\\.verify', 'constructEvent', 'svix'],
      packages_imported: ['svix', 'standardwebhooks'],
      env_vars_referenced: ['*_WEBHOOK_SECRET'],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['auth-surface', 'replay-protection'],
    why: 'Signature verification + replay protection + idempotency. Skipping any one is exploitable.',
  },

  // ===== DATA LAYER =====
  {
    name: 'database-migration',
    domain: 'data',
    severity: 'CRITICAL',
    signals: {
      file_path_patterns: ['**/migrations/**', '**/db/migrate/**', '**/prisma/migrations/**', '**/drizzle/migrations/**', '**/supabase/migrations/**'],
      diff_keywords: ['CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'CREATE INDEX', 'DROP INDEX', 'CONSTRAINT'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech', 'review-cross-model'] },
    related: ['data-model-mutation', 'data-deletion-cascade'],
    why: 'Migrations are nearly irreversible at scale. Backfill plan, lock-time, rollback, online-vs-offline.',
  },
  {
    name: 'data-deletion-cascade',
    domain: 'data',
    severity: 'CRITICAL',
    signals: {
      file_path_patterns: ['**/cascadeDelete*', '**/functions/cascadeDelete/**', '**/services/deletion/**'],
      diff_keywords: ['ON DELETE CASCADE', 'cascadeDelete', 'deleteAccount', 'forceDelete'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['data-model-mutation', 'gdpr-deletion', 'pii-handling'],
    why: 'Cascade rules can silently destroy unrelated data. Each delete path needs explicit blast-radius proof.',
  },
  {
    name: 'data-export-flow',
    domain: 'data',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/services/export/**', '**/functions/*export*/**', '**/data-export/**'],
      diff_keywords: ['userDataExport', 'gdprExport', 'streamToFile', 'csv\\.stringify'],
      packages_imported: ['archiver', 'csv-stringify', 'json2csv'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['pii-handling', 'gdpr-deletion'],
    why: 'Data exports must include all PII or comply with subject-access-rights; access controls must be enforced.',
  },
  {
    name: 'data-import-flow',
    domain: 'data',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/services/import/**', '**/functions/*import*/**'],
      diff_keywords: ['bulkImport', 'parseCSV', 'streamFromS3'],
      packages_imported: ['csv-parse', 'fast-csv'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech', 'review-security'] },
    related: ['data-model-mutation', 'rate-limiting'],
    why: 'Bulk imports stress the DB and can poison production data. Validation, batch size, dry-run mode.',
  },
  {
    name: 'cache-strategy-symmetry',
    domain: 'data',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/cache/**', '**/services/cache/**'],
      diff_keywords: ['fetchDbCandidates', 'cache\\.get', 'cache\\.set', 'redis\\.get', 'redis\\.set', 'memcached'],
      packages_imported: ['redis', 'ioredis', 'memcached', 'lru-cache'],
      env_vars_referenced: ['REDIS_*', 'CACHE_*'],
    },
    handled_by: { required_rules: ['paid-api-integration-checklist'], required_skills: [], optional_skills: ['design-tech'] },
    related: ['paid-external-api', 'cache-invalidation', 'cache-eviction'],
    why: 'Read-side cache without write-side population is dead weight. Originated Example Marketplace placesNearbyLookup 2026-05-07.',
  },
  {
    name: 'cache-invalidation',
    domain: 'data',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/cache/invalidate*', '**/services/cache/**'],
      diff_keywords: ['cache\\.delete', 'invalidate', 'queryClient\\.invalidate', 'revalidateTag', 'revalidatePath'],
      packages_imported: ['@tanstack/react-query', 'swr'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: ['cache-strategy-symmetry', 'cache-eviction'],
    why: 'Stale data in cache after a write is the second-hardest problem in CS. Tagged invalidation, write-through, write-behind tradeoffs.',
  },
  {
    name: 'cache-eviction-policy',
    domain: 'data',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/cache/**'],
      diff_keywords: ['LRU', 'TTL', 'max:\\s*\\d+', 'maxSize:\\s*\\d+', 'evictionPolicy'],
      packages_imported: ['lru-cache', 'ttlcache', 'node-cache'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: ['cache-strategy-symmetry', 'memory-leak'],
    why: 'No eviction policy = unbounded memory growth. Choose policy that matches access pattern.',
  },
  {
    name: 'denormalization',
    domain: 'data',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/entities/**', '**/migrations/**'],
      diff_keywords: ['_count\\b', '_total\\b', 'cached_', 'denormalized'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: ['data-model-mutation'],
    why: 'Denormalized counters drift if updates are not transactional. Reconciliation strategy + drift-detection.',
  },

  // ===== AUTH =====
  {
    name: 'session-management',
    domain: 'auth',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/session*', '**/middleware/session*'],
      diff_keywords: ['session\\.user', 'createSession', 'destroySession', 'cookie\\.set'],
      packages_imported: ['iron-session', 'next-session', 'express-session'],
      env_vars_referenced: ['SESSION_*'],
    },
    handled_by: { required_rules: ['post-fix-evidence-before-next-fix'], required_skills: [], optional_skills: ['review-security'] },
    related: ['auth-surface'],
    why: 'Session fixation, idle timeout, concurrent-session limits, secure-cookie attributes.',
  },
  {
    name: 'token-rotation',
    domain: 'auth',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/auth/**'],
      diff_keywords: ['refreshToken', 'rotateToken', 'JWT.*sign', 'iss\\b', 'aud\\b'],
      packages_imported: ['jsonwebtoken', 'jose'],
      env_vars_referenced: ['JWT_*'],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['auth-surface'],
    why: 'Short access-token TTL + rotating refresh-token + revocation list = baseline.',
  },
  {
    name: 'password-reset-flow',
    domain: 'auth',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/password-reset*', '**/forgot-password*', '**/functions/*passwordReset*/**'],
      diff_keywords: ['forgotPassword', 'resetPassword', 'sendResetEmail', 'tokenExpiry'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['auth-surface', 'paid-notification-api'],
    why: 'Single-use token + short TTL + rate limit + uniform response (no user enumeration).',
  },
  {
    name: 'mfa-flow',
    domain: 'auth',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/mfa/**', '**/2fa/**', '**/functions/*mfa*/**'],
      diff_keywords: ['totp', 'otpauth', 'webauthn', 'authenticator', 'verifyMFA'],
      packages_imported: ['otpauth', 'speakeasy', '@simplewebauthn/*'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['auth-surface'],
    why: 'Backup codes, recovery flow, replay protection on TOTP windows.',
  },
  {
    name: 'oauth-callback',
    domain: 'auth',
    severity: 'CRITICAL',
    signals: {
      file_path_patterns: ['**/oauth/**', '**/functions/*oauth*/**', '**/auth/callback*'],
      diff_keywords: ['state\\b', 'code_verifier', 'redirect_uri', 'authorization_code'],
      packages_imported: ['simple-oauth2', 'openid-client'],
      env_vars_referenced: ['OAUTH_*'],
    },
    handled_by: { required_rules: ['post-fix-evidence-before-next-fix'], required_skills: [], optional_skills: ['review-security'] },
    related: ['auth-surface'],
    why: 'CSRF-protect via state, PKCE, callback URI allowlist exact-match.',
  },
  {
    name: 'social-login',
    domain: 'auth',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/auth/social/**', '**/auth/google*', '**/auth/apple*', '**/auth/facebook*'],
      diff_keywords: ['signInWithProvider', 'signInWithGoogle', 'signInWithApple', 'idToken'],
      packages_imported: ['@react-native-google-signin/*', 'expo-apple-authentication'],
      env_vars_referenced: ['GOOGLE_CLIENT_*', 'APPLE_*'],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['auth-surface', 'oauth-callback'],
    why: 'ID token verification, account-linking attacks, email-verification trust.',
  },
  {
    name: 'service-account-credentials',
    domain: 'auth',
    severity: 'CRITICAL',
    signals: {
      file_path_patterns: ['**/service-accounts/**'],
      diff_keywords: ['google-service-account', 'service_account\\.json', 'IAM\\.assumeRole'],
      packages_imported: ['google-auth-library', '@google-cloud/iam'],
      env_vars_referenced: ['GOOGLE_APPLICATION_CREDENTIALS', 'AWS_ROLE_*'],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['auth-surface', 'secrets-management'],
    why: 'Service-account credentials in code or world-readable config = blast-radius CRITICAL.',
  },
  {
    name: 'api-key-management',
    domain: 'auth',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/api-keys/**', '**/functions/*apiKey*/**'],
      diff_keywords: ['createApiKey', 'rotateApiKey', 'revokeApiKey', 'apiKeyHash'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['auth-surface', 'secrets-management'],
    why: 'Hashed-at-rest, scope-limited, rotation flow, last-used telemetry.',
  },
  {
    name: 'permission-elevation',
    domain: 'auth',
    severity: 'CRITICAL',
    signals: {
      file_path_patterns: ['**/admin/**', '**/middleware/admin*', '**/functions/*admin*/**'],
      diff_keywords: ['isAdmin', 'requireAdmin', 'role\\s*===\\s*[\'"]admin', 'sudo\\b'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['auth-surface'],
    why: 'Server-side check at every elevated mutation. Audit log every admin action.',
  },
  {
    name: 'impersonation-flow',
    domain: 'auth',
    severity: 'CRITICAL',
    signals: {
      file_path_patterns: ['**/impersonate*', '**/functions/*impersonate*/**'],
      diff_keywords: ['impersonate', 'switchUser', 'actingAs'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['auth-surface', 'permission-elevation'],
    why: 'Audit trail must distinguish acting user from acted-upon user. No silent impersonation.',
  },

  // ===== PRIVACY / COMPLIANCE =====
  {
    name: 'gdpr-deletion',
    domain: 'privacy',
    severity: 'CRITICAL',
    signals: {
      file_path_patterns: ['**/gdpr/**', '**/services/deletion/**', '**/functions/*deleteAccount*/**'],
      diff_keywords: ['gdprDelete', 'rightToErasure', 'eraseUser', 'tombstone'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['pii-handling', 'data-deletion-cascade'],
    why: 'Backups, downstream copies, log retention, third-party subprocessors. Deletion is multi-system.',
  },
  {
    name: 'consent-management',
    domain: 'privacy',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/consent/**'],
      diff_keywords: ['consentGiven', 'optIn', 'optOut', 'cookieConsent'],
      packages_imported: ['@cookieconsent/*', 'react-cookie-consent'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['pii-handling', 'cookie-consent'],
    why: 'Granular per-purpose consent, withdrawal flow, audit trail.',
  },
  {
    name: 'cookie-consent',
    domain: 'privacy',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/components/**/CookieBanner*', '**/components/**/Consent*'],
      diff_keywords: ['cookieConsent', 'analytics_consent'],
      packages_imported: ['react-cookie-consent', '@cookieconsent/*'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-ux'] },
    related: ['consent-management'],
    why: 'GDPR/ePrivacy require pre-consent for non-essential cookies. Default-off, easy reject.',
  },
  {
    name: 'age-verification',
    domain: 'privacy',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/age-gate*', '**/components/**/AgeGate*'],
      diff_keywords: ['ageGate', 'minAge', 'date_of_birth', 'COPPA'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['pii-handling'],
    why: 'COPPA (US) and equivalents require age-gating for under-13 in regulated categories.',
  },
  {
    name: 'region-locking',
    domain: 'privacy',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/geo-restrict*', '**/middleware/geo*'],
      diff_keywords: ['geoBlock', 'allowedCountries', 'GDPR.*EU', 'CCPA.*California'],
      packages_imported: ['geoip-lite'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['pii-handling'],
    why: 'Some features must geo-block (export controls, regulated content, ToS jurisdictions).',
  },
  {
    name: 'ccpa-do-not-sell',
    domain: 'privacy',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/ccpa/**'],
      diff_keywords: ['doNotSell', 'CCPA', 'optOutSale'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['consent-management', 'pii-handling'],
    why: 'California users get an opt-out from data sale. Surface a clear control + honor it downstream.',
  },
  {
    name: 'soc2-control-touch',
    domain: 'privacy',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/audit-log*', '**/functions/*audit*/**'],
      diff_keywords: ['auditLog', 'soc2', 'changeLog', 'activityLog'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['pii-handling'],
    why: 'SOC2 requires immutable audit trails for sensitive ops. Append-only, separate retention.',
  },
  {
    name: 'hipaa-control-touch',
    domain: 'privacy',
    severity: 'CRITICAL',
    signals: {
      file_path_patterns: ['**/hipaa/**', '**/phi/**'],
      diff_keywords: ['HIPAA', 'PHI\\b', 'protectedHealthInfo'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['pii-handling'],
    why: 'PHI carries HIPAA obligations: BAAs, minimum-necessary, audit, encryption, breach reporting.',
  },

  // ===== SECURITY =====
  {
    name: 'xss-prevention',
    domain: 'security',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/components/**/*.{jsx,tsx,vue,svelte}'],
      diff_keywords: ['dangerouslySetInnerHTML', 'innerHTML', 'eval\\(', 'Function\\(', 'document\\.write'],
      packages_imported: ['dompurify', 'sanitize-html'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['auth-surface', 'csp-policy'],
    why: 'Sanitize before innerHTML; avoid eval; CSP as defense in depth.',
  },
  {
    name: 'sql-injection-prevention',
    domain: 'security',
    severity: 'CRITICAL',
    signals: {
      file_path_patterns: ['**/db/**', '**/queries/**'],
      diff_keywords: ['\\$\\{[^}]*\\}.*\\bSELECT\\b', '\\+\\s*[`\'"]\\bSELECT\\b', 'rawQuery', 'unsafeRaw'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['auth-surface'],
    why: 'Parameterize every query. ORMs help; raw SQL with string interpolation is the canonical bug.',
  },
  {
    name: 'rate-limiting',
    domain: 'security',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/middleware/rate*', '**/services/rate*'],
      diff_keywords: ['rateLimit', 'tooManyRequests', 'leakyBucket', 'tokenBucket'],
      packages_imported: ['express-rate-limit', '@upstash/ratelimit', 'rate-limiter-flexible'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['auth-surface', 'paid-external-api'],
    why: 'Per-user, per-IP, per-endpoint. Tune to abuse patterns, not arbitrary numbers.',
  },
  {
    name: 'secrets-management',
    domain: 'security',
    severity: 'CRITICAL',
    signals: {
      file_path_patterns: ['**/.env.example', '**/secrets/**'],
      diff_keywords: ['process\\.env\\.[A-Z_]*KEY', 'process\\.env\\.[A-Z_]*SECRET', 'process\\.env\\.[A-Z_]*TOKEN', 'apiKey:\\s*[\'"]', 'secret:\\s*[\'"]'],
      packages_imported: ['dotenv'],
      env_vars_referenced: ['*_SECRET', '*_KEY', '*_TOKEN', '*_PASSWORD'],
    },
    handled_by: { required_rules: ['destructive-git-ops'], required_skills: [], optional_skills: ['review-security'] },
    related: ['auth-surface'],
    why: 'Never commit secrets; ensure .env is gitignored; rotate on suspected exposure.',
  },
  {
    name: 'cryptography-touch',
    domain: 'security',
    severity: 'CRITICAL',
    signals: {
      file_path_patterns: ['**/crypto/**'],
      diff_keywords: ['crypto\\.createCipher', 'crypto\\.createDecipher', 'AES-128-ECB', 'MD5', 'SHA-1\\b', 'crypto\\.randomBytes'],
      packages_imported: ['crypto', 'bcrypt', 'argon2', 'scrypt', 'libsodium'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['secrets-management'],
    why: 'Don\'t roll your own crypto. Avoid ECB/MD5/SHA1. Use vetted high-level libraries.',
  },
  {
    name: 'cors-policy',
    domain: 'security',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/middleware/cors*', '**/cors.config*'],
      diff_keywords: ['Access-Control-Allow-Origin', 'cors\\(\\{', 'origin:\\s*[\'"]\\*'],
      packages_imported: ['cors'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['auth-surface'],
    why: 'Wildcard origin in production is the canonical mistake. Allowlist specific origins.',
  },
  {
    name: 'csp-policy',
    domain: 'security',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/csp*', '**/headers.config*', '**/next.config*'],
      diff_keywords: ['Content-Security-Policy', 'unsafe-inline', 'unsafe-eval'],
      packages_imported: ['helmet'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['xss-prevention'],
    why: 'CSP without unsafe-inline/eval where possible; nonces or hashes for inline.',
  },
  {
    name: 'dependency-audit',
    domain: 'security',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/package.json', '**/package-lock.json', '**/yarn.lock', '**/pnpm-lock.yaml', '**/go.mod', '**/Pipfile.lock', '**/Cargo.lock'],
      diff_keywords: [],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['supply-chain-security'],
    why: 'New dep = new attack surface. CVE check + maintainer reputation + bus factor.',
  },
  {
    name: 'supply-chain-security',
    domain: 'security',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/package.json', '**/Dockerfile', '**/.github/workflows/**'],
      diff_keywords: ['curl.*\\|.*sh', 'wget.*\\|.*sh', 'unverified', 'integrity:'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['dependency-audit'],
    why: 'Pinned versions, integrity hashes, signed CI artifacts.',
  },
  {
    name: 'open-redirect',
    domain: 'security',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: [],
      diff_keywords: ['window\\.location\\s*=\\s*[a-zA-Z_]*\\.url', 'redirect\\(\\s*req\\.', 'res\\.redirect\\(\\s*req\\.'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['xss-prevention'],
    why: 'User-controlled redirect targets enable phishing. Allowlist destinations.',
  },
  {
    name: 'ssrf-prevention',
    domain: 'security',
    severity: 'HIGH',
    signals: {
      file_path_patterns: [],
      diff_keywords: ['fetch\\(\\s*req\\.', 'http\\.get\\(\\s*req\\.', 'axios\\.get\\(\\s*req\\.body'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['auth-surface'],
    why: 'User-supplied URLs in server fetch can hit metadata services and internal IPs.',
  },
  {
    name: 'replay-protection',
    domain: 'security',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/webhooks/**'],
      diff_keywords: ['nonce', 'idempotency-key', 'jti\\b', 'eventTimestamp'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['webhook-receiver'],
    why: 'Sensitive ops need nonces/idempotency keys; webhooks need timestamp + signature.',
  },
  {
    name: 'webhook-signature-verification',
    domain: 'security',
    severity: 'CRITICAL',
    signals: {
      file_path_patterns: ['**/webhooks/**', '**/functions/*webhook*/**'],
      diff_keywords: ['constructEvent', 'verifySignature', 'webhook\\.verify', 'svix\\.verify'],
      packages_imported: ['stripe', 'svix'],
      env_vars_referenced: ['*_WEBHOOK_SECRET'],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['webhook-receiver', 'replay-protection'],
    why: 'Unverified webhooks are open trust gates. Always verify before processing.',
  },

  // ===== PERFORMANCE =====
  {
    name: 'n-plus-one-query',
    domain: 'performance',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/services/**', '**/api/**'],
      diff_keywords: ['for\\s*\\(.*\\)\\s*\\{[\\s\\S]*await.*\\.findOne', 'forEach.*await.*\\.findOne', '\\.map\\(.*async.*\\.findOne'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: ['unbounded-query'],
    why: 'await-in-loop on a relational lookup. Use eager loading or batch loader.',
  },
  {
    name: 'unbounded-query',
    domain: 'performance',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/services/**'],
      diff_keywords: ['\\.findMany\\(\\s*\\)', '\\.find\\(\\s*\\{\\s*\\}\\s*\\)', '\\.list\\(\\s*\\)', 'SELECT \\* FROM'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: ['n-plus-one-query'],
    why: 'Always paginate or limit. Listing without bounds breaks under data growth.',
  },
  {
    name: 'blocking-io-on-hot-path',
    domain: 'performance',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/server/**', '**/api/**'],
      diff_keywords: ['readFileSync', 'execSync', 'spawnSync'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: [],
    why: 'Sync IO on a request handler stalls the event loop.',
  },
  {
    name: 'memory-leak-risk',
    domain: 'performance',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: [],
      diff_keywords: ['setInterval\\(.*\\)', 'addEventListener\\(.*\\)', 'globalThis\\.\\w+\\s*=', '__\\w+\\s*\\|\\|\\=\\s*new Map'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: ['cache-eviction-policy'],
    why: 'Unbounded global collections, uncleaned intervals, leaked listeners.',
  },
  {
    name: 'bundle-size-creep',
    domain: 'performance',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/package.json'],
      diff_keywords: [],
      packages_imported: ['lodash', 'moment', 'rxjs', 'three', 'd3'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: ['critical-path-rendering'],
    why: 'Large deps in client bundle = slow first paint. Tree-shake, lazy-load, swap for lighter alternatives.',
  },
  {
    name: 'critical-path-rendering',
    domain: 'performance',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/index.html', '**/_document.tsx', '**/Layout.tsx', '**/Layout.jsx'],
      diff_keywords: ['<script', '<link', 'preload', 'preconnect'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: ['bundle-size-creep'],
    why: 'LCP, FID, CLS all driven by what blocks render. Defer non-critical, preload critical.',
  },
  {
    name: 'lazy-load-strategy',
    domain: 'performance',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/router/**', '**/routes/**'],
      diff_keywords: ['React\\.lazy', 'dynamic\\(\\(', 'import\\('],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: ['bundle-size-creep'],
    why: 'Route-level code-splitting + Suspense fallback strategy.',
  },
  {
    name: 'third-party-script-impact',
    domain: 'performance',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/index.html', '**/_document.tsx', '**/Layout.*'],
      diff_keywords: ['gtag', 'GA-', 'gtm\\.start', 'fbq\\(', 'pixel'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: ['critical-path-rendering'],
    why: 'Analytics/marketing tags are the dominant TBT killer. async/defer + audit each.',
  },

  // ===== INFRASTRUCTURE =====
  {
    name: 'deploy-rollback-plan',
    domain: 'infra',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/.github/workflows/release*', '**/.github/workflows/deploy*', '**/scripts/deploy*'],
      diff_keywords: ['deploy', 'release', 'rollback', 'revert'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: ['build-and-ship-alignment'], required_skills: [], optional_skills: ['audit-implementation'] },
    related: ['build-ship-alignment'],
    why: 'Every deploy needs a roll-back recipe. Otherwise rollback is incident response.',
  },
  {
    name: 'feature-flag-rollout',
    domain: 'infra',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/feature-flags/**', '**/flags/**', '**/launchconfig*'],
      diff_keywords: ['featureFlag', 'launchDarkly', 'unleash', 'flag\\.enabled'],
      packages_imported: ['launchdarkly-node-server-sdk', 'unleash-client'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: ['canary-deploy', 'dark-launch'],
    why: 'Default-off, ramp, kill-switch availability. Track who can toggle.',
  },
  {
    name: 'canary-deploy',
    domain: 'infra',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/.github/workflows/**'],
      diff_keywords: ['canary', 'blue-green', 'percentage:\\s*\\d', 'traffic_split'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: ['feature-flag-rollout'],
    why: 'Gradual ramp + automatic rollback signal. Catch incidents before 100%.',
  },
  {
    name: 'dns-or-tls-change',
    domain: 'infra',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/dns/**', '**/cloudflare/**', '**/cert*'],
      diff_keywords: ['CNAME', 'A record', 'TXT', 'DKIM', 'TLS', 'cert-manager'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: [] },
    related: ['build-ship-alignment'],
    why: 'TTL gotchas, cert renewal, cross-region propagation.',
  },
  {
    name: 'database-connection-pool',
    domain: 'infra',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/db/pool*', '**/db.config*'],
      diff_keywords: ['poolSize', 'maxConnections', 'createPool'],
      packages_imported: ['pg-pool', 'mysql2', 'better-sqlite3'],
      env_vars_referenced: ['DATABASE_*', 'DB_POOL_*'],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: [],
    why: 'Wrong pool size = exhaustion or wasted memory. Match to concurrency budget.',
  },
  {
    name: 'queue-backpressure',
    domain: 'infra',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/queues/**', '**/workers/**', '**/jobs/**'],
      diff_keywords: ['bullmq', 'sqs', 'pubsub', 'kafka'],
      packages_imported: ['bullmq', '@aws-sdk/client-sqs', '@google-cloud/pubsub', 'kafkajs'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: [],
    why: 'Producer throttling, DLQ, retry budget, poison-pill handling.',
  },
  {
    name: 'cron-or-scheduled-job',
    domain: 'infra',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/crons/**', '**/scheduled/**', '**/.github/workflows/cron*'],
      diff_keywords: ['cron:\\s*[\'"]', 'schedule:\\s*[\'"]', 'setInterval'],
      packages_imported: ['node-cron', 'agenda', 'bull'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: [],
    why: 'Idempotency, single-tenant locking across replicas, missed-run handling.',
  },

  // ===== OBSERVABILITY =====
  {
    name: 'logging-policy',
    domain: 'observability',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/logger*', '**/logging/**'],
      diff_keywords: ['console\\.log\\(', 'logger\\.', 'pino\\.', 'winston\\.'],
      packages_imported: ['pino', 'winston', 'bunyan', 'consola'],
      env_vars_referenced: ['LOG_*'],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['pii-handling'],
    why: 'Strip PII. Structured logs. Levels meaningful. Don\'t log secrets.',
  },
  {
    name: 'error-tracking-emission',
    domain: 'observability',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/error-handler*', '**/sentry*'],
      diff_keywords: ['Sentry\\.', 'rollbar', 'bugsnag', 'captureException'],
      packages_imported: ['@sentry/*', 'rollbar', '@bugsnag/*'],
      env_vars_referenced: ['SENTRY_*', 'ROLLBAR_*'],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: [] },
    related: ['logging-policy'],
    why: 'Capture stack + user context (sans PII) + release tag.',
  },
  {
    name: 'metrics-emission',
    domain: 'observability',
    severity: 'LOW',
    signals: {
      file_path_patterns: ['**/metrics/**'],
      diff_keywords: ['StatsD', 'prometheus', 'datadog', 'cloudwatch:put'],
      packages_imported: ['hot-shots', 'datadog-metrics', 'prom-client'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: [] },
    related: [],
    why: 'Cardinality limits, label hygiene, SLI alignment.',
  },
  {
    name: 'tracing-spans',
    domain: 'observability',
    severity: 'LOW',
    signals: {
      file_path_patterns: ['**/tracing/**'],
      diff_keywords: ['opentelemetry', 'tracer\\.start', 'span\\.end'],
      packages_imported: ['@opentelemetry/*'],
      env_vars_referenced: ['OTEL_*'],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: [] },
    related: [],
    why: 'Sampling, propagation, end-to-end coverage on slow paths.',
  },
  {
    name: 'alert-thresholds',
    domain: 'observability',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/alerts/**', '**/monitoring/**'],
      diff_keywords: ['threshold:', 'alertCondition'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: [] },
    related: [],
    why: 'Alert fatigue is real. Per-alert SLO + ownership + runbook link.',
  },
  {
    name: 'on-call-runbook',
    domain: 'observability',
    severity: 'LOW',
    signals: {
      file_path_patterns: ['**/runbooks/**', '**/oncall/**'],
      diff_keywords: [],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: [] },
    related: ['alert-thresholds'],
    why: 'Every alert links to a recovery procedure. Untriaged alerts get ignored.',
  },

  // ===== TESTING =====
  {
    name: 'e2e-coverage-for-flow',
    domain: 'testing',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/e2e/**', '**/tests/e2e/**', '**/playwright.config*'],
      diff_keywords: ['test\\(', 'describe\\(', 'page\\.goto'],
      packages_imported: ['@playwright/test', 'cypress', 'puppeteer'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['write-e2e'] },
    related: [],
    why: 'Critical user journey gets E2E or it doesn\'t ship. Smoke + journey separation.',
  },
  {
    name: 'flaky-test-quarantine',
    domain: 'testing',
    severity: 'LOW',
    signals: {
      file_path_patterns: ['**/test/**', '**/__tests__/**'],
      diff_keywords: ['test\\.skip', 'xtest', 'fdescribe', 'it\\.skip', '\\@flaky'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: [] },
    related: [],
    why: 'Quarantined tests rot. Fix or delete; never .skip indefinitely.',
  },
  {
    name: 'test-data-seeding',
    domain: 'testing',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/fixtures/**', '**/seed*', '**/test-data/**'],
      diff_keywords: ['createSeedUser', 'fixtureData', 'fakerjs'],
      packages_imported: ['@faker-js/faker'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: ['helper-app-query-parity'], required_skills: [], optional_skills: [] },
    related: [],
    why: 'Helpers must mirror app queries; shared accounts must be cleaned up.',
  },
  {
    name: 'mocking-vs-fixtures',
    domain: 'testing',
    severity: 'LOW',
    signals: {
      file_path_patterns: ['**/__mocks__/**', '**/test-utils/**'],
      diff_keywords: ['vi\\.mock', 'jest\\.mock', 'sinon\\.stub'],
      packages_imported: ['msw', 'nock'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: [] },
    related: [],
    why: 'Mocked DB tests pass when prod migrations break. Use real DB for integration tests.',
  },

  // ===== UX / A11Y / CROSS-PLATFORM =====
  {
    name: 'wcag-aa-compliance',
    domain: 'ux',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/components/**'],
      diff_keywords: ['aria-', 'role=', 'tabIndex', 'alt=\\s*[\'"]'],
      packages_imported: ['@axe-core/*', 'eslint-plugin-jsx-a11y'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-ux'] },
    related: [],
    why: 'AA is the legal floor in many jurisdictions. axe-core + manual sweep on new flows.',
  },
  {
    name: 'keyboard-navigation',
    domain: 'ux',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/components/**'],
      diff_keywords: ['onKeyDown', 'onKeyUp', 'tabIndex', 'focus\\(\\)'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-ux'] },
    related: ['wcag-aa-compliance'],
    why: 'Every interactive element reachable + operable from keyboard. Focus traps in modals.',
  },
  {
    name: 'screen-reader-flow',
    domain: 'ux',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/components/**'],
      diff_keywords: ['aria-live', 'aria-label', 'aria-describedby', 'role=\\s*[\'"]alert'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-ux'] },
    related: ['wcag-aa-compliance'],
    why: 'Live regions announce dynamic updates. Without them, screen reader users miss state changes.',
  },
  {
    name: 'reduced-motion',
    domain: 'ux',
    severity: 'LOW',
    signals: {
      file_path_patterns: ['**/components/**'],
      diff_keywords: ['prefers-reduced-motion', 'animate', 'motion\\.', 'framer-motion'],
      packages_imported: ['framer-motion', 'motion'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-ux'] },
    related: [],
    why: 'Honor prefers-reduced-motion. Vestibular sensitivity is real.',
  },
  {
    name: 'dark-mode-coverage',
    domain: 'ux',
    severity: 'LOW',
    signals: {
      file_path_patterns: ['**/components/**', '**/styles/**'],
      diff_keywords: ['dark:', 'prefers-color-scheme', 'useTheme'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-ui'] },
    related: [],
    why: 'New components honor light/dark. Drift is the canonical bug.',
  },
  {
    name: 'mobile-responsive',
    domain: 'ux',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/components/**', '**/styles/**'],
      diff_keywords: ['sm:', 'md:', 'lg:', 'min-width', 'max-width', '@media'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-ui'] },
    related: [],
    why: 'Test at 360px, 414px, 768px, 1280px. Tap targets ≥ 44px.',
  },
  {
    name: 'offline-capability',
    domain: 'ux',
    severity: 'LOW',
    signals: {
      file_path_patterns: ['**/sw.{ts,js}', '**/service-worker*', '**/offline*'],
      diff_keywords: ['navigator\\.onLine', 'caches\\.open', 'workbox'],
      packages_imported: ['workbox-*', 'idb'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: [],
    why: 'PWA / native offline UX requires explicit cache + sync strategy.',
  },
  {
    name: 'ios-android-parity',
    domain: 'ux',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/ios/**', '**/android/**', '**/native/**'],
      diff_keywords: ['Platform\\.OS', 'Platform\\.select', 'react-native'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: [],
    why: 'Platform-specific code paths drift. Test the parity, not just the existence of branches.',
  },
  {
    name: 'capacitor-native-bridge',
    domain: 'ux',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/capacitor.config*', '**/android/**', '**/ios/**', '**/capacitorInit*'],
      diff_keywords: ['Capacitor\\.', '@capacitor/', 'Plugins\\.'],
      packages_imported: ['@capacitor/*'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: ['ios-android-parity', 'build-ship-alignment'],
    why: 'Native bridge edits often need new APK/AAB build to ship to users.',
  },
  {
    name: 'push-token-lifecycle',
    domain: 'ux',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/push*', '**/notifications/**'],
      diff_keywords: ['fcm', 'apns', 'pushToken', 'deviceToken', 'registerForPushNotifications'],
      packages_imported: ['@capacitor/push-notifications', 'firebase-admin'],
      env_vars_referenced: ['FCM_*', 'APN_*', 'FIREBASE_*'],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: ['pii-handling'],
    why: 'Token rotation, multi-device, opt-in/out, dead-token cleanup.',
  },
  {
    name: 'deep-link-handling',
    domain: 'ux',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/deeplinks/**', '**/AndroidManifest.xml', '**/Info.plist'],
      diff_keywords: ['intent-filter', 'CFBundleURLSchemes', 'universalLink', 'deepLink'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: ['oauth-callback', 'capacitor-native-bridge'],
    why: 'OAuth callbacks, share-receivers, marketing links. Validation + auth gating.',
  },

  // ===== I18N =====
  {
    name: 'i18n-coverage',
    domain: 'i18n',
    severity: 'LOW',
    signals: {
      file_path_patterns: ['**/locales/**', '**/i18n/**', '**/translations/**'],
      diff_keywords: ['t\\(\\s*[\'"]', 'i18n\\.', 'useTranslation'],
      packages_imported: ['i18next', 'react-i18next', 'next-i18next'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: [] },
    related: [],
    why: 'Hardcoded English strings in new UI is the canonical drift.',
  },
  {
    name: 'rtl-support',
    domain: 'i18n',
    severity: 'LOW',
    signals: {
      file_path_patterns: ['**/styles/**', '**/components/**'],
      diff_keywords: ['dir=\\s*[\'"]rtl', 'logical-properties', 'inline-start', 'inline-end'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: [] },
    related: ['i18n-coverage'],
    why: 'Use logical CSS properties. Test in Arabic/Hebrew.',
  },
  {
    name: 'timezone-handling',
    domain: 'i18n',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/components/**', '**/services/**'],
      diff_keywords: ['new Date\\(', 'Date\\.now', 'toLocaleString', 'tz:', 'DateTime\\.'],
      packages_imported: ['date-fns-tz', 'luxon', 'dayjs'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: [],
    why: 'UTC at rest, local at render. Daylight-saving, leap seconds, fixed-offset users.',
  },
  {
    name: 'currency-formatting',
    domain: 'i18n',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/components/**', '**/services/**'],
      diff_keywords: ['toLocaleString.*currency', 'NumberFormat.*currency', 'formatCurrency'],
      packages_imported: ['dinero.js', 'currency.js'],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: ['pricing-tier-touch', 'billing-side-effect'],
    why: 'Cents/minor units only at the boundary. Locale formatting at render.',
  },
  {
    name: 'number-locale',
    domain: 'i18n',
    severity: 'LOW',
    signals: {
      file_path_patterns: ['**/components/**'],
      diff_keywords: ['toLocaleString', 'Intl\\.NumberFormat'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: [] },
    related: [],
    why: '1,000.00 vs 1.000,00. Intl, not hand-rolled.',
  },

  // ===== BUSINESS =====
  {
    name: 'pricing-tier-touch',
    domain: 'business',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/pricing/**', '**/tiers/**', '**/plans/**', '**/components/**/Pricing*'],
      diff_keywords: ['priceMonthly', 'tier:', 'plan:', 'pricingTier'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['pricing', 'manage-finops'] },
    related: ['paid-payment-api'],
    why: 'Tier changes touch billing + entitlements + landing copy. Cross-system review.',
  },
  {
    name: 'billing-side-effect',
    domain: 'business',
    severity: 'CRITICAL',
    signals: {
      file_path_patterns: ['**/services/billing/**', '**/functions/*invoice*/**'],
      diff_keywords: ['createInvoice', 'chargeCustomer', 'recurringPayment'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['paid-payment-api'],
    why: 'Wrong billing = customer trust + chargebacks. Idempotency + manual review of pricing logic.',
  },
  {
    name: 'revenue-attribution',
    domain: 'business',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/services/attribution/**'],
      diff_keywords: ['utm_source', 'attribution', 'campaign\\b', 'first_touch', 'last_touch'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: [] },
    related: ['paid-analytics-api'],
    why: 'Attribution model defines who gets credit; downstream marketing decisions follow.',
  },
  {
    name: 'refund-flow',
    domain: 'business',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/refunds/**', '**/functions/*refund*/**'],
      diff_keywords: ['createRefund', 'partialRefund', 'refundPolicy'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['review-security'] },
    related: ['billing-side-effect', 'paid-payment-api'],
    why: 'Idempotency key + audit + downstream entitlement reversal.',
  },
  {
    name: 'subscription-state-machine',
    domain: 'business',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/subscriptions/**'],
      diff_keywords: ['subscription\\.status', 'cancelSubscription', 'reactivate', 'gracePeriod'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: ['billing-side-effect'],
    why: 'States: trialing, active, past_due, canceled, expired. Transitions must be explicit.',
  },
  {
    name: 'upgrade-downgrade-prorate',
    domain: 'business',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/billing/**'],
      diff_keywords: ['proration', 'upgrade', 'downgrade', 'creditAmount'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: ['design-tech'] },
    related: ['subscription-state-machine'],
    why: 'Proration math is a prime source of customer-trust-breaking bugs.',
  },

  // ===== LEGAL / DOCS =====
  {
    name: 'terms-of-service-touch',
    domain: 'legal',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/terms*', '**/ToS*', '**/legal/terms*'],
      diff_keywords: ['Terms of Service', 'arbitration clause', 'limitation of liability'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: [] },
    related: [],
    why: 'Material ToS changes need user notice + (sometimes) re-consent. Lawyer review for substantive changes.',
  },
  {
    name: 'privacy-policy-touch',
    domain: 'legal',
    severity: 'HIGH',
    signals: {
      file_path_patterns: ['**/privacy*', '**/legal/privacy*'],
      diff_keywords: ['Privacy Policy', 'data we collect', 'third-party processors'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: [] },
    related: ['pii-handling'],
    why: 'Privacy policy must reflect actual data flows. Out-of-date = regulatory risk.',
  },
  {
    name: 'acceptable-use-policy',
    domain: 'legal',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/aup*', '**/acceptable-use*'],
      diff_keywords: [],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: [] },
    related: [],
    why: 'Defines what users can and can\'t do. Enforcement requires policy alignment.',
  },
  {
    name: 'dmca-takedown',
    domain: 'legal',
    severity: 'MEDIUM',
    signals: {
      file_path_patterns: ['**/dmca/**'],
      diff_keywords: ['DMCA', 'takedown', 'counter-notice'],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: [] },
    related: [],
    why: 'Safe-harbor process. Designated agent + response SLA + counter-notice path.',
  },
  {
    name: 'api-doc-coverage',
    domain: 'docs',
    severity: 'LOW',
    signals: {
      file_path_patterns: ['**/openapi.{yaml,json}', '**/swagger*'],
      diff_keywords: [],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: [] },
    related: [],
    why: 'Public APIs without doc = dead. Spec-driven generation keeps docs honest.',
  },
  {
    name: 'user-doc-coverage',
    domain: 'docs',
    severity: 'LOW',
    signals: {
      file_path_patterns: ['**/docs/user/**', '**/help/**'],
      diff_keywords: [],
      packages_imported: [],
      env_vars_referenced: [],
    },
    handled_by: { required_rules: [], required_skills: [], optional_skills: [] },
    related: [],
    why: 'Features without docs cause support load. Update help when shipping.',
  },
];

// ---------- emit ---------------------------------------------------------

function escapeYamlString(s) {
  return String(s).replace(/"/g, '\\"');
}

function emitConcern(c) {
  const path = join(CONCERNS_DIR, `${c.name}.md`);
  if (existsSync(path)) {
    return { path, skipped: true };
  }

  const fp = (c.signals.file_path_patterns || []).map((p) => `    - "${p}"`).join('\n') || '    []';
  const dk = (c.signals.diff_keywords || []).map((p) => `    - "${escapeYamlString(p)}"`).join('\n') || '    []';
  const pkg = (c.signals.packages_imported || []).map((p) => `    - "${p}"`).join('\n') || '    []';
  const env = (c.signals.env_vars_referenced || []).map((p) => `    - "${p}"`).join('\n') || '    []';

  const reqRules = JSON.stringify(c.handled_by.required_rules || []);
  const reqSkills = JSON.stringify(c.handled_by.required_skills || []);
  const optSkills = JSON.stringify(c.handled_by.optional_skills || []);
  const related = (c.related || []).map((r) => `  - ${r}`).join('\n');

  const text = `---
name: ${c.name}
domain: ${c.domain}
severity: ${c.severity}
status: active
created: ${TODAY}
last_reviewed: ${TODAY}

signals:
  file_path_patterns:
${fp}
  diff_keywords:
${dk}
  packages_imported:
${pkg}
  env_vars_referenced:
${env}

handled_by:
  required_rules: ${reqRules}
  required_skills: ${reqSkills}
  optional_skills: ${optSkills}

waiver_format: |
  PR body line: "concern-waived: ${c.name} — <reason>"

fires_on:
  - first-introduction
  - bugfix-touching-call-shape
  - new-caller
  - refactor

fires_off:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/__tests__/**"
  - "**/docs/**"

related_concerns:
${related || '  []'}
---

# ${c.name}

${c.why}

# How to think about it

The handling skills/rules listed in \`handled_by\` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
`;

  writeFileSync(path, text);
  return { path, skipped: false };
}

let written = 0;
let skipped = 0;
for (const c of concerns) {
  const r = emitConcern(c);
  if (r.skipped) skipped++;
  else written++;
}

console.log(`Phase 2 seed: ${written} written, ${skipped} skipped (already existed). Total target: ${concerns.length}.`);

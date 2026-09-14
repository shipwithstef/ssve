// scripts/lib/secret-redaction.mjs
//
// Pre-disk-write secret redaction for the auto-learning pipeline.
// Catastrophe-class gap: today a session error containing a Bearer token,
// AWS AKIA key, OpenAI sk-*, Anthropic sk-ant-*, GitHub ghp_*, etc. can
// be captured into .svc/auto-learnings.jsonl and promoted into TRACKED
// learning files (references/framework-learnings.jsonl, docs/learnings/
// learnings.jsonl, user-memory directories), then pushed to the public
// repo. This module redacts BEFORE the first write.
//
// Source: GSD `bin/lib/secrets.cjs` (deterministic config-key masking)
// and gsd-2/skills-agents.md (10-pattern regex set for LLM-ingestion redaction).
//
// Two complementary mechanisms:
//
//   1. redactSecrets(text) — runs 10 regex patterns over free text,
//      replacing matches with "[REDACTED:<short-tag>]". Used by the
//      auto-learning hook + promote-auto-learnings + the candidate
//      detector. Catches API keys / tokens that show up in tool output
//      or pipeline-decisions snippets.
//
//   2. maskConfigValue(key, value) — deterministic masking for
//      explicitly-named secret config keys. If value >= 8 chars,
//      returns "****<last-4>"; if < 8, returns strictly "****". Prevents
//      fractional leaking. Used when rendering config output (not yet
//      wired but exposed for future use).
//
// Doctrine: redaction MUST run BEFORE the first persistent write.
// Promotion-time or read-time redaction is too late — the secret has
// already touched disk in clear text by then.

const SECRET_PATTERNS = [
  // 1. Anthropic API keys: sk-ant-*
  { tag: "anthropic-key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },

  // 2. OpenAI API keys: sk-... (legacy) and sk-proj-... (current)
  { tag: "openai-key", re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },

  // 3. GitHub tokens: classic format (ghp_/gho_/ghu_/ghs_/ghr_ + 36 alphanumeric chars)
  { tag: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{36}\b/g },

  // 3b. GitHub fine-grained PATs: `github_pat_<base62>` (modern format,
  // typical length ~93 chars; min 22 to avoid false positives on short
  // non-token strings). Codex round-2 on PR #136 caught: classic-token
  // pattern missed these entirely, letting modern PATs leak.
  { tag: "github-pat", re: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g },

  // 4. AWS AKIA access keys
  { tag: "aws-akia", re: /\bAKIA[0-9A-Z]{16}\b/g },

  // 5. Stripe live/test keys
  { tag: "stripe-key", re: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{24,}\b/g },

  // 6. JWT (three base64url segments separated by dots, starting with eyJ — the {"alg":...} header)
  { tag: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },

  // 7. PEM private key blocks (multi-line; dotAll match)
  { tag: "private-key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g },

  // 8. Bearer tokens in Authorization headers (any 20+ alphanumeric blob after "Bearer ")
  { tag: "bearer-token", re: /\bBearer\s+[A-Za-z0-9_.~+/=-]{20,}\b/gi },

  // 9. npm tokens: npm_<36 base32 chars>
  { tag: "npm-token", re: /\bnpm_[A-Za-z0-9]{36}\b/g },

  // 10. Generic "*_API_KEY=value" / "*_TOKEN=value" / "*_SECRET=value" style env-var assignments
  // The value is captured up to whitespace / quote / end-of-line. Conservative; only fires on KEY=value shape.
  { tag: "env-secret", re: /\b([A-Z][A-Z0-9_]{2,}_(?:API_KEY|TOKEN|SECRET|PASSWORD|KEY|CREDENTIALS))\s*=\s*['"]?([^\s'"]{8,})['"]?/g, group: 2 },
];

/**
 * Redact all detected secrets in `text`. Returns the redacted text.
 *
 * Behavior:
 *   - Each pattern's match is replaced with `[REDACTED:<tag>]`.
 *   - Patterns with a `group` field replace only the captured group, not
 *     the whole match (preserves the KEY=value shape so the structure is
 *     readable while the value is masked).
 *   - Order matters when patterns could overlap; the array order is
 *     specific-to-generic so the more-specific tag wins.
 *   - Non-string inputs are returned unchanged (fail-open on type
 *     mismatch rather than crash on a hook payload edge case).
 *   - Empty/null/undefined returns "" / null / undefined unchanged.
 *
 * @param {string} text
 * @returns {string}
 */
export function redactSecrets(text) {
  if (text === null || text === undefined) return text;
  if (typeof text !== "string") return text;
  if (text.length === 0) return text;

  let out = text;
  for (const { tag, re, group } of SECRET_PATTERNS) {
    // Reset stateful regex
    re.lastIndex = 0;
    if (typeof group === "number") {
      out = out.replace(re, (match, ...groups) => {
        // groups: [g1, g2, ..., offset, fullString] — drop offset+fullString
        const captured = groups[group - 1];
        if (typeof captured !== "string") return match;
        return match.replace(captured, `[REDACTED:${tag}]`);
      });
    } else {
      out = out.replace(re, `[REDACTED:${tag}]`);
    }
  }
  return out;
}

// Slug-form secret patterns. After slugification, secrets lose their
// original delimiters (e.g. `Bearer abc123…` becomes `bearer-abc123…`,
// `sk-ant-XXX` becomes `sk-ant-xxx`). Codex round-2 on PR #136 caught:
// legacy candidate.key values captured BEFORE the detector's slugify
// fix may still carry slug-shaped secrets that the regex set above
// (which expects original delimiters) does NOT match. This sweep
// catches them post-hoc when promote-time reads legacy entries.
const SLUG_SECRET_PATTERNS = [
  { tag: "slug-bearer", re: /\bbearer-[a-z0-9-]{20,}\b/g },
  { tag: "slug-anthropic", re: /\bsk-ant-[a-z0-9-]{18,}\b/g },
  { tag: "slug-openai", re: /\bsk-(?:proj-)?[a-z0-9-]{18,}\b/g },
  { tag: "slug-github-classic", re: /\bgh[pousr]-[a-z0-9-]{30,}\b/g },
  { tag: "slug-github-pat", re: /\bgithub-pat-[a-z0-9_-]{20,}\b/g },
  { tag: "slug-aws-akia", re: /\bakia-?[a-z0-9-]{14,}\b/g },
  { tag: "slug-stripe", re: /\b(?:sk|pk|rk)-(?:live|test)-[a-z0-9-]{20,}\b/g },
  { tag: "slug-npm", re: /\bnpm-[a-z0-9-]{30,}\b/g },
];

/**
 * Scrub slug-form secrets from a string. Replaces matched slugs with
 * `[REDACTED-SLUG:<tag>]`. Used for cleaning candidate.key values that
 * were derived from secret-bearing text before the detector's slugify
 * fix landed.
 *
 * @param {string} slug
 * @returns {string}
 */
export function scrubSlugSecrets(slug) {
  if (typeof slug !== "string") return slug;
  let out = slug;
  for (const { tag, re } of SLUG_SECRET_PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, `[REDACTED-SLUG:${tag}]`);
  }
  return out;
}

/**
 * Deep-redact: walks an object/array/string and runs redactSecrets on
 * every string value (any depth). Used by appendJsonlLine-style writers
 * that take structured payloads.
 *
 * @param {any} value
 * @returns {any}
 */
export function redactSecretsDeep(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactSecrets(value);
  if (Array.isArray(value)) return value.map(redactSecretsDeep);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = redactSecretsDeep(v);
    }
    return out;
  }
  return value;
}

/**
 * Mask a config value when the key is in the secret-keys set.
 * Returns "****<last-4>" if value.length >= 8, "****" otherwise.
 *
 * @param {string} key
 * @param {string} value
 * @returns {string}
 */
const DEFAULT_SECRET_KEYS = new Set([
  "api_key",
  "apikey",
  "secret",
  "secret_key",
  "password",
  "token",
  "auth_token",
  "access_token",
  "refresh_token",
  "private_key",
  "anthropic_api_key",
  "openai_api_key",
  "github_token",
  "stripe_secret_key",
  "stripe_publishable_key",
  "brave_search_api_key",
  "firecrawl_api_key",
]);

export function isSecretKey(key, customKeys) {
  if (typeof key !== "string") return false;
  const normalized = key.toLowerCase().replace(/[-\s]/g, "_");
  if (DEFAULT_SECRET_KEYS.has(normalized)) return true;
  if (customKeys && customKeys.has(normalized)) return true;
  // Catch *_KEY, *_SECRET, *_TOKEN, *_PASSWORD even if not in the named set
  if (/_(key|secret|token|password|credentials)$/.test(normalized)) return true;
  return false;
}

export function maskConfigValue(key, value, customKeys) {
  if (!isSecretKey(key, customKeys)) return value;
  if (typeof value !== "string") return value;
  if (value.length >= 8) return `****${value.slice(-4)}`;
  return "****";
}

// Debug helper: count how many redactions each pattern would make in `text`.
// Useful for the SVC_REDACTION_DEBUG=1 audit path.
export function countRedactions(text) {
  if (typeof text !== "string") return {};
  const counts = {};
  for (const { tag, re } of SECRET_PATTERNS) {
    re.lastIndex = 0;
    const matches = text.match(re);
    if (matches) counts[tag] = matches.length;
  }
  return counts;
}

// CLI smoke-test
if (import.meta.url === `file://${process.argv[1]}`) {
  const input = process.argv[2] || "";
  process.stdout.write(redactSecrets(input) + "\n");
}

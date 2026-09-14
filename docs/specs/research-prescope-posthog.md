# Pre-Scope: PostHog

**Source:** https://posthog.com/llms.txt plus selected official PostHog raw Markdown docs, npm registry metadata, and local implementation references
**Invoked by:** research
**Date:** 2026-05-27

## Volume Estimate

- Total files (substantive, excluding images/licenses/generated): 51 official web/API/registry sources plus 14 local project references.
- Approx total tokens / lines: about 950k fetched characters from official docs and registry metadata; local files add about 30k lines of implementation and plan context.
- Top-level areas/sections: platform overview, JavaScript/React SDK, Node/API capture, event and person data model, identity resolution, consent/privacy/GDPR, session replay, error tracking, surveys, web analytics, feature flags, experiments, reverse proxy/CSP, MCP/live verification, and Example Marketplace-specific fit.

## File Checklist (manifest)

Every substantive official source that MUST be read in the single pass:

- [ ] https://posthog.com/llms.txt
- [ ] https://posthog.com/docs/libraries.md
- [ ] https://posthog.com/docs/libraries/js.md
- [ ] https://posthog.com/docs/libraries/js/config.md
- [ ] https://posthog.com/docs/libraries/js/persistence.md
- [ ] https://posthog.com/docs/libraries/js/usage.md
- [ ] https://posthog.com/docs/libraries/react.md
- [ ] https://posthog.com/docs/libraries/node.md
- [ ] https://posthog.com/docs/support/javascript-api.md
- [ ] https://posthog.com/docs/api.md
- [ ] https://posthog.com/docs/api/capture.md
- [ ] https://posthog.com/docs/api/flags.md
- [ ] https://posthog.com/docs/data/events.md
- [ ] https://posthog.com/docs/data/persons.md
- [ ] https://posthog.com/docs/data/anonymous-vs-identified-events.md
- [ ] https://posthog.com/docs/product-analytics/installation.md
- [ ] https://posthog.com/docs/product-analytics/capture-events.md
- [ ] https://posthog.com/docs/product-analytics/identify.md
- [ ] https://posthog.com/docs/product-analytics/identity-resolution.md
- [ ] https://posthog.com/docs/product-analytics/person-properties.md
- [ ] https://posthog.com/docs/product-analytics/privacy.md
- [ ] https://posthog.com/docs/product-analytics/autocapture.md
- [ ] https://posthog.com/docs/feature-flags/start-here.md
- [ ] https://posthog.com/docs/feature-flags/adding-feature-flag-code.md
- [ ] https://posthog.com/docs/feature-flags/bootstrapping.md
- [ ] https://posthog.com/docs/feature-flags/local-evaluation.md
- [ ] https://posthog.com/docs/feature-flags/canary-release.md
- [ ] https://posthog.com/docs/experiments/start-here.md
- [ ] https://posthog.com/docs/experiments/adding-experiment-code.md
- [ ] https://posthog.com/docs/experiments/exposures.md
- [ ] https://posthog.com/docs/session-replay/start-here.md
- [ ] https://posthog.com/docs/session-replay/privacy.md
- [ ] https://posthog.com/docs/session-replay/console-log-recording.md
- [ ] https://posthog.com/docs/error-tracking/capture.md
- [ ] https://posthog.com/docs/surveys/creating-surveys.md
- [ ] https://posthog.com/docs/web-analytics/installation.md
- [ ] https://posthog.com/docs/privacy.md
- [ ] https://posthog.com/docs/privacy/gdpr-compliance.md
- [ ] https://posthog.com/docs/privacy/data-collection.md
- [ ] https://posthog.com/docs/privacy/data-storage.md
- [ ] https://posthog.com/docs/privacy/ad-blockers.md
- [ ] https://posthog.com/docs/advanced/content-security-policy.md
- [ ] https://posthog.com/docs/advanced/proxy.md
- [ ] https://posthog.com/docs/model-context-protocol.md
- [ ] https://posthog.com/docs/model-context-protocol/tools.md
- [ ] https://posthog.com/docs/model-context-protocol/codex.md
- [ ] https://posthog.com/docs/model-context-protocol/claude-code.md
- [ ] https://posthog.com/docs/model-context-protocol/faq.md
- [ ] https://posthog.com/docs/sdk-doctor/keeping-sdks-current.md
- [ ] https://registry.npmjs.org/posthog-js/latest
- [ ] https://registry.npmjs.org/@posthog/react/latest

Local project references to read and hash:

- `/home/svc-user/app-workspaces/example-marketplace/package.json`
- `/home/svc-user/app-workspaces/example-marketplace/.env.example`
- `/home/svc-user/app-workspaces/example-marketplace/src/lib/track.js`
- `/home/svc-user/app-workspaces/example-marketplace/src/lib/cookieConsent.js`
- `/home/svc-user/app-workspaces/example-marketplace/src/components/CookieConsentBanner.jsx`
- `/home/svc-user/app-workspaces/example-marketplace/docs/plans/2026-05-27-wi316-posthog-integration/manifest.md`
- `/home/svc-user/app-workspaces/example-marketplace/.claude/skills/posthog-integration/SKILL.md`
- `/home/svc-user/app-workspaces/covibefusion/web/src/lib/posthog.ts`
- `/home/svc-user/app-workspaces/covibefusion/web/src/main.tsx`
- `/home/svc-user/app-workspaces/covibefusion/web/src/services/trackingService.ts`
- `/home/svc-user/app-workspaces/covibefusion/lib/services/posthog_service.dart`
- `/home/svc-user/app-workspaces/covibefusion/tests/posthog/helpers/posthog_mcp_verifier.py`
- `/home/svc-user/app-workspaces/distrilicious/src/Layout.jsx`
- `/home/svc-user/app-workspaces/distrilicious/src/pages/PrivacyPolicy.jsx`

## Extraction Plan

- Pass strategy: single-pass across all checklist files; official docs are fetched via PostHog's `llms.txt` raw-Markdown index, then Gemini is dispatched against this pre-scope for independent extraction; Claude fallback completes gaps if Gemini coverage is partial.
- Target detail files:
  - `references/knowledge/domains/posthog/details/platform-products-and-costs.md`
  - `references/knowledge/domains/posthog/details/browser-react-sdk.md`
  - `references/knowledge/domains/posthog/details/event-model-identity-and-persons.md`
  - `references/knowledge/domains/posthog/details/consent-privacy-and-gdpr.md`
  - `references/knowledge/domains/posthog/details/session-replay-error-surveys-web-analytics.md`
  - `references/knowledge/domains/posthog/details/feature-flags-experiments-and-rollouts.md`
  - `references/knowledge/domains/posthog/details/server-api-mcp-and-verification.md`
  - `references/knowledge/domains/posthog/details/local-implementation-comparison.md`
  - `references/knowledge/domains/posthog/details/applied-knowledge.md`
- Domain classification: `domains/posthog` (justification: PostHog is a reusable vendor/library/product domain that affects analytics, privacy, feature flags, experiments, replay, and agent MCP verification across projects, not only Example Marketplace).

## Sub-Agent Selection

- Primary: gemini-cli (default - REQUIRED unless gemini-cli has actually failed)
- Fallback: Claude (in-session) if gemini errors, runs out of credits, or stalls mid-pass
- Selected for this run: fallback / Claude in-session - `gemini --version` succeeded with `0.42.0`, but the current `dispatch-gemini.mjs` run returned HTTP 429 `MODEL_CAPACITY_EXHAUSTED` for `gemini-3.1-pro-preview`, so the research skill fallback path completed extraction in-session.
- Machine-readable endpoint: PostHog exposes `https://posthog.com/llms.txt`, and it states that docs pages are available as raw Markdown by appending `.md` to any URL. The raw Markdown URLs above are therefore the authoritative content source. This does not bypass Gemini selection; it narrows Gemini and fallback extraction to exact source files instead of a broad website crawl.

## Expected Output Artifacts

- `references/knowledge/domains/posthog/CAPABILITIES.md` (Layer 2)
- `references/knowledge/domains/posthog/details/*.md` (Layer 3)
- `references/knowledge/domains/posthog/.version`
- `references/knowledge/domains/posthog/.sources.jsonl`
- `references/knowledge/domains/posthog/.activity-na`
- `references/knowledge/INDEX.md` entry updated
- `docs/specs/research-log.md` entry appended

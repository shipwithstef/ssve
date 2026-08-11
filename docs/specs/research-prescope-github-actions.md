# Research Pre-Scope — github-actions domain

**Generated:** 2026-04-30
**Skill invocation:** research (analysis mode)
**Output target:** `references/knowledge/domains/github-actions/{INDEX.md,CAPABILITIES.md}`

## Sub-Agent Selection

**Primary:** gemini-cli
**Selected for this run:** gemini-cli — official-docs extraction is exactly what gemini's long context + cheap tokens are for. No reason to fall back to Claude here.
**Reason check (per `rules/research-must-use-gemini-cli.md`):** none of the 4 legitimate fallback reasons apply (gemini-cli installed at `/home/svc-user/.nvm/versions/node/v24.13.0/bin/gemini` v0.39.1, no auth failure observed yet, no SVC_RESEARCH_AGENT override, no mid-run primary failure).

## Question / Goal

Build a Layer 2 CAPABILITIES.md for the `github-actions` domain that the Knowledge Spine (`recall-stack-knowledge`) can query. Output must answer infra-* lane questions about CI/CD on GitHub.

## Sources to extract from

1. https://docs.github.com/en/actions — official primary docs
2. https://docs.github.com/en/actions/security-for-github-actions — security hardening
3. https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect — OIDC for cloud auth
4. https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions — cost model + minute pricing
5. https://github.com/actions/runner — runner releases, security advisories

## Topics to cover (each becomes a CAPABILITIES.md heading)

- Core model (workflows, jobs, steps, runners, contexts)
- Triggers (`on:` events, `pull_request` from forks security boundary)
- Runners (hosted vs self-hosted vs ARC, current pricing in minutes)
- Secrets + OIDC (current trust-policy patterns for AWS/GCP/Azure)
- Reusable workflows + composite actions (current syntax)
- Security hardening (current best practices, current attestation actions, current pinning recommendations)
- Cost model (current free-tier minute counts, current OS multipliers)
- Migration patterns (Jenkins, CircleCI, GitLab — current verified mappings)

## Anti-patterns to flag at SEV-1/2

For each anti-pattern, require a **citation** to either:
- An official GitHub security advisory, OR
- A documented incident class with date, OR
- An explicit recommendation in the official hardening docs.

NO fabricated CVE numbers. If a real CVE applies, cite it correctly. If not, describe the pattern without inventing a CVE.

## Provenance requirements

Every claim in the output CAPABILITIES.md must be either:
1. Directly derivable from one of the listed sources (with URL anchor), OR
2. Marked `[CITATION-NEEDED]` for follow-up, OR
3. Removed.

## Freshness

- Source URLs read at extraction time → record retrieval timestamp.
- Re-validate every 90 days (per knowledge-protocol.md domain freshness rule).

## Output structure

```
references/knowledge/domains/github-actions/
  INDEX.md          — Layer 1 (~200 tokens)
  CAPABILITIES.md   — Layer 2 (~2K tokens), all claims cited
  details/          — Layer 3 stubs (filled by gap → research auto-loop on miss)
  .version          — date of extraction (YYYY-MM-DD)
  .sources.jsonl    — append-only log of source URLs + retrieval timestamps + content-hash
```

## Coverage checklist (gemini-cli must answer all yes/no with evidence)

- [ ] All 8 topics above covered, each with ≥1 citation
- [ ] Anti-pattern list contains zero fabricated CVE numbers
- [ ] OIDC AWS trust-policy example uses correct current `sub` claim format
- [ ] Runner pricing table reflects current 2026-04 pricing OR is marked stale
- [ ] Security-hardening section sourced from official hardening doc (URL anchor)
- [ ] Migration patterns include at least one cited example per source platform

## Failure mode

If any topic returns 0 citations from the listed sources, mark that topic `[CITATION-NEEDED]` in the output and emit a `knowledge-gap` event to `.svc/knowledge-recall.jsonl`. Do NOT confabulate.

---

## Run Log (appended at extraction time)

**2026-04-30T17:55Z** — Selected: gemini-cli (gemini-2.5-pro). Attempted.
**2026-04-30T17:56Z** — gemini-2.5-pro returned HTTP 429 RESOURCE_EXHAUSTED (server capacity, not auth). Retried with gemini-2.5-flash.
**2026-04-30T17:57Z** — gemini-2.5-flash also returned 429.
**2026-04-30T17:58Z** — **Falling back to Claude in-session WebFetch.** This satisfies legitimate fallback reason #4 per `rules/research-must-use-gemini-cli.md` (mid-run primary failure: gemini-cli was tried, returned non-zero with rate-limit error; pre-scope records the attempt). Proceeding with WebFetch from this Claude session.

**Selected for extraction: claude (in-session WebFetch)** — gemini-cli RESOURCE_EXHAUSTED on both pro + flash; cannot wait for capacity to clear.

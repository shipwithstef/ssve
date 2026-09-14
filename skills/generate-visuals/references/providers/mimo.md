# Provider: MiMo (Xiaomi) — DEV-ONLY per ToS, NOT for production marketing

**Status:** Available via opencode + MiMo Token Plan
**Auth requirement:** MiMo Token Plan ($39/mo) accessed via `token-plan-ams.xiaomimimo.com/v1`
**Cost:** Free under Token Plan budget; rate-limited to ~100 RPM / 10M TPM

## ⚠️ License gate — CRITICAL

The Xiaomi MiMo Token Plan is **restricted to developer tooling per ToS**. Authorized use:
- IDE coding tools (Claude Code, Cursor, Cline, OpenCode)
- Personal exploration, dev-only mockups

**Forbidden:**
- Production app backends
- Customer-facing AI features
- **Production marketing assets** (the case this provider doc gates)
- Automated scripts outside an IDE

For production marketing use of MiMo image gen, register on the **MiMo Open Platform** with Business Verification and use Pay-As-You-Go (`MiMo-V2.5`, ~$0.40 / $2.00 per Mtok input/output).

Source: 2026-04-25 verification via gemini-cli research → `references/framework-learnings.jsonl#mimo-token-plan-dev-only` (confidence 10).

## When this provider is allowed in generate-visuals

ONLY when `brief.license != production-marketing`. The skill's Step 5 (Provenance log) MUST flag any MiMo-via-Token-Plan output and the License-constraint Self-Verify check (#6) must reject it for production-marketing briefs.

## When to use (within license)

- Internal mockups / mood boards (`license: development-only`)
- Slack reaction images (`license: internal`)
- Quick variant exploration during design iteration (will be replaced with codex/Stitch outputs before shipping)

## Invocation pattern (via opencode)

```bash
opencode run --model mimo-v2-pro --prompt "<from brief>"
# image is written to opencode's session directory; copy to docs/specs/hero-assets/<slot>/candidates/mimo-N.png
```

## Provenance MUST record license

```yaml
- file: mimo-1.png
  provider: mimo-v2-pro
  invoked_via: opencode-mimo-token-plan
  license_class: development-only         # NEVER production-marketing here
  license_ok: true                        # only true if brief.license is dev-only or internal
```

If a `production-marketing` brief somehow reaches this provider, Self-Verify check #6 catches it and the candidate is excluded.

## Cross-references

- `references/framework-learnings.jsonl` — `mimo-token-plan-dev-only` (confidence 10)
- `references/knowledge/domains/mimo/CAPABILITIES.md` — full capability matrix
- `references/model-routing.md` — overall MiMo routing in svc-default profile

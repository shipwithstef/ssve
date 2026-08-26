# MiMo (Xiaomi) — CAPABILITIES (Layer 2)

**Version:** 2026-04-25 https://xiaomimimo.com
**Source type:** Closed-source vendor — two distinct API tiers (Token Plan = dev-only; Open Platform = commercial)
**Sub-agent used for extraction:** gemini-cli (primary, per WI-090 + rules/research-must-use-gemini-cli.md)

## ⚠️ Critical distinction up front

MiMo has **TWO separate API products with different ToS**:

| Tier | URL pattern | Authorized use | Pricing |
|---|---|---|---|
| **Token Plan** (the "$0/200M-credits" subscription) | `token-plan-ams.xiaomimimo.com/v1` | **DEVELOPER TOOLING ONLY** — IDE integrations (Claude Code, Cursor, Cline, OpenCode), personal exploration | Subscription tier with monthly credit pool |
| **Open Platform** (commercial API) | Different URL (see the ToS warning directly below this table) | **PRODUCTION** apps, customer-facing AI, automated backends — requires Business Verification | Pay-As-You-Go ~$0.40/$2.00 per Mtok input/output (MiMo-V2.5) |

**Routing production app traffic through Token Plan URL = ToS violation, account suspension risk.** This is the single most important fact about MiMo and the registry was wrong about it until 2026-04-25.

## Models available (across both tiers)

| Model | Tier focus | Modalities | Notes |
|---|---|---|---|
| MiMo-V2.5-Pro | Frontier | text + image | Newest (2026-04-22 release) |
| MiMo-V2.5 | Standard | text | svc-default EXEC delegate via opencode (dev-only context) |
| MiMo-V2-Pro | Older | text | Superseded by V2.5 |
| MiMo-V2-Omni | Multimodal | text + image | Older — V2.5-Pro supersedes |
| MiMo-V2-Flash | Speed | text | Cheapest tier; recommended temperature 0.3 for vibe-coding |
| MiMo-V2.5-TTS | Speech synthesis | text → audio | Limited-time free; 8K context, 100 RPM, 10M TPM |
| MiMo-V2.5-TTS-VoiceClone | Voice cloning | text → audio | Limited-time free |
| MiMo-V2.5-TTS-VoiceDesign | Synthetic voice | text → audio | Limited-time free |
| MiMo-V2-TTS | Older speech | text → audio | Limited-time free |

Full roster is the table above.

## Authorized use surfaces (Token Plan)

| Use | Authorized? |
|---|---|
| svc-default EXEC delegation via opencode | ✅ (opencode IS a coding tool) |
| svc-default SENSE / multimodal QA via opencode | ✅ |
| Code generation / refactoring inside Claude Code, Cursor, Cline | ✅ |
| Personal exploration, prototyping | ✅ |
| Production app backend (Example Marketplace, Distrilicious) | ❌ ToS violation |
| Automated cron / batch jobs against Token Plan URL | ❌ ToS violation |
| Customer-facing AI features in a deployed product | ❌ ToS violation |
| Tool routing in svc skills that hit prod APIs | ❌ — must use Open Platform |

## Default throughput limits

- **RPM:** 100
- **TPM:** 10M
- **Effective RPS:** ~1.67
- Higher limits require Open Platform commercial account

These limits alone make production routing impractical even ignoring ToS.

## Off-peak bonus

- **Window:** 16:00–24:00 UTC (= 19:00–03:00 Sofia in summer)
- **Multiplier:** 0.8x credit consumption
- Applies to Token Plan; check Open Platform separately

## Plugins

- **Web Search** — separate billing per Pricing Policy page; not enabled by user; deferred decision per registry (covered by Claude Max + Gemini Pro web access already).

## Hyperparameters (per MiMo API docs)

| Model class | temp default | temp range | top_p default |
|---|---|---|---|
| v2.5-pro / v2-pro / v2.5 / v2-omni | 1.0 | [0, 1.5] | 0.95 |
| v2-flash | 0.3 | [0, 1.5] | 0.95 |
| TTS suite (4 models) | 0.6 | [0, 1.5] | 0.95 |

Wired into `~/.config/opencode/opencode.json` `options.temperature/topP` and `references/model-registry.json` per 2026-04-25 commit `dbf9cfd`.

Hyperparameter notes are inline in the tables above.

## Strategic implications for svc-stack

| Question | Answer (post-correction) |
|---|---|
| Use MiMo to migrate Example Marketplace off Base44? | **Only via Open Platform Pay-As-You-Go** (Business Verification + $0.40/$2.00 per Mtok), NOT via Token Plan. |
| Replace Claude EXEC with MiMo for free? | Yes for **dev** EXEC (svc-default profile). No for **prod** anything. |
| Side-earning content via TTS suite? | Yes — TTS is limited-time free. Voice cloning, synthesis, voice design all free for now. |
| Cancel Base44 because "MiMo is free"? | **NO** — that was the false premise corrected 2026-04-25; migration cost math: Open Platform Pay-As-You-Go vs Base44 subscription, quantified in the pricing rows above. |

## Detail files

> Corrected 2026-08-26 (WI-FW-DOCS-AUDIT-01): the five detail files previously
> listed here (`commercial-vs-token-plan`, `model-roster`, `hyperparameters`,
> `throughput-limits`, `migration-cost-impact`) were never extracted to disk.
> All captured facts live in this body.

## Volatility

- Pricing volatile (any AI vendor in 2026)
- ToS distinction between dev/prod is structural — unlikely to change soon, but re-verify quarterly
- Off-peak window may shift; verify before relying on the bonus

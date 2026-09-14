# Cloudflare — Zone & Domain Transfer Between Accounts

> Last verified: 2026-05-04. Cloudflare changes UI labels periodically; verify the current path against [Cloudflare docs — Move a domain to a new account](https://developers.cloudflare.com/fundamentals/setup/account/move-domain-between-accounts/) before executing.

## Three distinct operations

Cloudflare's "transfer" word is overloaded. Pick the right one for your situation:

| Operation | When to use | Path | Downtime |
|---|---|---|---|
| **Move zone between Cloudflare accounts** | Domain registered elsewhere (Namecheap, Porkbun, etc.); only DNS/CDN config lives at CF; want to reassign the CF zone to a new account | Old account → Websites → domain → Overview → bottom-right "Move to another account" | Zero (NS pair changes, but old NS pair stays active during the transition) |
| **Move zone (incl. CF Registrar ownership) between CF accounts** | Domain is registered at Cloudflare Registrar AND DNS lives at CF; same flow | Same as above — registrar ownership follows the zone | Zero |
| **Transfer domain OUT of Cloudflare Registrar** | Want to move the registration to Namecheap/Porkbun/etc. | Domains → domain → Configuration → "Transfer domain out" → get EPP/auth code → initiate at new registrar | 5-7 day ICANN transfer window; resolution unaffected if NS records preserved |

For founder-structuring use cases (EOOD/LLC takes over from personal account), **operation 1 or 2** is what you want.

## Move-zone-between-accounts: detailed flow

### Pre-conditions

1. Destination Cloudflare account exists, email is verified, 2FA configured.
2. Destination account has an active billing method (only required if destination plan tier is paid; Free works without).
3. You are the source account's Super Administrator (Account Member roles below SA cannot initiate).

### Steps

```
1. Old account → Websites → click on the zone (e.g., example.com)
2. Overview tab → scroll to bottom-right card "Move to another account"
3. Enter destination account's primary email address
4. Source account submits — destination receives email invitation
5. Destination account holder logs in → accepts within 24h
6. Cloudflare assigns the destination account a NEW nameserver pair
   (e.g., was lily.ns.cloudflare.com / aragorn.ns.cloudflare.com on old account;
    becomes alice.ns.cloudflare.com / bob.ns.cloudflare.com on new account)
7. Update nameservers at the registrar (Namecheap/Porkbun/etc. — or automatic if domain
   is at Cloudflare Registrar)
8. Verify resolution propagated: dig <domain> NS — typically <1 hour, max 48h
```

### What MOVES with the zone

- DNS records (A, AAAA, CNAME, MX, TXT, SRV, etc.)
- Page Rules
- Firewall Rules / WAF Custom Rules
- SSL/TLS configuration (universal SSL certs reissue automatically)
- Cache rules + cache settings
- Workers Routes (the routes themselves, NOT the underlying Workers — see below)
- Email Routing rules (forwarding addresses, catch-all settings)
- Bot Management settings (Pro+ tier)
- Rate Limiting rules
- Transform Rules (URL rewrites, header modifications)
- Origin server settings
- DNSSEC configuration

### What DOES NOT move (account-scoped — must recreate at destination)

| Resource | Why account-scoped | Migration required |
|---|---|---|
| **Workers (the script code itself)** | Stored at account level | Re-deploy to destination account; routes follow but bind to new Worker ID |
| **R2 buckets + objects** | Account-scoped storage | Use `rclone` or `aws s3 sync` (R2 has S3 API) to copy objects across; recreate bucket binding |
| **KV namespaces** | Account-scoped storage | `wrangler kv:bulk get` then `wrangler kv:bulk put` against destination account |
| **D1 databases** | Account-scoped | `wrangler d1 export` → `wrangler d1 execute` against destination |
| **Pages projects + builds** | Account-scoped | Re-create Pages project at destination, re-link to repo; build history is lost |
| **Durable Objects** | Account-scoped | Re-deploy under destination account; state migration is non-trivial — script your own export/import path |
| **Queues, Hyperdrive configs, Vectorize indexes** | Account-scoped | Recreate at destination |
| **API tokens** | Tied to source account | Regenerate at destination; update wherever tokens are stored (CI, env vars, third-party integrations) |
| **Audit logs / billing history** | Stay with old account, not exportable | Accept the loss — document the transfer date in your records |
| **Plan tier subscription** | Plan ≠ zone | Destination must subscribe to Pro/Business/Enterprise separately if those are needed |
| **Zaraz config (server-side tagging)** | Account-scoped | Re-import config JSON at destination |
| **Stream videos** | Account-scoped storage | Re-upload — there is no native cross-account stream migration tool |
| **Access apps / Zero Trust policies** | Account-scoped | Recreate at destination; re-issue any cert downloads (e.g., WARP enrollment certs) |

### Gotchas

- **Plan-tier reset.** Source account on Pro/Business/Enterprise → destination defaults to Free unless destination explicitly subscribes. Pro features (Bot Management, advanced caching) revert until destination upgrades.
- **API tokens silently break.** Any CI pipeline, Terraform state, or external integration using a source-account API token loses authorization the moment the zone moves. Rotate proactively, ideally before initiating the move.
- **Email Routing DOES move with the zone**, but the destination address (where mail forwards TO) must be re-verified by Cloudflare if it's the destination account's primary email — verify you don't lock yourself out of inbound mail during the transition.
- **Workers Routes follow, Workers don't.** The route `example.com/api/*` migrates with the zone, but it binds to a Worker ID that doesn't exist on the destination account → 1015 errors until you redeploy the Worker. Sequence: deploy Worker at destination FIRST, then move zone.
- **Audit log loss.** If you need historical audit data for compliance, export it (`/audit/logs` API) before the move.
- **Domain at Cloudflare Registrar — registrar contact info.** Registrar-of-record details (admin/billing contact) follow the zone. Update WHOIS contact info at destination if registering under a new entity (EOOD/LLC).
- **DNSSEC re-handshake.** If DNSSEC is enabled, after the move the destination account's nameservers issue new DS records that must be re-published at the registrar. Cloudflare displays a banner with the new DS values; usually takes 10-30 minutes to propagate fully.
- **24-hour acceptance window.** If destination doesn't accept within 24h, the invitation expires and you have to restart.

## Sequencing for founder-structuring use case

When transferring a personal-account zone to a newly-incorporated entity (EOOD/LLC) owned by a different identity:

```
1. Entity is incorporated, EIK/EIN issued
2. Spouse/relative/entity owner creates new Cloudflare account
   - Use entity's domain email if possible (e.g., contact-fb220d60d8@example.invalid)
   - 2FA mandatory
   - Add entity's billing method
3. (If using Workers/R2/KV/D1/Pages) Deploy/recreate ALL account-scoped resources
   at destination FIRST. Verify they work behind a test subdomain.
4. Rotate all API tokens to destination-account-scoped tokens; update CI/integrations
5. Initiate "Move to another account" from source
6. Destination accepts within 24h
7. Update nameservers at registrar (or wait for CF Registrar auto-update)
8. Verify resolution; verify SSL still issues; verify all routes/Workers/Pages still respond
9. Delete the source account or remove its access (depending on whether you need source for other zones)
```

This sequence keeps the resources continuously serving; only the account-of-record changes.

## Alternative: keep zone in personal account, transfer just registrar

Possible but not recommended. You'd:
- Transfer domain registration out of CF Registrar to (e.g.) Namecheap under entity
- Keep CF zone settings in personal CF account
- Point Namecheap NS records at personal CF account's nameservers

Result: split-brain ownership where entity owns the registration but personal identity controls DNS/routing. Audit confusion + access risk if personal CF account gets locked. Do the zone move concurrently with any registrar change.

## What this knowledge enables

- Founders structuring an EOOD/LLC owned by a different identity (spouse, relative, holding company) can hand off vendor resources cleanly without traffic downtime
- Acquisition / dissolution / co-founder exit scenarios where vendor accounts must change hands
- Audit-readiness: clear documentation of which resources are account-scoped (need recreation) vs zone-scoped (carry over) prevents migration surprises

## Sources

- [Cloudflare docs — Move a domain to a new account](https://developers.cloudflare.com/fundamentals/setup/account/move-domain-between-accounts/)
- [Cloudflare docs — Transfer domain out of Cloudflare Registrar](https://developers.cloudflare.com/registrar/transfers/transfer-out/)
- [Cloudflare docs — Workers / Pages / R2 account-scoping](https://developers.cloudflare.com/workers/platform/limits/) (for which resources are account-scoped)
- [Cloudflare community — zone-move FAQ](https://community.cloudflare.com/c/getting-started/8) (current behavior verification)

## Refresh trigger

Re-verify this file when:
- Cloudflare announces a major dashboard redesign (UI paths drift)
- New CF product launches that may or may not be zone-scoped (e.g., AI Gateway scoping changed in 2024-2026)
- Annual review (each January)

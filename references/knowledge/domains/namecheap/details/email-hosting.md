# Private Email (custom-domain mailbox)

## What it is

Branded email on `@example-marketplace.com` (or whichever domain). Standard IMAP/POP3/SMTP — works in Apple Mail, Gmail, Outlook, mobile clients.

## Pricing (2026-04-25)

| Plan | Cost | Includes |
|---|---|---|
| **Starter** | **$14.88/year** | 1 mailbox, 5GB email, 2GB file, 10 aliases |
| Pro | higher | more mailboxes/storage |
| Ultimate | higher | full suite |

**Limitation noted by gemini-cli:** lacks full Exchange ActiveSync — mobile contacts/calendar sync is partial.

## Cheapest alternatives

| Need | Free / cheap alt |
|---|---|
| Forward `contact-d159caf06f@example.invalid` → Gmail | **Cloudflare Email Routing** — $0 forever, custom domain supported |
| Send/receive on custom domain | **Zoho Mail Free** — 5 users, 5GB each, web-only (no IMAP on free) |
| Full IMAP + multi-mailbox | Google Workspace Business Starter $7.20/user/mo — pricier but Workspace ecosystem |

## Decision for Example Marketplace

**MEDIUM relevance** — professional email is a trust signal for service businesses, but not a launch blocker.

**Practical path:** use Cloudflare Email Routing to forward `contact-d159caf06f@example.invalid` to your existing Gmail. Free forever. Set up takes 5 minutes. Upgrade to Zoho or Workspace only when actual customer email volume justifies it.

## L4 pointers

- [Namecheap Private Email plans](https://www.namecheap.com/hosting/email/)
- [Cloudflare Email Routing](https://www.cloudflare.com/products/email-routing/)
- [Zoho Mail Free](https://www.zoho.com/mail/)

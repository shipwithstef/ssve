# Area: Emails

The `Emails` class provides the core capability of sending transactional emails via Resend. It is accessed via `resend.emails.send()`.

## Mechanism
- **Content:** The payload must include `from`, `to`, `subject`, and exactly ONE of the following content formats:
  - `html: string`
  - `text: string`
  - `react: React.ReactNode` (the Node SDK handles `render()` under the hood)
  - `template: { id: string; variables?: Record<string, string | number> }`
- **Optional fields:** `attachments[]`, `bcc`, `cc`, `replyTo`, `tags[]` (name/value pairs), `topicId`, `scheduledAt` (ISO 8601 string for delayed sending).
- **Options:** The second argument accepts options like `headers` (custom HTTP headers) and `idempotencyKey` to prevent duplicate emails from accidental retries.

## Analysis
- **React Rendering:** The React capability is incredibly powerful for Next.js/React developers because they do not have to mess with Handlebars or raw HTML strings. The `resend.emails.send` method awaits `render(react)` asynchronously behind the scenes.
- **Idempotency:** The `idempotencyKey` is essential for background jobs (like CRONs or queue processors) that might retry. It ensures the email is only sent once within a 24-hour period.
- **Attachments:** Files can be sent as raw Base64 strings (`content`), Buffers, or remote URLs (`path`). They can be inlined using `contentId` (cid).

## L4 Pointers
- `src/emails/interfaces/create-email-options.interface.ts`
- `src/emails/emails.ts`

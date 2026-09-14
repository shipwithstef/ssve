# Area: Batch Sending

The `Batch` class (`resend.batch.send()`) allows sending multiple distinct emails in a single API call to `POST /emails/batch`.

## Mechanism
- **Payload:** Accepts an array of `CreateBatchOptions` (which are essentially `CreateEmailOptions`). Max 50 emails per batch.
- **Options:** Accepts `batchValidation: 'strict' | 'loose'` via headers (`x-batch-validation`).
  - Strict: Entire batch fails if one email payload is invalid.
  - Loose: Valid emails are sent, and the API returns errors for the invalid ones in the response array.
- **React Support:** Similar to single emails, if `react` is present in any batch payload, the SDK individually renders each one to HTML before sending the POST request.

## Analysis
- **Rate Limit Optimization:** Since Resend defaults to 5 QPS, batch sending is critical when processing a large queue of marketing emails or notifications. Instead of 50 separate requests hitting the rate limit, it consumes only 1 request.
- **Validation Flexibility:** Setting `batchValidation: 'loose'` is highly recommended when sending notifications to many users where user-generated data (like malformed email addresses) might cause individual payload validation failures.

## L4 Pointers
- `src/batch/batch.ts`
- `src/batch/interfaces/create-batch-options.interface.ts`

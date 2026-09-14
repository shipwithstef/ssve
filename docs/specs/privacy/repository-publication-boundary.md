# Repository publication and privacy boundary

This repository contains only the reusable SSVE framework. Product codebases, identifiable customer projects, company operations, funding applications, personal contact datasets, raw session transcripts, local machine paths, and temporary research captures belong outside this repository.

## Allowed identity

- Commit author and committer: `s7an-it <angelovsan@gmail.com>`.
- Examples and test fixtures must use IANA-reserved domains such as `example.com`, `example.test`, or `example.invalid`.
- Reusable product examples use `Example Marketplace`, `example-marketplace`, `Example Company`, and `example-org`; they never name the source project or company.

## Prohibited tracked data

- Alternate contributor aliases or their account-linked email addresses.
- Personal telephone numbers, government identifiers, private addresses, credentials, tokens, private keys, or production secrets.
- Identifiable product/company names, repositories, URLs, worktree paths, product-only work items, screenshots, marketing assets, or implementation evidence.
- Absolute paths containing a real workstation username.
- Raw `scratch/`, session transcripts, generated review payloads, or local backup files.
- Company or product records that are not required to operate SSVE.

## Enforcement

Run `node scripts/audit-repository-privacy.mjs`. Before publishing a replacement history, add `--history-root` to require one canonical root commit and canonical author/committer metadata.

Suspected personal data is quarantined into the private recovery archive; it is never printed into audit output. GitHub caches, forks, clones, and pull-request objects require separate platform-level handling.

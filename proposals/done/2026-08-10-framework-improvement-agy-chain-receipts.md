# Framework improvement: truthful AGY chain receipts

**Status:** ACCEPTED
**Accepted WI:** WI-529
**Severity:** high

## Gap

The v2 reviewer topology correctly routes independent Google review through AGY, but the legacy `review-plan` and `review-exec` receipt schemas reject `agy` as a reviewer host. A truthful review therefore cannot close the mandatory chain without being mislabeled as Gemini CLI.

This proposal covers one gap only: accept AGY as a first-class receipt host while retaining existing receipt compatibility and the mechanical Google-family fence.

## Acceptance criteria

- AGY is valid in primary and fallback reviewer fields for plan and execution receipts.
- `familyOf("agy")` remains `google`; cross-family review rules remain unchanged.
- Legacy `gemini` receipts remain readable; active v2 routing continues to use AGY.
- A focused mutation proves unknown hosts are still rejected.

## Route

Framework contract change: full mandatory chain under WI-529.

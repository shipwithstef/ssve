# Execution record: WI-42

All five acceptance criteria are implemented and tested; `node --test` passes.

| AC | Implementation | Test |
|---|---|---|
| AC1 | `issue()` in src/giftcards.mjs | test/giftcards.test.mjs "issues a card" |
| AC2 | `redeem()` in src/giftcards.mjs | "redeem keeps the remainder" |
| AC3 | expiry checked in `redeem()` | "expired cards are rejected" |
| AC4 | `redeem()` is atomic | "concurrent redemptions" |
| AC5 | `redeem()` rejects unknown codes | "unknown code" |

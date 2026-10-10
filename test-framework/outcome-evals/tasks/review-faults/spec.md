# Change under review

This change adds bookings with payments, owner sessions and receipt downloads to a class studio's backend. The new code is everything in `src/`; `test/` holds the tests that came with it (they pass).

Acceptance criteria the change must meet:

- AC1: a class never has more paid bookings than its capacity.
- AC2: a booking is refunded at most once, even when refund requests arrive at the same time.
- AC3: only a valid, unexpired owner token grants owner access.
- AC4: a customer can download only their own receipts; no request can read any other file.

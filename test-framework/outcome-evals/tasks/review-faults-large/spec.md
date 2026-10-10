# Change under review

This change adds bookings, cancellations with refunds, a waitlist, an owner revenue report and a session-authenticated JSON API to a class studio's backend. The new code is everything in `src/`; `test/` holds the tests that came with it (they pass). The payment gateway is injected (`payments.charge`, `payments.refund`).

Acceptance criteria:

- AC1: only the customer who made a booking can cancel it.
- AC2: cancelling 12 hours or more before the class starts refunds in full; later cancellations are not refunded.
- AC3: a seat freed before the class starts goes to the waitlist: the first customer is charged and booked; if their charge fails they are dropped and the next is tried, until the seat is filled or the waitlist is empty. A seat freed after the class has started is not offered.
- AC4: a class never has more paid bookings than its capacity, even when bookings arrive at the same time.
- AC5: the revenue report gives each studio day's revenue net of refunds.
- AC6: sessions expire 8 hours after login; owner routes require the owner role.

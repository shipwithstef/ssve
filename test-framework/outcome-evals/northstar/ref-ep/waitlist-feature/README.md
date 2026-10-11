# Studio bookings

Bookings for a class studio, with a waitlist for full classes. Money is integer cents.

- `src/bookings.mjs`: `book`, `cancel`, `joinWaitlist`, `leaveWaitlist`, `waitlistView`.
- `src/payments.mjs`: the payment gateway interface (`charge` rejects when a card is declined).
- `src/server.mjs`: `createServer(store, payments)`, the HTTP routes, including `GET /classes/:id/waitlist`.

When a paid booking is cancelled, the first customer on the waitlist is charged and booked;
a failed charge removes that customer and the next one is tried.

## Test

    node --test

Runs the tests in `test/` with the Node test runner. There is nothing to install.

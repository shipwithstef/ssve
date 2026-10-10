# Plan: waitlist for full classes (FEATURE.md)

Step 1 (AC1). In src/bookings.mjs add `waitlist: []` to each class in `addClass` and export `joinWaitlist(store, classId, userId)`, which throws "class has space" when `paidCount(store, classId) < capacity` and otherwise appends the user once.
Verify: create test/waitlist.test.mjs; `node --test test/waitlist.test.mjs` exits 0, with tests for joining a full class, joining a class with space (rejected) and joining twice (stored once).

Step 2 (AC2). In src/bookings.mjs `cancel(store, bookingId, payments)`: after marking the booking cancelled, shift the first user off the class waitlist and book them (a paid booking, as `book` creates) after charging the class price with `chargeCustomer(userId, cents)` imported from src/billing.mjs.
Verify: `node --test test/waitlist.test.mjs` exits 0, with a test that cancelling a booking in a full class books the first waitlisted user.

Step 3 (AC4). In src/bookings.mjs export `leaveWaitlist(store, classId, userId)`, which removes the user and is a no-op when absent.
Verify: `node --test test/waitlist.test.mjs` exits 0, with tests for leaving and for leaving when absent.

Step 4 (AC5). In src/server.mjs add `GET /classes/:id/waitlist`, returning `waitlistView(store, classId)` from step 5 as JSON.
Verify: create test/server.test.mjs; `node --test test/server.test.mjs` exits 0, with a test that starts the server on a free port and checks the route returns the waitlist in order.

Step 5 (AC5). In src/bookings.mjs export `waitlistView(store, classId)`, which returns the waitlist as `[{ position, userId }]`.
Verify: check that the output looks right.

Step 6. Add src/email.mjs and send an email to each customer promoted from a waitlist, with an unsubscribe link.
Verify: create test/email.test.mjs; `node --test test/email.test.mjs` exits 0, with a test that a promotion sends one email.

Done when every step's verification passes.

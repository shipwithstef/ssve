# Feature: waitlist for full classes

- AC1: when a class is full, a customer can join its waitlist; joining is rejected while the class has space.
- AC2: when a paid booking is cancelled, the first customer on the waitlist is charged the class price and booked.
- AC3: if charging that customer fails, they are removed from the waitlist and the next customer is tried, until one succeeds or the waitlist is empty.
- AC4: a customer can leave a waitlist.
- AC5: `GET /classes/:id/waitlist` returns a class's waitlist in order.

## Interface

In `src/bookings.mjs`:
- `joinWaitlist(store, classId, userId)`: throws an Error whose message contains "class has space" when the class is not full; adding the same user twice keeps one entry.
- `leaveWaitlist(store, classId, userId)`: removes the user; a no-op when absent.
- `waitlistView(store, classId)`: returns `[{ position, userId }]`, positions starting at 1.
- `cancel(store, bookingId, payments)`: async; marks the booking cancelled, then fills the seat from the waitlist (AC2, AC3). A promoted customer gets a paid booking like `book` creates.

In `src/server.mjs`, `createServer(store, payments)` serves `GET /classes/:id/waitlist` as JSON (the `waitlistView` array).

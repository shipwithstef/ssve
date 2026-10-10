# Feature: waitlist for full classes

- AC1: when a class is full, a customer can join its waitlist; joining is rejected while the class has space.
- AC2: when a paid booking is cancelled, the first customer on the waitlist is charged and booked.
- AC3: if charging that customer fails, they are removed from the waitlist and the next customer is tried, until one succeeds or the waitlist is empty.
- AC4: a customer can leave a waitlist.
- AC5: `GET /classes/:id/waitlist` returns a class's waitlist in order.

Scope: the domain functions in src/bookings.mjs plus the AC5 route. Customer-facing routes for joining and leaving are a later work item.

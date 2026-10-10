# Studio booking service: behaviour contract

- C1: Passwords are stored as scrypt hashes with a per-user random salt.
- C2: A login session expires 8 hours after it is created.
- C3: A customer may hold at most 3 upcoming bookings at once.
- C4: Cancelling less than 12 hours before a class starts gives no refund; earlier cancellations are refunded in full.
- C5: A payment webhook event whose id has already been seen is ignored.
- C6: All prices and amounts are integer cents.

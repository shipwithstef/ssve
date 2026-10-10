# Security review: payments

`src/` is the payment path of a class-booking product (checkout, provider webhook, refunds). Customers are authenticated before these functions are called (`user` is the logged-in customer). Review it for security defects before it ships.

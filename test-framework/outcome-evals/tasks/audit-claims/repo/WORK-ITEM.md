# WI-42: gift cards

- AC1: `issue()` creates a gift card with a balance in integer cents and a unique 12-character code.
- AC2: redeeming applies the card's balance to a booking price and returns what is still owed; the card keeps any remainder.
- AC3: a gift card expires 12 months after issue; redeeming an expired card is rejected.
- AC4: two redemptions of the same card at the same time can never spend more than its balance.
- AC5: redeeming an unknown code is rejected with "unknown gift card".

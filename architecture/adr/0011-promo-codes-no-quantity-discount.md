# ADR 0011: Promo codes replace the multi-belt discount

Status: accepted (owner, 2026-10-09). Amends ADR 0008 (order API) and ADR 0010 (admin).

## Context
The store applied an automatic multi-belt discount (2nd belt 25% off, 3rd 35% off). The owner withdrew it and asked
for a promo code field at checkout instead, with codes he creates himself and offers that may change every week.

## Decision
- **No automatic discount.** `calculateTotals` takes an optional fixed `promoAmount`; without a code the belts are
  full price. The discount never exceeds the belts subtotal and never touches shipping; free standard shipping is
  judged on the amount after the discount.
- **Codes are a fixed amount** (the owner's choice), stored in D1 table `promo_codes` (migration 0003): code (upper
  case, A-Z and digits, 3 to 20), amount, optional minimum belts subtotal, optional use limit, optional last day,
  active flag, use count. Codes are never deleted or reused, so an old order's code always means the same thing.
- **Rules live in `@platform/commerce` (`promo.ts`)**: normalising what the customer typed, why a code cannot be used
  (`invalid_promo`, `promo_expired`, `promo_used_up`, `promo_min_subtotal`; a switched-off code is reported to the
  customer as `invalid_promo`), and validating a new code from the admin (amount capped at 5,000 EGP against typos).
- **The API decides.** `GET /api/promo?code=` is a preview for the cart (amount and minimum, never the use count).
  `POST /api/orders` checks the code again, applies it, stores `orders.promo_code`, and counts one use in the same
  D1 batch as the order. A named `CHECK (promo_not_overused)` makes the order fail as a whole if the last use was
  taken meanwhile (`422 promo_used_up`). Cancelling an order does not give the use back.
- **Admin**: a "promo codes" tab lists codes with their use count, creates a code, and switches a code off or on.
  The last day is chosen as a date and ends at midnight Cairo time.
- **Policies**: the terms describe promo codes in general (one per order, conditions announced with the code, not
  exchangeable for money, proportional split on partial returns), so weekly offers need no policy change.

## Consequences
- Migration 0003 must be applied to D1 before this code is deployed (`/api/health` answers 503 until then).
- Old orders keep their stored discount; the `discount` column now means "promo discount" for new orders.
- Promo codes can be guessed if they are simple words. They are low-value fixed amounts, the rate-limiting rule on
  the API applies, and the owner can switch a code off at any time.

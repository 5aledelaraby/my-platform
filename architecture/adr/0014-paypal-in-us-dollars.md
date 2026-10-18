# ADR 0014: PayPal checkout in US dollars

Date: 2026-10-18. Status: accepted (owner).

## Context

The owner asked for online payment (2026-10-18). An Egyptian card gateway (Paymob, Kashier) needs company papers and
a company bank account, which the owner cannot arrange from abroad now. He has a PayPal business account registered in
Egypt. PayPal does not accept Egyptian pounds. The owner chose: an automatic PayPal button that marks the order paid, a
fixed dollar rate he sets in the admin, and PayPal's fees paid by the store, not the customer.

## Decision

- `paypal` is a third payment method next to `cod` and `instapay` (`@platform/commerce`). The order is placed as usual
  (stock taken, Telegram, Meta Purchase); the customer then pays on the thank-you page with PayPal's buttons
  (`apps/website/src/scripts/paypal.ts`, PayPal's script loaded only there, only for a PayPal order).
- Amounts: the rate is piasters per dollar (`settings.usd_rate`, admin tab "PayPal", 10 to 1000 EGP). Dollars are
  integer cents, `toUsdCents` rounds up to the cent. The API computes the amount from the stored order and the rate;
  the browser sends only ids. The cart and the thank-you page show the same figure as a preview.
- API (`apps/api/src/handler.ts`, `paypal.ts`): `GET /paypal/config` (on only with credentials and a rate),
  `POST /paypal/orders` makes a PayPal order (`custom_id` = our order id) and records it and its amount on the order,
  `POST /paypal/capture` checks the PayPal order at PayPal first (our id, USD, the recorded amount) and only then takes
  the money, and marks the order paid only for the PayPal order recorded for it. A capture PayPal holds for review
  ("pending") is not marked paid; the owner gets a Telegram message either way.
- Credentials are set by the owner in the vicuna-api dashboard, never in git: the live site uses `PAYPAL_CLIENT_ID`
  (Text) and `PAYPAL_CLIENT_SECRET` (Secret); staging uses only the sandbox pair `PAYPAL_SANDBOX_CLIENT_ID` and
  `PAYPAL_SANDBOX_CLIENT_SECRET`, so a test never takes real money. Without its pair, a site shows no PayPal.
- Storage (migration 0006): `payment_method` keeps its CHECK; a PayPal order stores `'instapay'` (paid in advance,
  never cash on delivery) with `paypal = 1`, read back as `paypal`, like pickup in 0005. New columns
  `paypal_order_id`, `paypal_usd_cents`, `paypal_capture_id`, `paid_at`, and a `settings` table.
- The admin shows "PayPal: paid / not paid yet" on each PayPal order. Refunds are made by the owner in PayPal; the admin
  reminds him when he cancels a paid order. An unpaid PayPal order keeps its stock until the owner cancels it.

## Consequences

- Customers can pay online now, in dollars, with a PayPal account (and with a card where PayPal offers it to the
  buyer). The dollar price moves only when the owner changes the rate.
- An Egyptian card gateway in pounds stays the better option for most customers; it can be added later as another
  method without changing this one.

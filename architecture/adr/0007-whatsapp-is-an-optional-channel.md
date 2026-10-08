# ADR 0007: WhatsApp is an optional channel, not the order system

Status: accepted (phase 1 scope). Open owner decision: whether WhatsApp ordering is switched on at launch.

## Context
The legacy site turned the cart into a WhatsApp message. That tied the idea of "an order" to one channel. The platform is meant to grow (admin, payments, other channels) without reworking pricing or cart logic.

## Decision
- Products, cart, prices, discounts and shipping are domain logic in `@platform/commerce`. They know nothing about WhatsApp or any other channel.
- WhatsApp is a simple, optional customer-facing option: a plain link that opens a chat with a prepared message built from the cart. In phase 1 it is only a link. It does not store anything, has no order number, no status.
- Phase 1 does NOT include a Worker/API, a database (D1), an admin dashboard, or online payment.
- Later, order creation may be added as an API. An order is then created first (with a snapshot of prices and discount), and a separate step decides what happens next: a success page, WhatsApp, email, or online payment. Each of those is "after the order", never the order itself.
- No speculative abstractions (channel interfaces, plugin systems) are built now. This ADR records the decision; code is written when a second channel actually exists.

## Consequences
- Without an API and without online payment, the cart alone cannot complete a purchase. In phase 1 the only way for a customer to finish is the WhatsApp link (or the site acts as a catalogue). Whether to switch it on at launch is a business decision for the owner.
- Removing or replacing WhatsApp later does not touch pricing, cart or product code.
- The legacy Meta CAPI Worker is a tracking relay, not part of the order system; it stays deferred (see MIGRATION.md).

# ADR 0003: Money is integer piasters; pricing logic has one home

Status: accepted

## Context
The legacy site computed prices in whole pounds with floats (`Math.round(price * 0.35)`), duplicated in the browser only. Server-side order validation would need the same rules.

## Decision
- All domain money values are integer piasters (`Piasters`). Floats never enter domain code.
- Discount rates are integer basis points (`[0, 2500, 3500]`).
- `@platform/commerce` is the only place that computes subtotal, discount, shipping and total. Browser cart and Workers both call it.
- Orders persist a snapshot of the computed totals and unit prices.

## Consequences
- A test asserts byte-for-byte parity with the legacy discount on every combination of the current catalogue prices (120, 200, 300 EGP).
- Odd prices (such as 150) would round per unit in piasters rather than pounds; this is intended and covered by the integer rules.

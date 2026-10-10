# ADR 0012: Four designs, and product ids that name them

Date: 2026-10-10. Status: accepted (owner's decision).

## Context

The catalogue had six styles (lace, wide-bow, thin-tie, croc, snake, ruffle) and product ids from the old site (`bow-*`, `sash-*`, `twist-*`, `classic-*`, `croc-*`, `snake-*`, some ending in `-suede`). The owner explained that Vicuna makes four designs: the bow, the twist and the knot are only ways of tying the same wide belt, croc and snake are prints on the thin-tie belt, and every belt is PU leather (no suede). He asked for the store, the stock admin and the orders to use the same names from the first page to delivery.

## Decision

- Four styles: `wide-tie` (عريض برباط عريض), `thin-tie` (عريض برباط رفيع), `ruffle`, `lace`.
- Every product id is `<design>-<pattern?>-<colour>`, e.g. `wide-tie-white`, `thin-tie-croc-black`. A test checks the prefix.
- Croc and snake keep their price through the per-product `price` override in the catalogue (`priceOf` in `@platform/commerce`).
- This is a one-time rename before launch (the store is only on staging, nothing is indexed), done as an exception to ADR 0004. Migration `0004_design_product_ids.sql` moves the ids already stored in D1 (`inventory`, `order_items`); order snapshots keep their names and prices. From here on, ADR 0004 applies again: ids do not change.

## Consequences

- Product images and look photos are renamed to the new ids.
- Carts saved in a browser with an old id drop that line (unknown products are ignored), which is acceptable before launch.

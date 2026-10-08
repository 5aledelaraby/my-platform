import data from "../data/catalog.json" with { type: "json" };
import type { Piasters } from "./money.ts";

export interface CatalogStyle {
  id: string;
  name: string;
  /** Piasters. Every product in the style costs this. */
  price: Piasters;
  headline: string;
  intro: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  style: string;
  color: string;
  hex: string;
  texture: string;
  isNew?: boolean;
}

export interface PricedProduct {
  id: string;
  name: string;
  unitPrice: Piasters;
}

export type PriceLookup = (productId: string) => PricedProduct | undefined;

export const catalog = data as {
  styles: CatalogStyle[];
  colors: Array<{ id: string; name: string; hex: string }>;
  products: CatalogProduct[];
};

const stylePrice = new Map(catalog.styles.map((s) => [s.id, s.price]));
const byId = new Map<string, PricedProduct>(
  catalog.products.map((p) => [p.id, { id: p.id, name: p.name, unitPrice: stylePrice.get(p.style) ?? Number.NaN }]),
);

/** Authoritative server-side price lookup. Prices never come from the client. */
export const lookupProduct: PriceLookup = (productId) => byId.get(productId);

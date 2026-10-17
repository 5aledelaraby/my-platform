// The product feed for Meta (Commerce Manager, "Vicuna designs catalog") and Google Merchant Center, served at
// /catalog/products.csv like on the old site, with the same columns. Product ids are the catalogue ids, the same ids
// the Pixel sends as content_ids and the product pages use as sku, so catalog ads match each visitor's belts.
// Every row is "in stock": the site Worker drops sold-out rows when it serves the file (ADR 0013).
import { PIASTERS_PER_EGP, catalog, priceOf } from "@platform/commerce";
import type { CatalogProduct } from "@platform/commerce";

export const FEED_PATH = "/catalog/products.csv";
export const FEED_HEADER = [
  "id", "title", "description", "availability", "condition", "price", "link", "image_link", "additional_image_link",
  "brand", "google_product_category", "fb_product_category", "product_type", "item_group_id", "color", "material", "gender", "age_group",
  "identifier_exists",
] as const;

/**
 * Vicuna makes its own belts, which carry no GTIN (barcode) or MPN (owner, 2026-10-17), so the feed says so
 * ("identifier_exists = no"), as Google Merchant Center asks for products without manufacturer identifiers.
 */
const IDENTIFIER_EXISTS = "no";

/** Designs kept off the ad catalogue and sold on the site only (owner, 2026-10-16: "Signature pattern"). */
export const NOT_IN_FEED: ReadonlySet<string> = new Set(["pattern"]);

const cell = (v: string | number) => `"${String(v).replace(/"/g, '""').replace(/\s+/g, " ").trim()}"`;

export interface FeedOptions {
  siteUrl: string;
  brand: string;
  productUrl: (p: CatalogProduct) => string;
}

export function buildFeedCsv(o: FeedOptions): string {
  const styles = new Map(catalog.styles.map((s) => [s.id, s]));
  const colours = new Map(catalog.colors.map((c) => [c.id, c.name]));
  const rows = catalog.products.filter((p) => !NOT_IN_FEED.has(p.style)).map((p) => {
    const st = styles.get(p.style);
    if (!st) throw new Error(`Unknown style ${p.style}`);
    // "رباط رفيع كروكو أسود" -> "حزام عريض برباط رفيع كروكو أسود"; "دانتيل أسود" -> "حزام دانتيل أسود"
    const shade = p.name.replace(/^رباط (?:عريض|رفيع) /, "").replace(new RegExp(`^${st.name} `), "");
    return [
      p.id,
      `حزام ${st.name} ${shade}`,
      `${st.headline}. ${st.intro}`,
      "in stock",
      "new",
      `${(priceOf(p) / PIASTERS_PER_EGP).toFixed(2)} EGP`,
      o.productUrl(p),
      `${o.siteUrl}/catalog/img/${p.id}.jpg`,
      "",
      o.brand,
      "169",
      "Clothing & Accessories > Accessories > Belts",
      `Belts > ${st.name}`,
      p.style,
      colours.get(p.color) ?? p.color,
      "جلد PU",
      "female",
      "adult",
      IDENTIFIER_EXISTS,
    ]
      .map(cell)
      .join(",");
  });
  return [FEED_HEADER.join(","), ...rows].join("\n") + "\n";
}

/**
 * Local inventory for Google Merchant Center (free local listings, owner 2026-10-17): the same belts and the same
 * single stock as the website, offered for pickup at Vicuna in Nasr City. `store_code` must equal the store code set on
 * the Google Business Profile (Edit profile > Store code). The id stays the first column so feedWithStock() drops the
 * sold-out rows here too.
 */
export const LOCAL_FEED_PATH = "/catalog/local-inventory.csv";
export const STORE_CODE = "01706577143159247027";
export const LOCAL_FEED_HEADER = ["id", "store_code", "availability", "price", "pickup_method", "pickup_sla"] as const;

export function buildLocalInventoryCsv(): string {
  const rows = catalog.products
    .filter((p) => !NOT_IN_FEED.has(p.style))
    .map((p) => [p.id, STORE_CODE, "in_stock", `${(priceOf(p) / PIASTERS_PER_EGP).toFixed(2)} EGP`, "reserve", "multi-day"].map(cell).join(","));
  return [LOCAL_FEED_HEADER.join(","), ...rows].join("\n") + "\n";
}

/** Drops the rows of sold-out products (tracked at zero), so Meta and Google stop showing them until restocked. */
export function feedWithStock(csv: string, isSoldOut: (id: string) => boolean): string {
  return csv
    .split("\n")
    .filter((line, i) => {
      if (i === 0 || line === "") return true;
      const id = /^"([^"]*)"/.exec(line)?.[1];
      return !(id && isSoldOut(id));
    })
    .join("\n");
}

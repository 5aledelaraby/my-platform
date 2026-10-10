// The product feed for Meta (Commerce Manager, "Vicuna designs catalog") and Google Merchant Center, served at
// /catalog/products.csv like on the old site, with the same columns. Product ids are the catalogue ids, the same ids
// the Pixel sends as content_ids and the product pages use as sku, so catalog ads match each visitor's belts.
// Built as "in stock"; the site Worker marks sold-out rows when it serves the file (ADR 0013).
import { PIASTERS_PER_EGP, catalog, priceOf } from "@platform/commerce";
import type { CatalogProduct } from "@platform/commerce";

export const FEED_PATH = "/catalog/products.csv";
export const FEED_HEADER = [
  "id", "title", "description", "availability", "condition", "price", "link", "image_link", "additional_image_link",
  "brand", "google_product_category", "fb_product_category", "product_type", "item_group_id", "color", "material", "gender", "age_group",
] as const;
const AVAILABILITY_COL = FEED_HEADER.indexOf("availability");

const cell = (v: string | number) => `"${String(v).replace(/"/g, '""').replace(/\s+/g, " ").trim()}"`;

export interface FeedOptions {
  siteUrl: string;
  brand: string;
  productUrl: (p: CatalogProduct) => string;
  /** Products that also have an on-body photo (public/catalog/img/<id>-look.jpg). */
  hasLook: (p: CatalogProduct) => boolean;
}

export function buildFeedCsv(o: FeedOptions): string {
  const styles = new Map(catalog.styles.map((s) => [s.id, s]));
  const colours = new Map(catalog.colors.map((c) => [c.id, c.name]));
  const rows = catalog.products.map((p) => {
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
      o.hasLook(p) ? `${o.siteUrl}/catalog/img/${p.id}-look.jpg` : "",
      o.brand,
      "169",
      "Clothing & Accessories > Accessories > Belts",
      `Belts > ${st.name}`,
      p.style,
      colours.get(p.color) ?? p.color,
      "جلد PU",
      "female",
      "adult",
    ]
      .map(cell)
      .join(",");
  });
  return [FEED_HEADER.join(","), ...rows].join("\n") + "\n";
}

/** Marks the rows of sold-out products (tracked at zero) as "out of stock". Other rows are unchanged. */
export function feedWithStock(csv: string, isSoldOut: (id: string) => boolean): string {
  return csv
    .split("\n")
    .map((line, i) => {
      if (i === 0 || line === "") return line;
      const id = /^"([^"]*)"/.exec(line)?.[1];
      if (!id || !isSoldOut(id)) return line;
      const cells = line.split('","');
      if (cells[AVAILABILITY_COL] !== "in stock") return line;
      cells[AVAILABILITY_COL] = "out of stock";
      return cells.join('","');
    })
    .join("\n");
}

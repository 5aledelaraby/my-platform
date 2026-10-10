/**
 * JSON-LD builders. Deliberately minimal and honest:
 * - there is NO aggregateRating / review support. Never add fake ratings (see AGENTS.md, ADR 0005).
 * - prices are passed in major units (pounds) because schema.org expects decimal prices;
 *   convert from piasters at the call site.
 */

export type JsonLd = Record<string, unknown>;

export interface PostalAddressInput {
  streetAddress: string;
  addressLocality: string;
  addressRegion?: string;
  postalCode?: string;
  /** ISO 3166-1 alpha-2, e.g. "EG". */
  addressCountry: string;
}

export interface OrganizationInput {
  name: string;
  /** The registered company name. */
  legalName?: string;
  url: string;
  logo: string;
  email?: string;
  telephone?: string;
  address?: PostalAddressInput;
  /** Only the brand's own official profiles. */
  sameAs?: readonly string[];
}

export function organizationJsonLd(input: OrganizationInput): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.name,
    url: input.url,
    logo: input.logo,
    ...(input.legalName ? { legalName: input.legalName } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.telephone ? { telephone: input.telephone } : {}),
    ...(input.address ? { address: { "@type": "PostalAddress", ...input.address } } : {}),
    ...(input.sameAs?.length ? { sameAs: [...input.sameAs] } : {}),
  };
}

export interface WebSiteInput {
  name: string;
  url: string;
  /** BCP 47 language of the site, e.g. "ar". */
  language: string;
}

/** WebSite data. No SearchAction: the site has no search page, and Google needs a real one. */
export function websiteJsonLd(input: WebSiteInput): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: input.name,
    url: input.url,
    inLanguage: input.language,
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbJsonLd(items: readonly BreadcrumbItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface ProductInput {
  name: string;
  description: string;
  url: string;
  images: readonly string[];
  sku: string;
  brand: string;
  /** Price in pounds (major units), e.g. 200. */
  price: number;
  currency: string;
  inStock: boolean;
  /** Flat shipping rates for one item, in major units, to a country (ISO 3166-1 alpha-2). */
  shipping?: ReadonlyArray<{ rate: number; country: string }>;
  /** Return window in days from delivery, for a country; freeReturn = the shop pays the return shipping. */
  returnPolicy?: { country: string; days: number; freeReturn: boolean };
}

export function productJsonLd(input: ProductInput): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description,
    image: [...input.images],
    sku: input.sku,
    brand: { "@type": "Brand", name: input.brand },
    offers: {
      "@type": "Offer",
      url: input.url,
      price: input.price.toFixed(2),
      priceCurrency: input.currency,
      availability: input.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      ...(input.shipping?.length
        ? {
            shippingDetails: input.shipping.map((s) => ({
              "@type": "OfferShippingDetails",
              shippingRate: { "@type": "MonetaryAmount", value: s.rate.toFixed(2), currency: input.currency },
              shippingDestination: { "@type": "DefinedRegion", addressCountry: s.country },
            })),
          }
        : {}),
      ...(input.returnPolicy
        ? {
            hasMerchantReturnPolicy: {
              "@type": "MerchantReturnPolicy",
              applicableCountry: input.returnPolicy.country,
              returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
              merchantReturnDays: input.returnPolicy.days,
              returnFees: input.returnPolicy.freeReturn ? "https://schema.org/FreeReturn" : "https://schema.org/ReturnShippingFees",
            },
          }
        : {}),
    },
  };
}

export interface ArticleInput {
  headline: string;
  description: string;
  url: string;
  images: readonly string[];
  datePublished: string;
  dateModified?: string;
  authorName: string;
  /** Use "Organization" when the brand, not a named person, is the author. */
  authorType?: "Person" | "Organization";
  publisherName: string;
  publisherLogo: string;
}

export function articleJsonLd(input: ArticleInput): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.headline,
    description: input.description,
    mainEntityOfPage: input.url,
    image: [...input.images],
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    author: { "@type": input.authorType ?? "Person", name: input.authorName },
    publisher: {
      "@type": "Organization",
      name: input.publisherName,
      logo: { "@type": "ImageObject", url: input.publisherLogo },
    },
  };
}

/**
 * Serialize for embedding inside <script type="application/ld+json">.
 * Escapes characters that could close the script tag or break the HTML parser.
 */
export function serializeJsonLd(data: JsonLd | readonly JsonLd[]): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028")
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029");
}

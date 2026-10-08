export interface ArticleFrontmatter {
  title: string;
  /** Meta description, 50-170 characters recommended. */
  description: string;
  /** URL slug, lowercase latin letters, digits and hyphens. Changing it later requires a redirect (ADR 0004). */
  slug: string;
  /** ISO date YYYY-MM-DD. */
  datePublished: string;
  dateModified?: string;
  image?: string;
  tags?: string[];
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function str(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`frontmatter.${key} must be a non-empty string`);
  }
  return value;
}

/** Validates unknown parsed frontmatter and returns a typed value. Throws with a clear message otherwise. */
export function parseArticleFrontmatter(input: unknown): ArticleFrontmatter {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TypeError("frontmatter must be an object");
  }
  const obj = input as Record<string, unknown>;
  const slug = str(obj, "slug");
  if (!SLUG.test(slug)) throw new TypeError(`frontmatter.slug "${slug}" must be lowercase latin letters, digits and hyphens`);
  const datePublished = str(obj, "datePublished");
  if (!ISO_DATE.test(datePublished)) throw new TypeError("frontmatter.datePublished must be YYYY-MM-DD");

  const result: ArticleFrontmatter = {
    title: str(obj, "title"),
    description: str(obj, "description"),
    slug,
    datePublished,
  };

  if (obj["dateModified"] !== undefined) {
    const dateModified = str(obj, "dateModified");
    if (!ISO_DATE.test(dateModified)) throw new TypeError("frontmatter.dateModified must be YYYY-MM-DD");
    result.dateModified = dateModified;
  }
  if (obj["image"] !== undefined) result.image = str(obj, "image");
  if (obj["tags"] !== undefined) {
    const tags = obj["tags"];
    if (!Array.isArray(tags) || !tags.every((t) => typeof t === "string")) {
      throw new TypeError("frontmatter.tags must be an array of strings");
    }
    result.tags = tags as string[];
  }
  return result;
}

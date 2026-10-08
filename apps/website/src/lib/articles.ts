// Articles live in /content/articles/*.md (source of truth). Frontmatter is validated at build time.
import { parseArticleFrontmatter } from "@platform/content";
import type { ArticleFrontmatter } from "@platform/content";

/** An Astro component rendered from Markdown. */
type MarkdownContent = (props: Record<string, never>) => unknown;

export interface Article extends ArticleFrontmatter {
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
  products: string[];
  Content: MarkdownContent;
}

interface MarkdownModule {
  frontmatter: Record<string, unknown>;
  Content: MarkdownContent;
}

const modules = import.meta.glob<MarkdownModule>("../../../../content/articles/*.md", { eager: true });

function load(): Article[] {
  const slugs = new Set<string>();
  const list = Object.entries(modules).map(([path, mod]) => {
    const meta = parseArticleFrontmatter(mod.frontmatter);
    if (slugs.has(meta.slug)) throw new Error(`Duplicate article slug "${meta.slug}"`);
    slugs.add(meta.slug);
    if (!path.endsWith(`/${meta.slug}.md`)) throw new Error(`Article file name must match its slug: ${path} vs ${meta.slug}`);
    const fm = mod.frontmatter;
    const num = (k: string): number => {
      const v = fm[k];
      if (typeof v !== "number") throw new TypeError(`${meta.slug}: frontmatter.${k} must be a number`);
      return v;
    };
    if (!meta.image) throw new TypeError(`${meta.slug}: frontmatter.image is required`);
    const alt = fm["imageAlt"];
    if (typeof alt !== "string" || alt === "") throw new TypeError(`${meta.slug}: frontmatter.imageAlt is required`);
    const products = Array.isArray(fm["products"]) ? (fm["products"] as unknown[]).map(String) : [];
    return { ...meta, imageAlt: alt, imageWidth: num("imageWidth"), imageHeight: num("imageHeight"), products, Content: mod.Content };
  });
  return list.sort((a, b) => b.datePublished.localeCompare(a.datePublished));
}

export const articles: readonly Article[] = load();
export const getArticle = (slug: string): Article | undefined => articles.find((a) => a.slug === slug);
export const articleUrl = (slug: string): string => `/blog/${slug}/`;

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

// Articles live in /content/articles/*.md (source of truth). Frontmatter is validated at build time.
// Arabic and English guides share /journal/style-guides/. An article may name its version in the other language
// (`translation`, written on one side); the pages then link to each other and carry hreflang alternates.
import { parseArticleFrontmatter } from "@platform/content";
import type { ArticleFrontmatter, ArticleLang } from "@platform/content";
import { JOURNAL_PATH } from "../site.ts";
import { photoSrcset } from "./prose-images.ts";

/** An Astro component rendered from Markdown. */
type MarkdownContent = (props: Record<string, never>) => unknown;

export interface Article extends ArticleFrontmatter {
  /** Required for an article (checked when it loads). */
  image: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
  products: string[];
  /** Belt and design ids the article links to in its text (/collections/vicuna-belts/<id>/). */
  links: string[];
  Content: MarkdownContent;
}

interface MarkdownModule {
  frontmatter: Record<string, unknown>;
  Content: MarkdownContent;
  rawContent: () => string;
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
    const links = [...new Set([...mod.rawContent().matchAll(/\]\(\/(?:ar\/)?collections\/vicuna-belts\/([a-z0-9-]+)\/\)/g)].map((m) => m[1] ?? ""))];
    return { ...meta, image: meta.image, imageAlt: alt, imageWidth: num("imageWidth"), imageHeight: num("imageHeight"), products, links, Content: mod.Content };
  });
  return list.sort((a, b) => b.datePublished.localeCompare(a.datePublished));
}

/** Pairs each article with its version in the other language, both ways; a pair must be valid and unique. */
export function pairTranslations(list: readonly Pick<Article, "slug" | "lang" | "translation">[]): Map<string, string> {
  const bySlug = new Map(list.map((a) => [a.slug, a]));
  const pairs = new Map<string, string>();
  const link = (a: string, b: string) => {
    const was = pairs.get(a);
    if (was !== undefined && was !== b) throw new Error(`Article "${a}" is paired with both "${was}" and "${b}"`);
    pairs.set(a, b);
  };
  for (const a of list) {
    if (!a.translation) continue;
    const other = bySlug.get(a.translation);
    if (!other) throw new Error(`Article "${a.slug}": translation "${a.translation}" does not exist`);
    if (other.lang === a.lang) throw new Error(`Article "${a.slug}": translation "${other.slug}" is in the same language`);
    link(a.slug, other.slug);
    link(other.slug, a.slug);
  }
  return pairs;
}

export const articles: readonly Article[] = load();
const pairs = pairTranslations(articles);
export const getArticle = (slug: string): Article | undefined => articles.find((a) => a.slug === slug);
export const articleUrl = (slug: string): string => `${JOURNAL_PATH}${slug}/`;
export const articlesIn = (lang: ArticleLang): Article[] => articles.filter((a) => a.lang === lang);
/** The same article in the other language, if there is one. */
export const translationOf = (a: Pick<Article, "slug">): Article | undefined => {
  const slug = pairs.get(a.slug);
  return slug ? getArticle(slug) : undefined;
};
/**
 * Guides in `lang` that show these belts (frontmatter `products`) or link to their pages, most relevant first: `ids`
 * are in order of importance (the belt, then its design), and showing a belt counts more than linking to it.
 */
export function articlesAbout(lang: ArticleLang, ids: readonly string[]): Article[] {
  const score = (a: Article) =>
    ids.reduce((n, id, i) => n + (ids.length - i) * ((a.products.includes(id) ? 2 : 0) + (a.links.includes(id) ? 1 : 0)), 0);
  return articlesIn(lang)
    .map((a) => ({ a, n: score(a) }))
    .filter((x) => x.n > 0)
    .sort((x, y) => y.n - x.n)
    .map((x) => x.a);
}

export function formatDate(iso: string, lang: ArticleLang = "ar"): string {
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB";
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

/**
 * The smaller copies of an article's cover that exist (look photos have 400/640/800/1200 px copies), as a srcset, so a
 * phone downloads the size it shows. Empty when the cover has no copies. Build time only (reads public/).
 */
export const coverSrcset = (src: string): string => photoSrcset(src);

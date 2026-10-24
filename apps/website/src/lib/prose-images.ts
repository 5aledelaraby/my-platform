// Photos in the journal guides' text (Markdown) are written as plain "/img/...-1200.webp" links. At build time the
// article page (ProseImages.astro) gives each one the smaller copies that exist (400/640/800 px) as a srcset, so a phone
// downloads the size it shows, and makes it load lazily: the text photos sit below the cover, which loads first.
import { existsSync } from "node:fs";
import { join } from "node:path";

const WIDTHS = [400, 640, 800, 1200] as const;
/** How wide a photo in an article's text is shown (the article column is 780 px, with a 20 px margin on phones). */
export const PROSE_SIZES = "(min-width: 820px) 780px, calc(100vw - 40px)";

/**
 * The copies of a "-1200.webp" photo that exist in `publicDir`, as a srcset. Empty when the photo is not a 1200 px copy
 * or has no smaller ones. Build time only (reads the files).
 */
export function photoSrcset(src: string, publicDir: string = join(process.cwd(), "public")): string {
  if (!/^\/img\/[A-Za-z0-9._/-]+-1200\.webp$/.test(src)) return "";
  const at = (w: number) => src.replace(/-1200\.webp$/, `-${w}.webp`);
  const widths = WIDTHS.filter((w) => w === 1200 || existsSync(join(publicDir, at(w))));
  return widths.length > 1 ? widths.map((w) => `${at(w)} ${w}w`).join(", ") : "";
}

const attr = (tag: string, name: string): string | undefined => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

/**
 * Rewrites the photos in an article's rendered text (trusted HTML from content/articles): each becomes lazy, with a
 * srcset when smaller copies exist. Attributes the photo already has are kept.
 */
export function proseImagesHtml(html: string, publicDir?: string): string {
  return html.replace(/<img\b[^>]*>/g, (tag) => {
    const extra: string[] = [];
    const srcset = attr(tag, "srcset") === undefined ? photoSrcset(attr(tag, "src") ?? "", publicDir) : "";
    if (srcset) extra.push(`srcset="${srcset}"`, `sizes="${PROSE_SIZES}"`);
    if (attr(tag, "loading") === undefined) extra.push(`loading="lazy"`);
    if (attr(tag, "decoding") === undefined) extra.push(`decoding="async"`);
    return extra.length ? tag.replace(/\s*\/?>$/, ` ${extra.join(" ")}>`) : tag;
  });
}

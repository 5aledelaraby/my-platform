// Long browser caching for photos, films and the logo without ever showing an old file (Google PageSpeed, owner
// 2026-10-17: "cache lifetime of at least 30 days"). After the build, every /img/, /video/ and /brand/ file a page
// links to is copied to /v/<hash>/<same path>, where <hash> comes from the file's bytes, and the page links to that
// copy instead. /v/* is cached for a year (public/_headers): a replaced photo gets a new hash, so a new address,
// and visitors fetch it at once. The original addresses keep working with the short cache, for links this step
// does not rewrite (the cart script, og:image and other absolute URLs, outside links).
// Fonts too (2026-10-20, PageSpeed "efficient cache lifetimes"): the stylesheet written into every page and the font
// preload link point to /v/<hash>/fonts/..., so they are cached for a year like the photos.

/** Asset folders whose files are fingerprinted. */
export const FINGERPRINTED = ["img", "video", "brand", "fonts"] as const;
export const VERSIONED_PREFIX = "/v/";

/** A site-relative asset path in a page: in an attribute, a srcset list or a JSON string. */
const ASSET_PATH = /(?<=["'\s,(=])\/(?:img|video|brand|fonts)\/[A-Za-z0-9._/-]+\.(?:webp|jpe?g|png|avif|gif|svg|mp4|webm|woff2)(?=["'\s,)])/g;

/** The versioned address of a file whose content hash is `hash`. */
export function versionedPath(path: string, hash: string): string {
  return `${VERSIONED_PREFIX}${hash}${path}`;
}

/**
 * Rewrites every fingerprinted asset path in `html` to its versioned address. `hashOf` returns the file's hash, or
 * undefined when the file does not exist (the link is then left as it is). Returns the page and the paths it used.
 */
export function fingerprintHtml(html: string, hashOf: (path: string) => string | undefined): { html: string; used: Map<string, string> } {
  const used = new Map<string, string>();
  const out = html.replace(ASSET_PATH, (path) => {
    const hash = hashOf(path);
    if (!hash) return path;
    used.set(path, hash);
    return versionedPath(path, hash);
  });
  return { html: out, used };
}

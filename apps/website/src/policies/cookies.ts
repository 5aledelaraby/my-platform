// Cookies and browser storage. Lists exactly what the site sets (keys in src/scripts, src/components; the tag list
// comes from tags.ts, so a tag without an ID is not listed). Strictly necessary items load always; analytics and
// ad tags (site.ts `tracking`) also load from the first page (owner, 2026-10-19: no cookie banner) unless the visitor
// refused in "Cookie settings" (Consent.astro). Any new tag needs this page, privacy.ts and site.policiesUpdated updated first.
import { site, tracking } from "../site.ts";
import { contactHtml, policyPath } from "./shared.ts";
import { activeTags, andEn, tagCompanies } from "./tags.ts";
import type { PolicyDoc } from "./shared.ts";

const li = (name: string, who: string, what: string, how: string) => `<li><b>${name}</b> (${who}): ${what} <span class="muted">${how}</span></li>`;
const tagItemsEn = () => activeTags().flatMap((t) => t.cookies.map((c) => li(c.name, t.tool.replace(/^the /, ""), c.what, c.life))).join("\n");

export const cookiesEn: PolicyDoc = {
  title: "Cookie policy",
  description: "The cookies and browser storage the Vicuna website uses, why, and how you can turn them off.",
  html: `
<p class="policy-summary"><b>In short:</b> the website needs a few strictly necessary items to work. We also use analytics and advertising cookies (${andEn(tagCompanies())}), and you can turn them off at any time from "Cookie settings" at the bottom of every page.</p>

<h2>1. What are cookies?</h2>
<p>Cookies are small text files a website saves in your browser. "Local storage" (localStorage and sessionStorage) is similar: space in your browser where a site keeps simple data on your device. On this page we call both "cookies".</p>

<h2>2. Strictly necessary (always on)</h2>
<p>These are needed for the website to work or stay secure, so they do not need your consent. We never use them to track you or show ads.</p>
<ul>
${li("vicuna-cart-v1", "Vicuna, local storage", "keeps your cart so it is not lost when you close the page; it reaches us only when you send the order.", "Until you empty the cart or clear your browser data.")}
${li("vicuna-last-order", "Vicuna, session storage", "shows your order number and total on the thank-you page (with the belts in it, never your name, number or address).", "Deleted when you close the tab.")}
${li("vicuna-tracked-&lt;order number&gt;", "Vicuna, session storage", "set on the thank-you page so an order is counted at most once, and never later if you had turned the tools off.", "Deleted when you close the tab.")}
${li("vicuna-cart-peeked", "Vicuna, session storage", "the cart opens by itself only after your first added belt.", "Deleted when you close the tab.")}
${li("vicuna-howto", "Vicuna, session storage", "the small \"how to order\" tip shows only once per visit.", "Deleted when you close the tab.")}
${li("vicuna-swipe-hint", "Vicuna, session storage", "the small swipe hint on the product photo shows only once.", "Deleted when you close the tab.")}
${li("vicuna-consent", "Vicuna, local storage", "remembers your choice for analytics and advertising cookies in \"Cookie settings\".", "Until you clear your browser data.")}
${li("vicuna-favorites", "Vicuna, local storage", "keeps the belts you marked with a heart, on this device only; it is never sent to us.", "Until you remove them or clear your browser data.")}
${li("vicuna-paid-&lt;order number&gt;", "Vicuna, session storage", "on the thank-you page, remembers that a PayPal order was paid, so the PayPal button is not shown again.", "Deleted when you close the tab.")}
${li("PayPal cookies", "PayPal", "only on the thank-you page and only if you chose PayPal: needed by PayPal's payment button to take the payment securely.", "Set by PayPal; see its cookie statement.")}
${li("__cf_bm, cf_clearance", "Cloudflare", "protect the website from attacks and harmful automated traffic; set only when needed.", "30 minutes to one year.")}
</ul>

<h2>3. Analytics and advertising</h2>
<p>We use these tools to understand how the website is used and to show and measure our ads. They record the pages and products you view, what you add to the cart and your orders (number and value). Each company uses this data under its own privacy policy.</p>
<ul>
${tagItemsEn()}
</ul>
<p>If you choose "Reject" in "Cookie settings", these tools stop and their cookies are deleted from our website${tracking.meta ? ", and our server does not send your purchase to Meta" : ""}. It does not affect your purchase.</p>

<h2>4. How to change your choice</h2>
<ul>
<li>Press "Cookie settings" at the bottom of any page to choose "Reject" (turn them off) or "Accept" (turn them back on).</li>
<li>Your browser settings let you clear or block cookies and site data. Blocking strictly necessary cookies may stop your cart from being saved or show you a check page.</li>
<li>${andEn(tagCompanies())} also offer ad settings in your account with them.</li>
</ul>

<h2>5. Changes to this policy</h2>
<p>We update this page before adding or changing any cookie, and show the date of the last update at the top. See also our <a href="${policyPath("en", "privacy")}">privacy policy</a>.</p>

<h2>6. Contact us</h2>
${contactHtml("en", "Hello Vicuna, I have a question about cookies and privacy.", site.email)}
`,
};


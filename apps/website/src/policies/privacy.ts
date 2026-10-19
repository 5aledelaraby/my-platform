// Privacy policy. Written against Egypt's Personal Data Protection Law 151/2020 and its Executive Regulations
// (Decree 816/2025): controller identity, data collected, purposes, recipients, transfer abroad, retention, rights,
// and the right to complain to the Personal Data Protection Center. It must describe what the site really does:
// orders go to the order API (Cloudflare Worker + D1), a Telegram message reaches the owner, the cart lives in the
// browser, and analytics/ad tags (site.ts `tracking`; only those with an ID, see tags.ts) load from the first page unless the
// visitor refused in "Cookie settings" (owner, 2026-10-19: no cookie banner). Unless she refused, the order API also
// sends the Purchase event to Meta (Conversions API, apps/api/src/meta.ts).
// Change this page in the same commit as any change to that.
import { site, tracking } from "../site.ts";
import { contactHtml, policyPath } from "./shared.ts";
import { adPlatforms, andEn, tagCompanies, tagTools } from "./tags.ts";
import type { PolicyDoc } from "./shared.ts";

// How Google and Meta use the data, and where to opt out of their ads: the disclosures their tag terms ask for.
const GOOGLE_DATA = "https://policies.google.com/technologies/partner-sites";
const AD_CHOICES = "https://optout.aboutads.info/";
const OPTOUT_EN = `${tracking.ga4 ? ` <a href="${GOOGLE_DATA}">How Google uses this data</a>.` : ""}${tracking.meta ? ` You can also opt out of personalised ads at <a href="${AD_CHOICES}">aboutads.info</a> or in the ad settings of your Facebook account.` : ""}`;

export const privacyEn: PolicyDoc = {
  title: "Privacy policy",
  description: "What data Vicuna collects, why, where it is kept, for how long, and your rights over your personal data.",
  html: `
<p>We collect the least data needed to deliver your order. This page explains what we collect, why, where it is kept, for how long, and your rights under Egypt's Personal Data Protection Law No. 151 of 2020.</p>

<h2>1. Who is responsible for your data</h2>
<p>${site.legalNameEn}, commercial register no. ${site.commercialRegister}, head office ${site.addressEn}. For any request about your data:</p>
${contactHtml("en", "Hello, I have a request about my data")}

<h2>2. What we collect</h2>
<ul>
<li><b>Order details:</b> name, mobile number, governorate, address, notes, items and quantities, shipping and payment method. You enter them in the cart, and they reach us when you press "Place order".</li>
<li><b>Messages:</b> your messages with us on WhatsApp or by email, and any photos you send, such as a photo of a faulty item.</li>
<li><b>Payment:</b> to refund an order paid in cash we need the wallet or bank account number you choose. When you pay online (card or PayPal), PayPal tells us the payment went through, its reference and amount, and the PayPal account name and email. We never ask for or keep card numbers.</li>
<li><b>Special orders:</b> your measurements for a custom size or a made-to-measure belt.</li>
<li><b>Technical data:</b> IP address, browser and device type, logged automatically by our hosting provider to run and protect the website, for example to limit how many orders one device can send.</li>
<li><b>Analytics and advertising data:</b> pages and products you view, items you add to the cart and your orders (number and value), with device type and approximate location. Collected by ${andEn(tagTools())}. ${tracking.meta ? "Our server also sends the purchase to Meta, with your mobile number hashed so it cannot be recovered. We do not send your name or address." : "We do not send them your name, number or address."}</li>
<li><b>On your device:</b> your cart is kept in your browser (localStorage) so it is not lost when you close the page; it reaches us only when you send the order. Your last order's number, total, payment method and the belts in it (not your name, number or address) are kept briefly in the browser for the thank-you page and are deleted when you close the browser tab.</li>
</ul>

<h2>3. Why we use it</h2>
<ul>
<li><b>To fulfil your order:</b> confirm, prepare and deliver it, contact you about it, and handle returns, exchanges and warranty. The basis is our sales contract.</li>
<li><b>Legal duties:</b> keeping sales records as Egyptian law requires, and answering competent authorities.</li>
<li><b>Protecting the website:</b> preventing fake orders and abuse.</li>
<li><b>Measurement and advertising:</b> to understand how the website is used and to show and measure our ads on ${andEn(adPlatforms())}. You can turn this off at any time from "Cookie settings" at the bottom of the website.</li>
</ul>
<p>We send marketing messages or offers only with your explicit prior consent, and you can stop them at any time.</p>

<h2>4. Who sees your data</h2>
<p>We do not sell or rent your data. Only these see it:</p>
<ul>
<li><b>The courier:</b> name, mobile number and address, to deliver the order.</li>
<li><b>Cloudflare:</b> hosts the website and the order database and protects the website, processing data on our behalf.</li>
<li><b>PayPal (only if you choose to pay with it):</b> we send it the order number and amount; it processes the payment and your details under its own policy.</li>
<li><b>${andEn(tagCompanies())}:</b> receive the analytics and advertising data described above and use it under their own policies; they may transfer it outside Egypt.</li>
<li><b>Services we communicate through,</b> each with its own privacy policy:
<ul>
<li>Telegram: we receive a message for every new order and every status change, with the order number, your details, the items and the total.</li>
<li>WhatsApp: to talk to you about your order.</li>
<li>Gmail by Google: messages sent to Vicuna's email addresses arrive there.</li>
</ul></li>
<li><b>Competent authorities</b>, when the law requires it.</li>
</ul>

<h2>5. Storage outside Egypt</h2>
<p>Cloudflare, Telegram, WhatsApp, Google and PayPal servers are outside Egypt, so your order details are stored and processed outside Egypt, only for the purposes on this page. We rely on fulfilling your order and on your agreement to this policy when you send the order.</p>

<h2>6. How long we keep it</h2>
<ul>
<li><b>Order details and related messages:</b> for as long as needed to fulfil the order and handle returns and warranty, and for as long as Egyptian law requires commercial and tax records to be kept; then we delete them.</li>
<li><b>Your cart on your device:</b> until you empty the cart or clear the website's data in your browser.</li>
<li><b>Technical data:</b> for a short time with our hosting provider, under its policy.</li>
</ul>

<h2>7. Your rights</h2>
<p>At any time you may:</p>
<ul>
<li>know what data we hold about you and get a copy;</li>
<li>have it corrected, updated or completed;</li>
<li>ask us to delete it, unless the law requires us to keep it;</li>
<li>withdraw your consent, limit its use to a specific scope, or object to its use;</li>
<li>be told if a breach affects your data.</li>
</ul>
<p>Message us on WhatsApp or by email and we answer within the period set by law. We may need to confirm it is you, for example by asking you to write from the mobile number on the order. You also have the right to complain to Egypt's Personal Data Protection Center.</p>

<h2>8. Security</h2>
<p>The connection to the website is encrypted (HTTPS), and on our side the order records can only be opened from accounts protected by a sign-in. If a breach affects your data, we notify the Personal Data Protection Center and you within the periods set by law. Still, no way of sending or storing data on the internet is 100% secure.</p>

<h2>9. Cookies and measurement tools</h2>
<p>We use ${andEn(tagTools())}. These companies may use cookies to collect information about your visit, measure ads and show you ads that suit you. You can turn them off at any time from "Cookie settings" at the bottom of the website.${OPTOUT_EN} Details are in the <a href="${policyPath("en", "cookies")}">cookie policy</a>.</p>

<h2>10. Age</h2>
<p>The website is meant for adults of legal age. If you are not of legal age yet, order with your parent's or guardian's knowledge and consent.</p>

<h2>11. Changes</h2>
<p>We may update this policy from time to time; the date of the last update is shown at the top. If we make an important change to how we use your data, we explain it on this page.</p>

<p>See also the <a href="${policyPath("en", "terms")}">terms and conditions</a> and <a href="${policyPath("en", "returns")}">returns and exchanges</a>.</p>
`,
};

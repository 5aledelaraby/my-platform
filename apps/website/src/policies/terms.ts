// Terms of service, English only (owner, 2026-10-20): short, in the style of the fashion store he showed, and covering
// what Google Merchant Center and Meta check: who runs the store, prices and payment, delivery, returns, intellectual
// property and governing law. Every number comes from site.ts or @platform/commerce.
import { site } from "../site.ts";
import { contactHtml, fees, policyPath } from "./shared.ts";
import type { PolicyDoc } from "./shared.ts";

const ca = site.consumerAgency;

export const termsEn: PolicyDoc = {
  title: "Terms of service",
  description: "Terms for ordering from Vicuna: who we are, orders, prices and payment, delivery, returns and your rights.",
  html: `
<p>Welcome to Vicuna. By using our website or placing an order, you agree to these terms.</p>

<h2>1. Who we are</h2>
<p>Vicuna is run by <b>${site.legalNameEn}</b>, a ${site.legalFormEn}, commercial register no. ${site.commercialRegister}${site.taxNumber ? `, tax registration no. ${site.taxNumber}` : ""}, ${site.addressEn}.</p>

<h2>2. Our products</h2>
<p>Our waist belts are made of imported PU leather, or lace depending on the design. Natural leather belts are made to measure on request only, in Cairo and Giza, with the price and size agreed before we start.</p>
<p>Photos, colours and details are shown as accurately as possible. Slight differences may occur because of lighting or screen settings.</p>

<h2>3. Orders</h2>
<p>Please give a correct name, phone number and address. We contact you on WhatsApp or by phone to confirm your order, and you can change or cancel it free of charge until it ships.</p>
<p>We may cancel an order if its details are wrong and we cannot reach you, the item is no longer available, or there is a clear pricing error. Anything you paid is refunded in full.</p>

<h2>4. Prices and payment</h2>
<p>All prices are in Egyptian pounds (EGP) and are final. The total, including shipping, is shown before you place your order, and you pay the price your order was confirmed at.</p>
<p>You can pay cash on delivery, or online by card or PayPal, charged in US dollars at the amount shown before you pay.</p>

<h2 id="offers">5. Promo codes</h2>
<p>A promo code takes a fixed amount off the belts (not shipping), one code per order, under the conditions announced with it. Free shipping from EGP ${fees.freeOver} is based on the amount after the discount, and a code cannot be exchanged for money.</p>

<h2>6. Delivery</h2>
<p>We deliver to every governorate in Egypt within ${site.deliveryDays} working days, or you can pick up your order from us in Nasr City. Fees and times are on the <a href="${policyPath("en", "shipping")}">shipping and delivery</a> page.</p>

<h2>7. Returns and faults</h2>
<p>You can return or exchange any belt within ${site.returnDays} days of delivery, as explained in our <a href="${policyPath("en", "returns")}">returns and exchanges policy</a>. A belt with a manufacturing fault reported within ${site.defectDays} days of delivery is replaced or refunded.</p>

<h2>8. Intellectual property</h2>
<p>All photos, designs, the logo and the content of this website belong to Vicuna and may not be copied or used without our written permission.</p>

<h2>9. Your rights and the law</h2>
<p>Nothing in these terms reduces your rights under Egypt's Consumer Protection Law No. 181 of 2018. You can contact the Consumer Protection Agency on ${ca.hotline} or at <a href="${ca.url}" rel="noopener noreferrer">cpa.gov.eg</a>. These terms are governed by the laws of the Arab Republic of Egypt.</p>

<h2>10. Changes and contact</h2>
<p>We may update these terms; the date of the last update is shown at the top, and orders already confirmed keep the terms they were placed under. Our <a href="${policyPath("en", "privacy")}">privacy policy</a> explains how we handle your data.</p>
${contactHtml("en", "Hello, I have a question about the terms")}
`,
};

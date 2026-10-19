// Shipping, payment, cancellation, returns and refunds.
// Legal floor (Consumer Protection Law 181/2018): return within 14 days of receipt without a reason (Art. 17, 40),
// refund within 7 days of getting the item back by the same payment method (Art. 40), defects and wrong items within
// 30 days at no cost (Art. 21), made-to-measure goods excluded unless faulty (Art. 17, 41), free cancellation when
// delivery is late (Art. 40). The store's own terms below are at or above that floor; terms that reduce a consumer
// right are void anyway (Art. 28).
import { site } from "../site.ts";
import { contactHtml, policyPath } from "./shared.ts";
import type { PolicyDoc } from "./shared.ts";

const r = site.returnDays;
const ca = site.consumerAgency;

export const returnsEn: PolicyDoc = {
  title: "Returns and exchanges",
  description: `Vicuna cancellation, ${r}-day returns and exchanges, and refunds.`,
  html: `
<p class="policy-summary"><b>In short:</b> you have ${r} days from delivery to return any belt and get back what you paid, or to exchange it, without giving a reason and with no shipping cost to you, except custom sizes and made-to-measure belts.</p>

<p>Shipping fees, delivery times and payment are on the <a href="${policyPath("en", "shipping")}">shipping and delivery</a> page.</p>

<h2>Confirming, changing and cancelling an order</h2>
<p>When you send the order from the cart, you see its number; we then contact you on WhatsApp or by phone to confirm the order details and the total.</p>
<p>You can change the order (style, quantity or address) or cancel it free of charge at any time before it ships; if you paid online, we refund the full amount. After it ships, you can return or exchange it as described below.</p>

<h2>Returns and exchanges</h2>
<ul>
<li>You may return or exchange any item within ${r} days of receiving it, without giving a reason.</li>
<li>We refund what you paid for the item, and we pay the return shipping.</li>
<li>If you return part of an order that used a <a href="${policyPath("en", "terms")}#offers">promo code</a>, the discount is spread over the belts in proportion to their prices, and we refund what you actually paid for what you return. We do not charge shipping if what you keep falls below the free-shipping amount.</li>
<li>The item must come back as you received it: unused and undamaged.</li>
<li>If you return the whole order, we also refund the shipping fee you paid.</li>
<li>To exchange, pick any other style: we collect the old one and send the new one with no shipping cost to you. If it costs more you pay the difference; if it costs less we refund the difference.</li>
</ul>

<h2>Refunds</h2>
<p>We refund within ${site.refundDays} days of receiving the returned item, by the same payment method. If you paid cash on delivery, we transfer the amount, with your agreement, to a mobile wallet or bank account of your choice, at no charge to you.</p>

<h2>Faulty or wrong items</h2>
<ul>
<li>If an item is faulty, or you received a different style, colour or size from what you ordered, contact us within ${site.defectDays} days of delivery with a photo of the item.</li>
<li>We send a replacement, or refund the full amount <b>including shipping</b>, as you prefer.</li>
<li>All shipping costs in this case are ours.</li>
</ul>

<h2>Colours and photos</h2>
<p>We photograph our products as true to life as we can, without filters, but colours can look slightly different depending on the screen and light. If a colour is not what you expected, you can return or exchange it within the usual ${r} days.</p>

<h2>Items returnable only if faulty</h2>
<ul>
<li><b>Custom sizes and made-to-measure natural leather belts:</b> made to your size and specifications, so they cannot be returned for a change of mind. We replace or refund them if they have a manufacturing fault or were not made to the size or specifications we agreed.</li>
</ul>

<h2>How to return or exchange</h2>
<p>No forms: send us your order number on WhatsApp and say whether you want a return or an exchange, and we arrange the pickup with you. You can also hand the item in yourself at our office, ${site.addressEn}, at a time we agree.</p>
${contactHtml("en", "Hello, I would like to return or exchange an order", site.supportEmail)}

<h2>If we cannot solve it</h2>
<p>This policy does not reduce any of your rights under Egypt's Consumer Protection Law No. 181 of 2018. If we do not solve your problem, you can complain to the Consumer Protection Agency on hotline ${ca.hotline} or at <a href="${ca.url}" rel="noopener noreferrer">cpa.gov.eg</a>.</p>

<p>See also the <a href="${policyPath("en", "terms")}">terms and conditions</a> and the <a href="${policyPath("en", "privacy")}">privacy policy</a>.</p>
`,
};

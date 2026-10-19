// Shipping fees, delivery times and payment. Every number comes from site.ts or @platform/commerce.
// Late delivery (Consumer Protection Law 181/2018, Art. 40): free cancellation and a full refund.
import { site } from "../site.ts";
import { contactHtml, fees, policyPath } from "./shared.ts";
import type { PolicyDoc } from "./shared.ts";

export const shippingEn: PolicyDoc = {
  title: "Shipping and delivery",
  description: `Vicuna shipping fees, free shipping from EGP ${fees.freeOver}, delivery across Egypt in ${site.deliveryDays} working days, and payment.`,
  html: `
<p class="policy-summary"><b>In short:</b> we deliver to every governorate in Egypt within ${site.deliveryDays} working days; standard shipping is EGP ${fees.standard} and free on orders of EGP ${fees.freeOver} or more; pay on delivery, or online by card or PayPal.</p>

<h2>Shipping fees</h2>
<table>
<thead><tr><th>Shipping</th><th>Cost</th></tr></thead>
<tbody>
<tr><td>Standard, to any governorate</td><td>EGP ${fees.standard}</td></tr>
<tr><td>Standard, orders of EGP ${fees.freeOver} or more after discount</td><td>Free</td></tr>
<tr><td>Express</td><td>EGP ${fees.express}</td></tr>
<tr><td>Pickup from us in Nasr City (we agree the place and time with you)</td><td>Free</td></tr>
</tbody>
</table>
<p>The cart shows the shipping fee and the total before you send the order, and we add no fees to that total on delivery.</p>

<h2>Delivery time</h2>
<p>We deliver to every governorate in Egypt within ${site.deliveryDays} working days of confirming the order. The express delivery date is agreed with you when we confirm the order. Custom sizes are made to order and may take longer; we tell you how long before we start.</p>
<p>If your order does not arrive on the agreed date, or within ${site.lateDeliveryDays} days when no date was agreed, you may cancel it and get back everything you paid, and we cover all shipping and return costs.</p>

<h2>Payment</h2>
<ul>
<li><b>Cash on delivery:</b> you pay the courier when the order arrives, or us if you pick it up.</li>
<li><b>Card or PayPal (when shown in the cart):</b> after you place the order you pay the total in US dollars by Visa or Mastercard or with a PayPal account, through PayPal, at an exchange rate we set; you see the dollar amount before you pay. PayPal's fees are on us.</li>
</ul>
<p>We never ask for or keep card or bank account numbers.</p>

<h2>Tracking your order</h2>
<p>Once the order is confirmed we message you on WhatsApp with the shipping date, and the courier calls you before delivery. For any question about your order, message us with your order number:</p>
${contactHtml("en", "Hello Vicuna, I have a question about my order number:")}

<p>Returns, exchanges and refunds: <a href="${policyPath("en", "returns")}">returns and exchanges</a>.</p>
`,
};

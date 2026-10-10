// Shipping fees, delivery times and payment. Every number comes from site.ts or @platform/commerce.
// Late delivery (Consumer Protection Law 181/2018, Art. 40): free cancellation and a full refund.
import { site } from "../site.ts";
import { contactHtml, fees, ltr, policyPath } from "./shared.ts";
import type { PolicyDoc } from "./shared.ts";

export const shippingAr: PolicyDoc = {
  title: "الشحن والتوصيل",
  description: `مصاريف الشحن في فيكونا، والشحن المجاني من ${fees.freeOver} جنيه، والتوصيل لكل محافظات مصر خلال ${site.deliveryDays} أيام عمل، وطرق الدفع.`,
  html: `
<p class="policy-summary"><b>باختصار:</b> نوصّل إلى كل محافظات مصر خلال ${site.deliveryDays} أيام عمل، والشحن العادي بـ ${fees.standard} جنيه ومجاني للطلبات من ${fees.freeOver} جنيه، والدفع عند الاستلام أو InstaPay.</p>

<h2>مصاريف الشحن</h2>
<table>
<thead><tr><th>نوع الشحن</th><th>التكلفة</th></tr></thead>
<tbody>
<tr><td>شحن عادي إلى أي محافظة</td><td>${fees.standard} جنيه</td></tr>
<tr><td>شحن عادي لطلب قيمته ${fees.freeOver} جنيه أو أكثر بعد الخصم</td><td>مجاني</td></tr>
<tr><td>شحن سريع</td><td>${fees.express} جنيه</td></tr>
</tbody>
</table>
<p>تظهر مصاريف الشحن والإجمالي في السلة قبل إرسال الطلب، ولا نضيف على هذا الإجمالي أي رسوم عند الاستلام.</p>

<h2>مدة التوصيل</h2>
<p>نوصّل إلى جميع محافظات مصر خلال ${site.deliveryDays} أيام عمل من تأكيد الطلب. موعد الشحن السريع نتفق عليه معكِ عند تأكيد الطلب. المقاسات الخاصة تُصنع حسب الطلب وقد تحتاج وقتًا أطول، ونخبركِ بالمدة قبل أن نبدأ.</p>
<p>إذا لم يصلكِ الطلب في الموعد الذي اتفقنا عليه، أو خلال ${site.lateDeliveryDays} يومًا إذا لم نحدد موعدًا، فمن حقكِ إلغاؤه واسترداد كل ما دفعتِه، ونتحمل نحن كل مصاريف الشحن والإرجاع.</p>

<h2>طرق الدفع</h2>
<ul>
<li><b>الدفع عند الاستلام:</b> تدفعين للمندوب عند استلام الطلب.</li>
<li><b>InstaPay:</b> تحوّلين الإجمالي إلى ${ltr(site.instapay)}، وترسلين صورة التحويل مع رقم الطلب على واتساب.</li>
</ul>
<p>لا نطلب ولا نحفظ أي أرقام بطاقات أو حسابات بنكية.</p>

<h2>متابعة الطلب</h2>
<p>بعد تأكيد الطلب نتواصل معكِ على واتساب بموعد الشحن، ويتصل بكِ المندوب قبل التوصيل. لأي سؤال عن طلبكِ راسلينا ومعكِ رقم الطلب:</p>
${contactHtml("ar", "أهلاً فيكونا، أريد الاستفسار عن طلبي رقم:")}

<p>للإرجاع والاستبدال واسترداد المبلغ: <a href="${policyPath("ar", "returns")}">الاسترجاع والاستبدال</a>.</p>
`,
};

export const shippingEn: PolicyDoc = {
  title: "Shipping and delivery",
  description: `Vicuna shipping fees, free shipping from EGP ${fees.freeOver}, delivery across Egypt in ${site.deliveryDays} working days, and payment.`,
  html: `
<p class="policy-summary"><b>In short:</b> we deliver to every governorate in Egypt within ${site.deliveryDays} working days; standard shipping is EGP ${fees.standard} and free on orders of EGP ${fees.freeOver} or more; pay on delivery or by InstaPay.</p>

<h2>Shipping fees</h2>
<table>
<thead><tr><th>Shipping</th><th>Cost</th></tr></thead>
<tbody>
<tr><td>Standard, to any governorate</td><td>EGP ${fees.standard}</td></tr>
<tr><td>Standard, orders of EGP ${fees.freeOver} or more after discount</td><td>Free</td></tr>
<tr><td>Express</td><td>EGP ${fees.express}</td></tr>
</tbody>
</table>
<p>The cart shows the shipping fee and the total before you send the order, and we add no fees to that total on delivery.</p>

<h2>Delivery time</h2>
<p>We deliver to every governorate in Egypt within ${site.deliveryDays} working days of confirming the order. The express delivery date is agreed with you when we confirm the order. Custom sizes are made to order and may take longer; we tell you how long before we start.</p>
<p>If your order does not arrive on the agreed date, or within ${site.lateDeliveryDays} days when no date was agreed, you may cancel it and get back everything you paid, and we cover all shipping and return costs.</p>

<h2>Payment</h2>
<ul>
<li><b>Cash on delivery:</b> you pay the courier when the order arrives.</li>
<li><b>InstaPay:</b> transfer the total to ${site.instapay} and send the receipt with your order number on WhatsApp.</li>
</ul>
<p>We never ask for or keep card or bank account numbers.</p>

<h2>Tracking your order</h2>
<p>Once the order is confirmed we message you on WhatsApp with the shipping date, and the courier calls you before delivery. For any question about your order, message us with your order number:</p>
${contactHtml("en", "Hello Vicuna, I have a question about my order number:")}

<p>Returns, exchanges and refunds: <a href="${policyPath("en", "returns")}">returns and exchanges</a>.</p>
`,
};

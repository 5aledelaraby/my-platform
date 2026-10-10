// Shipping, payment, cancellation, returns and refunds.
// Legal floor (Consumer Protection Law 181/2018): return within 14 days of receipt without a reason (Art. 17, 40),
// refund within 7 days of getting the item back by the same payment method (Art. 40), defects and wrong items within
// 30 days at no cost (Art. 21), made-to-measure goods excluded unless faulty (Art. 17, 41), free cancellation when
// delivery is late (Art. 40). The store's own terms below are at or above that floor; terms that reduce a consumer
// right are void anyway (Art. 28).
import { site } from "../site.ts";
import { contactHtml, fees, ltr, policyPath } from "./shared.ts";
import type { PolicyDoc } from "./shared.ts";

const r = site.returnDays;
const ca = site.consumerAgency;

export const returnsAr: PolicyDoc = {
  title: "الاسترجاع والاستبدال",
  description: `الإلغاء، والاسترجاع والاستبدال خلال ${r} يومًا، واسترداد المبلغ في فيكونا.`,
  html: `
<p class="policy-summary"><b>باختصار:</b> لكِ ${r} يومًا من يوم الاستلام لتُرجعي أي حزام وتستردي ما دفعتِه، أو تستبدليه، دون ذكر السبب ودون أي مصاريف شحن عليكِ، عدا المقاسات الخاصة والأحزمة المفصّلة.</p>

<p>مصاريف الشحن ومدة التوصيل وطرق الدفع في صفحة <a href="${policyPath("ar", "shipping")}">الشحن والتوصيل</a>.</p>

<h2>تأكيد الطلب وتعديله وإلغاؤه</h2>
<p>بعد إرسال الطلب من السلة يظهر لكِ رقمه، ثم نتواصل معكِ على واتساب أو بالهاتف لتأكيد بيانات الطلب والإجمالي.</p>
<p>يمكنكِ تعديل الطلب (الموديل أو الكمية أو العنوان) أو إلغاؤه دون أي مصاريف في أي وقت قبل شحنه، وإذا كنتِ دفعتِ بـ InstaPay نردّ لكِ المبلغ كاملًا. وبعد الشحن يمكنكِ الإرجاع أو الاستبدال كما هو موضح أدناه.</p>

<h2>الاسترجاع والاستبدال</h2>
<ul>
<li>من حقكِ إرجاع أي منتج أو استبداله خلال ${r} يومًا من يوم استلامه، دون ذكر السبب.</li>
<li>نردّ لكِ ما دفعتِه مقابل المنتج، ونتحمل نحن مصاريف شحن الإرجاع.</li>
<li>إذا أرجعتِ جزءًا من طلب استخدمتِ فيه <a href="${policyPath("ar", "terms")}#offers">كود خصم</a>، يُوزَّع الخصم على الأحزمة بنسبة أسعارها، ونردّ لكِ ما دفعتِه فعليًا مقابل ما أرجعتِه. ولا نخصم مصاريف شحن إذا قلّت قيمة ما بقي معكِ عن حد الشحن المجاني.</li>
<li>يرجع المنتج بحالته عند الاستلام: غير مستعمل وبدون تلف.</li>
<li>إذا أرجعتِ الطلب كله، نردّ لكِ أيضًا مصاريف الشحن التي دفعتِها.</li>
<li>للاستبدال اختاري أي موديل آخر، ونستلم القديم ونرسل الجديد دون أي مصاريف شحن عليكِ. وإذا كان أغلى تدفعين الفرق، وإذا كان أرخص نردّ لكِ الفرق.</li>
</ul>

<h2>استرداد المبلغ</h2>
<p>نردّ المبلغ خلال ${site.refundDays} أيام من استلامنا للمنتج المرتجع، بنفس طريقة الدفع. وإذا كان الدفع نقدًا عند الاستلام، نحوّل المبلغ بموافقتكِ إلى InstaPay أو إلى محفظة إلكترونية تختارينها، دون أي رسوم عليكِ.</p>

<h2>منتج به عيب أو وصلكِ خطأ</h2>
<ul>
<li>إذا ظهر عيب في المنتج، أو وصلكِ موديل أو لون أو مقاس غير الذي طلبتِه، تواصلي معنا خلال ${site.defectDays} يومًا من الاستلام وأرسلي صورة للمنتج.</li>
<li>نرسل لكِ بديلًا، أو نردّ لكِ المبلغ كاملًا <b>شاملًا مصاريف الشحن</b>، حسب اختياركِ.</li>
<li>كل مصاريف الشحن في هذه الحالة علينا.</li>
</ul>

<h2>الألوان والصور</h2>
<p>نصوّر منتجاتنا بأقرب شكل للحقيقة وبدون فلاتر، لكن اللون قد يبدو مختلفًا قليلًا حسب الشاشة والإضاءة. إذا لم يكن اللون كما توقعتِ، يمكنكِ الإرجاع أو الاستبدال خلال ${r} يومًا كالمعتاد.</p>

<h2>منتجات تُرجع لعيب فقط</h2>
<ul>
<li><b>المقاسات الخاصة وأحزمة الجلد الطبيعي المفصّلة:</b> تُصنع حسب مقاسكِ ومواصفاتكِ، فلا تُرجع لتغيير الرأي. نستبدلها أو نردّ ثمنها إذا كان بها عيب صناعة، أو صُنعت بمقاس أو مواصفات غير التي اتفقنا عليها.</li>
</ul>

<h2>كيف تطلبين الإرجاع أو الاستبدال؟</h2>
<p>بدون استمارات: أرسلي لنا على واتساب رقم الطلب، وهل تريدين الإرجاع أم الاستبدال، ونرتب معكِ موعد الاستلام.</p>
${contactHtml("ar", "السلام عليكم، أريد إرجاع أو استبدال طلب", site.supportEmail)}

<h2>إذا لم نصل إلى حل</h2>
<p>هذه السياسة لا تنتقص من أي حق لكِ في قانون حماية المستهلك رقم 181 لسنة 2018. وإذا لم نحل مشكلتكِ، يمكنكِ تقديم شكوى إلى جهاز حماية المستهلك على الخط الساخن ${ltr(ca.hotline)} أو من موقعه <a href="${ca.url}" rel="noopener noreferrer">${ltr("cpa.gov.eg")}</a>.</p>

<p>اقرئي أيضًا <a href="${policyPath("ar", "terms")}">الشروط والأحكام</a> و<a href="${policyPath("ar", "privacy")}">سياسة الخصوصية</a>.</p>
`,
};

export const returnsEn: PolicyDoc = {
  title: "Returns and exchanges",
  description: `Vicuna cancellation, ${r}-day returns and exchanges, and refunds.`,
  html: `
<p class="policy-summary"><b>In short:</b> you have ${r} days from delivery to return any belt and get back what you paid, or to exchange it, without giving a reason and with no shipping cost to you, except custom sizes and made-to-measure belts.</p>

<p>Shipping fees, delivery times and payment are on the <a href="${policyPath("en", "shipping")}">shipping and delivery</a> page.</p>

<h2>Confirming, changing and cancelling an order</h2>
<p>When you send the order from the cart, you see its number; we then contact you on WhatsApp or by phone to confirm the order details and the total.</p>
<p>You can change the order (style, quantity or address) or cancel it free of charge at any time before it ships; if you paid by InstaPay, we refund the full amount. After it ships, you can return or exchange it as described below.</p>

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
<p>We refund within ${site.refundDays} days of receiving the returned item, by the same payment method. If you paid cash on delivery, we transfer the amount, with your agreement, by InstaPay or to a mobile wallet of your choice, at no charge to you.</p>

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
<p>No forms: send us your order number on WhatsApp and say whether you want a return or an exchange, and we arrange the pickup with you.</p>
${contactHtml("en", "Hello, I would like to return or exchange an order", site.supportEmail)}

<h2>If we cannot solve it</h2>
<p>This policy does not reduce any of your rights under Egypt's Consumer Protection Law No. 181 of 2018. If we do not solve your problem, you can complain to the Consumer Protection Agency on hotline ${ca.hotline} or at <a href="${ca.url}" rel="noopener noreferrer">cpa.gov.eg</a>.</p>

<p>See also the <a href="${policyPath("en", "terms")}">terms and conditions</a> and the <a href="${policyPath("en", "privacy")}">privacy policy</a>.</p>
`,
};

// Terms and conditions. Seller identity and contact details are required on the site by Consumer Protection Law
// 181/2018, Art. 37 (name, address, phone, email, commercial register and tax number), in Arabic (Art. 5).
import { site } from "../site.ts";
import { contactHtml, fees, ltr, policyPath } from "./shared.ts";
import type { PolicyDoc } from "./shared.ts";

const ca = site.consumerAgency;

export const termsAr: PolicyDoc = {
  title: "الشروط والأحكام",
  description: "شروط الطلب والشراء من فيكونا: بيانات الشركة، والطلبات، والأسعار والدفع، والعروض، وحقوقكِ كمستهلكة.",
  html: `
<p>هذا الموقع تابع لشركة <b>${site.legalNameAr}</b> (${ltr(site.legalNameEn)})، ${site.legalFormAr}، مقيدة بالسجل التجاري رقم ${ltr(site.commercialRegister)}${
    site.taxNumber ? `، ورقم التسجيل الضريبي ${ltr(site.taxNumber)}` : ""
  }، ومقرها ${site.addressAr}. كلمة «نحن» في هذه الصفحة تعني فيكونا. باستخدامكِ للموقع أو الطلب منه، توافقين على هذه الشروط.</p>

<h2>1. استخدام الموقع</h2>
<ul>
<li>باستخدامكِ للموقع تؤكدين أنكِ بلغتِ سن الرشد، أو أن وليّ أمركِ موافق على طلبكِ.</li>
<li>لا يجوز استخدام الموقع أو منتجاتنا في أي غرض غير قانوني.</li>
<li>لا تحتاجين إلى إنشاء حساب أو كلمة سر للطلب، ولا نطلب منكِ إلا البيانات اللازمة لتوصيل الطلب.</li>
</ul>

<h2>2. الطلبات</h2>
<ul>
<li>ترسلين طلبكِ من السلة في الموقع، فيظهر لكِ رقم الطلب.</li>
<li>نتواصل معكِ على واتساب أو بالهاتف لتأكيد البيانات والإجمالي وطريقة الدفع، ويُعد الطلب مؤكدًا بعد هذا التواصل.</li>
<li>إذا نفدت كمية منتج بعد طلبكِ لأي سبب، نخبركِ فورًا، فتختارين بديلًا أو نلغي الطلب دون مصاريف ونردّ أي مبلغ دفعتِه.</li>
<li>يمكنكِ تعديل الطلب أو إلغاؤه دون مصاريف في أي وقت قبل شحنه، وبعد الشحن يمكنكِ الإرجاع أو الاستبدال حسب <a href="${policyPath("ar", "returns")}">سياسة الاسترجاع والاستبدال</a>.</li>
<li>قد نعتذر عن تنفيذ طلب إذا كانت بياناته ناقصة أو غير صحيحة ولم نتمكن من التواصل معكِ، أو إذا كانت الكميات تدل على إعادة البيع. وفي هذه الحالة نردّ أي مبلغ دفعتِه.</li>
</ul>

<h2>3. الأسعار والدفع</h2>
<ul>
<li>الأسعار بالجنيه المصري ومكتوبة على كل منتج، وهي نهائية: لا نضيف عليها أي ضرائب أو رسوم غير مصاريف الشحن الظاهرة في السلة.</li>
<li>السعر الذي أُكِّد به طلبكِ هو ما تدفعينه، حتى لو تغير السعر بعد ذلك.</li>
<li>مصاريف الشحن موضحة في صفحة <a href="${policyPath("ar", "shipping")}">الشحن والتوصيل</a>، وتظهر في الإجمالي قبل إرسال الطلب.</li>
<li>طرق الدفع: الدفع عند الاستلام، أو التحويل عبر InstaPay إلى ${ltr(site.instapay)}.</li>
<li>إذا ظهر خطأ في سعر أو وصف على الموقع، نخبركِ قبل الشحن، ولكِ أن تكملي بالسعر الصحيح أو تلغي الطلب دون مصاريف.</li>
</ul>

<h2>4. المنتجات والضمان</h2>
<ul>
<li>الأحزمة مصنوعة من جلد PU مستورد، أو من الدانتيل حسب الموديل، والخامة والمقاس مكتوبان في تفاصيل كل منتج.</li>
<li>أحزمة الجلد الطبيعي تُفصّل حسب الطلب فقط، بالتواصل على واتساب، وهي متاحة في القاهرة والجيزة فقط، ويُتفق على سعرها ومقاسها قبل التنفيذ.</li>
<li>نعرض الألوان والتفاصيل بأدق شكل ممكن، لكن الألوان قد تختلف قليلًا حسب الشاشة.</li>
<li>نستبدل أو نردّ ثمن أي منتج به عيب صناعة إذا أبلغتِنا به خلال ${site.defectDays} يومًا من استلامه، والإرجاع والاستبدال لأي سبب آخر حسب <a href="${policyPath("ar", "returns")}">سياسة الاسترجاع والاستبدال</a>.</li>
</ul>

<h2 id="offers">5. العروض وأكواد الخصم</h2>
<p>قد نعلن عروضًا أو أكواد خصم لفترة محددة على الموقع أو على حساباتنا، وشروط كل منها مكتوبة معه. وتسري عليها القواعد التالية، إلا إذا نُصّ على غير ذلك:</p>
<ul>
<li>كود الخصم مبلغ ثابت يُخصم من سعر الأحزمة، وليس من الشحن. تكتبينه في خانة «كود الخصم» قبل تأكيد الطلب، ويظهر الخصم في الإجمالي قبل الإرسال.</li>
<li>كود واحد لكل طلب، ولا يُجمع عرضان على الطلب نفسه.</li>
<li>قد يكون للكود حد أدنى لقيمة الأحزمة، أو آخر يوم، أو عدد مرات استخدام، ونذكر ذلك عند الإعلان عنه.</li>
<li>الشحن العادي المجاني (للطلبات من ${fees.freeOver} جنيه) يُحسب على المبلغ بعد الخصم.</li>
<li>إذا أرجعتِ جزءًا من طلب استخدمتِ فيه كود خصم، يُوزَّع الخصم على أحزمة الطلب بنسبة أسعارها، ونردّ لكِ ما دفعتِه فعليًا مقابل ما أرجعتِه.</li>
<li>الكود لا يُستبدل بمال.</li>
<li>العرض أو الكود متاح حتى نهاية مدته أو نفاد الكمية المخصصة له، والطلبات التي أُكِّدت قبل انتهائه أو تعديله تبقى على شروطه وقت تأكيدها.</li>
<li>إذا تبيّن استخدام غير عادل لعرض أو كود، مثل الطلبات الوهمية، يحق لنا إلغاء الخصم.</li>
</ul>

<h2>6. صحة البيانات</h2>
<p>نحتاج منكِ بيانات صحيحة وكاملة لنستطيع توصيل طلبكِ. وإذا تأخر التوصيل بسبب بيانات غير صحيحة، نتواصل معكِ لحل المشكلة.</p>

<h2>7. روابط ومنصات أخرى</h2>
<p>في الموقع روابط إلى واتساب وحساباتنا على مواقع التواصل. هذه المنصات مستقلة عنا، ولها شروطها وسياساتها الخاصة.</p>

<h2>8. الاستخدامات الممنوعة</h2>
<p>يُمنع استخدام الموقع في أي غرض غير قانوني، أو انتهاك حقوق الملكية الفكرية لنا أو لغيرنا، أو الإساءة إلى أي شخص، أو تقديم بيانات كاذبة أو طلبات وهمية، أو رفع أي كود ضار، أو جمع بيانات الآخرين، أو محاولة تعطيل الموقع أو التحايل على حمايته.</p>

<h2>9. حقوق الملكية</h2>
<p>صور المنتجات والتصميمات والشعار ومحتوى الموقع ملك لفيكونا، ولا يجوز نقلها أو استخدامها تجاريًا دون إذن مكتوب منا.</p>

<h2>10. ما ترسلينه لنا وآراء العميلات</h2>
<ul>
<li>لا ننشر صورتكِ أو رأيكِ أو اسمكِ إلا بإذنكِ الصريح، ويمكنكِ طلب حذفها في أي وقت فنحذفها.</li>
<li>لا ننشر آراء أو تقييمات مختلَقة، ولا نعدّل رأيًا نشرناه بما يغيّر معناه.</li>
<li>اقتراحاتكِ وملاحظاتكِ على الموقع والمنتجات تساعدنا، ويمكننا استخدامها لتحسين ما نقدمه.</li>
</ul>

<h2>11. الإبلاغ عن مخالفة</h2>
<p>إذا رأيتِ على الموقع ما يخالف القانون، أو ما تعتقدين أنه يعتدي على حقوق ملكيتكِ الفكرية، راسلينا مع رابط الصفحة وشرح بسيط. نؤكد استلام رسالتكِ، ونراجعها، ونخبركِ بما فعلناه.</p>

<h2>12. تغيير المنتجات والموقع</h2>
<p>قد نغيّر التصميمات أو الأسعار أو نوقف بعض المنتجات أو أجزاء من الموقع. ولا يؤثر ذلك على أي طلب تأكد قبل التغيير، فيبقى بسعره وشروطه.</p>

<h2>13. المسؤولية</h2>
<p>نبذل كل جهدنا ليعمل الموقع دون أخطاء، لكن لا نضمن أن يعمل طوال الوقت دون انقطاع. ولا يحد ذلك من مسؤوليتنا عن المنتجات التي نبيعها أو من أي حق لكِ في القانون.</p>

<h2>14. حماية المستهلك</h2>
<p>هذه الشروط لا تنتقص من أي حق لكِ في قانون حماية المستهلك رقم 181 لسنة 2018، وأي شرط يخالفه لا يُعمل به. ويمكنكِ تقديم شكوى إلى جهاز حماية المستهلك على الخط الساخن ${ltr(ca.hotline)} أو من موقعه <a href="${ca.url}" rel="noopener noreferrer">${ltr("cpa.gov.eg")}</a>.</p>

<h2>15. إذا بطل بند</h2>
<p>إذا تبيّن أن أي بند في هذه الشروط غير قانوني أو غير قابل للتطبيق، تبقى بقية البنود سارية.</p>

<h2>16. القانون المطبق</h2>
<p>تخضع هذه الشروط للقوانين المصرية، وتختص بنظر أي نزاع المحاكم المصرية المختصة.</p>

<h2>17. تعديل الشروط</h2>
<p>قد نحدّث هذه الشروط من وقت لآخر، ويسري التعديل من وقت نشره هنا، وتاريخ آخر تحديث مكتوب أعلى الصفحة. الطلبات التي تأكدت قبل التعديل تبقى على الشروط التي كانت سارية وقتها. هذه الشروط مع <a href="${policyPath("ar", "shipping")}">الشحن والتوصيل</a> و<a href="${policyPath("ar", "returns")}">الاسترجاع والاستبدال</a> و<a href="${policyPath("ar", "privacy")}">الخصوصية</a> و<a href="${policyPath("ar", "cookies")}">الكوكيز</a> هي الاتفاق الكامل بيننا، وأي وعد إضافي نعطيكِ إياه كتابةً على واتساب أو البريد نلتزم به.</p>

<h2>18. تواصلي معنا</h2>
${contactHtml("ar", "السلام عليكم، عندي سؤال عن الشروط")}
<p>اقرئي أيضًا <a href="${policyPath("ar", "returns")}">الاسترجاع والاستبدال</a> و<a href="${policyPath("ar", "privacy")}">سياسة الخصوصية</a>.</p>
`,
};

export const termsEn: PolicyDoc = {
  title: "Terms and conditions",
  description: "Terms for ordering from Vicuna: company details, orders, prices and payment, offers, and your consumer rights.",
  html: `
<p>This website belongs to <b>${site.legalNameEn}</b> (${site.legalNameAr}), a ${site.legalFormEn} registered in the commercial register under no. ${site.commercialRegister}${
    site.taxNumber ? `, tax registration no. ${site.taxNumber}` : ""
  }, with its head office at ${site.addressEn}. "We" on this page means Vicuna. By using the website or ordering from it, you agree to these terms.</p>

<h2>1. Using the website</h2>
<ul>
<li>By using the website you confirm that you are of legal age, or that your parent or guardian agrees to your order.</li>
<li>You may not use the website or our products for any unlawful purpose.</li>
<li>You do not need an account or a password to order, and we only ask for the details needed to deliver your order.</li>
</ul>

<h2>2. Orders</h2>
<ul>
<li>You send your order from the cart on the website and see its order number.</li>
<li>We contact you on WhatsApp or by phone to confirm your details, the total and the payment method; the order is confirmed after that contact.</li>
<li>If an item runs out after you order for any reason, we tell you at once: you choose a replacement, or we cancel the order free of charge and refund anything you paid.</li>
<li>You can change or cancel the order free of charge at any time before it ships; after it ships you can return or exchange it under the <a href="${policyPath("en", "returns")}">returns and exchanges policy</a>.</li>
<li>We may decline an order if its details are missing or wrong and we cannot reach you, or if the quantities suggest resale. We then refund anything you paid.</li>
</ul>

<h2>3. Prices and payment</h2>
<ul>
<li>Prices are in Egyptian pounds, shown on each product, and final: we add no taxes or fees other than the shipping fee shown in the cart.</li>
<li>You pay the price your order was confirmed at, even if the price changes later.</li>
<li>Shipping fees are on the <a href="${policyPath("en", "shipping")}">shipping and delivery</a> page and appear in the total before you send the order.</li>
<li>Payment: cash on delivery, or InstaPay to ${site.instapay}.</li>
<li>If a price or description on the website is wrong, we tell you before shipping, and you may continue at the correct price or cancel free of charge.</li>
</ul>

<h2>4. Products and warranty</h2>
<ul>
<li>Our belts are made of imported PU leather, or lace depending on the style; the material and size are listed on each product.</li>
<li>Natural leather belts are made to measure only, on request via WhatsApp, available in Cairo and Giza only, with price and size agreed before we start.</li>
<li>We show colours and details as accurately as we can, but colours can look slightly different on different screens.</li>
<li>We replace or refund any item with a manufacturing fault that you report within ${site.defectDays} days of delivery; returns and exchanges for any other reason follow the <a href="${policyPath("en", "returns")}">returns and exchanges policy</a>.</li>
</ul>

<h2 id="offers">5. Offers and promo codes</h2>
<p>We may announce time-limited offers or promo codes on the website or our accounts; each one states its own terms. These rules apply unless an offer or code says otherwise:</p>
<ul>
<li>A promo code takes a fixed amount off the belts, not off shipping. You enter it in the "Promo code" field before placing the order, and the discount shows in the total before you send it.</li>
<li>One code per order, and two offers cannot be combined on the same order.</li>
<li>A code may have a minimum belts amount, a last day or a limited number of uses; we say so when we announce it.</li>
<li>Free standard shipping (orders of EGP ${fees.freeOver} or more) is based on the amount after the discount.</li>
<li>If you return part of an order that used a promo code, the discount is spread over the order's belts in proportion to their prices, and we refund what you actually paid for what you return.</li>
<li>A code cannot be exchanged for money.</li>
<li>An offer or code lasts until its end date or until its allocated stock runs out; orders confirmed before it ends or changes keep its terms as they were when confirmed.</li>
<li>If an offer or code is used unfairly, such as through fake orders, we may cancel the discount.</li>
</ul>

<h2>6. Accurate details</h2>
<p>We need correct and complete details to deliver your order. If delivery is delayed because of wrong details, we contact you to sort it out.</p>

<h2>7. Links and other platforms</h2>
<p>The website links to WhatsApp and our social media accounts. These platforms are independent of us and have their own terms and policies.</p>

<h2>8. Prohibited use</h2>
<p>You may not use the website for anything unlawful, to infringe our or anyone's intellectual property, to abuse anyone, to give false details or place fake orders, to upload harmful code, to collect other people's data, or to try to disrupt the website or get around its protection.</p>

<h2>9. Intellectual property</h2>
<p>Product photos, designs, the logo and the website's content belong to Vicuna and may not be copied or used commercially without our written permission.</p>

<h2>10. What you send us, and reviews</h2>
<ul>
<li>We publish your photo, review or name only with your explicit permission, and we remove it whenever you ask.</li>
<li>We never publish invented reviews or ratings, and we never edit a published review in a way that changes its meaning.</li>
<li>Your suggestions about the website and products help us, and we may use them to improve what we offer.</li>
</ul>

<h2>11. Reporting a problem</h2>
<p>If you see anything on the website that breaks the law, or that you believe infringes your intellectual property, message us with the page link and a short explanation. We confirm we received it, review it, and tell you what we did.</p>

<h2>12. Changes to products and the website</h2>
<p>We may change designs or prices, or stop some products or parts of the website. This does not affect any order confirmed before the change, which keeps its price and terms.</p>

<h2>13. Liability</h2>
<p>We do our best to keep the website working without errors, but we cannot guarantee it will always be available. This does not limit our responsibility for the products we sell or any of your rights under the law.</p>

<h2>14. Consumer protection</h2>
<p>These terms do not reduce any of your rights under Egypt's Consumer Protection Law No. 181 of 2018, and any term that conflicts with it does not apply. You can complain to the Consumer Protection Agency on hotline ${ca.hotline} or at <a href="${ca.url}" rel="noopener noreferrer">cpa.gov.eg</a>.</p>

<h2>15. Severability</h2>
<p>If any term here is found unlawful or unenforceable, the remaining terms stay in force.</p>

<h2>16. Governing law</h2>
<p>These terms are governed by Egyptian law, and the competent Egyptian courts hear any dispute.</p>

<h2>17. Changes</h2>
<p>We may update these terms from time to time. Changes apply from when they are published here; the date of the last update is shown at the top. Orders confirmed before a change keep the terms in force when they were confirmed. These terms, together with <a href="${policyPath("en", "shipping")}">shipping and delivery</a>, <a href="${policyPath("en", "returns")}">returns and exchanges</a>, <a href="${policyPath("en", "privacy")}">privacy</a> and <a href="${policyPath("en", "cookies")}">cookies</a>, are the whole agreement between us, and we keep any extra promise we give you in writing on WhatsApp or by email.</p>

<h2>18. Contact us</h2>
${contactHtml("en", "Hello, I have a question about the terms")}
<p>See also <a href="${policyPath("en", "returns")}">returns and exchanges</a> and the <a href="${policyPath("en", "privacy")}">privacy policy</a>.</p>
`,
};

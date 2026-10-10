// Privacy policy. Written against Egypt's Personal Data Protection Law 151/2020 and its Executive Regulations
// (Decree 816/2025): controller identity, data collected, purposes, recipients, transfer abroad, retention, rights,
// and the right to complain to the Personal Data Protection Center. It must describe what the site really does:
// orders go to the order API (Cloudflare Worker + D1), a Telegram message reaches the owner, the cart lives in the
// browser, and there are no analytics or ad pixels. Change this page in the same commit as any change to that.
import { site } from "../site.ts";
import { contactHtml, ltr, policyPath } from "./shared.ts";
import type { PolicyDoc } from "./shared.ts";

export const privacyAr: PolicyDoc = {
  title: "سياسة الخصوصية",
  description: "ما البيانات التي تجمعها فيكونا، ولماذا، وأين تُحفظ، ومدة الاحتفاظ بها، وحقوقكِ في بياناتكِ الشخصية.",
  html: `
<p>نجمع أقل قدر من البيانات يلزم لتوصيل طلبكِ. توضح هذه الصفحة ما نجمعه، ولماذا، وأين يُحفظ، ومدة الاحتفاظ به، وحقوقكِ وفق قانون حماية البيانات الشخصية رقم 151 لسنة 2020.</p>

<h2>1. المسؤول عن بياناتكِ</h2>
<p>${site.legalNameAr} (${ltr(site.legalNameEn)})، سجل تجاري رقم ${ltr(site.commercialRegister)}، ومقرها ${site.addressAr}. لأي طلب يخص بياناتكِ:</p>
${contactHtml("ar", "السلام عليكم، عندي طلب بخصوص بياناتي")}

<h2>2. البيانات التي نجمعها</h2>
<ul>
<li><b>بيانات الطلب:</b> الاسم، ورقم الموبايل، والمحافظة، والعنوان، والملاحظات، والمنتجات والكميات، وطريقة الشحن والدفع. تكتبينها في السلة، وتصلنا عند الضغط على «تأكيد الطلب».</li>
<li><b>التواصل:</b> رسائلكِ معنا على واتساب أو البريد، وأي صور ترسلينها، مثل إيصال تحويل InstaPay أو صورة منتج به عيب.</li>
<li><b>الدفع:</b> عند الدفع بـ InstaPay يصلنا ما يظهر في إيصال التحويل، مثل اسم المحوِّل والمبلغ. وعند ردّ مبلغ، نحتاج رقم InstaPay أو المحفظة الذي تختارينه. لا نطلب ولا نحفظ أرقام بطاقات بنكية.</li>
<li><b>الطلبات الخاصة:</b> مقاساتكِ عند طلب مقاس خاص أو حزام مفصّل.</li>
<li><b>بيانات تقنية:</b> عنوان IP ونوع المتصفح والجهاز، تسجلها خدمة الاستضافة تلقائيًا لتشغيل الموقع وحمايته، مثل تحديد عدد الطلبات المسموح به من الجهاز نفسه.</li>
<li><b>على جهازكِ:</b> محتوى السلة يُحفظ في متصفحكِ (localStorage) حتى لا يضيع عند غلق الصفحة، ولا يصلنا إلا عند إرسال الطلب. ورقم آخر طلب وإجماليه وطريقة دفعه تُحفظ مؤقتًا في المتصفح لعرضها في صفحة الشكر، وتُحذف عند غلق تبويب المتصفح.</li>
</ul>

<h2>3. لماذا نستخدمها</h2>
<ul>
<li><b>تنفيذ طلبكِ:</b> تأكيده وتجهيزه وتوصيله، والتواصل معكِ بشأنه، والإرجاع والاستبدال والضمان. أساس ذلك تنفيذ عقد الشراء بيننا.</li>
<li><b>التزاماتنا القانونية:</b> حفظ سجلات المبيعات كما يقتضي القانون المصري، والرد على الجهات الرسمية المختصة.</li>
<li><b>حماية الموقع:</b> منع الطلبات الوهمية والإساءة.</li>
</ul>
<p>لا نرسل لكِ رسائل تسويقية أو عروضًا إلا بعد موافقتكِ الصريحة المسبقة، ويمكنكِ إيقافها في أي وقت.</p>

<h2>4. من يطّلع على بياناتكِ</h2>
<p>لا نبيع بياناتكِ ولا نؤجرها. يطّلع عليها فقط:</p>
<ul>
<li><b>شركة الشحن:</b> الاسم ورقم الموبايل والعنوان، لتوصيل الطلب.</li>
<li><b>Cloudflare:</b> تستضيف الموقع وقاعدة بيانات الطلبات وتحمي الموقع، وتعالج البيانات لحسابنا.</li>
<li><b>خدمات نتواصل من خلالها،</b> ولكل منها سياسة خصوصية خاصة بها:
<ul>
<li>Telegram: نستلم عليه رسالة بكل طلب جديد وكل تغيير في حالته، فيها رقم الطلب وبياناتكِ والمنتجات والإجمالي.</li>
<li>WhatsApp: للتواصل معكِ بشأن الطلب.</li>
<li>Gmail من Google: تصل إليه الرسائل المرسلة إلى بريد فيكونا.</li>
</ul></li>
<li><b>الجهات الرسمية المختصة</b>، إذا طلب القانون ذلك.</li>
</ul>

<h2>5. حفظ البيانات خارج مصر</h2>
<p>تقع خوادم Cloudflare وTelegram وWhatsApp وGoogle خارج مصر، لذلك تُحفظ بيانات طلبكِ وتُعالج خارج مصر، للأغراض المذكورة في هذه الصفحة فقط. نعتمد في ذلك على تنفيذ طلبكِ، وعلى موافقتكِ على هذه السياسة عند إرسال الطلب.</p>

<h2>6. مدة الاحتفاظ</h2>
<ul>
<li><b>بيانات الطلب والمحادثات الخاصة به:</b> طوال المدة اللازمة لتنفيذ الطلب والإرجاع والضمان، وللمدة التي يفرضها القانون المصري لحفظ السجلات التجارية والضريبية، ثم نحذفها.</li>
<li><b>السلة على جهازكِ:</b> حتى تفرغي السلة أو تحذفي بيانات الموقع من المتصفح.</li>
<li><b>البيانات التقنية:</b> لفترة قصيرة لدى خدمة الاستضافة، حسب سياستها.</li>
</ul>

<h2>7. حقوقكِ</h2>
<p>من حقكِ في أي وقت:</p>
<ul>
<li>أن تعرفي البيانات التي لدينا عنكِ، وتحصلي على نسخة منها.</li>
<li>أن تصححيها أو تحدّثيها أو تكمليها.</li>
<li>أن تطلبي حذفها، ما لم يُلزمنا القانون بالاحتفاظ بها.</li>
<li>أن تسحبي موافقتكِ، أو تقصري استخدامها على نطاق محدد، أو تعترضي على استخدامها.</li>
<li>أن نُبلغكِ إذا حدث اختراق يمس بياناتكِ.</li>
</ul>
<p>راسلينا على واتساب أو البريد، ونرد خلال المدة التي يحددها القانون. قد نطلب التأكد من هويتكِ، مثل أن تراسلينا من رقم الموبايل المكتوب في الطلب. ومن حقكِ تقديم شكوى إلى مركز حماية البيانات الشخصية.</p>

<h2>8. الأمان</h2>
<p>الاتصال بالموقع مشفّر (HTTPS)، ولا يُفتح سجل الطلبات من جهتنا إلا من حسابات محمية بتسجيل دخول. وإذا حدث اختراق يمس بياناتكِ، نبلغ مركز حماية البيانات الشخصية ونبلغكِ خلال المدد التي يحددها القانون. ومع ذلك، لا توجد طريقة نقل أو حفظ على الإنترنت آمنة بنسبة 100%.</p>

<h2>9. الكوكيز وأدوات القياس</h2>
<p>الموقع حاليًا لا يستخدم أدوات تحليل أو تتبع إعلاني، مثل Google Analytics أو Meta Pixel. وقد تضيف خدمة الاستضافة كوكيز ضرورية لحماية الموقع فقط. وإذا أضفنا أدوات قياس أو إعلانات لاحقًا، نحدّث هذه الصفحة قبل تشغيلها. التفاصيل في <a href="${policyPath("ar", "cookies")}">سياسة الكوكيز</a>.</p>

<h2>10. السن</h2>
<p>الموقع موجّه لمن بلغن سن الرشد. إذا لم تبلغيه بعد، اطلبي بمعرفة وليّ أمركِ وموافقته.</p>

<h2>11. تعديل السياسة</h2>
<p>قد نحدّث هذه السياسة من وقت لآخر، وتاريخ آخر تحديث مكتوب أعلى الصفحة. وإذا غيّرنا طريقة استخدام بياناتكِ تغييرًا مهمًا، نوضحه في هذه الصفحة.</p>

<p>اقرئي أيضًا <a href="${policyPath("ar", "terms")}">الشروط والأحكام</a> و<a href="${policyPath("ar", "returns")}">الاسترجاع والاستبدال</a>.</p>
`,
};

export const privacyEn: PolicyDoc = {
  title: "Privacy policy",
  description: "What data Vicuna collects, why, where it is kept, for how long, and your rights over your personal data.",
  html: `
<p>We collect the least data needed to deliver your order. This page explains what we collect, why, where it is kept, for how long, and your rights under Egypt's Personal Data Protection Law No. 151 of 2020.</p>

<h2>1. Who is responsible for your data</h2>
<p>${site.legalNameEn} (${site.legalNameAr}), commercial register no. ${site.commercialRegister}, head office ${site.addressEn}. For any request about your data:</p>
${contactHtml("en", "Hello, I have a request about my data")}

<h2>2. What we collect</h2>
<ul>
<li><b>Order details:</b> name, mobile number, governorate, address, notes, items and quantities, shipping and payment method. You enter them in the cart, and they reach us when you press "Place order".</li>
<li><b>Messages:</b> your messages with us on WhatsApp or by email, and any photos you send, such as an InstaPay receipt or a photo of a faulty item.</li>
<li><b>Payment:</b> with InstaPay we see what the transfer receipt shows, such as the sender's name and the amount. To send a refund we need the InstaPay or wallet number you choose. We never ask for or keep card numbers.</li>
<li><b>Special orders:</b> your measurements for a custom size or a made-to-measure belt.</li>
<li><b>Technical data:</b> IP address, browser and device type, logged automatically by our hosting provider to run and protect the website, for example to limit how many orders one device can send.</li>
<li><b>On your device:</b> your cart is kept in your browser (localStorage) so it is not lost when you close the page; it reaches us only when you send the order. Your last order's number, total and payment method are kept briefly in the browser for the thank-you page and are deleted when you close the browser tab.</li>
</ul>

<h2>3. Why we use it</h2>
<ul>
<li><b>To fulfil your order:</b> confirm, prepare and deliver it, contact you about it, and handle returns, exchanges and warranty. The basis is our sales contract.</li>
<li><b>Legal duties:</b> keeping sales records as Egyptian law requires, and answering competent authorities.</li>
<li><b>Protecting the website:</b> preventing fake orders and abuse.</li>
</ul>
<p>We send marketing messages or offers only with your explicit prior consent, and you can stop them at any time.</p>

<h2>4. Who sees your data</h2>
<p>We do not sell or rent your data. Only these see it:</p>
<ul>
<li><b>The courier:</b> name, mobile number and address, to deliver the order.</li>
<li><b>Cloudflare:</b> hosts the website and the order database and protects the website, processing data on our behalf.</li>
<li><b>Services we communicate through,</b> each with its own privacy policy:
<ul>
<li>Telegram: we receive a message for every new order and every status change, with the order number, your details, the items and the total.</li>
<li>WhatsApp: to talk to you about your order.</li>
<li>Gmail by Google: messages sent to Vicuna's email addresses arrive there.</li>
</ul></li>
<li><b>Competent authorities</b>, when the law requires it.</li>
</ul>

<h2>5. Storage outside Egypt</h2>
<p>Cloudflare, Telegram, WhatsApp and Google servers are outside Egypt, so your order details are stored and processed outside Egypt, only for the purposes on this page. We rely on fulfilling your order and on your agreement to this policy when you send the order.</p>

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
<p>The website currently uses no analytics or advertising trackers, such as Google Analytics or the Meta Pixel. Our hosting provider may set cookies that are strictly needed to protect the website. If we add measurement or advertising tools later, we will update this page before turning them on. Details are in the <a href="${policyPath("en", "cookies")}">cookie policy</a>.</p>

<h2>10. Age</h2>
<p>The website is meant for adults of legal age. If you are not of legal age yet, order with your parent's or guardian's knowledge and consent.</p>

<h2>11. Changes</h2>
<p>We may update this policy from time to time; the date of the last update is shown at the top. If we make an important change to how we use your data, we explain it on this page.</p>

<p>See also the <a href="${policyPath("en", "terms")}">terms and conditions</a> and <a href="${policyPath("en", "returns")}">returns and exchanges</a>.</p>
`,
};

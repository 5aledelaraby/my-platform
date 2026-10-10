// Cookies and browser storage. Describes only what the site really sets today. Adding analytics, an ad pixel or any
// optional cookie needs this page, privacy.ts and site.policiesUpdated updated first, and the visitor's consent
// before the tool loads (Personal Data Protection Law 151/2020).
import { site } from "../site.ts";
import { contactHtml, policyPath } from "./shared.ts";
import type { PolicyDoc } from "./shared.ts";

export const cookiesAr: PolicyDoc = {
  title: "سياسة الكوكيز",
  description: "ما الكوكيز والتخزين في المتصفح الذي يستخدمه موقع فيكونا، ولماذا، وكيف تتحكمين فيه.",
  html: `
<p class="policy-summary"><b>باختصار:</b> لا نستخدم كوكيز إعلانية أو أدوات تحليل. نستخدم فقط ما يحتاجه الموقع ليعمل: حفظ السلة في متصفحكِ، وحماية الموقع من الهجمات.</p>

<h2>1. ما الكوكيز؟</h2>
<p>الكوكيز ملفات نصية صغيرة يحفظها الموقع في متصفحكِ. ويشبهها «التخزين المحلي» (localStorage و sessionStorage)، وهو مساحة في متصفحكِ يحفظ فيها الموقع بيانات بسيطة على جهازكِ. في هذه الصفحة نسمّي الاثنين «كوكيز».</p>

<h2>2. ما نستخدمه</h2>
<ul>
<li><b><bdi dir="ltr">vicuna-cart-v1</bdi></b> (تخزين محلي): حفظ محتوى السلة حتى لا يضيع عند غلق الصفحة. لا يصلنا إلا عند إرسال الطلب. <span class="muted">المدة: حتى تفرغي السلة أو تمسحي بيانات المتصفح.</span></li>
<li><b><bdi dir="ltr">vicuna-last-order</bdi></b> (تخزين مؤقت): عرض رقم الطلب وإجماليه في صفحة الشكر. <span class="muted">المدة: يُحذف عند غلق التبويب.</span></li>
<li><b><bdi dir="ltr">__cf_bm</bdi>، <bdi dir="ltr">cf_clearance</bdi></b> (كوكيز ضرورية من Cloudflare): حماية الموقع من الهجمات والزيارات الآلية الضارة. قد تُضاف فقط عند الحاجة. <span class="muted">المدة: من 30 دقيقة حتى سنة.</span></li>
</ul>
<p>كل ما سبق ضروري لعمل الموقع أو حمايته، لذلك لا نطلب موافقة عليه، ولا نستخدمه لتتبعكِ أو لعرض إعلانات.</p>

<h2>3. ما لا نستخدمه</h2>
<p>لا نستخدم حاليًا أي أدوات تحليل أو تتبع إعلاني، مثل Google Analytics أو Meta Pixel أو TikTok Pixel أو Snap Pixel، ولا نبيع أي بيانات. إذا أضفنا أيًا منها لاحقًا، نحدّث هذه الصفحة و<a href="${policyPath("ar", "privacy")}">سياسة الخصوصية</a> أولًا، ونطلب موافقتكِ قبل تشغيلها، ويمكنكِ رفضها دون أن يؤثر ذلك على شرائكِ.</p>

<h2>4. كيف تتحكمين في الكوكيز؟</h2>
<ul>
<li>من إعدادات متصفحكِ يمكنكِ مسح الكوكيز وبيانات المواقع أو منعها. منع الكوكيز الضرورية قد يمنع حفظ السلة أو يُظهر لكِ صفحة تحقق.</li>
<li>تفريغ السلة من الموقع يحذف بياناتها من جهازكِ.</li>
</ul>

<h2>5. تحديث هذه السياسة</h2>
<p>نحدّث هذه الصفحة عند أي تغيير فيما نستخدمه، ونكتب تاريخ آخر تحديث أعلاها.</p>

<h2>6. تواصلي معنا</h2>
${contactHtml("ar", "أهلاً فيكونا، لدي سؤال عن الكوكيز والخصوصية.", site.email)}
`,
};

export const cookiesEn: PolicyDoc = {
  title: "Cookie policy",
  description: "The cookies and browser storage the Vicuna website uses, why, and how you can control them.",
  html: `
<p class="policy-summary"><b>In short:</b> we use no advertising cookies or analytics. We only use what the site needs to work: keeping your cart in your browser and protecting the site from attacks.</p>

<h2>1. What are cookies?</h2>
<p>Cookies are small text files a website saves in your browser. "Local storage" (localStorage and sessionStorage) is similar: space in your browser where a site keeps simple data on your device. On this page we call both "cookies".</p>

<h2>2. What we use</h2>
<ul>
<li><b>vicuna-cart-v1</b> (Local storage): Keeps your cart so it is not lost when you close the page. It reaches us only when you send the order. <span class="muted">Duration: Until you empty the cart or clear your browser data.</span></li>
<li><b>vicuna-last-order</b> (Session storage): Shows your order number and total on the thank-you page. <span class="muted">Duration: Deleted when you close the tab.</span></li>
<li><b>__cf_bm, cf_clearance</b> (Strictly necessary Cloudflare cookies): Protect the site from attacks and harmful automated traffic. Set only when needed. <span class="muted">Duration: 30 minutes to one year.</span></li>
</ul>
<p>All of the above is needed for the site to work or stay secure, so we do not ask for consent, and we never use it to track you or show ads.</p>

<h2>3. What we do not use</h2>
<p>We currently use no analytics or advertising trackers, such as Google Analytics, the Meta Pixel, the TikTok Pixel or the Snap Pixel, and we sell no data. If we add any of them later, we will update this page and the <a href="${policyPath("en", "privacy")}">privacy policy</a> first and ask for your consent before turning them on; you can refuse without it affecting your purchase.</p>

<h2>4. How to control cookies</h2>
<ul>
<li>Your browser settings let you clear or block cookies and site data. Blocking strictly necessary cookies may stop your cart from being saved or show you a check page.</li>
<li>Emptying the cart on the site removes its data from your device.</li>
</ul>

<h2>5. Changes to this policy</h2>
<p>We update this page whenever what we use changes, and show the date of the last update at the top.</p>

<h2>6. Contact us</h2>
${contactHtml("en", "Hello Vicuna, I have a question about cookies and privacy.", site.email)}
`,
};

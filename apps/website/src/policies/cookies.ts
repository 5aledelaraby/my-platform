// Cookies and browser storage. Lists exactly what the site sets (keys in src/scripts, src/components; the tag list
// comes from tags.ts, so a tag without an ID is not listed). Strictly necessary items load always; analytics and
// ad tags (site.ts `tracking`) load only after "Accept" in the cookie banner (Consent.astro), as required by the
// Personal Data Protection Law 151/2020. Any new tag needs this page, privacy.ts and site.policiesUpdated updated first.
import { site } from "../site.ts";
import { contactHtml, policyPath } from "./shared.ts";
import { activeTags, andAr, andEn, tagCompanies } from "./tags.ts";
import type { PolicyDoc } from "./shared.ts";

const li = (name: string, who: string, what: string, how: string) => `<li><b>${name}</b> (${who}): ${what} <span class="muted">${how}</span></li>`;
const tagItemsEn = () => activeTags().flatMap((t) => t.cookies.map((c) => li(c.name, t.tool.en.replace(/^the /, ""), c.en, c.lifeEn))).join("\n");
const tagItemsAr = () => activeTags().flatMap((t) => t.cookies.map((c) => li(`<bdi dir="ltr">${c.name}</bdi>`, t.tool.ar, c.ar, c.lifeAr))).join("\n");

export const cookiesEn: PolicyDoc = {
  title: "Cookie policy",
  description: "The cookies and browser storage the Vicuna website uses, why, and how you can accept, refuse or change them.",
  html: `
<p class="policy-summary"><b>In short:</b> the website needs a few strictly necessary items to work. Analytics and advertising cookies (${andEn(tagCompanies("en"))}) load only if you press "Accept" in the cookie banner, and you can change your choice at any time from "Cookie settings" at the bottom of every page.</p>

<h2>1. What are cookies?</h2>
<p>Cookies are small text files a website saves in your browser. "Local storage" (localStorage and sessionStorage) is similar: space in your browser where a site keeps simple data on your device. On this page we call both "cookies".</p>

<h2>2. Strictly necessary (always on)</h2>
<p>These are needed for the website to work or stay secure, so they do not need your consent. We never use them to track you or show ads.</p>
<ul>
${li("vicuna-cart-v1", "Vicuna, local storage", "keeps your cart so it is not lost when you close the page; it reaches us only when you send the order.", "Until you empty the cart or clear your browser data.")}
${li("vicuna-last-order", "Vicuna, session storage", "shows your order number and total on the thank-you page (with the belts in it, never your name, number or address).", "Deleted when you close the tab.")}
${li("vicuna-tracked-&lt;order number&gt;", "Vicuna, session storage", "set on the thank-you page so an order is counted at most once, and never later if you had not accepted cookies.", "Deleted when you close the tab.")}
${li("vicuna-cart-peeked", "Vicuna, session storage", "the cart opens by itself only after your first added belt.", "Deleted when you close the tab.")}
${li("vicuna-swipe-hint", "Vicuna, session storage", "the small swipe hint on the product photo shows only once.", "Deleted when you close the tab.")}
${li("vicuna-consent", "Vicuna, local storage", "remembers whether you accepted or refused analytics and advertising cookies.", "Until you clear your browser data.")}
${li("__cf_bm, cf_clearance", "Cloudflare", "protect the website from attacks and harmful automated traffic; set only when needed.", "30 minutes to one year.")}
</ul>

<h2>3. Analytics and advertising (only if you accept)</h2>
<p>With your consent we use these tools to understand how the website is used and to show and measure our ads. They record the pages and products you view, items you add to the cart, starting checkout and completed orders (order number and value), with your device, browser and approximate location. Each company uses this data under its own privacy policy and may transfer it outside Egypt.</p>
<ul>
${tagItemsEn()}
</ul>
<p>If you press "Reject", none of these load and nothing about your visit is sent to them. Refusing does not affect your purchase. If you accepted earlier and then reject, we stop loading these tools and delete their cookies from our website. Cookies these companies keep on their own websites (for example when you are logged in to Facebook) are managed in your account with them.</p>

<h2>4. How to change your choice</h2>
<ul>
<li>Press "Cookie settings" at the bottom of any page to show the banner again and choose "Accept" or "Reject".</li>
<li>Your browser settings let you clear or block cookies and site data. Blocking strictly necessary cookies may stop your cart from being saved or show you a check page.</li>
<li>${andEn(tagCompanies("en"))} also offer ad settings in your account with them.</li>
</ul>

<h2>5. Changes to this policy</h2>
<p>We update this page before adding or changing any cookie, and show the date of the last update at the top. See also our <a href="${policyPath("en", "privacy")}">privacy policy</a>.</p>

<h2>6. Contact us</h2>
${contactHtml("en", "Hello Vicuna, I have a question about cookies and privacy.", site.email)}
`,
};

export const cookiesAr: PolicyDoc = {
  title: "سياسة الكوكيز",
  description: "الكوكيز والتخزين في المتصفح الذي يستخدمه موقع فيكونا، ولماذا، وكيف تقبلينه أو ترفضينه.",
  html: `
<p class="policy-summary"><b>باختصار:</b> يحتاج الموقع عناصر ضرورية قليلة ليعمل. أما كوكيز التحليل والإعلانات (${andAr(tagCompanies("ar"))}) فلا تعمل إلا إذا ضغطتِ «موافقة» في شريط الكوكيز، ويمكنكِ تغيير اختياركِ في أي وقت من «إعدادات الكوكيز» أسفل كل صفحة.</p>

<h2>1. ما الكوكيز؟</h2>
<p>ملفات نصية صغيرة يحفظها الموقع في متصفحكِ، ويشبهها «التخزين المحلي» (localStorage و sessionStorage). في هذه الصفحة نسمّي الاثنين «كوكيز».</p>

<h2>2. ضرورية (تعمل دائمًا)</h2>
<ul>
${li('<bdi dir="ltr">vicuna-cart-v1</bdi>', "فيكونا، تخزين محلي", "حفظ محتوى السلة.", "حتى تفرغي السلة أو تمسحي بيانات المتصفح.")}
${li('<bdi dir="ltr">vicuna-last-order</bdi>', "فيكونا، تخزين مؤقت", "عرض رقم الطلب وإجماليه في صفحة الشكر (مع الأحزمة فيه، دون اسمكِ أو رقمكِ أو عنوانكِ).", "يُحذف عند غلق التبويب.")}
${li('<bdi dir="ltr">vicuna-tracked-&lt;رقم الطلب&gt;</bdi>', "فيكونا، تخزين مؤقت", "يُحفظ في صفحة الشكر حتى لا يُحسب الطلب أكثر من مرة، ولا يُحسب لاحقًا إذا لم تكوني وافقتِ على الكوكيز.", "يُحذف عند غلق التبويب.")}
${li('<bdi dir="ltr">vicuna-cart-peeked</bdi>', "فيكونا، تخزين مؤقت", "تفتح السلة وحدها بعد أول حزام تضيفينه فقط.", "يُحذف عند غلق التبويب.")}
${li('<bdi dir="ltr">vicuna-swipe-hint</bdi>', "فيكونا، تخزين مؤقت", "تظهر إشارة السحب على صورة المنتج مرة واحدة فقط.", "يُحذف عند غلق التبويب.")}
${li('<bdi dir="ltr">vicuna-consent</bdi>', "فيكونا، تخزين محلي", "تذكّر موافقتكِ أو رفضكِ لكوكيز التحليل والإعلانات.", "حتى تمسحي بيانات المتصفح.")}
${li('<bdi dir="ltr">__cf_bm</bdi>، <bdi dir="ltr">cf_clearance</bdi>', "Cloudflare", "حماية الموقع من الهجمات والزيارات الآلية الضارة.", "من 30 دقيقة حتى سنة.")}
</ul>

<h2>3. التحليل والإعلانات (فقط إذا وافقتِ)</h2>
<p>نستخدمها بموافقتكِ لنفهم كيف يُستخدم الموقع ولعرض إعلاناتنا وقياسها. تسجّل الصفحات والمنتجات التي تشاهدينها، وما تضيفينه إلى السلة، وبدء الطلب وإتمامه (رقمه وقيمته)، مع نوع الجهاز والمتصفح والموقع التقريبي. وتستخدم كل شركة هذه البيانات وفق سياستها وقد تنقلها إلى خارج مصر.</p>
<ul>
${tagItemsAr()}
</ul>
<p>إذا ضغطتِ «رفض» لا يعمل أي منها، ولا يؤثر ذلك على شرائكِ. وإذا كنتِ وافقتِ من قبل ثم رفضتِ، نتوقف عن تحميل هذه الأدوات ونحذف كوكيزها من موقعنا. أما ما تحفظه هذه الشركات على مواقعها (مثلًا إذا كنتِ مسجلة الدخول في Facebook) فتديرينه من حسابكِ لديها.</p>

<h2>4. كيف تغيّرين اختياركِ</h2>
<ul>
<li>اضغطي «إعدادات الكوكيز» أسفل أي صفحة ليظهر الشريط من جديد.</li>
<li>من إعدادات متصفحكِ يمكنكِ مسح الكوكيز أو منعها.</li>
</ul>

<h2>5. تحديث هذه السياسة</h2>
<p>نحدّث هذه الصفحة قبل إضافة أي كوكيز أو تغييرها. اقرئي أيضًا <a href="${policyPath("ar", "privacy")}">سياسة الخصوصية</a>.</p>

<h2>6. تواصلي معنا</h2>
${contactHtml("ar", "أهلاً فيكونا، لدي سؤال عن الكوكيز والخصوصية.", site.email)}
`,
};

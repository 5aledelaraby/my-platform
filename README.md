# my-platform

منصة Vicuna (فيكونا): متجر أحزمة نسائية + محتوى SEO، مبنية كـ **Modular Monolith** داخل monorepo واحد.

- القواعد لأي مبرمج أو AI: [`AGENTS.md`](AGENTS.md)
- قرارات المعمارية: [`architecture/adr/`](architecture/adr)
- جرد ما سيتم نقله من الموقع القديم: [`MIGRATION.md`](MIGRATION.md)
- هيكل الموقع (الرئيسية تعريف، المتجر `/collections/vicuna-belts/`): [`ADR 0009`](architecture/adr/0009-homepage-is-brand-introduction.md)
- خريطة التوسع (كل مجال مستقبلي: أين يعيش ومتى يتبني): [`architecture/ROADMAP.md`](architecture/ROADMAP.md)
- إزاي تضيف أي حاجة جديدة: [`architecture/HOW-TO-ADD.md`](architecture/HOW-TO-ADD.md)

## الحالة الحالية

| الجزء | الحالة |
|---|---|
| `packages/commerce` (فلوس، أكواد الخصم، إجماليات السلة، المخزون) | جاهز ومختبر |
| `packages/seo` (canonical، robots، sitemap، JSON-LD) | جاهز ومختبر |
| `packages/content` (التحقق من بيانات المقالات) | جاهز ومختبر |
| `packages/ui` | هيكل فاضي لحد ما نحتاج مكون مشترك |
| `apps/api` (الطلبات، المخزون، أكواد الخصم، D1) | منشور على Cloudflare Workers (`vicuna-api`) ومربوط بقاعدة D1، ومعاه صفحة الإدارة على `admin.vicuna-eg.com`، وإشعارات Telegram، وحدث الشراء لـ Meta (CAPI)، ونسخة احتياطية يومية وفحص كل ساعة (`apps/api/README.md`) |
| `apps/website` | منشور على **vicuna-eg.com** (`vicuna-site-production` من `main`)، ونسخة تجريبية على `staging.vicuna-eg.com` (`vicuna-site` من `staging`). رئيسية تعريفية، المتجر `/collections/vicuna-belts/` (5 تصميمات و18 منتج) عربي/إنجليزي، المقالات `/journal/style-guides/`، السلة (شحن عادي وسريع واستلام من المقر)، صفحة الشكر، صفحات السياسات، شريط الكوكيز، Meta Pixel وGA4، وملف الكتالوج `/catalog/products.csv` لـ Meta وGoogle. Worker صغير بيخفي أي حزام مخزونه صفر (ADR 0013). PageSpeed: 100 في الأربعة على الموبايل والكمبيوتر (2026-10-18) (`apps/website/README.md`) |
| حدود الاعتمادية + فحص الأسرار + CI | جاهزين |

## تشغيل المشروع (أول مرة)

على جهاز أو GitHub Codespaces عنده إنترنت عادي:

```bash
corepack enable
pnpm install --frozen-lockfile   # ملف pnpm-lock.yaml موجود في الريبو: لا تعدّله يدويًا
pnpm run check                   # لازم ينجح كله (بيبني نسخة الإنتاج للفحص)
```

بناء الموقع لوحده لازم يحدد البيئة صراحةً، ومفيش قيمة افتراضية: `DEPLOY_ENV=production|staging|preview`. أي بناء من غيرها بيفشل برسالة واضحة، علشان ولا نسخة تجريبية تتفهرس في جوجل بالغلط، ولا نسخة الإنتاج تتقفل بالغلط.

الـ CI بيشغّل الحراس والاختبارات وtypecheck وlint وبناء الإنتاج مع كل push على `main` وكل pull request. الـ typecheck بيشمل الموقع كمان (ملفات Astro وTypeScript) بـ `astro-check`.

## إضافة وحدة جديدة

```bash
node tools/architecture/new-unit.mjs package <name> [--may-import a,b]
node tools/architecture/new-unit.mjs app <name> [--may-import a,b]
```

بيعمل الهيكل ويسجّل الوحدة ويشغّل فحص الحدود. المبدأ: لا وحدة قبل مستهلك حقيقي.

## قرار واتساب والطلبات

واتساب قناة اختيارية بعد إنشاء الطلب، مش أساس نظام الطلبات ([ADR 0007](architecture/adr/0007-whatsapp-is-an-optional-channel.md)). الطلب بيتسجل عبر الـ API ([ADR 0008](architecture/adr/0008-order-api.md)). صفحة الإدارة (الطلبات والمخزون وأكواد الخصم) شغالة على `admin.vicuna-eg.com` ([ADR 0010](architecture/adr/0010-inventory-and-owner-admin.md)). الدفع: عند الاستلام، أو أونلاين بالكارت أو PayPal بالدولار في صفحة الشكر ([ADR 0014](architecture/adr/0014-paypal-in-us-dollars.md))؛ InstaPay اتشال (2026-10-18).

## الخطوة التالية

1. (تم) lockfile وCI، والموقع (Astro)، ونقل المقالات، ونشر الـ API والموقع على Cloudflare Workers، وصفحة الإدارة، والمخزون، وأكواد الخصم.
2. (تم) الـ migrations من 0001 لـ 0005 متنفذة على القاعدتين. على `vicuna-db` (الإنتاج) اتنفذت يدويًا من الـ Console، فمفيش فيها جدول `d1_migrations`: **ممنوع** تشغيل `wrangler d1 migrations apply` عليها قبل ما الجدول يتعمل وتتسجل فيه 0001 لـ 0005 (زي ما اتعمل في `vicuna-db-staging`)، وإلا هيحاول ينفذ 0001 تاني.
3. (تم 2026-10-17) تحويل الدومين: `vicuna-eg.com` على `vicuna-site-production`، بداية نظيفة من غير تحويلات من روابط الموقع القديم. ملف الكتالوج على نفس الرابط القديم.
4. (تم 2026-10-18) السرعة: PageSpeed 100 في الأربعة على الموبايل والكمبيوتر.
5. طلب تجربة حقيقي من الموقع العام، والتأكد إن حدث الشراء وصل لـ Meta من المتصفح والسيرفر (Events Manager) ولـ GA4، وبعدها يتلغي من صفحة الإدارة. بعدها يتمسح الـ Worker القديم `vicuna-capi`.
6. (تم) حماية `main`: Ruleset «Protect main» شغال، ويشترط نجاح `guards-and-tests` و`full`.

## قاعدة أمان

لا تعطي أي AI أو أي شخص: كلمات سر، أو tokens، أو مفاتيح API. الأسرار (Telegram وCloudflare Access ومفتاح Meta Conversions API باسم `META_TOKEN`) بتتحط في Cloudflare Secrets بس. التتبع بيشتغل بعد موافقة الزائرة على الكوكيز بس، ومع الموافقة دي الـ API بيبعت حدث الشراء لـ Meta من السيرفر كمان (الموبايل مشفّر، من غير الاسم والعنوان).

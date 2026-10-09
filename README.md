# my-platform

منصة Vicuna (فيكونا): متجر أحزمة نسائية + محتوى SEO، مبنية كـ **Modular Monolith** داخل monorepo واحد.

- القواعد لأي مبرمج أو AI: [`AGENTS.md`](AGENTS.md)
- قرارات المعمارية: [`architecture/adr/`](architecture/adr)
- جرد ما سيتم نقله من الموقع القديم: [`MIGRATION.md`](MIGRATION.md)
- هيكل الموقع (الرئيسية تعريف، المتجر `/belts/`): [`ADR 0009`](architecture/adr/0009-homepage-is-brand-introduction.md)
- خريطة التوسع (كل مجال مستقبلي: أين يعيش ومتى يتبني): [`architecture/ROADMAP.md`](architecture/ROADMAP.md)
- إزاي تضيف أي حاجة جديدة: [`architecture/HOW-TO-ADD.md`](architecture/HOW-TO-ADD.md)

## الحالة الحالية

| الجزء | الحالة |
|---|---|
| `packages/commerce` (فلوس، خصم، إجماليات السلة) | جاهز ومختبر (مطابق لمنطق الموقع القديم) |
| `packages/seo` (canonical، robots، sitemap، JSON-LD) | جاهز ومختبر |
| `packages/content` (التحقق من بيانات المقالات) | جاهز ومختبر |
| `packages/ui` | هيكل فاضي لحد ما نحتاج مكون مشترك |
| `apps/api` (إنشاء الطلبات، D1) | منشور على Cloudflare Workers (`vicuna-api`) ومربوط بقاعدة D1 (`apps/api/README.md`) |
| `apps/website` | Astro شغال: رئيسية تعريفية، المتجر `/belts/` (6 تصاميم و38 منتج) عربي/إنجليزي، المقالات `/blog/`، السلة، صفحات الشكر. منشور كنسخة تجريبية (staging) على Cloudflare Workers (`vicuna-site`) |
| حدود الاعتمادية + فحص الأسرار + CI | جاهزين |

## تشغيل المشروع (أول مرة)

على جهاز أو GitHub Codespaces عنده إنترنت عادي:

```bash
corepack enable
pnpm install --frozen-lockfile   # ملف pnpm-lock.yaml موجود في الريبو: لا تعدّله يدويًا
pnpm run check                   # لازم ينجح كله (بيبني نسخة الإنتاج للفحص)
```

بناء الموقع لوحده لازم يحدد البيئة صراحةً، ومفيش قيمة افتراضية: `DEPLOY_ENV=production|staging|preview`. أي بناء من غيرها بيفشل برسالة واضحة، علشان ولا نسخة تجريبية تتفهرس في جوجل بالغلط، ولا نسخة الإنتاج تتقفل بالغلط.

الـ CI بيشغّل الحراس والاختبارات وtypecheck وlint وبناء الإنتاج مع كل push على `main` وكل pull request. ملحوظة: كود الموقع نفسه (`apps/website`) لسه مش داخل الـ typecheck، لأنه محتاج `astro check`.

## إضافة وحدة جديدة

```bash
node tools/architecture/new-unit.mjs package <name> [--may-import a,b]
node tools/architecture/new-unit.mjs app <name> [--may-import a,b]
```

بيعمل الهيكل ويسجّل الوحدة ويشغّل فحص الحدود. المبدأ: لا وحدة قبل مستهلك حقيقي.

## قرار واتساب والطلبات

واتساب قناة اختيارية بعد إنشاء الطلب، مش أساس نظام الطلبات ([ADR 0007](architecture/adr/0007-whatsapp-is-an-optional-channel.md)). الطلب بيتسجل عبر الـ API ([ADR 0008](architecture/adr/0008-order-api.md)). لوحة الإدارة والدفع الأونلاين لسه مش مبنيين.

## الخطوة التالية

1. (تم) lockfile وCI، والموقع (Astro)، ونقل المقالات، ونشر الـ API والموقع على Cloudflare Workers.
2. اختبار الطلب كامل على `staging.vicuna-eg.com` (السلة ثم الـ API ثم D1 ثم صفحة الشكر).
3. قبل تحويل الدومين: رقم التسجيل الضريبي في صفحة الشروط، وفصل قاعدة بيانات التجربة عن الإنتاج. القائمة الكاملة في `MIGRATION.md`.
4. تحويل الدومين: `DEPLOY_ENV=production` وربط `vicuna-eg.com`. تحويلات 301 من روابط الموقع القديم جاهزة في `apps/website/public/_redirects`.
5. تفعيل Branch protection على `main` (يشترط نجاح الـ CI قبل الدمج).

## قاعدة أمان

لا تعطي أي AI أو أي شخص: كلمات سر، أو tokens، أو مفاتيح API. توكن Meta CAPI يعيش في Cloudflare Secrets فقط باسم `META_TOKEN`.

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
| `apps/api` (إنشاء الطلبات، D1) | كود واختبارات جاهزة. **محتاج نشر على Cloudflare** (`apps/api/README.md`) |
| `apps/website` | Astro شغال: تخطيط + رئيسية تعريفية عربي/إنجليزي + فحص SEO بعد البناء. `/belts/` لسه  |
| حدود الاعتمادية + فحص الأسرار + CI | جاهزين |

## تشغيل المشروع (أول مرة)

على جهاز أو GitHub Codespaces عنده إنترنت عادي:

```bash
corepack enable
pnpm install          # هيعمل ملف pnpm-lock.yaml: اعمله commit مرة واحدة
pnpm check            # لازم ينجح كله
```

بعد ما `pnpm-lock.yaml` يتحط في الريبو، الـ CI الكامل (typecheck + lint + build) بيشتغل تلقائيًا. قبلها بيشتغل فقط جزء الاختبارات والحراس اللي مش محتاجين تنصيب.

## إضافة وحدة جديدة

```bash
node tools/architecture/new-unit.mjs package <name> [--may-import a,b]
node tools/architecture/new-unit.mjs app <name> [--may-import a,b]
```

بيعمل الهيكل ويسجّل الوحدة ويشغّل فحص الحدود. المبدأ: لا وحدة قبل مستهلك حقيقي.

## قرار واتساب والطلبات

واتساب قناة اختيارية بعد إنشاء الطلب، مش أساس نظام الطلبات ([ADR 0007](architecture/adr/0007-whatsapp-is-an-optional-channel.md)). الطلب بيتسجل عبر الـ API ([ADR 0008](architecture/adr/0008-order-api.md)). لوحة الإدارة والدفع الأونلاين لسه مش مبنيين.

## الخطوة التالية

1. (تم) lockfile وCI.
2. Scaffold لـ `apps/website` (الخطوات في [`apps/website/README.md`](apps/website/README.md)).
3. نشر `apps/api` على Cloudflare (D1 + route) واختباره بـ curl.
4. نقل المقالات والصور والصفحات من الموقع القديم (راجع `MIGRATION.md`) وربط السلة بالـ API.
5. ربط Cloudflare Pages بـ `staging.vicuna-eg.com` بوضع `noindex`.
6. تفعيل Branch protection على `main` (يشترط نجاح الـ CI قبل الدمج).

## قاعدة أمان

لا تعطي أي AI أو أي شخص: كلمات سر، أو tokens، أو مفاتيح API. توكن Meta CAPI يعيش في Cloudflare Secrets فقط باسم `META_TOKEN`.

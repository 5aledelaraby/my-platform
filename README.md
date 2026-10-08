# my-platform

منصة Vicuna (فيكونا): متجر أحزمة نسائية + محتوى SEO، مبنية كـ **Modular Monolith** داخل monorepo واحد.

- القواعد لأي مبرمج أو AI: [`AGENTS.md`](AGENTS.md)
- قرارات المعمارية: [`architecture/adr/`](architecture/adr)
- جرد ما سيتم نقله من الموقع القديم: [`MIGRATION.md`](MIGRATION.md)
- خريطة التوسع (كل مجال مستقبلي: أين يعيش ومتى يتبني): [`architecture/ROADMAP.md`](architecture/ROADMAP.md)
- إزاي تضيف أي حاجة جديدة: [`architecture/HOW-TO-ADD.md`](architecture/HOW-TO-ADD.md)

## الحالة الحالية

| الجزء | الحالة |
|---|---|
| `packages/commerce` (فلوس، خصم، إجماليات السلة) | جاهز ومختبر (مطابق لمنطق الموقع القديم) |
| `packages/seo` (canonical، robots، sitemap، JSON-LD) | جاهز ومختبر |
| `packages/content` (التحقق من بيانات المقالات) | جاهز ومختبر |
| `packages/ui` | هيكل فاضي لحد ما نحتاج مكون مشترك |
| `apps/website` | **لسه محتاج scaffold لـ Astro** (الخطوة التالية) |
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

واتساب قناة اختيارية، مش أساس نظام الطلبات، والمرحلة الأولى بدون Worker أو قاعدة بيانات أو لوحة إدارة أو دفع أونلاين. التفاصيل في [ADR 0007](architecture/adr/0007-whatsapp-is-an-optional-channel.md).

## الخطوة التالية

1. `pnpm install` وcommit للـ lockfile.
2. Scaffold لـ `apps/website` (الخطوات في [`apps/website/README.md`](apps/website/README.md)).
3. نقل المنتجات والمقالات من الموقع القديم (راجع `MIGRATION.md`).
4. ربط Cloudflare Pages بـ `staging.vicuna-eg.com` بوضع `noindex`.
5. تفعيل Branch protection على `main` (يشترط نجاح الـ CI قبل الدمج).

## قاعدة أمان

لا تعطي أي AI أو أي شخص: كلمات سر، أو tokens، أو مفاتيح API. توكن Meta CAPI يعيش في Cloudflare Secrets فقط باسم `META_TOKEN`.

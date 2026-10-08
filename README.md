# my-platform

منصة Vicuna (فيكونا): متجر أحزمة نسائية + محتوى SEO، مبنية كـ **Modular Monolith** داخل monorepo واحد.

- القواعد لأي مبرمج أو AI: [`AGENTS.md`](AGENTS.md)
- قرارات المعمارية: [`architecture/adr/`](architecture/adr)
- جرد ما سيتم نقله من الموقع القديم: [`MIGRATION.md`](MIGRATION.md)

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

## الخطوة التالية

1. `pnpm install` وcommit للـ lockfile.
2. Scaffold لـ `apps/website` (الخطوات في [`apps/website/README.md`](apps/website/README.md)).
3. نقل المنتجات والمقالات من الموقع القديم (راجع `MIGRATION.md`).
4. ربط Cloudflare Pages بـ `staging.vicuna-eg.com` بوضع `noindex`.
5. تفعيل Branch protection على `main` (يشترط نجاح الـ CI قبل الدمج).

## قاعدة أمان

لا تعطي أي AI أو أي شخص: كلمات سر، أو tokens، أو مفاتيح API. توكن Meta CAPI يعيش في Cloudflare Secrets فقط باسم `META_TOKEN`.

# apps/website

الواجهة الأمامية للمتجر: Astro (صفحات ثابتة HTML). السلة سكربت TypeScript صغير من غير أي framework.

## الحالة

تخطيط كامل (هيدر، فوتر، خطوط، ألوان)، ورئيسية تعريفية عربي `/` وإنجليزي `/en/` حسب ADR 0009. بعد كل بناء بيشتغل `scripts/check-dist.mjs` (title، description، canonical، robots، h1، hreflang، الروابط الداخلية، لا شبكة منتجات في الرئيسية، ميزانية JS). المتجر: `/belts/` (كل الأحزمة)، `/belts/<style>/` (6 أنماط)، `/belts/<product-id>/` (38 منتج) بالعربي والإنجليزي، مع sitemap.xml وrobots.txt. السلة (drawer عام في كل الصفحات، محفوظة في المتصفح) بتبعت الطلب لـ `POST /api/orders` وبعدها `/thanks/` أو `/en/thanks/`. السلة بتلتزم بنفس حدود الـ API (20 من المنتج، 50 حزام، 30 منتج مختلف) من `@platform/commerce`. لو الإرسال فشل بتظهر رسالة مع بديل واتساب، والسلة والبيانات بيفضلوا زي ما هم. تقدر تغيّر عنوان الـ API بمتغير `PUBLIC_API_URL`.

ملفات النشر في `public/`: `_headers` (هيدرز أمان، وكاش طويل لملفات `/_astro/`). بيقراه Cloudflare Workers static assets.

## تشغيل

```bash
pnpm --filter @platform/website dev                                  # تجربة محلية (noindex تلقائيًا)
DEPLOY_ENV=production pnpm --filter @platform/website build          # بناء الإنتاج في apps/website/dist + check-dist
DEPLOY_ENV=staging pnpm --filter @platform/website build             # بناء النسخة التجريبية (noindex)
```

`DEPLOY_ENV` إجباري في البناء ومفيش قيمة افتراضية. على Cloudflare بيتحط في Build variables لـ `vicuna-site`.

## قواعد

- الصفحات كلها ثابتة (SSG). التفاعل (السلة وفلتر الألوان) سكربتات صغيرة.
- الأسعار والخصم من `@platform/commerce`، وcanonical وJSON-LD من `@platform/seo`.
- غير الإنتاج يطلع `noindex` وrobots.txt بيمنع الزحف: `DEPLOY_ENV=staging` أو `preview`. `check-dist` بيتأكد من ده في كل بناء.
- هيكل الروابط: ADR 0009 (`/`، `/belts/...`، و`/en/...` للإنجليزي).

## المقالات

المقالات في `content/articles/*.md` (مصدر الحقيقة). اسم الملف = `slug`. الـ frontmatter بيتفحص وقت البناء بـ `parseArticleFrontmatter` (والقيم النصية بين علامتي تنصيص). الصفحات: `/journal/style-guides/` و`/journal/style-guides/<slug>/` (عربي فقط حاليًا، بدون نسخة إنجليزية). الصور داخل المقال لازم تكون مربعة (CSS بيحجز مساحتها).

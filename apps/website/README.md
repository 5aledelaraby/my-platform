# apps/website

الواجهة الأمامية للمتجر: Astro (صفحات ثابتة HTML) وReact للسلة فقط لاحقًا.

## الحالة

تخطيط كامل (هيدر، فوتر، خطوط، ألوان)، ورئيسية تعريفية عربي `/` وإنجليزي `/en/` حسب ADR 0009. بعد كل بناء بيشتغل `scripts/check-dist.mjs` (title، description، canonical، robots، h1، hreflang، الروابط الداخلية، لا شبكة منتجات في الرئيسية، ميزانية JS). المتجر: `/belts/` (كل الأحزمة)، `/belts/<style>/` (6 أنماط)، `/belts/<product-id>/` (38 منتج) بالعربي والإنجليزي، مع sitemap.xml وrobots.txt. السلة (drawer عام في كل الصفحات، محفوظة في المتصفح) بتبعت الطلب لـ `POST /api/orders` وبعدها `/thanks/`. لو الـ API لسه مش منشور بتظهر رسالة فشل مع بديل واتساب. تقدر تغيّر العنوان بمتغير `PUBLIC_API_URL`.

## تشغيل

```bash
pnpm --filter @platform/website add astro   # أول مرة فقط
pnpm run build                              # يبني الموقع في apps/website/dist
pnpm --filter @platform/website dev         # تجربة محلية
```

## قواعد

- الصفحات كلها ثابتة (SSG). React بس للتفاعل (السلة).
- الأسعار والخصم من `@platform/commerce`، وcanonical وJSON-LD من `@platform/seo`.
- غير الإنتاج يطلع `noindex`: ضع `DEPLOY_ENV=staging` (أو `preview`) عند البناء.
- هيكل الروابط: ADR 0009 (`/`، `/belts/...`، و`/en/...` للإنجليزي).

## المقالات

المقالات في `content/articles/*.md` (مصدر الحقيقة). اسم الملف = `slug`. الـ frontmatter بيتفحص وقت البناء بـ `parseArticleFrontmatter` (والقيم النصية بين علامتي تنصيص). الصفحات: `/blog/` و`/blog/<slug>/` (عربي فقط حاليًا، بدون نسخة إنجليزية). الصور داخل المقال لازم تكون مربعة (CSS بيحجز مساحتها).

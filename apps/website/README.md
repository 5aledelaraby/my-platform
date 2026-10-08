# apps/website

الواجهة الأمامية للمتجر: Astro (صفحات ثابتة HTML) وReact للسلة فقط لاحقًا.

## الحالة

تخطيط كامل (هيدر، فوتر، خطوط، ألوان)، ورئيسية تعريفية عربي `/` وإنجليزي `/en/` حسب ADR 0009. بعد كل بناء بيشتغل `scripts/check-dist.mjs` (title، description، canonical، robots، h1، hreflang، الروابط الداخلية، لا شبكة منتجات في الرئيسية، ميزانية JS). المتجر: `/belts/` (كل الأحزمة)، `/belts/<style>/` (6 أنماط)، `/belts/<product-id>/` (38 منتج) بالعربي والإنجليزي، مع sitemap.xml وrobots.txt. زر الطلب حاليًا واتساب مؤقتًا لحد ما تتبني السلة.

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

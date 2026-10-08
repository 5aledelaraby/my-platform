# apps/website

الواجهة الأمامية للمتجر: Astro (صفحات ثابتة HTML) وReact للسلة فقط لاحقًا.

## الحالة

هيكل أساسي فقط: تخطيط `Base.astro` (title وdescription وcanonical وrobots حسب البيئة) وصفحتان تجريبيتان للرئيسية (عربي `/` وإنجليزي `/en/`). باقي الصفحات تتبني حسب ADR 0009.

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

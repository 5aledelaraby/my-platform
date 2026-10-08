# جرد الهجرة من الموقع القديم (`5aledelaraby/belts`)

الموقع القديم يفضل شغال كمرجع وأرشيف. المنصة الجديدة تتبني بنضافة، وبنسحب منه **المحتوى والأصول والمنطق** فقط، مش سكربت البناء ولا ناتج `docs/`.

## ينتقل كما هو أو بتعديل بسيط

| الشيء | المصدر القديم | الوجهة الجديدة | ملاحظة |
|---|---|---|---|
| الكتالوج (6 ستايلات و38 منتج) | `src/data/products.ts` | **تم**: `packages/commerce/data/catalog.json` | الأسعار بالقروش. السعر من الستايل. الـ API يعتمد عليه |
| صور المنتجات (38) | `src/assets/products/*.jpg` | `apps/website/src/assets` | مربعة، اسم الملف = id المنتج |
| 9 مقالات SEO | `src/content/blog/*.md` | `content/articles/` | تُراجع بـ `parseArticleFrontmatter` وتُكمَّل بـ `slug` و`datePublished` |
| الصفحات القانونية (خصوصية، شروط، استرجاع) عربي/إنجليزي | `src/content/{privacy,terms,returns}*.ts` | `content/pages/` | |
| نصوص "عن فيكونا" و FAQ و SEO copy | `src/content/about*.ts`, `src/data/{faq,seo-copy}.ts` | `content/` | |
| إعدادات المتجر (شحن 80/120، مجاني فوق 1500، استرجاع 14 يوم، بيانات الشركة) | `src/data/site.ts` | `apps/website/src/site.config.ts` | الشحن يتحول لقروش |
| الهوية: لوجو، ختم، أيقونات | `brand/` | `apps/website/public/brand/` أو `packages/ui` | |
| الخطوط (Cairo, El Messiri, Great Vibes, Marcellus) | `src/assets/fonts/` | `apps/website/src/assets/fonts/` | self-hosted، ترخيص OFL |
| صور الموقع، الفيديوهات، التوقيع | `src/assets/{site,video}/` | `apps/website/src/assets/` | |
| منطق الخصم المتعدد | `src/client/app.ts` (`RATES`) | **تم**: `packages/commerce` | مختبر ومطابق للقديم على كل تركيبات الأسعار الحالية |
| Worker الـ CAPI (تتبع، مش طلبات) | `workers/capi/worker.js` | `apps/capi-worker/` (لاحقًا) | التوكن `META_TOKEN` يفضل Secret في Cloudflare. لا ينتقل في الكود |
| معرفات التتبع العامة (GA4, Meta Pixel, Snap) | `src/data/site.ts` | config | معرفات عامة. التوكنات لا |

## يراجع قبل النقل (قرار المالك)

- **صور آراء العملاء** (`src/assets/reviews/r01..r28`): تُنقل فقط لو كلها حقيقية وبإذن أصحابها. قاعدة: لا تقييمات ولا آراء مُختلقة.
- **التوقيع بخط اليد** في الفوتر: انتقل لو لسه عايزه.
- **زرار الواتساب العائم**: اتشال عمدًا من القديم. لا يرجع.

## لا ينتقل

- `scripts/build.tsx` (سكربت البناء المخصص): بيتبدل بـ Astro.
- ناتج `docs/`، و`node_modules` (symlink)، و`TAILWIND_BIN`.
- `src/vendor/*` (GSAP/Lenis مجمّعة): تتثبت كحزم npm لو احتجناها.

## معايير قبول قبل تحويل الدومين

1. نفس الأسعار والخصم والشحن (اختبارات `commerce` ناجحة).
2. كل صفحة لها title وdescription وcanonical وJSON-LD صحيح (بدون تقييمات).
3. `sitemap.xml` وrobots سليمين، والـ staging عليه `noindex`.
4. التتبع شغال (GA4, Pixel, CAPI بنفس event_id) ومتحقق منه في Events Manager.
5. Lighthouse موبايل: أداء وSEO وإتاحة ≥ 90 على الصفحة الرئيسية والمنتج والمقال.
6. تحويلات 301 من أي URL قديم له قيمة (لو الموقع القديم اتأرشف جزئيًا).

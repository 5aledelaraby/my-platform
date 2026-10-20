# apps/website

الموقع: Astro بيطلع صفحات HTML ثابتة، والسلة سكربت TypeScript صغير من غير أي framework. الموقع إنجليزي (ADR 0015)، والمقالات عربي وإنجليزي (ADR 0016).

## الصفحات

| العنوان | الملف | ملاحظات |
|---|---|---|
| `/` | `components/Home.astro` | رئيسية خفيفة: صور على الموديل، كل صورة بتفتح الحزام بتاعها. من غير شبكة منتجات |
| `/collections/vicuna-belts/` | `components/Collection.astro` | كل الأحزمة، وتحتها "Style guides" |
| `/collections/vicuna-belts/<design>/` | `components/Collection.astro` | تصميم واحد (5 تصميمات) |
| `/collections/vicuna-belts/<product-id>/` | `components/ProductPage.astro` | صفحة الحزام: صور على الموديل، الألوان، السلة، "Style guides" |
| `/journal/style-guides/` و`/journal/style-guides/<slug>/` | `pages/journal/style-guides/` | المقالات من `content/articles/`، الإنجليزي الأول وبعده العربي |
| `/about/` `/contact/` `/faq/` `/favorites/` `/thanks/` | `components/*Page.astro` | المفضلة وصفحة الشكر noindex |
| `/shipping/` `/returns/` `/terms/` `/privacy/` `/privacy/cookies/` | `src/policies/` | إنجليزي بس، والأرقام كلها من `site.ts` و`@platform/commerce` |
| `/catalog/products.csv` و`/catalog/local-inventory.csv` | `pages/catalog/` | كتالوج Meta وGoogle Merchant Center |
| `/sitemap.xml` و`/robots.txt` | `pages/` | |

## الربط بين الصفحات

- الهيدر: الأحزمة والتصميمات. الفوتر: التصميمات، ومن نحن، والتواصل، والأسئلة، و**Journal**، والسياسات.
- صفحات الأحزمة والتصميمات والمنتجات: "Style guides" (`components/Guides.astro`) بتعرض أنسب 3 مقالات (اللي فيها الحزام نفسه الأول، وبعدها اللي فيها تصميمه).
- كل مقال: كروت الأحزمة اللي فيه، ولينكات جوه الكلام، و"اقرئي أيضًا"، ولينك للنسخة باللغة التانية لو موجودة (مع hreflang).
- `check-dist` بيرفض أي صفحة مفيش صفحة تانية بتوصلها.

## بعد كل بناء

1. `scripts/fingerprint.mjs`: كل صورة وفيديو ولوجو وخط في الصفحات بيتحول لـ `/v/<hash>/...` وبيتخزن عند الزائرة سنة. أي ملف يتغير بياخد عنوان جديد، فبيظهر على طول.
2. `scripts/check-dist.mjs`: title وdescription وcanonical وrobots وh1 واحد، الصور ليها alt ومقاس، اللينكات الداخلية والصور موجودة، مفيش صفحة يتيمة، hreflang من الناحيتين، sitemap كامل، robots صح حسب البيئة، ميزانية JavaScript، وكل ملف ليه بصمة موجود.

## التشغيل على Cloudflare

- `vicuna-site` = `staging.vicuna-eg.com` من فرع `staging` بـ `DEPLOY_ENV=staging`. النسخة دي `noindex`، وأكواد الإعلانات ما بتتحملش فيها (`data-track="off"`).
- `vicuna-site-production` = `vicuna-eg.com` من `main` بـ `DEPLOY_ENV=production`.
- `src/worker.ts` بيشتغل قبل صفحات الأحزمة والكتالوج وsitemap: بيخفي أي حزام مخزونه صفر (ADR 0013)، وبيحوّل العناوين القديمة `/en/...`.
- `public/_headers`: هيدرز الأمان (HSTS وغيره)، وكاش سنة لـ `/_astro/` و`/v/`.

## التتبع

GA4 وMeta Pixel وSnap Pixel (`scripts/tracking.ts`) بيتحملوا على الموقع العام بس، ومع أول لمسة أو سكرول من الزائرة، علشان الصفحة نفسها تفتح أسرع (PageSpeed 100). مشاهدة المنتج اللي حصلت قبل اللمسة بتتبعت معاهم، والشراء بيحمّلهم على طول. الزائرة تقدر توقفهم من "Cookie settings" في الفوتر.

## الأوامر

```bash
pnpm --filter @platform/website dev                                  # تجربة على جهازك (noindex)
DEPLOY_ENV=production pnpm --filter @platform/website build          # بناء الإنتاج + check-dist
DEPLOY_ENV=staging pnpm --filter @platform/website build             # بناء التجريبي
pnpm --filter @platform/website typecheck                            # فحص Astro وTypeScript
```

## السرعة

قواعد السرعة في `AGENTS.md` (Performance rules): الـ CSS مكتوب جوه كل صفحة، الحركة بـ `opacity` و`transform` بس، ومفيش قياس للصفحة وهي بتحمّل، والصور مقاساتها 400/640/800/1200.

# apps/website

الواجهة الأمامية للمتجر: Astro (صفحات ثابتة HTML). السلة سكربت TypeScript صغير من غير أي framework.

## الحالة

رئيسية تعريفية عربي `/` وإنجليزي `/en/` حسب ADR 0009. المتجر: `/collections/vicuna-belts/` (كل الأحزمة)، `/collections/vicuna-belts/<style>/` (4 تصميمات)، `/collections/vicuna-belts/<product-id>/` (16 منتج) بالعربي والإنجليزي، مع sitemap.xml وrobots.txt. صفحات من نحن والتواصل والأسئلة الشائعة، وصفحات السياسات (الشحن، الاسترجاع، الشروط، الخصوصية، الكوكيز) من `src/policies/`. بعد كل بناء بيشتغل `scripts/check-dist.mjs` (title، description، canonical، robots، h1، hreflang، الروابط الداخلية، لا شبكة منتجات في الرئيسية، ميزانية JS).

- **السلة:** drawer عام في كل الصفحات، محفوظة في المتصفح، بتبعت الطلب لـ `POST /api/orders` وبعدها `/thanks/` أو `/en/thanks/`. بتلتزم بنفس حدود الـ API من `@platform/commerce`. لو الإرسال فشل بتظهر رسالة مع بديل واتساب، والسلة والبيانات بيفضلوا زي ما هم. تقدر تغيّر عنوان الـ API بمتغير `PUBLIC_API_URL`.
- **المخزون (ADR 0013):** `src/worker.ts` بيشتغل قبل صفحات الأحزمة وملف الكتالوج وsitemap.xml بس. بيقرا المخزون من `vicuna-api` (service binding)، وأي حزام كميته صفر: صفحته بتحوّل على صفحة تصميمه، وبيختفي من القوايم والكتالوج وsitemap، ويرجع لوحده لما الكمية تزيد. لو الـ API مش متاح الصفحات بتتبعت زي ما اتبنت.
- **ملف الكتالوج:** `/catalog/products.csv` لـ Meta وGoogle Merchant Center (نفس أعمدة الموقع القديم، وأرقام المنتجات هي نفس `content_ids` بتاعة البيكسل). الصور في `public/catalog/img/<id>.jpg`، وأي منتج جديد محتاج صورته هناك (اختبار بيتأكد).
- **الكوكيز والتتبع:** GA4 وMeta Pixel وSnap Pixel بيتحمّلوا بس بعد "موافقة" في شريط الكوكيز (`Consent.astro`، `scripts/tracking.ts`)، والأدوات المفعّلة من `tracking` في `site.ts` (اللي من غير ID مش بيتحمّل ومش بيتذكر في السياسات). سحب الموافقة بيوقف الأدوات ويمسح كوكيزها من الموقع.

ملفات النشر: `public/_headers` (هيدرز أمان، وكاش طويل لملفات `/_astro/`)، و`wrangler.toml` (الـ Worker والـ assets والربط بـ `vicuna-api`).

## تشغيل

```bash
pnpm --filter @platform/website dev                                  # تجربة محلية (noindex تلقائيًا)
DEPLOY_ENV=production pnpm --filter @platform/website build          # بناء الإنتاج في apps/website/dist + check-dist
DEPLOY_ENV=staging pnpm --filter @platform/website build             # بناء النسخة التجريبية (noindex)
pnpm --filter @platform/website typecheck                            # فحص ملفات Astro وTypeScript (astro-check)
```

`DEPLOY_ENV` إجباري في البناء ومفيش قيمة افتراضية. على Cloudflare بيتحط في Build variables لـ `vicuna-site`.

## قواعد

- الصفحات كلها ثابتة (SSG). التفاعل (السلة وفلتر الألوان) سكربتات صغيرة.
- الأسعار والخصم من `@platform/commerce`، وcanonical وJSON-LD من `@platform/seo`.
- غير الإنتاج يطلع `noindex` وrobots.txt بيمنع الزحف: `DEPLOY_ENV=staging` أو `preview`. `check-dist` بيتأكد من ده في كل بناء.
- هيكل الروابط: ADR 0009 (`/`، `/collections/vicuna-belts/...`، و`/en/...` للإنجليزي).

## المقالات

المقالات في `content/articles/*.md` (مصدر الحقيقة). اسم الملف = `slug`. الـ frontmatter بيتفحص وقت البناء بـ `parseArticleFrontmatter` (والقيم النصية بين علامتي تنصيص). الصفحات: `/journal/style-guides/` و`/journal/style-guides/<slug>/` (عربي فقط حاليًا، بدون نسخة إنجليزية). الصور داخل المقال لازم تكون مربعة (CSS بيحجز مساحتها).

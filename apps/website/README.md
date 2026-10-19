# apps/website

الواجهة الأمامية للمتجر: Astro (صفحات ثابتة HTML). السلة سكربت TypeScript صغير من غير أي framework.

## الحالة

رئيسية تعريفية عربي `/` وإنجليزي `/en/` حسب ADR 0009. المتجر: `/collections/vicuna-belts/` (كل الأحزمة)، `/collections/vicuna-belts/<style>/` (5 تصميمات)، `/collections/vicuna-belts/<product-id>/` (18 منتج) بالعربي والإنجليزي، مع sitemap.xml وrobots.txt. صفحات من نحن والتواصل والأسئلة الشائعة، وصفحات السياسات (الشحن، الاسترجاع، الشروط، الخصوصية، الكوكيز) من `src/policies/`. بعد كل بناء بيشتغل `scripts/fingerprint.mjs` (بصمة لروابط الصور، تحت) وبعده `scripts/check-dist.mjs` (title، description، canonical، robots، h1، hreflang، الروابط الداخلية، لا شبكة منتجات في الرئيسية، ميزانية JS، ووجود كل صورة ليها بصمة).

النشر: Worker لكل بيئة (قرار المالك 2026-10-17). `vicuna-site` = `staging.vicuna-eg.com` من فرع `staging` بـ `DEPLOY_ENV=staging`، و`vicuna-site-production` = `vicuna-eg.com` من `main` بـ `DEPLOY_ENV=production`.

- **السلة:** drawer عام في كل الصفحات، محفوظة في المتصفح، بتبعت الطلب لـ `POST /api/orders` وبعدها `/thanks/` أو `/en/thanks/`. بتلتزم بنفس حدود الـ API من `@platform/commerce`. طرق الاستلام: شحن عادي، أو سريع، أو **استلام من مقرنا في مدينة نصر** (مجاني، من غير محافظة ولا عنوان، والمالك بيتفق مع العميلة على المكان والميعاد). السلة مش بتطلب المخزون وهي بتحمّل (قرار المالك 2026-10-18): لو حزام خلص، الـ API بيرفض الطلب ورده بيعدّل السلة. لو الإرسال فشل بتظهر رسالة مع بديل واتساب، والسلة والبيانات بيفضلوا زي ما هم. تقدر تغيّر عنوان الـ API بمتغير `PUBLIC_API_URL`.
- **المخزون (ADR 0013):** `src/worker.ts` بيشتغل قبل صفحات الأحزمة وملف الكتالوج وsitemap.xml بس. بيقرا المخزون من `vicuna-api` (service binding)، وأي حزام كميته صفر: صفحته بتحوّل على صفحة تصميمه، وبيختفي من القوايم والكتالوج وsitemap، ويرجع لوحده لما الكمية تزيد. لو الـ API مش متاح الصفحات بتتبعت زي ما اتبنت.
- **ملف الكتالوج:** `/catalog/products.csv` لـ Meta وGoogle Merchant Center (نفس أعمدة الموقع القديم + `identifier_exists=no` لأن الأحزمة صناعتنا ومالهاش باركود دولي، وأرقام المنتجات هي نفس `content_ids` بتاعة البيكسل). و`/catalog/local-inventory.csv` لمخزون الاستلام من المحل (كود المحل بتاع Google Business في `STORE_CODE`)، ومش مستخدم حاليًا لأن القوائم المحلية المجانية مش متاحة في مصر. الصور في `public/catalog/img/<id>.jpg`، وأي منتج جديد محتاج صورته هناك (اختبار بيتأكد).
- **الكوكيز والتتبع:** GA4 وMeta Pixel وSnap Pixel بيتحمّلوا من أول صفحة من غير شريط كوكيز (قرار المالك 2026-10-19)، والزائرة تقدر توقفهم من "إعدادات الكوكيز" تحت الصفحة (`Consent.astro`، `scripts/tracking.ts`)، والأدوات المفعّلة من `tracking` في `site.ts` (اللي من غير ID مش بيتحمّل ومش بيتذكر في السياسات). الرفض بيوقف الأدوات ويمسح كوكيزها من الموقع.

- **السرعة (PageSpeed 100، 2026-10-18):** التصميم مكتوب جوه كل صفحة (`inlineStylesheets`)، وروابط الصور والفيديو واللوجو في الصفحات بتتحول لـ `/v/<hash>/...` وبتتخزن سنة، وأي حركة بتستخدم `opacity` و`transform` بس. التفاصيل في `AGENTS.md` (Performance rules).

ملفات النشر: `public/_headers` (هيدرز أمان، وكاش سنة لـ `/_astro/` و`/v/`، وساعة للصور بروابطها العادية، و30 يوم للخطوط)، و`wrangler.toml` (الـ Workers والـ assets والربط بـ `vicuna-api`).

## تشغيل

```bash
pnpm --filter @platform/website dev                                  # تجربة محلية (noindex تلقائيًا)
DEPLOY_ENV=production pnpm --filter @platform/website build          # بناء الإنتاج في apps/website/dist + check-dist
DEPLOY_ENV=staging pnpm --filter @platform/website build             # بناء النسخة التجريبية (noindex)
pnpm --filter @platform/website typecheck                            # فحص ملفات Astro وTypeScript (astro-check)
```

`DEPLOY_ENV` إجباري في البناء ومفيش قيمة افتراضية. على Cloudflare بيتحط في Build variables لكل Worker (`staging` لـ `vicuna-site`، و`production` لـ `vicuna-site-production`).

## قواعد

- الصفحات كلها ثابتة (SSG). التفاعل (السلة وفلتر الألوان) سكربتات صغيرة.
- الأسعار والخصم من `@platform/commerce`، وcanonical وJSON-LD من `@platform/seo`.
- غير الإنتاج يطلع `noindex` وrobots.txt بيمنع الزحف: `DEPLOY_ENV=staging` أو `preview`. `check-dist` بيتأكد من ده في كل بناء.
- هيكل الروابط: ADR 0009 (`/`، `/collections/vicuna-belts/...`، و`/en/...` للإنجليزي).

## المقالات

المقالات في `content/articles/*.md` (مصدر الحقيقة). اسم الملف = `slug`. الـ frontmatter بيتفحص وقت البناء بـ `parseArticleFrontmatter` (والقيم النصية بين علامتي تنصيص). الصفحات: `/journal/style-guides/` و`/journal/style-guides/<slug>/` (عربي فقط حاليًا، بدون نسخة إنجليزية). الصور داخل المقال لازم تكون مربعة (CSS بيحجز مساحتها).

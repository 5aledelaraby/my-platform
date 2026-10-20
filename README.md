# my-platform

منصة **Vicuna (فيكونا)**: متجر أحزمة الخصر على [vicuna-eg.com](https://vicuna-eg.com)، والـ API بتاع الطلبات، وصفحة الإدارة. كله في ريبو واحد (monorepo) مبني كـ **Modular Monolith**: كل جزء في مكانه وبحدود واضحة، من غير microservices.

- القواعد لأي مبرمج أو AI: [`AGENTS.md`](AGENTS.md) (أهم ملف في الريبو)
- قرارات المعمارية: [`architecture/adr/`](architecture/adr)
- إزاي تضيف أي حاجة جديدة: [`architecture/HOW-TO-ADD.md`](architecture/HOW-TO-ADD.md)
- خريطة التوسع (كل مجال مستقبلي: فين يعيش وإمتى يتبني): [`architecture/ROADMAP.md`](architecture/ROADMAP.md)
- تفاصيل الموقع: [`apps/website/README.md`](apps/website/README.md)، وتفاصيل الـ API: [`apps/api/README.md`](apps/api/README.md)

## العناوين

| العنوان | إيه هو | بيتنشر من |
|---|---|---|
| `vicuna-eg.com` | الموقع العام | فرع `main` (Worker اسمه `vicuna-site-production`) |
| `staging.vicuna-eg.com` | النسخة التجريبية (مش بتظهر في جوجل، ومن غير أكواد إعلانات) | فرع `staging` (Worker اسمه `vicuna-site`) |
| `admin.vicuna-eg.com` | صفحة الإدارة: الطلبات والمخزون وأكواد الخصم وسعر الدولار | فرع `main` (جوه `vicuna-api`) |
| `vicuna-eg.com/api/...` | الـ API بتاع الطلبات | فرع `main` (`vicuna-api` + قاعدة D1) |

## هيكل الريبو

```
apps/website        الموقع (Astro، صفحات HTML ثابتة، والسلة سكربت صغير)
apps/api            الطلبات والمخزون وأكواد الخصم وPayPal وصفحة الإدارة (Cloudflare Worker + D1)
packages/commerce   الفلوس والأسعار والخصم والشحن والمخزون، والكتالوج (data/catalog.json)
packages/seo        canonical وrobots وsitemap وJSON-LD
packages/content    التحقق من بيانات المقالات (frontmatter)
content/articles    المقالات، عربي وإنجليزي (Markdown)
tools/architecture  فحص الحدود بين الأجزاء، وفحص الأسرار، وأداة إضافة جزء جديد
architecture/       القرارات (ADR) والحدود (boundaries.json) والخطط
```

## التشغيل

محتاج Node 22 (الرقم في `.nvmrc`) وpnpm (النسخة متحددة في `package.json`، وcorepack بيجيبها لوحده):

```bash
corepack enable
pnpm install --frozen-lockfile   # pnpm بس، مش npm ولا yarn. ملف pnpm-lock.yaml ما يتعدلش باليد
pnpm run check                   # كل الفحوصات + بناء نسخة الإنتاج. لازم ينجح قبل أي commit
```

`pnpm run check` بيشغّل بالترتيب: فحص الأسرار، وفحص الحدود بين الأجزاء، وكل الاختبارات، وtypecheck، وlint، وبناء الموقع، وبعد البناء `check-dist` اللي بيفحص كل صفحة.

أوامر تانية:

```bash
pnpm --filter @platform/website dev                          # تجربة الموقع على جهازك (noindex تلقائيًا)
DEPLOY_ENV=production pnpm --filter @platform/website build  # بناء الموقع لوحده
pnpm test                                                    # الاختبارات بس
```

**Turborepo** بيشغّل typecheck والبناء: الأجزاء بتشتغل مع بعض، والنتيجة بتتحفظ في `.turbo/`، فلو مفيش حاجة اتغيرت بياخد أقل من ثانية. أي تغيير في `packages/*` أو `content/` أو الكتالوج بيلغي الحفظ ويعيد البناء (اتجرب 2026-10-20). الاختبارات وlint بيشتغلوا كاملين كل مرة عن قصد لأنهم ثواني.

`DEPLOY_ENV` إجباري في أي بناء للموقع (`production` أو `staging` أو `preview`) ومالوش قيمة افتراضية، علشان نسخة تجريبية ما تتفهرسش في جوجل بالغلط، ونسخة الإنتاج ما تتقفلش بالغلط.

## النشر (خطوة بخطوة)

1. الشغل كله بيروح على فرع **`pending`**.
2. **"انشر"** = نقل `pending` لـ **`staging`**. Cloudflare بيبني `staging.vicuna-eg.com` لوحده، والـ CI بيفحص نفس الكود.
3. نراجع على الموبايل في `staging.vicuna-eg.com`.
4. **"انشر على العام"** = Pull Request من `pending` لـ `main`، ونستنى الفحوصات `guards-and-tests` و`full` و`CodeQL` تخضر، وبعدها `main` بياخد الكود و`vicuna-eg.com` بيتبني لوحده.

`main` محمي (Ruleset «Protect main»): ما بيقبلش كود من غير ما الفحوصات تنجح.

## إيه اللي بيشتغل لوحده

| إيه | فين | بيعمل إيه |
|---|---|---|
| CI | `.github/workflows/ci.yml` | مع كل push على `main` و`staging` وكل Pull Request: الفحوصات كلها وبناء نسخة الإنتاج |
| CodeQL | GitHub | فحص أمان للكود |
| Dependabot | `.github/dependabot.yml` | كل أسبوع بيفتح Pull Requests لتحديث المكتبات وGitHub Actions |
| فحص كل ساعة | `apps/api/src/scheduled.ts` | بيفتح الموقع و`/api/health`، ولو فيه مشكلة بيبعتلك على Telegram |
| نسخة احتياطية يومية | `apps/api/src/scheduled.ts` | نسخة من قاعدة البيانات في R2 (`vicuna-backups`) وعلى Telegram |
| إخفاء الحزام اللي خلص | `apps/website/src/worker.ts` | أي حزام مخزونه صفر بيختفي من الموقع والكتالوج وsitemap، ويرجع لوحده لما تزوّد الكمية |

## أخطاء شائعة وإزاي بنمنعها

الهدف: الغلطة تتمسك قبل ما توصل للموقع العام، مش بعدها. اللي في الجدول ده بيتفحص لوحده، وأي واحد فيهم بيوقف البناء.

| الغلطة | اللي بيمسكها |
|---|---|
| لينك داخلي مكسور، أو صورة مش موجودة | `check-dist` (كل صفحة بعد البناء) |
| صفحة ما فيش صفحة تانية بتوصلها (orphan) | `check-dist` |
| صفحة من غير title أو description أو canonical، أو title طويل، أو أكتر من h1 | `check-dist` |
| النسخة التجريبية تتفهرس في جوجل، أو الموقع العام يتقفل | `check-dist` + `DEPLOY_ENV` الإجباري |
| صفحة ناقصة من sitemap، أو sitemap فيه صفحة مش موجودة | `check-dist` |
| hreflang من ناحية واحدة بين مقال عربي وإنجليزي | `check-dist` |
| مقال فيه لينك لحزام اتشال، أو سعر أو مصاريف شحن قديمة، أو InstaPay، أو "جلد طبيعي" لحزام PU | `apps/website/test/articles.test.ts` |
| صورة اتمسحت وهي لسه مستخدمة في مقال أو صفحة | اختبارات الصور + `check-dist` |
| منتج جديد من غير صورة الكتالوج (`public/catalog/img/<id>.jpg`) | اختبار الكتالوج |
| سياسات بأرقام مكتوبة باليد مختلفة عن الحقيقة | الأرقام كلها جاية من `site.ts` و`@platform/commerce` |
| سر (token أو مفتاح) اتكتب في الكود | `check-secrets` |
| جزء بيستورد جزء ممنوع عليه | `check-boundaries` |
| JavaScript تقيل بيبطّأ الموقع | ميزانية JS في `check-dist` (90 KB) |
| صورة اتغيرت والزوار شايفين القديمة | البصمة: كل صورة وخط ليها عنوان فيه hash، فالجديد بيظهر فورًا |

وحاجات لازم تتعمل باليد (ما ينفعش تتفحص لوحدها):

- **المخزون:** بيتظبط من صفحة الإدارة بس. منتج جديد كميته صفر لحد ما تزوّدها، فصفحته بتحوّل على صفحة تصميمه.
- **قاعدة البيانات:** أي migration جديدة تتنفذ على قاعدة الـ staging الأول، وعلى قاعدة الإنتاج **أنت بنفسك** من الـ Console، وقبل ما الكود اللي محتاجها يتنشر. ممنوع `wrangler d1 migrations apply` على قاعدة الإنتاج (اتعملت يدوي من الأول، ومفيش فيها جدول `d1_migrations`).
- **Merchant Center وMeta:** لغة الكتالوج إنجليزي، والشحن 3 أيام والاسترجاع 14 يوم لازم يطابقوا الموقع.
- **سعر الدولار لـ PayPal:** من صفحة الإدارة.

## إضافة حاجة جديدة

- **مقال:** ملف في `content/articles/` (التفاصيل في [`HOW-TO-ADD.md`](architecture/HOW-TO-ADD.md)). لازم يكون فيه `lang`، ولو ليه نسخة باللغة التانية تتكتب `translation` في واحد منهم. بيظهر لوحده في صفحة المقالات وفي "Style guides" تحت صفحات الأحزمة اللي بيذكرها.
- **حزام جديد:** سطر في `packages/commerce/data/catalog.json` (الـ id ثابت للأبد)، وصورته في `public/img/products/` وصورة الكتالوج في `public/catalog/img/<id>.jpg`، وصور على الموديل في `public/img/looks/` مع العدد في `lib/looks.ts`، وبعدين المخزون من صفحة الإدارة.
- **جزء جديد في الريبو:** `node tools/architecture/new-unit.mjs package|app <name>`، ومن غير ما يكون فيه حد محتاجه فعلًا ما يتعملش.

## قاعدة أمان

ما تديش أي AI أو أي شخص كلمات سر أو tokens أو مفاتيح API. الأسرار (Telegram وCloudflare Access وMeta `META_TOKEN` وPayPal) بتتحط في Cloudflare Secrets بس. لو سر اتكتب في git بالغلط، لازم يتغير؛ مسح الـ commit مش كفاية.

# إزاي تضيف حاجة جديدة

| عايز تضيف | تعمل إيه |
|---|---|
| **مقال** | ملف `content/articles/<slug>.md` فيه frontmatter (title, description, slug, datePublished). `parseArticleFrontmatter` بيرفض أي خطأ. الـ slug حروف لاتينية صغيرة وشرطات فقط |
| **منتج** | سطر في `packages/commerce/data/catalog.json` (id ثابت للأبد، style، color، hex، texture) + صورة بنفس اسم الـ id. السعر من الستايل بالقروش. بعد التعديل: انشر الموقع **والـ API** |
| **صفحة ثابتة** | `content/pages/` (بعد نقلها). لو غيرت الـ slug لازم redirect (ADR 0004) |
| **منطق جديد (مجال)** | الأول اسأل الأسئلة الثلاثة في `ROADMAP.md`. لو أيوه: `node tools/architecture/new-unit.mjs package <name>` |
| **تطبيق أو Worker** | `node tools/architecture/new-unit.mjs app <name> --may-import commerce,seo`. إعدادات Cloudflare (`wrangler`) تتحط جوه التطبيق نفسه |
| **تكامل خارجي** | حزمة `integration-<name>` بدالة واضحة تاخد المفتاح كباراميتر. الاختبارات بردود مُصطنعة، ممنوع استدعاء حقيقي في الاختبارات |
| **اتجاه اعتماد جديد** | عدّل `architecture/boundaries.json` + اكتب ADR قصير في `architecture/adr/` |
| **لغة جديدة** | محتوى بنفس الـ slug في مجلد لغة جديد، والـ routing في `apps/website`. من غير حزمة جديدة |
| **سر (token/مفتاح)** | Cloudflare Secrets أو GitHub Actions Secrets فقط. ممنوع في الكود أو الشات. `pnpm check:secrets` بيمنع الخطأ |

بعد أي إضافة: `pnpm install` ثم `pnpm check`. لازم ينجح كله قبل الـ commit.

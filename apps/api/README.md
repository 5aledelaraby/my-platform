# apps/api: واجهة إنشاء الطلبات

Cloudflare Worker بيستقبل الطلب من الموقع، ويتحقق منه، ويعيد حساب الأسعار والخصم والشحن **من الكتالوج على الخادم** (أي سعر يبعته المتصفح يتجاهله)، ويخزّنه في D1 بنسخة ثابتة من الأسعار.

لا يحتاج أي token أو سر. الإعدادات كلها عامة (قائمة الأصول المسموحة).

## المسارات

| الطلب | الوصف |
|---|---|
| `GET /api/health` | فحص التشغيل |
| `OPTIONS /api/orders` | CORS preflight (للأصول المسموحة فقط) |
| `POST /api/orders` | إنشاء طلب. يرد `201` بملخص الطلب (بدون الموبايل أو العنوان) |

مثال للجسم (JSON):

```json
{
  "items": [{ "id": "lace-black", "quantity": 1 }],
  "customer": { "name": "منى أحمد", "phone": "01012345678", "governorate": "القاهرة", "address": "المنطقة، الشارع، العمارة، الدور", "notes": "" },
  "shippingMethod": "standard",
  "paymentMethod": "cod",
  "website": ""
}
```

- `shippingMethod`: `standard` أو `express`. `paymentMethod`: `cod` (عند الاستلام) أو `instapay` (تحويل يدوي، لا يتم خصم أي شيء أونلاين).
- `website` حقل مخفي في الصفحة (honeypot): لازم يفضل فاضي، وأي بوت بيملاه يتم رفضه.
- الأخطاء: `422` فيها `errors` بأكواد ثابتة (مثل `invalid_phone`) والواجهة تترجمها. `403` أصل غير مسموح. `413` حجم زائد. `503` تعارض في رقم الطلب (يُعاد المحاولة).

## الخصوصية

بيانات العملاء (اسم، موبايل، عنوان) بتتخزن في D1 فقط. الـ API **لا يطبع** أي بيانات في اللوجز (بيسجل اسم الخطأ فقط)، ولا يرجّع الموبايل أو العنوان في الرد.

## التشغيل لأول مرة (من جهازك أو Codespaces)

```bash
pnpm install
cd apps/api
pnpm wrangler login                          # تسجيل دخول Cloudflare من المتصفح (لا تبعت أي token لأي حد)
pnpm wrangler d1 create vicuna-db            # هيطبع database_id: حطه في wrangler.toml
pnpm db:migrate:remote                       # ينشئ جداول orders وorder_items
pnpm deploy
```

بعدها في Cloudflare: ربط الـ Worker بالمسار `vicuna-eg.com/api/*`، وإضافة **Rate limiting rule** على `POST /api/orders` (مثلًا 10 طلبات كل 10 دقائق لكل IP). الحماية من السبام عند الحافة أرخص وأقوى من كود داخل الـ Worker.

للتجربة محليًا: اعمل `apps/api/.dev.vars` فيه `ALLOWED_ORIGINS="http://localhost:4321"` ثم `pnpm dev` و`pnpm db:migrate:local`.

## قواعد

- الأسعار والخصم من `@platform/commerce` فقط. ممنوع منطق سعر هنا.
- لا نبني لوحة إدارة أو `GET /orders` الآن: قراءة الطلبات تتم من لوحة Cloudflare D1 أو لاحقًا من `apps/admin` بعد مصادقة. لا تفتح قراءة الطلبات بدون مصادقة أبدًا.

# apps/website

الواجهة الأمامية للمتجر. **لسه مفيش كود Astro هنا**: بيتضاف في الخطوة التالية من بيئة عندها وصول لـ npm registry (Codespaces أو جهازك).

## الخطوات (من جذر الريبو)

```bash
corepack enable
pnpm install                      # ينتج pnpm-lock.yaml: اعمله commit
cd apps/website
pnpm dlx create-astro@latest .    # اختار: Empty, TypeScript strict, بدون git
pnpm add astro@latest @astrojs/react @astrojs/sitemap react react-dom
pnpm add -D @types/react @types/react-dom
```

## قواعد

- الصفحات كلها SSG (HTML جاهز وقت البناء). React بس للسلة والتفاعلات (islands).
- أي حساب أسعار أو خصم من `@platform/commerce`، ممنوع تكرار المنطق هنا.
- أي JSON-LD أو canonical أو sitemap من `@platform/seo`.
- البيئات: `production` فقط تظهر للجوجل. غير كده `noindex` (`robotsDirective`).

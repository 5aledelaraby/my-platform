// Global cart: state in localStorage, drawer UI, checkout via POST /api/orders.
// Prices shown here are for display only. The server recalculates everything from the catalogue.
import { LIMITS, SHIPPING, calculateTotals, formatEgp, lookupProduct, normalizeEgyptianMobile } from "@platform/commerce";
import type { CartLine, ShippingMethod } from "@platform/commerce";
import { getProduct, imageOf, productName } from "../store.ts";
import type { Lang } from "../site.ts";

interface Line { id: string; quantity: number }

const KEY = "vicuna-cart-v1";
const ORDER_KEY = "vicuna-last-order";
const API_URL = (import.meta.env.PUBLIC_API_URL as string | undefined) ?? "/api/orders";
const lang: Lang = document.documentElement.lang === "en" ? "en" : "ar";

const T = {
  ar: {
    cur: "جنيه", free: "مجاني", remove: "حذف", sending: "جاري الإرسال...", submit: "تأكيد الطلب",
    subtotal: "إجمالي الأحزمة", discount: "خصم الكميات", shipping: "الشحن", total: "الإجمالي",
    required: "مطلوب", too_short: "قصير جدًا", too_long: "طويل جدًا", invalid_phone: "رقم موبايل مصري غير صحيح",
    invalid_governorate: "اختاري المحافظة", fail: "تعذر إرسال الطلب. جرّبي تاني بعد شوية، أو اطلبي على واتساب.",
    busy: "الخدمة مشغولة، جرّبي تاني بعد ثواني.", fix: "راجعي الخانات المميزة.", qtyMax: "أقصى كمية",
  },
  en: {
    cur: "EGP", free: "Free", remove: "Remove", sending: "Sending...", submit: "Place order",
    subtotal: "Belts subtotal", discount: "Multi-belt discount", shipping: "Shipping", total: "Total",
    required: "Required", too_short: "Too short", too_long: "Too long", invalid_phone: "Not a valid Egyptian mobile number",
    invalid_governorate: "Choose a governorate", fail: "We could not send the order. Please try again shortly, or order on WhatsApp.",
    busy: "The service is busy, please try again in a few seconds.", fix: "Please check the highlighted fields.", qtyMax: "Maximum quantity",
  },
}[lang];

function load(): Line[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((l): l is Line => typeof l === "object" && l !== null && typeof (l as Line).id === "string" && Number.isInteger((l as Line).quantity))
      .filter((l) => lookupProduct(l.id) !== undefined && l.quantity > 0)
      .map((l) => ({ id: l.id, quantity: Math.min(l.quantity, LIMITS.maxQuantityPerItem) }));
  } catch {
    return [];
  }
}
let lines: Line[] = load();

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* storage unavailable: the cart still works for this page view */
  }
}

const $ = <T extends HTMLElement>(sel: string): T | null => document.querySelector<T>(sel);
const dialog = $<HTMLDialogElement>("#cart");
const linesEl = $("#cart-lines");
const totalsEl = $("#cart-totals");
const emptyEl = $("#cart-empty");
const form = $<HTMLFormElement>("#checkout");
const statusEl = $("#checkout-status");
const submitBtn = $<HTMLButtonElement>("#checkout-submit");

const money = (v: number): string => `${formatEgp(v)} ${T.cur}`;
const cartLines = (): CartLine[] =>
  lines.flatMap((l) => {
    const p = lookupProduct(l.id);
    return p ? [{ unitPrice: p.unitPrice, quantity: l.quantity }] : [];
  });
const shippingMethod = (): ShippingMethod =>
  (form?.querySelector<HTMLInputElement>('input[name="shippingMethod"]:checked')?.value === "express" ? "express" : "standard");

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function setQty(id: string, quantity: number): void {
  const next = Math.min(quantity, LIMITS.maxQuantityPerItem);
  lines = next <= 0 ? lines.filter((l) => l.id !== id) : lines.map((l) => (l.id === id ? { ...l, quantity: next } : l));
  save();
  render();
}

export function addToCart(id: string): void {
  if (!lookupProduct(id)) return;
  const existing = lines.find((l) => l.id === id);
  if (existing) existing.quantity = Math.min(existing.quantity + 1, LIMITS.maxQuantityPerItem);
  else lines.push({ id, quantity: 1 });
  save();
  render();
  openCart();
}

function render(): void {
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  document.querySelectorAll("[data-cart-count]").forEach((b) => {
    b.textContent = String(count);
    b.toggleAttribute("hidden", count === 0);
  });
  if (!linesEl || !totalsEl || !emptyEl || !form) return;
  linesEl.replaceChildren();
  emptyEl.toggleAttribute("hidden", count > 0);
  form.toggleAttribute("hidden", count === 0);
  totalsEl.toggleAttribute("hidden", count === 0);

  for (const l of lines) {
    const product = getProduct(l.id);
    if (!product) continue;
    const name = productName(lang, product);
    const row = el("div", "cart-line");
    const img = document.createElement("img");
    img.src = imageOf(product);
    img.alt = "";
    img.width = 64;
    img.height = 64;
    const info = el("div", "cart-info");
    info.append(el("b", undefined, name), el("span", "muted", money((lookupProduct(l.id)?.unitPrice ?? 0))));
    const qty = el("div", "cart-qty");
    const minus = el("button", undefined, "−") as HTMLButtonElement;
    const plus = el("button", undefined, "+") as HTMLButtonElement;
    minus.type = plus.type = "button";
    minus.setAttribute("aria-label", `- ${name}`);
    plus.setAttribute("aria-label", `+ ${name}`);
    minus.addEventListener("click", () => setQty(l.id, l.quantity - 1));
    plus.addEventListener("click", () => setQty(l.id, l.quantity + 1));
    plus.disabled = l.quantity >= LIMITS.maxQuantityPerItem;
    qty.append(minus, el("span", undefined, String(l.quantity)), plus);
    const rm = el("button", "link", T.remove) as HTMLButtonElement;
    rm.type = "button";
    rm.addEventListener("click", () => setQty(l.id, 0));
    row.append(img, info, qty, rm);
    linesEl.append(row);
  }

  const t = calculateTotals(cartLines(), shippingMethod(), SHIPPING);
  totalsEl.replaceChildren();
  const add = (label: string, value: string, strong = false): void => {
    const r = el("div", strong ? "tot strong" : "tot");
    r.append(el("span", undefined, label), el("span", undefined, value));
    totalsEl.append(r);
  };
  add(T.subtotal, money(t.subtotal));
  if (t.discount > 0) add(T.discount, `- ${money(t.discount)}`);
  add(T.shipping, t.shipping === 0 ? T.free : money(t.shipping));
  add(T.total, money(t.total), true);
}

function openCart(): void {
  if (dialog && !dialog.open) dialog.showModal();
}

function fieldError(name: string, code: string | undefined): void {
  const input = form?.querySelector<HTMLElement>(`[name="${name}"]`);
  const msg = form?.querySelector<HTMLElement>(`[data-error-for="${name}"]`);
  input?.toggleAttribute("aria-invalid", code !== undefined);
  if (msg) msg.textContent = code ? ((T as Record<string, string>)[code] ?? T.required) : "";
}

const FIELDS = ["customer.name", "customer.phone", "customer.governorate", "customer.address", "customer.notes"] as const;
const val = (name: string): string => (form?.elements.namedItem(name) as HTMLInputElement | null)?.value.trim() ?? "";

function clientErrors(): Record<string, string> {
  const e: Record<string, string> = {};
  if (val("customer.name").length < LIMITS.name.min) e["customer.name"] = val("customer.name") ? "too_short" : "required";
  if (!val("customer.phone")) e["customer.phone"] = "required";
  else if (!normalizeEgyptianMobile(val("customer.phone"))) e["customer.phone"] = "invalid_phone";
  if (!val("customer.governorate")) e["customer.governorate"] = "invalid_governorate";
  if (val("customer.address").length < LIMITS.address.min) e["customer.address"] = val("customer.address") ? "too_short" : "required";
  return e;
}

async function submit(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!form || !submitBtn || !statusEl || lines.length === 0) return;
  statusEl.textContent = "";
  const errs = clientErrors();
  FIELDS.forEach((f) => fieldError(f, errs[f]));
  if (Object.keys(errs).length > 0) {
    statusEl.textContent = T.fix;
    return;
  }
  const radio = (n: string): string => form.querySelector<HTMLInputElement>(`input[name="${n}"]:checked`)?.value ?? "";
  const notes = val("customer.notes");
  const body = {
    items: lines,
    customer: {
      name: val("customer.name"),
      phone: val("customer.phone"),
      governorate: val("customer.governorate"),
      address: val("customer.address"),
      ...(notes ? { notes } : {}),
    },
    shippingMethod: radio("shippingMethod") || "standard",
    paymentMethod: radio("paymentMethod") || "cod",
    website: val("website"),
  };
  submitBtn.disabled = true;
  submitBtn.textContent = T.sending;
  try {
    const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { order?: unknown; errors?: Record<string, string> };
    if (res.status === 201 && data.order) {
      try {
        sessionStorage.setItem(ORDER_KEY, JSON.stringify(data.order));
      } catch {
        /* the thank-you page still shows a generic message */
      }
      lines = [];
      save();
      location.assign(lang === "en" ? "/en/thanks/" : "/thanks/");
      return;
    }
    if (res.status === 422 && data.errors) {
      FIELDS.forEach((f) => fieldError(f, data.errors?.[f]));
      statusEl.textContent = T.fix;
    } else {
      statusEl.textContent = res.status === 503 ? T.busy : T.fail;
    }
  } catch {
    statusEl.textContent = T.fail;
  }
  submitBtn.disabled = false;
  submitBtn.textContent = T.submit;
}

document.addEventListener("click", (e) => {
  const target = (e.target as HTMLElement).closest<HTMLElement>("[data-add], [data-open-cart], [data-close-cart]");
  if (!target) return;
  if (target.dataset["add"]) addToCart(target.dataset["add"]);
  else if (target.hasAttribute("data-open-cart")) openCart();
  else dialog?.close();
});
dialog?.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close();
});
form?.addEventListener("submit", (e) => void submit(e));
form?.addEventListener("change", (e) => {
  if ((e.target as HTMLInputElement).name === "shippingMethod") render();
});
window.addEventListener("storage", (e) => {
  if (e.key === KEY) {
    lines = load();
    render();
  }
});
render();

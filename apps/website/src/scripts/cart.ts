// Global cart: state in localStorage, drawer UI, checkout via POST /api/orders.
// Prices shown here are for display only. The server recalculates everything from the catalogue.
import { LIMITS, SHIPPING, calculateTotals, formatEgp, lookupProduct, normalizeEgyptianMobile, remainingQuantity } from "@platform/commerce";
import type { CartLine, ShippingMethod } from "@platform/commerce";
import { getProduct, productName, thumbOf } from "../store.ts";
import type { Lang } from "../site.ts";

interface Line { id: string; quantity: number }

const KEY = "vicuna-cart-v1";
const ORDER_KEY = "vicuna-last-order";
const API_URL = (import.meta.env.PUBLIC_API_URL as string | undefined) ?? "/api/orders";
const STOCK_URL = API_URL.replace(/\/orders\/?$/, "/stock");
const lang: Lang = document.documentElement.lang === "en" ? "en" : "ar";

const T = {
  ar: {
    cur: "جنيه", free: "مجاني", remove: "حذف", sending: "جاري الإرسال...", submit: "تأكيد الطلب",
    subtotal: "إجمالي الأحزمة", discount: "خصم الكميات", shipping: "الشحن", total: "الإجمالي",
    required: "مطلوب", too_short: "قصير جدًا", too_long: "طويل جدًا", invalid_phone: "رقم موبايل مصري غير صحيح",
    invalid_governorate: "اختاري المحافظة", fail: "تعذر إرسال الطلب. جرّبي تاني بعد شوية، أو اطلبي على واتساب.",
    busy: "الخدمة مشغولة، جرّبي تاني بعد ثواني.", fix: "راجعي الخانات المميزة.", qtyMax: "أقصى كمية",
    full: `وصلتِ للحد الأقصى للطلب الواحد (${LIMITS.maxTotalQuantity} حزام أو ${LIMITS.maxDistinctItems} منتج مختلف). للكميات الأكبر كلمينا على واتساب.`,
    items: "في مشكلة في منتجات السلة. راجعي الكميات أو احذفي المنتج وأضيفيه تاني.",
    soldOut: "بعض المنتجات نفدت أو المتاح منها أقل، فعدّلنا السلة. راجعيها وأكّدي الطلب تاني.", soldOutBtn: "نفدت الكمية",
    trimmed: "عدّلنا بعض الكميات في السلة على حسب المتاح.",
    added: "اتضاف للسلة", notAdded: "مش متاح نضيف أكتر من المنتج ده",
  },
  en: {
    cur: "EGP", free: "Free", remove: "Remove", sending: "Sending...", submit: "Place order",
    subtotal: "Belts subtotal", discount: "Multi-belt discount", shipping: "Shipping", total: "Total",
    required: "Required", too_short: "Too short", too_long: "Too long", invalid_phone: "Not a valid Egyptian mobile number",
    invalid_governorate: "Choose a governorate", fail: "We could not send the order. Please try again shortly, or order on WhatsApp.",
    busy: "The service is busy, please try again in a few seconds.", fix: "Please check the highlighted fields.", qtyMax: "Maximum quantity",
    full: `You have reached the limit for one order (${LIMITS.maxTotalQuantity} belts or ${LIMITS.maxDistinctItems} different products). For larger orders, contact us on WhatsApp.`,
    items: "There is a problem with the items in your cart. Check the quantities, or remove the product and add it again.",
    soldOut: "Some items sold out or have fewer left, so we updated your cart. Please check it and place the order again.", soldOutBtn: "Sold out",
    trimmed: "We adjusted some quantities in your cart to what is available.",
    added: "Added to your cart", notAdded: "We cannot add more of this item",
  },
}[lang];

function load(): Line[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    const stored = raw
      .filter((l): l is Line => typeof l === "object" && l !== null && typeof (l as Line).id === "string" && Number.isInteger((l as Line).quantity))
      .filter((l) => lookupProduct(l.id) !== undefined && l.quantity > 0);
    // Merge duplicate rows and trim to the same limits the API enforces (old or edited storage may break them).
    const clean: Line[] = [];
    for (const l of stored) {
      const take = Math.min(l.quantity, remainingQuantity(clean, l.id));
      if (take <= 0) continue;
      const existing = clean.find((c) => c.id === l.id);
      if (existing) existing.quantity += take;
      else clean.push({ id: l.id, quantity: take });
    }
    return clean;
  } catch {
    return [];
  }
}
let lines: Line[] = load();
/** Tracked products only (from GET /api/stock). Unknown until loaded; the API enforces stock either way. */
let stock: Map<string, number> | undefined;

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
const limitEl = $("#cart-limit");
const actionsEl = $("#cart-actions");
/** The drawer first shows the cart; the delivery form appears only after "Checkout". */
let step: "cart" | "checkout" = "cart";

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
  trimmedNotice = false;
  const current = lines.find((l) => l.id === id)?.quantity ?? 0;
  const next = Math.min(quantity, current + remainingQuantity(lines, id, stock));
  lines = next <= 0 ? lines.filter((l) => l.id !== id) : lines.map((l) => (l.id === id ? { ...l, quantity: next } : l));
  save();
  render();
}

export function addToCart(id: string, from?: HTMLElement): void {
  if (!lookupProduct(id)) return;
  trimmedNotice = false;
  const added = remainingQuantity(lines, id, stock) > 0;
  if (added) {
    const existing = lines.find((l) => l.id === id);
    if (existing) existing.quantity += 1;
    else lines.push({ id, quantity: 1 });
    save();
  }
  render();
  // Stay on the page so she can keep shopping; a small notice offers the cart.
  showToast(id, added);
  if (added) {
    flyToBag(from);
    bumpCount();
  }
}

/** A small copy of the product photo glides into the bag button (skipped when motion is reduced). */
function flyToBag(from?: HTMLElement): void {
  const source = from?.closest(".card, .product")?.querySelector<HTMLImageElement>("img");
  const bag = document.querySelector<HTMLElement>(".bag-btn");
  if (!source || !bag || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const a = source.getBoundingClientRect();
  const b = bag.getBoundingClientRect();
  if (a.width === 0 || b.width === 0) return;
  const ghost = source.cloneNode() as HTMLImageElement;
  ghost.removeAttribute("srcset");
  ghost.className = "fly";
  const size = Math.min(a.width, a.height, 160);
  Object.assign(ghost.style, { left: `${a.left + (a.width - size) / 2}px`, top: `${a.top + (a.height - size) / 2}px`, width: `${size}px`, height: `${size}px` });
  document.body.append(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  ghost
    .animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(.18)`, opacity: 0.4 },
      ],
      { duration: 650, easing: "cubic-bezier(.5, 0, .2, 1)" },
    )
    .finished.catch(() => undefined)
    .finally(() => ghost.remove());
}

const toast = document.getElementById("cart-toast");
let toastTimer: ReturnType<typeof setTimeout> | undefined;

function showToast(id: string, added: boolean): void {
  const product = getProduct(id);
  if (!toast || !product) return;
  const img = toast.querySelector<HTMLImageElement>("img");
  if (img) img.src = thumbOf(product);
  const title = toast.querySelector("[data-toast-title]");
  if (title) title.textContent = added ? `✓ ${T.added}` : T.notAdded;
  const name = toast.querySelector("[data-toast-name]");
  if (name) name.textContent = productName(lang, product);
  toast.hidden = false;
  toast.classList.remove("show");
  void toast.offsetWidth; // restart the entrance animation
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 4500);
}

function hideToast(): void {
  clearTimeout(toastTimer);
  if (toast) toast.hidden = true;
}

function bumpCount(): void {
  document.querySelectorAll<HTMLElement>("[data-cart-count]").forEach((b) => {
    b.classList.remove("bump");
    void b.offsetWidth;
    b.classList.add("bump");
  });
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
  form.toggleAttribute("hidden", count === 0 || step !== "checkout");
  actionsEl?.toggleAttribute("hidden", count === 0 || step === "checkout");
  totalsEl.toggleAttribute("hidden", count === 0);

  for (const l of lines) {
    const product = getProduct(l.id);
    if (!product) continue;
    const name = productName(lang, product);
    const row = el("div", "cart-line");
    const img = document.createElement("img");
    img.src = thumbOf(product);
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
    plus.disabled = remainingQuantity(lines, l.id, stock) === 0;
    qty.append(minus, el("span", undefined, String(l.quantity)), plus);
    const rm = el("button", "link", T.remove) as HTMLButtonElement;
    rm.type = "button";
    rm.addEventListener("click", () => setQty(l.id, 0));
    row.append(img, info, qty, rm);
    linesEl.append(row);
  }

  if (limitEl) {
    const full = lines.length > 0 && remainingQuantity(lines, "") === 0;
    const notice = full ? T.full : trimmedNotice ? T.trimmed : "";
    limitEl.textContent = notice;
    limitEl.toggleAttribute("hidden", notice === "");
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
  hideToast();
  if (dialog && !dialog.open) {
    step = "cart";
    render();
    dialog.showModal();
  }
}

function goToCheckout(): void {
  step = "checkout";
  render();
  form?.querySelector<HTMLInputElement>('[name="customer.name"]')?.focus();
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
  if (!form || !submitBtn || !statusEl || lines.length === 0 || submitBtn.disabled) return;
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
    const data = (await res.json().catch(() => ({}))) as {
      order?: unknown;
      errors?: Record<string, string>;
      items?: Array<{ id?: unknown; available?: unknown }>;
    };
    if (res.status === 201 && data.order) {
      try {
        // Only what the thank-you page shows; the customer's name, phone and address are not kept in the browser.
        const o = data.order as { id?: unknown; paymentMethod?: unknown; totals?: { total?: unknown } };
        sessionStorage.setItem(ORDER_KEY, JSON.stringify({ id: o.id, paymentMethod: o.paymentMethod, totals: { total: o.totals?.total } }));
      } catch {
        /* the thank-you page still shows a generic message */
      }
      lines = [];
      save();
      location.assign(lang === "en" ? "/en/thanks/" : "/thanks/");
      return;
    }
    if (res.status === 409 && Array.isArray(data.items)) {
      const next = new Map(stock ?? []);
      for (const item of data.items) {
        if (typeof item?.id === "string" && typeof item?.available === "number") next.set(item.id, item.available);
      }
      applyStock(next);
      statusEl.textContent = T.soldOut;
    } else if (res.status === 422 && data.errors) {
      FIELDS.forEach((f) => fieldError(f, data.errors?.[f]));
      const itemProblem = Object.keys(data.errors).some((k) => k === "items" || k.startsWith("items["));
      statusEl.textContent = itemProblem ? T.items : T.fix;
    } else {
      statusEl.textContent = res.status === 503 ? T.busy : T.fail;
    }
  } catch {
    statusEl.textContent = T.fail;
  }
  submitBtn.disabled = false;
  submitBtn.textContent = T.submit;
}

/** Shown once after the cart was reduced to what is in stock. */
let trimmedNotice = false;

/** Reduces cart lines to the tracked stock. Returns true when something changed. */
function trimToStock(): boolean {
  if (!stock) return false;
  let changed = false;
  lines = lines.flatMap((l) => {
    const onHand = stock?.get(l.id);
    if (onHand === undefined || l.quantity <= onHand) return [l];
    changed = true;
    return onHand > 0 ? [{ id: l.id, quantity: onHand }] : [];
  });
  if (changed) save();
  return changed;
}

/** Marks sold-out products on the page: disabled add buttons, "sold out" labels. */
function markSoldOut(): void {
  if (!stock) return;
  document.querySelectorAll<HTMLElement>("[data-soldout-for]").forEach((n) => {
    n.hidden = stock?.get(n.dataset["soldoutFor"] ?? "") !== 0;
  });
  document.querySelectorAll<HTMLButtonElement>("button[data-add]").forEach((b) => {
    const out = stock?.get(b.dataset["add"] ?? "") === 0;
    if (out && !b.disabled) {
      b.dataset["label"] = b.textContent ?? "";
      b.textContent = T.soldOutBtn;
    } else if (!out && b.disabled && b.dataset["label"]) {
      b.textContent = b.dataset["label"];
    }
    b.disabled = out;
  });
}

function applyStock(next: Map<string, number>): void {
  stock = next;
  if (trimToStock()) trimmedNotice = true;
  markSoldOut();
  render();
}

function loadStock(): void {
  fetch(STOCK_URL, { headers: { Accept: "application/json" } })
    .then((res) => (res.ok ? (res.json() as Promise<{ stock?: Record<string, unknown> }>) : null))
    .then((data) => {
      if (!data?.stock || typeof data.stock !== "object") return;
      const next = new Map<string, number>();
      for (const [id, q] of Object.entries(data.stock)) if (typeof q === "number" && Number.isInteger(q) && q >= 0) next.set(id, q);
      applyStock(next);
    })
    .catch(() => {
      /* stock unknown: the page stays as built, and the API still refuses what is not in stock */
    });
}

document.addEventListener("click", (e) => {
  const target = (e.target as HTMLElement).closest<HTMLElement>("[data-add], [data-open-cart], [data-close-cart], [data-checkout], [data-close-toast]");
  if (!target) return;
  if (target.dataset["add"]) addToCart(target.dataset["add"], target);
  else if (target.hasAttribute("data-open-cart")) openCart();
  else if (target.hasAttribute("data-checkout")) goToCheckout();
  else if (target.hasAttribute("data-close-toast")) hideToast();
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
loadStock();

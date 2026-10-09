// Telegram messages for the owner: a new order, and every status change made in the admin. Sent AFTER the
// change is stored; a failure here never fails the order or the change.
import { formatEgp } from "@platform/commerce";
import type { Order, OrderStatus } from "@platform/commerce";

export type Notifier = (order: Order) => Promise<void>;
export type StatusNotifier = (order: Order, from: OrderStatus, to: OrderStatus) => Promise<void>;
/** Sends one plain-text message to the owner's chat. */
export type MessageSender = (text: string) => Promise<void>;

const SHIPPING_AR = { standard: "عادي", express: "سريع" } as const;
const PAYMENT_AR = { cod: "الدفع عند الاستلام", instapay: "InstaPay (تحويل يدوي)" } as const;
/** Same words as the admin page. */
const STATUS_AR: Record<OrderStatus, string> = { new: "جديد", confirmed: "اتأكد", shipped: "اتشحن", delivered: "اتسلم", cancelled: "ملغي" };
const TELEGRAM_MAX = 4000; // Telegram's limit is 4096 characters per message.

const cairoTime = (date: Date) =>
  new Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }).format(date);
const capped = (text: string) => (text.length > TELEGRAM_MAX ? `${text.slice(0, TELEGRAM_MAX - 1)}…` : text);

/** Plain text (no Markdown/HTML parse mode), so customer text can never change the formatting. */
export function formatOrderMessage(order: Order): string {
  const c = order.customer;
  const t = order.totals;
  const lines = [
    `طلب جديد ${order.id}`,
    cairoTime(new Date(order.createdAt)),
    "",
    `الاسم: ${c.name}`,
    `الموبايل: ${c.phone}`,
    `واتساب: https://wa.me/2${c.phone}`,
    `المحافظة: ${c.governorate}`,
    `العنوان: ${c.address}`,
    ...(c.notes ? [`ملاحظات: ${c.notes}`] : []),
    "",
    ...order.items.map((i) => `- ${i.name} (${i.productId}) × ${i.quantity} = ${formatEgp(i.lineTotal)} ج`),
    "",
    `الأحزمة: ${formatEgp(t.subtotal)} ج`,
    ...(t.discount > 0 ? [`الخصم${order.promoCode ? ` (كود ${order.promoCode})` : ""}: -${formatEgp(t.discount)} ج`] : []),
    `الشحن (${SHIPPING_AR[order.shippingMethod]}): ${t.shipping === 0 ? "مجاني" : `${formatEgp(t.shipping)} ج`}`,
    `الإجمالي: ${formatEgp(t.total)} ج`,
    `الدفع: ${PAYMENT_AR[order.paymentMethod]}`,
  ];
  return capped(lines.join("\n"));
}

/** A status change made in the admin: who the order is for and how to reach her, without the full order again. */
export function formatStatusMessage(order: Order, from: OrderStatus, to: OrderStatus, at: Date): string {
  const c = order.customer;
  const lines = [
    `الطلب ${order.id}: ${STATUS_AR[from]} ← ${STATUS_AR[to]}`,
    cairoTime(at),
    "",
    `الاسم: ${c.name}`,
    `الموبايل: ${c.phone}`,
    `واتساب: https://wa.me/2${c.phone}`,
    `الإجمالي: ${formatEgp(order.totals.total)} ج`,
    ...(to === "cancelled" ? ["", "أي كمية كانت محجوزة للطلب ده رجعت للمخزون."] : []),
  ];
  return capped(lines.join("\n"));
}

/**
 * Sends the message to one Telegram chat with the Bot API. The token stays inside this function:
 * it is part of the request URL, so the URL is never logged and errors carry only the HTTP status.
 */
export function telegramSender(token: string, chatId: string, fetchImpl: typeof fetch = fetch): MessageSender {
  return async (text) => {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (!res.ok) throw new Error(`telegram_http_${res.status}`);
  };
}

/** New-order messages over Telegram. */
export function telegramNotifier(token: string, chatId: string, fetchImpl: typeof fetch = fetch): Notifier {
  const send = telegramSender(token, chatId, fetchImpl);
  return (order) => send(formatOrderMessage(order));
}

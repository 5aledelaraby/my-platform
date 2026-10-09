// New-order notification for the owner. Sent AFTER the order is stored; a failure here never fails the order.
import { formatEgp } from "@platform/commerce";
import type { Order } from "@platform/commerce";

export type Notifier = (order: Order) => Promise<void>;

const SHIPPING_AR = { standard: "عادي", express: "سريع" } as const;
const PAYMENT_AR = { cod: "الدفع عند الاستلام", instapay: "InstaPay (تحويل يدوي)" } as const;
const TELEGRAM_MAX = 4000; // Telegram's limit is 4096 characters per message.

/** Plain text (no Markdown/HTML parse mode), so customer text can never change the formatting. */
export function formatOrderMessage(order: Order): string {
  const c = order.customer;
  const t = order.totals;
  const when = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Cairo",
  }).format(new Date(order.createdAt));
  const lines = [
    `طلب جديد ${order.id}`,
    when,
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
    ...(t.discount > 0 ? [`الخصم: -${formatEgp(t.discount)} ج`] : []),
    `الشحن (${SHIPPING_AR[order.shippingMethod]}): ${t.shipping === 0 ? "مجاني" : `${formatEgp(t.shipping)} ج`}`,
    `الإجمالي: ${formatEgp(t.total)} ج`,
    `الدفع: ${PAYMENT_AR[order.paymentMethod]}`,
  ];
  const text = lines.join("\n");
  return text.length > TELEGRAM_MAX ? `${text.slice(0, TELEGRAM_MAX - 1)}…` : text;
}

/**
 * Sends the message to one Telegram chat with the Bot API. The token stays inside this function:
 * it is part of the request URL, so the URL is never logged and errors carry only the HTTP status.
 */
export function telegramNotifier(token: string, chatId: string, fetchImpl: typeof fetch = fetch): Notifier {
  return async (order) => {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: formatOrderMessage(order), disable_web_page_preview: true }),
    });
    if (!res.ok) throw new Error(`telegram_http_${res.status}`);
  };
}

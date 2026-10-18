// PayPal on the thank-you page (ADR 0014). The order is already stored; this takes its payment in US dollars.
// The amount is decided by the API from the stored order and the owner's rate: the browser only passes the order id
// and PayPal's order id. PayPal's own script is loaded only here, only for a PayPal order.
import { formatUsd, isUsdRate, toUsdCents } from "@platform/commerce";
import type { Lang } from "../site.ts";

const API = ((import.meta.env.PUBLIC_API_URL as string | undefined) ?? "/api/orders").replace(/\/orders\/?$/, "");

const T = {
  ar: {
    off: "الدفع بـ PayPal مش متاح دلوقتي. كلمينا على واتساب ونغيّر طريقة الدفع.",
    cancelled: "ما اتدفعش. تقدري تجربي تاني من الزرار.",
    declined: "PayPal رفض الكارت أو الحساب ده. جربي طريقة تانية.",
    pending: "PayPal بيراجع الدفع، وهنأكدلك أول ما يخلص.",
    failed: "حصلت مشكلة في الدفع. جربي تاني، أو كلمينا على واتساب.",
    paying: "جاري تأكيد الدفع...",
  },
  en: {
    off: "PayPal is not available right now. Message us on WhatsApp and we will change the payment method.",
    cancelled: "Not paid. You can try again with the button.",
    declined: "PayPal declined this card or account. Please try another one.",
    pending: "PayPal is reviewing the payment; we will confirm as soon as it is done.",
    failed: "Something went wrong with the payment. Try again, or message us on WhatsApp.",
    paying: "Confirming your payment...",
  },
};

interface PaypalButtons {
  render(selector: string): Promise<void>;
}
interface PaypalSdk {
  Buttons(options: {
    style?: Record<string, string>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }, actions: { restart(): Promise<void> }) => Promise<void>;
    onCancel?: () => void;
    onError?: (error: unknown) => void;
  }): PaypalButtons;
}

async function post(path: string, body: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

function loadSdk(clientId: string, lang: Lang): Promise<PaypalSdk> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ "client-id": clientId, currency: "USD", intent: "capture", components: "buttons", locale: lang === "ar" ? "ar_EG" : "en_US" });
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.async = true;
    script.onload = () => {
      const sdk = (window as unknown as { paypal?: PaypalSdk }).paypal;
      if (sdk) resolve(sdk);
      else reject(new Error("paypal_sdk_missing"));
    };
    script.onerror = () => reject(new Error("paypal_sdk_failed"));
    document.head.append(script);
  });
}

export async function startPaypal(orderId: string, total: number, lang: Lang): Promise<void> {
  const t = T[lang];
  const box = document.getElementById("t-paypal");
  const msg = document.getElementById("t-paypal-msg");
  const paidEl = document.getElementById("t-paid");
  if (!box || !msg || !paidEl) return;
  const paidKey = `vicuna-paid-${orderId}`;
  const showPaid = () => {
    box.hidden = true;
    paidEl.hidden = false;
    try {
      sessionStorage.setItem(paidKey, "1");
    } catch {
      /* storage unavailable */
    }
  };
  try {
    if (sessionStorage.getItem(paidKey) === "1") return showPaid();
  } catch {
    /* storage unavailable */
  }
  box.hidden = false;
  try {
    const res = await fetch(`${API}/paypal/config`, { headers: { Accept: "application/json" } });
    const config = (await res.json()) as { enabled?: unknown; clientId?: unknown; usdRate?: unknown };
    if (!res.ok || config.enabled !== true || typeof config.clientId !== "string" || !isUsdRate(config.usdRate)) {
      msg.textContent = t.off;
      return;
    }
    document.getElementById("t-usd")!.textContent = `$${formatUsd(toUsdCents(total, config.usdRate))}`;
    const sdk = await loadSdk(config.clientId, lang);
    await sdk
      .Buttons({
        style: { layout: "vertical", shape: "pill", label: "pay" },
        async createOrder() {
          msg.textContent = "";
          const { status, data } = await post("/paypal/orders", { orderId });
          if (status === 409 && data["error"] === "already_paid") showPaid();
          if (status !== 201 || typeof data["id"] !== "string") throw new Error(String(data["error"] ?? status));
          return data["id"];
        },
        async onApprove(data, actions) {
          msg.textContent = t.paying;
          const { status, data: result } = await post("/paypal/capture", { orderId, paypalOrderId: data.orderID });
          if (status === 200 && result["paid"] === true) return showPaid();
          if (status === 202) {
            msg.textContent = t.pending;
            return;
          }
          if (status === 402) {
            msg.textContent = t.declined;
            return actions.restart();
          }
          msg.textContent = `${t.failed} (${status} ${String(result["error"] ?? "")})`;
        },
        onCancel() {
          msg.textContent = t.cancelled;
        },
        onError(error) {
          // A short reason after the message, so a failure can be traced (no personal data in it).
          const reason = error instanceof Error ? error.message : String(error);
          if (paidEl.hidden) msg.textContent = `${t.failed} (${reason.slice(0, 80)})`;
        },
      })
      .render("#paypal-buttons");
  } catch (error) {
    msg.textContent = `${t.failed} (${error instanceof Error ? error.message.slice(0, 80) : "load"})`;
  }
}

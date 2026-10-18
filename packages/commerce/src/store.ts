import { egp } from "./money.ts";
import type { ShippingConfig } from "./pricing.ts";

/** Store-wide commerce settings. Single source of truth for the website and the API. */
export const SHIPPING: ShippingConfig = {
  standard: egp(80),
  express: egp(120),
  freeOver: egp(1500),
};

export const SHIPPING_METHODS = ["standard", "express", "pickup"] as const;

/**
 * Every payment method an order can carry. "cod" = cash on delivery. "paypal" = paid online in US dollars (card or
 * PayPal account) on the thank-you page after the order is placed (ADR 0014). "instapay" = manual transfer: no longer
 * offered (owner, 2026-10-18), kept so older orders still read correctly.
 */
export const PAYMENT_METHODS = ["cod", "instapay", "paypal"] as const;

/** The methods a new order may choose (owner, 2026-10-18: cash on delivery, or card / PayPal). */
export const OFFERED_PAYMENT_METHODS = ["cod", "paypal"] as const satisfies ReadonlyArray<(typeof PAYMENT_METHODS)[number]>;

/** Canonical governorate names (Arabic), in display order. */
export const GOVERNORATES = [
  "القاهرة", "الجيزة", "الإسكندرية", "القليوبية", "الدقهلية", "الشرقية", "الغربية",
  "المنوفية", "البحيرة", "كفر الشيخ", "دمياط", "بورسعيد", "الإسماعيلية", "السويس",
  "الفيوم", "بني سويف", "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان",
  "البحر الأحمر", "الوادي الجديد", "مطروح", "شمال سيناء", "جنوب سيناء",
] as const;

/** English names, index-aligned with GOVERNORATES. */
export const GOVERNORATES_EN = [
  "Cairo", "Giza", "Alexandria", "Qalyubia", "Dakahlia", "Sharqia", "Gharbia",
  "Monufia", "Beheira", "Kafr El Sheikh", "Damietta", "Port Said", "Ismailia", "Suez",
  "Faiyum", "Beni Suef", "Minya", "Asyut", "Sohag", "Qena", "Luxor", "Aswan",
  "Red Sea", "New Valley", "Matrouh", "North Sinai", "South Sinai",
] as const;

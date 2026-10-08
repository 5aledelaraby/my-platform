import { egp } from "./money.ts";
import type { ShippingConfig } from "./pricing.ts";

/** Store-wide commerce settings. Single source of truth for the website and the API. */
export const SHIPPING: ShippingConfig = {
  standard: egp(80),
  express: egp(120),
  freeOver: egp(1500),
};

export const SHIPPING_METHODS = ["standard", "express"] as const;

/** "cod" = cash on delivery. "instapay" = customer transfers manually and sends the receipt; nothing is charged online. */
export const PAYMENT_METHODS = ["cod", "instapay"] as const;

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

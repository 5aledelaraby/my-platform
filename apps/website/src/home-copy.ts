import { site } from "./site.ts";
import type { Lang } from "./site.ts";

export interface HomeCopy {
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  lead: string;
  cta: string;
  ctaWhatsapp: string;
  trust: readonly string[];
  stylesEyebrow: string;
  stylesTitle: string;
  stylesLead: string;
  customEyebrow: string;
  customTitle: string;
  customBody: string;
  customCta: string;
  faqTitle: string;
  faq: readonly { q: string; a: string }[];
}

const d = site.deliveryDays;
const r = site.returnDays;
const kg = site.maxWeightKg;

export const homeCopy: Record<Lang, HomeCopy> = {
  ar: {
    title: "فيكونا | أحزمة خصر نسائية من جلد PU",
    description: `أحزمة خصر نسائية من جلد PU بخمسة تصميمات وألوان كثيرة. توصيل إلى جميع المحافظات خلال ${d} أيام عمل واسترجاع خلال ${r} يومًا.`,
    eyebrow: "فيكونا · أحزمة خصر نسائية",
    h1: "أحزمة خصر نسائية",
    lead: "من جلد PU، بخمسة تصميمات وألوان كثيرة، للفستان والبلوزة والجاكيت. توصيل لكل محافظات مصر.",
    cta: "تسوّقي أحزمة الخصر",
    ctaWhatsapp: "تحدّثي إلينا على واتساب",
    trust: [`توصيل خلال ${d} أيام عمل`, `استرجاع خلال ${r} يومًا`, "الدفع عند الاستلام أو InstaPay", `مقاس يناسب حتى ${kg} كجم`],
    stylesEyebrow: "المجموعات",
    stylesTitle: "كل أحزمة الخصر",
    stylesLead: "خمسة تصميمات: عريض برباط عريض، عريض برباط رفيع، كشكشة، دانتيل، وبنقشة مميزة. اختاري التصميم ثم اللون.",
    customEyebrow: "تفصيل خاص",
    customTitle: "حزام وسط من الجلد الطبيعي على مقاسكِ",
    customBody: "في القاهرة والجيزة تقابلكِ واحدة من فريق فيكونا لتأخذ مقاسكِ بدقة وتعرض عليكِ الجلود الطبيعية، ونتفق معًا على التصميم والسعر قبل أن نبدأ.",
    customCta: "احجزي موعدًا على واتساب",
    faqTitle: "أسئلة شائعة",
    faq: [
      { q: "كم تستغرق مدة التوصيل؟", a: `يصلكِ الطلب إلى أي محافظة في مصر خلال ${d} أيام عمل.` },
      { q: "كيف أدفع؟", a: "الدفع عند الاستلام، أو بالتحويل عبر InstaPay." },
      { q: "هل يمكنني استرجاع حزام الوسط؟", a: `نعم، خلال ${r} يومًا من الاستلام، ويُردّ المبلغ خلال ${site.refundDays} أيام.` },
      { q: "ما خامة أحزمة الخصر؟", a: "جلد PU. أما الجلد الطبيعي فيتوفر فقط عند الطلب الخاص." },
      { q: "ما المقاس المناسب لي؟", a: "حزام الرباط العريض بعرض 14 سم وطول 140 سم، وحزام الرباط الرفيع بعرض 10 سم وطول بطن 90 سم، وحزام الكشكشة بداخله أستك يضبط المقاس على الخصر بالتحديد. للمقاسات الأخرى راسلينا على واتساب." },
    ],
  },
  en: {
    title: "Vicuna | Women's PU leather waist belts",
    description: `Women's waist belts in PU leather, in five designs and many colours. Delivery to every governorate in ${d} working days, returns within ${r} days.`,
    eyebrow: "Vicuna · Women's waist belts",
    h1: "Women's waist belts",
    lead: "In PU leather, in five designs and many colours, for dresses, blouses and jackets. Delivery to every governorate in Egypt.",
    cta: "Shop the belts",
    ctaWhatsapp: "Chat on WhatsApp",
    trust: [`Delivery in ${d} working days`, `${r}-day returns`, "Cash on delivery or InstaPay", `Fits up to ${kg} kg`],
    stylesEyebrow: "Collections",
    stylesTitle: "All belts",
    stylesLead: "Five designs: wide tie, thin tie, ruffle, lace and signature pattern. Choose a design, then a colour.",
    customEyebrow: "Made to measure",
    customTitle: "A natural leather belt made to your size",
    customBody: "In Cairo and Giza, a member of the Vicuna team meets you to take your measurements and show you the natural leathers, and we agree on the design and price together before we start.",
    customCta: "Book on WhatsApp",
    faqTitle: "Common questions",
    faq: [
      { q: "How long does delivery take?", a: `Your order reaches any governorate in Egypt in ${d} working days.` },
      { q: "How do I pay?", a: "Cash on delivery, or a transfer through InstaPay." },
      { q: "Can I return a belt?", a: `Yes, within ${r} days of receiving it, and the amount is refunded within ${site.refundDays} days.` },
      { q: "What are the belts made of?", a: "PU leather. Natural leather is only available as a custom order." },
      { q: "Which size is right for me?", a: "The wide-tie belt is 14 cm wide and 140 cm long, the thin-tie belt is 10 cm wide and 90 cm around the waist, and the ruffle belt has elastic inside for an exact fit at the waist. For other sizes, message us on WhatsApp." },
    ],
  },
};

import { SHIPPING, formatEgp } from "@platform/commerce";
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
  heroAlt: string;
  trust: readonly string[];
  stylesEyebrow: string;
  stylesTitle: string;
  stylesLead: string;
  stylesAll: string;
  whyEyebrow: string;
  whyTitle: string;
  why: readonly { t: string; d: string }[];
  craftEyebrow: string;
  craftTitle: string;
  craftBody: string;
  collageAlt: string;
  founderName: string;
  founderRole: string;
  promisesEyebrow: string;
  promisesTitle: string;
  promises: readonly { t: string; d: string }[];
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
const std = formatEgp(SHIPPING.standard);
const free = formatEgp(SHIPPING.freeOver);

export const homeCopy: Record<Lang, HomeCopy> = {
  ar: {
    title: "فيكونا | أحزمة خصر نسائية بقصّ ليزر وخياطة يدوية",
    description: `فيكونا علامة مصرية لأحزمة الخصر النسائية من جلد PU، بقصّ ليزر وخياطة يدوية. توصيل إلى جميع المحافظات خلال ${d} أيام عمل واسترجاع خلال ${r} يومًا.`,
    eyebrow: "فيكونا · أحزمة خصر نسائية",
    h1: "أحزمة خصر نسائية، تُفصَّل بعناية وتُخاط باليد",
    lead: "نقصّ كل حزام بالليزر ونخيطه يدويًا من جلد PU، ليمنح الفستان والبلوزة والجاكيت خصرًا محدّدًا وأنيقًا. نوصّل إلى جميع محافظات مصر.",
    cta: "تسوّقي الأحزمة",
    ctaWhatsapp: "تحدّثي إلينا على واتساب",
    heroAlt: "ثلاثة أحزمة خصر من فيكونا على مجسّمات عرض: بني بعقدة، وأبيض بفيونكة، وأسود بكشكشة",
    trust: [`توصيل خلال ${d} أيام عمل`, `استرجاع خلال ${r} يومًا`, "الدفع عند الاستلام أو InstaPay", `مقاس يناسب حتى ${kg} كجم`],
    stylesEyebrow: "المجموعات",
    stylesTitle: "ستة تصاميم، لكل منها شخصيتها",
    stylesLead: "من الدانتيل الناعم إلى نقشة الكروكو، اختاري التصميم أولًا ثم اللون.",
    stylesAll: "عرض كل الأحزمة",
    whyEyebrow: "لماذا فيكونا",
    whyTitle: "تفاصيل صغيرة تصنع الفرق",
    why: [
      { t: "تحديد واضح للخصر", d: "أحزمة عريضة بشريط للربط تتشكّل على الجسم، فتناسب الفستان والبلوزة والجاكيت." },
      { t: "خامة معلنة", d: "جلد PU، نذكره صراحة في كل منتج. والجلد الطبيعي متاح فقط ضمن الطلبات الخاصة." },
      { t: "مقاس مدروس", d: `المقاس المعتاد بعرض 14 سم وطول 140 سم، ويناسب حتى ${kg} كجم. وإن احتجتِ مقاسًا آخر فنفصّله لكِ.` },
    ],
    craftEyebrow: "الصنعة",
    craftTitle: "من القصّ إلى التشطيب، بأيدينا",
    craftBody: "نقصّ القطع بالليزر لتخرج الحواف نظيفة ومتساوية، ثم نخيط كل حزام ونُنهيه يدويًا. ويراجع مؤسس فيكونا كل حزام بنفسه قبل الشحن.",
    collageAlt: "خالد العربي يفصّل ويضبط حزام فيونكة كحلي على مجسّم عرض",
    founderName: "خالد العربي",
    founderRole: "مؤسس فيكونا",
    promisesEyebrow: "الالتزامات",
    promisesTitle: "ما نلتزم به معك",
    promises: [
      { t: "التوصيل", d: `إلى جميع محافظات مصر خلال ${d} أيام عمل. الشحن ${std} جنيهًا، ومجاني للطلبات من ${free} جنيه فأكثر.` },
      { t: "الاسترجاع", d: `يمكنك استرجاع الحزام خلال ${r} يومًا، ويُردّ المبلغ خلال ${site.refundDays} أيام.` },
      { t: "الدفع", d: "عند الاستلام أو عبر InstaPay. لا يُطلب منكِ أي دفع إلكتروني على الموقع." },
      { t: "صنعة يدوية", d: "نقصّ كل حزام بالليزر ونخيطه يدويًا، ونراجعه قبل الشحن." },
    ],
    customEyebrow: "طلب خاص",
    customTitle: "هل تحتاجين مقاسًا أو خامة مختلفة؟",
    customBody: "نقبل طلبات المقاس الخاص، وكذلك الأحزمة من الجلد الطبيعي بحسب الطلب. راسلينا على واتساب وصِفي لنا ما تحتاجينه.",
    customCta: "اطلبي مقاسًا خاصًا",
    faqTitle: "أسئلة شائعة",
    faq: [
      { q: "كم تستغرق مدة التوصيل؟", a: `يصلكِ الطلب إلى أي محافظة في مصر خلال ${d} أيام عمل.` },
      { q: "كيف أدفع؟", a: "الدفع عند الاستلام، أو بالتحويل عبر InstaPay." },
      { q: "هل يمكنني استرجاع الحزام؟", a: `نعم، خلال ${r} يومًا من الاستلام، ويُردّ المبلغ خلال ${site.refundDays} أيام.` },
      { q: "ما خامة الأحزمة؟", a: "جلد PU. أما الجلد الطبيعي فيتوفر فقط عند الطلب الخاص." },
      { q: "ما المقاس المناسب لي؟", a: `المقاس المعتاد بعرض 14 سم وطول 140 سم، ويناسب حتى ${kg} كجم. للمقاسات الأخرى راسلينا على واتساب.` },
    ],
  },
  en: {
    title: "Vicuna | Women's waist belts, laser-cut and hand-sewn",
    description: `Vicuna is an Egyptian brand of women's waist belts in PU leather, laser-cut and hand-sewn. Delivery to every governorate in ${d} working days, returns within ${r} days.`,
    eyebrow: "Vicuna · Women's waist belts",
    h1: "Women's waist belts, cut with care and sewn by hand",
    lead: "Every belt is laser-cut and hand-sewn in PU leather to give a dress, blouse or jacket a defined, elegant waist. We deliver to every governorate in Egypt.",
    cta: "Shop the belts",
    ctaWhatsapp: "Chat on WhatsApp",
    heroAlt: "Three Vicuna waist belts on display mannequins: brown with a knot, white with a bow, black with ruffles",
    trust: [`Delivery in ${d} working days`, `${r}-day returns`, "Cash on delivery or InstaPay", `Fits up to ${kg} kg`],
    stylesEyebrow: "Collections",
    stylesTitle: "Six designs, each with its own character",
    stylesLead: "From soft lace to croc texture: choose a design first, then a colour.",
    stylesAll: "View all belts",
    whyEyebrow: "Why Vicuna",
    whyTitle: "Small details that make the difference",
    why: [
      { t: "A clearly defined waist", d: "Wide belts with a tie that mould to the body, for dresses, blouses and jackets." },
      { t: "A declared material", d: "PU leather, stated on every product. Natural leather is only available as a custom order." },
      { t: "A considered size", d: `The usual size is 14 cm wide and 140 cm long and fits up to ${kg} kg. If you need another size, we make it for you.` },
    ],
    craftEyebrow: "The craft",
    craftTitle: "From cutting to finishing, by our own hands",
    craftBody: "We laser-cut each piece so the edges come out clean and even, then sew and finish every belt by hand. The founder checks each belt himself before it ships.",
    collageAlt: "Khaled Elaraby making and fitting a navy bow belt on a display mannequin",
    founderName: "Khaled Elaraby",
    founderRole: "Founder of Vicuna",
    promisesEyebrow: "Our commitments",
    promisesTitle: "What we commit to",
    promises: [
      { t: "Delivery", d: `To every governorate in Egypt in ${d} working days. Shipping is ${std} EGP, and free on orders of ${free} EGP or more.` },
      { t: "Returns", d: `You can return a belt within ${r} days, and the amount is refunded within ${site.refundDays} days.` },
      { t: "Payment", d: "Cash on delivery or InstaPay. You are never asked to pay online on this site." },
      { t: "Handmade", d: "We laser-cut and hand-sew every belt, and check it before it ships." },
    ],
    customEyebrow: "Custom orders",
    customTitle: "Need a different size or material?",
    customBody: "We take custom-size orders, and belts in natural leather on request. Message us on WhatsApp and describe what you need.",
    customCta: "Ask for a custom size",
    faqTitle: "Common questions",
    faq: [
      { q: "How long does delivery take?", a: `Your order reaches any governorate in Egypt in ${d} working days.` },
      { q: "How do I pay?", a: "Cash on delivery, or a transfer through InstaPay." },
      { q: "Can I return a belt?", a: `Yes, within ${r} days of receiving it, and the amount is refunded within ${site.refundDays} days.` },
      { q: "What are the belts made of?", a: "PU leather. Natural leather is only available as a custom order." },
      { q: "Which size is right for me?", a: `The usual size is 14 cm wide and 140 cm long and fits up to ${kg} kg. For other sizes, message us on WhatsApp.` },
    ],
  },
};

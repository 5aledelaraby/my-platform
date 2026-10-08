import { site } from "./site.ts";
import type { Lang } from "./site.ts";

export interface HomeCopy {
  title: string;
  description: string;
  eyebrow: string;
  h1a: string;
  h1b: string;
  lead: string;
  cta: string;
  ctaWhatsapp: string;
  heroAlt: string;
  perks: readonly { t: string; d: string }[];
  handEyebrow: string;
  handTitle: string;
  handBody: string;
  collageAlt: string;
  founderName: string;
  founderRole: string;
  bespokeEyebrow: string;
  bespokeTitle: string;
  bespokeBody: string;
  linksTitle: string;
  links: readonly { t: string; d: string; href: string }[];
  faqTitle: string;
  faq: readonly { q: string; a: string }[];
}

const d = site.deliveryDays;
const r = site.returnDays;

export const homeCopy: Record<Lang, HomeCopy> = {
  ar: {
    title: "فيكونا | أحزمة خصر نسائية متفصلة بإيد",
    description: `فيكونا براند مصري لأحزمة الخصر النسائية: قص بالليزر وخياطة بإيد، توصيل لكل مصر خلال ${d} أيام، واسترجاع خلال ${r} يوم.`,
    eyebrow: "براند مصري لأحزمة الخصر",
    h1a: "حزام واحد",
    h1b: "يغيّر اللوك كله",
    lead: "في فيكونا بنفصّل أحزمة خصر نسائية بتحدد الوسط وتكمّل أي لبس، من الجلد الصناعي PU، بإيد ورشة مصرية وبمراجعة صاحب البراند بنفسه.",
    cta: "شوفي الأحزمة",
    ctaWhatsapp: "كلميني على واتساب",
    heroAlt: "حزام خصر من فيكونا على لبس نسائي",
    perks: [
      { t: `توصيل خلال ${d} أيام`, d: "لكل محافظات مصر" },
      { t: "الدفع عند الاستلام", d: "أو InstaPay" },
      { t: `استرجاع ${r} يوم`, d: "حسب سياسة الاسترجاع" },
      { t: `بيلبس لحد ${site.maxWeightKg} كيلو`, d: "ومقاسات خاصة بالطلب" },
    ],
    handEyebrow: "مصنوع بإيدينا",
    handTitle: "كل حزام بيتقص بالليزر وبيتخيّط بإيد",
    handBody: "القص بالليزر بيخلّي الحواف نضيفة ومظبوطة، وبعدها الخياطة والتشطيب بالإيد، وكل حزام بيتراجع قبل ما يتشحن.",
    collageAlt: "خالد العربي بيفصّل ويظبط حزام فيونكة كحلي",
    founderName: "خالد العربي",
    founderRole: "مؤسس فيكونا، وبيراجع كل حزام بنفسه قبل الشحن",
    bespokeEyebrow: "تفصيل خاص",
    bespokeTitle: "عايزة مقاس أو خامة مخصوصة؟",
    bespokeBody: "بنقبل طلبات التفصيل بمقاس خاص، وكمان حزام بجلد طبيعي حسب الطلب. كلمينا على واتساب وقوليلنا اللي في بالك.",
    linksTitle: "ابدئي من هنا",
    links: [
      { t: "كل الأحزمة", d: "اتفرجي على المجموعة كلها", href: "/belts/" },
    ],
    faqTitle: "أسئلة شائعة",
    faq: [
      { q: "التوصيل بياخد قد إيه؟", a: `التوصيل لكل محافظات مصر خلال ${d} أيام عمل تقريبًا من تأكيد الطلب.` },
      { q: "إزاي أدفع؟", a: "الدفع عند الاستلام، أو InstaPay لو حبيتي." },
      { q: "ينفع أرجّع الحزام؟", a: `أيوه، في استرجاع خلال ${r} يوم حسب سياسة الاسترجاع.` },
      { q: "الحزام بيناسب أي مقاس؟", a: `بيلبس لحد ${site.maxWeightKg} كيلو، ولو محتاجة مقاس مختلف اطلبيه مخصوص وهنظبطه معاكي.` },
    ],
  },
  en: {
    title: "Vicuna | Women's waist belts made by hand",
    description: `Vicuna is an Egyptian brand of women's waist belts: laser-cut and hand-sewn, delivered across Egypt in ${d} days, with ${r}-day returns.`,
    eyebrow: "An Egyptian waist-belt brand",
    h1a: "One belt",
    h1b: "changes the whole look",
    lead: "Vicuna makes women's waist belts in PU leather that define the waist and finish any outfit, sewn in an Egyptian workshop and checked by the founder himself.",
    cta: "Shop the belts",
    ctaWhatsapp: "Chat on WhatsApp",
    heroAlt: "A Vicuna waist belt styled on a women's outfit",
    perks: [
      { t: `Delivery in ${d} days`, d: "To every governorate" },
      { t: "Cash on delivery", d: "or InstaPay" },
      { t: `${r}-day returns`, d: "Per our return policy" },
      { t: `Fits up to ${site.maxWeightKg} kg`, d: "Custom sizes on request" },
    ],
    handEyebrow: "Made by hand",
    handTitle: "Every belt is laser-cut, then sewn by hand",
    handBody: "Laser cutting keeps the edges clean and exact. Sewing and finishing are done by hand, and every belt is checked before it ships.",
    collageAlt: "Khaled Elaraby making and fitting a navy bow belt",
    founderName: "Khaled Elaraby",
    founderRole: "Founder of Vicuna, checks every belt himself before shipping",
    bespokeEyebrow: "Made to order",
    bespokeTitle: "Need a special size or material?",
    bespokeBody: "We take custom-size orders, and belts in natural leather on request. Message us on WhatsApp and tell us what you have in mind.",
    linksTitle: "Start here",
    links: [
      { t: "All belts", d: "Browse the full collection", href: "/belts/" },
    ],
    faqTitle: "Common questions",
    faq: [
      { q: "How long does delivery take?", a: `Delivery to every governorate takes about ${d} working days from order confirmation.` },
      { q: "How do I pay?", a: "Cash on delivery, or InstaPay if you prefer." },
      { q: "Can I return a belt?", a: `Yes, returns are accepted within ${r} days under our return policy.` },
      { q: "Will it fit me?", a: `It fits up to ${site.maxWeightKg} kg; for any other size, order a custom one and we will adjust it with you.` },
    ],
  },
};

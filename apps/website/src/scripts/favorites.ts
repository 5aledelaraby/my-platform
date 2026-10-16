// Favourites (owner, 2026-10-16): a heart on every belt keeps it in a list on this device (localStorage
// "vicuna-favorites", listed in the cookie policy). Nothing is sent to us. The header heart shows the count and
// opens the favourites page, which shows only the saved belts.
const KEY = "vicuna-favorites";
const MAX = 60;

export function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function write(list: string[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch { /* private mode: this page only */ }
}

const ar = document.documentElement.lang !== "en";
let favs = readFavorites();

function paint(): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-fav]")) {
    const on = favs.includes(b.dataset["fav"] ?? "");
    b.setAttribute("aria-pressed", String(on));
    const name = b.dataset["favName"] ?? "";
    b.setAttribute("aria-label", on ? (ar ? `إزالة ${name} من المفضلة` : `Remove ${name} from favourites`) : (ar ? `إضافة ${name} للمفضلة` : `Add ${name} to favourites`));
  }
  for (const c of document.querySelectorAll<HTMLElement>("[data-fav-count]")) {
    c.textContent = String(favs.length);
    c.hidden = favs.length === 0;
  }
  // Favourites page: show only the saved belts, in the order they were saved (newest first).
  const grid = document.querySelector<HTMLElement>("[data-fav-grid]");
  if (grid) {
    // Each saved belt sits in a .fav-item; a sold-out belt's card is removed by the site Worker, so its item stays hidden.
    const cards = [...grid.querySelectorAll<HTMLElement>(":scope > .fav-item")];
    for (const card of cards) card.hidden = !favs.includes(card.dataset["product"] ?? "") || !card.querySelector(".card:not([hidden])");
    for (const id of [...favs].reverse()) {
      const card = cards.find((c) => c.dataset["product"] === id);
      if (card) grid.prepend(card);
    }
    const empty = document.querySelector<HTMLElement>("[data-fav-empty]");
    if (empty) empty.hidden = cards.some((c) => !c.hidden);
  }
}

document.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-fav]");
  if (!b) return;
  e.preventDefault();
  const id = b.dataset["fav"] ?? "";
  if (!id) return;
  favs = readFavorites();
  favs = favs.includes(id) ? favs.filter((x) => x !== id) : [id, ...favs];
  write(favs);
  paint();
  if (favs.includes(id) && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    b.classList.remove("pop");
    void b.offsetWidth;
    b.classList.add("pop");
  }
});
// Another tab changed the list, or the product page switched colour.
addEventListener("storage", (e) => { if (e.key === KEY) { favs = readFavorites(); paint(); } });
addEventListener("vicuna:fav-refresh", paint);
paint();

// The owner's admin page: plain HTML, CSS and JavaScript served by the Worker on the admin hostname only.
// Customer data is only ever inserted with textContent (never innerHTML): names and addresses are typed by
// strangers. The page is protected by Cloudflare Access and served with a strict Content-Security-Policy.
// Keep these strings free of backticks and "${" so they stay plain text inside the template literals.

export const ADMIN_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>إدارة فيكونا</title>
<link rel="stylesheet" href="/app.css">
</head>
<body>
<header class="top">
  <h1>إدارة فيكونا</h1>
  <nav class="tabs" role="tablist">
    <button type="button" role="tab" data-tab="orders" aria-selected="true">الطلبات</button>
    <button type="button" role="tab" data-tab="stock" aria-selected="false">المخزون</button>
    <button type="button" role="tab" data-tab="promos" aria-selected="false">أكواد الخصم</button>
  </nav>
</header>
<main>
  <section id="orders-view">
    <div class="bar">
      <label>الحالة
        <select id="status-filter">
          <option value="">الكل</option>
          <option value="new">جديد</option>
          <option value="confirmed">اتأكد</option>
          <option value="shipped">اتشحن</option>
          <option value="delivered">اتسلم</option>
          <option value="cancelled">ملغي</option>
        </select>
      </label>
      <button type="button" id="refresh-orders" class="ghost">تحديث</button>
    </div>
    <p id="orders-msg" class="msg" role="status"></p>
    <div id="orders-list"></div>
  </section>
  <section id="stock-view" hidden>
    <p class="hint">اكتب الكمية <b>المتاحة للبيع</b> واضغط حفظ: يعني اللي على الرف ناقص "المحجوز" (طلبات لسه ما اتشحنتش، وكميتها اتخصمت خلاص). الخانة الفاضية = المنتج غير محدود (مش متتبع). الصفر = نفدت الكمية.</p>
    <p id="stock-msg" class="msg" role="status"></p>
    <div id="stock-list"></div>
  </section>
  <section id="promos-view" hidden>
    <form id="promo-form" class="card promo-form" novalidate>
      <h2>كود جديد</h2>
      <label>الكود (حروف إنجليزي وأرقام)<input name="code" maxlength="20" autocomplete="off" autocapitalize="characters" dir="ltr" required></label>
      <label>الخصم بالجنيه<input name="amount" type="number" inputmode="numeric" min="1" step="1" dir="ltr" required></label>
      <label>أقل قيمة للأحزمة بالجنيه (اختياري)<input name="minSubtotal" type="number" inputmode="numeric" min="0" step="1" dir="ltr"></label>
      <label>عدد مرات الاستخدام (اختياري)<input name="maxUses" type="number" inputmode="numeric" min="1" step="1" dir="ltr"></label>
      <label>آخر يوم للكود (اختياري)<input name="expiresAt" id="promo-expires" type="date" dir="ltr"></label>
      <button type="submit" class="btn">إضافة الكود</button>
      <p id="promo-form-msg" class="msg" role="status"></p>
    </form>
    <p id="promos-msg" class="msg" role="status"></p>
    <div id="promos-list"></div>
  </section>
</main>
<script src="/app.js"></script>
</body>
</html>
`;

export const ADMIN_CSS = `
:root { --berry: #c8102e; --ink: #161616; --muted: #5c5c5c; --line: #ece4e6; --soft: #f7f3f1; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif; color: var(--ink); background: #fff; }
.top { position: sticky; top: 0; background: #fff; border-bottom: 1px solid var(--line); padding: 12px 16px; z-index: 2; }
h1 { font-size: 1.2rem; margin: 0 0 10px; }
.tabs { display: flex; gap: 8px; }
.tabs button { flex: 1; padding: 10px; border: 1px solid var(--line); background: #fff; color: var(--ink); border-radius: 8px; font: inherit; font-weight: 700; }
.tabs button[aria-selected="true"] { background: var(--ink); color: #fff; border-color: var(--ink); }
main { padding: 12px 16px 48px; max-width: 760px; margin: 0 auto; }
.bar { display: flex; gap: 10px; align-items: end; margin-bottom: 10px; }
.bar label { flex: 1; display: grid; gap: 4px; font-size: .9rem; color: var(--muted); }
select, input { font: inherit; padding: 10px; border: 1px solid #d9cfd2; border-radius: 8px; background: #fff; width: 100%; }
button { font: inherit; cursor: pointer; color: var(--ink); }
.btn, .ghost { padding: 10px 14px; border-radius: 8px; border: 1px solid var(--ink); font-weight: 700; }
.btn { background: var(--ink); color: #fff; }
.ghost { background: #fff; color: var(--ink); }
.danger { background: #fff; color: var(--berry); border: 1px solid var(--berry); padding: 10px 14px; border-radius: 8px; font-weight: 700; }
.msg { min-height: 1.2em; color: var(--berry); margin: 6px 0; }
.hint { color: var(--muted); font-size: .9rem; }
.card { border: 1px solid var(--line); border-radius: 10px; padding: 12px; margin-bottom: 10px; }
.row { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.id { font-weight: 800; direction: ltr; }
.muted { color: var(--muted); font-size: .9rem; }
.badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: .85rem; font-weight: 700; background: var(--soft); }
.badge.new { background: #fff2cc; } .badge.confirmed { background: #dbeafe; } .badge.shipped { background: #e0e7ff; }
.badge.delivered { background: #dcfce7; } .badge.cancelled { background: #fee2e2; }
.details { margin-top: 10px; border-top: 1px dashed var(--line); padding-top: 10px; display: grid; gap: 6px; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.links a { margin-inline-end: 12px; color: var(--berry); font-weight: 700; }
.group { margin: 18px 0 6px; font-size: 1rem; }
.stock-row { display: grid; grid-template-columns: 1fr 96px auto; gap: 8px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--line); }
.stock-row input { text-align: center; direction: ltr; }
.out { color: var(--berry); font-weight: 700; font-size: .85rem; }
.promo-form { display: grid; gap: 10px; }
.promo-form h2 { font-size: 1rem; margin: 0; }
.promo-form label { display: grid; gap: 4px; font-size: .9rem; color: var(--muted); }
.code { font-weight: 800; direction: ltr; letter-spacing: .04em; }
.off { opacity: .55; }
[hidden] { display: none !important; }
`;

export const ADMIN_JS = `
(function () {
  "use strict";
  var API = "/api";
  var STATUS = { "new": "جديد", confirmed: "اتأكد", shipped: "اتشحن", delivered: "اتسلم", cancelled: "ملغي" };
  var ACTION = { confirmed: "تأكيد الطلب", shipped: "اتشحن", delivered: "اتسلم", cancelled: "إلغاء الطلب" };
  var PAY = { cod: "الدفع عند الاستلام", instapay: "InstaPay" };
  var SHIP = { standard: "عادي", express: "سريع" };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = String(text);
    return e;
  }
  function money(p) {
    var v = Number(p) / 100;
    return (Number.isInteger(v) ? String(v) : v.toFixed(2)) + " ج";
  }
  function when(iso) {
    try {
      return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }).format(new Date(iso));
    } catch (e) { return iso; }
  }
  function call(method, path, body) {
    var init = { method: method, credentials: "same-origin", headers: { "X-Vicuna-Admin": "1" } };
    if (body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    return fetch(API + path, init).catch(function (e) {
      // A network-level failure here usually means the Access session expired (its login redirect is blocked
      // by the page's CSP). Reload once so Access can show the sign-in page.
      try {
        if (!sessionStorage.getItem("vicuna-admin-reloaded")) {
          sessionStorage.setItem("vicuna-admin-reloaded", "1");
          window.location.reload();
        }
      } catch (ignored) { /* storage unavailable */ }
      throw e;
    }).then(function (res) {
      try { sessionStorage.removeItem("vicuna-admin-reloaded"); } catch (ignored) { /* storage unavailable */ }
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data && data.error ? data.error : "http_" + res.status);
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }
  function explain(err) {
    var code = err && err.message;
    if (code === "stale") return "البيانات اتغيّرت من مكان تاني. حدّث وجرب تاني.";
    if (code === "Failed to fetch" || code === "Load failed") return "انقطع الاتصال أو انتهت الجلسة. جاري إعادة التحميل...";
    if (code === "invalid_transition") return "الخطوة دي مش مسموحة للطلب في حالته الحالية.";
    if (code === "forbidden") return "مش مسموح. سجّل الدخول من تاني.";
    if (code === "admin_not_configured") return "صفحة الإدارة لسه مش مفعلة.";
    if (code === "invalid_quantity") return "الكمية لازم تكون رقم صحيح من 0 أو أكثر، أو فاضية.";
    if (code === "promo_exists") return "الكود ده اتعمل قبل كده. اختار اسم تاني (الأكواد القديمة مش بتتمسح).";
    if (code === "validation_failed") return "راجع الخانات المعلّمة.";
    return "حصل خطأ، جرب تاني. (" + code + ")";
  }

  // ---------------- orders
  var list = document.getElementById("orders-list");
  var ordersMsg = document.getElementById("orders-msg");
  var filter = document.getElementById("status-filter");

  function loadOrders() {
    ordersMsg.textContent = "جاري التحميل...";
    var q = filter.value ? "?status=" + encodeURIComponent(filter.value) : "";
    call("GET", "/orders" + q).then(function (data) {
      list.replaceChildren();
      ordersMsg.textContent = data.orders.length ? "" : "مفيش طلبات.";
      data.orders.forEach(function (o) { list.append(orderCard(o)); });
    }).catch(function (err) { ordersMsg.textContent = explain(err); });
  }

  function orderCard(o) {
    var card = el("article", "card");
    card.dataset.id = o.id;
    var head = el("div", "row");
    head.append(el("span", "id", o.id), el("span", "badge " + o.status, STATUS[o.status] || o.status));
    var who = el("div", "row");
    who.append(el("b", null, o.customerName), el("span", "muted", o.governorate));
    var meta = el("div", "row");
    meta.append(el("span", "muted", when(o.createdAt)), el("b", null, money(o.total) + " · " + o.itemCount + " حزام"));
    var more = el("button", "ghost", "التفاصيل");
    more.type = "button";
    var box = el("div", "details");
    box.hidden = true;
    more.addEventListener("click", function () {
      if (!box.hidden) { box.hidden = true; return; }
      box.hidden = false;
      box.replaceChildren(el("span", "muted", "جاري التحميل..."));
      call("GET", "/orders/" + encodeURIComponent(o.id)).then(function (data) {
        fillDetails(box, data.order, data.next);
      }).catch(function (err) { box.replaceChildren(el("span", "msg", explain(err))); });
    });
    card.append(head, who, meta, more, box);
    return card;
  }

  function fillDetails(box, order, next) {
    box.replaceChildren();
    var c = order.customer;
    var links = el("div", "links");
    var tel = el("a", null, c.phone);
    tel.href = "tel:" + c.phone;
    var wa = el("a", null, "واتساب");
    wa.href = "https://wa.me/2" + c.phone;
    wa.rel = "noopener noreferrer";
    wa.target = "_blank";
    links.append(tel, wa);
    box.append(links, el("div", null, "العنوان: " + c.governorate + "، " + c.address));
    if (c.notes) box.append(el("div", null, "ملاحظات: " + c.notes));
    order.items.forEach(function (i) {
      box.append(el("div", null, "- " + i.name + " (" + i.productId + ") × " + i.quantity + " = " + money(i.lineTotal)));
    });
    var t = order.totals;
    box.append(el("div", "muted", "الأحزمة " + money(t.subtotal) + (t.discount ? " · خصم " + money(t.discount) + (order.promoCode ? " (كود " + order.promoCode + ")" : "") : "") +
      " · شحن " + (SHIP[order.shippingMethod] || order.shippingMethod) + " " + (t.shipping ? money(t.shipping) : "مجاني")));
    box.append(el("b", null, "الإجمالي " + money(t.total) + " · " + (PAY[order.paymentMethod] || order.paymentMethod)));
    var actions = el("div", "actions");
    var msg = el("p", "msg");
    msg.setAttribute("role", "status");
    next.forEach(function (to) {
      var b = el("button", to === "cancelled" ? "danger" : "btn", ACTION[to] || to);
      b.type = "button";
      b.addEventListener("click", function () {
        if (to === "cancelled" && !window.confirm("إلغاء الطلب " + order.id + "؟ الكميات هترجع للمخزون.")) return;
        actions.querySelectorAll("button").forEach(function (x) { x.disabled = true; });
        call("POST", "/orders/" + encodeURIComponent(order.id) + "/status", { to: to, version: order.version })
          .then(function () { loadOrders(); })
          .catch(function (err) {
            msg.textContent = explain(err);
            actions.querySelectorAll("button").forEach(function (x) { x.disabled = false; });
          });
      });
      actions.append(b);
    });
    box.append(actions, msg);
  }

  filter.addEventListener("change", loadOrders);
  document.getElementById("refresh-orders").addEventListener("click", loadOrders);

  // ---------------- stock
  var stockList = document.getElementById("stock-list");
  var stockMsg = document.getElementById("stock-msg");
  var stockLoaded = false;

  function loadStock() {
    stockMsg.textContent = "جاري التحميل...";
    call("GET", "/stock").then(function (data) {
      stockLoaded = true;
      stockMsg.textContent = "";
      stockList.replaceChildren();
      var group = "";
      data.products.forEach(function (p) {
        if (p.styleName !== group) {
          group = p.styleName;
          stockList.append(el("h2", "group", group));
        }
        stockList.append(stockRow(p));
      });
    }).catch(function (err) { stockMsg.textContent = explain(err); });
  }

  function stockRow(p) {
    var row = el("div", "stock-row");
    var expected = p.quantity;
    var info = el("div");
    info.append(el("div", null, p.name), el("div", "muted", p.id));
    if (p.reserved > 0) info.append(el("div", "muted", "محجوز لطلبات مفتوحة: " + p.reserved));
    var state = el("div", "out", p.quantity === 0 ? "نفدت" : "");
    info.append(state);
    var input = el("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.inputMode = "numeric";
    input.placeholder = "غير محدد";
    input.setAttribute("aria-label", "كمية " + p.name);
    input.value = p.quantity === null ? "" : String(p.quantity);
    var save = el("button", "ghost", "حفظ");
    save.type = "button";
    save.addEventListener("click", function () {
      var raw = input.value.trim();
      var quantity = raw === "" ? null : Number(raw);
      if (quantity !== null && (!Number.isInteger(quantity) || quantity < 0)) {
        stockMsg.textContent = explain({ message: "invalid_quantity" });
        return;
      }
      save.disabled = true;
      call("PUT", "/stock/" + encodeURIComponent(p.id), { quantity: quantity, expected: expected }).then(function () {
        expected = quantity;
        save.textContent = "تم ✓";
        state.textContent = quantity === 0 ? "نفدت" : "";
        setTimeout(function () { save.textContent = "حفظ"; save.disabled = false; }, 1200);
      }).catch(function (err) {
        save.disabled = false;
        if (err && err.message === "stale") {
          // An order changed this product meanwhile: show the real value and let the owner decide again.
          loadCurrent(p.id).then(function (current) {
            expected = current;
            input.value = current === null ? "" : String(current);
            stockMsg.textContent = p.name + ": الكمية اتغيّرت لأن في طلب جديد. المتاح دلوقتي " +
              (current === null ? "غير محدد" : current) + ". راجعها واضغط حفظ تاني.";
          });
          return;
        }
        stockMsg.textContent = explain(err);
      });
    });
    row.append(info, input, save);
    return row;
  }

  function loadCurrent(id) {
    return call("GET", "/stock").then(function (data) {
      var found = data.products.filter(function (x) { return x.id === id; })[0];
      return found ? found.quantity : null;
    });
  }

  // ---------------- promo codes
  var promosList = document.getElementById("promos-list");
  var promosMsg = document.getElementById("promos-msg");
  var promoForm = document.getElementById("promo-form");
  var promoFormMsg = document.getElementById("promo-form-msg");
  var promosLoaded = false;
  var FIELD = { code: "الكود", amount: "الخصم", minSubtotal: "أقل قيمة", maxUses: "عدد المرات", expiresAt: "آخر يوم" };

  try { document.getElementById("promo-expires").min = new Date().toISOString().slice(0, 10); } catch (e) { /* older browsers */ }

  function loadPromos() {
    promosLoaded = true;
    promosMsg.textContent = "";
    call("GET", "/promos").then(function (data) {
      promosList.replaceChildren();
      if (!data.promos.length) promosList.append(el("p", "muted", "مفيش أكواد لسه."));
      data.promos.forEach(function (p) { promosList.append(promoCard(p)); });
    }).catch(function (err) { promosMsg.textContent = explain(err); });
  }

  function cairoOffsetHours(date) {
    try {
      var part = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", timeZoneName: "shortOffset" })
        .formatToParts(date).filter(function (x) { return x.type === "timeZoneName"; })[0];
      var m = /GMT([+-]\\d+)/.exec(part ? part.value : "");
      return m ? Number(m[1]) : 2;
    } catch (e) { return 2; }
  }
  function cairoMidnightAfter(day) {
    var next = new Date(day + "T00:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    // Midnight in Cairo = UTC midnight minus Cairo's offset at that instant (checked twice around a DST change).
    var guess = new Date(next.getTime() - cairoOffsetHours(next) * 3600000);
    return new Date(next.getTime() - cairoOffsetHours(guess) * 3600000).toISOString();
  }
  function lastDay(iso) {
    try {
      return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "medium", timeZone: "Africa/Cairo" }).format(new Date(Date.parse(iso) - 1));
    } catch (e) { return iso; }
  }

  function promoCard(p) {
    var card = el("article", "card" + (p.active ? "" : " off"));
    var head = el("div", "row");
    head.append(el("span", "code", p.code), el("b", null, "خصم " + money(p.amount)));
    var rules = [];
    if (p.minSubtotal) rules.push("لطلبات من " + money(p.minSubtotal));
    rules.push("استُخدم " + p.used + (p.maxUses ? " من " + p.maxUses : "") + " مرة");
    if (p.expiresAt) rules.push("آخر يوم " + lastDay(p.expiresAt));
    var info = el("div", "muted", rules.join(" · "));
    var toggle = el("button", p.active ? "danger" : "ghost", p.active ? "إيقاف الكود" : "تشغيل الكود");
    toggle.type = "button";
    toggle.addEventListener("click", function () {
      toggle.disabled = true;
      call("PUT", "/promos/" + encodeURIComponent(p.code), { active: !p.active })
        .then(function () { loadPromos(); })
        .catch(function (err) { toggle.disabled = false; promosMsg.textContent = explain(err); });
    });
    var actions = el("div", "actions");
    actions.append(toggle);
    var expired = p.expiresAt && Date.parse(p.expiresAt) <= Date.now();
    var usedUp = p.maxUses && p.used >= p.maxUses;
    var state = !p.active ? "متوقف" : expired ? "انتهت مدته" : usedUp ? "خلص عدد مرات استخدامه" : "شغال";
    card.append(head, info, el("div", "muted", state), actions);
    return card;
  }

  promoForm.addEventListener("submit", function (e) {
    e.preventDefault();
    promoFormMsg.textContent = "";
    var f = promoForm.elements;
    var num = function (v) { return v.trim() === "" ? null : Number(v); };
    var amount = num(f.amount.value);
    var min = num(f.minSubtotal.value);
    var uses = num(f.maxUses.value);
    // The code works until the end of the chosen day in Cairo (the owner's phone may be in another time zone).
    var expires = f.expiresAt.value ? cairoMidnightAfter(f.expiresAt.value) : null;
    var payload = {
      code: f.code.value,
      amount: amount === null ? null : Math.round(amount * 100),
      minSubtotal: min === null ? 0 : Math.round(min * 100),
      maxUses: uses,
      expiresAt: expires
    };
    if (amount !== null && amount >= 150 && !window.confirm("الكود ده هيخصم " + amount + " جنيه من كل طلب. متأكد؟")) return;
    var button = promoForm.querySelector("button[type=submit]");
    button.disabled = true;
    call("POST", "/promos", payload).then(function () {
      promoForm.reset();
      promoFormMsg.textContent = "اتضاف ✓";
      loadPromos();
    }).catch(function (err) {
      var detail = err && err.data && err.data.errors ? Object.keys(err.data.errors).map(function (k) { return FIELD[k] || k; }).join("، ") : "";
      promoFormMsg.textContent = explain(err) + (detail ? " (" + detail + ")" : "");
    }).then(function () { button.disabled = false; });
  });

  // ---------------- tabs
  document.querySelectorAll("[data-tab]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      var name = tab.dataset.tab;
      document.querySelectorAll("[data-tab]").forEach(function (t) { t.setAttribute("aria-selected", String(t === tab)); });
      document.getElementById("orders-view").hidden = name !== "orders";
      document.getElementById("stock-view").hidden = name !== "stock";
      document.getElementById("promos-view").hidden = name !== "promos";
      if (name === "stock" && !stockLoaded) loadStock();
      if (name === "promos" && !promosLoaded) loadPromos();
    });
  });

  loadOrders();
})();
`;

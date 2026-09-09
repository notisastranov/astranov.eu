/* SpaceNet 4233 — shop CALL + dishes (honest empty) */
(function (global) {
  "use strict";
  if (global.__SN_FILL_4233) return;
  global.__SN_FILL_4233 = true;

  var lastKey = "";
  var fetchSeq = 0;

  function isGuest() {
    try {
      var u = JSON.parse(localStorage.getItem("sn:user") || "null");
      if (!u || !u.email) return true;
      var e = String(u.email || "");
      return !(/notisastranov@gmail\.com$/i.test(e) || /@astranov\.eu$/i.test(e));
    } catch (e) {
      return true;
    }
  }

  function unsigned() {
    try {
      var u = JSON.parse(localStorage.getItem("sn:user") || "null");
      return !(u && u.email);
    } catch (e) {
      return true;
    }
  }

  /* MASTER: AV€ #sn-money after login only; guest sees no balance — hide, do not force 0.00 */
  function hideGuestMoney() {
    try {
      var btn = document.getElementById("sn-money");
      if (!btn) return;
      if (unsigned()) {
        btn.style.display = "none";
        btn.classList.remove("on");
        btn.setAttribute("hidden", "");
        btn.setAttribute("aria-hidden", "true");
      } else {
        btn.removeAttribute("hidden");
        btn.removeAttribute("aria-hidden");
      }
    } catch (e) {}
  }

  function isNairobi(place) {
    if (!place || !isFinite(+place.lat) || !isFinite(+place.lng)) return false;
    var lat = +place.lat, lng = +place.lng;
    if (lat > -1.45 && lat < -1.15 && lng > 36.65 && lng < 37.05) return true;
    var a = String(place.name || place.raw || "").toLowerCase();
    return /nairobi|westlands|kilimani|karen|langata|lavington/i.test(a);
  }

  function spaceName(name) {
    return String(name || "Shop")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Shop";
  }

  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function extractPhone(place) {
    var raw = String(
      (place && (place.phone || (place.tags && (place.tags.phone || place.tags["contact:phone"])))) || ""
    ).trim();
    if (!raw || !/\d/.test(raw) || /^CALL/i.test(raw)) return "";
    var dig = raw.replace(/\s/g, "");
    if (/^\+?254/.test(dig)) return dig.indexOf("+") === 0 ? dig : "+" + dig;
    if (/^0\d{8,}/.test(dig)) return "+254" + dig.replace(/^0/, "");
    if (/^\+?\d{8,}$/.test(dig)) return dig.indexOf("+") === 0 ? dig : dig;
    return raw;
  }

  function telHref(phone) {
    return "tel:" + String(phone).replace(/[^\d+]/g, "");
  }

  function dishList(items) {
    var s = Array.isArray(items) ? items : [];
    var html = s
      .slice(0, 8)
      .map(function (it) {
        var n = String((it && it.name) || "").trim();
        if (!n || /sample/i.test(n)) return "";
        var price = isFinite(+it.price) ? " · AV€ " + Number(it.price) : "";
        return (
          '<div class="dish sheet order" style="padding:8px 10px;border-bottom:1px solid rgba(77,240,255,.15);font:600 12px/1.3 system-ui;color:#dff7ff">' +
          esc(n) +
          price +
          "</div>"
        );
      })
      .join("");
    return html;
  }

  function ensureHonestEmpty() {
    return (
      '<p class="note sn-honest-empty" style="margin:10px 4px;font:600 12px/1.4 system-ui;color:#7ee9ff">' +
      "No public menu listed yet for this shop." +
      "</p>"
    );
  }

  function callBlock(phone) {
    if (phone) {
      return (
        '<a id="sn-call-4233" href="' +
        esc(telHref(phone)) +
        '" style="display:flex;align-items:center;justify-content:center;margin:8px 0 4px;height:40px;border-radius:12px;border:1px solid rgba(77,240,255,.7);background:rgba(4,16,28,.95);color:#4df0ff;font:800 12px system-ui;text-decoration:none">CALL ' +
        esc(phone) +
        "</a>"
      );
    }
    return (
      '<button type="button" id="sn-call-4233" disabled title="No public phone" aria-disabled="true" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;margin:8px 0 4px;min-height:40px;padding:6px 8px;border-radius:12px;border:1px solid rgba(77,240,255,.35);background:rgba(4,16,28,.6);color:#5a8a99;font:800 11px system-ui;line-height:1.2">' +
      "<span>CALL</span>" +
      '<span style="font:600 10px system-ui;color:#7a9aa8">No public phone</span>' +
      "</button>"
    );
  }

  function paypath() {
    return (
      '<div id="sn-paypath-4233" style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 4px;padding:0 2px">' +
      '<button type="button" data-act="now" style="flex:1;min-width:88px;height:40px;border-radius:12px;border:1px solid rgba(77,240,255,.7);background:rgba(4,16,28,.95);color:#4df0ff;font:800 12px system-ui">NOW</button>' +
      '<button type="button" data-act="pay" style="flex:1;min-width:88px;height:40px;border-radius:12px;border:1px solid rgba(77,240,255,.7);background:rgba(4,16,28,.95);color:#4df0ff;font:800 12px system-ui">PAY</button>' +
      '<button type="button" data-act="reload" style="flex:1;min-width:88px;height:40px;border-radius:12px;border:1px solid rgba(77,240,255,.7);background:rgba(4,16,28,.95);color:#7ee9ff;font:800 12px system-ui">RELOAD</button>' +
      "</div>"
    );
  }

  function say(msg) {
    try {
      var line = document.getElementById("line");
      if (line) line.textContent = msg;
    } catch (e) {}
    try {
      if (global.SN && SN.talk) SN.talk(msg);
      else if (global.SN && SN.say) SN.say(msg);
    } catch (e) {}
  }

  function renderSheet(place, phone, dishesHtml) {
    var sheet = document.getElementById("sn-sheet");
    var card = document.getElementById("sn-sheet-card");
    if (!sheet || !card || !place) return;
    var name = spaceName(place.name);
    var menu = dishesHtml || ensureHonestEmpty();
    card.innerHTML =
      '<div class="bar"><div style="display:flex;flex-direction:column;gap:2px;min-width:0">' +
      '<b class="ttl">' +
      esc(name) +
      "</b>" +
      '<span style="font:700 10px system-ui;color:#7ee9ff;letter-spacing:.04em">Nairobi</span>' +
      '</div><button type="button" class="x" data-act="close">✕</button></div>' +
      '<div class="dish sheet head" style="display:grid;grid-template-columns:1fr;padding:6px 10px;font:800 10px system-ui;color:#7ee9ff">Menu</div>' +
      menu +
      callBlock(phone) +
      paypath();
    sheet.classList.add("on");
    lastKey = String(place.lat) + "," + String(place.lng) + "|" + name;
    hideGuestMoney();
  }

  function openShop(place) {
    if (!place) return;
    var phone = extractPhone(place);
    var dishes = [];
    if (Array.isArray(place.dishes)) dishes = place.dishes;
    else if (Array.isArray(place.items)) dishes = place.items;
    var html = dishList(dishes);
    renderSheet(place, phone, html || ensureHonestEmpty());

    var seq = ++fetchSeq;
    var q =
      "/api/place?name=" +
      encodeURIComponent(String(place.name || "").slice(0, 80)) +
      "&place=" +
      encodeURIComponent("Nairobi") +
      "&city=" +
      encodeURIComponent("Nairobi") +
      "&lat=" +
      encodeURIComponent(String(place.lat || "")) +
      "&lng=" +
      encodeURIComponent(String(place.lng || ""));
    if (place.web || place.website) q += "&website=" + encodeURIComponent(String(place.web || place.website));

    fetch(q, { cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (j) {
        if (!j || seq !== fetchSeq) return;
        var p2 = phone || String(j.phone || "").trim();
        var items = Array.isArray(j.items) ? j.items : [];
        var merged = dishes.length ? dishes : items;
        var h = dishList(merged);
        renderSheet(place, p2, h || ensureHonestEmpty());
      })
      .catch(function () {});
  }

  function huntList() {
    try {
      var h = global.__SN_LAST_HUNT || (global.SN && SN.lastHunt);
      return (h && h.list) || [];
    } catch (e) {
      return [];
    }
  }

  function maybeOpenFromMarkers() {
    var list = huntList().filter(isNairobi);
    if (!list.length) return;
    var p = list[0];
    var key = String(p.lat) + "," + String(p.lng) + "|" + String(p.name || "");
    if (key !== lastKey) openShop(p);
  }

  document.addEventListener(
    "click",
    function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      if (t.closest('#sn-sheet [data-act="close"]')) {
        var sh = document.getElementById("sn-sheet");
        if (sh) sh.classList.remove("on");
        return;
      }
      if (t.closest('#sn-paypath-4233 [data-act="pay"], #sn-sheet [data-act="pay"]') && isGuest()) {
        ev.preventDefault();
        ev.stopPropagation();
        say("Sign-in required — guests cannot pay.");
        return;
      }
      if (t.closest('#sn-paypath-4233 [data-act="now"], #sn-sheet [data-act="now"]') && isGuest()) {
        ev.preventDefault();
        ev.stopPropagation();
        say("Sign-in required — no guest delivery.");
        return;
      }
      if (t.closest('#sn-paypath-4233 [data-act="reload"], #sn-sheet [data-act="reload"]') && isGuest()) {
        ev.preventDefault();
        ev.stopPropagation();
        say("Sign-in required — RELOAD after login.");
        return;
      }
      var pop = t.closest(".leaflet-popup-content");
      if (pop) {
        var txt = String(pop.textContent || "").trim();
        var list = huntList();
        for (var i = 0; i < list.length; i++) {
          if (isNairobi(list[i]) && String(list[i].name || "") === txt) {
            openShop(list[i]);
            return;
          }
        }
      }
    },
    true
  );

  var huntAt = 0;
  setInterval(function () {
    try {
      var h = global.__SN_LAST_HUNT;
      if (!h || !h.at || h.at === huntAt) return;
      huntAt = h.at;
      var a = (h.list || []).filter(isNairobi);
      if (a.length) openShop(a[0]);
    } catch (e) {}
  }, 400);

  document.addEventListener(
    "click",
    function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest(".leaflet-marker-icon")) setTimeout(maybeOpenFromMarkers, 120);
    },
    true
  );

  try {
    if (global.SN && typeof SN.selectVendor === "function" && !SN.selectVendor.__fill4233) {
      var _sv = SN.selectVendor.bind(SN);
      SN.selectVendor = function (p) {
        var r = _sv(p);
        try {
          if (isNairobi(p)) openShop(p);
        } catch (e) {}
        return r;
      };
      SN.selectVendor.__fill4233 = true;
    }
  } catch (e) {}

  hideGuestMoney();
  setInterval(hideGuestMoney, 800);
  document.addEventListener("DOMContentLoaded", hideGuestMoney);
})(typeof window !== "undefined" ? window : this);

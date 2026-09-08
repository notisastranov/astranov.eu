/* SpaceNet 4203 — hide GROK trademark relic, draw power glyph, throw offer without sign-in. */
(function () {
  if (window.__SN_BRAND_THROW_4203) return;
  window.__SN_BRAND_THROW_4203 = true;

  var css = document.createElement("style");
  css.id = "sn-4203-css";
  css.textContent =
    "#island b.k,.k.grok,#island .k{display:none!important}" +
    "#sn-power{position:relative!important;font-size:0!important;line-height:0!important;color:inherit}" +
    "#sn-power:before{content:'';display:block;width:13px;height:13px;border:2.4px solid currentColor;border-radius:50%;box-sizing:border-box}" +
    "#sn-power:after{content:'';position:absolute;top:7px;left:50%;width:2.4px;height:9px;margin-left:-1.2px;background:currentColor;border-radius:1px;z-index:1}";
  (document.head || document.documentElement).appendChild(css);

  function line(s) {
    var el = document.getElementById("line");
    if (el) el.textContent = s || "";
    try { if (window.SN && SN.talk) SN.talk(s); } catch (e) {}
  }
  function read(k, d) {
    try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); } catch (e) {}
  }
  function user() {
    try { return JSON.parse(read("sn:user", "null") || "null"); } catch (e) { return null; }
  }
  function email() {
    var u = user();
    return String((u && (u.email || u.user_email)) || "").toLowerCase();
  }
  function scrubBrand() {
    var inp = document.getElementById("in");
    if (inp && /grok/i.test(inp.placeholder || "")) inp.placeholder = "Talk to Astranov SpaceNet";
    document.querySelectorAll("#island b.k, #island .k").forEach(function (el) {
      el.textContent = "";
      el.style.display = "none";
    });
  }
  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }
  function throwOffer(e) {
    var host = document.getElementById("sn-jobq");
    if (!host || !host.classList.contains("on")) return;
    var payEl = host.querySelector(".pay");
    var pay = Number(String((payEl && payEl.textContent) || "").replace(/[^\d.]/g, "")) || 0;
    var ps = host.querySelectorAll("p");
    var route = (ps[0] && ps[0].textContent) || "";
    var bits = route.split("\u2192");
    var fromName = (bits[0] || "Pin").trim();
    var toName = (bits[1] || "").trim();
    var phone = val("sn-job-phone");
    var addr = val("sn-job-addr") || toName;
    if (phone && phone.replace(/\D/g, "").length < 8) {
      if (e && e.preventDefault) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
      line("Customer telephone is required.");
      return true;
    }
    if (e && e.preventDefault) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
    var id = "j" + Date.now().toString(36);
    var row = {
      id: id,
      kind: "job",
      what: "Delivery",
      status: "offered",
      from: { name: fromName },
      to: { name: addr || toName, address: addr },
      phone: phone,
      address: addr,
      pay: pay,
      ride: pay,
      fee: Math.round(pay * 0.03 * 100) / 100,
      driver: { name: "Notis", email: "notisastranov@gmail.com" },
      payer: email(),
      email: email(),
      toOwner: "notisastranov@gmail.com",
      t: Date.now(),
    };
    try {
      var tasks = JSON.parse(read("sn:tasks", "[]") || "[]");
      tasks.unshift(row);
      write("sn:tasks", JSON.stringify(tasks.slice(0, 80)));
    } catch (err) {}
    try {
      fetch("/api/space", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ row: row }) }).catch(function () {});
    } catch (err2) {}
    try { if (window.SN && SN.ingestJobs) SN.ingestJobs([row]); } catch (err3) {}
    host.classList.remove("on");
    var pick = document.getElementById("sn-pick");
    if (pick) pick.classList.remove("on");
    document.body.classList.remove("sn-placing");
    line("Offer thrown to Notis. AV\u20ac " + pay.toFixed(2) + ".");
    return true;
  }
  function hookQuote() {
    var el = document.getElementById("sn-jobq");
    if (!el || el.__sn4203) return;
    el.__sn4203 = true;
    el.addEventListener("click", function (e) {
      var b = e.target && e.target.closest && e.target.closest("[data-act='pay'], button.go");
      if (!b) return;
      throwOffer(e);
    }, true);
  }
  function tick() {
    scrubBrand();
    hookQuote();
  }
  tick();
  setInterval(tick, 600);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tick);
})();

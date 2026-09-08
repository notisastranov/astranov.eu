/* SpaceNet 4207 — laws that were asked and then dropped. */
(function () {
  if (window.__SN_LAW_4207) return;
  window.__SN_LAW_4207 = true;
  var OWNER = "notisastranov@gmail.com";
  var job = { from: null, to: null };
  function line(t) { var el = document.getElementById("line"); if (el) el.textContent = t || ""; }
  function read(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function write(k, v) { try { localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); } catch (e) {} }
  function email() {
    try {
      var u = window.SNAuth && SNAuth.user && SNAuth.user();
      if (u && u.email) return String(u.email).toLowerCase();
    } catch (e) {}
    try { var j = JSON.parse(read("sn:user", "null") || "null"); return String((j && (j.email || j.mail)) || "").toLowerCase(); } catch (e2) { return ""; }
  }
  function quiet() {
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) {}
    try { if (window.SN) SN.autoTalk = false; } catch (e) {}
  }
  function css() {
    if (document.getElementById("sn-law-4207-css")) return;
    var s = document.createElement("style");
    s.id = "sn-law-4207-css";
    s.textContent =
      "#plus,#go{width:44px!important;height:44px!important;font-size:22px!important}" +
      "#sn-money.sn-guest{display:none!important}" +
      "#sn-jobq{display:none;position:fixed;left:8px;right:8px;bottom:calc(env(safe-area-inset-bottom) + 78px);z-index:180;max-width:min(420px,94vw);margin:0 auto;padding:12px;background:rgba(4,14,28,.96);border:1px solid rgba(126,233,255,.5);border-radius:16px}" +
      "#sn-jobq.on{display:block}" +
      "#sn-jobq label{display:flex;align-items:center;gap:8px;margin:6px 0;font:600 13px/1.3 system-ui;color:#c7eef7}" +
      "#sn-jobq input[type=text],#sn-jobq input[type=tel]{width:100%;height:40px;border-radius:10px;border:1px solid rgba(126,233,255,.35);background:rgba(4,16,28,.9);color:#e8fbff;padding:0 10px}" +
      "#sn-jobq .pay{font:800 16px/1.3 system-ui;color:#4df0ff;margin:8px 0}" +
      "#sn-jobq .go{width:100%;height:44px;margin-top:8px;border-radius:12px;border:1px solid #4df0ff;background:#4df0ff;color:#02040a;font:800 13px system-ui}";
    (document.head || document.documentElement).appendChild(s);
  }
  function money() {
    var el = document.getElementById("sn-money");
    if (!el) return;
    if (!email()) el.classList.add("sn-guest"); else el.classList.remove("sn-guest");
  }
  function km(a, b) {
    if (!a || !b) return 0;
    var R = 6371, p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180;
    var d1 = (b.lat - a.lat) * Math.PI / 180, d2 = (b.lng - a.lng) * Math.PI / 180;
    var x = Math.sin(d1 / 2) * Math.sin(d1 / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(d2 / 2) * Math.sin(d2 / 2);
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function nightNow() { var h = new Date().getHours(); return h >= 21 || h < 9; }
  function quote(opts) {
    opts = opts || {};
    var d = km(job.from, job.to);
    var mass = Number(opts.kg || 0) || 0;
    var trips = 1;
    if (mass > 13.3) trips = Math.ceil(mass / 13.3);
    var road = d * (trips === 1 ? 1 : (2 * trips - 1));
    var fee = 3;
    if (road > 3) fee += Math.ceil(road - 3);
    if (opts.night || nightNow()) fee += 3;
    if (opts.rain) fee += 3;
    if (opts.vip) fee += 3;
    if (opts.floor) fee += 3;
    if (opts.special) fee += 3;
    if (mass > 13 && mass <= 13.3) fee += 3;
    return { km: road, rawKm: d, trips: trips, fee: fee };
  }
  function qel() {
    var box = document.getElementById("sn-jobq");
    if (box) return box;
    box = document.createElement("div");
    box.id = "sn-jobq";
    box.innerHTML =
      "<b>POST JOB → NOTIS</b>" +
      '<p class="pay" id="sn-job-pay">AV€ 3</p>' +
      '<input id="sn-job-phone" type="tel" placeholder="Customer phone +30…">' +
      '<input id="sn-job-addr" type="text" placeholder="Door / floor / bell">' +
      '<label><input id="sn-opt-night" type="checkbox"> Night 21:00–09:00 +€3</label>' +
      '<label><input id="sn-opt-rain" type="checkbox"> Bad weather +€3</label>' +
      '<label><input id="sn-opt-vip" type="checkbox"> VIP straight +€3</label>' +
      '<label><input id="sn-opt-floor" type="checkbox"> Floor / room +€3</label>' +
      '<label><input id="sn-opt-spec" type="checkbox"> Extra request +€3</label>' +
      '<label>Kg / L <input id="sn-opt-kg" type="text" inputmode="decimal" placeholder="0" style="width:72px;height:32px"></label>' +
      '<button type="button" class="go" data-act="throw-4207">THROW TO NOTIS</button>' +
      '<button type="button" class="go" data-act="cancel-4207" style="background:transparent;color:#7ee9ff;margin-top:6px">CANCEL</button>';
    document.body.appendChild(box);
    box.addEventListener("change", paintPay);
    box.addEventListener("input", paintPay);
    return box;
  }
  function opts() {
    return {
      night: !!(document.getElementById("sn-opt-night") || {}).checked,
      rain: !!(document.getElementById("sn-opt-rain") || {}).checked,
      vip: !!(document.getElementById("sn-opt-vip") || {}).checked,
      floor: !!(document.getElementById("sn-opt-floor") || {}).checked,
      special: !!(document.getElementById("sn-opt-spec") || {}).checked,
      kg: Number((document.getElementById("sn-opt-kg") || {}).value || 0)
    };
  }
  function paintPay() {
    var q = quote(opts());
    var el = document.getElementById("sn-job-pay");
    if (el) el.textContent = "AV€ " + q.fee.toFixed(2) + " · " + q.km.toFixed(2) + " km" + (q.trips > 1 ? (" · " + q.trips + " runs") : "");
  }
  function showQuote() {
    var box = qel();
    var n = document.getElementById("sn-opt-night");
    if (n) n.checked = nightNow();
    paintPay();
    box.classList.add("on");
    line("From → to locked. Set extras and THROW.");
  }
  function latlngFromEvent(e) {
    var cv = document.getElementById("g");
    if (!cv) return null;
    var r = cv.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    var cam = window.__SN_CAM;
    if (cam && cam.screenToLatLng) {
      try { var s = cam.screenToLatLng(x, y); if (s && isFinite(+s.lat)) return { lat: +s.lat, lng: +s.lng }; } catch (err2) {}
    }
    return { lat: 36.4348 + (0.5 - y) * 8, lng: 28.2176 + (x - 0.5) * 12 };
  }
  function onGlobe(e) {
    if (!e || e.button) return;
    var t = e.target;
    if (!t) return;
    if (t.closest && t.closest("#top,#dock,#island,#sn-me,#gps,#sn-money,#sn-power,#sn-tasks-btn,#sn-jobq,#sn-me-sheet,#sn-tasks,#plus,#go,#in")) return;
    if (t.id !== "g" && !(t.closest && t.closest("#g,#city"))) return;
    var p = latlngFromEvent(e);
    if (!p) return;
    if (!job.from) { job.from = p; job.to = null; line("FROM set. Tap the drop."); return; }
    job.to = p;
    showQuote();
  }
  function throwJob() {
    if (!job.from || !job.to) { line("Tap from, then tap to."); return; }
    var o = opts();
    var q = quote(o);
    var phone = String((document.getElementById("sn-job-phone") || {}).value || "").trim();
    var addr = String((document.getElementById("sn-job-addr") || {}).value || "").trim();
    var row = {
      id: "j" + Date.now().toString(36), kind: "job", what: "Delivery", status: "offered",
      from: job.from, to: job.to, address: addr, phone: phone,
      pay: q.fee, km: q.km, trips: q.trips, extras: o,
      driverEmail: OWNER, driver: { name: "Notis", email: OWNER },
      payer: email() || OWNER, toOwner: OWNER, t: Date.now()
    };
    var tasks = [];
    try { tasks = JSON.parse(read("sn:tasks", "[]") || "[]"); } catch (e) { tasks = []; }
    if (!Array.isArray(tasks)) tasks = [];
    tasks.unshift(row);
    write("sn:tasks", JSON.stringify(tasks.slice(0, 80)));
    try { fetch("/api/space", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ row: row }) }).catch(function () {}); } catch (e2) {}
    document.getElementById("sn-jobq").classList.remove("on");
    job = { from: null, to: null };
    line("Job thrown to Notis · AV€ " + q.fee.toFixed(2) + (phone ? "" : " · add phone when you have it") + ".");
  }
  function scrubJobs() {
    var raw;
    try { raw = JSON.parse(read("sn:tasks", "[]") || "[]"); } catch (e) { raw = []; }
    if (!Array.isArray(raw)) return;
    var keep = raw.filter(function (t) {
      if (!t || typeof t !== "object") return false;
      var k = String(t.kind || "").toLowerCase();
      if (/find|hunt|shop|pin|place|vendor/.test(k)) return false;
      return k === "job" || t.driverEmail || t.toOwner || t.thrown;
    });
    if (keep.length !== raw.length) write("sn:tasks", JSON.stringify(keep.slice(0, 80)));
  }
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest && e.target.closest("[data-act]");
    if (b && b.getAttribute("data-act") === "throw-4207") { e.preventDefault(); e.stopPropagation(); throwJob(); }
    if (b && b.getAttribute("data-act") === "cancel-4207") { e.preventDefault(); job = { from: null, to: null }; var q = document.getElementById("sn-jobq"); if (q) q.classList.remove("on"); line("Job cancelled."); }
  }, true);
  document.addEventListener("click", onGlobe, true);
  function boot() { quiet(); css(); money(); scrubJobs(); }
  boot();
  setInterval(boot, 2000);
})();

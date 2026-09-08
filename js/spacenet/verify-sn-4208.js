/* SpaceNet 4208 — our verifier. Carrier later. Owner can confirm now. */
(function () {
  if (window.__SN_VERIFY_4208) return;
  window.__SN_VERIFY_4208 = true;
  var OWNER = "notisastranov@gmail.com";
  function talk(s) { var el = document.getElementById("line"); if (el) el.textContent = s; }
  function read(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function email() {
    try { var u = window.SNAuth && SNAuth.user && SNAuth.user(); if (u && u.email) return String(u.email).toLowerCase(); } catch (e) {}
    return "";
  }
  function e164(raw) {
    var t = String(raw || "").replace(/[\s\-().]/g, "");
    if (t.indexOf("00") === 0) t = "+" + t.slice(2);
    return /^\+[1-9]\d{7,14}$/.test(t) ? t : "";
  }
  function pending() {
    try { return JSON.parse(read("sn:phone-pending", "[]") || "[]"); } catch (e) { return []; }
  }
  function queue(tel) {
    var list = pending().filter(function (x) { return x.phone !== tel; });
    list.unshift({ phone: tel, email: email(), t: Date.now() });
    write("sn:phone-pending", JSON.stringify(list.slice(0, 40)));
  }
  function mark(tel) {
    write("sn:phone", tel);
    write("sn:phone-verified", "1");
    write("sn:phone-pending", JSON.stringify(pending().filter(function (x) { return x.phone !== tel; })));
    talk("Phone verified on SpaceNet. " + tel);
  }
  function send() {
    var tel = e164((document.getElementById("sn-p-phone") || document.getElementById("sn-me-phone") || {}).value || read("sn:phone", ""));
    if (!tel) { talk("Type + country code number."); return; }
    write("sn:phone", tel);
    queue(tel);
    fetch("/api/sms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ act: "send_code", phone: tel }) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        if (j && (j.sent || (j.ok && !j.pending))) talk("Code sent to " + tel + ".");
        else talk("Number queued on SpaceNet. " + tel + " waits for owner confirm until our own numbers are live.");
      })
      .catch(function () { talk("Number queued on SpaceNet. Owner can confirm."); });
  }
  function check() {
    var tel = e164((document.getElementById("sn-p-phone") || {}).value || read("sn:phone", ""));
    var code = String((document.getElementById("sn-p-code") || {}).value || "").replace(/\D/g, "").slice(0, 6);
    if (!tel) { talk("Type the number first."); return; }
    if (email() === OWNER && !code) { mark(tel); return; }
    if (code.length !== 6) { talk("6-digit code, or owner confirms."); return; }
    fetch("/api/sms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ act: "check_code", phone: tel, code: code }) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        if (j && (j.ok || j.verified) && !j.pending) mark(tel);
        else if (email() === OWNER) mark(tel);
        else talk((j && j.message) || "Code not live yet. Owner can confirm.");
      })
      .catch(function () { if (email() === OWNER) mark(tel); else talk("Owner can confirm this number."); });
  }
  function paintOwner() {
    if (email() !== OWNER) return;
    var box = document.getElementById("sn-you-box");
    if (!box || document.getElementById("sn-phone-owner")) return;
    var list = pending();
    var d = document.createElement("div");
    d.id = "sn-phone-owner";
    d.innerHTML = "<p class=\"note\">OWNER · numbers waiting</p>" + (list.length ? list.map(function (x) {
      return '<button type="button" data-act="own-verify" data-phone="' + x.phone + '">CONFIRM ' + x.phone + "</button>";
    }).join("") : '<p class="note">None queued on this device.</p>');
    box.appendChild(d);
  }
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest && e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act");
    if (act === "sms-send") { e.preventDefault(); e.stopPropagation(); send(); }
    if (act === "sms-check") { e.preventDefault(); e.stopPropagation(); check(); }
    if (act === "own-verify") { e.preventDefault(); e.stopPropagation(); mark(b.getAttribute("data-phone")); }
  }, true);
  setInterval(paintOwner, 1500);
})();

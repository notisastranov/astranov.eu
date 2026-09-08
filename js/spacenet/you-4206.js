/* SpaceNet 4206 — YOU is roles + Twilio, not a toy icon grid. */
(function () {
  if (window.__SN_YOU_4206) return;
  window.__SN_YOU_4206 = true;
  var OWNER = "notisastranov@gmail.com";
  var ROLES = ["vendor", "driver", "agent", "ambassador"];
  function talk(s) {
    if (window.SN && SN.talk) SN.talk(s);
    else { var el = document.getElementById("line"); if (el) el.textContent = s; }
  }
  function read(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) {}
  }
  function email() {
    try { var u = window.SNAuth && SNAuth.user && SNAuth.user(); return String((u && u.email) || "").toLowerCase(); } catch (e) { return ""; }
  }
  function roles() {
    var r = {};
    try { r = JSON.parse(read("sn:roles", "{}") || "{}"); } catch (e) { r = {}; }
    if (email() === OWNER) { r.owner = true; r.driver = true; }
    return r;
  }
  function pending() {
    try { return JSON.parse(read("sn:apply", "{}") || "{}"); } catch (e) { return {}; }
  }
  function css() {
    if (document.getElementById("sn-you-4206-css")) return;
    var s = document.createElement("style");
    s.id = "sn-you-4206-css";
    s.textContent =
      "#sn-me-sheet{z-index:200!important}" +
      "#sn-me-sheet .icons,#sn-me-sheet .icn-ttl{display:none!important}" +
      "#sn-you-box{margin:10px 0 0;padding:0 0 8px}" +
      "#sn-you-box .st{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}" +
      "#sn-you-box .st b{font:800 10px/1 system-ui;letter-spacing:.12em;padding:7px 9px;border-radius:999px;border:1px solid rgba(126,233,255,.35);color:#7ee9ff}" +
      "#sn-you-box .st b.on{background:#4df0ff;color:#02040a;border-color:#4df0ff}" +
      "#sn-you-box .st b.pend{border-color:#f0c14b;color:#f0c14b}" +
      "#sn-you-box .apps{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}" +
      "#sn-you-box .apps button,#sn-you-box .sms button{height:40px;border-radius:12px;border:1px solid rgba(126,233,255,.45);background:rgba(4,16,28,.9);color:#7ee9ff;font:800 11px/1 system-ui}" +
      "#sn-you-box .note{font:500 12px/1.4 system-ui;color:#9fd3e0;margin:8px 0}" +
      "#sn-you-box input{width:100%;height:40px;margin:6px 0;border-radius:10px;border:1px solid rgba(126,233,255,.35);background:rgba(4,16,28,.9);color:#e8fbff;padding:0 10px}" +
      "#sn-me-sheet .card{max-height:min(62vh,calc(100vh - 140px))!important;overflow:auto}";
    (document.head || document.documentElement).appendChild(s);
  }
  function statusLine() {
    var r = roles(), p = pending();
    var bits = ['<b class="on">USER</b>'];
    ROLES.forEach(function (k) {
      if (r[k]) bits.push('<b class="on">' + k.toUpperCase() + "</b>");
      else if (p[k]) bits.push('<b class="pend">APPLY ' + k.toUpperCase() + "</b>");
    });
    if (r.owner) bits.push('<b class="on">OWNER</b>');
    return bits.join("");
  }
  function boxHtml() {
    var tel = read("sn:phone", "");
    var ok = read("sn:phone-verified") === "1";
    var r = roles();
    var apps = ROLES.map(function (k) {
      if (r[k]) return "";
      return '<button type="button" data-act="apply-4206" data-role="' + k + '">APPLY ' + k.toUpperCase() + "</button>";
    }).join("");
    return (
      '<div id="sn-you-box">' +
        '<div class="st">' + statusLine() + "</div>" +
        '<p class="note">3% service. Agent 1% of that 3% from people they hook. Ambassador 1% of that 3% from their agents. Owner 1% of that 3%. Missing rungs stay in the pool.</p>' +
        '<p class="note">' + (ok ? ("Phone verified · " + tel) : "Phone unverified. Twilio code required.") + "</p>" +
        '<input id="sn-p-phone" inputmode="tel" placeholder="+306971930225" value="' + String(tel).replace(/"/g, "") + '">' +
        '<div class="sms" style="display:flex;gap:8px">' +
          '<button type="button" data-act="sms-send">SEND SMS</button>' +
          '<button type="button" data-act="sms-check">VERIFY</button>' +
        "</div>" +
        '<input id="sn-p-code" inputmode="numeric" maxlength="6" placeholder="6-digit code">' +
        '<p class="note">Vendor, driver, agent, ambassador: apply, accept terms, wait for Notis. No self-activate.</p>' +
        '<label class="note"><input id="sn-tos" type="checkbox"> I accept SpaceNet terms.</label>' +
        '<div class="apps">' + apps + "</div>" +
      "</div>"
    );
  }
  function slim() {
    css();
    var sh = document.getElementById("sn-me-sheet");
    if (!sh) return;
    var icons = sh.querySelector(".icons");
    var ttl = sh.querySelector(".icn-ttl");
    if (icons) icons.remove();
    if (ttl && /MAP ICON/i.test(ttl.textContent || "")) ttl.remove();
    var note = sh.querySelector(".note");
    if (note && /Twilio is live|MAP ICON|stamped on your profile/i.test(note.textContent || "")) note.remove();
    if (!document.getElementById("sn-you-box")) {
      var host = sh.querySelector(".card") || sh;
      host.insertAdjacentHTML("beforeend", boxHtml());
    } else {
      var st = document.querySelector("#sn-you-box .st");
      if (st) st.innerHTML = statusLine();
    }
  }
  function apply(role) {
    var tos = document.getElementById("sn-tos");
    if (!tos || !tos.checked) { talk("Accept the terms first."); return; }
    if (!email()) { talk("Sign in first."); return; }
    var p = pending();
    p[role] = { email: email(), at: Date.now(), tos: true };
    write("sn:apply", JSON.stringify(p));
    talk("Application for " + role + " sent to Notis. Not live until he activates you.");
    slim();
  }
  function e164(raw) {
    var t = String(raw || "").replace(/[\s\-().]/g, "");
    if (t.indexOf("00") === 0) t = "+" + t.slice(2);
    return /^\+[1-9]\d{7,14}$/.test(t) ? t : "";
  }
  function sendSms() {
    var tel = e164((document.getElementById("sn-p-phone") || {}).value || read("sn:phone", ""));
    if (!tel) { talk("Type + country code number. No spaces."); return; }
    write("sn:phone", tel);
    fetch("/api/sms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ act: "send_code", phone: tel }) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        if (j && (j.ok || j.sent)) talk("Code sent to " + tel + ".");
        else talk((j && (j.error || j.message)) || "SMS did not send.");
      })
      .catch(function () { talk("SMS could not be reached."); });
  }
  function checkSms() {
    var tel = e164((document.getElementById("sn-p-phone") || {}).value || read("sn:phone", ""));
    var code = String((document.getElementById("sn-p-code") || {}).value || "").replace(/\D/g, "").slice(0, 6);
    if (!tel || code.length !== 6) { talk("Phone and 6-digit code."); return; }
    fetch("/api/sms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ act: "check_code", phone: tel, code: code }) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        if (j && (j.ok || j.verified)) { write("sn:phone", tel); write("sn:phone-verified", "1"); talk("Phone verified. " + tel); slim(); }
        else talk((j && (j.error || j.message)) || "Code did not match.");
      })
      .catch(function () { talk("Verify could not be reached."); });
  }
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest && e.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act");
    if (act === "apply-4206") { e.preventDefault(); e.stopPropagation(); apply(b.getAttribute("data-role")); }
    if (act === "sms-send") { e.preventDefault(); e.stopPropagation(); sendSms(); }
    if (act === "sms-check") { e.preventDefault(); e.stopPropagation(); checkSms(); }
  }, true);
  function hook() {
    css();
    if (window.SNAuth && SNAuth.open && !SNAuth.open.__y4206) {
      var orig = SNAuth.open;
      SNAuth.open = function () { orig.apply(this, arguments); setTimeout(slim, 0); setTimeout(slim, 80); };
      SNAuth.open.__y4206 = true;
    }
    slim();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hook);
  else hook();
  setInterval(hook, 1200);
})();

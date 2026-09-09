/* SpaceNet auth 4221 — LOGIN is Google. Finish the code. No dummy session. */
(function () {
  if (window.SNAuth) return;
  var SB = "https://lkoatrkhuigdolnjsbie.supabase.co";
  var ANON = "";
  function loadCfg(cb) {
    fetch("/api/public-config").then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.sb) SB = j.sb;
      if (j && j.anon) ANON = j.anon;
      if (cb) cb();
    }).catch(function () { if (cb) cb(); });
  }
  function read(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function talk(s) { if (window.SN && SN.say) SN.say(s); else { var el = document.getElementById("line"); if (el) el.textContent = s; } }
  function headers(extra) {
    var h = Object.assign({ apikey: ANON, "Content-Type": "application/json" }, extra || {});
    var t = token();
    if (t) h.Authorization = "Bearer " + t;
    return h;
  }
  function rnd(n) {
    var a = new Uint8Array(n);
    crypto.getRandomValues(a);
    var s = "";
    for (var i = 0; i < a.length; i++) s += "abcdefghijklmnopqrstuvwxyz0123456789"[a[i] % 36];
    return s;
  }
  function b64url(buf) {
    var b = String.fromCharCode.apply(null, new Uint8Array(buf));
    return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }
  function challenge(ver) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(ver)).then(b64url);
  }
  function saveUser(u) {
    if (!u) return;
    var row = {
      id: u.id || u.sub || "",
      email: u.email || "",
      name: (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || u.name || "",
      photo: (u.user_metadata && (u.user_metadata.avatar_url || u.user_metadata.picture)) || u.picture || "",
      phone: u.phone || (u.user_metadata && u.user_metadata.phone) || read("sn:phone", "") || "",
      verified: false
    };
    write("sn:user", JSON.stringify(row));
    paintMe();
    if (window.SN && SN.paintMoney) SN.paintMoney();
    return row;
  }
  function user() { try { return JSON.parse(read("sn:user", "null") || "null"); } catch (e) { return null; } }
  function token() { return read("sn:access", ""); }
  function google() {
    loadCfg(function () {
      var dest = location.origin + "/?auth=google";
      write("sn:auth-back", location.href.split("#")[0]);
      var ver = rnd(64);
      write("sn:pkce", ver);
      talk("Opening Google…");
      challenge(ver).then(function (ch) {
        location.href = SB + "/auth/v1/authorize?provider=google"
          + "&redirect_to=" + encodeURIComponent(dest)
          + "&code_challenge=" + encodeURIComponent(ch)
          + "&code_challenge_method=S256"
          + (ANON ? "&apikey=" + encodeURIComponent(ANON) : "");
      }).catch(function () {
        location.href = SB + "/auth/v1/authorize?provider=google&redirect_to=" + encodeURIComponent(dest);
      });
    });
  }
  function x() {
    loadCfg(function () {
      var dest = location.origin + "/?auth=x";
      write("sn:auth-back", location.href.split("#")[0]);
      talk("Opening X…");
      location.href = SB + "/auth/v1/authorize?provider=twitter&redirect_to=" + encodeURIComponent(dest)
        + (ANON ? "&apikey=" + encodeURIComponent(ANON) : "");
    });
  }
  function out() {
    var t = token();
    write("sn:user", ""); write("sn:access", ""); write("sn:pkce", "");
    if (t) fetch(SB + "/auth/v1/logout", { method: "POST", headers: headers({ Authorization: "Bearer " + t }) }).catch(function () {});
    paintMe();
    if (window.SN && SN.paintMoney) SN.paintMoney();
    talk("Signed out.");
  }
  function savePhone(raw) {
    var tel = String(raw || "").replace(/[^\d+ ]/g, "").trim();
    write("sn:phone", tel);
    var u = user() || {};
    u.phone = tel; u.verified = false;
    write("sn:user", JSON.stringify(u));
    talk(tel ? "Phone stored. Unverified until Twilio is live." : "Phone cleared.");
    paintMe();
  }
  function takeUser(at) {
    write("sn:access", at);
    return fetch(SB + "/auth/v1/user", { headers: { apikey: ANON, Authorization: "Bearer " + at } })
      .then(function (r) { return r.json(); })
      .then(function (u) {
        if (u && u.email) { saveUser(u); talk("Signed in as " + u.email + "."); return true; }
        talk("Google returned no email.");
        return false;
      });
  }
  function applyReturn() {
    var search = new URLSearchParams(location.search);
    var hash = location.hash || "";
    if (hash.charAt(0) === "#") hash = hash.slice(1);
    var hq = new URLSearchParams(hash);
    var err = search.get("error_description") || search.get("error") || hq.get("error_description") || hq.get("error");
    if (err) {
      talk("Google: " + err);
      history.replaceState({}, "", location.pathname);
      return Promise.resolve(false);
    }
    var at = hq.get("access_token");
    var code = search.get("code");
    function clean() {
      history.replaceState({}, "", location.pathname);
    }
    if (at) {
      return takeUser(at).then(function (ok) { clean(); return ok; }).catch(function () { clean(); talk("Google sign-in did not finish."); return false; });
    }
    if (code) {
      var ver = read("sn:pkce", "");
      var body = ver
        ? { grant_type: "pkce", auth_code: code, code_verifier: ver }
        : { grant_type: "authorization_code", code: code, redirect_uri: location.origin + "/?auth=google" };
      return fetch(SB + "/auth/v1/token?grant_type=" + encodeURIComponent(body.grant_type), {
        method: "POST",
        headers: { apikey: ANON, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          write("sn:pkce", "");
          if (j && j.access_token) return takeUser(j.access_token);
          talk((j && (j.error_description || j.msg || j.error)) || "Google code was not exchanged.");
          return false;
        })
        .then(function (ok) { clean(); return ok; })
        .catch(function () { clean(); talk("Google sign-in did not finish."); return false; });
    }
    return Promise.resolve(!!user());
  }
  function css() {
    if (document.getElementById("sn-me-css")) return;
    var s = document.createElement("style");
    s.id = "sn-me-css";
    s.textContent =
      "#sn-me{position:fixed;left:max(10px,env(safe-area-inset-left));bottom:calc(env(safe-area-inset-bottom) + 78px);z-index:90;width:var(--u,40px);padding:0;border:0;background:transparent;color:#4df0ff}" +
      "#sn-me .lbl{display:block;font:800 8px/1 system-ui;letter-spacing:.16em;text-align:center;margin:0 0 4px}" +
      "#sn-me .tgt{display:flex;align-items:center;justify-content:center;width:var(--u,40px);height:var(--u,40px);margin:0 auto;border-radius:999px;overflow:hidden;border:1.5px solid rgba(77,240,255,.95);background:rgba(4,16,28,.92)}" +
      "#sn-me img,#sn-me .ph{width:100%;height:100%;object-fit:cover;display:flex;align-items:center;justify-content:center;font:800 11px system-ui;color:#4df0ff}" +
      "#sn-me-sheet{position:fixed;inset:0;z-index:80;display:none}" +
      "#sn-me-sheet.on{display:block}" +
      "#sn-me-sheet .bg{position:absolute;inset:0}" +
      "#sn-me-sheet .card{position:absolute;left:50%;top:max(58px,env(safe-area-inset-top));width:min(360px,94vw);transform:translateX(-50%);padding:12px;background:rgba(4,14,28,.96);border:1px solid rgba(126,233,255,.45);border-radius:16px}" +
      "#sn-me-sheet .bar{display:flex;align-items:center;gap:8px;margin:0 0 10px}" +
      "#sn-me-sheet .ttl{flex:1;font:800 11px system-ui;letter-spacing:.16em;color:#7ee9ff}" +
      "#sn-me-sheet .x,#sn-me-sheet button.go{height:40px;padding:0 12px;border:1px solid rgba(126,233,255,.35);background:rgba(4,16,28,.9);color:#e8fbff;border-radius:10px}" +
      "#sn-me-sheet button.go{display:block;width:100%;margin:8px 0 0;font:800 13px system-ui;color:#7ee9ff}" +
      "#sn-me-sheet .who{display:flex;align-items:center;gap:10px;margin:0 0 12px}" +
      "#sn-me-sheet .who img,#sn-me-sheet .who .ph{width:52px;height:52px;border-radius:99px;object-fit:cover;background:rgba(77,240,255,.12);display:flex;align-items:center;justify-content:center;color:#4df0ff;font-size:22px}" +
      "#sn-me-sheet input{display:block;width:100%;height:40px;margin:8px 0 0;padding:0 10px;border:1px solid rgba(126,233,255,.28);background:rgba(4,16,28,.9);color:#e8fbff;border-radius:10px}" +
      "#sn-me-sheet .note{margin:8px 0 0;font:500 12px/1.35 system-ui;color:#8ec8d8}";
    document.head.appendChild(s);
  }
  function face(u) {
    if (u && u.photo) return '<img alt="" src="' + String(u.photo).replace(/"/g, "") + '">';
    var src = (u && (u.name || u.email)) || "Y";
    var m = String(src).match(/[A-Za-zΑ-Ωα-ωΆ-Ώά-ώ]/);
    var ch = (m ? m[0] : "Y").toUpperCase();
    return '<span class="ph">' + ch + "</span>";
  }
  function paintMe() {
    css();
    var u = user();
    var inNow = !!(u && u.email);
    var btn = document.getElementById("sn-me");
    if (!btn) return;
    btn.className = inNow ? "in" : "out";
    btn.innerHTML = '<span class="lbl">' + (inNow ? "YOU" : "LOGIN") + '</span><span class="tgt">' + (inNow ? face(u) : '<span class="ph">IN</span>') + "</span>";
    if (window.SN && SN.paintMoney) SN.paintMoney();
  }
  function fillBody() {
    var body = document.getElementById("sn-me-body");
    if (!body) return;
    var u = user();
    var inNow = !!(u && u.email);
    var name = inNow ? (u.name || u.email) : "Guest";
    var mail = inNow ? u.email : "Not signed in";
    var tel = (u && u.phone) || read("sn:phone", "") || "";
    body.innerHTML =
      '<div class="who">' + face(u) + "<div><b>" + String(name).replace(/[<>]/g, "") + "</b><span>" + (inNow ? "IN · " + String(mail).replace(/[<>]/g, "") : "OUT") + "</span></div></div>" +
      (inNow
        ? '<button type="button" class="go" data-act="out">SIGN OUT</button>'
        : '<button type="button" class="go" data-act="google">GOOGLE</button><button type="button" class="go" data-act="twitter">X</button>') +
      '<input id="sn-me-phone" inputmode="tel" placeholder="Phone (unverified)" value="' + String(tel).replace(/"/g, "") + '">' +
      '<button type="button" class="go" data-act="phone">SAVE PHONE</button>' +
      '<p class="note">' + (inNow ? "Wallet is yours after login. Roles apply after Terms. Notis activates." : "LOGIN is Google. AV€ appears after login.") + "</p>";
  }
  function openMe() {
    css();
    if (!(user() && user().email)) { google(); return; }
    var sh = document.getElementById("sn-me-sheet");
    if (!sh) {
      sh = document.createElement("div");
      sh.id = "sn-me-sheet";
      sh.innerHTML = '<div class="bg" data-act="close"></div><div class="card"><div class="bar"><b class="ttl">YOU</b><button type="button" class="x" data-act="close">✕</button></div><div id="sn-me-body"></div></div>';
      document.body.appendChild(sh);
      sh.addEventListener("click", function (e) {
        var b = e.target.closest("[data-act]");
        var act = b && b.getAttribute("data-act");
        if (act === "close") { sh.classList.remove("on"); return; }
        if (act === "google") { google(); return; }
        if (act === "twitter") { x(); return; }
        if (act === "out") { out(); fillBody(); return; }
        if (act === "phone") { var inp = document.getElementById("sn-me-phone"); savePhone(inp && inp.value); fillBody(); }
      });
    }
    fillBody();
    sh.classList.add("on");
  }
  function boot() {
    css();
    loadCfg(function () {
      paintMe();
      applyReturn().then(function () { paintMe(); });
      var btn = document.getElementById("sn-me");
      if (btn && !btn.__sn4221) {
        btn.__sn4221 = true;
        btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openMe(); });
      }
    });
  }
  window.SNAuth = { google: google, x: x, out: out, savePhone: savePhone, user: user, token: token, boot: boot, paint: paintMe, open: openMe };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

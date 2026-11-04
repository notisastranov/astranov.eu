/* SpaceNet auth — Google, or an Astranov account that is not Google. */
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
  function hostOk(h) { return h === "astranov.eu" || (h && h.slice(-13) === ".astranov.eu"); }
  function setCook(name, value, maxAge) {
    var bits = [name + "=" + encodeURIComponent(value || ""), "path=/", "max-age=" + (maxAge == null ? 2592000 : maxAge), "secure", "samesite=lax"];
    if (hostOk(location.hostname)) bits.push("domain=.astranov.eu");
    document.cookie = bits.join("; ");
  }
  function getCook(name) {
    var all = document.cookie ? document.cookie.split("; ") : [];
    for (var i = 0; i < all.length; i++) {
      var n = all[i].indexOf("=");
      if (n > 0 && all[i].slice(0, n) === name) return decodeURIComponent(all[i].slice(n + 1));
    }
    return "";
  }
  function remember(j) {
    if (!j) return;
    if (j.access_token) { write("sn:access", j.access_token); setCook("sn_at", j.access_token, 2592000); }
    if (j.refresh_token) setCook("sn_rt", j.refresh_token, 2592000);
  }
  function dropQuiet() {
    write("sn:user", ""); write("sn:access", ""); write("sn:pkce", "");
    setCook("sn_at", "", 0); setCook("sn_rt", "", 0); setCook("sn_pkce", "", 0);
  }
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
      verified: !!(u.email_confirmed_at || (u.app_metadata && u.app_metadata.provider === "google") || (u.identities && u.identities.length))
    };
    write("sn:user", JSON.stringify(row));
    paintMe();
    if (window.SN && SN.paintMoney) SN.paintMoney();
    return row;
  }
  function user() { try { return JSON.parse(read("sn:user", "null") || "null"); } catch (e) { return null; } }
  function token() {
    var t = read("sn:access", "");
    if (!t) t = getCook("sn_at");
    if (t && !read("sn:access", "")) write("sn:access", t);
    return t || "";
  }
  function google(extra) {
    loadCfg(function () {
      var dest = "https://astranov.eu/?auth=google";
      write("sn:auth-back", location.href.split("#")[0]);
      if (location.hostname !== "astranov.eu") setCook("sn_back", location.href.split("#")[0], 600);
      var ver = rnd(64);
      write("sn:pkce", ver);
      setCook("sn_pkce", ver, 600);
      talk("Opening Google…");
      var scopes = "email profile";
      if (extra) scopes += " " + extra;
      challenge(ver).then(function (ch) {
        location.href = SB + "/auth/v1/authorize?provider=google"
          + "&redirect_to=" + encodeURIComponent(dest)
          + "&scopes=" + encodeURIComponent(scopes)
          + "&code_challenge=" + encodeURIComponent(ch)
          + "&code_challenge_method=S256"
          + (ANON ? "&apikey=" + encodeURIComponent(ANON) : "");
      }).catch(function () {
        location.href = SB + "/auth/v1/authorize?provider=google&redirect_to=" + encodeURIComponent(dest)
          + "&scopes=" + encodeURIComponent(scopes);
      });
    });
  }
  function youtube() {
    write("sn:yt-want", "1");
    google("https://www.googleapis.com/auth/youtube.readonly");
  }
  function yt() { return read("sn:yt", ""); }
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
    write("sn:user", ""); write("sn:access", ""); write("sn:pkce", ""); write("sn:yt", "");
    setCook("sn_at", "", 0); setCook("sn_rt", "", 0); setCook("sn_pkce", "", 0); setCook("sn_back", "", 0);
    if (t) fetch(SB + "/auth/v1/logout", { method: "POST", headers: headers({ Authorization: "Bearer " + t }) }).catch(function () {});
    paintMe();
    if (window.SN && SN.paintMoney) SN.paintMoney();
    talk("Signed out.");
  }
  function mailFields() {
    var email = (document.getElementById("sn-mail") || {}).value || "";
    var password = (document.getElementById("sn-pass") || {}).value || "";
    return { email: String(email).trim(), password: String(password) };
  }
  function finishSession(j, email) {
    if (j && j.access_token) { remember(j); return takeUser(j.access_token); }
    if (j && (j.id || j.user) && !j.access_token) {
      talk("That path still waits on a mail confirmation. Use Google. It verifies the id with no SMS and no mail from Astranov.");
      return Promise.resolve(false);
    }
    talk((j && (j.error_description || j.msg || j.error_code || j.error)) || "Account did not open.");
    return Promise.resolve(false);
  }
  function mailUp() {
    var b = mailFields();
    if (!b.email || b.password.length < 8) { talk("Email, and a password of 8 characters."); return; }
    loadCfg(function () {
      talk("Opening the account…");
      fetch(SB + "/auth/v1/signup", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ email: b.email, password: b.password })
      }).then(function (r) { return r.json(); }).then(function (j) {
        return finishSession(j, b.email);
      }).then(function () { fillBody(); paintMe(); }).catch(function () { talk("Account did not open."); });
    });
  }
  function password(email, pass) {
    email = String(email || "").trim();
    pass = String(pass || "");
    if (!email || !pass) return Promise.resolve({ ok: false, error: "Email and password." });
    return new Promise(function (resolve) {
      loadCfg(function () {
        fetch(SB + "/auth/v1/token?grant_type=password", {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ email: email, password: pass })
        }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (x) {
          if (x.j && x.j.access_token) {
            remember(x.j);
            return takeUser(x.j.access_token).then(function (ok) {
              resolve(ok ? { ok: true, user: user() } : { ok: false, error: "Account has no email." });
            });
          }
          resolve({ ok: false, error: (x.j && (x.j.error_description || x.j.msg || x.j.error)) || "Sign-in refused." });
        }).catch(function () { resolve({ ok: false, error: "Sign-in did not finish." }); });
      });
    });
  }
  function mailIn() {
    var b = mailFields();
    password(b.email, b.password).then(function (res) {
      if (!res.ok) talk(res.error || "Sign-in refused.");
      fillBody(); paintMe();
    });
  }
  function setPassword(pw) {
    pw = String(pw || "");
    if (pw.length < 8) return Promise.resolve({ ok: false, error: "8 characters." });
    if (!token()) return Promise.resolve({ ok: false, error: "Sign in with Google first." });
    return fetch(SB + "/auth/v1/user", {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ password: pw })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (x) {
      if (x.ok) return { ok: true };
      return { ok: false, error: (x.j && (x.j.error_description || x.j.msg || x.j.error)) || "Password was not set." };
    }).catch(function () { return { ok: false, error: "Password was not set." }; });
  }
  function savePhone(raw) {
    var tel = String(raw || "").replace(/[^\d+ ]/g, "").trim();
    write("sn:phone", tel);
    var u = user() || {};
    u.phone = tel; u.verified = false;
    write("sn:user", JSON.stringify(u));
    talk(tel ? "Phone stored. It does not verify this id." : "Phone cleared.");
    paintMe();
  }
  function takeUser(at, quiet) {
    write("sn:access", at);
    setCook("sn_at", at, 2592000);
    return fetch(SB + "/auth/v1/user", { headers: { apikey: ANON, Authorization: "Bearer " + at } })
      .then(function (r) { return r.json(); })
      .then(function (u) {
        if (u && u.email) { saveUser(u); if (!quiet) talk("Signed in as " + u.email + "."); return true; }
        if (!quiet) talk("Google returned no email.");
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
    var ytHash = hq.get("provider_token");
    if (ytHash) write("sn:yt", ytHash);
    var code = search.get("code");
    function clean() {
      history.replaceState({}, "", location.pathname);
    }
    if (at) {
      return takeUser(at).then(function (ok) { clean(); return ok; }).catch(function () { clean(); talk("Google sign-in did not finish."); return false; });
    }
    if (code) {
      var ver = read("sn:pkce", "") || getCook("sn_pkce");
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
          setCook("sn_pkce", "", 0);
          if (j && j.provider_token) write("sn:yt", j.provider_token);
          if (j && j.access_token) { remember(j); return takeUser(j.access_token); }
          talk((j && (j.error_description || j.msg || j.error)) || "Google code was not exchanged.");
          return false;
        })
        .then(function (ok) { clean(); if (ok) bounce(); return ok; })
        .catch(function () { clean(); talk("Google sign-in did not finish."); return false; });
    }
    return Promise.resolve(!!user());
  }
  function bounce() {
    var back = getCook("sn_back");
    setCook("sn_back", "", 0);
    if (!back) return;
    try {
      var u = new URL(back);
      if (u.protocol !== "https:" || !hostOk(u.hostname)) return;
      if (u.origin === location.origin) return;
      location.href = u.origin + u.pathname + u.search;
    } catch (e) {}
  }
  function session() {
    return new Promise(function (resolve) {
      loadCfg(function () {
        var at = token();
        if (!at) { resolve(null); return; }
        takeUser(at, true).then(function (ok) {
          if (ok) { resolve(user()); return; }
          var rt = getCook("sn_rt");
          if (!rt) { dropQuiet(); resolve(null); return; }
          fetch(SB + "/auth/v1/token?grant_type=refresh_token", {
            method: "POST",
            headers: { apikey: ANON, "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: rt })
          }).then(function (r) { return r.json(); }).then(function (j) {
            if (j && j.access_token) { remember(j); return takeUser(j.access_token, true).then(function (ok2) { resolve(ok2 ? user() : null); }); }
            dropQuiet(); resolve(null);
          }).catch(function () { resolve(null); });
        }).catch(function () { resolve(null); });
      });
    });
  }
  function css() {
    if (document.getElementById("sn-me-css")) return;
    var s = document.createElement("style");
    s.id = "sn-me-css";
    s.textContent =
      "#sn-me{position:static;width:36px;height:36px;padding:0;border-radius:999px;overflow:hidden;border:1px solid rgba(77,240,255,.85);background:rgba(4,16,28,.9);color:#4df0ff;display:flex;align-items:center;justify-content:center}" +
      "#sn-me.in,#sn-me.out{display:flex!important}" +
      "#sn-me .lbl{display:none}" +
      "#sn-me img,#sn-me .ph{width:36px;height:36px;object-fit:cover;display:flex;align-items:center;justify-content:center;font:800 14px system-ui;color:#4df0ff}" +
      "#sn-me-sheet{position:fixed;inset:0;z-index:80;display:none}" +
      "#sn-me-sheet.on{display:block}" +
      "#sn-me-sheet .bg{position:absolute;inset:0}" +
      "#sn-me-sheet .card{position:absolute;left:50%;top:max(58px,env(safe-area-inset-top));width:min(360px,94vw);transform:translateX(-50%);padding:12px;background:rgba(4,14,28,.96);border:1px solid rgba(126,233,255,.45);border-radius:16px}" +
      "#sn-me-sheet .bar{display:flex;align-items:center;gap:8px;margin:0 0 10px}" +
      "#sn-me-sheet .ttl{flex:1;font:800 11px system-ui;letter-spacing:.16em;color:#7ee9ff}" +
      "#sn-me-sheet .x,#sn-me-sheet button.go{height:40px;padding:0 12px;border:1px solid rgba(126,233,255,.35);background:rgba(4,16,28,.9);color:#e8fbff;border-radius:10px}" +
      "#sn-me-sheet button.go{display:flex;width:100%;margin:8px 0 0;align-items:center;gap:10px;font:800 13px system-ui;color:#7ee9ff;text-align:left}" +
      "#sn-me-sheet button.role{justify-content:space-between}" +
      "#sn-me-sheet button.role i{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:18px;border:1px solid rgba(126,233,255,.35);background:transparent;color:#6a8ea0}" +
      "#sn-me-sheet button.role b{flex:1}" +
      "#sn-me-sheet button.role em{font:800 11px system-ui;letter-spacing:.12em;color:#6a8ea0}" +
      "#sn-me-sheet button.role.on{border-color:#1a3cff;background:rgba(26,60,255,.22);color:#fff}" +
      "#sn-me-sheet button.role.on i{background:#1a3cff;color:#fff;border-color:#1a3cff}" +
      "#sn-me-sheet button.role.on em{color:#7eb0ff}" +
      "#sn-me-sheet button.role.client.on i{background:#0b6b45;border-color:#0b6b45}" +
      "#sn-me-sheet button.role.driver.on i{background:#1a3cff;border-color:#1a3cff}" +
      "#sn-me-sheet button.role.vendor.on i{background:#9a3412;border-color:#9a3412}" +
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
    document.body.classList.toggle("sn-in", inNow);
    var btn = document.getElementById("sn-me");
    if (!btn) return;
    btn.className = inNow ? "in" : "out";
    if (!inNow) {
      btn.innerHTML = '<span class="ph">IN</span>';
      btn.setAttribute("aria-label", "Login");
    } else {
      btn.innerHTML = face(u);
      btn.setAttribute("aria-label", u.name || u.email || "Signed in");
    }
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
    var mine = "";
    try {
      if (window.SN && typeof SN.walletLabel === "function") mine = SN.walletLabel();
      else if (inNow && window.SN && SN.avcGet) mine = Math.round(SN.avcGet()).toLocaleString("en-GB") + " ⭐";
      else mine = "0.00 ⭐";
    } catch (e) { mine = inNow ? "" : "0.00 ⭐"; }
    var roles = { client: false, driver: false, vendor: false };
    try {
      var saved = JSON.parse(localStorage.getItem("sn:roles") || "null");
      if (saved && typeof saved === "object") roles = saved;
    } catch (e) {}
    function roleBtn(id, label, glyph) {
      var on = !!roles[id];
      return '<button type="button" class="go role ' + id + (on ? " on" : "") + '" data-act="role-set" data-role="' + id + '"><i>' + glyph + "</i><b>" + label + "</b><em>" + (on ? "ON" : "OFF") + "</em></button>";
    }
    body.innerHTML =
      '<div class="who">' + face(u) + "<div><b>" + String(name).replace(/[<>]/g, "") + "</b><span>" + (inNow ? String(mail).replace(/[<>]/g, "") : "Not signed in") + "</span></div></div>" +
      (inNow && mine ? '<p class="note">' + mine + "</p>" : "") +
      (inNow
        ? roleBtn("client", "CLIENT", "C") + roleBtn("driver", "DRIVER", "D") + roleBtn("vendor", "VENDOR", "V") +
          '<input id="sn-newpass" type="password" placeholder="Astranov password" autocomplete="new-password"/>' +
          '<button type="button" class="go" data-act="set-pass">SET ASTRANOV PASSWORD</button>' +
          '<button type="button" class="go" data-act="out">SIGN OUT</button>'
        : '<button type="button" class="go" data-act="google">GOOGLE</button>' +
          '<input id="sn-mail" type="email" placeholder="Astranov email" autocomplete="username"/>' +
          '<input id="sn-pass" type="password" placeholder="Astranov password" autocomplete="current-password"/>' +
          '<button type="button" class="go" data-act="mail-in">SIGN IN</button>') +
      '<p class="note">' + (inNow ? "Google verified this id. The password is the Astranov account. No SMS." : "Google creates and verifies the id. No SMS and no confirmation mail. An existing Astranov password also signs in.") + "</p>";
  }
  function openMe() {
    css();
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
        if (act === "mail-in") { mailIn(); return; }
        if (act === "mail-up") { mailUp(); return; }
        if (act === "youtube") { youtube(); return; }
        if (act === "twitter") { x(); return; }
        if (act === "set-pass") {
          var pw = (document.getElementById("sn-newpass") || {}).value || "";
          setPassword(pw).then(function (res) { talk(res.ok ? "Astranov password set. It signs in on every Astranov product." : (res.error || "Password was not set.")); });
          return;
        }
        if (act === "out") { out(); fillBody(); return; }
        if (act === "terms") { talk("Terms: work legal at that GPS. Notis activates roles."); return; }
        if (act === "role-set") {
          if (!user() || !user().email) { google(); return; }
          var role = b.getAttribute("data-role") || "";
          if (role !== "client" && role !== "vendor" && role !== "driver") return;
          var now = { client: false, driver: false, vendor: false };
          try { now = JSON.parse(localStorage.getItem("sn:roles") || "null") || now; } catch (err) {}
          now[role] = !now[role];
          if (window.SN && SN.setRoleOn) SN.setRoleOn(role, !!now[role]);
          else {
            try { localStorage.setItem("sn:roles", JSON.stringify(now)); } catch (err2) {}
          }
          fillBody();
          return;
        }
      });
    }
    fillBody();
    sh.classList.add("on");
  }
  function boot() {
    css();
    paintMe();
    var btn = document.getElementById("sn-me");
    if (btn && !btn.__sn4221) {
      btn.__sn4221 = true;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        openMe();
      });
    }
    var search = new URLSearchParams(location.search);
    var hash = location.hash || "";
    var needNet = !!(search.get("code") || search.get("error") || /access_token=/.test(hash) || token());
    if (!needNet) return;
    loadCfg(function () {
      applyReturn().then(function () { paintMe(); });
    });
  }
  window.SNAuth = { google: google, mailIn: mailIn, mailUp: mailUp, password: password, setPassword: setPassword, remember: remember, session: session, youtube: youtube, yt: yt, x: x, out: out, savePhone: savePhone, user: user, token: token, boot: boot, paint: paintMe, open: openMe };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

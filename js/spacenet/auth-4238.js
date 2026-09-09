/* SpaceNet auth-4238 — ensure public anon before Google PKCE exchange. Overlay on auth.js. */
(function () {
  "use strict";
  if (window.__SN_AUTH_4238) return;
  window.__SN_AUTH_4238 = true;

  function talk(s) {
    try {
      if (window.SN && SN.say) SN.say(s);
      else {
        var el = document.getElementById("line");
        if (el) el.textContent = s;
      }
    } catch (e) {}
  }

  function harden() {
    var A = window.SNAuth;
    if (!A || A.__sn4238) return false;
    A.__sn4238 = true;
    var origGoogle = A.google;
    A.google = function () {
      fetch("/api/public-config", { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var anon = j && j.anon ? String(j.anon) : "";
          if (!anon || anon.length < 20 || j.configured === false) {
            talk("Sign-in not configured — public anon missing.");
            return;
          }
          if (typeof origGoogle === "function") origGoogle();
        })
        .catch(function () {
          talk("Sign-in not configured — public anon missing.");
        });
    };
    return true;
  }

  function boot() {
    if (harden()) return;
    var n = 0;
    var t = setInterval(function () {
      n++;
      if (harden() || n > 80) clearInterval(t);
    }, 50);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

/* 4247 EMERGENCY: restore dark-guest auth from known-good commit (undo @file stub) */
(function () {
  if (window.__SN_AUTH_BOOTSTRAP_4247) return;
  window.__SN_AUTH_BOOTSTRAP_4247 = 1;
  var URL = "https://raw.githubusercontent.com/notisastranov/astranov.eu/49c666464541ef4352e5322931fbbe2663ea3c71/js/spacenet/auth.js";
  function fail(msg) {
    try {
      var el = document.getElementById("line");
      if (el) el.textContent = msg;
    } catch (e) {}
  }
  fetch(URL, { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("auth fetch " + r.status);
      return r.text();
    })
    .then(function (code) {
      if (!code || code.indexOf("needNet") < 0 || code.length < 1000) throw new Error("auth payload bad");
      var s = document.createElement("script");
      s.textContent = code;
      document.head.appendChild(s);
    })
    .catch(function (err) {
      fail("Auth restore failed. Hard refresh.");
      console.error(err);
    });
})();

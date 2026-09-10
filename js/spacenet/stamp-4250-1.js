
    /* 4250: hunt vendor sheet = NOW/PAY/RELOAD always - never TO MY GPS / PIN / CONTINUE lead */
    (function patchVendorChrome() {
      var needleGps = 'data-act="drop-gps">TO MY GPS';
      var needleLogin = ": '<button type=\"button\" class=\"act\" data-act=\"need-login\">LOGIN TO ORDER</button>');";
      var needleGuestNow = 'data-act="now">NOW';
      var newChrome =
        "('<button type=\"button\" class=\"act\" data-act=\"now\">NOW</button>' +\n" +
        "       '<button type=\"button\" class=\"act\" data-act=\"pay\">PAY</button>' +\n" +
        "       '<button type=\"button\" class=\"act\" data-act=\"reload\">RELOAD</button>' +\n" +
        "       (signed() ? '' : '<p>Guest cannot pay. Sign in to order.</p>'));";
      if (code.indexOf(needleGps) >= 0) {
        var ov = code.indexOf("function openVendor");
        var c0 = code.indexOf("(signed()", ov >= 0 ? ov : 0);
        var c1 = code.indexOf(needleLogin, ov >= 0 ? ov : 0);
        if (c0 < 0 || c1 < c0) throw new Error("4250 openVendor chrome not found");
        code = code.slice(0, c0) + newChrome + code.slice(c1 + needleLogin.length);
      } else if (code.indexOf(needleGuestNow) < 0) {
        throw new Error("4250 vendor chrome missing GPS and NOW");
      }
    })();
    code = code.replace(
      'var locLine = signed()\n      ? ((drop || here) ? "<p>Drop: " + esc((drop && drop.name) || hereName || "GPS") + "</p>" : "<p>Set your drop: GPS or 1s pin.</p>")\n      : "<p>Sign in, then set your drop.</p>";',
      'var locLine = signed()\n      ? ((drop || here) ? "<p>Drop: " + esc((drop && drop.name) || hereName || "GPS") + "</p>" : "<p>Order ready - set drop after NOW if needed.</p>")\n      : "<p>Guest - NOW / PAY need sign-in.</p>";'
    );
    code = code.replace(
      'say(vendor.name + ". Menu. Login and drop before a job.");',
      'say(vendor.name + ". Menu. NOW / PAY / RELOAD.");'
    );
    if (code.indexOf("menuHtml(vendor)") >= 0 && code.indexOf("CALL ") < 0) {
      code = code.replace(
        "menuHtml(vendor) +",
        "menuHtml(vendor) +\n      (vendor.phone ? ('<a class=\"tel\" href=\"tel:' + esc(String(vendor.phone).replace(/[^\\d+]/g, '')) + '\">CALL ' + esc(vendor.phone) + '</a>') : '<p>No public phone.</p>') +"
      );
    }
    var oldNeed = '    if (act === "need-login") { needLogin(); return; }';
    var newNeed =
      '    if (act === "now" || act === "pay") {\n' +
      '      if (!signed()) { say("Guest cannot pay. Sign in to order."); needLogin(); return; }\n' +
      '      if (drop || here) { if (!drop && here) setDrop(here); else openOffer(); }\n' +
      '      else { say("Long tap 1s on your drop."); awaitingDrop = true; closeSheet(); }\n' +
      '      return;\n' +
      '    }\n' +
      '    if (act === "need-login") { needLogin(); return; }';
    if (code.indexOf(oldNeed) >= 0) code = code.replace(oldNeed, newNeed);
    if (code.indexOf('data-act="drop-gps">TO MY GPS') >= 0) throw new Error("4250 drop-chrome still in openVendor");
    if (code.indexOf('data-act="now">NOW') < 0) throw new Error("4250 NOW missing");

    code = code.split("4246").join("4250");
    code = code.replace("/* SpaceNet 4250 - one OS. Sphere globe. Tree lock. Origin diet. */",
                        "/* SpaceNet 4250 - goNamed + city-find hunt (no Pizzarium off-island). */");
    if (code.indexOf("window.__SN_4250") < 0) throw new Error("stamp failed");
    if (code.indexOf("IGNORE grokPlaces") < 0) throw new Error("4250 ignore-grok missing");
    if (code.indexOf("function goNamed") < 0) throw new Error("goNamed missing after patch");
    if (code.indexOf("else gps()") >= 0 && code.indexOf("else goNamed") < 0) throw new Error("city still gps");
    if (code.indexOf("/api/find?q=") < 0) throw new Error("city find missing");
    if (code.indexOf("__SN_PIZZA_CLI_4250") < 0) {
      code += "\n/* __SN_PIZZA_CLI_4250 */\n(function(){\n  if (window.__SN_PIZZA_CLI_4250) return;\n  window.__SN_PIZZA_CLI_4250 = 1;\n  function landedCity(){\n    try { if (window.SN && SN.hereName) return String(SN.hereName).split(\",\")[0].trim(); } catch(e){}\n    try { var pl=JSON.parse(localStorage.getItem(\"sn:place\")||\"null\"); if(pl&&pl.name) return String(pl.name).split(\",\")[0].trim(); } catch(e2){}\n    return \"\";\n  }\n  function boot(){\n    var f=document.getElementById(\"f\"); var inp=document.getElementById(\"in\");\n    if(!f||f.__snPizza4250) return; f.__snPizza4250=true;\n    f.addEventListener(\"submit\", function(e){\n      var raw=String((inp&&inp.value)||\"\").trim(); if(!raw) return;\n      var placey=/^(?:land(?:\\s+(?:in|at|on))?|go(?:\\s+to)?|fly(?:\\s+to)?)\\s+(.+)$/i.exec(raw);\n      var city=landedCity();\n      var huntQ=/^(pizza|supermarket|market|grocery)\\b/i.exec(raw);\n      if(city&&huntQ&&!placey){\n        e.preventDefault(); e.stopPropagation();\n        if(inp) inp.value=\"\";\n        if(window.SN&&typeof SN.huntNamed===\"function\") SN.huntNamed(huntQ[1].toLowerCase(), []);\n        else if(window.SN&&typeof SN.talk===\"function\") SN.talk(huntQ[1].toLowerCase());\n      }\n    }, true);\n  }\n  if(document.readyState===\"loading\") document.addEventListener(\"DOMContentLoaded\", boot); else boot();\n})();\n";
    }

    if (code.indexOf("__SN_MONEY_HIDE_4250") < 0) {
      code += "\n/* __SN_MONEY_HIDE_4250 */\n(function(){\n  if (window.__SN_MONEY_HIDE_4250) return;\n  window.__SN_MONEY_HIDE_4250 = 1;\n  function unsigned(){\n    try { var u=JSON.parse(localStorage.getItem(\"sn:user\")||\"null\"); return !(u&&u.email); } catch(e){ return true; }\n  }\n  function hide(){\n    try {\n      var btn=document.getElementById(\"sn-money\"); if(!btn) return;\n      if(unsigned()){ btn.style.display=\"none\"; btn.classList.remove(\"on\"); btn.setAttribute(\"hidden\",\"\"); btn.setAttribute(\"aria-hidden\",\"true\"); }\n      else { btn.removeAttribute(\"hidden\"); btn.removeAttribute(\"aria-hidden\"); }\n    } catch(e){}\n  }\n  hide(); setInterval(hide, 800);\n  document.addEventListener(\"DOMContentLoaded\", hide);\n})();\n";
    }
    return code;
  }
  window.__SN_APPLY_4250 = function (tip) {
    try {
      var code = apply(tip);
      var s = document.createElement("script");
      s.textContent = code;
      document.head.appendChild(s);
      window.__SN_4250 = true;
      try {
        var verEl = document.getElementById("ver");
        if (verEl) verEl.textContent = "V4250";
        var meta = document.querySelector('meta[name="astranov-build"]');
        if (meta) meta.setAttribute("content", "4250");
      } catch (ePaint) {}
    } catch (err) {
      fail("4250 OS patch failed. Nuclear / hard refresh.");
      console.error(err);
    }
  };
})();

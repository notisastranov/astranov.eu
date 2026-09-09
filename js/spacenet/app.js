/* SpaceNet 4228 — fetch base app, patch guest AV€ 0.00, eval */
(function () {
  "use strict";
  if (window.__SN_4228) return;
  function load(url) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300) return xhr.responseText;
    throw new Error("4228 base load fail " + url + " " + xhr.status);
  }
  var BASE = "https://raw.githubusercontent.com/notisastranov/astranov.eu/0d25237aa599421dce67d0188adf9ca50a31e199/js/spacenet/app.js";
  var src = load(BASE);
  src = src.replace("if (window.__SN_4226) return;", "if (window.__SN_4228) return;");
  src = src.replace("window.__SN_4226 = true;", "window.__SN_4228 = true;");
  src = src.replace('var VER = "4226";', 'var VER = "4228";');
  src = src.replace(
    "/* SpaceNet 4226 — one OS. Vendor first, then drop, then drivers. No overlays. */",
    "/* SpaceNet 4228 — guest AV€ 0.00 + owner pool only. No TREASURY leak. */"
  );
  var oldAvc = "  function avcGet() {\n    if (isOwner()) {\n      var n = readNum(\"sn:pool\", TREASURY);\n      if (n < 1) n = TREASURY;\n      writeNum(\"sn:pool\", n);\n      return n;\n    }\n    return readNum(\"sn:avc\", 0);\n  }";
  var newAvc = "  function avcGet() {\n    // Guest / non-owner: never touch sn:pool / TREASURY. Wallet is sn:avc only (default 0).\n    if (!signed() || !isOwner()) return readNum(\"sn:avc\", 0);\n    var n = readNum(\"sn:pool\", TREASURY);\n    if (n < 1) n = TREASURY;\n    writeNum(\"sn:pool\", n);\n    return n;\n  }";
  var oldPm = "  function paintMoney() {\n    if (!moneyBtn) return;\n    if (!signed()) { moneyBtn.classList.remove(\"on\"); moneyBtn.style.display = \"none\"; return; }\n    moneyBtn.classList.add(\"on\");\n    moneyBtn.style.display = \"flex\";\n    moneyBtn.textContent = fmtAve(avcGet());\n  }";
  var newPm = "  function paintMoney() {\n    if (!moneyBtn) return;\n    // Guest / non-owner: always show AV€ 0.00 (never hide; never TREASURY/pool).\n    if (!signed() || !isOwner()) {\n      moneyBtn.classList.add(\"on\");\n      moneyBtn.style.display = \"flex\";\n      moneyBtn.textContent = \"AV€ 0.00\";\n      return;\n    }\n    moneyBtn.classList.add(\"on\");\n    moneyBtn.style.display = \"flex\";\n    moneyBtn.textContent = fmtAve(avcGet());\n  }";
  if (src.indexOf(oldAvc) < 0) throw new Error("4228 avcGet pattern missing");
  if (src.indexOf(oldPm) < 0) throw new Error("4228 paintMoney pattern missing");
  src = src.split(oldAvc).join(newAvc).split(oldPm).join(newPm);
  (0, eval)(src);
})();

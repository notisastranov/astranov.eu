def rep(p, old, new, n=1):
    s = open(p, encoding="utf-8").read()
    assert s.count(old) == n, (p, old[:90], s.count(old))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
A = "js/spacenet/app.js"

# ---- midnight (1): TESTER SHOP/DRIVER/CLIENT + Test * never count as real pins
rep(A, r'''  function junkPlace(s) {
    if (!s) return true;
    var d = String(s.phone || "").replace(/\D/g, "");
    return /\btest\s*(vendor|driver|client)\b/i.test(String(s.name || "")) || (d.length >= 6 && /^0+$/.test(d));
  }''', r'''  function junkPlace(s) {
    if (!s) return true;
    var n = String(s.name || "");
    var d = String(s.phone || "").replace(/\D/g, "");
    return /\btester\b/i.test(n) || /\btest\s*(vendor|driver|client|shop)\b/i.test(n) || /v4297/i.test(n) || (d.length >= 6 && /^0+$/.test(d));
  }
  function isTestJob(j) {
    if (!j) return true;
    var n = String((j.vendor && j.vendor.name) || "") + " " + String((j.drop && j.drop.name) || "") + " " + String(j.driver || "");
    return /\btester\b/i.test(n) || /\btest\s*(vendor|driver|client|shop)\b/i.test(n) || /v4297/i.test(n);
  }
  function jobClosed(j) {
    if (!j) return true;
    if (j.received || j.cancelled || j.vendorGone) return true;
    var st = String(j.status || j.stage || "").toLowerCase();
    return st === "received" || st === "released" || st === "done" || st === "cancelled" || st === "delivered";
  }
  function vendorPresent(j) {
    if (!j || !j.vendor) return false;
    if (j.live && !jobClosed(j)) return true;
    var v = j.vendor;
    var list = shops.concat(viewListed || []);
    if (v.id && list.some(function (s) { return s && String(s.id) === String(v.id) && !junkPlace(s); })) return true;
    if (v.name && isFinite(+v.lat) && list.some(function (s) {
      return s && !junkPlace(s) && String(s.name || "").toLowerCase() === String(v.name).toLowerCase() && haversineKm(s, v) < 0.5;
    })) return true;
    try {
      var mine = JSON.parse(localStorage.getItem("sn:mine") || "[]") || [];
      if (mine.some(function (r) {
        return r && (r.kind === "shop" || r.place) && (
          (v.id && String(r.id) === String(v.id)) ||
          (v.name && String(r.name || "").toLowerCase() === String(v.name).toLowerCase() && isFinite(+r.lat) && haversineKm(r, v) < 0.5)
        );
      })) return true;
    } catch (e) {}
    return false;
  }''')
rep("api/space.js", r'''  return /\btest\s*(vendor|driver|client)\b/i.test(String((b && b.name) || "")) || (d.length >= 6 && /^0+$/.test(d));
}''', r'''  var n = String((b && b.name) || "");
  return /\btester\b/i.test(n) || /\btest\s*(vendor|driver|client|shop)\b/i.test(n) || /v4297/i.test(n) || (d.length >= 6 && /^0+$/.test(d));
}''')

# ---- (a) offer X closes the price card; offer sits above JOBS so taps reach the X
rep(A, r'''      "#sn-sheet.offer .card{max-height:32vh!important}",''', r'''      "#sn-sheet.offer{z-index:95!important}",
      "#sn-sheet.offer .card{max-height:32vh!important}",''')
rep(A, r'''      if (act === "sheet-x") {
        if (Date.now() < sheetArm) return;
        closeSheet();
        return;
      }''', r'''      if (act === "sheet-x") {
        if (Date.now() < sheetArm) return;
        var shx = $("sn-sheet");
        if (shx && shx.classList.contains("offer")) {
          var dropId = dockFocus;
          dockTabs = dockTabs.filter(function (t) { return !(t && t.kind === "offer" && (!dropId || t.id === dropId)); });
          dockFocus = dockTabs.length ? dockTabs[dockTabs.length - 1].id : "";
          paintDockTabs();
        }
        closeSheet();
        return;
      }''')

# ---- (c) HERE green check must never fire run-offer / create an order
rep(A, r'''    var go = body.querySelector("[data-act='save-place'],[data-act='save-drop'],[data-act='save-driver'],[data-act='save-stock'],[data-act='save-block'],[data-act='post-go'],[data-act='post-next'],[data-act='send'],[data-act='run-offer']");''', r'''    var go = body.querySelector("[data-act='save-place'],[data-act='save-drop'],[data-act='save-driver'],[data-act='save-stock'],[data-act='save-block'],[data-act='post-go'],[data-act='post-next'],[data-act='send']");''')

print("ok18a")

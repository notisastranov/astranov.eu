#!/usr/bin/env python3
"""Live V4325 standing-test priorities on merged tree."""
import re

A = "js/spacenet/app.js"
s = open(A, encoding="utf-8").read()

def must(c, m):
    if not c: raise SystemExit("FAIL: " + m)

# ---- (3) Ribbon flush at top:0 (no permanent 55px gap). Power/support stay at top:8. ----
# Reverse any top:56 we forced; index + inject both to top:0.
idx = open("index.html", encoding="utf-8").read()
idx2 = idx.replace("#top{top:56px !important", "#top{top:0 !important")
idx2 = idx2.replace("#top{top:56px!important", "#top{top:0!important")
# keep at least one top:0 rule
if "top:0" not in idx2 and "#top{" in idx2:
    idx2 = re.sub(r"#top\{top:\s*\d+px", "#top{top:0px", idx2, count=1)
open("index.html", "w", encoding="utf-8").write(idx2)
print("ok index top:0")

# In app inject CSS: force #top{top:0!important} and remove our +56 overrides that create the gap
s = s.replace('"#top{top:56px!important}"', '"#top{top:0!important}"')
s = s.replace('"#top{top:56px!important;', '"#top{top:0!important;')
# If layout CSS block still has top:56 from main, add a later winning top:0
if '"#top{top:0!important}"' not in s:
    m = re.search(r'"#top\{top:[^"]+"', s)
    if m:
        s = s[: m.end()] + ',"#top{top:0!important}"' + s[m.end() :]
        print("ok inject top:0")
else:
    print("top:0 inject present")

# Ensure liftChrome keeps top at 0 (already does)
must('top.style.setProperty("top", "0px", "important")' in s, "liftChrome top 0")

# ---- (1) showFound: filter junk; never surface Test Vendor / TESTER ----
old_sf = """  function showFound(named, list) {
    var view = list && list.length ? list : shops;
    if (!view.length) { say("No real pin for that hunt. Try another name near you."); return; }"""
new_sf = """  function showFound(named, list) {
    var view = (list && list.length ? list : shops).filter(function (s) { return s && !junkPlace(s) && seesShop(s); });
    if (!view.length) { say("No real pin for that hunt. Try another name near you."); return; }"""
if "seesShop(s); });" not in s.split("function showFound")[1][:400]:
    must(old_sf in s, "showFound head")
    s = s.replace(old_sf, new_sf, 1)
    print("ok showFound junk filter")
else:
    print("showFound filter already")

# openFind already filters seesShop; also junk
s = s.replace(
    "var visible = (shops || []).filter(function (s) { return s && seesShop(s); });",
    "var visible = (shops || []).filter(function (s) { return s && !junkPlace(s) && seesShop(s); });",
    1,
)

# Tap outside vendor/driver/client tile: close only — do not open FIND/LIST
# Map click while a vendor tile is open → closeSheet instead of ignoring / listing
old_map_click = """      map.on("click", function () {
        var t = Date.now();
        if (t - lastTap < 320) closeCity();
        lastTap = t;
      });"""
new_map_click = """      map.on("click", function () {
        var sh = $("sn-sheet");
        if (sh && sh.classList.contains("on") && sh.classList.contains("tile")) {
          var kind = sh.getAttribute("data-kind") || "";
          if (/^(vendor|driver|client|list)$/.test(kind)) { closeSheet(); return; }
        }
        var t = Date.now();
        if (t - lastTap < 320) closeCity();
        lastTap = t;
      });"""
if old_map_click in s:
    s = s.replace(old_map_click, new_map_click, 1)
    print("ok map click closes tile")
elif "closeSheet(); return;" in s and "map.on(\"click\"" in s:
    print("map click already")
else:
    print("WARN map click")

# ---- (2) Offer X stays closed: clear dockFocus, sheetHold, dismiss id ----
old_x = """      if (act === "sheet-x") {
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
      }"""
new_x = """      if (act === "sheet-x") {
        if (Date.now() < sheetArm) return;
        var shx = $("sn-sheet");
        sheetHold = true;
        if (shx && shx.classList.contains("offer")) {
          var dropId = dockFocus;
          try { if (dropId) sessionStorage.setItem("sn:offer-x:" + dropId, "1"); } catch (e) {}
          dockTabs = dockTabs.filter(function (t) { return !(t && t.kind === "offer" && (!dropId || t.id === dropId)); });
          dockFocus = "";
          paintDockTabs();
        }
        closeSheet();
        sheetHold = true;
        return;
      }"""
if "sn:offer-x:" not in s:
    must(old_x in s, "sheet-x offer block")
    s = s.replace(old_x, new_x, 1)
    print("ok offer X dismiss")
else:
    print("offer X already")

# throwOffer: skip if user dismissed this offer id
old_to = """  function throwOffer(job) {
    var id = "offer-" + (job && job.id ? job.id : Date.now().toString(36));
    var fee = job && (job.fee != null ? job.fee : job.total);"""
new_to = """  function throwOffer(job) {
    var id = "offer-" + (job && job.id ? job.id : Date.now().toString(36));
    try { if (sessionStorage.getItem("sn:offer-x:" + id)) return; } catch (e) {}
    var fee = job && (job.fee != null ? job.fee : job.total);"""
if "sn:offer-x:" + " + id" not in s and 'sn:offer-x:" + id' not in s:
    if old_to in s:
        s = s.replace(old_to, new_to, 1)
        print("ok throwOffer respect dismiss")
    else:
        print("WARN throwOffer")
else:
    print("throwOffer dismiss already")

# ---- (5) go to Rhodes / coords land ----
# Insert goToPlace helper + talk() branch before seatedCat
if "function goToPlaceAsk" not in s:
    helper = r'''
  function goToPlaceAsk(q) {
    var s = String(q || "").trim();
    var m = s.match(/^(?:go\s+to|take\s+me\s+to|fly\s+to|open)\s+(.+)$/i);
    if (!m) return null;
    var dest = m[1].trim();
    var co = dest.match(/(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)/);
    var placeBit = dest.replace(/(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)/, " ").replace(/\s+/g, " ").trim();
    if (co) {
      var lat = +co[1], lng = +co[2];
      if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
      var nm = placeBit || (lat.toFixed(3) + "," + lng.toFixed(3));
      var g = GR_CITY[normName(placeBit.split(/\s+/)[0] || "")];
      if (g && (!placeBit || /rhodes|rodos|athens|athina/i.test(placeBit))) {
        // prefer named city centre when the spoken name is a known city; keep typed coords if far from catalogue
        if (haversineKm({ lat: lat, lng: lng }, { lat: g.lat, lng: g.lng }) < 80) {
          return { item: "", place: g.label, geo: { lat: g.lat, lng: g.lng, name: g.label }, raw: s };
        }
      }
      return { item: "", place: nm, geo: { lat: lat, lng: lng, name: nm }, raw: s };
    }
    if (!placeBit) return null;
    var g2 = GR_CITY[normName(placeBit.split(/\s+/)[0])];
    if (g2) return { item: "", place: g2.label, geo: { lat: g2.lat, lng: g2.lng, name: g2.label }, raw: s };
    return { item: "", place: placeBit, geo: null, raw: s };
  }
'''
    # place after namedPlaceAsk
    anchor = "  function cleanItem(t) {"
    must(anchor in s, "cleanItem for goTo insert")
    s = s.replace(anchor, helper + "\n  function cleanItem(t) {", 1)
    print("ok goToPlaceAsk")

# talk() branch
old_talk = """    if (runLine(q)) return;
    var seatedCat = cleanItem(q);"""
new_talk = """    if (runLine(q)) return;
    var goAsk = goToPlaceAsk(q);
    if (goAsk) {
      if (goAsk.geo) { huntPlace(goAsk); return; }
      say("Finding " + goAsk.place + "…");
      placeGeo(goAsk.place).then(function (geo) {
        if (geo) huntPlace({ item: "", place: geo.name || goAsk.place, geo: geo, raw: q });
        else say("No map pin for " + goAsk.place + " yet. Try the city and country, like Rhodes Greece.");
      }, function () { say("No map pin for " + goAsk.place + " yet."); });
      return;
    }
    var seatedCat = cleanItem(q);"""
if "goToPlaceAsk(q)" not in s.split("function talk")[1][:800]:
    must(old_talk in s, "talk goTo branch")
    s = s.replace(old_talk, new_talk, 1)
    print("ok talk goTo")
else:
    print("talk goTo already")

# bare Rhodes (no "go to") already via barePlaceWord — ensure GR_CITY path in placeGeo (already)

# ---- (4) upsert client: reconfirm markers present ----
must("sameOwnerName" in s, "sameOwnerName")
must('kind === "drop"' in s and "dropMineDups" in s, "client upsert helpers")
must("dPrev" in s and "list-drop" in s, "form-drop upsert")
print("ok upsert client markers present")

open(A, "w", encoding="utf-8").write(s)
print("fix22 done")

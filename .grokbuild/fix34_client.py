#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""4332: globe→street tile handoff; listed menu parse; Enter lock; GPS/IP seat+note."""
from pathlib import Path
import re

app_path = Path("js/spacenet/app.js")
if not app_path.exists():
    raise SystemExit("missing js/spacenet/app.js")
s = app_path.read_text(encoding="utf-8")

def must_replace(old, new, tag):
    global s
    if old not in s:
        if new.strip() and new in s:
            print("skip", tag, "(already)")
            return
        raise SystemExit("missing block: " + tag)
    s = s.replace(old, new, 1)
    print("ok", tag)

# --- 1) Normalize menu in asPlace ---
must_replace(
    '''    return {
      id: String(row.id || row.osm_id || (name + lat + lng)),
      name: String(name).slice(0, 80),
      lat: lat,
      lng: lng,
      kind: row.kind || tags.amenity || tags.shop || "shop",
      phone: row.phone || tags.phone || tags["contact:phone"] || "",
      menu: row.menu || [],
      photo: row.photo || "",
      src: row.src || "osm"
    };''',
    '''    var menu = row.menu;
    if (typeof menu === "string") {
      try { menu = JSON.parse(menu); } catch (e) { menu = []; }
    }
    if (!Array.isArray(menu)) menu = [];
    return {
      id: String(row.id || row.osm_id || (name + lat + lng)),
      name: String(name).slice(0, 80),
      lat: lat,
      lng: lng,
      kind: row.kind || tags.amenity || tags.shop || "shop",
      phone: row.phone || tags.phone || tags["contact:phone"] || "",
      menu: menu,
      photo: row.photo || "",
      address: row.address || tags["addr:full"] || "",
      src: row.src || "osm",
      status: row.status || ""
    };''',
    "asPlace-menu-json"
)

# --- 2) openVendor: guard menu array ---
must_replace(
    '''  function openVendor(s) {
    if (!s) return;
    vendor = s;
    var where = [s.address, s.kind && s.kind !== "shop" ? s.kind : ""].filter(Boolean).join(" · ");
    var menu = (s.menu || []).map(function (m, i) {''',
    '''  function openVendor(s) {
    if (!s) return;
    vendor = s;
    var where = [s.address, s.kind && s.kind !== "shop" ? s.kind : ""].filter(Boolean).join(" · ");
    var menuRows = s.menu;
    if (typeof menuRows === "string") {
      try { menuRows = JSON.parse(menuRows); } catch (e) { menuRows = []; }
    }
    if (!Array.isArray(menuRows)) menuRows = [];
    var menu = menuRows.map(function (m, i) {''',
    "openVendor-menu-guard"
)

# Tooltip: show item count only for arrays
must_replace(
    '''      mark.bindTooltip((s.name || "shop") + (s.status === "pending" ? " · PENDING" : "") + (s.menu && s.menu.length ? " · " + s.menu.length : ""), { direction: "top" });
      if (isAdmin() && s.src === "listed") {
        mark.on("dragend", function () {
          var ll = mark.getLatLng();
          moveVendor(s.id, { lat: ll.lat, lng: ll.lng });
        });
      }
      mark.on("click", function (e) { if (e && e.originalEvent) L.DomEvent.stop(e.originalEvent); openVendor(s); });''',
    '''      var tipExtra = "";
      if (s.status === "pending") tipExtra += " · PENDING";
      if (Array.isArray(s.menu) && s.menu.length) tipExtra += " · " + s.menu.length;
      mark.bindTooltip((s.name || "shop") + tipExtra, { direction: "top", sticky: true });
      if (isAdmin() && s.src === "listed") {
        mark.on("dragend", function () {
          var ll = mark.getLatLng();
          moveVendor(s.id, { lat: ll.lat, lng: ll.lng });
        });
      }
      mark.on("click", function (e) {
        if (e && e.originalEvent) {
          L.DomEvent.stop(e.originalEvent);
          try { L.DomEvent.preventDefault(e.originalEvent); } catch (err) {}
        }
        try { if (mark.closeTooltip) mark.closeTooltip(); } catch (err2) {}
        openVendor(s);
      });
      /* also catch taps that Leaflet routes to the icon DOM */
      try {
        var ic = mark.getElement && mark.getElement();
        if (ic && !ic.__snTap) {
          ic.__snTap = true;
          ic.style.pointerEvents = "auto";
          ic.addEventListener("pointerup", function (ev) {
            if (ev && ev.button) return;
            ev.preventDefault(); ev.stopPropagation();
            openVendor(s);
          }, true);
        }
      } catch (err3) {}''',
    "marker-click-harden"
)

# --- 3) openCity: wait for size + first tile; guard NaN ---
OLD_OPEN = '''  function openCity(pt) {
    if (!pt || !isFinite(pt.lat) || !isFinite(pt.lng)) return;
    aim = { lat: pt.lat, lng: pt.lng };
    tierI = 3;
    var el = $("city");
    if (!el || typeof L === "undefined" || !pt) return;
    cityOn = true;
    el.classList.add("on");
    if (!map) {
      map = L.map(el, { zoomControl: false, attributionControl: false, minZoom: 12, maxZoom: 19, scrollWheelZoom: true }).setView([pt.lat, pt.lng], 16);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, minZoom: 12 }).addTo(map);'''

NEW_OPEN = '''  function openCity(pt) {
    if (!pt || !isFinite(+pt.lat) || !isFinite(+pt.lng)) return;
    var plat = +pt.lat, plng = +pt.lng;
    if (!isFinite(plat) || !isFinite(plng) || Math.abs(plat) > 90 || Math.abs(plng) > 180) return;
    aim = { lat: plat, lng: plng, name: pt.name || (aim && aim.name) || "" };
    tierI = 3;
    var el = $("city");
    if (!el || typeof L === "undefined") return;
    cityOn = true;
    el.classList.add("on");
    el.style.opacity = "0";
    el.style.background = "transparent";
    el.style.visibility = "visible";
    function sizeReady() {
      var w = el.clientWidth || el.offsetWidth || 0;
      var h = el.clientHeight || el.offsetHeight || 0;
      return w > 40 && h > 40;
    }
    function revealWhenTiled() {
      if (!map || !cityOn) return;
      function show() {
        el.style.opacity = "1";
        el.style.background = "";
        try { map.invalidateSize({ animate: false }); } catch (e) {}
      }
      var shown = false;
      function once() {
        if (shown) return;
        shown = true;
        show();
      }
      try {
        map.eachLayer(function (ly) {
          if (ly && ly.on && ly.getAttribution != null) {
            ly.once("load", once);
            ly.once("tileload", once);
          }
        });
      } catch (e2) {}
      setTimeout(once, 900);
    }
    function applyView() {
      if (!map || !cityOn) return;
      if (!sizeReady()) {
        setTimeout(applyView, 40);
        return;
      }
      try { map.invalidateSize({ animate: false }); } catch (e) {}
      try { map.setView([plat, plng], 16, { animate: false }); } catch (e2) {}
      try { map.invalidateSize({ animate: false }); } catch (e3) {}
      revealWhenTiled();
    }
    if (!map) {
      map = L.map(el, { zoomControl: false, attributionControl: false, minZoom: 12, maxZoom: 19, scrollWheelZoom: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, minZoom: 12,
        errorTileUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
      }).addTo(map);'''

must_replace(OLD_OPEN, NEW_OPEN, "openCity-handoff-head")

# Replace the trailing setView/invalidateSize of openCity
must_replace(
    '''    } else {
      try { map.setMinZoom(12); } catch (e) {}
      map.setView([pt.lat, pt.lng], Math.max(14, map.getZoom() || 16));
    }
    if (youMark) try { map.removeLayer(youMark); } catch (e) {}
    youMark = null;
    if (here && isFinite(here.lat)) {
      youMark = L.circleMarker([here.lat, here.lng], { radius: 8, color: "#4df0ff", fillColor: "#4df0ff", fillOpacity: 0.9, weight: 2 }).addTo(map);
    }
    paintShopsOnMap();
    setTimeout(function () { if (map) map.invalidateSize(); }, 80);
  }
  function closeCity() {
    var el = $("city");
    if (el) el.classList.remove("on");
    cityOn = false;
    intro = false;
    if (tierI > 2) tierI = 2;
    if (aim) {
      var f = face(aim);
      cam.yaw = f.yaw;
      cam.pitch = f.pitch;
    }
    cam.dist = TIERS[2].dist;
  }''',
    '''    } else {
      try { map.setMinZoom(12); } catch (e) {}
    }
    if (youMark) try { map.removeLayer(youMark); } catch (e) {}
    youMark = null;
    if (here && isFinite(+here.lat) && isFinite(+here.lng)) {
      youMark = L.circleMarker([+here.lat, +here.lng], { radius: 8, color: "#4df0ff", fillColor: "#4df0ff", fillOpacity: 0.9, weight: 2 }).addTo(map);
    }
    paintShopsOnMap();
    requestAnimationFrame(function () {
      requestAnimationFrame(applyView);
    });
  }
  function closeCity() {
    var el = $("city");
    if (el) {
      el.classList.remove("on");
      el.style.opacity = "";
      el.style.background = "";
      el.style.visibility = "";
    }
    cityOn = false;
    intro = false;
    if (tierI > 2) tierI = 2;
    if (aim && isFinite(+aim.lat) && isFinite(+aim.lng)) {
      var f = face(aim);
      cam.yaw = f.yaw;
      cam.pitch = f.pitch;
    }
    cam.dist = TIERS[2].dist;
    /* force a globe frame so wheel-out is never a grey sheet */
    try { if (typeof drawGlobe === "function") drawGlobe(performance.now()); } catch (e) {}
  }''',
    "openCity-tail+closeCity"
)

# zoomToDist street handoff: use guarded openCity only (remove blind setView)
must_replace(
    '''      var street = { lat: +aim.lat, lng: +aim.lng, name: aim.name || "" };
      openCity(street);
      if (map) {
        try {
          map.setView([street.lat, street.lng], 16, { animate: false });
          map.invalidateSize();
        } catch (e) {}
      }
      say("Street · " + street.lat.toFixed(3) + "," + street.lng.toFixed(3));
      return;''',
    '''      var street = { lat: +aim.lat, lng: +aim.lng, name: aim.name || "" };
      if (!isFinite(street.lat) || !isFinite(street.lng)) {
        say("Wheel aim missed the globe. Drag to face the place, then wheel in.");
        return;
      }
      openCity(street);
      say("Street · " + street.lat.toFixed(3) + "," + street.lng.toFixed(3));
      return;''',
    "zoomToDist-no-blind-setView"
)

# --- 4) land(): set lastSeat + IP note + status ---
must_replace(
    '''  function land(pt, open) {
    try { closeSky(); } catch (e) {}
    seated = true;
    intro = false;
    if (pt.how === "gps") {
      hereLive = { lat: pt.lat, lng: pt.lng };
      if (!adminPin) here = hereLive;
    } else if (pt.how === "admin") {
      adminPin = true;
      here = { lat: pt.lat, lng: pt.lng };
    } else if (!adminPin) {
      here = { lat: pt.lat, lng: pt.lng };
    }
    if (!here) here = { lat: pt.lat, lng: pt.lng };
    window.__SN_HERE = here;
    try { if (pt.how === "gps" || pt.how === "saved") localStorage.setItem("sn:here", JSON.stringify(hereLive || here)); } catch (e) {}
    aim = { lat: here.lat, lng: here.lng };
    openCity(aim);
    if (map) {
      try { map.setView([aim.lat, aim.lng], 17); } catch (e) {}
      setTimeout(function () { try { if (map) { map.invalidateSize(); map.setView([aim.lat, aim.lng], 17); } } catch (e) {} }, 80);
    }
    var tag = pt.how === "net" ? "Network" : pt.how === "admin" ? "Admin pin" : pt.how === "saved" ? "Last fix" : "GPS";
    say(tag + " " + here.lat.toFixed(4) + "," + here.lng.toFixed(4) + (pt.name ? " · " + pt.name : "") + " · city");
    pullListings();
  }''',
    '''  function land(pt, open) {
    try { closeSky(); } catch (e) {}
    seated = true;
    intro = false;
    adminPin = false;
    var lat = +pt.lat, lng = +pt.lng;
    if (!isFinite(lat) || !isFinite(lng)) return;
    var ipNote = pt.how === "net";
    var label = pt.name || "";
    if (ipNote) label = label ? (label + " · Approximate location (IP)") : "Approximate location (IP)";
    else if (pt.how === "gps") label = label || "GPS";
    else if (pt.how === "saved") label = label || "Last fix";
    else if (pt.how === "admin") label = label || "Admin pin";
    if (pt.how === "gps") {
      hereLive = { lat: lat, lng: lng, name: label };
      here = hereLive;
    } else {
      here = { lat: lat, lng: lng, name: label };
    }
    lastSeat = { lat: lat, lng: lng, name: label };
    window.__SN_HERE = here;
    try { if (pt.how === "gps" || pt.how === "saved") localStorage.setItem("sn:here", JSON.stringify(hereLive || here)); } catch (e) {}
    aim = { lat: lat, lng: lng, name: label };
    openCity(aim);
    if (ipNote) say("Approximate location (IP)" + (pt.name ? " · " + pt.name : "") + " · " + lat.toFixed(3) + "," + lng.toFixed(3));
    else say((pt.how === "gps" ? "GPS" : pt.how === "saved" ? "Last fix" : "Located") + " · " + (pt.name ? pt.name + " · " : "") + lat.toFixed(4) + "," + lng.toFixed(4));
    pullListings();
  }''',
    "land-seat-ip-note"
)

# pullListings: show seat name for GPS/IP too (not only how===land)
must_replace(
    '''      var where = (seat.name && seat.how === "land") ? seat.name : (seat.lat.toFixed(3) + "," + seat.lng.toFixed(3));
      if (n) say(where + " · " + n + " real place" + (n === 1 ? "" : "s") + " on the field.");
      else say(where + " · no public vendors here yet.");''',
    '''      var where = (seat.name && String(seat.name).trim() && seat.name !== "map" && seat.name !== "place")
        ? seat.name
        : (seat.lat.toFixed(3) + "," + seat.lng.toFixed(3));
      if (n) say(where + " · " + n + " real place" + (n === 1 ? "" : "s") + " on the field.");
      else say(where + " · no public vendors here yet.");''',
    "pullListings-status-name"
)

# --- 5) Enter: always submit on first Enter ---
must_replace(
    '''      function submitTalk(e) {
        if (e) e.preventDefault();
        var v = inp && inp.value;
        if (inp) inp.value = "";
        if (typeof paintGo === "function") paintGo();
        talk(v, false);
        materialize(needFilter());
      }
      f.addEventListener("submit", submitTalk);
      if (inp && !inp.__snEnter) {
        inp.__snEnter = true;
        inp.addEventListener("keydown", function (e) {
          if (e.key !== "Enter" && e.keyCode !== 13) return;
          if (e.isComposing || e.keyCode === 229) return;
          e.preventDefault();
          submitTalk(e);
        });
      }
    }''',
    '''      var talkLock = 0;
      function submitTalk(e) {
        if (e) { e.preventDefault(); if (e.stopPropagation) e.stopPropagation(); }
        var now = Date.now();
        if (now - talkLock < 350) return;
        var v = inp ? String(inp.value || "").trim() : "";
        if (!v) return;
        talkLock = now;
        if (inp) inp.value = "";
        if (typeof paintGo === "function") paintGo();
        talk(v, false);
        materialize(needFilter());
      }
      f.addEventListener("submit", submitTalk);
      if (inp && !inp.__snEnter) {
        inp.__snEnter = true;
        function onEnter(e) {
          if (e.key !== "Enter" && e.keyCode !== 13) return;
          if (e.isComposing) return;
          e.preventDefault();
          submitTalk(e);
        }
        inp.addEventListener("keydown", onEnter);
        inp.addEventListener("keyup", function (e) {
          if (e.key !== "Enter" && e.keyCode !== 13) return;
          if (e.isComposing) return;
          /* backup if keydown was swallowed while a prior fetch was settling */
          if (inp && String(inp.value || "").trim()) submitTalk(e);
        });
      }
    }''',
    "enter-first-submit"
)

# goToPlaceAsk: prefer bare GR_CITY match first (Rodos etc.)
must_replace(
    '''  function goToPlaceAsk(q) {
    var s = String(q || "").trim();
    var m = s.match(/^(?:go\\s+to|take\\s+me\\s+to|fly\\s+to|open)\\s+(.+)$/i);
    var dest = m ? m[1].trim() : s;''',
    '''  function goToPlaceAsk(q) {
    var s = String(q || "").trim();
    if (!s) return null;
    var direct = GR_CITY[normPlaceKey(s)] || GR_CITY[normPlaceKey(s.replace(/\\s+/g, ""))];
    if (direct) return { place: direct.label, geo: { lat: direct.lat, lng: direct.lng, name: direct.label } };
    var m = s.match(/^(?:go\\s+to|take\\s+me\\s+to|fly\\s+to|open)\\s+(.+)$/i);
    var dest = m ? m[1].trim() : s;''',
    "goToPlaceAsk-direct-city"
)

# VER bump crumb
s2, n = re.subn(r'var VER = "[0-9]+"', 'var VER = "4332"', s, count=1)
if not n:
    raise SystemExit("VER missing")
s = s2
print("ok VER→4332")

app_path.write_text(s, encoding="utf-8")
print("wrote", app_path, "bytes", len(s))

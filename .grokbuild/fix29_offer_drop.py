#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""4328b: drop fee from landed city (never IP when far); mute offers/JOBS on Power; APPLY left / X right everywhere; no stage steps on offer."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2] if (Path(__file__).name == "fix29_offer_drop.py") else Path(".")
# When run from Actions: cwd is repo root; script lives in .grokbuild/
app_path = Path("js/spacenet/app.js")
idx_path = Path("index.html")
if not app_path.exists():
    app_path = ROOT / "js/spacenet/app.js"
    idx_path = ROOT / "index.html"

s = app_path.read_text(encoding="utf-8")


def must_replace(old, new, tag):
    global s
    if old not in s:
        if new in s:
            print("skip", tag, "(already)")
            return
        raise SystemExit("missing block: " + tag)
    s = s.replace(old, new, 1)
    print("ok", tag)


# --- resolveDrop: land/city view, never IP when >50km from shop ---
RESOLVE = r'''
  function resolveDrop(vendor) {
    var maxKm = 50;
    function near(pt) {
      return pt && isFinite(+pt.lat) && isFinite(+pt.lng) && vendor && isFinite(+vendor.lat) && haversineKm(vendor, pt) <= maxKm;
    }
    if (near(homeDrop)) return homeDrop;
    if (near(drop)) return drop;
    if (near(lastSeat)) return { lat: +lastSeat.lat, lng: +lastSeat.lng, name: lastSeat.name || "place" };
    if (cityOn && map) {
      try {
        var c = map.getCenter();
        var view = c ? { lat: +c.lat, lng: +c.lng, name: "map" } : null;
        if (near(view)) return view;
      } catch (e) {}
    }
    if (near(here)) return here;
    return null;
  }
  function askDropNear(vendor) {
    say("List a delivery address near " + ((vendor && vendor.name) || "the shop") + ". IP or a far city is not used for the fee.");
    try {
      var body = $("sn-sheet-body");
      if (body) {
        /* keep menu; nudge */
      }
    } catch (e) {}
  }
'''

if "function resolveDrop(" not in s:
    # inject after haversineKm
    needle = "  function quoteDelivery(from, to, opts) {"
    if needle not in s:
        raise SystemExit("missing quoteDelivery for resolveDrop inject")
    s = s.replace(needle, RESOLVE + "\n" + needle, 1)
    print("ok resolveDrop-inject")
else:
    print("skip resolveDrop-inject")

# checkoutVendor dest
must_replace(
    """    var dest = (homeDrop && isFinite(+homeDrop.lat)) ? homeDrop : (here && isFinite(+here.lat) ? here : null);
    if (!dest) { say("List a delivery address, then Apply."); return; }
    var food = 0;
    lines.forEach(function (l) { food += moneyOf(l.price) * l.n; });
    var q = quoteDelivery(vendor, dest, quoteOpts);""",
    """    var dest = resolveDrop(vendor);
    if (!dest) { askDropNear(vendor); return; }
    var food = 0;
    lines.forEach(function (l) { food += moneyOf(l.price) * l.n; });
    var q = quoteDelivery(vendor, dest, quoteOpts);""",
    "checkout-dest",
)

# order-here dest
must_replace(
    """        var dest = (homeDrop && isFinite(+homeDrop.lat)) ? homeDrop : (here && isFinite(+here.lat) ? here : null);
        if (!dest) { say("List a delivery address, or tap GPS, then start the order."); return; }
        drop = { lat: +dest.lat, lng: +dest.lng, name: dest.name || "client", address: dest.address || "", phone: dest.phone || "" };
        showQuote();""",
    """        var dest = resolveDrop(vendor);
        if (!dest) { askDropNear(vendor); return; }
        drop = { lat: +dest.lat, lng: +dest.lng, name: dest.name || "client", address: dest.address || "", phone: dest.phone || "" };
        showQuote();""",
    "order-here-dest",
)

# run-offer / post path that uses homeDrop-only without distance check — harden when quoting with homeDrop||here elsewhere
OLD_SEND_DEST = """        if (!homeDrop || !isFinite(+homeDrop.lat)) { say("List the delivery address first."); return; }"""
# leave that — explicit homeDrop list is fine

# showQuote: if drop is far from vendor, refuse
must_replace(
    """  function showQuote() {
    if (!vendor || !drop) return;
    var q = quoteDelivery(vendor, drop, quoteOpts);""",
    """  function showQuote() {
    if (!vendor || !drop) return;
    if (isFinite(+vendor.lat) && isFinite(+drop.lat) && haversineKm(vendor, drop) > 50) {
      askDropNear(vendor);
      return;
    }
    var q = quoteDelivery(vendor, drop, quoteOpts);""",
    "showQuote-cap",
)

# --- mute: throwOffer respects sn:offer-x ---
must_replace(
    """  function throwOffer(job) {
    var id = "offer-" + (job && job.id ? job.id : Date.now().toString(36));
    var fee = job && (job.fee != null ? job.fee : job.total);""",
    """  function throwOffer(job) {
    var id = "offer-" + (job && job.id ? job.id : Date.now().toString(36));
    try { if (sessionStorage.getItem("sn:offer-x:" + id)) return; } catch (e) {}
    var fee = job && (job.fee != null ? job.fee : job.total);""",
    "throwOffer-mute",
)

# sheet-x mutes offer
must_replace(
    """      if (act === "sheet-x") {
        if (Date.now() < sheetArm) return;
        closeSheet();
        return;
      }""",
    """      if (act === "sheet-x") {
        if (Date.now() < sheetArm) return;
        sheetHold = true;
        var shx = $("sn-sheet");
        if (shx && (shx.classList.contains("offer") || shx.getAttribute("data-kind") === "vendor-order" || shx.getAttribute("data-kind") === "driver-offer")) {
          var dropId = dockFocus || ("offer-" + (shx.getAttribute("data-job") || ""));
          try { if (dropId) sessionStorage.setItem("sn:offer-x:" + dropId, "1"); } catch (e) {}
          try { sessionStorage.setItem("sn:jobs-muted", "1"); } catch (e) {}
          dockTabs = dockTabs.filter(function (t) { return !(t && t.kind === "offer" && (!dropId || t.id === dropId)); });
          dockFocus = "";
          paintDockTabs();
        }
        closeSheet();
        sheetHold = true;
        return;
      }""",
    "sheet-x-mute",
)

# hide JOBS on X also mutes
must_replace(
    """      if (act === "hide") closeJobs();""",
    """      if (act === "hide") {
        try { sessionStorage.setItem("sn:jobs-muted", "1"); } catch (e) {}
        closeJobs();
      }""",
    "jobs-hide-mute",
)

# Power-on: do NOT auto-open JOBS; respect muted offers
must_replace(
    """        if (on) {
          say("Offers live. Jobs and nearby work can pop.");
          materialize(true);
          if (jobs.length) {
            jobs.slice(0, 6).forEach(function (j) { throwOffer(j); });
            openJobs();
            var tasks = $("sn-tasks");
            if (tasks) tasks.classList.remove("min");
          } else {
            throwOffer({ id: "live", name: "OFFERS", note: "Offers are live. Hunt a pin or wait for work." });
          }
        } else {""",
    """        if (on) {
          say("Offers live. Jobs and nearby work can pop.");
          materialize(true);
          var jobsMuted = false;
          try { jobsMuted = sessionStorage.getItem("sn:jobs-muted") === "1"; } catch (e) {}
          if (jobs.length) {
            jobs.slice(0, 6).forEach(function (j) { throwOffer(j); });
            /* muted X / closed JOBS stay closed across Power cycle */
            if (!jobsMuted) {
              /* do not auto-open JOBS — user opens when they want */
            }
            closeJobs();
          } else {
            var liveId = "offer-live";
            try {
              if (sessionStorage.getItem("sn:offer-x:" + liveId)) { /* stay quiet */ }
              else throwOffer({ id: "live", name: "OFFERS", note: "Offers are live. Hunt a pin or wait for work." });
            } catch (e) {
              throwOffer({ id: "live", name: "OFFERS", note: "Offers are live. Hunt a pin or wait for work." });
            }
          }
        } else {""",
    "power-no-jobs-popup",
)

# Support BUILD bar: APPLY left, X right
must_replace(
    """'<div class="sheet-bar"><button type="button" class="sheet-x" data-act="support-close" aria-label="Close">✕</button><b class="sheet-ttl">BUILD</b><button type="button" class="sheet-apply" data-act="support-send" aria-label="Apply">✓</button></div>'""",
    """'<div class="sheet-bar"><button type="button" class="sheet-apply" data-act="support-send" aria-label="Apply">✓</button><b class="sheet-ttl">BUILD</b><button type="button" class="sheet-x" data-act="support-close" aria-label="Close">✕</button></div>'""",
    "support-bar-swap",
)

# Hide stage steps on offer-ish charged lines (vendor menu charged / nextStep on offer)
must_replace(
    """      return '<div class="sn-ord"><b>' + esc(j.fee || 0) + " AV€</b><span>" + esc(items || "order") + "</span><em>" + esc(nextStep(j)) + "</em><em>" + esc(orderClock(j)) + "</em></div>";""",
    """      return '<div class="sn-ord"><b>' + esc(j.fee || 0) + " AV€</b><span>" + esc(items || "order") + "</span><em>" + esc(orderClock(j)) + "</em></div>";""",
    "charged-no-stages",
)

# behalf: keep for admin JOBS but not inject into offer card — already separate.
# Soften openRoadTile nextStep line if present on offer path
must_replace(
    """      (job ? '<p class="note">' + esc(nextStep(job)) + (orderClock(job) ? " · " + orderClock(job) : "") + "</p>" : "") +""",
    """      (job ? '<p class="note">' + esc(orderClock(job) || "") + "</p>" : "") +""",
    "road-no-stages",
)

app_path.write_text(s, encoding="utf-8")
print("wrote", app_path, "bytes", len(s))

# index.html JOBS bar: APPLY left, X right
if idx_path.exists():
    idx = idx_path.read_text(encoding="utf-8")
    old = '<div class="sheet-bar"><button type="button" class="sheet-x" data-act="hide" aria-label="Close">✕</button><b class="sheet-ttl">JOBS</b><button type="button" class="sheet-apply" data-act="hide" aria-label="Apply">✓</button></div>'
    new = '<div class="sheet-bar"><button type="button" class="sheet-apply" data-act="hide" aria-label="Apply">✓</button><b class="sheet-ttl">JOBS</b><button type="button" class="sheet-x" data-act="hide" aria-label="Close">✕</button></div>'
    if old in idx:
        idx = idx.replace(old, new, 1)
        idx_path.write_text(idx, encoding="utf-8")
        print("ok jobs-bar-swap")
    elif new in idx:
        print("skip jobs-bar-swap")
    else:
        print("warn jobs-bar missing")

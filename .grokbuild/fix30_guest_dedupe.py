#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""4329: guest Apply reuses open same shop+items+drop order; no duplicate local JOBS."""
from pathlib import Path

app_path = Path("js/spacenet/app.js")
if not app_path.exists():
    raise SystemExit("missing js/spacenet/app.js")
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


HELPER = r'''
  function linesKey(lines) {
    return (lines || []).map(function (l) {
      return String(l && l.name || "") + "|" + String(l && l.n || 0) + "|" + String(l && l.price || "");
    }).slice().sort().join(";");
  }
  function sameDrop(a, b) {
    if (!a || !b || !isFinite(+a.lat) || !isFinite(+b.lat)) return false;
    return haversineKm(a, b) < 0.08;
  }
  function sameVendorRef(a, b) {
    if (!a || !b) return false;
    if (a.id && b.id && String(a.id) === String(b.id)) return true;
    return !!(a.name && b.name && String(a.name).toLowerCase() === String(b.name).toLowerCase());
  }
  function findOpenTwin(vendor, lines, dest) {
    var key = linesKey(lines);
    var who = me();
    var guest = !authToken();
    var i, j;
    for (i = 0; i < jobs.length; i++) {
      j = jobs[i];
      if (!j || j.received || j.cancelled || j.vendorGone) continue;
      if (j.vendorAccepted || j.driverAccepted || j.ready || j.got || j.delivered) continue;
      if (!sameVendorRef(j.vendor, vendor)) continue;
      if (linesKey(j.lines) !== key) continue;
      if (!sameDrop(j.drop, dest)) continue;
      if (guest) {
        if (j.client && who && String(j.client) !== String(who) && String(j.client) !== "guest") continue;
      } else if (j.client && who && String(j.client) !== String(who)) continue;
      return j;
    }
    return null;
  }
'''

if "function findOpenTwin(" not in s:
    needle = "  function checkoutVendor() {"
    if needle not in s:
        raise SystemExit("missing checkoutVendor")
    s = s.replace(needle, HELPER + "\n" + needle, 1)
    print("ok twin-helpers")
else:
    print("skip twin-helpers")

must_replace(
    """    var q = quoteDelivery(vendor, dest, quoteOpts);
    var job = {
      id: "j" + Date.now().toString(36),
      vendor: vendor,
      drop: { lat: +dest.lat, lng: +dest.lng, name: dest.name || "Client", phone: dest.phone || "", address: dest.address || "", floor: dest.floor || "", bell: dest.bell || "" },
      lines: lines,
      food: Math.round(food * 100) / 100,
      km: q.km,
      fee: Math.round((q.total + food) * 100) / 100,
      prep: 0,
      stage: "vendor",
      ready: false, pickup: false, got: false, delivered: false, received: false,
      vendorAccepted: false, driverAccepted: false, verified: false,
      driver: "", driverId: "",
      client: (dest && dest.owner) || me(),
      vendorOwner: vendor.owner || "",
      t: Date.now()
    };
    jobs.unshift(job);
    saveJobs();
    publishJob(job);
    say("Sent to " + (vendor.name || "the vendor") + ".");
    openVendorOrder(job);
  }""",
    """    var q = quoteDelivery(vendor, dest, quoteOpts);
    var foodN = Math.round(food * 100) / 100;
    var feeN = Math.round((q.total + food) * 100) / 100;
    var dropPt = { lat: +dest.lat, lng: +dest.lng, name: dest.name || "Client", phone: dest.phone || "", address: dest.address || "", floor: dest.floor || "", bell: dest.bell || "" };
    var twin = findOpenTwin(vendor, lines, dropPt);
    if (twin) {
      twin.vendor = vendor;
      twin.drop = dropPt;
      twin.lines = lines;
      twin.food = foodN;
      twin.km = q.km;
      twin.fee = feeN;
      twin.t = Date.now();
      twin.client = (dest && dest.owner) || twin.client || me();
      twin.vendorOwner = vendor.owner || twin.vendorOwner || "";
      saveJobs();
      publishJob(twin);
      say("Updated order for " + (vendor.name || "the vendor") + ".");
      openVendorOrder(twin);
      return;
    }
    var job = {
      id: "j" + Date.now().toString(36),
      vendor: vendor,
      drop: dropPt,
      lines: lines,
      food: foodN,
      km: q.km,
      fee: feeN,
      prep: 0,
      stage: "vendor",
      ready: false, pickup: false, got: false, delivered: false, received: false,
      vendorAccepted: false, driverAccepted: false, verified: false,
      driver: "", driverId: "",
      client: (dest && dest.owner) || me(),
      vendorOwner: vendor.owner || "",
      t: Date.now()
    };
    jobs.unshift(job);
    saveJobs();
    publishJob(job);
    say("Sent to " + (vendor.name || "the vendor") + ".");
    openVendorOrder(job);
  }""",
    "checkout-dedupe",
)

# bump VER placeholder if still 4328 — stamp script owns final 4329
if 'var VER = "4328"' in s and 'var VER = "4329"' not in s:
    s = s.replace('var VER = "4328"', 'var VER = "4329"', 1)
    print("ok VER bump in fix")

app_path.write_text(s, encoding="utf-8")
print("wrote", app_path, "bytes", len(s))

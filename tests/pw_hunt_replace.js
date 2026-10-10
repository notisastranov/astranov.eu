/**
 * Headless query-replace test (1280x800).
 *   'supermarket in Rhodes' → then 'pizza in Rhodes':
 *     shown pins are pizza-only (name / cuisine / menu), FIND == pins, LIVE counts the pins,
 *     no supermarket pin left, Pizzagio + Gondola Pizza present, tiles fill the map box.
 *   Pizzagio sheet: address + photo (or honest placeholder).
 *   'pizza in Athens Greece': no pin farther than 50 km from Athens (no Rhodes/Nairobi leak).
 *   'supermarket in Rhodes' again: FIND rebuilt from scratch (market-only).
 *   'pizza in Athens Greece' lands on the city view (cityOn) centred within 0.2° of Athens, and stays there.
 *   Every FIND row has a drawn pin inside the visible map (after the hunt's fitBounds), not under the sheet.
 *   Guest wallet reads '0 AV€ · guest'; Augoustinos twins show as one pin.
 * Env: PREVIEW_URL / STAMP; optional LOCAL_APP (patched app.js routed in), LOCAL_FIND (api/find.js
 * served for reverse=1), OVERPASS_FAIL=1 (abort overpass with connectionclosed → expect 1 request).
 * 4339: boot LIVE = real public network count (explicit status live, no fixtures) while only an IP guess exists;
 *   LATEST == /api/version; TESTER ticker hidden for guests (also with ?testview=1); bare 'supermarket' with only an
 *   IP guess never hunts the IP spot (asks where, FIND sheet cleared); 'pizza in Athens Greece' time-to-land <= LAND_MAX;
 *   bare 'supermarket' after Athens hunts Athens (>= 9 real pins, no stale 'Athens Greece' text); sheet grip drags
 *   (resizes <= 42vh, >= 96px, clear of LIVE, hidden with no sheet); session-shape check (stored sn:user shape only, no
 *   token, all writes blocked): YOU + aria-label + header name survive reload and SPACENET reset.
 * 4341: an IP-only boot (no input) lands on the IP city view (z10-12.5, labelled approximate, seat kind 'ip') within 5 s and
 *   a bare hunt there still asks where; LIVE never shows two different counts on load; grip = full-width 28 px strip.
 * 4345: the guest's weather case: a fresh load (IP guess), GPS 41.5812424,-87.8549755 granted, the GPS button, a 'pharmacy'
 *   hunt: every open-meteo request is counted on the CDP network (Network.requestWillBeSent): at most 1, 0.5 deg rounded.
 * Exit 2 on any FAIL.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE = process.env.PREVIEW_URL || "https://astranov-git-grokbuild-4328-street-level-gps-astranov.vercel.app/";
const URL0 = BASE + (BASE.indexOf("?") >= 0 ? "&" : "?") + "v=" + (process.env.STAMP || "4356") + "&t=" + Date.now();
const PIZZA = /pizz|πιτσ|πίτσ|margherita|calzone/i;
const MARKET = /market|super|grocer|convenience|παντοπωλ|σούπερ|σουπερ|μάρκετ|μαρκετ/i;
const RHODES = { lat: 36.4349, lng: 28.2176 };
const ATHENS = { lat: 37.9838, lng: 23.7275 };
const fails = [];
const SHOTS = process.env.SHOTDIR || "/tmp/sn-pw";
fs.mkdirSync(SHOTS, { recursive: true });
function check(ok, label, extra) {
  console.log((ok ? "PASS " : "FAIL ") + label + (extra ? "  " + extra : ""));
  if (!ok) fails.push(label);
}
function km(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function field(page) {
  return page.evaluate(() => {
    const map = window.SN && SN.getMap && SN.getMap();
    const pins = [];
    if (map) map.eachLayer((ly) => {
      if (!ly || !ly.__snShop) return;
      const ll = ly.getLatLng();
      const el = ly.getElement ? ly.getElement() : ly._path;
      const tip = ly.getTooltip && ly.getTooltip();
      pins.push({ id: String(ly.__snId), lat: ll.lat, lng: ll.lng, inDom: !!(el && document.contains(el)), tip: tip ? String(tip.getContent()) : "" });
    });
    const domPins = document.querySelectorAll("#city .sn-shop-pin").length;
    const cityEl = document.getElementById("city");
    const cr = cityEl ? cityEl.getBoundingClientRect() : null;
    const sh = document.getElementById("sn-sheet-card");
    const shr = sh && getComputedStyle(sh).display !== "none" && sh.offsetParent !== null ? sh.getBoundingClientRect() : null;
    const sheetTop = shr && shr.height > 20 ? shr.top : (cr ? cr.bottom : 0);
    pins.forEach((p) => {
      try {
        const pt = map.latLngToContainerPoint([p.lat, p.lng]);
        const x = cr.left + pt.x, y = cr.top + pt.y;
        p.vis = !!(cr && x >= cr.left && x <= cr.right && y >= cr.top && y <= Math.min(cr.bottom, sheetTop));
      } catch (e) { p.vis = false; }
    });
    let center = null, zoom = null;
    try { const c = map.getCenter(); center = { lat: c.lat, lng: c.lng }; zoom = map.getZoom(); } catch (e) {}
    const cam = SN.getCam ? SN.getCam() : null;
    const title = ((document.getElementById("sn-sheet-card") || {}).textContent || "").match(/FIND\s*·\s*(\d+|…)/);
    const shown = (window.__snFindShown || []).map((s) => {
      const menu = Array.isArray(s.menu) ? s.menu.map((m) => (m && m.name) || "").join(" ") : "";
      return { id: String(s.id || s.name), name: s.name, aka: s.aka || "", lat: +s.lat, lng: +s.lng, blob: [s.name, s.aka, s.kind, s.cuisine, menu, s.menuText].join(" ") };
    });
    const live = ((document.getElementById("sn-pulse") || {}).textContent || "");
    const liveN = (live.match(/LIVE · (\d+) (?:place|vendor)/) || [])[1];
    const city = document.getElementById("city");
    let size = null, box = null, tiles = 0, loaded = 0;
    try { const s = map.getSize(); size = { w: s.x, h: s.y }; } catch (e) {}
    if (city) {
      box = { w: city.clientWidth, h: city.clientHeight };
      city.querySelectorAll("img.leaflet-tile").forEach((im) => { tiles++; if (im.complete && im.naturalWidth > 0) loaded++; });
    }
    return { pins, domPins, center, zoom, cam, cityOn: !!(cityEl && cityEl.classList.contains("on") && cam && cam.cityOn !== false), find: title ? title[1] : null, shown, live, liveN: liveN == null ? null : +liveN, size, box, tiles, loaded,
      line: (document.getElementById("line") || {}).textContent || "", hunt: SN.huntState ? SN.huntState() : null };
  });
}
async function ask(page, text) {
  await page.fill("#in", text);
  await page.press("#in", "Enter");
}
async function settle(page, label, maxMs) {
  const t0 = Date.now();
  let last = "", stableFrom = Date.now(), f = null;
  while (Date.now() - t0 < (maxMs || 30000)) {
    await sleep(700);
    f = await field(page);
    const sig = f.find + "|" + f.pins.map((p) => p.id).sort().join(",") + "|" + f.liveN;
    if (sig !== last) { last = sig; stableFrom = Date.now(); }
    if (f.find && f.find !== "…" && Date.now() - stableFrom > 5000) break;
  }
  console.log("[" + label + "] FIND", f.find, "pins", f.pins.length, "LIVE", f.liveN, "line:", f.line.slice(0, 90));
  console.log("   shown:", f.shown.map((s) => s.name + (s.aka ? " (aka " + s.aka + ")" : "")).join(" | "));
  return f;
}
function sameSet(f) {
  const a = f.pins.map((p) => p.id).sort().join("|");
  const b = f.shown.map((s) => s.id).sort().join("|");
  return a === b;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  /* 4350: Overpass goes through POST /api/find {op:"overpass"}; a request straight to an Overpass server is counted apart (must be 0) */
  let overpassHits = 0, overpassAfterFail = 0, overpassFailAt = 0, overpassDirect = 0; const consoleErr = [];
  const isOp = (r) => /\/api\/find/.test(r.url()) && r.method() === "POST" && /"op":"overpass"/.test(r.postData() || "");
  page.on("request", (r) => {
    if (/overpass-api\.de|overpass\.kumi|\/api\/interpreter/.test(r.url())) overpassDirect++;
    if (!isOp(r)) return;
    overpassHits++;
    if (overpassFailAt && Date.now() - overpassFailAt > 100) overpassAfterFail++;
  });
  page.on("requestfailed", (r) => { if (isOp(r) && !overpassFailAt) overpassFailAt = Date.now(); });
  page.on("console", (m) => { if (m.type() === "error" && /overpass|CORS|Access-Control/i.test(m.text())) consoleErr.push(m.text().slice(0, 160)); });
  async function routeLocal(pg) {
    if (process.env.LOCAL_APP) {
      const body = fs.readFileSync(process.env.LOCAL_APP);
      await pg.route(/\/js\/spacenet\/app\.js/, (route) => route.fulfill({ status: 200, contentType: "application/javascript", body }));
    }
    if (process.env.LOCAL_AUTH) {
      const body = fs.readFileSync(process.env.LOCAL_AUTH);
      await pg.route(/\/js\/spacenet\/auth\.js/, (route) => route.fulfill({ status: 200, contentType: "application/javascript", body }));
    }
  }
  await routeLocal(page);
  /* 4350: with LOCAL_APP the live preview's /api/find has no Overpass proxy yet: POST {op:"overpass"} answered by this tree's api/find.js */
  if (process.env.LOCAL_APP) { const fh = require(path.join(__dirname, "..", "api", "find.js"));
    await page.route(/\/api\/find(\?|$)/, async (r) => { const q = r.request(); let b = null; try { b = q.method() === "POST" ? JSON.parse(q.postData() || "{}") : null; } catch (e) { b = null; }
      if (!b || b.op !== "overpass") return r.fallback(); let st = 200, js = null; const rs = { setHeader() {}, status(s) { st = s; return rs; }, json(j) { js = j; return rs; }, end() { return rs; } };
      await fh({ method: "POST", body: b, headers: {} }, rs); return r.fulfill({ status: st, contentType: "application/json", body: JSON.stringify(js) }); }); }
  await page.addInitScript(() => {
    window.__liveSeq = []; let last = null;
    setInterval(() => { const e = document.getElementById("sn-pulse"); const t = e ? e.textContent : ""; if (t !== last) { last = t; window.__liveSeq.push([Math.round(performance.now()), t]); } }, 50);
  });
  if (process.env.LOCAL_FIND) {
    const handler = require(path.resolve(process.env.LOCAL_FIND));
    await page.route(/\/api\/find\?.*reverse=1/, async (route) => {
      const u = new URL(route.request().url());
      const query = Object.fromEntries(u.searchParams.entries());
      let status = 200, json = null;
      const res = { setHeader() {}, status(s) { status = s; return res; }, json(j) { json = j; return res; }, end() { return res; } };
      await handler({ method: "GET", query, headers: {} }, res);
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(json) });
    });
  }
  if (process.env.OVERPASS_FAIL) await page.route(/\/api\/find/, (route) => (isOp(route.request()) ? route.abort("connectionclosed") : route.fallback()));
  page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));
  if (process.env.SHOW_CONSOLE) page.on("console", (m) => { const t = m.text(); if (/^sn:/.test(t)) console.log("[console]", t.slice(0, 600)); });
  page.on("framenavigated", (fr) => { if (fr === page.mainFrame()) console.log("[nav]", fr.url().slice(0, 140)); });

  console.log("goto", URL0);
  await page.addInitScript(() => { setInterval(() => { const c = document.getElementById("city"); if (window.__cityOnAt == null && c && c.classList.contains("on") && getComputedStyle(c).opacity === "1") window.__cityOnAt = Math.round(performance.now()); }, 25); });
  const tLoad = Date.now();
  await page.goto(URL0, { waitUntil: "domcontentloaded", timeout: 90000 });
  await sleep(4500);
  const wallet = await page.evaluate(() => ((document.querySelector("#sn-money .tgt") || {}).textContent || "").trim());
  check(wallet === "0 AV€ · guest", "guest wallet reads '0 AV€ · guest'", JSON.stringify(wallet));

  // ---- 4339 boot: LIVE network count, LATEST, TESTER ----
  await sleep(2500);
  const boot = await page.evaluate(async () => {
    const lj = await (await fetch("/api/live", { cache: "no-store" })).json();
    const vj = await (await fetch("/api/version?t=" + Date.now(), { cache: "no-store" })).json();
    const fx = (s) => /\bTESTER\b|test\s*vendor|\bV?4297\b|tester\s*client/i.test([s.name, s.title, s.note, s.id, s.owner].join(" "));
    const seen = {}; let n = 0;
    (lj.shops || []).forEach((s) => { if (s && s.id && isFinite(+s.lat) && s.status === "live" && !fx(s) && !seen[s.id]) { seen[s.id] = 1; n++; } });
    const t = document.getElementById("sn-tester");
    return { live: (document.getElementById("sn-pulse") || {}).textContent || "", expect: n, latest: (document.getElementById("sn-latest") || {}).textContent || "",
      api: vj.latest, ver: (document.getElementById("ver") || {}).textContent || "", tester: !!(t && getComputedStyle(t).display !== "none" && t.offsetParent !== null && t.textContent.trim()), here: window.__SN_HERE };
  });
  console.log("[boot]", JSON.stringify(boot));
  check(new RegExp("^LIVE · " + boot.expect + " vendors? on SpaceNet ·").test(boot.live) && boot.expect > 0, "boot LIVE counts the real public network (" + boot.expect + " listed, no fixtures)", boot.live);
  check(new RegExp("^LATEST " + boot.api + "( (UPDATED|CHECKING|UPDATING|FAILED TO UPDATE|PLEASE TRY TO UPDATE MANUALLY))?$").test(boot.latest) && /^\d{4,}$/.test(String(boot.api)), "LATEST shows /api/version (" + boot.api + ", with main 4332's update state)", boot.latest);
  if (!process.env.LOCAL_APP) check(String(boot.api) === String(process.env.STAMP || "4356") && boot.ver === "V" + (process.env.STAMP || "4355"), "running build == LATEST == STAMP", boot.ver + " / " + boot.api);
  check(!boot.tester, "TESTER ticker hidden for a guest");
  await page.screenshot({ path: path.join(SHOTS, "boot.png") });

  // ---- 4340: IP-only boot lands on the IP city view (camera only) ----
  if (boot.here && /IP/.test(boot.here.name || "")) {
    let ipv = null;
    while (Date.now() - tLoad < 26000) {
      ipv = await page.evaluate(() => { const m = SN.getMap(); const c = m && m.getCenter(); const city = document.getElementById("city"); const ss = SN.seatState ? SN.seatState() : {};
        return { on: city.classList.contains("on") && getComputedStyle(city).opacity === "1", c: c && { lat: c.lat, lng: c.lng }, z: m && m.getZoom(), kind: ss.kind, here: ss.here, line: document.getElementById("line").textContent, live: (document.getElementById("sn-pulse") || {}).textContent }; });
      if (ipv.on && ipv.kind === "ip") break;
      await sleep(250);
    }
    const ipAt = ((await page.evaluate(() => window.__cityOnAt)) || (Date.now() - tLoad)) / 1000; /* 4341: from navigation start */
    console.log("[ip view]", ipAt.toFixed(1) + " s", JSON.stringify(ipv));
    check(!!(ipv && ipv.on && ipv.kind === "ip" && ipAt <= 5 && ipv.here && km(ipv.c, ipv.here) < 3 && ipv.z >= 10 && ipv.z <= 12.5 && /Approximate location \(IP\)/.test(ipv.line)),
      "IP-only boot auto-zooms to the IP city view (camera only, labelled approximate) within 5 s", ipAt.toFixed(1) + " s z" + (ipv && ipv.z));
    await sleep(1200);
    await page.screenshot({ path: path.join(SHOTS, "boot-ip-city.png") });
    const seq = await page.evaluate(() => window.__liveSeq || []);
    const counts = [...new Set(seq.map((x) => (x[1].match(/LIVE · (\d+) (?:place|vendor)/) || [])[1]).filter(Boolean))];
    console.log("   LIVE sequence:", JSON.stringify(seq.map((x) => x[0] + ":" + x[1])));
    check(counts.length === 1, "LIVE shows one final count on load (loading first, no jump)", JSON.stringify(counts));
  }
  // bare hunt with only an IP guess: never hunts the IP spot
  if (boot.here && /IP/.test(boot.here.name || "")) {
    await ask(page, "supermarket");
    let ipS = null; const tI = Date.now();
    while (Date.now() - tI < 15000) { await sleep(500); ipS = await field(page); ipS.sheetOn = await page.evaluate(() => document.getElementById("sn-sheet").classList.contains("on")); if (/Where\?|Name a place/.test(ipS.line) && !ipS.sheetOn) break; }
    check(/Where\?|Name a place/.test(ipS.line) && ipS.pins.length === 0 && !ipS.sheetOn, "bare 'supermarket' on an IP guess asks where (no IP hunt, FIND cleared)", JSON.stringify({ line: ipS.line, pins: ipS.pins.length, sheetOn: ipS.sheetOn, live: ipS.live }));
  }

  await ask(page, "supermarket in Rhodes");
  const f1 = await settle(page, "supermarket in Rhodes", 30000);
  check(f1.pins.length > 0 && f1.shown.every((s) => MARKET.test(s.blob)), "supermarket FIND is market-only", f1.shown.length + " shown");
  check(sameSet(f1), "supermarket FIND == pins");
  const hid1 = f1.pins.filter((p) => !p.vis);
  check(!hid1.length, "every supermarket pin is visible in the map view", hid1.map((p) => p.tip).join(", "));

  await ask(page, "pizza in Rhodes");
  const f2 = await settle(page, "pizza in Rhodes", 35000);
  check(f2.pins.length > 0, "pizza pins shown", String(f2.pins.length));
  const notPizza = f2.shown.filter((s) => !PIZZA.test(s.blob));
  check(!notPizza.length, "shown pins are pizza-only (name/cuisine/menu)", notPizza.map((s) => s.name).join(", "));
  check(sameSet(f2), "FIND == pins (ids)", f2.pins.length + " pins vs " + f2.shown.length + " FIND");
  check(String(f2.pins.length) === String(f2.find), "FIND title count == pins", f2.find + " vs " + f2.pins.length);
  check(f2.liveN === f2.pins.length, "LIVE counts what is shown", f2.live);
  const hid2 = f2.pins.filter((p) => !p.vis);
  check(!hid2.length, "every pizza pin is visible in the map view (fitBounds, above the sheet)", hid2.map((p) => p.tip).join(", "));
  check(f2.pins.every((p) => p.inDom), "every pin layer is in the DOM");
  check(f2.shown.every((s) => !MARKET.test(s.name) || PIZZA.test(s.blob)), "no supermarket pin left");
  check(f2.shown.some((s) => /pizzagio/i.test(s.name)) && f2.shown.some((s) => /gondola/i.test(s.name)), "Pizzagio and Gondola Pizza in FIND");
  check(f2.pins.every((p) => km(p, RHODES) < 50), "all pins within 50 km of Rhodes");
  check(f2.size && f2.box && Math.abs(f2.size.w - f2.box.w) <= 1 && Math.abs(f2.size.h - f2.box.h) <= 1 && f2.loaded >= 6,
    "map size == city box, tiles loaded (no grey edges)", JSON.stringify({ size: f2.size, box: f2.box, tiles: f2.tiles, loaded: f2.loaded }));

  // vendor sheet: Pizzagio address + photo
  const opened = await page.evaluate(() => {
    const pills = Array.from(document.querySelectorAll("#sn-sheet-body .pill"));
    const p = pills.find((x) => /pizzagio/i.test(x.textContent));
    if (!p) return false;
    p.click();
    return true;
  });
  await sleep(2500);
  const sheet = await page.evaluate(() => {
    const prof = document.querySelector("#sn-sheet .sn-prof");
    const img = prof && prof.querySelector("img.sn-shop-hero");
    return { text: prof ? prof.textContent : "", img: img ? { src: img.src, ok: img.complete && img.naturalWidth > 0 } : null, placeholder: !!(prof && prof.querySelector("em")) };
  });
  check(opened && /Chatziaggelou 32/.test(sheet.text), "Pizzagio sheet shows its address", sheet.text.slice(0, 120));
  check(!!((sheet.img && sheet.img.ok) || sheet.placeholder), "Pizzagio sheet shows a photo (or honest placeholder)", JSON.stringify(sheet.img));
  console.log("   pizzagio photo:", JSON.stringify(sheet.img), "placeholder:", sheet.placeholder);
  await page.evaluate(() => { const x = document.querySelector("#sn-sheet [data-act='close'], #sn-sheet .x, #sn-sheet-x"); if (x) x.click(); });

  await ask(page, "pizza in Athens Greece");
  const tA0 = Date.now(); let landMs = null;
  while (Date.now() - tA0 < 20000) {
    const fl = await field(page);
    if (fl.cityOn && fl.center && Math.abs(fl.center.lat - ATHENS.lat) <= 0.3 && Math.abs(fl.center.lng - ATHENS.lng) <= 0.3) { landMs = Date.now() - tA0; break; }
    await sleep(100);
  }
  check(landMs != null && landMs <= 1000 * Number(process.env.LAND_MAX || 8), "Athens time-to-land <= " + (process.env.LAND_MAX || 8) + " s", String(landMs) + " ms");
  const f3 = await settle(page, "pizza in Athens Greece", 35000);
  const far = f3.pins.filter((p) => km(p, ATHENS) > 50);
  check(!far.length, "Athens: no pin farther than 50 km (no Rhodes/Nairobi leak)", far.map((p) => p.tip).join(", "));
  check(!f3.shown.some((s) => /ugoustinos|vgoustinos/i.test(s.name)), "Athens: no Augoustinos in FIND");
  check(sameSet(f3), "Athens FIND == pins");
  check(f3.shown.every((s) => PIZZA.test(s.blob)), "Athens FIND pizza-only");
  check(f3.cityOn, "Athens: lands on the city view (cityOn)", JSON.stringify({ cam: f3.cam, zoom: f3.zoom }));
  check(f3.center && Math.abs(f3.center.lat - ATHENS.lat) <= 0.2 && Math.abs(f3.center.lng - ATHENS.lng) <= 0.2,
    "Athens: map centre within 0.2° of Athens", JSON.stringify(f3.center) + " z" + f3.zoom);
  await sleep(6000);
  const f3b = await field(page);
  check(f3b.cityOn && f3b.center && Math.abs(f3b.center.lat - ATHENS.lat) <= 0.2 && Math.abs(f3b.center.lng - ATHENS.lng) <= 0.2,
    "Athens: still on the city 6 s later (no late fly-away)", JSON.stringify({ c: f3b.center, cityOn: f3b.cityOn }));
  const hid3 = f3.pins.filter((p) => !p.vis);
  check(!hid3.length, "Athens: every pin visible in the map view", hid3.map((p) => p.tip).join(", "));
  const stray = await page.evaluate(() => Array.from(document.querySelectorAll("#city .sn-shop-pin")).map((e) => e.textContent).filter((t) => /ugoustinos|Nairobi/i.test(t)));
  check(!stray.length, "Athens: no stray Rhodes/Nairobi pin element in the DOM", stray.join(","));
  await page.screenshot({ path: path.join(SHOTS, "athens-pizza.png") });

  // ---- 4339: bare follow-up hunts the landed place, never the stale text ----
  await ask(page, "supermarket");
  await sleep(250);
  const lineNow = await page.evaluate(() => (document.getElementById("line") || {}).textContent || "");
  const tS0 = Date.now();
  const f5 = await settle(page, "supermarket (after Athens)", 35000);
  const f5far = f5.pins.filter((p) => km(p, ATHENS) > 50);
  console.log("   follow-up line at submit:", JSON.stringify(lineNow), "settled after", Date.now() - tS0, "ms");
  check(!/Greece/i.test(lineNow) && !/Greece/i.test(f5.line), "follow-up does not carry the stale 'Athens Greece' text", JSON.stringify(lineNow));
  check(f5.pins.length >= 9, "Athens → 'supermarket': >= 9 real pins", f5.pins.length + " pins");
  check(!f5far.length, "follow-up pins all within 50 km of Athens", f5far.map((p) => p.tip).join(", "));
  check(sameSet(f5) && f5.shown.every((s) => MARKET.test(s.blob)), "follow-up FIND == pins, market-only", f5.shown.filter((s) => !MARKET.test(s.blob)).map((s) => s.name).join(", "));
  check(f5.center && km(f5.center, ATHENS) < 30, "follow-up stays on Athens", JSON.stringify(f5.center));
  await page.screenshot({ path: path.join(SHOTS, "athens-supermarket.png") });

  // ---- 4339: sheet grip drags ----
  const gr = () => page.evaluate(() => {
    const g = document.getElementById("cli-drag"), c = document.getElementById("sn-sheet-card"), p = document.getElementById("sn-pulse");
    const vis = (e) => e && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().height > 0;
    const b = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    return { grip: vis(g) ? b(g) : null, card: vis(c) ? b(c) : null, pulse: vis(p) ? b(p) : null, ih: innerHeight };
  });
  const ov = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const g0 = await gr();
  check(!!(g0.grip && g0.card) && g0.grip.y < g0.card.y && g0.grip.y + g0.grip.h >= g0.card.y && g0.grip.h >= 24 && g0.grip.w >= g0.card.w - 2 && !ov(g0.grip, g0.pulse), "grip rides the sheet top, clear of LIVE", JSON.stringify(g0));
  if (g0.grip) {
    const gx = g0.grip.x + g0.grip.w / 2, gy = g0.grip.y + g0.grip.h / 2;
    await page.mouse.move(gx, gy); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(gx, gy + 20 * i); await sleep(16); }
    await page.mouse.up(); await sleep(800); /* 4342: let the .34 s spring settle */
    const g1 = await gr();
    await page.mouse.move(g1.grip.x + g1.grip.w / 2, g1.grip.y + g1.grip.h / 2); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(g1.grip.x + g1.grip.w / 2, g1.grip.y + g1.grip.h / 2 - 50 * i); await sleep(16); }
    await page.mouse.up(); await sleep(800); /* 4342: let the .34 s spring settle */
    const g2 = await gr();
    const cap = await page.evaluate(() => window.__snGrip.cap()), rest = await page.evaluate(() => window.__snGrip.rest());
    console.log("   grip heights", g0.card.h, "→ down", g1.card.h, "→ up", g2.card.h, "rest", rest, "cap", cap);
    check(g0.card.h <= cap - 20, "sheet rests below the 42 % cap (room to grow)", g0.card.h + " vs cap " + cap);
    check(Math.abs(g1.card.h - Math.min(rest, g0.card.h)) <= 2, "drag down from rest springs back to rest (never parks below)", g0.card.h + " → " + g1.card.h + " (rest " + rest + ")");
    check(g2.card.h > g1.card.h + 20, "drag up grows the sheet", g1.card.h + " → " + g2.card.h);
    check(g2.card.h <= cap + 1, "dragged sheet never taller than the 42 % cap", g2.card.h + " ≤ " + cap);
    check(!ov(g2.grip, g2.pulse) && g2.grip.y < g2.card.y && g2.grip.y + g2.grip.h >= g2.card.y && g2.grip.h >= 24 && g2.grip.w >= g2.card.w - 2, "grip follows the sheet, still clear of LIVE", JSON.stringify(g2));
    await page.screenshot({ path: path.join(SHOTS, "grip-dragged.png") });
  }

  await ask(page, "supermarket in Rhodes");
  const f4 = await settle(page, "supermarket in Rhodes (again)", 35000);
  check(f4.shown.length > 0 && f4.shown.every((s) => MARKET.test(s.blob)) && !f4.shown.some((s) => /pizzagio|gondola/i.test(s.name)), "FIND rebuilt for the new query");
  check(sameSet(f4), "FIND == pins after rebuild");

  // twins: plain Rhodes field shows one Augoustinos
  await page.evaluate((p) => { SN.seatPlace({ lat: p.lat, lng: p.lng, name: "Rhodes" }); }, RHODES);
  await sleep(6000);
  const tw = await page.evaluate(() => SN.fieldShops().filter((s) => /ugoustinos|vgoustinos/i.test(s.name + " " + s.aka)));
  check(tw.length === 1, "Augoustinos twins merged into one pin", JSON.stringify(tw));

  // grip hidden with no sheet
  await page.evaluate(() => { const x = document.querySelector("#sn-sheet .sheet-x"); if (x) x.click(); });
  await sleep(900);
  const gOff = await page.evaluate(() => { const g = document.getElementById("cli-drag"); const sh = document.getElementById("sn-sheet"); return { on: sh.classList.contains("on"), grip: !!(g && getComputedStyle(g).display !== "none" && g.getBoundingClientRect().height > 0) }; });
  check(gOff.on || !gOff.grip, "grip hidden when no sheet is open", JSON.stringify(gOff));

  // ---- 4339 session shape (stored sn:user shape only; no token; every write blocked; nothing leaves the box) ----
  {
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
    const p2 = await ctx2.newPage();
    await routeLocal(p2);
    let writes = 0;
    await p2.route(/supabase\.co/, (r) => { writes++; return r.abort(); });
    await p2.route(/\/api\//, (r) => { if (r.request().method() !== "GET") { writes++; return r.abort(); } return r.continue(); });
    await p2.goto(URL0, { waitUntil: "domcontentloaded", timeout: 90000 });
    await sleep(2500);
    await p2.evaluate(() => { localStorage.setItem("sn:user", JSON.stringify({ id: "shape-check", email: "shape-check@example.invalid", name: "Shape Check", photo: "", phone: "", verified: false })); });
    await p2.reload({ waitUntil: "domcontentloaded" });
    await sleep(5500);
    const me1 = await p2.evaluate(() => { const b = document.getElementById("sn-me"); return { lbl: ((b && b.querySelector(".lbl")) || {}).textContent || "", aria: b && b.getAttribute("aria-label"), who: (document.getElementById("sn-who") || {}).textContent || "" }; });
    check(me1.lbl === "YOU" && /^YOU · Shape Check$/.test(me1.aria || "") && me1.who === "Shape", "stored session shape restores on reload (YOU, aria-label, header name)", JSON.stringify(me1));
    await p2.screenshot({ path: path.join(SHOTS, "session-shape.png") });
    await Promise.all([p2.waitForNavigation({ timeout: 15000 }).catch(() => null), p2.click("#sn-brand-s")]);
    await sleep(5500);
    const me2 = await p2.evaluate(() => { const b = document.getElementById("sn-me"); return { lbl: ((b && b.querySelector(".lbl")) || {}).textContent || "", aria: b && b.getAttribute("aria-label"), kept: !!localStorage.getItem("sn:user") }; });
    check(me2.kept && me2.lbl === "YOU", "SPACENET reset keeps the sign-in", JSON.stringify(me2));
    await p2.evaluate(() => { localStorage.removeItem("sn:user"); });
    console.log("   session-shape writes blocked:", writes);
    await ctx2.close();
  }
  // ---- TESTER hidden for a guest even with ?testview=1 ----
  {
    const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
    const p3 = await ctx3.newPage();
    await routeLocal(p3);
    await p3.goto(URL0 + "&testview=1", { waitUntil: "domcontentloaded", timeout: 90000 });
    await sleep(7000);
    const tv = await p3.evaluate(() => { const t = document.getElementById("sn-tester"); return { vis: !!(t && getComputedStyle(t).display !== "none" && t.offsetParent !== null && t.textContent.trim()), txt: t ? t.textContent : null, live: (document.getElementById("sn-pulse") || {}).textContent }; });
    check(!tv.vis && !/Test Vendor|V4297/.test(tv.live || ""), "guest with ?testview=1: TESTER ticker and fixtures stay hidden", JSON.stringify(tv));
    await ctx3.close();
  }

  // ---- 4345 WEATHER: the guest's fresh load (IP, GPS fix, GPS button, a hunt), every open-meteo request on the CDP network ----
  {
    const ctx4 = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block", geolocation: { latitude: 41.5812424, longitude: -87.8549755 } });
    const p4 = await ctx4.newPage();
    await routeLocal(p4);
    await p4.route(/\/api\/space/, (r) => (r.request().method() !== "GET" ? r.abort() : r.continue()));
    const net = await ctx4.newCDPSession(p4);
    await net.send("Network.enable");
    const wxReq = [];
    net.on("Network.requestWillBeSent", (e) => { if (/open-meteo\.com/.test(e.request.url)) wxReq.push({ url: e.request.url, type: e.type }); });
    await p4.goto(URL0, { waitUntil: "domcontentloaded", timeout: 90000 });
    await sleep(9000);
    await ctx4.grantPermissions(["geolocation"], { origin: new URL(BASE).origin });
    await p4.evaluate(() => { const b = document.getElementById("gps"); if (b) b.click(); });
    await sleep(5000);
    await p4.fill("#in", "pharmacy");
    await p4.press("#in", "Enter");
    await sleep(8000);
    const wxSt = await p4.evaluate(() => ({ label: (document.getElementById("sn-wx") || {}).textContent || "", kind: SN.seatState ? SN.seatState().kind : "", here: SN.seatState ? SN.seatState().here : null }));
    const rounded = wxReq.every((q) => { const u = new URL(q.url); return ["latitude", "longitude"].every((k) => { const v = Number(u.searchParams.get(k)); return isFinite(v) && Math.abs(v * 2 - Math.round(v * 2)) < 1e-9; }); });
    console.log("   [weather guest load]", JSON.stringify({ requests: wxReq, seat: wxSt }));
    check(wxReq.length <= 1 && rounded, "weather, the guest's fresh load (IP, GPS 41.5812424,-87.8549755, GPS button, 'pharmacy' hunt): <= 1 open-meteo request on the CDP network, 0.5 deg rounded", wxReq.length + " request(s) " + JSON.stringify(wxReq.map((q) => q.url.replace(/^.*\?/, ""))));
    check(/^(-?\d+°|DAY|NIGHT)$/.test(wxSt.label), "weather label is a temperature or DAY / NIGHT (silent failure)", JSON.stringify(wxSt.label));
    await ctx4.close();
  }

  console.log("overpass requests:", overpassHits, "after first failure:", overpassAfterFail, "state:", JSON.stringify(await page.evaluate(() => SN.overpassState && SN.overpassState())));
  check(overpassDirect === 0, "4350: no request goes straight to an Overpass server (Overpass only through /api/find, same origin)", overpassDirect + " direct, " + overpassHits + " through /api/find");
  check(consoleErr.length === 0, "4350: no Overpass / CORS error in the console", JSON.stringify(consoleErr.slice(0, 2)));
  if (process.env.OVERPASS_FAIL) check(overpassFailAt > 0 && overpassAfterFail === 0, "overpass backs off after the first connection failure", overpassHits + " total, " + overpassAfterFail + " after the first failure");

  await browser.close();
  console.log(fails.length ? "HUNT_REPLACE FAIL (" + fails.length + "): " + fails.join("; ") : "HUNT_REPLACE PASS");
  process.exit(fails.length ? 2 : 0);
})().catch((e) => { console.error("pw_fail", e); process.exit(1); });

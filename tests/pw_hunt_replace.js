/**
 * Headless query-replace test (1280x800).
 *   'supermarket in Rhodes' → then 'pizza in Rhodes':
 *     shown pins are pizza-only (name / cuisine / menu), FIND == pins, LIVE counts the pins,
 *     no supermarket pin left, Pizzagio + Gondola Pizza present, tiles fill the map box.
 *   Pizzagio sheet: address + photo (or honest placeholder).
 *   'pizza in Athens Greece': no pin farther than 50 km from Athens (no Rhodes/Nairobi leak).
 *   'supermarket in Rhodes' again: FIND rebuilt from scratch (market-only).
 *   Guest wallet reads '0 AV€ · guest'; Augoustinos twins show as one pin.
 * Env: PREVIEW_URL / STAMP; optional LOCAL_APP (patched app.js routed in), LOCAL_FIND (api/find.js
 * served for reverse=1), OVERPASS_FAIL=1 (abort overpass with connectionclosed → expect 1 request).
 * Exit 2 on any FAIL.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE = process.env.PREVIEW_URL || "https://astranov-git-grokbuild-4328-street-level-gps-astranov.vercel.app/";
const URL0 = BASE + (BASE.indexOf("?") >= 0 ? "&" : "?") + "v=" + (process.env.STAMP || "4335") + "&t=" + Date.now();
const PIZZA = /pizz|πιτσ|πίτσ|margherita|calzone/i;
const MARKET = /market|super|grocer|convenience|παντοπωλ|σούπερ|σουπερ|μάρκετ|μαρκετ/i;
const RHODES = { lat: 36.4349, lng: 28.2176 };
const ATHENS = { lat: 37.9838, lng: 23.7275 };
const fails = [];
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
    const title = ((document.getElementById("sn-sheet-card") || {}).textContent || "").match(/FIND\s*·\s*(\d+|…)/);
    const shown = (window.__snFindShown || []).map((s) => {
      const menu = Array.isArray(s.menu) ? s.menu.map((m) => (m && m.name) || "").join(" ") : "";
      return { id: String(s.id || s.name), name: s.name, aka: s.aka || "", lat: +s.lat, lng: +s.lng, blob: [s.name, s.aka, s.kind, s.cuisine, menu, s.menuText].join(" ") };
    });
    const live = ((document.getElementById("sn-pulse") || {}).textContent || "");
    const liveN = (live.match(/LIVE · (\d+) vendor/) || [])[1];
    const city = document.getElementById("city");
    let size = null, box = null, tiles = 0, loaded = 0;
    try { const s = map.getSize(); size = { w: s.x, h: s.y }; } catch (e) {}
    if (city) {
      box = { w: city.clientWidth, h: city.clientHeight };
      city.querySelectorAll("img.leaflet-tile").forEach((im) => { tiles++; if (im.complete && im.naturalWidth > 0) loaded++; });
    }
    return { pins, domPins, find: title ? title[1] : null, shown, live, liveN: liveN == null ? null : +liveN, size, box, tiles, loaded,
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
  let overpassHits = 0, overpassAfterFail = 0, overpassFailAt = 0;
  page.on("request", (r) => {
    if (!/overpass-api\.de/.test(r.url())) return;
    overpassHits++;
    if (overpassFailAt && Date.now() - overpassFailAt > 100) overpassAfterFail++;
  });
  page.on("requestfailed", (r) => { if (/overpass-api\.de/.test(r.url()) && !overpassFailAt) overpassFailAt = Date.now(); });
  if (process.env.LOCAL_APP) {
    const body = fs.readFileSync(process.env.LOCAL_APP);
    await page.route(/\/js\/spacenet\/app\.js/, (route) => route.fulfill({ status: 200, contentType: "application/javascript", body }));
  }
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
  if (process.env.OVERPASS_FAIL) await page.route(/overpass-api\.de/, (route) => route.abort("connectionclosed"));
  page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));

  console.log("goto", URL0);
  await page.goto(URL0, { waitUntil: "domcontentloaded", timeout: 90000 });
  await sleep(4500);
  const wallet = await page.evaluate(() => ((document.querySelector("#sn-money .tgt") || {}).textContent || "").trim());
  check(wallet === "0 AV€ · guest", "guest wallet reads '0 AV€ · guest'", JSON.stringify(wallet));

  await ask(page, "supermarket in Rhodes");
  const f1 = await settle(page, "supermarket in Rhodes", 30000);
  check(f1.pins.length > 0 && f1.shown.every((s) => MARKET.test(s.blob)), "supermarket FIND is market-only", f1.shown.length + " shown");
  check(sameSet(f1), "supermarket FIND == pins");

  await ask(page, "pizza in Rhodes");
  const f2 = await settle(page, "pizza in Rhodes", 35000);
  check(f2.pins.length > 0, "pizza pins shown", String(f2.pins.length));
  const notPizza = f2.shown.filter((s) => !PIZZA.test(s.blob));
  check(!notPizza.length, "shown pins are pizza-only (name/cuisine/menu)", notPizza.map((s) => s.name).join(", "));
  check(sameSet(f2), "FIND == pins (ids)", f2.pins.length + " pins vs " + f2.shown.length + " FIND");
  check(String(f2.pins.length) === String(f2.find), "FIND title count == pins", f2.find + " vs " + f2.pins.length);
  check(f2.liveN === f2.pins.length, "LIVE counts what is shown", f2.live);
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
  const f3 = await settle(page, "pizza in Athens Greece", 35000);
  const far = f3.pins.filter((p) => km(p, ATHENS) > 50);
  check(!far.length, "Athens: no pin farther than 50 km (no Rhodes/Nairobi leak)", far.map((p) => p.tip).join(", "));
  check(!f3.shown.some((s) => /ugoustinos|vgoustinos/i.test(s.name)), "Athens: no Augoustinos in FIND");
  check(sameSet(f3), "Athens FIND == pins");
  check(f3.shown.every((s) => PIZZA.test(s.blob)), "Athens FIND pizza-only");
  const stray = await page.evaluate(() => Array.from(document.querySelectorAll("#city .sn-shop-pin")).map((e) => e.textContent).filter((t) => /ugoustinos|Nairobi/i.test(t)));
  check(!stray.length, "Athens: no stray Rhodes/Nairobi pin element in the DOM", stray.join(","));

  await ask(page, "supermarket in Rhodes");
  const f4 = await settle(page, "supermarket in Rhodes (again)", 35000);
  check(f4.shown.length > 0 && f4.shown.every((s) => MARKET.test(s.blob)) && !f4.shown.some((s) => /pizzagio|gondola/i.test(s.name)), "FIND rebuilt for the new query");
  check(sameSet(f4), "FIND == pins after rebuild");

  // twins: plain Rhodes field shows one Augoustinos
  await page.evaluate((p) => { SN.seatPlace({ lat: p.lat, lng: p.lng, name: "Rhodes" }); }, RHODES);
  await sleep(6000);
  const tw = await page.evaluate(() => SN.fieldShops().filter((s) => /ugoustinos|vgoustinos/i.test(s.name + " " + s.aka)));
  check(tw.length === 1, "Augoustinos twins merged into one pin", JSON.stringify(tw));

  console.log("overpass requests:", overpassHits, "after first failure:", overpassAfterFail, "state:", JSON.stringify(await page.evaluate(() => SN.overpassState && SN.overpassState())));
  if (process.env.OVERPASS_FAIL) check(overpassFailAt > 0 && overpassAfterFail === 0, "overpass backs off after the first connection failure", overpassHits + " total, " + overpassAfterFail + " after the first failure");

  await browser.close();
  console.log(fails.length ? "HUNT_REPLACE FAIL (" + fails.length + "): " + fails.join("; ") : "HUNT_REPLACE PASS");
  process.exit(fails.length ? 2 : 0);
})().catch((e) => { console.error("pw_fail", e); process.exit(1); });

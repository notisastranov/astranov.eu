/**
 * Real-input globe wheel at 1280x800, deviceScaleFactor 1 and 2.
 * Uses page.mouse.move + page.mouse.wheel (not element.dispatchEvent).
 * Phases: (1) after 10s idle/auto-spin, face E Med, wheel-in;
 *         (2) Rhodes land → closeCity → wheel-in at Rhodes pixel.
 * Asserts street center near E Med / Rhodes, not Bering, tiles loaded.
 */
const { chromium } = require("playwright");

const PREVIEW =
  process.env.PREVIEW_URL ||
  "https://astranov-git-grokbuild-4328-street-level-gps-astranov.vercel.app/?v=" +
    (process.env.STAMP || "4333") +
    "&t=" +
    Date.now();

const EMED = { lat: 36.4349, lng: 28.2176, name: "Rhodes" };
const BERING = { lat: 66.7, lng: -165.4 };

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function near(a, b, tol) {
  if (!a || !b) return false;
  const dlat = Math.abs(a.lat - b.lat);
  let dlng = Math.abs(a.lng - b.lng);
  if (dlng > 180) dlng = 360 - dlng;
  return dlat < tol && dlng < tol;
}

async function readState(page) {
  return page.evaluate(() => {
    const city = document.getElementById("city");
    const map = window.SN && SN.getMap && SN.getMap();
    let center = null,
      zoom = null;
    try {
      if (map) {
        const c = map.getCenter();
        center = { lat: c.lat, lng: c.lng };
        zoom = map.getZoom();
      }
    } catch (e) {}
    let tiles = 0,
      loaded = 0;
    if (city) {
      const imgs = city.querySelectorAll("img.leaflet-tile");
      tiles = imgs.length;
      imgs.forEach((img) => {
        if (img.complete && img.naturalWidth > 0) loaded++;
      });
    }
    const say = (document.getElementById("line") || {}).textContent || "";
    const logs = window.__snWheelLogs || [];
    return {
      cityOn: !!(city && city.classList.contains("on")),
      center,
      zoom,
      tiles,
      loaded,
      say,
      opacity: city ? getComputedStyle(city).opacity : null,
      logs: logs.slice(-5),
      cam: (window.SN && SN.getCam && SN.getCam()) || null
    };
  });
}

async function faceAndPixel(page, pt) {
  return page.evaluate((p) => {
    const sn = window.SN;
    if (!sn) return { ok: false, err: "no SN" };
    try {
      if (sn.lookAt) sn.lookAt({ lat: p.lat, lng: p.lng, name: p.name }, 1.2);
    } catch (e) {}
    try {
      if (sn.getCam) {
        /* seated so idle spin stops */
      }
    } catch (e2) {}
    const scr = sn.projectTest(p.lat, p.lng);
    const c = document.getElementById("g");
    const r = c ? c.getBoundingClientRect() : { left: 0, top: 0, width: 1280, height: 800 };
    return {
      ok: !!(scr && isFinite(scr.x)),
      scr,
      canvas: { l: r.left, t: r.top, w: r.width, h: r.height },
      hit: sn.globeHitTest ? sn.globeHitTest(scr ? scr.x : 0, scr ? scr.y : 0) : null,
      cam: sn.getCam && sn.getCam()
    };
  }, pt);
}

async function wheelInAt(page, cssX, cssY, notches) {
  await page.mouse.move(cssX, cssY);
  await sleep(120);
  for (let i = 0; i < (notches || 10); i++) {
    await page.mouse.wheel(0, -120);
    await sleep(180);
  }
  await sleep(2800);
}

async function runDpr(browser, dpr) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: dpr
  });
  page.on("console", (msg) => {
    const t = msg.text();
    if (t.indexOf("sn:wheel") >= 0) console.log("[console]", t);
  });
  await page.addInitScript(() => {
    window.__snWheelLogs = [];
    const orig = console.debug;
    console.debug = function () {
      try {
        if (arguments[0] === "sn:wheel") {
          window.__snWheelLogs.push(arguments[1]);
        }
      } catch (e) {}
      return orig.apply(console, arguments);
    };
  });
  console.log("=== dpr", dpr, "goto", PREVIEW);
  await page.goto(PREVIEW, { waitUntil: "domcontentloaded", timeout: 90000 });
  await sleep(4000);
  await page.locator("canvas#g").waitFor({ state: "visible", timeout: 30000 });

  // Phase 1: idle 10s then face E Med + real wheel
  console.log("dpr", dpr, "idle 10s…");
  await sleep(10000);
  const face1 = await faceAndPixel(page, EMED);
  console.log("dpr", dpr, "face1", JSON.stringify(face1));
  if (!face1.ok) throw new Error("E Med not projectable after lookAt dpr=" + dpr);
  const x1 = face1.canvas.l + face1.scr.x;
  const y1 = face1.canvas.t + face1.scr.y;
  console.log("dpr", dpr, "wheel1 at", x1, y1, "hit", face1.hit);
  await wheelInAt(page, x1, y1, 10);
  const r1 = await readState(page);
  console.log("dpr", dpr, "afterIdleWheel", JSON.stringify(r1));
  const ok1 =
    r1.cityOn &&
    near(r1.center, EMED, 4) &&
    !near(r1.center, BERING, 15) &&
    (r1.loaded || 0) >= 4;
  console.log("dpr", dpr, "phase1", ok1 ? "PASS" : "FAIL");

  // Phase 2: back to globe, Rhodes land, wheel-out, wheel-in
  await page.evaluate(() => {
    try {
      if (window.SN && SN.closeCity) SN.closeCity();
    } catch (e) {}
  });
  await sleep(1500);
  await page.evaluate((p) => {
    try {
      SN.seatPlace({ lat: p.lat, lng: p.lng, name: p.name });
    } catch (e) {}
  }, EMED);
  await sleep(3500);
  await page.evaluate(() => {
    try {
      SN.closeCity();
    } catch (e) {}
  });
  await sleep(1500);
  const face2 = await faceAndPixel(page, EMED);
  console.log("dpr", dpr, "face2", JSON.stringify(face2));
  if (!face2.ok) throw new Error("Rhodes not projectable after wheel-out dpr=" + dpr);
  const x2 = face2.canvas.l + face2.scr.x;
  const y2 = face2.canvas.t + face2.scr.y;
  await wheelInAt(page, x2, y2, 10);
  const r2 = await readState(page);
  console.log("dpr", dpr, "afterRhodesWheel", JSON.stringify(r2));
  const ok2 =
    r2.cityOn &&
    near(r2.center, EMED, 4) &&
    !near(r2.center, BERING, 15) &&
    (r2.loaded || 0) >= 4;
  console.log("dpr", dpr, "phase2", ok2 ? "PASS" : "FAIL");

  await page.close();
  return { dpr, ok1, ok2, r1, r2, face1, face2 };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const dpr of [1, 2]) {
    results.push(await runDpr(browser, dpr));
  }
  await browser.close();
  console.log("SUMMARY", JSON.stringify(results.map((r) => ({ dpr: r.dpr, ok1: r.ok1, ok2: r.ok2, c1: r.r1.center, c2: r.r2.center }))));
  const all = results.every((r) => r.ok1 && r.ok2);
  if (!all) process.exit(2);
})().catch((e) => {
  console.error("pw_fail", e);
  process.exit(1);
});

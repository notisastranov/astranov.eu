/**
 * Headless wheel-in over E Med on the globe preview.
 * Env: PREVIEW_URL (default branch preview)
 */
const { chromium } = require("playwright");

const PREVIEW =
  process.env.PREVIEW_URL ||
  "https://astranov-git-grokbuild-4328-street-level-gps-astranov.vercel.app/?v=4332&t=" +
    Date.now();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(60000);
  console.log("goto", PREVIEW);
  await page.goto(PREVIEW, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(3500);
  // Dismiss power-idle if needed: ensure globe canvas exists
  const canvas = page.locator("canvas#g");
  await canvas.waitFor({ state: "visible", timeout: 30000 });
  // Face E Med via exposed helpers if present, else lookAt through evaluate
  await page.evaluate(() => {
    const sn = window.__SN_4332 || window.__SN_4331 || window.__SN || {};
    const aim = { lat: 36.4, lng: 28.2, name: "E Med" };
    try {
      if (typeof sn.lookAt === "function") sn.lookAt(aim, 1.2);
      else if (typeof window.lookAt === "function") window.lookAt(aim, 1.2);
    } catch (e) {}
    try {
      if (sn.cam) {
        sn.cam.dist = 1.2;
        sn.aim = aim;
        sn.seated = true;
      }
    } catch (e2) {}
  });
  await sleep(800);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas box");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // Wheel in several notches over center (E Med faced)
  for (let i = 0; i < 8; i++) {
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -180);
    await sleep(220);
  }
  await sleep(2500);
  const result = await page.evaluate(() => {
    const city = document.getElementById("city");
    const on = !!(city && city.classList.contains("on"));
    const map = (window.__SN_4332 || window.__SN_4331 || window.__SN || {}).map;
    let center = null;
    let zoom = null;
    try {
      if (map && map.getCenter) {
        const c = map.getCenter();
        center = { lat: c.lat, lng: c.lng };
        zoom = map.getZoom();
      }
    } catch (e) {}
    // Sample non-grey pixels from city container via canvas snapshot of leaflet panes
    let nonGrey = 0;
    let sampled = 0;
    try {
      const pane = city && city.querySelector(".leaflet-tile-pane");
      const tiles = pane ? pane.querySelectorAll("img.leaflet-tile") : [];
      let loaded = 0;
      tiles.forEach((img) => {
        if (img.complete && img.naturalWidth > 0) loaded++;
      });
      // Draw tiles onto offscreen canvas and count non-grey
      const c = document.createElement("canvas");
      c.width = 120;
      c.height = 120;
      const ctx = c.getContext("2d");
      let drawn = 0;
      tiles.forEach((img) => {
        if (drawn >= 4) return;
        if (!(img.complete && img.naturalWidth > 0)) return;
        try {
          ctx.drawImage(img, (drawn % 2) * 60, Math.floor(drawn / 2) * 60, 60, 60);
          drawn++;
        } catch (e) {}
      });
      if (drawn) {
        const data = ctx.getImageData(0, 0, 120, 120).data;
        for (let i = 0; i < data.length; i += 16) {
          sampled++;
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 8) continue;
          const nearGrey = Math.abs(r - g) < 8 && Math.abs(g - b) < 8 && r > 140 && r < 220;
          if (!nearGrey) nonGrey++;
        }
      }
      return {
        cityOn: on,
        center,
        zoom,
        tiles: tiles.length,
        tilesLoaded: loaded,
        nonGrey,
        sampled,
        opacity: city ? city.style.opacity : null
      };
    } catch (e) {
      return { cityOn: on, center, zoom, error: String(e) };
    }
  });
  console.log("pw_wheel_result", JSON.stringify(result));
  const near =
    result.center &&
    Math.abs(result.center.lat - 36.4) < 3 &&
    Math.abs(((result.center.lng - 28.2 + 540) % 360) - 180) < 3;
  const tilesOk = (result.tilesLoaded || 0) >= 1 && (result.nonGrey || 0) > 20;
  console.log("pw_assert nearEMed=", !!near, "tilesOk=", !!tilesOk, "center=", result.center);
  await browser.close();
  if (!result.cityOn || !near || !tilesOk) {
    process.exit(2);
  }
})().catch((e) => {
  console.error("pw_fail", e);
  process.exit(1);
});

/**
 * Headed real-input test (4337): real Chrome on the X display (DISPLAY, default :3), OS-level xdotool input,
 * screenshots grabbed from the X screen (actual pixels, not page.screenshot) via python3 + Pillow ImageGrab.
 *
 * WHEEL: drag twice (each must move the globe), one wheel notch + a third drag (drag after an anchor hold),
 *   hover the drawn Rhodes, 15 notches (`xdotool click 4`). At notches 5/10/15: screen grab must show map tiles
 *   (non-uniform pixels, tiles loaded) and, with DEBUGQ=1, the magenta debug crosshair. Every notch must log one
 *   sn:wheel line carrying the real clientX/clientY.
 * HUNTS=1: supermarket + pizza in Rhodes (tiles under the pins, every pin inside the visible map box, no label
 *   overlaps), the Gondola row, pizza in Athens (time-to-land ≤ 8 s), "Augoustinos in Rhodes" (one place card,
 *   one pin), Power (countdown visible while held, tag clear of the wallet pill, short tap message).
 * Env: PREVIEW_URL, STAMP, LOCAL_APP, WIN=1280x800, HOLD, GAP, SPIN, DEBUGQ=1, SHOTDIR, REAL_CHROME=1, HUNTS=1, LAND_MAX=8
 */
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const BASE = process.env.PREVIEW_URL || "https://astranov-git-grokbuild-4328-street-level-gps-astranov.vercel.app/";
const STAMP = process.env.STAMP || "4337";
const URL0 = BASE + (BASE.includes("?") ? "&" : "?") + "v=" + STAMP + "&t=" + Date.now() + (process.env.DEBUGQ ? "&debug=wheel" : "");
const RHODES = { lat: 36.4349, lng: 28.2176 }, ATHENS = { lat: 37.9838, lng: 23.7275 };
const [WW, WH] = (process.env.WIN || "1280x800").split("x").map(Number);
const SHOTDIR = process.env.SHOTDIR || "/tmp/sn-headed";
fs.mkdirSync(SHOTDIR, { recursive: true });
if (!process.env.DISPLAY) process.env.DISPLAY = ":3";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const xdo = (a) => execSync("xdotool " + a, { env: process.env });
function near(a, b, t) { if (!a || !b) return false; let d = Math.abs(a.lng - b.lng); if (d > 180) d = 360 - d; return Math.abs(a.lat - b.lat) < t && d < t; }
const GRAB = path.join(os.tmpdir(), "sn_grab4337.py");
fs.writeFileSync(GRAB, `import sys, json
from PIL import ImageGrab, ImageStat
out, x, y, w, h, rx, ry, rw, rh = sys.argv[1], *map(int, sys.argv[2:10])
im = ImageGrab.grab(xdisplay="${process.env.DISPLAY}").crop((x, y, x + w, y + h)).convert("RGB")
im.save(out, compress_level=1)
rw = max(8, rw); rh = max(8, rh)
reg = im.crop((rx, ry, rx + rw, ry + rh))
st = ImageStat.Stat(reg.convert("L"))
small = reg.resize((max(1, reg.width // 4), max(1, reg.height // 4)))
cols = len(small.getcolors(1 << 22) or [])
from PIL import ImageChops
r_, g_, b_ = im.split()
m = ImageChops.multiply(ImageChops.multiply(r_.point(lambda v: 255 if v > 200 else 0), g_.point(lambda v: 255 if v < 110 else 0)), b_.point(lambda v: 255 if v > 190 else 0))
mag = m.histogram()[255]
print(json.dumps({"std": round(st.stddev[0], 1), "mean": round(st.mean[0], 1), "colors": cols, "magenta": mag}))
`);
const results = { fails: [], notes: [] };
function check(name, ok, info) { console.log((ok ? "PASS " : "FAIL ") + name + (info ? " " + info : "")); if (!ok) results.fails.push(name); }

(async () => {
  const browser = await chromium.launch({ headless: false, executablePath: process.env.REAL_CHROME ? "/usr/bin/google-chrome" : undefined,
    args: ["--window-position=0,0", "--window-size=" + WW + "," + WH, "--no-first-run", "--no-default-browser-check", "--deny-permission-prompts", "--disable-features=Translate"] });
  const ctx = await browser.newContext({ viewport: null, serviceWorkers: process.env.LOCAL_APP ? "block" : "allow" });
  const page = await ctx.newPage();
  if (process.env.LOCAL_APP) {
    const body = fs.readFileSync(process.env.LOCAL_APP);
    await page.route(/\/js\/spacenet\/app\.js/, (r) => r.fulfill({ status: 200, contentType: "application/javascript", body }));
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.addInitScript(() => {
    window.__ev = [];
    const od = console.debug;
    console.debug = function () { try { if (arguments[0] === "sn:wheel") window.__ev.push(["log", Math.round(performance.now()), arguments[1]]); } catch (e) {} return od.apply(console, arguments); };
    window.addEventListener("wheel", (e) => window.__ev.push(["wheel", Math.round(performance.now()), e.clientX, e.clientY, e.deltaY]), true);
    window.addEventListener("mousemove", (e) => { window.__mm = [e.clientX, e.clientY, e.screenX, e.screenY]; }, true);
  });
  await page.goto(URL0, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.bringToFront();
  await sleep(4500);
  xdo("mousemove 600 500"); await sleep(150); xdo("mousemove 601 501"); await sleep(250);
  const mm = await page.evaluate(() => window.__mm);
  const ox = 601 - mm[0], oy = 501 - mm[1];
  const geo = await page.evaluate(() => ({ iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio, ver: (document.querySelector("meta[name=astranov-build]") || {}).content || "" }));
  console.log("content origin", ox, oy, "inner", geo.iw + "x" + geo.ih, "dpr", geo.dpr, "meta", geo.ver);
  const S = (x, y) => [Math.round(ox + x), Math.round(oy + y)];
  async function grab(name, box) {
    const b = box || { x: 70, y: 100, w: geo.iw - 140, h: geo.ih - 230 };
    const f = path.join(SHOTDIR, name + ".png");
    const r = JSON.parse(execSync(`python3 ${GRAB} ${f} ${ox} ${oy} ${geo.iw} ${geo.ih} ${Math.round(b.x)} ${Math.round(b.y)} ${Math.round(b.w)} ${Math.round(b.h)}`).toString());
    r.file = f; return r;
  }
  const tileInfo = () => page.evaluate(() => {
    const ims = [...document.querySelectorAll("#city img.leaflet-tile")];
    const vis = ims.filter((x) => { const b = x.getBoundingClientRect(); return b.right > 0 && b.bottom > 0 && b.left < innerWidth && b.top < innerHeight; });
    const m = SN.getMap(); const c = document.getElementById("city");
    return { tiles: vis.length, loaded: vis.filter((x) => x.complete && x.naturalWidth > 8).length, cityOn: c.classList.contains("on"), z: m && +m.getZoom().toFixed(2), op: getComputedStyle(c).opacity };
  });
  const cam = () => page.evaluate(() => SN.getCam());
  async function drag(x0, y0, dx, dy) {
    const [a, b] = S(x0, y0);
    xdo(`mousemove ${a} ${b}`); await sleep(60);
    xdo("mousedown 1"); await sleep(40);
    for (let i = 1; i <= 15; i++) { const [c, d] = S(x0 + (dx * i) / 15, y0 + (dy * i) / 15); xdo(`mousemove ${c} ${d}`); await sleep(16); }
    xdo("mouseup 1"); await sleep(80);
  }
  const W2 = geo.iw / 2, H2 = geo.ih / 2;
  function moved(a, b) { return Math.abs(a.yaw - b.yaw) > 0.15 || Math.abs(a.pitch - b.pitch) > 0.05; }
  // ---- drags: each must move the globe (2nd after a stopped spin, 3rd after a wheel anchor hold) ----
  let c0 = await cam(); await drag(W2, H2, -200, 80); let c1 = await cam();
  await sleep(1200);
  await drag(W2, H2, 300, -50); let c2 = await cam();
  check("drag1 moves globe", moved(c0, c1), `yaw ${c0.yaw.toFixed(2)}→${c1.yaw.toFixed(2)}`);
  check("drag2 moves globe", moved(c1, c2), `yaw ${c1.yaw.toFixed(2)}→${c2.yaw.toFixed(2)}`);
  xdo(`mousemove ${S(W2 + 40, H2 + 20).join(" ")}`); await sleep(150); xdo("click 4"); await sleep(900);
  let c3 = await cam(); await drag(W2 - 100, H2, 220, 40); let c4 = await cam();
  check("drag3 (after wheel hold) moves globe", moved(c3, c4), `yaw ${c3.yaw.toFixed(2)}→${c4.yaw.toFixed(2)}`);
  xdo("click 5"); await sleep(400); xdo("click 5"); await sleep(400);
  xdo(`mousemove ${S(4, geo.ih - 4).join(" ")}`);
  await sleep(Number(process.env.SPIN || 2500));
  // bring Rhodes to the face by dragging if needed, then hover its drawn pixel
  let px = null; const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    px = await page.evaluate((p) => { const s = SN.projectFrame(p.lat, p.lng); return s && { x: s.x, y: s.y, z: s.z }; }, RHODES);
    if (px && px.z > 0.4 && px.x > 150 && px.x < geo.iw - 150 && px.y > 150 && px.y < geo.ih - 150) break;
    if (px && px.z > -1) { const dx = Math.max(-250, Math.min(250, W2 - (px.x || W2))) * 0.8, dy = Math.max(-150, Math.min(150, H2 - (px.y || H2))) * 0.8; await drag(W2, H2, dx || 120, dy); }
    else await drag(W2, H2, 200, 0);
    px = null; await sleep(500);
  }
  if (!px) { console.log("Rhodes never wheelable"); await browser.close(); process.exit(3); }
  const cx = px.x, cy = px.y;
  xdo(`mousemove ${S(cx, cy).join(" ")}`); await sleep(150);
  const mm2 = await page.evaluate(() => window.__mm);
  console.log("hover Rhodes px", cx.toFixed(1), cy.toFixed(1), "client", JSON.stringify(mm2.slice(0, 2)));
  await sleep(Number(process.env.HOLD || 1000));
  await page.evaluate(() => { window.__ev = []; });
  const gap = Number(process.env.GAP || 700);
  for (let i = 0; i < 15; i++) {
    xdo("click 4"); await sleep(gap);
    if ([4, 9, 14].includes(i)) {
      await sleep(900);
      const t = await tileInfo();
      const g = await grab("wheel-notch" + String(i + 1).padStart(2, "0"));
      const tilesOk = t.cityOn ? (g.std >= 10 && g.colors >= 60 && t.loaded > 0) : (g.std >= 10);
      check(`notch ${i + 1} tiles visible`, tilesOk, JSON.stringify(Object.assign({}, t, g)));
      if (process.env.DEBUGQ) check(`notch ${i + 1} crosshair`, g.magenta >= 15, "magenta px " + g.magenta);
    }
  }
  await sleep(1500);
  const ev = await page.evaluate(() => window.__ev);
  const wheels = ev.filter((e) => e[0] === "wheel"), logs = ev.filter((e) => e[0] === "log");
  console.log("wheel events", wheels.length, "sn:wheel logs", logs.length);
  logs.forEach((l) => console.log("  sn:wheel", JSON.stringify(l[2])));
  check("one sn:wheel per notch", logs.length >= 15 && logs.length >= wheels.length, logs.length + "/" + wheels.length);
  const realXY = logs.every((l) => l[2] && Math.abs(l[2].clientX - mm2[0]) <= 2 && Math.abs(l[2].clientY - mm2[1]) <= 2);
  check("sn:wheel logs carry the real cursor clientX/Y", realXY, "cursor " + mm2.slice(0, 2));
  const st = await page.evaluate(() => { const m = SN.getMap(); const c = document.getElementById("city"); return { cityOn: c.classList.contains("on"), center: m && m.getCenter(), zoom: m && m.getZoom(), line: document.getElementById("line").textContent }; });
  console.log("final", JSON.stringify(st));
  check("wheel dive lands near Rhodes", st.cityOn && near(st.center, RHODES, 0.3), st.center && st.center.lat.toFixed(3) + "," + st.center.lng.toFixed(3) + " z" + st.zoom);

  if (process.env.HUNTS) {
    const navs = [];
    page.on("framenavigated", (fr) => { if (fr === page.mainFrame()) navs.push(fr.url()); });
    const visBox = () => page.evaluate(() => {
      const r = (id) => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return b.width && b.height && getComputedStyle(e).display !== "none" && getComputedStyle(e).visibility !== "hidden" ? b : null; };
      const isl = r("island"), card = r("sn-sheet-card"), pulse = r("sn-pulse");
      let t = isl ? isl.bottom : 50, b = innerHeight - 60;
      if (card) b = Math.min(b, card.top); if (pulse && pulse.top > t + 50) b = Math.min(b, pulse.top);
      return { t, b };
    });
    const pinInfo = () => page.evaluate(() => {
      const pins = [...document.querySelectorAll("#city .leaflet-marker-icon.sn-shop-pin")];
      const out = pins.map((p) => { const b = p.getBoundingClientRect(); const l = p.querySelector("b"); const lb = l && l.getBoundingClientRect(); const lv = l && getComputedStyle(l).visibility !== "hidden" && getComputedStyle(l).display !== "none" && +getComputedStyle(l).opacity > 0.2;
        return { x: b.left, y: b.top, w: b.width, h: b.height, name: l ? l.textContent : "", lab: lv ? { x: lb.left, y: lb.top, w: lb.width, h: lb.height } : null }; });
      return out;
    });
    function overlaps(pins) {
      let n = 0; const L = pins.filter((p) => p.lab);
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const a = L[i].lab, b = L[j].lab;
        if (a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1) n++;
      }
      return n;
    }
    const state = () => page.evaluate(() => { const m = SN.getMap(); const c = document.getElementById("city"); const cc = m && m.getCenter();
      return { cityOn: c.classList.contains("on"), center: cc && { lat: +cc.lat.toFixed(4), lng: +cc.lng.toFixed(4) }, zoom: m && m.getZoom(),
        find: (((document.getElementById("sn-sheet-card") || {}).textContent || "").match(/FIND\s*·\s*(\d+|…)/) || [])[1] || null,
        prof: ((document.querySelector("#sn-sheet .sn-prof") || {}).textContent || "").slice(0, 80),
        live: (document.getElementById("sn-pulse") || {}).textContent, line: document.getElementById("line").textContent }; });
    async function say(t) { await page.click("#in"); await page.fill("#in", t); await page.press("#in", "Enter"); return Date.now(); }
    async function waitFor(fn, ms) { const t = Date.now(); while (Date.now() - t < ms) { const s = await state(); if (fn(s)) return { s, ms: Date.now() - t }; await sleep(200); } return { s: await state(), ms: null }; }
    async function fitCheck(tag, q, place) {
      const tA = await say(q);
      const land = await waitFor((s) => s.cityOn && near(s.center, place, 0.3), 15000);
      const done = await waitFor((s) => s.find && s.find !== "…", 20000);
      await sleep(1800);
      const vb = await visBox(); const pins = await pinInfo(); const t = await tileInfo();
      const g = await grab(tag, { x: 70, y: vb.t + 4, w: geo.iw - 140, h: Math.max(20, vb.b - vb.t - 8) });
      const inside = pins.filter((p) => p.y >= vb.t - 2 && p.y + p.h <= vb.b + 2 && p.x >= -2 && p.x + p.w <= geo.iw + 2).length;
      const ov = overlaps(pins);
      console.log(`[${q}] land ${land.ms}ms find ${done.s.find} after ${done.ms}ms`, JSON.stringify(done.s).slice(0, 300));
      check(`${tag} tiles under pins`, g.std >= 10 && g.mean > 40 && t.loaded > 0, JSON.stringify(Object.assign({}, t, g)));
      check(`${tag} pins inside visible map (ribbon..sheet)`, pins.length > 0 && inside === pins.length, `${inside}/${pins.length} box ${vb.t.toFixed(0)}..${vb.b.toFixed(0)}`);
      check(`${tag} no overlapping labels`, ov === 0, `overlaps ${ov}, labels shown ${pins.filter((p) => p.lab).length}/${pins.length}`);
      check(`${tag} FIND = pins`, done.s.find && +done.s.find === pins.length, `FIND ${done.s.find} pins ${pins.length}`);
      return { land, done, pins };
    }
    await fitCheck("rhodes-supermarket", "supermarket in Rhodes", RHODES);
    await fitCheck("rhodes-pizza", "pizza in Rhodes", RHODES);
    const row = await page.$("#sn-sheet-body .pill:has-text('Gondola')");
    if (row) {
      const b = await row.boundingBox(); xdo(`mousemove ${S(b.x + 40, b.y + b.height / 2).join(" ")}`); await sleep(80); xdo("click 1"); await sleep(2500);
      const prof = await page.evaluate(() => (document.querySelector("#sn-sheet .sn-prof") || {}).textContent || "");
      const fee = await page.evaluate(() => ((document.querySelector("#sn-sheet") || {}).textContent || "").match(/Delivery · [^·]*· ([\d.]+) km/));
      console.log("[gondola sheet]", prof.slice(0, 140), "km", fee && fee[1]);
      check("gondola sheet ~0.9 km", !!(fee && Math.abs(+fee[1] - 0.9) < 0.35), fee && fee[1]);
    } else check("gondola row present", false);
    // Athens: time to land
    const tA = await say("pizza in Athens Greece");
    const land = await waitFor((s) => s.cityOn && near(s.center, ATHENS, 0.3), 20000);
    const g8 = await grab("athens-at-land");
    const done = await waitFor((s) => s.find && s.find !== "…", 20000);
    await sleep(1500);
    const gA = await grab("athens-final");
    const landS = land.ms == null ? null : +(land.ms / 1000).toFixed(1);
    console.log("[athens] land", landS, "s; FIND", done.s.find, "after", done.ms, "ms;", JSON.stringify(done.s).slice(0, 260));
    check("athens time-to-land ≤ " + (process.env.LAND_MAX || 8) + " s", landS != null && landS <= Number(process.env.LAND_MAX || 8), landS + " s (screens " + g8.file + ", tiles std " + g8.std + ")");
    check("athens pins", done.s.find && +done.s.find > 0 && near(done.s.center, ATHENS, 0.3), "FIND " + done.s.find);
    // name search
    await say("Augoustinos in Rhodes");
    const nm = await waitFor((s) => /a[uv]goust|αυγουστ/i.test(s.prof) || (s.find && s.find !== "…"), 20000);
    await sleep(1500);
    const pinsN = await pinInfo(); const sN = await state();
    const gN = await grab("augoustinos");
    console.log("[augoustinos]", JSON.stringify(sN).slice(0, 300), "pins", pinsN.map((p) => p.name).join(" | "));
    check("augoustinos single result (one card, one pin)", /a[uv]goust|αυγουστ/i.test(sN.prof) && pinsN.length === 1, `pins ${pinsN.length} card "${sN.prof.slice(0, 40)}"`);
    // Power
    const pr = await page.evaluate(() => { const b = document.getElementById("sn-power").getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    const wallet = await page.evaluate(() => { const e = [...document.querySelectorAll("body *")].filter((x) => x.children.length === 0 && /AV€/.test(x.textContent || "") && x.getBoundingClientRect().width > 0 && x.getBoundingClientRect().top < 160)[0]; const p = e && (e.closest("button,a,[id]") || e); const b = p && p.getBoundingClientRect(); return b && { x: b.left, y: b.top, w: b.width, h: b.height, id: p.id }; });
    const tagBox = () => page.evaluate(() => { const e = document.getElementById("sn-power-tag"); const b = e.getBoundingClientRect(); const c = document.getElementById("sn-count"); return { x: b.left, y: b.top, w: b.width, h: b.height, txt: e.textContent, count: c && c.classList.contains("on") ? c.textContent : "" }; });
    const isOv = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    async function holdPower(ms, tag) {
      xdo(`mousemove ${S(pr.x, pr.y).join(" ")}`); await sleep(100); xdo("mousedown 1");
      const seen = []; const tH = Date.now();
      for (const at of [600, 1600, 2500]) {
        if (at >= ms) break;
        const w = tH + at - Date.now(); if (w > 0) await sleep(w);
        const tb = await tagBox(); const g = await grab(tag + "-held" + at, { x: 0, y: 0, w: geo.iw, h: geo.ih });
        seen.push({ at, real: Date.now() - tH, txt: tb.txt, count: tb.count, file: g.file, ov: isOv(tb, wallet) });
      }
      { const w = tH + ms - Date.now(); if (w > 0) await sleep(w); }
      xdo("mouseup 1"); await sleep(400);
      const after = await tagBox(); const line = await page.evaluate(() => document.getElementById("line").textContent);
      const g = await grab(tag + "-after", { x: 0, y: 0, w: 260, h: 160 });
      return { seen, after, line, file: g.file };
    }
    const on = await holdPower(3400, "power-on");
    console.log("[power on]", JSON.stringify(on));
    check("power countdown visible while held", on.seen.length === 3 && on.seen.every((s) => /hold [321]/.test(s.txt) && /[321]/.test(s.count)), on.seen.map((s) => s.txt + "/" + s.count).join(", "));
    check("power tag clear of wallet pill", !on.seen.some((s) => s.ov) && !isOv(on.after, wallet), JSON.stringify({ tag: on.after, wallet }));
    check("power offers on after 3 s", /offers on/.test(on.after.txt), on.after.txt);
    const tap = await holdPower(300, "power-tap");
    check("power short tap message", /Hold Power 3 s/.test(tap.line), tap.line);
    const off = await holdPower(3400, "power-off");
    check("power back off", /Power · off/.test(off.after.txt), off.after.txt);
    console.log("navigations during hunts:", JSON.stringify(navs));
    check("no self-reload", navs.length === 0, JSON.stringify(navs));
  }
  check("no console errors", errors.length === 0, JSON.stringify(errors.slice(0, 5)));
  console.log("SCREENSHOTS", SHOTDIR);
  console.log(results.fails.length ? "HEADED FAIL: " + results.fails.join("; ") : "HEADED ALL PASS");
  await browser.close();
  process.exit(results.fails.length ? 2 : 0);
})().catch((e) => { console.error("fail", e); process.exit(1); });

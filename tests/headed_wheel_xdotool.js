/**
 * Headed real-input test (4339): real Chrome on the X display (DISPLAY, default :3), OS-level xdotool input,
 * screenshots grabbed from the X screen (actual pixels, not page.screenshot) via python3 + Pillow ImageGrab.
 *
 * WHEEL: drag twice (each must move the globe), one wheel notch + a third drag (drag after an anchor hold),
 *   hover the drawn Rhodes, 15 notches (`xdotool click 4`). At notches 5/10/15: screen grab must show map tiles
 *   (non-uniform pixels, tiles loaded) and, with DEBUGQ=1, the magenta debug crosshair. Every notch must log one
 *   sn:wheel line carrying the real clientX/clientY.
 * HUNTS=1: supermarket + pizza in Rhodes (tiles under the pins, every pin inside the visible map box, no label
 *   overlaps), the Gondola row, pizza in Athens (time-to-land ≤ 8 s), "Augoustinos in Rhodes" (one place card,
 *   one pin), Power (countdown visible while held, tag clear of the wallet pill, short tap message).
 * 4338 NO-BLINK: during each Rhodes fit and across Rhodes→Athens (land + pin fit) two samplers run: an X-screen pixel sampler
 *   (map band, every ≤25 ms; a dark frame = the globe) and an in-page requestAnimationFrame sampler (#city on, opacity 1);
 *   both must record zero globe frames, the pixel sampler's p95 gap must be ≤ 50 ms. athens-at-land.png is grabbed the moment
 *   every visible tile at Athens has loaded and must show streets.
 * 4338 LABELS: every FIND pin shows a number badge equal to its FIND row number (row name = pin name), badges and faces are
 *   unobstructed by other faces/labels, visible labels never overlap.
 * 4339: boot LIVE network count + LATEST == /api/version + TESTER hidden (screen grab 'boot'); after Athens a bare
 *   'supermarket' hunts Athens (>= 9 pins, numbered, no stale place text, grab 'athens-supermarket'); the sheet grip is
 *   dragged with xdotool (grows/shrinks the sheet within 96 px..42vh, clear of LIVE; grabs 'grip-*').
 * 4340: the grip is a full-width 28 px strip on the sheet's top edge (see headed_boot_gps_keys.js for the agent-scale drags).
 * 4341: the IP-only boot lands on the IP city view within ~2 s, so the globe drags start after an xdotool click on the
 *   globe button (Global view); the sheet rests below the 42vh cap.
 * 4343: rest is 28 % of the page area and the cap keeps the outer box (grip + card + bottom strip) <= 42 % of the map,
 *   so the room-to-grow check is cap - 20 px.
 * 4342: LIVE reads 'N vendors on SpaceNet' unseated; rest / cap are 30 % / 42 % of the page area (ribbon to dock); a drag
 *   down from rest springs back to rest.
 * Env: PREVIEW_URL, LOCAL_AUTH, STAMP, LOCAL_APP, WIN=1280x800, HOLD, GAP, SPIN, DEBUGQ=1, SHOTDIR, REAL_CHROME=1, HUNTS=1, LAND_MAX=8
 */
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const BASE = process.env.PREVIEW_URL || "https://astranov-git-grokbuild-4328-street-level-gps-astranov.vercel.app/";
const STAMP = process.env.STAMP || "4358";
const URL0 = BASE + (BASE.includes("?") ? "&" : "?") + "v=" + STAMP + "&t=" + Date.now() + (process.env.DEBUGQ ? "&debug=wheel" : "");
const RHODES = { lat: 36.4349, lng: 28.2176 }, ATHENS = { lat: 37.9838, lng: 23.7275 };
const [WW, WH] = (process.env.WIN || "1280x800").split("x").map(Number);
const SHOTDIR = process.env.SHOTDIR || "/tmp/sn-headed";
fs.mkdirSync(SHOTDIR, { recursive: true });
if (!process.env.DISPLAY) process.env.DISPLAY = ":3";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const xdo = (a) => execSync("xdotool " + a, { env: process.env });
function near(a, b, t) { if (!a || !b) return false; let d = Math.abs(a.lng - b.lng); if (d > 180) d = 360 - d; return Math.abs(a.lat - b.lat) < t && d < t; }
const GRAB = path.join(os.tmpdir(), "sn_grab4339.py");
const SAMP = path.join(os.tmpdir(), "sn_samp4339.py");
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
fs.writeFileSync(SAMP, `import sys, time, json, os
from PIL import ImageGrab, ImageStat
out, stop, x, y, w, h, every = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:8])
fdir = out[:-6] + "_frames"; os.makedirs(fdir, exist_ok=True)
f = open(out, "w"); i = 0
while not os.path.exists(stop):
    t = time.time()
    im = ImageGrab.grab(xdisplay="${process.env.DISPLAY}").crop((x, y, x + w, y + h)).convert("RGB")
    st = ImageStat.Stat(im.resize((max(1, w // 8), max(1, h // 8))).convert("L"))
    globe = st.mean[0] < 90
    if globe or i % every == 0: im.resize((max(1, w // 2), max(1, h // 2))).save(os.path.join(fdir, "f%04d%s.png" % (i, "_GLOBE" if globe else "")), compress_level=1)
    f.write(json.dumps({"t": round(t * 1000), "mean": round(st.mean[0], 1), "std": round(st.stddev[0], 1), "globe": globe}) + "\\n"); f.flush(); i += 1
    d = 0.025 - (time.time() - t)
    if d > 0: time.sleep(d)
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
  /* 4350: with LOCAL_APP the live preview's /api/find has no Overpass proxy yet: POST {op:"overpass"} answered by this tree's api/find.js */
  if (process.env.LOCAL_APP) { const fh = require(path.join(__dirname, "..", "api", "find.js"));
    await page.route(/\/api\/find(\?|$)/, async (r) => { const q = r.request(); let b = null; try { b = q.method() === "POST" ? JSON.parse(q.postData() || "{}") : null; } catch (e) { b = null; }
      if (!b || b.op !== "overpass") return r.fallback(); let st = 200, js = null; const rs = { setHeader() {}, status(s) { st = s; return rs; }, json(j) { js = j; return rs; }, end() { return rs; } };
      await fh({ method: "POST", body: b, headers: {} }, rs); return r.fulfill({ status: st, contentType: "application/json", body: JSON.stringify(js) }); }); }
  if (process.env.LOCAL_AUTH) {
    const ab = fs.readFileSync(process.env.LOCAL_AUTH);
    await page.route(/\/js\/spacenet\/auth\.js/, (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: ab }));
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text() + " @ " + ((m.location() || {}).url || "")); });
  page.on("response", (r) => { if (r.status() === 429) console.log("[429]", r.url().slice(0, 200)); });
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
  // ---- 4339 boot: LIVE network count, LATEST, TESTER (real-pixel grab) ----
  {
    await sleep(2500);
    const boot = await page.evaluate(async () => {
      const lj = await (await fetch("/api/live", { cache: "no-store" })).json();
      const vj = await (await fetch("/api/version?t=" + Date.now(), { cache: "no-store" })).json();
      const fx = (s) => /\bTESTER\b|test\s*vendor|\bV?4297\b|tester\s*client/i.test([s.name, s.title, s.note, s.id, s.owner].join(" "));
      const seen = {}; let n = 0;
      (lj.shops || []).forEach((s) => { if (s && s.id && isFinite(+s.lat) && s.status === "live" && !fx(s) && !seen[s.id]) { seen[s.id] = 1; n++; } });
      const t = document.getElementById("sn-tester");
      return { live: (document.getElementById("sn-pulse") || {}).textContent || "", expect: n, latest: (document.getElementById("sn-latest") || {}).textContent || "", api: vj.latest,
        ver: (document.getElementById("ver") || {}).textContent || "", tester: !!(t && getComputedStyle(t).display !== "none" && t.offsetParent !== null && t.textContent.trim()) };
    });
    const gb = await grab("boot", { x: 0, y: 0, w: geo.iw, h: geo.ih });
    console.log("[boot]", JSON.stringify(boot), gb.file);
    check("boot LIVE = real public network (" + boot.expect + ")", (boot.expect > 0 ? new RegExp("^LIVE · " + boot.expect + " vendors? on SpaceNet ·").test(boot.live) : /^LIVE · no public vendors on SpaceNet ·/.test(boot.live)), boot.live);
    check("LATEST == /api/version (with main 4332's update state word)", new RegExp("^LATEST " + boot.api + "( (UPDATED|CHECKING|UPDATING|FAILED TO UPDATE|PLEASE TRY TO UPDATE MANUALLY))?$").test(boot.latest) && /^\d{4,}$/.test(String(boot.api)), boot.latest + " / " + boot.api);
    if (!process.env.LOCAL_APP) check("running V == LATEST == " + STAMP, boot.ver === "V" + STAMP && String(boot.api) === STAMP, boot.ver + " / " + boot.api);
    check("TESTER ticker hidden (guest)", !boot.tester);
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
  // 4341: the boot is on the IP city view by now: back to the globe with a real click on the globe button
  if ((await cam()).cityOn) {
    const gbx = await page.evaluate(() => { const b = document.getElementById("sn-globe").getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    xdo(`mousemove ${S(gbx.x, gbx.y).join(" ")}`); await sleep(100); xdo("click 1"); await sleep(1500);
    const cg = await cam();
    console.log("[globe button]", JSON.stringify(cg));
    check("globe button returns from the IP city view to the globe", !cg.cityOn, JSON.stringify(cg));
  }
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
        const nb = p.querySelector(".sn-no"); const nr = nb && nb.getBoundingClientRect(); const nv = nb && getComputedStyle(nb).visibility !== "hidden" && nr.width > 8 && nr.height > 8;
        const fc = p.querySelector(".sn-pin img,.sn-pin em"); const fr = fc && fc.getBoundingClientRect();
        return { x: b.left, y: b.top, w: b.width, h: b.height, name: l ? l.textContent : "", lab: lv ? { x: lb.left, y: lb.top, w: lb.width, h: lb.height } : null,
          no: nv ? nb.textContent : null, nob: nv ? { x: nr.left, y: nr.top, w: nr.width, h: nr.height } : null, face: fr ? { x: fr.left, y: fr.top, w: fr.width, h: fr.height } : null, moved: p.classList.contains("sn-moved") }; });
      return out;
    });
    const hit = (a, b) => a && b && a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
    const rows = () => page.evaluate(() => [...document.querySelectorAll("#sn-sheet-body .pill")].map((p) => ({ no: ((p.querySelector(".ph") || {}).textContent || "").trim(), name: ((p.querySelector("b") || {}).textContent || "").trim() })));
    function labelCheck(tag, pins, rw, vb) {
      const bad = [], used = {};
      pins.forEach((p, i) => {
        const n = p.no == null ? NaN : +p.no; const row = rw[n - 1];
        if (!(n >= 1) || !row || row.name !== p.name.trim() || String(row.no) !== String(n)) bad.push(`${p.name}#${p.no}≠row`);
        if (used[n]) bad.push(`dup #${n}`); used[n] = 1;
        if (p.nob && (p.nob.y < vb.t - 2 || p.nob.y + p.nob.h > vb.b + 2)) bad.push(`#${n} off the visible map`);
        pins.forEach((q, j) => {
          if (i === j) return;
          if (hit(p.nob, q.face) || hit(p.nob, q.lab) || hit(p.face, q.face)) bad.push(`#${n} covered by ${q.name}`);
          if (p.lab && (hit(p.lab, q.face) || hit(p.lab, q.nob))) bad.push(`label ${p.name} on ${q.name}`);
        });
      });
      check(`${tag} every pin shows its FIND row number (or label), unobstructed`, pins.length > 0 && pins.length === rw.length && bad.length === 0,
        `pins ${pins.length} rows ${rw.length}, badges ${pins.filter((p) => p.no).length}, labels ${pins.filter((p) => p.lab).length}, moved ${pins.filter((p) => p.moved).length}` + (bad.length ? " BAD " + bad.slice(0, 6).join("; ") : ""));
    }
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
    // ---- 4338 no-blink samplers ----
    const { spawn } = require("child_process");
    async function watch(tag, landAt, fn) {
      const vb0 = await visBox();
      const band = { x: 70, y: Math.round(vb0.t + 6), w: geo.iw - 140, h: 110 };
      const out = path.join(SHOTDIR, "blink-" + tag + ".jsonl"), stop = out + ".stop";
      try { fs.unlinkSync(stop); } catch (e) {}
      const pr = spawn("python3", [SAMP, out, stop, String(ox + band.x), String(oy + band.y), String(band.w), String(band.h), "6"], { env: process.env, stdio: "ignore" });
      await page.evaluate((land) => {
        window.__raf = []; window.__rafOn = true; window.__landT = null; window.__raf0 = performance.now();
        const near = (a, b, t) => Math.abs(a - b) < t;
        const tick = () => {
          if (!window.__rafOn) return;
          const c = document.getElementById("city"); const cs = getComputedStyle(c); const m = SN.getMap(); const cc = m && m.getCenter();
          const ims = [...c.querySelectorAll("img.leaflet-tile")].filter((x) => { const b = x.getBoundingClientRect(); return b.right > 0 && b.bottom > 0 && b.left < innerWidth && b.top < innerHeight; });
          const ld = ims.filter((x) => x.complete && x.naturalWidth > 8 && getComputedStyle(x).opacity > 0.9).length;
          const on = c.classList.contains("on") && cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity >= 0.99;
          window.__raf.push([Math.round(performance.now() - window.__raf0), on ? 1 : 0, +cs.opacity, ld, ims.length]);
          if (land && !window.__landT && on && cc && near(cc.lat, land.lat, 0.3) && near(cc.lng, land.lng, 0.3) && ims.length && ld === ims.length) window.__landT = performance.now() - window.__raf0;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, landAt || null);
      await sleep(120);
      const r = await fn();
      await sleep(300);
      const raf = await page.evaluate(() => { window.__rafOn = false; return window.__raf; });
      fs.writeFileSync(stop, "1"); await new Promise((res) => { pr.on("exit", res); setTimeout(res, 2000); });
      const px = fs.readFileSync(out, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
      const gaps = px.slice(1).map((p, i) => p.t - px[i].t).sort((a, b) => a - b);
      const p95 = gaps.length ? gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * 0.95))] : 999, gmax = gaps.length ? gaps[gaps.length - 1] : 999;
      const pxGlobe = px.filter((p) => p.globe).length, domGlobe = raf.filter((f) => !f[1]).length, blank = raf.filter((f) => f[1] && !f[3]).length;
      const rafGaps = raf.slice(1).map((f, i) => f[0] - raf[i][0]); const rafMax = rafGaps.length ? Math.max(...rafGaps) : 999;
      const minMean = px.length ? Math.min(...px.map((p) => p.mean)) : 0;
      console.log(`[blink ${tag}] pixel samples ${px.length} over ${px.length ? px[px.length - 1].t - px[0].t : 0} ms, gap p95 ${p95} max ${gmax} ms, min band mean ${minMean}, globe ${pxGlobe}; rAF frames ${raf.length} (max gap ${rafMax} ms), hidden ${domGlobe}, paper-only (tiles loading) ${blank}; log ${out}`);
      check(`${tag} no globe frame (pixels, every ≤50 ms)`, px.length > 20 && pxGlobe === 0 && p95 <= 50, `${pxGlobe}/${px.length} dark frames, p95 gap ${p95} ms`);
      check(`${tag} no hidden-map frame (every animation frame)`, raf.length > 20 && domGlobe === 0, `${domGlobe}/${raf.length}`);
      return r;
    }
    async function waitFor(fn, ms) { const t = Date.now(); while (Date.now() - t < ms) { const s = await state(); if (fn(s)) return { s, ms: Date.now() - t }; await sleep(200); } return { s: await state(), ms: null }; }
    async function fitCheck(tag, q, place) {
      let land, done;
      await watch(tag + "-fit", null, async () => {
        const tA = await say(q);
        land = await waitFor((s) => s.cityOn && near(s.center, place, 0.3), 15000);
        done = await waitFor((s) => s.find && s.find !== "…", 20000);
        await sleep(1800);
      });
      const vb = await visBox(); const pins = await pinInfo(); const t = await tileInfo(); const rw = await rows();
      const g = await grab(tag, { x: 70, y: vb.t + 4, w: geo.iw - 140, h: Math.max(20, vb.b - vb.t - 8) });
      const inside = pins.filter((p) => p.y >= vb.t - 2 && p.y + p.h <= vb.b + 2 && p.x >= -2 && p.x + p.w <= geo.iw + 2).length;
      const ov = overlaps(pins);
      console.log(`[${q}] land ${land.ms}ms find ${done.s.find} after ${done.ms}ms`, JSON.stringify(done.s).slice(0, 300));
      check(`${tag} tiles under pins`, g.std >= 10 && g.mean > 40 && t.loaded > 0, JSON.stringify(Object.assign({}, t, g)));
      check(`${tag} pins inside visible map (ribbon..sheet)`, pins.length > 0 && inside === pins.length, `${inside}/${pins.length} box ${vb.t.toFixed(0)}..${vb.b.toFixed(0)}`);
      check(`${tag} no overlapping labels`, ov === 0, `overlaps ${ov}, labels shown ${pins.filter((p) => p.lab).length}/${pins.length}`);
      check(`${tag} FIND = pins`, done.s.find && +done.s.find === pins.length, `FIND ${done.s.find} pins ${pins.length}`);
      labelCheck(tag, pins, rw, vb);
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
    let g8 = null, done = null, landMs = null;
    await watch("rhodes-to-athens", ATHENS, async () => {
      const t0 = await page.evaluate(() => performance.now() - window.__raf0);
      await say("pizza in Athens Greece");
      const tw = Date.now();
      while (Date.now() - tw < 20000) { const lt = await page.evaluate(() => window.__landT); if (lt != null) { landMs = lt - t0; break; } await sleep(25); }
      g8 = await grab("athens-at-land");
      done = await waitFor((s) => s.find && s.find !== "…", 20000);
      await sleep(1500);
    });
    const gA = await grab("athens-final");
    const vbA = await visBox(); const pinsA = await pinInfo(); const rwA = await rows();
    labelCheck("athens", pinsA, rwA, vbA);
    check("athens-at-land shows streets", g8 && g8.std >= 10 && g8.mean > 90 && g8.colors >= 60, JSON.stringify(g8));
    const landS = landMs == null ? null : +(landMs / 1000).toFixed(2);
    console.log("[athens] land", landS, "s; FIND", done.s.find, "after", done.ms, "ms;", JSON.stringify(done.s).slice(0, 260));
    check("athens time-to-land ≤ " + (process.env.LAND_MAX || 8) + " s", landS != null && landS <= Number(process.env.LAND_MAX || 8), landS + " s (screens " + g8.file + ", tiles std " + g8.std + ")");
    check("athens pins", done.s.find && +done.s.find > 0 && near(done.s.center, ATHENS, 0.3), "FIND " + done.s.find);
    // ---- 4339: bare follow-up hunts the landed place ----
    {
      const tq = await say("supermarket");
      await sleep(250);
      const line0 = await page.evaluate(() => document.getElementById("line").textContent);
      const fu = await waitFor((s) => s.find && s.find !== "…", 25000);
      await sleep(1800);
      const vbS = await visBox(); const pinsS = await pinInfo(); const rwS = await rows(); const sS = await state();
      const gS = await grab("athens-supermarket", { x: 0, y: 0, w: geo.iw, h: geo.ih });
      console.log("[athens supermarket] find", sS.find, "after", fu.ms, "ms; line at submit", JSON.stringify(line0), JSON.stringify(sS).slice(0, 240), gS.file);
      check("athens → bare supermarket: >= 9 pins on Athens", pinsS.length >= 9 && +sS.find === pinsS.length && near(sS.center, ATHENS, 0.35), `pins ${pinsS.length} FIND ${sS.find}`);
      check("follow-up shows no stale 'Athens Greece' text", !/Greece/i.test(line0) && !/Greece/i.test(sS.line), JSON.stringify(line0));
      check("athens-supermarket pins inside visible map", pinsS.every((p) => p.y >= vbS.t - 2 && p.y + p.h <= vbS.b + 2), `box ${vbS.t.toFixed(0)}..${vbS.b.toFixed(0)}`);
      labelCheck("athens-supermarket", pinsS, rwS, vbS);
      // ---- 4339: grip drag with real input ----
      const gr = () => page.evaluate(() => {
        const vis = (e) => e && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().height > 0;
        const b = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
        const g = document.getElementById("cli-drag"), c = document.getElementById("sn-sheet-card"), p = document.getElementById("sn-pulse");
        return { grip: vis(g) ? b(g) : null, card: vis(c) ? b(c) : null, pulse: vis(p) ? b(p) : null };
      });
      const ovl = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      const g0 = await gr(); const cap = await page.evaluate(() => window.__snGrip.cap()), rest = await page.evaluate(() => window.__snGrip.rest());
      await grab("grip-before", { x: 0, y: 0, w: geo.iw, h: geo.ih });
      check("grip on the sheet top edge, clear of LIVE", !!(g0.grip && g0.card) && g0.grip.y < g0.card.y && g0.grip.y + g0.grip.h >= g0.card.y && g0.grip.h >= 24 && g0.grip.w >= g0.card.w - 2 && !ovl(g0.grip, g0.pulse), JSON.stringify(g0));
      if (g0.grip) {
        await drag(g0.grip.x + g0.grip.w / 2, g0.grip.y + g0.grip.h / 2, 0, 200); await sleep(400);
        const g1 = await gr(); await grab("grip-down", { x: 0, y: 0, w: geo.iw, h: geo.ih });
        await drag(g1.grip.x + g1.grip.w / 2, g1.grip.y + g1.grip.h / 2, 0, -420); await sleep(400);
        const g2 = await gr(); await grab("grip-up", { x: 0, y: 0, w: geo.iw, h: geo.ih });
        console.log("[grip] card h", g0.card.h, "→ down", g1.card.h, "→ up", g2.card.h, "cap", cap);
        check("sheet rests below the 42 % cap (room to grow)", g0.card.h <= cap - 20, g0.card.h + " vs cap " + cap);
        check("xdotool drag down from rest springs back to rest (never parks below)", Math.abs(g1.card.h - Math.min(rest, g0.card.h)) <= 2, g0.card.h + " → " + g1.card.h + " (rest " + rest + ")");
        check("xdotool drag up grows the sheet, capped at 42 %", g2.card.h > g1.card.h + 20 && g2.card.h <= cap + 1, g1.card.h + " → " + g2.card.h + " (cap " + cap + ")");
        check("grip follows the sheet, clear of LIVE", !!g2.grip && g2.grip.y < g2.card.y && g2.grip.y + g2.grip.h >= g2.card.y && g2.grip.h >= 24 && g2.grip.w >= g2.card.w - 2 && !ovl(g2.grip, g2.pulse), JSON.stringify(g2));
      }
    }
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
  const ext = errors.filter((e) => /status of 429/.test(e) && /api\.open-meteo\.com/.test(e));
  if (ext.length) console.log("NOTE third-party rate limit (header temperature, box IP):", ext.length, "x open-meteo 429");
  const errs = errors.filter((e) => ext.indexOf(e) < 0);
  check("no console errors", errs.length === 0, JSON.stringify(errs.slice(0, 5)));
  console.log("SCREENSHOTS", SHOTDIR);
  console.log(results.fails.length ? "HEADED FAIL: " + results.fails.join("; ") : "HEADED ALL PASS");
  await browser.close();
  process.exit(results.fails.length ? 2 : 0);
})().catch((e) => { console.error("fail", e); process.exit(1); });

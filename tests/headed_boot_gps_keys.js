/**
 * Headed real-input test (4340): real Chrome on the X display (DISPLAY, default :3) at the full 1920x1200 screen,
 * OS-level xdotool input mapped through a 1280x800 "agent view" (every coordinate is picked at 1/1.5 scale and
 * rounded, like a computer-use agent on a scaled screenshot), screenshots grabbed from the X screen (real pixels).
 *  BOOT: no input. NEWS/CALENDAR callouts sit outside the globe disc and never on each other; MIC is a cyan icon from boot;
 *    LIVE never shows two different counts (only 'loading…' then the final count); the IP answer completes a camera
 *    move to the IP city view (street map, z10-12.5, labelled approximate, seat kind 'ip' = no hunt seat) within 22 s.
 *  GPS: mid-session CDP geolocation override + permission grant → the app flies to the fix at street level (z>=15) and
 *    the IP label is gone; then a new override + an xdotool click on the GPS button flies to the new fix.
 *  KEYS: three consecutive queries typed with xdotool, each with ONE Return keypress: q1 with focus in the talk box,
 *    q2 after a click on the map (focus off the box, keys typed without clicking it), q3 typed and Return in one burst.
 *    Each must submit on that single Return.
 *  GRIP: the hit strip spans the full sheet width and >= 24 px; xdotool drags from the strip, from the exact sheet edge
 *    and from the title bar each resize the sheet and never move the map; the map pans again afterwards.
 *  MIC: still the same icon after the drags. No console errors (third-party open-meteo 429 is a NOTE).
 * Env: PREVIEW_URL, STAMP, LOCAL_APP, LOCAL_AUTH, SHOTDIR, REAL_CHROME=1, WIN=1920x1200, SCALE=1.5
 */
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const BASE = process.env.PREVIEW_URL || "https://astranov-git-grokbuild-4328-street-level-gps-astranov.vercel.app/";
const STAMP = process.env.STAMP || "4340";
const URL0 = BASE + (BASE.includes("?") ? "&" : "?") + "v=" + STAMP + "&t=" + Date.now();
const ORIGIN = new URL(BASE).origin;
const [WW, WH] = (process.env.WIN || "1920x1200").split("x").map(Number);
const SCALE = Number(process.env.SCALE || 1.5);
const SHOTDIR = process.env.SHOTDIR || "/tmp/sn-headed-4340";
fs.mkdirSync(SHOTDIR, { recursive: true });
if (!process.env.DISPLAY) process.env.DISPLAY = ":3";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const xdo = (a) => execSync("xdotool " + a, { env: process.env });
const SYNTAGMA = { lat: 37.9755, lng: 23.7348 }, RHODES_OLD = { lat: 36.4446, lng: 28.2276 };
const GRAB = path.join(os.tmpdir(), "sn_grab4340.py");
fs.writeFileSync(GRAB, `import sys, json
from PIL import ImageGrab, ImageStat
out, x, y, w, h = sys.argv[1], *map(int, sys.argv[2:6])
im = ImageGrab.grab(xdisplay="${process.env.DISPLAY}").crop((x, y, x + w, y + h)).convert("RGB")
im.save(out, compress_level=1)
st = ImageStat.Stat(im.convert("L"))
small = im.resize((max(1, im.width // 4), max(1, im.height // 4)))
print(json.dumps({"std": round(st.stddev[0], 1), "mean": round(st.mean[0], 1), "colors": len(small.getcolors(1 << 22) or [])}))
`);
const fails = [], notes = [];
function check(name, ok, info) { console.log((ok ? "PASS " : "FAIL ") + name + (info ? " " + info : "")); if (!ok) fails.push(name); }
function km(a, b) { const R = 6371, r = Math.PI / 180; const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }

(async () => {
  const browser = await chromium.launch({ headless: false, executablePath: process.env.REAL_CHROME ? "/usr/bin/google-chrome" : undefined,
    args: ["--window-position=0,0", "--window-size=" + WW + "," + WH, "--no-first-run", "--no-default-browser-check", "--deny-permission-prompts", "--disable-features=Translate"] });
  const ctx = await browser.newContext({ viewport: null, serviceWorkers: process.env.LOCAL_APP ? "block" : "allow" });
  const page = await ctx.newPage();
  if (process.env.LOCAL_APP) { const body = fs.readFileSync(process.env.LOCAL_APP); await page.route(/\/js\/spacenet\/app\.js/, (r) => r.fulfill({ status: 200, contentType: "application/javascript", body })); }
  if (process.env.LOCAL_AUTH) { const ab = fs.readFileSync(process.env.LOCAL_AUTH); await page.route(/\/js\/spacenet\/auth\.js/, (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: ab })); }
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text() + " @ " + ((m.location() || {}).url || "")); });
  page.on("response", (r) => { if (r.status() === 429) console.log("[429]", r.url().slice(0, 160)); });
  await page.addInitScript(() => {
    window.__liveSeq = []; let last = null;
    setInterval(() => { const e = document.getElementById("sn-pulse"); const t = e ? e.textContent : ""; if (t !== last) { last = t; window.__liveSeq.push([Math.round(performance.now()), t]); } }, 50);
    window.addEventListener("mousemove", (e) => { window.__mm = [e.clientX, e.clientY]; }, true);
  });
  const tLoad = Date.now();
  await page.goto(URL0, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.bringToFront();
  await sleep(1500);
  // calibrate the content origin with a hover over the top bar (no click, no drag: the boot is untouched)
  // hover a point that is page content on any window chrome (the app's top bar band), never a click or a drag
  xdo("mousemove 960 150"); await sleep(120); xdo("mousemove 961 151"); await sleep(250);
  const mm = await page.evaluate(() => window.__mm || null);
  if (!mm) { console.log("calibration failed: no mousemove reached the page"); process.exit(3); }
  const ox = 961 - mm[0], oy = 151 - mm[1];
  const geo = await page.evaluate(() => ({ iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio }));
  console.log("content origin", ox, oy, "inner", geo.iw + "x" + geo.ih, "dpr", geo.dpr, "agent scale 1/" + SCALE);
  // agent view: pick in 1280x800 space, round, map back to the real screen
  const A = (x, y) => [Math.round(Math.round((ox + x) / SCALE) * SCALE), Math.round(Math.round((oy + y) / SCALE) * SCALE)];
  async function grab(name, box) {
    const b = box || { x: 0, y: 0, w: geo.iw, h: geo.ih };
    const f = path.join(SHOTDIR, name + ".png");
    const r = JSON.parse(execSync(`python3 ${GRAB} ${f} ${Math.round(ox + b.x)} ${Math.round(oy + b.y)} ${Math.round(b.w)} ${Math.round(b.h)}`).toString());
    r.file = f; return r;
  }
  const state = () => page.evaluate(() => { const m = SN.getMap(); const c = m && m.getCenter(); const city = document.getElementById("city"); const ss = SN.seatState ? SN.seatState() : {};
    return { on: city.classList.contains("on") && getComputedStyle(city).opacity === "1", c: c && { lat: c.lat, lng: c.lng }, z: m && m.getZoom(), kind: ss.kind, here: ss.here, perm: ss.perm,
      line: document.getElementById("line").textContent, live: (document.getElementById("sn-pulse") || {}).textContent, val: document.getElementById("in").value,
      raw: window.__snHuntRaw || "", find: (((document.getElementById("sn-sheet-card") || {}).textContent || "").match(/FIND\s*·\s*(\d+|…)/) || [])[1] || null,
      act: document.activeElement && (document.activeElement.id || document.activeElement.className || document.activeElement.tagName) }; });
  async function waitFor(fn, ms) { const t = Date.now(); let s; while (Date.now() - t < ms) { s = await state(); if (fn(s)) return { s, ms: Date.now() - t }; await sleep(150); } return { s: await state(), ms: null }; }
  const micInfo = () => page.evaluate(() => { const g = document.getElementById("go"); const c = getComputedStyle(g); return { svg: !!g.querySelector("svg"), txt: g.textContent.trim(), color: c.color }; });

  // ---- BOOT (no input) ----
  await sleep(1000);
  const cards = await page.evaluate(() => ({ cards: window.__snCards || [], disc: window.__snDisc || null, cam: SN.getCam() }));
  const gBoot = await grab("boot-globe");
  const outside = (k, d) => { const nx = Math.max(k.x, Math.min(d.cx, k.x + k.w)), ny = Math.max(k.y, Math.min(d.cy, k.y + k.h)); return Math.hypot(nx - d.cx, ny - d.cy) > d.r; };
  const ovl = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const cOut = cards.cards.filter((k) => cards.disc && outside(k, cards.disc)).length;
  let cOv = 0; for (let i = 0; i < cards.cards.length; i++) for (let j = i + 1; j < cards.cards.length; j++) if (ovl(cards.cards[i], cards.cards[j])) cOv++;
  console.log("[boot cards]", JSON.stringify(cards), gBoot.file);
  check("NEWS/CALENDAR callouts outside the globe disc", cards.cards.length > 0 && cOut === cards.cards.length, cOut + "/" + cards.cards.length + " outside (disc r " + (cards.disc && Math.round(cards.disc.r)) + ")");
  check("callouts never on each other", cOv === 0, "overlaps " + cOv);
  const mic0 = await micInfo();
  check("MIC is a cyan icon from boot", mic0.svg && mic0.color === "rgb(77, 240, 255)", JSON.stringify(mic0));
  const ipv = await waitFor((s) => s.on && s.kind === "ip", 26000);
  const ipAt = (Date.now() - tLoad) / 1000;
  await sleep(1200);
  const sIp = await state();
  const gIp = await grab("boot-ip-city");
  console.log("[ip view]", ipAt.toFixed(1) + " s after load", JSON.stringify(sIp).slice(0, 360), gIp.file);
  check("IP-only boot auto-zooms to the IP city view within 22 s", ipv.ms != null && ipAt <= 22 && sIp.on && sIp.here && km(sIp.c, sIp.here) < 3 && sIp.z >= 10 && sIp.z <= 12.5,
    ipAt.toFixed(1) + " s, z" + sIp.z + ", centre " + (sIp.c && sIp.c.lat.toFixed(3) + "," + sIp.c.lng.toFixed(3)));
  check("IP view is labelled approximate and is camera only (no hunt seat)", /Approximate location \(IP\)/.test(sIp.line) && sIp.kind === "ip", JSON.stringify({ line: sIp.line, kind: sIp.kind }));
  check("IP city view shows street tiles (real pixels)", gIp.std >= 10 && gIp.colors >= 60, JSON.stringify(gIp));
  const seq = await page.evaluate(() => window.__liveSeq);
  const counts = [...new Set(seq.map((x) => (x[1].match(/LIVE · (\d+) vendor/) || [])[1]).filter(Boolean))];
  console.log("[live seq]", JSON.stringify(seq.map((x) => x[0] + ":" + x[1])));
  check("LIVE shows one final count (loading first, no jump)", counts.length === 1 && seq.every((x) => !x[1] || /^LIVE · (loading…|\d+ vendors? ·)/.test(x[1])), "counts " + JSON.stringify(counts));

  // ---- GPS granted mid-session (CDP override + permission grant) ----
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setGeolocationOverride", { latitude: SYNTAGMA.lat, longitude: SYNTAGMA.lng, accuracy: 15 });
  await ctx.grantPermissions(["geolocation"], { origin: ORIGIN });
  const gp = await waitFor((s) => s.on && s.kind === "gps" && s.c && km(s.c, SYNTAGMA) < 0.6 && s.z >= 15, 10000);
  await sleep(1500);
  const sG = await state(); const gG = await grab("gps-granted");
  console.log("[gps grant]", gp.ms, "ms", JSON.stringify(sG).slice(0, 300), gG.file);
  check("GPS grant mid-session flies to the fix at street level", gp.ms != null && sG.z >= 15 && km(sG.c, SYNTAGMA) < 0.6, (gp.ms == null ? "never" : gp.ms + " ms") + ", z" + sG.z + ", " + (sG.c && km(sG.c, SYNTAGMA).toFixed(3)) + " km from the fix");
  check("IP label replaced after the GPS fix", !/Approximate/.test(sG.line) && sG.here && sG.here.name === "GPS", JSON.stringify({ line: sG.line, here: sG.here }));
  check("street tiles at the GPS fix (real pixels)", gG.std >= 10 && gG.colors >= 60, JSON.stringify(gG));
  // locate button with a new fix
  await cdp.send("Emulation.setGeolocationOverride", { latitude: RHODES_OLD.lat, longitude: RHODES_OLD.lng, accuracy: 15 });
  const gb = await page.evaluate(() => { const b = document.getElementById("gps").getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  xdo(`mousemove ${A(gb.x, gb.y).join(" ")}`); await sleep(80); xdo("click 1");
  const gpb = await waitFor((s) => s.on && s.c && km(s.c, RHODES_OLD) < 0.6 && s.z >= 15, 10000);
  await sleep(1500);
  const sB = await state(); const gB = await grab("gps-button");
  console.log("[gps button]", gpb.ms, "ms", JSON.stringify(sB).slice(0, 260), gB.file);
  check("GPS button (xdotool click) flies to the new fix", gpb.ms != null, (gpb.ms == null ? "never" : gpb.ms + " ms") + ", z" + sB.z);

  // ---- KEYS: three queries, one Return each ----
  const inb = await page.evaluate(() => { const b = document.getElementById("in").getBoundingClientRect(); return { x: b.left + 120, y: b.top + b.height / 2 }; });
  async function query(q, expectRaw, how) {
    if (how === "map") {
      const p = await page.evaluate(() => { const c = document.getElementById("city").getBoundingClientRect(); const pts = [[0.2, 0.25], [0.8, 0.25], [0.5, 0.18], [0.3, 0.35]];
        for (const [fx, fy] of pts) { const x = c.left + c.width * fx, y = c.top + c.height * fy; const e = document.elementFromPoint(x, y); if (e && e.closest("#city") && !e.closest(".leaflet-marker-icon")) return { x, y }; } return null; });
      if (p) { xdo(`mousemove ${A(p.x, p.y).join(" ")}`); await sleep(60); xdo("click 1"); await sleep(700); }
      const act = (await state()).act; console.log("   focus after map click:", act);
    } else { xdo(`mousemove ${A(inb.x, inb.y).join(" ")}`); await sleep(60); xdo("click 1"); await sleep(250); }
    const before = await state();
    if (how === "burst") execSync(`xdotool type --delay 15 "${q}" && xdotool key Return`, { env: process.env });
    else { xdo(`type --delay 45 "${q}"`); await sleep(120); xdo("key Return"); }
    const sub = await waitFor((s) => s.raw === expectRaw && s.val === "" , 1500);
    const done = await waitFor((s) => s.find && s.find !== "…", 25000);
    await sleep(1500);
    const g = await grab("keys-" + expectRaw);
    console.log(`[${q}] (${how}) submitted after ${sub.ms} ms; FIND ${done.s.find} after ${done.ms} ms; line ${JSON.stringify(done.s.line.slice(0, 70))}`, g.file);
    check(`'${q}' submits on ONE Return (${how})`, sub.ms != null && before.raw !== expectRaw, "raw " + JSON.stringify(sub.s.raw) + " val " + JSON.stringify(sub.s.val));
    check(`'${q}' lands real pins`, done.s.find && +done.s.find > 0, "FIND " + done.s.find);
    return done.s;
  }
  await query("pizza in Athens Greece", "pizza", "box");
  await query("supermarket", "supermarket", "map");
  await query("pharmacy", "pharmacy", "burst");

  // ---- GRIP at agent scale ----
  const gr = () => page.evaluate(() => {
    const b = (e) => { if (!e || getComputedStyle(e).display === "none") return null; const r = e.getBoundingClientRect(); return r.height ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; };
    const card = document.getElementById("sn-sheet-card"), bar = card && card.querySelector(".sheet-bar"), m = SN.getMap(), c = m && m.getCenter();
    return { grip: b(document.getElementById("cli-drag")), card: b(card), bar: b(bar), c: c && { lat: c.lat, lng: c.lng }, mapDrag: window.__snGrip && window.__snGrip.mapDraggable(), pulse: b(document.getElementById("sn-pulse")) };
  });
  const g0 = await gr(); const cap = Math.round(geo.ih * 0.42);
  console.log("[grip]", JSON.stringify(g0));
  check("grip hit strip spans the sheet width, >= 24 px tall, on the top edge", !!(g0.grip && g0.card) && g0.grip.h >= 24 && g0.grip.w >= g0.card.w - 2 && g0.grip.y < g0.card.y && g0.grip.y + g0.grip.h >= g0.card.y, JSON.stringify({ grip: g0.grip, card: g0.card }));
  const hits = await page.evaluate((g) => [0.1, 0.25, 0.5, 0.75, 0.9].map((fx) => { const e = document.elementFromPoint(g.x + g.w * fx, g.y + g.h / 2); return e ? (e.id || e.className || e.tagName) : null; }), g0.grip);
  check("strip is the top element across the sheet width (over the map)", hits.every((h) => h === "cli-drag"), JSON.stringify(hits));
  async function adrag(x, y, dy, tag) {
    await grab(tag + "-before");
    const [a, b] = A(x, y); xdo(`mousemove ${a} ${b}`); await sleep(80); xdo("mousedown 1"); await sleep(60);
    const mid = await page.evaluate(() => window.__snGrip && window.__snGrip.mapDraggable());
    for (let i = 1; i <= 12; i++) { const [c, d] = A(x, y + (dy * i) / 12); xdo(`mousemove ${c} ${d}`); await sleep(20); }
    xdo("mouseup 1"); await sleep(450);
    const g = await grab(tag + "-after");
    return { mid, g };
  }
  // the map "did not move" = the old centre is still within 2 screen px of the map centre (a drag-pan moves it by the drag distance)
  const pxShift = (c) => page.evaluate((cc) => { const m = SN.getMap(); const p = m.latLngToContainerPoint([cc.lat, cc.lng]); const z = m.getSize(); return Math.hypot(p.x - z.x / 2, p.y - z.y / 2); }, c);
  // a) strip, left quarter, 10 px above the edge, drag down
  let r = await adrag(g0.card.x + g0.card.w * 0.25, g0.card.y - 10, 170, "grip-strip");
  const g1 = await gr(); const sh1 = await pxShift(g0.c);
  console.log("[grip strip]", g0.card.h, "→", g1.card.h, "map drag during:", r.mid);
  check("drag on the strip resizes the sheet (down)", g1.card.h < g0.card.h - 40 && g1.card.h >= 95, g0.card.h + " → " + g1.card.h);
  check("strip drag never pans the map; map drag off during, back on after", sh1 <= 2 && r.mid === false && g1.mapDrag === true, JSON.stringify({ shiftPx: +sh1.toFixed(2), during: r.mid, after: g1.mapDrag }));
  // b) the exact sheet edge, right quarter, drag up
  r = await adrag(g1.card.x + g1.card.w * 0.75, g1.card.y + 1, -300, "grip-edge");
  const g2 = await gr(); const sh2 = await pxShift(g1.c);
  console.log("[grip edge]", g1.card.h, "→", g2.card.h, "cap", cap);
  check("drag on the exact sheet edge resizes the sheet (up), capped at 42vh", g2.card.h > g1.card.h + 40 && g2.card.h <= cap + 1, g1.card.h + " → " + g2.card.h + " (cap " + cap + ")");
  check("edge drag never pans the map", sh2 <= 2, "shift " + sh2.toFixed(2) + " px");
  // c) the title bar (between APPLY and the title), drag down
  const findBefore = (await state()).find;
  r = await adrag(g2.card.x + g2.card.w * 0.3, g2.bar ? g2.bar.y + g2.bar.h / 2 : g2.card.y + 14, 140, "grip-bar");
  const g3 = await gr(); const sAfter = await state(); const sh3 = await pxShift(g2.c);
  console.log("[grip bar]", g2.card.h, "→", g3.card.h);
  check("drag on the title bar resizes the sheet", g3.card.h < g2.card.h - 40, g2.card.h + " → " + g3.card.h);
  check("title-bar drag keeps the sheet (no tap fired) and the map still", sAfter.find === findBefore && sh3 <= 2, JSON.stringify({ find: sAfter.find, shiftPx: +sh3.toFixed(2) }));
  check("grip clear of LIVE after resizing", !ovl(g3.grip, g3.pulse), JSON.stringify({ grip: g3.grip, pulse: g3.pulse }));
  // d) the map itself still pans (drag well above the strip)
  r = await adrag(g3.card.x + g3.card.w * 0.5, g3.card.y - 150, -90, "map-pan");
  const g4 = await gr(); const sh4 = await pxShift(g3.c);
  check("map still pans with a drag outside the strip", sh4 >= 40, "moved " + sh4.toFixed(1) + " px");
  const mic1 = await micInfo();
  const gMic = await grab("mic-after-drag", { x: geo.iw - 200, y: geo.ih - 140, w: 200, h: 140 });
  check("MIC unchanged after the drags (same icon, no stray label)", mic1.svg && mic1.color === mic0.color && mic1.txt === "", JSON.stringify(mic1) + " " + gMic.file);

  const ext = errors.filter((e) => /status of 429/.test(e) && /open-meteo/.test(e));
  if (ext.length) console.log("NOTE third-party rate limit (header temperature, box IP):", ext.length, "x open-meteo 429");
  const errs = errors.filter((e) => ext.indexOf(e) < 0);
  check("no console errors", errs.length === 0, JSON.stringify(errs.slice(0, 5)));
  console.log("SCREENSHOTS", SHOTDIR);
  console.log(fails.length ? "HEADED 4340 FAIL: " + fails.join("; ") : "HEADED 4340 ALL PASS");
  await browser.close();
  process.exit(fails.length ? 2 : 0);
})().catch((e) => { console.error("fail", e); process.exit(1); });

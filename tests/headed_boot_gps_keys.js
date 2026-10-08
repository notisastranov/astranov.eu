/**
 * Headed real-input test (4346): real Chrome on the X display (DISPLAY, default :3); run it at WIN=1920x1200 SCALE=1.5
 * (OS-level xdotool input picked in a 1280x800 "agent view" and rounded back, like a computer-use agent on a scaled
 * screenshot) and at WIN=1280x800 SCALE=1. Screenshots are grabbed from the X screen (real pixels).
 *  BOOT: no input. MIC is a cyan icon; LIVE shows 'loading…' then one count, 'N vendors on SpaceNet'; the IP answer lands
 *    on the IP city view (z10-12.5, labelled approximate, camera only) within 5 s of navigation start.
 *  GPS: CDP geolocation grant → street level at the fix, IP label gone; GPS button (xdotool) flies to a new fix; never
 *    'GPS · GPS'. LIVE in GPS mode names the same network count as IP mode ('… · N vendors on SpaceNet'), never 'no public
 *    vendors' while the network has some.
 *  KEYS: three queries, ONE Return each (box / after a map click / burst). Guest copy 'Tap one to see the menu'. The
 *    bare 'pharmacy' at Athens keeps the real count (>= 10; 4341 showed 6 of Nominatim's 16 rows).
 *  GRIP: strip spans the sheet; rest = 28 % of the page area (top ribbon bottom → dock); at the cap the OUTER box (grip
 *    strip top → bottom of the dock strip: status line + input) is <= 42 % of the map height (#city); xdotool drags:
 *    UP from rest grows; UP at the cap stretches >= 20 px with an amber card edge (screenshot while held) and springs
 *    back to the cap; DOWN to between rest and cap stays there; DOWN past rest stretches amber and springs back to rest
 *    (never parks below); the title bar UP grows (no tap). Map centre 0 px (< 0.01) during / after every drag.
 *  LIST (guest): right-click and a long press on the map open LIST: an inset card (>= 8 px margins) no taller than the
 *    42 % cap, green APPLY on the LEFT, red X on the RIGHT, a guest note that listing needs LOGIN. VENDOR: same bar, a
 *    72 px square vendor photo and 72 px menu-row photos; APPLY as a guest says LOGIN, saves nothing, sends nothing
 *    (every non-GET /api/space is recorded and aborted). DRIVER: same. The vendor (menu) card from a FIND row has the
 *    same bar order.
 *  GLOBE: Global view (xdotool) stays on the globe (no sky view, no jump) for 3 s; a NEWS callout tap opens the item
 *    (card with the text, map on Rhodes at z10); wheel notches at Rhodes open the map on the island; a double click on
 *    a city dot or its label (Athens dot, 3-4 px off the Athens dot, the ATHENS label, Istanbul dot + label, the Rhodes
 *    dot) centres the z10 view on that place's coordinates, Crete (no dot) on the surface point under the real clicked
 *    pixel: within 0.05 deg AND the target within 20 real px of the map centre on screen (4344); city labels never overlap;
 *    4345: the Athens point lands on the Leaflet container centre within 1.5 px with #city full-bleed (no vertical
 *    centring offset); the guest's Crete click replayed at 1920x1200 (preview-4344/09: globe turned so the four city dots
 *    sit on the guest's pixels, real pixel 939,462 double clicked) centres on the surface point under that pixel
 *    (<= 0.05 deg, <= 20 px), and the precision bound there is logged (km per real px; the spot the guest meant and
 *    Heraklion are within 2.5 px of the clicked pixel);
 *    4346: a double click never zooms out: open spots (Crete west-central, inland Anatolia) double clicked on the close
 *    globe (dist 0.9) and on the map at z8, z10 and z13 (xdotool, agent-scale rounding), plus the guest's case (wheel into
 *    west Crete to z10.5, double click the agent pixel 560,500): still on the map, zoom after >= zoom before (globe:
 *    >= max(its zoom equivalent, z10); map: z < 10 -> z10, else +1), the clicked point and the ring marker <= 20 px from
 *    the map centre, the readout's lat,lng == the map centre within 0.01 deg;
 *    GPS recalibrate from the globe and from the map never opens the sky view.
 *  LOAD VIEW: no location answer → the globe stays; callouts outside the glow ring, apart, clear of the HUD, at 1280x800
 *    and 1920x1200; LIVE = the real network count.
 *  WEATHER (4343): open-meteo at most once per 0.5 deg place per session (rounded coordinates), nothing after a 429, a
 *    reload in the same tab fetches nothing new, the label is a temperature or DAY / NIGHT; /VERSION is text/plain inline.
 *    4345: every open-meteo request of the whole guest run (fresh load, IP view, GPS grant, GPS button, hunts, globe) is
 *    counted on the CDP network: at most 1, 0.5 deg rounded.
 * Env: PREVIEW_URL, STAMP, LOCAL_APP, LOCAL_AUTH, SHOTDIR, REAL_CHROME=1, WIN=1920x1200, SCALE=1.5
 */
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const BASE = process.env.PREVIEW_URL || "https://astranov-git-grokbuild-4328-street-level-gps-astranov.vercel.app/";
const STAMP = process.env.STAMP || "4346";
const URL0 = BASE + (BASE.includes("?") ? "&" : "?") + "v=" + STAMP + "&t=" + Date.now();
const ORIGIN = new URL(BASE).origin;
const [WW, WH] = (process.env.WIN || "1920x1200").split("x").map(Number);
const SCALE = Number(process.env.SCALE || 1.5);
const SHOTDIR = process.env.SHOTDIR || "/tmp/sn-headed-4346";
fs.mkdirSync(SHOTDIR, { recursive: true });
if (!process.env.DISPLAY) process.env.DISPLAY = ":3";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const xdo = (a) => execSync("xdotool " + a, { env: process.env });
const SYNTAGMA = { lat: 37.9755, lng: 23.7348 }, RHODES_OLD = { lat: 36.4446, lng: 28.2276 };
const GRAB = path.join(os.tmpdir(), "sn_grab4346.py");
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
  const wxNet = []; /* 4345: every open-meteo request on the CDP network (not just what playwright's request event sees) */
  { const nc = await ctx.newCDPSession(page); await nc.send("Network.enable"); nc.on("Network.requestWillBeSent", (e) => { if (/open-meteo\.com/.test(e.request.url)) wxNet.push({ t: Date.now(), url: e.request.url }); }); }
  if (process.env.LOCAL_APP) { const body = fs.readFileSync(process.env.LOCAL_APP); await page.route(/\/js\/spacenet\/app\.js/, (r) => r.fulfill({ status: 200, contentType: "application/javascript", body })); }
  if (process.env.LOCAL_AUTH) { const ab = fs.readFileSync(process.env.LOCAL_AUTH); await page.route(/\/js\/spacenet\/auth\.js/, (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: ab })); }
  const errors = [], posts = [];
  await page.route(/\/api\/space/, (r) => { if (r.request().method() !== "GET") { posts.push(r.request().method() + " " + r.request().url()); return r.abort(); } return r.continue(); });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text() + " @ " + ((m.location() || {}).url || "")); });
  page.on("response", (r) => { if (r.status() === 429) console.log("[429]", r.url().slice(0, 160)); });
  const meteo = [];
  page.on("request", (q) => { if (/api\.open-meteo\.com/.test(q.url())) { const u = new URL(q.url()); meteo.push({ t: Date.now(), lat: u.searchParams.get("latitude"), lng: u.searchParams.get("longitude"), st: null }); } });
  page.on("response", (r) => { if (/api\.open-meteo\.com/.test(r.url())) { const m = meteo.filter((x) => x.st == null).pop(); if (m) { m.st = r.status(); m.tr = Date.now(); } } });
  await page.addInitScript(() => {
    window.__liveSeq = []; let last = null;
    setInterval(() => { const e = document.getElementById("sn-pulse"); const t = e ? e.textContent : ""; if (t !== last) { last = t; window.__liveSeq.push([Math.round(performance.now()), t]); } }, 50);
    window.addEventListener("mousemove", (e) => { window.__mm = [e.clientX, e.clientY]; }, true);
    window.__lineSeq = []; let lastL = null; window.__cardsSeen = null;
    setInterval(() => {
      const l = document.getElementById("line"); const t = l ? l.textContent : ""; if (t !== lastL) { lastL = t; window.__lineSeq.push([Math.round(performance.now()), t]); }
      const c = document.getElementById("city");
      if (window.__cityOnAt == null && c && c.classList.contains("on") && getComputedStyle(c).opacity === "1") window.__cityOnAt = Math.round(performance.now());
      if (window.__snCards && window.__snCards.length && !window.__cardsSeen) window.__cardsSeen = { at: Math.round(performance.now()), cards: JSON.parse(JSON.stringify(window.__snCards)), disc: window.__snDisc, hud: window.__snHud || null };
    }, 25);
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
  const state = () => page.evaluate(() => { const m = SN.getMap(); let c = null; try { c = m && m._loaded ? m.getCenter() : null; } catch (e) { c = null; } const city = document.getElementById("city"); const ss = SN.seatState ? SN.seatState() : {};
    return { on: city.classList.contains("on") && getComputedStyle(city).opacity === "1", c: c && { lat: c.lat, lng: c.lng }, z: m && m.getZoom(), kind: ss.kind, here: ss.here, perm: ss.perm,
      line: document.getElementById("line").textContent, live: (document.getElementById("sn-pulse") || {}).textContent, val: document.getElementById("in").value,
      raw: window.__snHuntRaw || "", find: (((document.getElementById("sn-sheet-card") || {}).textContent || "").match(/FIND\s*·\s*(\d+|…)/) || [])[1] || null,
      act: document.activeElement && (document.activeElement.id || document.activeElement.className || document.activeElement.tagName) }; });
  async function waitFor(fn, ms) { const t = Date.now(); let s; while (Date.now() - t < ms) { s = await state(); if (fn(s)) return { s, ms: Date.now() - t }; await sleep(150); } return { s: await state(), ms: null }; }
  const micInfo = () => page.evaluate(() => { const g = document.getElementById("go"); const c = getComputedStyle(g); return { svg: !!g.querySelector("svg"), txt: g.textContent.trim(), color: c.color }; });

  // ---- BOOT (no input) ----
  const outside = (k, d) => { const R = d.ring || d.r; const nx = Math.max(k.x, Math.min(d.cx, k.x + k.w)), ny = Math.max(k.y, Math.min(d.cy, k.y + k.h)); return Math.hypot(nx - d.cx, ny - d.cy) > R; };
  const ovl = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  function cardCheck(cards, tag) {
    const cOut = cards.cards.filter((k) => cards.disc && outside(k, cards.disc)).length;
    let cOv = 0; for (let i = 0; i < cards.cards.length; i++) for (let j = i + 1; j < cards.cards.length; j++) if (ovl(cards.cards[i], cards.cards[j])) cOv++;
    check("NEWS/CALENDAR callouts outside the globe ring (" + tag + ")", cards.cards.length > 0 && cOut === cards.cards.length, cOut + "/" + cards.cards.length + " outside (disc r " + (cards.disc && Math.round(cards.disc.r)) + ", ring " + (cards.disc && Math.round(cards.disc.ring || 0)) + ")");
    check("callouts never on each other (" + tag + ")", cOv === 0, "overlaps " + cOv);
    if (cards.hud) { const hits = []; cards.cards.forEach((k) => cards.hud.forEach((hb) => { if (ovl(k, hb)) hits.push(k.k + "×" + hb.id); }));
      check("callouts clear of the HUD (wallet, power, buttons) (" + tag + ")", hits.length === 0, hits.length ? JSON.stringify(hits) : cards.hud.length + " HUD boxes clear"); }
  }
  const mic0 = await micInfo();
  check("MIC is a cyan icon from boot", mic0.svg && mic0.color === "rgb(77, 240, 255)", JSON.stringify(mic0));
  const ipv = await waitFor((s) => s.on && s.kind === "ip", 26000);
  const ipAt = ((await page.evaluate(() => window.__cityOnAt)) || (Date.now() - tLoad)) / 1000;
  const seen = await page.evaluate(() => window.__cardsSeen);
  console.log("[boot cards before the zoom]", JSON.stringify(seen));
  if (seen) cardCheck(seen, "boot, before the zoom"); else console.log("NOTE no callouts were drawn before the IP zoom (checked in LOAD VIEW)");
  await sleep(1200);
  const sIp = await state();
  const gIp = await grab("boot-ip-city");
  console.log("[ip view]", ipAt.toFixed(1) + " s after load", JSON.stringify(sIp).slice(0, 360), gIp.file);
  check("IP-only boot auto-zooms to the IP city view within 5 s", ipv.ms != null && ipAt <= 5 && sIp.on && sIp.here && km(sIp.c, sIp.here) < 3 && sIp.z >= 10 && sIp.z <= 12.5,
    ipAt.toFixed(1) + " s, z" + sIp.z + ", centre " + (sIp.c && sIp.c.lat.toFixed(3) + "," + sIp.c.lng.toFixed(3)));
  check("IP view is labelled approximate and is camera only (no hunt seat)", /Approximate location \(IP\)/.test(sIp.line) && sIp.kind === "ip", JSON.stringify({ line: sIp.line, kind: sIp.kind }));
  check("IP city view shows street tiles (real pixels)", gIp.std >= 10 && gIp.colors >= 60, JSON.stringify(gIp));
  const seq = await page.evaluate(() => window.__liveSeq);
  const counts = [...new Set(seq.map((x) => (x[1].match(/LIVE · (\d+) vendor/) || [])[1]).filter(Boolean))];
  console.log("[live seq]", JSON.stringify(seq.map((x) => x[0] + ":" + x[1])));
  check("LIVE shows one final count (loading first, no jump), 'N vendors on SpaceNet'", counts.length === 1 && seq.every((x) => !x[1] || /^LIVE · (loading…|\d+ vendors? on SpaceNet ·)/.test(x[1])), "counts " + JSON.stringify(counts));
  const netN = counts[0];

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
  check("LIVE in GPS mode names the same network count as IP mode (no 'no public vendors')", new RegExp("^LIVE · \\d+ places? here · " + netN + " vendors? on SpaceNet · ").test(sG.live) && !/no public vendors/.test(sG.live), JSON.stringify({ ip: "LIVE · " + netN + " vendors on SpaceNet", gps: sG.live }));
  // locate button with a new fix
  await cdp.send("Emulation.setGeolocationOverride", { latitude: RHODES_OLD.lat, longitude: RHODES_OLD.lng, accuracy: 15 });
  const gb = await page.evaluate(() => { const b = document.getElementById("gps").getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  xdo(`mousemove ${A(gb.x, gb.y).join(" ")}`); await sleep(80); xdo("click 1");
  const gpb = await waitFor((s) => s.on && s.c && km(s.c, RHODES_OLD) < 0.6 && s.z >= 15, 10000);
  await sleep(1500);
  const sB = await state(); const gB = await grab("gps-button");
  console.log("[gps button]", gpb.ms, "ms", JSON.stringify(sB).slice(0, 260), gB.file);
  check("GPS button (xdotool click) flies to the new fix", gpb.ms != null, (gpb.ms == null ? "never" : gpb.ms + " ms") + ", z" + sB.z);
  const lines = await page.evaluate(() => window.__lineSeq.map((x) => x[1]));
  const gpsLines = lines.filter((t) => /^GPS · /.test(t));
  check("status never reads 'GPS · GPS'", gpsLines.length > 0 && !lines.some((t) => /GPS · GPS/.test(t)), JSON.stringify(gpsLines.slice(0, 4)));

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
    check(`'${q}' guest copy: 'Tap one to see the menu' (not 'to order')`, /Tap one to see the menu/.test(done.s.line) && !/Tap one to order/.test(done.s.line), JSON.stringify(done.s.line));
    return done.s;
  }
  await query("pizza in Athens Greece", "pizza", "box");
  await query("supermarket", "supermarket", "map");
  const sPh = await query("pharmacy", "pharmacy", "burst");
  const nomN = await page.evaluate(async () => { const st = SN.seatState(); const h = st.here; if (!h) return null;
    const u = "https://nominatim.openstreetmap.org/search?format=json&limit=16&addressdetails=0&q=pharmacy&viewbox=" + (h.lng - 0.25).toFixed(4) + "," + (h.lat + 0.25).toFixed(4) + "," + (h.lng + 0.25).toFixed(4) + "," + (h.lat - 0.25).toFixed(4) + "&bounded=1";
    try { const j = await (await fetch(u)).json(); return { all: j.length, named: j.filter((r) => r.name).length, places: j.filter((r) => r.name || /^(amenity|shop|healthcare)$/.test(r.class)).length }; } catch (e) { return null; } });
  console.log("[pharmacy] FIND", sPh.find, "nominatim", JSON.stringify(nomN));
  check("pharmacy keeps the real count (unnamed real pharmacies are kept, >= 10)", +sPh.find >= 10 && (!nomN || +sPh.find >= Math.min(nomN.places, 16) - 2), "FIND " + sPh.find + " · nominatim " + JSON.stringify(nomN));

  // ---- GRIP at agent scale (4343: rest 28 % of the page area; the outer box at the cap <= 42 % of the map; stretch, spring) ----
  const gr = () => page.evaluate(() => {
    const b = (e) => { if (!e || getComputedStyle(e).display === "none") return null; const r = e.getBoundingClientRect(); return r.height ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; };
    const card = document.getElementById("sn-sheet-card"), bar = card && card.querySelector(".sheet-bar"), m = SN.getMap(), c = m && m.getCenter(), G = window.__snGrip;
    const isl = document.getElementById("island").getBoundingClientRect();
    return { grip: b(document.getElementById("cli-drag")), card: b(card), bar: b(bar), c: c && { lat: c.lat, lng: c.lng }, z: m && m.getZoom(), mapDrag: G && G.mapDraggable(), pulse: b(document.getElementById("sn-pulse")),
      cap: G && G.cap(), rest: G && G.rest(), area: G && G.area(), ribbon: Math.round(isl.bottom), ih: innerHeight,
      mapH: (() => { const r = document.getElementById("city").getBoundingClientRect(); return r.height > 100 ? Math.min(innerHeight, r.bottom) - Math.max(0, r.top) : innerHeight; })(),
      stripB: Math.min(innerHeight, Math.max(...["dock", "line", "sn-pulse", "sn-sheet-card"].map((id) => { const e = document.getElementById(id); const r = e && e.getBoundingClientRect(); return r && r.height ? r.bottom : 0; }))), edge: G && G.edge && G.edge(), amber: card ? getComputedStyle(card).borderTopColor : "",
      grab: (document.getElementById("cli-drag") || {}).className || "" };
  });
  const g0 = await gr(); const cap = g0.cap, rest = g0.rest;
  console.log("[grip]", JSON.stringify(g0));
  check("grip hit strip spans the sheet width, >= 24 px tall, on the top edge", !!(g0.grip && g0.card) && g0.grip.h >= 24 && g0.grip.w >= g0.card.w - 2 && g0.grip.y < g0.card.y && g0.grip.y + g0.grip.h >= g0.card.y, JSON.stringify({ grip: g0.grip, card: g0.card }));
  const pageArea = g0.card.y + g0.card.h - g0.ribbon;
  check("sheet rests at 28-30 % of the page area (top ribbon → dock)", g0.card.h / pageArea >= 0.275 && g0.card.h / pageArea <= 0.305 && cap > rest + 20,
    "rest " + g0.card.h.toFixed(1) + " / " + pageArea.toFixed(0) + " = " + (g0.card.h / pageArea * 100).toFixed(1) + " % (ribbon bottom " + g0.ribbon + ", dock " + (g0.card.y + g0.card.h).toFixed(0) + ", innerHeight " + g0.ih + "), card cap " + cap);
  const hits = await page.evaluate((g) => [0.1, 0.25, 0.5, 0.75, 0.9].map((fx) => { const e = document.elementFromPoint(g.x + g.w * fx, g.y + g.h / 2); return e ? (e.id || e.className || e.tagName) : null; }), g0.grip);
  check("strip is the top element across the sheet width (over the map)", hits.every((h) => h === "cli-drag"), JSON.stringify(hits));
  const mapPt = (c) => page.evaluate((cc) => { const m = SN.getMap(); const p = m.latLngToContainerPoint([cc.lat, cc.lng]); const r = document.getElementById("city").getBoundingClientRect(); return { x: p.x + r.left, y: p.y + r.top, z: m.getZoom() }; }, c);
  async function adrag(x, y, dy, tag, holdShot) {
    await grab(tag + "-before");
    const s0 = await gr(); const p0 = await mapPt(s0.c);
    const [a, b] = A(x, y); xdo(`mousemove ${a} ${b}`); await sleep(80); xdo("mousedown 1"); await sleep(60);
    const mid = await page.evaluate(() => window.__snGrip && window.__snGrip.mapDraggable());
    let maxD = 0, maxH = 0, minHh = 1e9, edges = new Set(), zMoved = false, amberSeen = false;
    for (let i = 1; i <= 12; i++) {
      const [c, d] = A(x, y + (dy * i) / 12); xdo(`mousemove ${c} ${d}`); await sleep(20);
      const p = await mapPt(s0.c); maxD = Math.max(maxD, Math.hypot(p.x - p0.x, p.y - p0.y)); if (p.z !== p0.z) zMoved = true;
      const gi = await gr(); maxH = Math.max(maxH, gi.card.h); minHh = Math.min(minHh, gi.card.h); if (gi.edge) edges.add(gi.edge); if (/255, 179, 71/.test(gi.amber)) amberSeen = true;
    }
    let held = null;
    if (holdShot) { await sleep(250); held = await grab(tag + "-held"); }
    xdo("mouseup 1"); await sleep(110);
    const spring = holdShot ? await grab(tag + "-spring") : null; const gSpring = await gr();
    await sleep(340);
    const p1 = await mapPt(s0.c); const after = Math.hypot(p1.x - p0.x, p1.y - p0.y); if (p1.z !== p0.z) zMoved = true;
    await sleep(900); /* late refits / invalidateSize would land here */
    const p2 = await mapPt(s0.c); const late = Math.hypot(p2.x - p0.x, p2.y - p0.y); if (p2.z !== p0.z) zMoved = true;
    const g = await grab(tag + "-after");
    const s1 = await gr();
    const shift = { during: +maxD.toFixed(3), after: +after.toFixed(3), late: +late.toFixed(3), zoom: zMoved ? "changed" : "same" };
    console.log(`[${tag}] h ${s0.card.h.toFixed(1)} → ${s1.card.h.toFixed(1)} (during ${minHh.toFixed(1)}..${maxH.toFixed(1)}, +110 ms ${gSpring.card.h.toFixed(1)}, rest ${rest}, cap ${cap}) amber ${amberSeen} map shift ${JSON.stringify(shift)} drag during ${mid} after ${s1.mapDrag} edges ${JSON.stringify([...edges])}`, g.file, held ? held.file : "");
    return { mid, g, s0, s1, maxH, minH: minHh, edges, amberSeen, gSpring, shift, still: maxD < 0.01 && after < 0.01 && late < 0.01 && !zMoved };
  }
  // a) strip, left quarter, 10 px above the edge, drag UP from rest: grows
  let r = await adrag(g0.card.x + g0.card.w * 0.25, g0.card.y - 10, -(cap - rest + 10), "grip-up");
  check("strip drag UP from rest grows the sheet (to the cap at most)", r.s1.card.h > r.s0.card.h + Math.min(30, (cap - rest) * 0.6) && r.s1.card.h <= cap + 1, r.s0.card.h.toFixed(1) + " → " + r.s1.card.h.toFixed(1) + " (cap " + cap + ")");
  check("UP drag: map centre 0 px (before / during / after), map drag off during, on after", r.still && r.mid === false && r.s1.mapDrag === true, JSON.stringify(Object.assign({ during: r.mid, after: r.s1.mapDrag }, r.shift)));
  // b) at the cap, drag UP again: a visible amber stretch, then it springs back to the cap
  let gc = await gr();
  r = await adrag(gc.card.x + gc.card.w * 0.6, gc.card.y - 10, -180, "grip-cap", true);
  check("UP at the cap stretches visibly (>= 20 px, amber edge, MAX pill) and springs back to the cap", r.edges.has("max") && r.amberSeen && r.maxH >= cap + 20 && r.maxH <= cap + 49 && Math.abs(r.s1.card.h - cap) <= 1,
    JSON.stringify({ edges: [...r.edges], amber: r.amberSeen, maxDuring: +r.maxH.toFixed(1), at110ms: +r.gSpring.card.h.toFixed(1), after: +r.s1.card.h.toFixed(1), cap }));
  check("cap drag: map centre 0 px", r.still, JSON.stringify(r.shift));
  { const o = r.s1, top = Math.min(o.grip ? o.grip.y : 1e9, o.card.y), outer = o.stripB - top;
    check("at the cap the OUTER box (grip strip + card + bottom strip / LIVE / dock) is <= 42 % of the map", outer / o.mapH <= 0.422 && outer / o.mapH >= 0.38,
      "outer " + outer.toFixed(0) + " px (grip top " + top.toFixed(0) + " → strip bottom " + o.stripB.toFixed(0) + ") / map " + o.mapH.toFixed(0) + " = " + (outer / o.mapH * 100).toFixed(1) + " %; card " + o.card.h.toFixed(0) + " = " + (o.card.h / pageArea * 100).toFixed(1) + " % of ribbon→dock"); }
  // c) the exact edge, DOWN to between rest and cap: it stays where it is let go
  gc = await gr();
  const half = Math.round((cap - rest) / 2);
  r = await adrag(gc.card.x + gc.card.w * 0.75, gc.card.y + 1, half, "grip-down");
  check("drag DOWN to between rest and the cap stays where it is let go", r.s1.card.h < r.s0.card.h - Math.min(15, half * 0.6) && r.s1.card.h > rest + 3 && Math.abs(r.s1.card.h - (r.s0.card.h - half)) <= 6, r.s0.card.h.toFixed(1) + " → " + r.s1.card.h.toFixed(1) + " (rest " + rest + ", cap " + cap + ")");
  check("DOWN drag: map centre 0 px (before / during / after)", r.still && r.mid === false && r.s1.mapDrag === true, JSON.stringify(r.shift));
  // d) DOWN past rest: amber stretch, springs back to rest, never parks below it
  gc = await gr();
  r = await adrag(gc.card.x + gc.card.w * 0.4, gc.card.y - 10, (gc.card.h - rest) + 160, "grip-rest", true);
  check("DOWN past rest stretches visibly (amber, REST pill) and springs back to rest (never parks below)", r.edges.has("min") && r.amberSeen && r.minH <= rest - 20 && Math.abs(r.s1.card.h - rest) <= 1,
    JSON.stringify({ edges: [...r.edges], amber: r.amberSeen, minDuring: +r.minH.toFixed(1), after: +r.s1.card.h.toFixed(1), rest }));
  check("past-rest drag: map centre 0 px", r.still, JSON.stringify(r.shift));
  // e) the title bar (between APPLY and the title), drag UP: grows, no tap fired
  const findBefore = (await state()).find;
  gc = await gr();
  r = await adrag(gc.card.x + gc.card.w * 0.3, gc.bar ? gc.bar.y + gc.bar.h / 2 : gc.card.y + 14, -(cap - rest - 10), "grip-bar");
  const sAfter = await state();
  check("drag UP on the title bar grows the sheet", r.s1.card.h > r.s0.card.h + Math.min(30, (cap - rest - 10) * 0.6), r.s0.card.h.toFixed(1) + " → " + r.s1.card.h.toFixed(1));
  check("title-bar drag keeps the sheet (no tap fired) and the map centre 0 px", sAfter.find === findBefore && r.still, JSON.stringify(Object.assign({ find: sAfter.find }, r.shift)));
  const g3 = await gr();
  check("grip clear of LIVE after resizing", !ovl(g3.grip, g3.pulse), JSON.stringify({ grip: g3.grip, pulse: g3.pulse }));
  // e) the map itself still pans (drag well above the strip)
  const pBefore = await mapPt(g3.c);
  await grab("map-pan-before");
  { const [a, b] = A(g3.card.x + g3.card.w * 0.5, g3.card.y - 150); xdo(`mousemove ${a} ${b}`); await sleep(80); xdo("mousedown 1"); await sleep(60);
    for (let i = 1; i <= 12; i++) { const [c, d] = A(g3.card.x + g3.card.w * 0.5, g3.card.y - 150 - (90 * i) / 12); xdo(`mousemove ${c} ${d}`); await sleep(20); }
    xdo("mouseup 1"); await sleep(450); }
  await grab("map-pan-after");
  const pAfter = await mapPt(g3.c); const sh4 = Math.hypot(pAfter.x - pBefore.x, pAfter.y - pBefore.y);
  check("map still pans with a drag outside the strip", sh4 >= 40, "moved " + sh4.toFixed(1) + " px");
  const mic1 = await micInfo();
  const gMic = await grab("mic-after-drag", { x: geo.iw - 200, y: geo.ih - 140, w: 200, h: 140 });
  check("MIC unchanged after the drags (same icon, no stray label)", mic1.svg && mic1.color === mic0.color && mic1.txt === "", JSON.stringify(mic1) + " " + gMic.file);

  // ---- LIST as a guest: hold menu, VENDOR, DRIVER (nothing saved, nothing sent) ----
  const sheetInfo = () => page.evaluate(() => { const sh = document.getElementById("sn-sheet"), c = document.getElementById("sn-sheet-card"); const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.height ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null; };
    const ap = c && c.querySelector(".sheet-bar .sheet-apply"), x = c && c.querySelector(".sheet-bar .sheet-x");
    return { on: !!(sh && sh.classList.contains("on")), kind: sh && sh.getAttribute("data-kind"), title: c && ((c.querySelector(".sheet-mid") || {}).textContent || ""), card: R(c), iw: innerWidth, cap: window.__snGrip.cap(),
      apply: ap && Object.assign(R(ap), { t: ap.textContent.trim(), color: getComputedStyle(ap).color }), x: x && Object.assign(R(x), { t: x.textContent.trim(), color: getComputedStyle(x).color }),
      photo: R(c && c.querySelector(".sn-photo")), rowPhoto: R(c && c.querySelector(".sn-row .phbtn")), guest: !!(c && c.querySelector(".sn-guest")), text: c ? c.textContent.replace(/\s+/g, " ").slice(0, 200) : "" }; });
  const barLaw = (si) => !!(si.apply && si.x) && si.apply.t === "APPLY" && /125, 255, 154/.test(si.apply.color) && si.apply.x < si.card.x + si.card.w * 0.25 && /^(X|✕)$/.test(si.x.t) && /255, 138, 138/.test(si.x.color) && si.x.x > si.card.x + si.card.w * 0.75;
  const inset = (si) => !!si.card && si.card.x >= 8 && si.iw - (si.card.x + si.card.w) >= 8 && si.card.h <= si.cap + 1;
  const closeSheet = async () => { const xb = await page.evaluate(() => { const b = document.querySelector("#sn-sheet .sheet-bar .sheet-x"); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); if (xb) { xdo(`mousemove ${A(xb.x, xb.y).join(" ")}`); await sleep(60); xdo("click 1"); await sleep(600); } };
  /* a control below the fold of the 30 % card: scroll the card with the real wheel (xdotool) until it shows, as a user would */
  const elBox = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const cd = e.closest("#sn-sheet") && document.querySelector("#sn-sheet .card");
    const cr = cd && cd.getBoundingClientRect(); const bar = document.querySelector("#sn-sheet .sheet-bar"); const br = bar && bar.getBoundingClientRect();
    const top = cr ? Math.max(cr.top, br ? br.bottom : cr.top) : 0, bot = cr ? cr.bottom : innerHeight; const cy = r.y + r.height / 2;
    return { x: r.x + r.width / 2, y: cy, vis: !cr || (cy > top + 4 && cy < bot - 4), mid: cr && { x: cr.x + cr.width / 2, y: (top + bot) / 2 }, down: cr ? cy >= bot - 4 : false }; }, sel);
  const clickEl = async (sel) => { let b = await elBox(sel); if (!b) return false;
    for (let k = 0; k < 16 && b && !b.vis && b.mid; k++) { xdo(`mousemove ${A(b.mid.x, b.mid.y).join(" ")}`); await sleep(40); xdo(b.down ? "click 5" : "click 4"); await sleep(160); b = await elBox(sel); }
    if (!b) return false; xdo(`mousemove ${A(b.x, b.y).join(" ")}`); await sleep(70); xdo("click 1"); await sleep(250); return true; };
  // a vendor (menu) card from a FIND row: same bar order
  if (await clickEl("#sn-sheet [data-act='vendor']")) {
    await sleep(900); const vi = await sheetInfo(); const gV = await grab("card-vendor-menu");
    console.log("[vendor menu card]", JSON.stringify(vi).slice(0, 400), gV.file);
    check("vendor (menu) card: green APPLY left, red X right, inset, <= 42 %", vi.kind === "vendor" && barLaw(vi) && inset(vi), JSON.stringify({ kind: vi.kind, apply: vi.apply, x: vi.x, card: vi.card, cap: vi.cap }));
  } else check("vendor (menu) card: a FIND row to tap", false, "no FIND row");
  await closeSheet();
  const mine0 = await page.evaluate(() => localStorage.getItem("sn:mine"));
  const people0 = await page.evaluate(() => localStorage.getItem("sn:people"));
  const mp = await page.evaluate(() => { const c = document.getElementById("city").getBoundingClientRect(); const pts = [[0.35, 0.3], [0.6, 0.25], [0.45, 0.4], [0.7, 0.35]];
    for (const [fx, fy] of pts) { const x = c.left + c.width * fx, y = c.top + c.height * fy; const e = document.elementFromPoint(x, y); if (e && e.closest("#city") && !e.closest(".leaflet-marker-icon")) return { x, y }; } return null; });
  xdo(`mousemove ${A(mp.x, mp.y).join(" ")}`); await sleep(80); xdo("click 3"); await sleep(1200);
  let si = await sheetInfo(); let gL = await grab("list-hold-menu");
  console.log("[hold → LIST]", JSON.stringify(si).slice(0, 500), gL.file);
  check("right-click (hold) opens LIST: an inset card no taller than the 42 % cap", si.on && si.kind === "list" && inset(si), JSON.stringify({ card: si.card, iw: si.iw, cap: si.cap }));
  check("LIST bar: green APPLY on the LEFT, red X on the RIGHT", barLaw(si), JSON.stringify({ apply: si.apply, x: si.x }));
  check("LIST says up front that listing needs LOGIN (guest)", si.guest && /listing needs LOGIN/.test(si.text), JSON.stringify(si.text.slice(0, 140)));
  await closeSheet();
  xdo(`mousemove ${A(mp.x + 30, mp.y + 10).join(" ")}`); await sleep(80); xdo("mousedown 1"); await sleep(750); xdo("mouseup 1"); await sleep(1200);
  si = await sheetInfo();
  check("long press (750 ms) opens LIST too", si.on && si.kind === "list", JSON.stringify({ kind: si.kind, title: si.title }));
  await clickEl("#sn-sheet [data-act='form-vendor']"); await sleep(900);
  si = await sheetInfo(); gL = await grab("list-vendor-card");
  console.log("[VENDOR card]", JSON.stringify(si).slice(0, 500), gL.file);
  check("VENDOR card: inset, <= 42 %, green APPLY left, red X right", si.title === "VENDOR" && inset(si) && barLaw(si), JSON.stringify({ card: si.card, apply: si.apply, x: si.x, cap: si.cap }));
  check("VENDOR photo is a 72 px square; menu-row photos are 72 px squares", !!si.photo && Math.abs(si.photo.w - 72) <= 1 && Math.abs(si.photo.h - 72) <= 1 && !!si.rowPhoto && Math.abs(si.rowPhoto.w - 72) <= 1 && Math.abs(si.rowPhoto.h - 72) <= 1, JSON.stringify({ photo: si.photo, row: si.rowPhoto }));
  check("VENDOR card tells a guest that listing needs LOGIN", si.guest && /LOGIN to list a vendor/.test(si.text), JSON.stringify(si.text.slice(0, 120)));
  if (await clickEl("#sn-place-name")) { xdo('type --delay 30 "Headed Probe Kiosk"'); await sleep(200); }
  await clickEl("#sn-sheet .sheet-bar .sheet-apply"); await sleep(1500);
  let sv = await state(); gL = await grab("list-vendor-apply-guest");
  const mine1 = await page.evaluate(() => localStorage.getItem("sn:mine"));
  const kiosk = await page.evaluate(() => (SN.visibleShops() || []).filter((x) => /Headed Probe Kiosk/.test(x.name || "")).length);
  console.log("[VENDOR apply as guest]", JSON.stringify(sv.line), "posts", JSON.stringify(posts), "mine same", mine1 === mine0, "kiosk pins", kiosk, gL.file);
  check("VENDOR APPLY as a guest says LOGIN honestly; nothing saved, nothing sent, no pin", /LOGIN to list this vendor\. Nothing was saved or sent\./.test(sv.line) && posts.length === 0 && mine1 === mine0 && kiosk === 0, JSON.stringify({ line: sv.line, posts, mineSame: mine1 === mine0, kiosk }));
  await closeSheet();
  xdo(`mousemove ${A(mp.x, mp.y).join(" ")}`); await sleep(80); xdo("click 3"); await sleep(1200);
  await clickEl("#sn-sheet [data-act='form-driver']"); await sleep(900);
  si = await sheetInfo();
  check("DRIVER card: inset, <= 42 %, green APPLY left, red X right", si.title === "DRIVER" && inset(si) && barLaw(si), JSON.stringify({ card: si.card, apply: si.apply, x: si.x }));
  if (await clickEl("#sn-drv-name")) { xdo('type --delay 30 "Headed Probe Rider"'); await sleep(200); }
  await clickEl("#sn-sheet .sheet-bar .sheet-apply"); await sleep(1500);
  sv = await state();
  const people1 = await page.evaluate(() => localStorage.getItem("sn:people"));
  check("DRIVER APPLY as a guest says LOGIN; no local driver pin, nothing sent", /LOGIN to list a driver base\. Nothing was saved or sent\./.test(sv.line) && posts.length === 0 && people1 === people0, JSON.stringify({ line: sv.line, posts, peopleSame: people1 === people0 }));
  await closeSheet();

  // ---- GLOBE: Global view, NEWS tap, Rhodes wheel / double click, GPS recalibrate (never the sky view) ----
  const cs = () => page.evaluate(() => { const c = SN.getCam(); const m = SN.getMap(); let mc = null; try { mc = m && m._loaded ? m.getCenter() : null; } catch (e) {} const sky = document.getElementById("sn-sky"); const sh = document.getElementById("sn-sheet");
    return { dist: +c.dist.toFixed(3), cityOn: c.cityOn && document.getElementById("city").classList.contains("on"), z: m && m.getZoom(), c: mc && { lat: mc.lat, lng: mc.lng }, sky: !!(sky && !sky.hidden), line: document.getElementById("line").textContent, brief: window.__snBrief || null,
      sheet: sh && sh.classList.contains("on") ? ((document.querySelector("#sn-sheet .sheet-mid") || {}).textContent || "") + " | " + ((document.getElementById("sn-sheet-body") || {}).textContent || "").slice(0, 120) : "" }; });
  async function watchSky(ms) { const t = Date.now(); let sky = false, s = null; while (Date.now() - t < ms) { s = await cs(); if (s.sky) sky = true; await sleep(150); } return { sky, s }; }
  const onRhodes = (c) => !!c && c.lat > 35.85 && c.lat < 36.47 && c.lng > 27.68 && c.lng < 28.26; /* Rhodes island box */
  const gbtn = await page.evaluate(() => { const b = document.getElementById("sn-globe").getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  const globeBtn = async () => { xdo(`mousemove ${A(gbtn.x, gbtn.y).join(" ")}`); await sleep(70); xdo("click 1"); };
  await globeBtn();
  let w = await watchSky(3000); let gg = await grab("globe-global-view");
  console.log("[global view]", JSON.stringify(w.s).slice(0, 220), gg.file);
  check("Global view (xdotool) stays on the globe for 3 s: no sky view, no jump", !w.sky && !w.s.cityOn && Math.abs(w.s.dist - 1.85) < 0.05, JSON.stringify({ sky: w.sky, cityOn: w.s.cityOn, dist: w.s.dist }));
  const faceRhodes = async () => { await page.evaluate(() => SN.lookAt({ lat: 36.25, lng: 28.0 }, 1.85)); await sleep(1200); }; /* setup: turn the globe to Rhodes (not a user action) */
  await faceRhodes();
  const cards2 = await page.evaluate(() => window.__snCards || []);
  const nw = cards2.find((k) => k.k === "NEWS");
  if (nw) {
    xdo(`mousemove ${A(nw.x + nw.w / 2, nw.y + nw.h / 2).join(" ")}`); await sleep(70); xdo("click 1");
    await sleep(2200); const sN = await cs(); gg = await grab("globe-news-tap");
    console.log("[NEWS tap]", JSON.stringify(sN).slice(0, 400), gg.file);
    check("tapping the NEWS callout opens the item: card with the text, map on Rhodes at z10, no sky view", !sN.sky && sN.cityOn && sN.z === 10 && sN.c && km(sN.c, nw) < 15 && onRhodes(sN.c) && /^NEWS \| .*mainly Rhodes/.test(sN.sheet), JSON.stringify({ z: sN.z, c: sN.c, sheet: sN.sheet.slice(0, 90), sky: sN.sky }));
  } else check("tapping the NEWS callout opens the item", false, "no NEWS callout drawn facing Rhodes");
  await closeSheet();
  await globeBtn(); await sleep(1200); await faceRhodes();
  let rp = await page.evaluate(() => SN.projectFrame(36.25, 28.0));
  xdo(`mousemove ${A(rp.x, rp.y).join(" ")}`); await sleep(100);
  let firstCity = null;
  for (let i = 0; i < 8 && !firstCity; i++) { xdo("click 4"); await sleep(650); const sW = await cs(); if (sW.cityOn) firstCity = sW; }
  await sleep(1200); gg = await grab("globe-wheel-rhodes");
  console.log("[wheel at Rhodes] first map frame", JSON.stringify(firstCity).slice(0, 260), gg.file);
  check("wheel notches at Rhodes open the map on the island (centre on Rhodes, z <= 11, says island view)", !!firstCity && firstCity.z <= 11 && onRhodes(firstCity.c) && /^Island \/ region view/.test(firstCity.line) && !firstCity.sky, JSON.stringify(firstCity && { z: firstCity.z, c: firstCity.c, line: firstCity.line }));
  // 4344: a double click centres the z10 view on the clicked place: a city dot (Athens, Istanbul, the Rhodes callout dot)
  // or a city's label -> that place's own coordinates (hard-coded here, not read from the app); anywhere else -> the globe
  // point under the pixel the OS click really landed on (after the agent-scale rounding). Within 0.05 deg, and on screen the
  // target lands within 20 real px of the map centre. Input: xdotool at agent scale (1280x800 picks, rounded, x SCALE).
  const PLACES = { ATHENS: { lat: 37.98, lng: 23.73 }, ISTANBUL: { lat: 41.01, lng: 28.98 }, RHODES: { lat: 36.44, lng: 28.23 }, CALENDAR: { lat: 36.45, lng: 28.22 } };
  const toGlobe = async () => { for (let i = 0; i < 4; i++) { await globeBtn(); await sleep(1200); const s0 = await cs(); if (!s0.cityOn) return true; } return false; };
  const drawn = () => page.evaluate(() => ({ cards: (window.__snCards || []).map((k) => ({ n: k.k, px: k.px, py: k.py, lat: +k.lat, lng: +k.lng })),
    sites: (window.__snSites || []).map((q) => ({ n: q.n, px: q.px, py: q.py, lat: q.lat, lng: q.lng, l: q.lw ? { x: q.lx, y: q.ly, w: q.lw, h: q.lh } : null })) }));
  const EU = { lat: 22, lng: 14 }; /* the Europe / Africa face the guest double clicked Athens from (preview-4343/02) */
  {
    await toGlobe(); await page.evaluate((l) => SN.lookAt(l, 1.85), EU); await sleep(1400);
    const dr = await drawn(); const gl = await grab("globe-city-labels");
    const lab = dr.sites.filter((q) => q.l);
    let clash = [];
    for (let i = 0; i < lab.length; i++) for (let j = i + 1; j < lab.length; j++) { const u = lab[i].l, v = lab[j].l; if (u.x < v.x + v.w && u.x + u.w > v.x && u.y < v.y + v.h && u.y + u.h > v.y) clash.push(lab[i].n + "/" + lab[j].n); }
    lab.forEach((q) => dr.sites.forEach((o) => { const qx = Math.max(q.l.x, Math.min(o.px, q.l.x + q.l.w)), qy = Math.max(q.l.y, Math.min(o.py, q.l.y + q.l.h)); if (Math.hypot(qx - o.px, qy - o.py) < 6) clash.push(q.n + " label on " + o.n + " dot"); }));
    console.log("[city labels]", JSON.stringify(dr.sites.map((q) => ({ n: q.n, dot: [Math.round(q.px), Math.round(q.py)], l: q.l }))), gl.file);
    check("city dots carry name labels (ATHENS, ISTANBUL drawn), labels never on each other or on a dot", !!dr.sites.find((q) => q.n === "ATHENS" && q.l) && !!dr.sites.find((q) => q.n === "ISTANBUL" && q.l) && !clash.length, JSON.stringify({ labels: lab.map((q) => q.n), clash }));
  }
  const dbl = async (tag, look, spec) => {
    await toGlobe();
    await page.evaluate((l) => SN.lookAt(l, 1.85), look); await sleep(1400); /* setup: turn the globe (not a user action) */
    const dr = await drawn(); const dots = dr.cards.concat(dr.sites);
    let pt = null, want = null;
    if (spec.dot) { const k = dots.find((c) => c.n === spec.dot); if (k) { pt = { x: k.px + (spec.off ? spec.off[0] : 0), y: k.py + (spec.off ? spec.off[1] : 0) }; want = PLACES[spec.dot]; } }
    else if (spec.label) { const k = dr.sites.find((c) => c.n === spec.label); if (k && k.l) { pt = { x: k.l.x + k.l.w / 2, y: k.l.y + k.l.h / 2 }; want = PLACES[spec.label]; } }
    else pt = await page.evaluate((a) => SN.projectFrame(a.lat, a.lng), spec);
    if (!pt) return { s: null, target: null, d: null, why: "no " + (spec.dot || spec.label || "point") + " drawn on screen" };
    const [sx, sy] = A(pt.x, pt.y); const px = sx - ox, py = sy - oy; /* the page pixel the OS click lands on */
    let near = null, nd = 9; dots.forEach((k) => { const dd = Math.hypot(k.px - px, k.py - py); if (dd <= 8 && dd < nd) { nd = dd; near = k; } });
    const onLabel = dr.sites.find((k) => k.l && px >= k.l.x - 3 && px <= k.l.x + k.l.w + 3 && py >= k.l.y - 3 && py <= k.l.y + k.l.h + 3);
    const pick = await page.evaluate((q) => SN.globeHitTest(q[0], q[1]), [px, py]);
    let target;
    if (want) {
      /* the clicked point must really be on that place's dot (nearest drawn dot within 8 px) or label; the Rhodes callout
         dot and the RHODES city dot are the same place, so whichever is nearer is the target */
      const same = near && Math.abs(near.lat - want.lat) < 0.02 && Math.abs(near.lng - want.lng) < 0.02;
      const on = spec.dot ? !!same : !!(onLabel && onLabel.n === spec.label && !near);
      const t = spec.dot && same && PLACES[near.n] ? PLACES[near.n] : want;
      target = { lat: t.lat, lng: t.lng, by: spec.dot ? (near ? near.n : spec.dot) + " dot (" + (near ? nd.toFixed(1) : "?") + " px off)" : spec.label + " label", on };
    } else target = pick && !near && !onLabel ? { lat: +pick.lat, lng: +pick.lng, by: "globe point under the clicked pixel", on: true } : { lat: NaN, lng: NaN, by: "a dot or label is under the free point", on: false };
    xdo(`mousemove ${sx} ${sy}`); await sleep(100); xdo("click --repeat 2 --delay 90 1");
    await sleep(2200); const s = await cs(); const g = await grab(tag);
    const scr = await page.evaluate((t) => { const m = SN.getMap(); if (!m || !m._loaded || !isFinite(t.lat)) return null; const sz = m.getSize(); const q = m.latLngToContainerPoint([t.lat, t.lng]); const r = document.getElementById("city").getBoundingClientRect();
      return { dx: +(q.x - sz.x / 2).toFixed(1), dy: +(q.y - sz.y / 2).toFixed(1), page: [Math.round(r.left + q.x), Math.round(r.top + q.y)], centre: [Math.round(r.left + sz.x / 2), Math.round(r.top + sz.y / 2)], dpr: devicePixelRatio,
        city: { top: r.top, h: r.height, w: r.width, ih: innerHeight, iw: innerWidth } }; }, target);
    const d = target && s.c ? { dLat: +Math.abs(s.c.lat - target.lat).toFixed(4), dLng: +Math.abs(s.c.lng - target.lng).toFixed(4) } : null;
    const realPx = scr ? +(Math.hypot(scr.dx, scr.dy) * scr.dpr).toFixed(1) : null;
    const last = await page.evaluate(() => window.__snLastDbl || null);
    console.log("[" + tag + "]", JSON.stringify({ click: { page: [px, py], agent: [Math.round((sx - ox) / SCALE), Math.round((sy - oy) / SCALE)] }, z: s.z, c: s.c && { lat: +s.c.lat.toFixed(4), lng: +s.c.lng.toFixed(4) }, target, d, screen: scr, realPx, line: s.line, last: last && { dot: last.dot, by: last.by, pick: last.pick } }), g.file);
    return { s, target, d, scr, realPx };
  };
  const dblOk = (D) => !!(D.s && D.d && D.target && D.target.on) && D.s.cityOn && D.s.z === 10 && D.d.dLat <= 0.05 && D.d.dLng <= 0.05 && D.realPx != null && D.realPx <= 20 && /^Island \/ region view/.test(D.s.line) && !D.s.sky;
  const dblMsg = (D) => JSON.stringify({ z: D.s && D.s.z, target: D.target, d: D.d, screen: D.scr && { dx: D.scr.dx, dy: D.scr.dy }, realPx: D.realPx, why: D.why });
  let D = await dbl("globe-dblclick-athens-dot", EU, { dot: "ATHENS" });
  check("double click on the Athens dot: z10 view on Athens (37.98,23.73) within 0.05 deg, <= 20 px from the map centre", dblOk(D), dblMsg(D));
  {
    const sc = D.scr, cy = sc && sc.city;
    const bleed = !!cy && Math.abs(cy.top) < 1 && Math.abs(cy.h - cy.ih) < 2 && Math.abs(cy.w - cy.iw) < 2;
    check("Athens point on the map container centre within 1.5 px, #city full-bleed (no vertical centring offset; an OSM name label is drawn off its node)",
      !!sc && bleed && Math.abs(sc.dx) <= 1.5 && Math.abs(sc.dy) <= 1.5, JSON.stringify(sc && { dx: sc.dx, dy: sc.dy, page: sc.page, centre: sc.centre, city: cy }));
  }
  D = await dbl("globe-dblclick-athens-dot-off", EU, { dot: "ATHENS", off: [3, -2] });
  check("double click 3-4 px off the Athens dot (inside its ring): still on Athens within 0.05 deg, <= 20 px", dblOk(D), dblMsg(D));
  D = await dbl("globe-dblclick-athens-label", EU, { label: "ATHENS" });
  check("double click on the ATHENS label: on Athens within 0.05 deg, <= 20 px", dblOk(D), dblMsg(D));
  D = await dbl("globe-dblclick-istanbul-dot", EU, { dot: "ISTANBUL" });
  check("double click on the Istanbul dot (near the Athens and Rhodes dots): on Istanbul (41.01,28.98) within 0.05 deg, <= 20 px", dblOk(D), dblMsg(D));
  D = await dbl("globe-dblclick-istanbul-label", EU, { label: "ISTANBUL" });
  check("double click on the ISTANBUL label: on Istanbul within 0.05 deg, <= 20 px", dblOk(D), dblMsg(D));
  D = await dbl("globe-dblclick-rhodes", { lat: 36.25, lng: 28.0 }, { dot: "CALENDAR" });
  check("double click on the Rhodes dot: z10 island view on Rhodes within 0.05 deg, <= 20 px", dblOk(D) && onRhodes(D.s.c), dblMsg(D));
  D = await dbl("globe-dblclick-crete", { lat: 35.3, lng: 25.0 }, { lat: 35.25, lng: 24.9 });
  check("double click off the dots (Crete): on the clicked surface point within 0.05 deg, <= 20 px", dblOk(D), dblMsg(D));
  if (geo.iw >= 1900) {
    /* 4345: the guest's Crete click (preview-4344/09-E-global-before-crete, 1920x1200, page top at screen y 87): turn the
       globe (setup, not a user action) so the four city dots sit on the guest's page pixels, then double click the guest's
       real pixel 939,462 = page 939,375 with xdotool (a real-pixel click: no agent rounding) */
    await toGlobe();
    const GT = [["ATHENS", 37.98, 23.73, 932.53, 441.56 - 87], ["ISTANBUL", 41.01, 28.98, 964.0, 421.0 - 87], ["RHODES", 36.445, 28.225, 956.62, 452.69 - 87], ["CAIRO", 30.04, 31.24, 979.63, 499.21 - 87]];
    const frame2 = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const resid = async (la, ln) => { await page.evaluate((l) => SN.lookAt(l, 1.85), { lat: la, lng: ln }); await frame2(); await frame2();
      return page.evaluate((T) => T.map((t) => { const q = SN.projectFrame(t[1], t[2]); return [q.x - t[3], q.y - t[4]]; }), GT); };
    let la = 12.7, ln = 27.7;
    for (let it = 0; it < 4; it++) {
      const r0 = await resid(la, ln), r1 = await resid(la + 0.05, ln), r2 = await resid(la, ln + 0.05);
      let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
      for (let k = 0; k < r0.length; k++) for (let j = 0; j < 2; j++) { const g1 = (r1[k][j] - r0[k][j]) / 0.05, g2 = (r2[k][j] - r0[k][j]) / 0.05; a11 += g1 * g1; a12 += g1 * g2; a22 += g2 * g2; b1 -= g1 * r0[k][j]; b2 -= g2 * r0[k][j]; }
      const det = a11 * a22 - a12 * a12; if (!det) break; la += (b1 * a22 - b2 * a12) / det; ln += (a11 * b2 - a12 * b1) / det;
    }
    const rf = await resid(la, ln); const rms = Math.sqrt(rf.reduce((a, r) => a + r[0] * r[0] + r[1] * r[1], 0) / rf.length);
    await sleep(500);
    const PX = 939, PY = 375;
    const pre = await page.evaluate((q) => { const h = SN.globeHitTest(q[0], q[1]), up = SN.globeHitTest(q[0], q[1] - 1), rt = SN.globeHitTest(q[0] + 1, q[1]);
      const her = SN.projectFrame(35.3387, 25.1442), spot = SN.projectFrame(35.41, 25.0); return { h, up, rt, her: [her.x, her.y], spot: [spot.x, spot.y] }; }, [PX, PY]);
    const gb = await grab("globe-crete-guest-view");
    xdo(`mousemove ${ox + PX} ${oy + PY}`); await sleep(100); xdo("click --repeat 2 --delay 90 1");
    await sleep(2200); const s = await cs(); const g = await grab("globe-dblclick-crete-guest");
    const last = await page.evaluate(() => window.__snLastDbl || null);
    const t = pre.h ? { lat: +pre.h.lat, lng: +pre.h.lng } : null;
    const scr = t && await page.evaluate((t) => { const m = SN.getMap(); if (!m || !m._loaded) return null; const sz = m.getSize(); const q = m.latLngToContainerPoint([t.lat, t.lng]); const h = m.latLngToContainerPoint([35.3387, 25.1442]);
      return { dx: +(q.x - sz.x / 2).toFixed(1), dy: +(q.y - sz.y / 2).toFixed(1), her: [+(h.x - sz.x / 2).toFixed(1), +(h.y - sz.y / 2).toFixed(1)], dpr: devicePixelRatio }; }, t);
    const d = t && s.c ? { dLat: +Math.abs(s.c.lat - t.lat).toFixed(4), dLng: +Math.abs(s.c.lng - t.lng).toFixed(4) } : null;
    const realPx = scr ? +(Math.hypot(scr.dx, scr.dy) * scr.dpr).toFixed(1) : null;
    const kmV = pre.up && pre.h ? +(Math.abs(pre.up.lat - pre.h.lat) * 111.2).toFixed(1) : null;
    const kmH = pre.rt && pre.h ? +(Math.abs(pre.rt.lng - pre.h.lng) * 111.2 * Math.cos(pre.h.lat * Math.PI / 180)).toFixed(1) : null;
    const herOff = [+(pre.her[0] - PX).toFixed(2), +(pre.her[1] - PY).toFixed(2)], spotOff = [+(pre.spot[0] - PX).toFixed(2), +(pre.spot[1] - PY).toFixed(2)];
    console.log("[globe-dblclick-crete-guest]", JSON.stringify({ fit: { lookAt: [+la.toFixed(4), +ln.toFixed(4)], rmsPx: +rms.toFixed(2), resid: rf.map((r) => r.map((v) => +v.toFixed(2))) }, click: { real: [ox + PX, oy + PY], page: [PX, PY], guestReal: [939, 462] },
      pick: t, z: s.z, c: s.c && { lat: +s.c.lat.toFixed(4), lng: +s.c.lng.toFixed(4) }, d, screen: scr, realPx, last: last && { sx: last.sx, sy: last.sy, by: last.by, dot: last.dot },
      bound: { kmPerPxNS: kmV, kmPerPxEW: kmH, heraklionPx: herOff, guestSpotPx: spotOff } }), gb.file, g.file);
    check("the guest's Crete view is reproduced (4 city dots on the guest's pixels, rms <= 2 px)", rms <= 2, rms.toFixed(2) + " px");
    check("the guest's Crete click replayed at 1920 (real 939,462): z10 centred on the surface point under that pixel within 0.05 deg, <= 20 px from the map centre, no dot snap",
      !!(t && d && s.cityOn && s.z === 10 && d.dLat <= 0.05 && d.dLng <= 0.05 && realPx != null && realPx <= 20 && last && last.by === "pick" && !s.sky), JSON.stringify({ z: s.z, pick: t, d, realPx, by: last && last.by }));
    check("Crete precision bound: the spot the guest meant (~8 km N, 13 km W of Heraklion) and Heraklion lie within 2.5 real px of the clicked pixel (1 px = " + kmV + " km N-S, " + kmH + " km E-W here)",
      Math.hypot(spotOff[0], spotOff[1]) <= 2.5 && Math.hypot(herOff[0], herOff[1]) <= 2.5, JSON.stringify({ guestSpotPx: spotOff, heraklionPx: herOff, heraklionAtZ10: scr && scr.her }));
  } else console.log("NOTE the guest's Crete replay runs at 1920x1200 only (their real pixel 939,462)");
  /* 4346: a double click never zooms out (preview-4345/12-15: a double click on west Crete at ~z10.5 closed the map to the
     zoomed-out globe and the readout kept the old centre). Open spots, no dot: on the close globe and on the map at z8, z10,
     z13; input = xdotool at agent scale; setup (turning the globe, opening the map at a zoom) is not a user action */
  {
    const SPOTS = [{ n: "Crete west-central", lat: 35.30, lng: 23.85 }, { n: "inland Anatolia (Turkey)", lat: 39.45, lng: 34.60 }];
    const readLL = (t) => { const m = String(t || "").match(/(-?\d{1,2}\.\d{3}),(-?\d{1,3}\.\d{3})/); return m ? { lat: +m[1], lng: +m[2] } : null; };
    const measure = (pk) => page.evaluate((pk) => {
      const m = SN.getMap(), c = SN.getCam(), city = document.getElementById("city");
      const on = !!(c.cityOn && city.classList.contains("on"));
      if (!m || !m._loaded) return { on, line: document.getElementById("line").textContent };
      const sz = m.getSize(), mc = m.getCenter(), q = m.latLngToContainerPoint([pk.lat, pk.lng]), rg = window.__snRing, rq = rg ? m.latLngToContainerPoint([rg.lat, rg.lng]) : null;
      return { on, z: m.getZoom(), c: { lat: mc.lat, lng: mc.lng }, pkPx: [q.x - sz.x / 2, q.y - sz.y / 2], ringPx: rq ? [rq.x - sz.x / 2, rq.y - sz.y / 2] : null,
        line: document.getElementById("line").textContent, dpr: devicePixelRatio, last: window.__snLastDbl || null }; }, pk);
    const verdict = (tag, zb, want, M, extra) => {
      const rl = readLL(M.line), pkd = M.pkPx ? Math.hypot(M.pkPx[0], M.pkPx[1]) * M.dpr : null, rgd = M.ringPx ? Math.hypot(M.ringPx[0], M.ringPx[1]) * M.dpr : null;
      const ok = !!(M.on && M.z != null && M.z >= zb - 1e-6 && (want == null || Math.abs(M.z - want) < 0.01) && pkd != null && pkd <= 20 && rgd != null && rgd <= 20 && rl && M.c && Math.abs(rl.lat - M.c.lat) <= 0.01 && Math.abs(rl.lng - M.c.lng) <= 0.01);
      check(tag + ": still on the map, zoom after >= before" + (want != null ? " (z" + want + ")" : "") + ", clicked point + ring <= 20 px from the centre, readout = centre within 0.01 deg", ok,
        JSON.stringify(Object.assign({ zBefore: +(+zb).toFixed(2), zAfter: M.z, clickedPx: pkd != null ? +pkd.toFixed(1) : null, ringPx: rgd != null ? +rgd.toFixed(1) : null, readout: rl, centre: M.c && { lat: +M.c.lat.toFixed(4), lng: +M.c.lng.toFixed(4) }, line: M.line, on: M.on }, extra || {})));
    };
    const fileTag = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    // the close globe (dist 0.9: the last globe step before the wheel opens the map)
    for (const sp of SPOTS) {
      await toGlobe();
      await page.evaluate((l) => SN.lookAt(l, 0.9), { lat: sp.lat + 2, lng: sp.lng - 3 }); await sleep(1400);
      const pt = await page.evaluate((a) => SN.projectFrame(a.lat, a.lng), sp);
      const [sx, sy] = A(pt.x, pt.y); const px = sx - ox, py = sy - oy;
      const pre = await page.evaluate((q) => ({ zEq: SN.globeZoomEq(), pick: SN.globeHitTest(q[0], q[1]), dist: SN.getCam().dist, cityOn: SN.getCam().cityOn }), [px, py]);
      const tag = "globe-close dblclick " + sp.n;
      if (!pre.pick || pre.cityOn) { check(tag, false, "setup: " + JSON.stringify(pre)); continue; }
      xdo(`mousemove ${sx} ${sy}`); await sleep(100); xdo("click --repeat 2 --delay 90 1");
      await sleep(2200); const M = await measure(pre.pick); const g = await grab(fileTag("dbl46 " + tag));
      console.log("[" + tag + "]", JSON.stringify({ click: [px, py], pre, M }).slice(0, 700), g.file);
      verdict("double click an open spot on the close globe (dist " + pre.dist.toFixed(2) + ", ~z" + pre.zEq.toFixed(1) + "): " + sp.n, Math.max(10, pre.zEq), null, M, { by: M.last && M.last.by });
    }
    // the map at z8, z10, z13: the spot sits off the centre (-110, +70 css px), double click it
    for (const sp of SPOTS) for (const Z of [8, 10, 13]) {
      await page.evaluate((a) => SN.openCity({ lat: a.lat, lng: a.lng }, { zoom: a.z }), { lat: sp.lat, lng: sp.lng, z: Z }); await sleep(900);
      await page.evaluate((a) => { const m = SN.getMap(); const sz = m.getSize(); const c2 = m.containerPointToLatLng([sz.x / 2 + 110, sz.y / 2 - 70]); SN.openCity({ lat: c2.lat, lng: c2.lng }, { zoom: a.z }); }, { z: Z });
      await sleep(2000);
      const pre = await page.evaluate((a) => { const m = SN.getMap(); const r = document.getElementById("city").getBoundingClientRect(); const q = m.latLngToContainerPoint([a.lat, a.lng]); return { z: m.getZoom(), page: [r.left + q.x, r.top + q.y], left: r.left, top: r.top }; }, sp);
      const [sx, sy] = A(pre.page[0], pre.page[1]); const px = sx - ox, py = sy - oy;
      const pk = await page.evaluate((q) => { const m = SN.getMap(); const ll = m.containerPointToLatLng([q[0], q[1]]); return { lat: ll.lat, lng: ll.lng }; }, [px - pre.left, py - pre.top]);
      const tag = "map z" + Z + " dblclick " + sp.n;
      xdo(`mousemove ${sx} ${sy}`); await sleep(100); xdo("click --repeat 2 --delay 90 1");
      await sleep(2200); const M = await measure(pk); const g = await grab(fileTag("dbl46 " + tag));
      console.log("[" + tag + "]", JSON.stringify({ click: [px, py], pk, pre, M }).slice(0, 700), g.file);
      verdict("double click an open spot on the map at z" + pre.z + ": " + sp.n, pre.z, pre.z < 10 ? 10 : Math.min(18, pre.z + 1), M);
    }
    // the guest's case: wheel into west Crete from the globe (z10.5), double click the agent pixel 560,500
    {
      await toGlobe(); await page.evaluate(() => SN.lookAt({ lat: 35.4, lng: 24.3 }, 1.25)); await sleep(1200);
      const cp = await page.evaluate(() => SN.projectFrame(35.506, 24.145));
      xdo(`mousemove ${A(cp.x, cp.y).join(" ")}`); await sleep(150);
      let zb = null;
      for (let i = 0; i < 16; i++) { xdo("click 4"); await sleep(450); const q = await cs(); if (q.cityOn && q.z >= 10.5) { zb = q.z; break; } }
      await sleep(1600);
      const g0 = await grab("dbl46-guest-crete-before");
      const sx = Math.round(560 * SCALE), sy = Math.round(500 * SCALE); const px = sx - ox, py = sy - oy;
      const pre = await page.evaluate((q) => { const m = SN.getMap(); if (!m || !m._loaded) return null; const r = document.getElementById("city").getBoundingClientRect(); const ll = m.containerPointToLatLng([q[0] - r.left, q[1] - r.top]); return { z: m.getZoom(), pk: { lat: ll.lat, lng: ll.lng }, line: document.getElementById("line").textContent }; }, [px, py]);
      if (!pre || zb == null) check("the guest's case (wheel into west Crete, double click agent 560,500)", false, "setup: the wheel did not open the map at z10.5 " + JSON.stringify(pre));
      else {
        xdo(`mousemove ${sx} ${sy}`); await sleep(100); xdo("click --repeat 2 --delay 90 1");
        await sleep(2200); const M = await measure(pre.pk); const g = await grab("dbl46-guest-crete-after");
        console.log("[guest crete dblclick]", JSON.stringify({ click: { real: [sx, sy], page: [px, py] }, pre, M }).slice(0, 700), g0.file, g.file);
        verdict("the guest's case: wheel into west Crete (z" + pre.z + "), double click agent 560,500 (" + (pre.pk.lat).toFixed(3) + "," + (pre.pk.lng).toFixed(3) + ")", pre.z, Math.min(18, pre.z + 1), M);
      }
    }
  }
  await cdp.send("Emulation.setGeolocationOverride", { latitude: RHODES_OLD.lat, longitude: RHODES_OLD.lng, accuracy: 15 });
  await globeBtn(); await sleep(1500);
  const gpsBtn = await page.evaluate(() => { const b = document.getElementById("gps").getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  xdo(`mousemove ${A(gpsBtn.x, gpsBtn.y).join(" ")}`); await sleep(70); xdo("click 1");
  w = await watchSky(3000); gg = await grab("globe-gps-from-globe");
  check("GPS recalibrate from the globe flies to the fix (street), never the sky view", !w.sky && w.s.cityOn && w.s.c && km(w.s.c, RHODES_OLD) < 0.6 && w.s.z >= 15, JSON.stringify({ sky: w.sky, z: w.s.z, c: w.s.c }));
  xdo(`mousemove ${A(gpsBtn.x, gpsBtn.y).join(" ")}`); await sleep(70); xdo("click 1");
  w = await watchSky(2500);
  check("GPS recalibrate again from the map: no sky view", !w.sky && w.s.cityOn, JSON.stringify({ sky: w.sky, z: w.s.z }));
  await globeBtn(); w = await watchSky(3000); gg = await grab("globe-global-after-gps");
  check("Global view after GPS: globe, no sky view, no jump back", !w.sky && !w.s.cityOn, JSON.stringify({ sky: w.sky, cityOn: w.s.cityOn, dist: w.s.dist }));
  // ---- WEATHER: once per 0.5 deg place per session, nothing after a 429, nothing new after a reload in the same tab ----
  {
    const keys = meteo.map((m) => m.lat + "," + m.lng);
    const rounded = meteo.every((m) => Math.abs(m.lat * 2 - Math.round(m.lat * 2)) < 1e-9 && Math.abs(m.lng * 2 - Math.round(m.lng * 2)) < 1e-9);
    const first429 = meteo.find((m) => m.st === 429);
    const after429 = first429 ? meteo.filter((m) => m.t > first429.tr).length : 0;
    console.log("[weather]", JSON.stringify(meteo.map((m) => ({ k: m.lat + "," + m.lng, st: m.st }))));
    check("weather: rounded 0.5 deg coordinates, each place fetched at most once", rounded && new Set(keys).size === keys.length, JSON.stringify(keys));
    check("weather: no request after a 429 (backs off for the session)", after429 === 0, first429 ? "429 at " + first429.lat + "," + first429.lng + ", " + after429 + " later" : "no 429");
    const netRounded = wxNet.every((q) => { const u = new URL(q.url); return ["latitude", "longitude"].every((k) => { const v = Number(u.searchParams.get(k)); return isFinite(v) && Math.abs(v * 2 - Math.round(v * 2)) < 1e-9; }); });
    console.log("[weather CDP]", JSON.stringify(wxNet.map((q) => q.url.replace(/^.*\?/, ""))));
    check("weather: <= 1 open-meteo request on the CDP network across the whole guest run (fresh load, IP view, GPS grant, GPS button, hunts, globe), 0.5 deg rounded", wxNet.length <= 1 && netRounded, wxNet.length + " request(s)");
    const n0 = meteo.length;
    await page.reload({ waitUntil: "domcontentloaded" }); await sleep(9000);
    const wxT = await page.evaluate(() => (document.getElementById("sn-wx") || {}).textContent || "");
    check("weather: a reload in the same tab fetches nothing new (sessionStorage cache / back-off)", meteo.length === n0, (meteo.length - n0) + " new; label " + JSON.stringify(wxT));
    check("weather: the label is a temperature or DAY / NIGHT (silent failure)", /^(-?\d+°|DAY|NIGHT)$/.test(wxT), JSON.stringify(wxT));
    const vh = await new Promise((res) => { require("https").request(ORIGIN + "/VERSION", { method: "GET" }, (rs) => { let b = ""; rs.on("data", (d) => (b += d)); rs.on("end", () => res({ st: rs.statusCode, ct: rs.headers["content-type"] || "", cd: rs.headers["content-disposition"] || "", body: b.trim() })); }).on("error", (e) => res({ err: String(e) })).end(); });
    const vOk = vh.st === 200 && /^text\/plain/.test(vh.ct) && /utf-8/i.test(vh.ct) && (!vh.cd || /^inline/.test(vh.cd)) && /^\d{4}$/.test(vh.body);
    if (process.env.LOCAL_APP) console.log("NOTE /VERSION headers come from the deployment (LOCAL_APP run):", JSON.stringify(vh));
    else check("/VERSION is served as text/plain; charset=utf-8, inline", vOk, JSON.stringify(vh));
  }
  check("no write to /api/space in the whole guest run", posts.length === 0, JSON.stringify(posts));

  const ext = errors.filter((e) => /status of 429/.test(e) && /open-meteo/.test(e));
  if (ext.length) console.log("NOTE third-party rate limit (header temperature, box IP):", ext.length, "x open-meteo 429");
  const errs = errors.filter((e) => ext.indexOf(e) < 0);
  check("no console errors", errs.length === 0, JSON.stringify(errs.slice(0, 5)));
  await ctx.close();

  // ---- LOAD VIEW: no location answer (IP lookup blocked) → the globe stays; callouts at 1280x800 and 1920x1200 ----
  for (const [w, h] of [[1280, 800], [1920, 1200]]) {
    const c2 = await browser.newContext({ viewport: null, serviceWorkers: process.env.LOCAL_APP ? "block" : "allow" });
    const p2 = await c2.newPage();
    if (process.env.LOCAL_APP) { const body = fs.readFileSync(process.env.LOCAL_APP); await p2.route(/\/js\/spacenet\/app\.js/, (rr) => rr.fulfill({ status: 200, contentType: "application/javascript", body })); }
    if (process.env.LOCAL_AUTH) { const ab = fs.readFileSync(process.env.LOCAL_AUTH); await p2.route(/\/js\/spacenet\/auth\.js/, (rr) => rr.fulfill({ status: 200, contentType: "application/javascript", body: ab })); }
    await p2.route(/get\.geojs\.io/, (rr) => rr.abort());
    await p2.addInitScript(() => { window.addEventListener("mousemove", (e) => { window.__mm = [e.clientX, e.clientY]; }, true); });
    const cd2 = await c2.newCDPSession(p2);
    const { windowId } = await cd2.send("Browser.getWindowForTarget");
    await cd2.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
    await cd2.send("Browser.setWindowBounds", { windowId, bounds: { left: 0, top: 0, width: w, height: h } });
    await p2.goto(URL0.replace(/t=\d+/, "t=" + Date.now()), { waitUntil: "domcontentloaded", timeout: 90000 });
    await p2.bringToFront();
    await sleep(5500);
    xdo(`mousemove ${Math.round(w / 2)} 150`); await sleep(120); xdo(`mousemove ${Math.round(w / 2) + 1} 151`); await sleep(250);
    const m2 = await p2.evaluate(() => window.__mm || null);
    const lv = await p2.evaluate(async () => {
      const lj = await (await fetch("/api/live", { cache: "no-store" })).json();
      const fx = (s) => /\bTESTER\b|test\s*vendor|\bV?4297\b|tester\s*client/i.test([s.name, s.title, s.note, s.id, s.owner].join(" "));
      const seen = {}; let n = 0;
      (lj.shops || []).forEach((s) => { if (s && s.id && isFinite(+s.lat) && s.status === "live" && !fx(s) && !seen[s.id]) { seen[s.id] = 1; n++; } });
      return { cards: window.__snCards || [], disc: window.__snDisc || null, hud: window.__snHud || null, cityOn: document.getElementById("city").classList.contains("on"), iw: innerWidth, ih: innerHeight,
        line: document.getElementById("line").textContent, live: (document.getElementById("sn-pulse") || {}).textContent || "", expect: n }; });
    let shot = "(no calibration)";
    if (m2) { const o2x = Math.round(w / 2) + 1 - m2[0], o2y = 151 - m2[1];
      const f = path.join(SHOTDIR, "load-globe-" + w + ".png");
      execSync(`python3 ${GRAB} ${f} ${o2x} ${o2y} ${lv.iw} ${lv.ih}`); shot = f; }
    console.log(`[load view ${w}x${h}] inner ${lv.iw}x${lv.ih} cityOn ${lv.cityOn} line ${JSON.stringify(lv.line)} cards ${JSON.stringify(lv.cards)} disc ${JSON.stringify(lv.disc)}`, shot);
    check(`load view ${w}x${h} stays on the globe without a location`, !lv.cityOn, JSON.stringify(lv.line));
    cardCheck(lv, `load ${w}x${h}, inner ${lv.iw}x${lv.ih}`);
    check(`load view ${w}x${h}: LIVE = the real public network (${lv.expect}), not the listing cache`, lv.expect > 0 && new RegExp("^LIVE · " + lv.expect + " vendors? on SpaceNet ·").test(lv.live), lv.live);
    await c2.close();
  }
  console.log("SCREENSHOTS", SHOTDIR);
  console.log(fails.length ? "HEADED 4346 FAIL: " + fails.join("; ") : "HEADED 4346 ALL PASS");
  await browser.close();
  process.exit(fails.length ? 2 : 0);
})().catch((e) => { console.error("fail", e); process.exit(1); });

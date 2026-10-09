/**
 * 4350 headed tile stress (xdotool, real pixels): the remine's t3c-t3f case, a grey map at a zoomed-in Rhodes sea spot
 * (~36.439,28.248) with PIZZAGIO's card open. 'pizza in Rhodes' typed + Return, PIZZAGIO opened from its pin, then CYCLES
 * (default 22) rounds of: a 1.2 s hold on empty map -> LIST -> LIST's red X (card back); a double click with the card open at a
 * random empty map point (sea or land), fast (90 ms), Computer-like (120 ms) or slow (400 / 500 ms); a + (or -) tap on the menu;
 * a wheel zoom-out when the map is past z16.5; every 4th round the map is put on the sea spot and double clicked in to z17.
 * After every settle (moveend + 250 ms) the map box above the card is grabbed off the X screen at 0, 0.5, 1.0 and 1.6 s and its
 * pixels classified: placeholder paper (#ece8df through the map filter = 190,189,186, +-3: plain land tiles read 195-197), OSM sea (#aad3df through the filter =
 * 153,166,169), dark (the globe behind a hidden map), or mixed. FAIL: a settled frame that stays uniform placeholder (or dark)
 * for over 1.5 s. A uniform OSM sea frame (every visible tile loaded) is open water and is counted, not failed.
 * SELF-HEAL (when SN.tileState exists): OSM blocked -> CARTO per tile and on the layer; every tile host blocked -> the heal
 * (invalidateSize + redraw) fires within 2.5 s of moveend and the tiles come back without a reload once the hosts answer; emptied
 * tile containers -> heal; zoom past the tile max (maxZoom raised to 21, z20) -> blank, the heal clamps to the tile max.
 * Env: PREVIEW_URL, STAMP, LOCAL_APP, SHOTDIR, WIN, SCALE, CYCLES, SEED. Exit 2 on any FAIL.
 */
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");
const BASE = process.env.PREVIEW_URL || "https://astranov-git-grokbuild-4328-street-level-gps-astranov.vercel.app/";
const STAMP = process.env.STAMP || "4350";
const URL0 = BASE + (BASE.includes("?") ? "&" : "?") + "v=" + STAMP + "&t=" + Date.now();
const [WW, WH] = (process.env.WIN || "1920x1200").split("x").map(Number);
const SCALE = Number(process.env.SCALE || 1.5);
const CYCLES = Number(process.env.CYCLES || 22);
const SHOTDIR = process.env.SHOTDIR || "/tmp/sn-tile-stress-4350";
fs.mkdirSync(SHOTDIR, { recursive: true });
if (!process.env.DISPLAY) process.env.DISPLAY = ":3";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const xdo = (a) => execSync("xdotool " + a, { env: process.env });
let seed = Number(process.env.SEED || 4350); const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const GRAB = path.join(os.tmpdir(), "sn_tilegrab4350.py");
fs.writeFileSync(GRAB, `import sys, json, warnings
warnings.filterwarnings("ignore")
from PIL import ImageGrab, ImageStat
out, save, x, y, w, h = sys.argv[1], sys.argv[2] == "1", *map(int, sys.argv[3:7])
im = ImageGrab.grab(xdisplay="${process.env.DISPLAY}").crop((x, y, x + w, y + h)).convert("RGB")
if save: im.save(out, compress_level=1)
sm = im.resize((max(1, im.width // 3), max(1, im.height // 3)))
px = list(sm.getdata()); n = len(px)
near = lambda p, c, d: abs(p[0] - c[0]) <= d and abs(p[1] - c[1]) <= d and abs(p[2] - c[2]) <= d
paper = sum(1 for p in px if near(p, (190, 189, 186), 3)) / n
sea = sum(1 for p in px if near(p, (153, 166, 169), 6)) / n
dark = sum(1 for p in px if p[0] + p[1] + p[2] < 75) / n
st = ImageStat.Stat(im.convert("L"))
print(json.dumps({"paper": round(paper, 3), "sea": round(sea, 3), "dark": round(dark, 3), "std": round(st.stddev[0], 1), "colors": len(sm.getcolors(1 << 22) or [])}))
`);
const fails = [];
function check(name, ok, info) { console.log((ok ? "PASS " : "FAIL ") + name + (info ? " " + info : "")); if (!ok) fails.push(name); }

(async () => {
  const browser = await chromium.launch({ headless: false, executablePath: process.env.REAL_CHROME ? "/usr/bin/google-chrome" : undefined,
    args: ["--window-position=0,0", "--window-size=" + WW + "," + WH, "--no-first-run", "--no-default-browser-check", "--deny-permission-prompts", "--disable-features=Translate"] });
  const ctx = await browser.newContext({ viewport: null, serviceWorkers: process.env.LOCAL_APP ? "block" : "allow" });
  const page = await ctx.newPage();
  if (process.env.LOCAL_APP) { const body = fs.readFileSync(process.env.LOCAL_APP); await page.route(/\/js\/spacenet\/app\.js/, (r) => r.fulfill({ status: 200, contentType: "application/javascript", body })); }
  /* 4350: with LOCAL_APP the live preview's /api/find has no Overpass proxy yet: POST {op:"overpass"} answered by this tree's api/find.js */
  if (process.env.LOCAL_APP) { const fh = require(path.join(__dirname, "..", "api", "find.js"));
    await page.route(/\/api\/find(\?|$)/, async (r) => { const q = r.request(); let b = null; try { b = q.method() === "POST" ? JSON.parse(q.postData() || "{}") : null; } catch (e) { b = null; }
      if (!b || b.op !== "overpass") return r.fallback(); let st = 200, js = null; const rs = { setHeader() {}, status(s) { st = s; return rs; }, json(j) { js = j; return rs; }, end() { return rs; } };
      await fh({ method: "POST", body: b, headers: {} }, rs); return r.fulfill({ status: st, contentType: "application/json", body: JSON.stringify(js) }); }); }
  await page.route(/\/api\/space/, (r) => (r.request().method() !== "GET" ? r.abort() : r.continue()));
  const errors = [], tileNet = { osm: 0, carto: 0, bad: 0, st: {} };
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  page.on("response", (r) => { const u = r.url(); if (/tile\.openstreetmap\.org/.test(u)) tileNet.osm++; else if (/cartocdn\.com/.test(u)) tileNet.carto++; else return; tileNet.st[r.status()] = (tileNet.st[r.status()] || 0) + 1; if (r.status() >= 400) tileNet.bad++; });
  await page.addInitScript(() => { window.addEventListener("mousemove", (e) => { window.__mm = [e.clientX, e.clientY]; }, true); });
  await page.goto(URL0, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.bringToFront(); await sleep(1500);
  xdo("mousemove 960 150"); await sleep(120); xdo("mousemove 961 151"); await sleep(250);
  const mm = await page.evaluate(() => window.__mm || null);
  if (!mm) { console.log("calibration failed"); process.exit(3); }
  const ox = 961 - mm[0], oy = 151 - mm[1];
  const geo = await page.evaluate(() => ({ iw: innerWidth, ih: innerHeight }));
  console.log("content origin", ox, oy, "inner", geo.iw + "x" + geo.ih, "agent scale 1/" + SCALE, "cycles", CYCLES, "seed", process.env.SEED || 4350);
  const A = (x, y) => [Math.round(Math.round((ox + x) / SCALE) * SCALE), Math.round(Math.round((oy + y) / SCALE) * SCALE)];
  await page.waitForFunction(() => window.SN && SN.getMap && SN.openCity, null, { timeout: 30000 });
  const ver = await page.evaluate(() => (document.getElementById("ver") || {}).textContent);
  console.log("running", ver, process.env.LOCAL_APP ? "(LOCAL_APP)" : "(live)");

  // ---- the guest's hunt and PIZZAGIO ----
  await sleep(4000);
  const typeIn = async (q) => { const ib = await page.evaluate(() => { const r = document.getElementById("in").getBoundingClientRect(); return { x: r.left + 120, y: r.top + r.height / 2 }; });
    xdo(`mousemove ${A(ib.x, ib.y).join(" ")}`); await sleep(80); xdo("click 1"); await sleep(250); xdo(`type --delay 45 "${q}"`); await sleep(120); xdo("key Return"); };
  await typeIn("pizza in Rhodes");
  let find = null; for (let i = 0; i < 120 && !(find && find !== "…"); i++) { await sleep(250); find = await page.evaluate(() => ((((document.getElementById("sn-sheet-card") || {}).textContent || "").match(/FIND\s*·\s*(\d+|…)/) || [])[1]) || null); }
  await sleep(1500);
  check("the pizza hunt at Rhodes lands real pins (FIND >= 5)", +find >= 5, "FIND " + find);
  await page.evaluate(() => { const m = SN.getMap(); window.__mvS = 0; window.__mvE = Date.now(); m.on("movestart zoomstart", () => { window.__mvS = Date.now(); }); m.on("moveend zoomend", () => { window.__mvE = Date.now(); }); });
  const PZ = { lat: 36.4315906, lng: 28.2304921 }, SEA = { lat: 36.439, lng: 28.248 };
  const sh = () => page.evaluate(() => { const s = document.getElementById("sn-sheet"), c = document.getElementById("sn-sheet-card"); const picks = {};
    if (c) c.querySelectorAll(".sn-pick").forEach((r) => { const n = +((r.querySelector(".n") || {}).textContent || 0); if (n) picks[r.getAttribute("data-i")] = n; });
    return { on: !!(s && s.classList.contains("on")), kind: s && s.getAttribute("data-kind"), title: c ? ((c.querySelector(".sheet-mid") || {}).textContent || "").trim() : "", top: c && s.classList.contains("on") ? c.getBoundingClientRect().top : null, picks }; });
  const closeX = async () => { const xb = await page.evaluate(() => { const b = document.querySelector("#sn-sheet .sheet-bar .sheet-x"); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    if (xb) { xdo(`mousemove ${A(xb.x, xb.y).join(" ")}`); await sleep(60); xdo("click 1"); await sleep(600); } };
  const pinAt = (pz) => page.evaluate((p) => { const m = SN.getMap(); let best = null; m.eachLayer((l) => { if (l.getLatLng && l._icon) { const ll = l.getLatLng(); const d = Math.hypot(ll.lat - p.lat, ll.lng - p.lng);
    if (d < 0.0005 && (!best || d < best.d)) { const r = l._icon.getBoundingClientRect(); best = { d, x: r.left + r.width / 2, y: r.top + r.height * 0.36 }; } } }); return best; }, pz);
  async function openPizzagio() {
    for (let k = 0; k < 3; k++) { const s = await sh(); if (s.on && s.kind !== "vendor") await closeX(); else break; }
    let s = await sh(); if (s.on && s.kind === "vendor" && /pizzagio/i.test(s.title)) return s;
    if (s.on) await closeX();
    await page.evaluate((a) => SN.getMap().setView([a.lat, a.lng], 14, { animate: false }), PZ); await sleep(1200);
    let p = null; for (let i = 0; i < 10 && !p; i++) { p = await pinAt(PZ); if (!p) await sleep(300); }
    if (!p) return sh();
    xdo(`mousemove ${A(p.x, p.y).join(" ")}`); await sleep(120); xdo("click 1");
    for (let i = 0; i < 20; i++) { await sleep(100); s = await sh(); if (s.on && s.kind === "vendor") break; }
    await sleep(500); return sh();
  }
  /* an empty map point above the card, clear of pins, HUD columns and the lifted GPS / ME */
  const emptyPoint = (r1, r2) => page.evaluate((q) => { const card = document.getElementById("sn-sheet").classList.contains("on") ? document.getElementById("cli-drag").getBoundingClientRect().top : innerHeight - 140;
    const pins = [...document.querySelectorAll("#city .leaflet-marker-icon, #city .leaflet-tooltip")].map((e) => e.getBoundingClientRect());
    for (let k = 0; k < 60; k++) { const fx = (q[0] + k * 0.618) % 1, fy = (q[1] + k * 0.414) % 1;
      const x = Math.round(130 + fx * (innerWidth - 260)), y = Math.round(150 + fy * Math.max(40, card - 200));
      const e = document.elementFromPoint(x, y); if (!e || !e.closest("#city") || e.closest(".leaflet-marker-icon,.leaflet-tooltip,.leaflet-control,.leaflet-interactive")) continue;
      if (pins.every((r) => Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) > 70)) return { x, y }; } return null; }, [r1, r2]);
  const tileDom = () => page.evaluate(() => { const m = SN.getMap(), el = document.getElementById("city"), R = el.getBoundingClientRect();
    const ims = [...el.querySelectorAll(".leaflet-tile-pane img.leaflet-tile")]; const vis = ims.filter((i) => { const q = i.getBoundingClientRect(); return q.width > 0 && q.right > R.left && q.bottom > R.top && q.left < R.right && q.top < R.bottom && getComputedStyle(i).visibility !== "hidden"; });
    let layers = 0; m.eachLayer((l) => { if (l.getTileUrl) layers++; });
    const cs = getComputedStyle(el); const pane = document.querySelector(".leaflet-tile-pane");
    return { z: +m.getZoom().toFixed(2), c: [+m.getCenter().lat.toFixed(4), +m.getCenter().lng.toFixed(4)], vis: vis.length, ok: vis.filter((i) => i.complete && i.naturalWidth > 8).length,
      err: vis.filter((i) => i.complete && i.naturalWidth <= 8).length, loading: vis.filter((i) => !i.complete).length, carto: vis.filter((i) => /cartocdn/.test(i.src)).length, layers,
      op: cs.opacity, visib: cs.visibility, pane: pane ? pane.style.transform || "" : "none", anim: !!m._animatingZoom, heal: window.SN.tileState ? SN.tileState() : null }; });
  async function settle() { const t0 = Date.now(); while (Date.now() - t0 < 5000) { const ok = await page.evaluate(() => { const m = SN.getMap(); return !m._animatingZoom && window.__mvE >= window.__mvS && Date.now() - window.__mvE >= 250; }); if (ok) break; await sleep(80); } return Date.now() - t0; }
  let nAct = 0, nSamp = 0, nSea = 0, nPaperT = 0, nPaperStuck = 0; const badActs = [], seaActs = [];
  async function sample(tag, cyc) {
    nAct++; const st = await settle(); const s = await sh();
    const top = s.on && s.top ? s.top - 34 : geo.ih - 140; const box = { x: 70, y: 70, w: geo.iw - 140, h: Math.max(60, top - 70) };
    const S = []; const t0 = Date.now();
    for (const at of [0, 500, 1000, 1600]) { while (Date.now() - t0 < at) await sleep(20);
      const f = path.join(SHOTDIR, `stress-c${String(cyc).padStart(2, "0")}-${tag}-${at}.png`);
      const px = JSON.parse(execSync(`python3 ${GRAB} ${f} ${at === 0 ? 1 : 0} ${Math.round(ox + box.x)} ${Math.round(oy + box.y)} ${Math.round(box.w)} ${Math.round(box.h)}`).toString());
      const d = await tileDom(); S.push({ at: Date.now() - t0, px, d, f: at === 0 ? f : null }); nSamp++; }
    const uni = (x) => x.px.paper >= 0.97 || x.px.dark >= 0.97;
    const stuck = S.every(uni) && S[S.length - 1].at >= 1500;
    const sea = S[S.length - 1].px.sea >= 0.97 && S[S.length - 1].d.ok > 0;
    if (sea) { nSea++; seaActs.push(cyc + ":" + tag + "@z" + S[3].d.z); }
    if (S.some(uni) && !stuck) nPaperT++;
    if (!stuck && S[S.length - 1].px.paper >= 0.25) nPaperStuck++;
    const line = { cyc, tag, settleMs: st, card: s.on ? s.kind + ":" + s.title : "none", px: S.map((x) => [x.at, x.px.paper, x.px.sea, x.px.dark, x.px.std]), dom: S[3].d, shot: S[0].f };
    console.log((stuck ? "[STUCK] " : sea ? "[sea] " : "") + "[s" + nAct + "]", JSON.stringify(line).slice(0, 900));
    if (stuck) { badActs.push(line); const g = path.join(SHOTDIR, `stress-STUCK-c${cyc}-${tag}.png`); execSync(`python3 ${GRAB} ${g} 1 ${Math.round(ox)} ${Math.round(oy)} ${geo.iw} ${geo.ih}`); console.log("   stuck frame", g); }
    return S;
  }
  const RUN = { fast: "click --repeat 2 --delay 90 1", computer: "click --repeat 2 --delay 120 1", slow400: "click --repeat 2 --delay 400 1", slow500: "click --repeat 2 --delay 500 1" };
  const HOWS = Object.keys(RUN);
  let s0 = await openPizzagio();
  check("PIZZAGIO's card is open for the stress", s0.on && s0.kind === "vendor" && /pizzagio/i.test(s0.title), JSON.stringify(s0));
  let keepLost = 0, listFail = 0, dblN = 0, dblZoomOk = 0;
  for (let c = 0; c < CYCLES; c++) {
    let s = await openPizzagio();
    // 1. hold -> LIST -> X
    const hp = await emptyPoint(rnd(), rnd());
    if (hp) { const [hx, hy] = A(hp.x, hp.y); xdo(`mousemove ${hx} ${hy}`); await sleep(100); xdo("mousedown 1"); await sleep(1200); xdo("mouseup 1"); await sleep(700);
      const l = await sh(); if (!(l.on && l.kind === "list")) listFail++; else { await closeX(); } await sleep(300);
      const b = await sh(); if (!(b.on && b.kind === "vendor")) { keepLost++; console.log("   card not back after LIST X", JSON.stringify(b)); }
      await sample("hold-list-x", c); }
    // 2. double click with the card open: every 4th round on the sea spot, else a random empty point
    const how = HOWS[Math.floor(rnd() * HOWS.length)];
    if (c % 4 === 3) { await page.evaluate((a) => SN.getMap().setView([a.lat, a.lng], 15, { animate: false }), SEA); await sleep(900); }
    for (let k = 0; k < (c % 4 === 3 ? 2 : 1); k++) {
      const z0 = await page.evaluate(() => SN.getMap().getZoom());
      let dp = c % 4 === 3 ? await page.evaluate(() => { const r = document.getElementById("city").getBoundingClientRect(); const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height * 0.3); const e = document.elementFromPoint(x, y);
        return e && e.closest("#city") && !e.closest(".leaflet-marker-icon,.leaflet-tooltip") ? { x, y } : null; }) : null;
      if (!dp) dp = await emptyPoint(rnd(), rnd());
      if (!dp) break;
      const pre = await sh();
      const [dx, dy] = A(dp.x, dp.y); xdo(`mousemove ${dx} ${dy}`); await sleep(220); xdo(RUN[how]); await sleep(300);
      const S = await sample("dbl-" + how + (c % 4 === 3 ? "-sea" + k : ""), c);
      dblN++; const z1 = S[3].d.z; if (z1 >= Math.min(18, z0 + 1) - 0.01 || z0 >= 18) dblZoomOk++;
      const post = await sh(); if (pre.on && pre.kind === "vendor" && !(post.on && post.kind === "vendor")) { keepLost++; console.log("   card lost on", how, JSON.stringify(post)); }
    }
    // 3. + (or - past 3 picks) on the menu
    const s3 = await sh();
    if (s3.on && s3.kind === "vendor") {
      const tot = Object.values(s3.picks).reduce((a, b) => a + b, 0); const act = tot >= 3 ? "pick-less" : "pick-more";
      const btAt = (a) => page.evaluate((a) => { const b = document.getElementById("sn-sheet-body").getBoundingClientRect();
        const xs = [...document.querySelectorAll('#sn-sheet .sn-pick button[data-act="' + a + '"]')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, e }; })
          .filter((p) => { const t = document.elementFromPoint(p.x, p.y); return p.y > b.top + 6 && p.y < b.bottom - 6 && t && (t === p.e || p.e.contains(t)); }); return xs[0] ? { x: xs[0].x, y: xs[0].y } : null; }, a);
      let bt = await btAt(act); let actU = act; if (!bt && act === "pick-less") { bt = await btAt("pick-more"); actU = "pick-more"; }
      if (bt) { xdo(`mousemove ${A(bt.x, bt.y).join(" ")}`); await sleep(100); xdo("click 1"); await sleep(450); await sample("tap-" + actU, c); }
    }
    // 4. a wheel zoom-out past z16.5 (the user's way back)
    const zz = await page.evaluate(() => SN.getMap().getZoom());
    if (zz > 16.5) { const wp = await emptyPoint(rnd(), rnd()); if (wp) { xdo(`mousemove ${A(wp.x, wp.y).join(" ")}`); await sleep(100); for (let w = 0; w < 4; w++) { xdo("click 5"); await sleep(160); } await sample("wheel-out", c); } }
  }
  console.log("[stress]", JSON.stringify({ actions: nAct, samples: nSamp, uniformSea: nSea, seaActs: seaActs.slice(0, 12), paperTransient: nPaperT, paperOver25AtEnd: nPaperStuck, stuck: badActs.length, dbl: [dblZoomOk, dblN], keepLost, listFail, tileNet }));
  check("no settled frame stays uniform placeholder grey (or dark) for over 1.5 s (" + nAct + " actions, " + nSamp + " real-pixel samples, " + CYCLES + " rounds)", badActs.length === 0 && nAct >= CYCLES * 2.5,
    JSON.stringify(badActs.map((b) => ({ c: b.cyc, tag: b.tag, dom: b.dom }))).slice(0, 900));
  check("the sea spot double clicked to z17 shows loaded OSM sea (153,166,169 = #aad3df through the map filter), not the placeholder", seaActs.length > 0, JSON.stringify(seaActs.slice(0, 6)));
  check("PIZZAGIO's card stays through every hold / LIST X / double click (fast and slow) of the stress", keepLost === 0 && listFail === 0, JSON.stringify({ keepLost, listFail }));
  check("every stress double click zooms in one step (to z18 at most)", dblN > 0 && dblZoomOk === dblN, dblZoomOk + "/" + dblN);

  // ---- SELF-HEAL ----
  const hasHeal = await page.evaluate(() => !!(window.SN && SN.tileState));
  if (!hasHeal) console.log("NOTE no SN.tileState on this build: self-heal checks skipped");
  else {
    if ((await sh()).on) await closeX(); if ((await sh()).on) await closeX();
    const waitDom = async (fn, ms) => { const t = Date.now(); let d; while (Date.now() - t < ms) { d = await tileDom(); if (fn(d)) return { d, ms: Date.now() - t }; await sleep(120); } return { d: await tileDom(), ms: null }; };
    const gridGrab = async (name) => JSON.parse(execSync(`python3 ${GRAB} ${path.join(SHOTDIR, name + ".png")} 1 ${Math.round(ox + 70)} ${Math.round(oy + 70)} ${geo.iw - 140} ${geo.ih - 260}`).toString());
    // H1: OSM refuses every tile -> CARTO per tile, then the layer switches to CARTO
    await page.route(/tile\.openstreetmap\.org/, (r) => r.abort("blockedbyclient"));
    await page.evaluate(() => SN.getMap().setView([36.0889, 28.0861], 15, { animate: false })); /* Lindos: tiles never loaded this session */
    const h1 = await waitDom((d) => d.vis > 0 && d.carto === d.vis && d.ok === d.vis && d.heal && d.heal.src === "carto", 9000); await sleep(400);
    const g1 = await gridGrab("heal-osm-blocked-carto");
    console.log("[heal osm-blocked]", JSON.stringify(h1), JSON.stringify(g1));
    check("OSM refusing every tile: each tile falls back to CARTO and the layer switches to CARTO (map drawn: real pixels)", h1.ms != null && g1.std >= 10 && g1.paper < 0.5, JSON.stringify({ ms: h1.ms, d: h1.d, px: g1 }).slice(0, 600));
    // H2: every tile host refuses -> every tile errored -> heal within 2.5 s of moveend; hosts back -> tiles back without a reload
    await page.route(/cartocdn\.com/, (r) => r.abort("blockedbyclient"));
    const n0 = (await page.evaluate(() => SN.tileState().heals));
    await page.evaluate(() => { window.__h2At = 0; SN.getMap().once("moveend", () => { window.__h2At = Date.now(); }); SN.getMap().setView([36.2687, 27.9967], 15, { animate: false }); }); /* Kalavarda */
    const h2 = await waitDom((d) => d.heal && d.heal.heals > n0, 6000);
    const h2dt = await page.evaluate(() => (SN.tileState().lastAt || 0) - window.__h2At);
    console.log("[heal all-blocked]", JSON.stringify(h2), "heal after moveend ms", h2dt);
    check("every tile errored for over 1 s after moveend: the self-heal (invalidateSize + redraw) fires within 2.5 s", h2.ms != null && h2dt >= 900 && h2dt <= 2500 && /error|none/.test(h2.d.heal.why || ""), JSON.stringify({ dt: h2dt, heal: h2.d.heal }));
    await page.unroute(/cartocdn\.com/); await page.unroute(/tile\.openstreetmap\.org/);
    const h2b = await waitDom((d) => d.vis >= 4 && d.ok === d.vis, 12000); await sleep(400);
    const g2 = await gridGrab("heal-hosts-back");
    check("tile hosts answering again: the map fills by itself (no reload, no user move)", h2b.ms != null && g2.std >= 10 && g2.paper < 0.5, JSON.stringify({ ms: h2b.ms, d: h2b.d, px: g2 }).slice(0, 500));
    // H3: emptied tile containers (no visible tile at all) -> heal
    const n3 = await page.evaluate(() => SN.tileState().heals);
    await page.evaluate(() => { document.querySelectorAll("#city .leaflet-tile-container").forEach((c) => { c.innerHTML = ""; }); SN.getMap().panBy([1, 0], { animate: false }); });
    const h3 = await waitDom((d) => d.heal.heals > n3 && d.vis > 0 && d.ok === d.vis, 8000);
    check("no visible tile after a move: the self-heal redraws and the tiles come back", h3.ms != null && /none/.test(h3.d.heal.why || ""), JSON.stringify({ ms: h3.ms, d: h3.d }).slice(0, 500));
    // H4: zoom past the tile max -> blank (no tile exists) -> the heal clamps to the tile max
    const n4 = await page.evaluate(() => SN.tileState().heals);
    await page.evaluate(() => { const m = SN.getMap(); m.setView([36.4446, 28.2276], 18, { animate: false }); }); /* Rhodes old town: streets at z19 */
    await waitDom((d) => d.vis > 0 && d.ok === d.vis, 6000);
    const n4b = await page.evaluate(() => SN.tileState().heals);
    await page.evaluate(() => { const m = SN.getMap(); m.setMaxZoom(21); m.setZoom(20, { animate: false }); });
    const blank = await tileDom();
    const h4 = await waitDom((d) => d.heal.heals > n4b && d.z <= d.heal.max && d.vis > 0 && d.ok === d.vis, 8000);
    const g4 = await gridGrab("heal-zoom-clamped");
    console.log("[heal zoom]", JSON.stringify({ blank, h4 }), JSON.stringify(g4));
    check("zoom past the tile max (z20 > 19) is blank and the self-heal clamps it to the tile max with tiles back", blank.vis === 0 && h4.ms != null && h4.d.z <= 19 && g4.std >= 10, JSON.stringify({ blankVis: blank.vis, z: h4.d.z, ms: h4.ms, px: g4 }));
    await page.evaluate(() => SN.getMap().setMaxZoom(19));
  }
  const errs = errors.filter((e) => !/blockedbyclient|ERR_BLOCKED_BY_CLIENT|Failed to load resource/.test(e));
  check("no console errors (blocked test tiles aside)", errs.length === 0, JSON.stringify(errs.slice(0, 4)));
  console.log(fails.length ? "TILE STRESS FAILS: " + fails.length : "TILE STRESS " + STAMP + " ALL PASS");
  await browser.close();
  process.exit(fails.length ? 2 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

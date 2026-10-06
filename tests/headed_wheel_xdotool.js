/**
 * Headed real-input wheel test (4336): real Chromium (or REAL_CHROME=1 → /usr/bin/google-chrome) on the X display,
 * OS-level xdotool input. Two drags, hover the drawn Rhodes (pixel from the render's own projection), optional
 * HOLD ms with the cursor still, 15 wheel notches (`xdotool click 4`, GAP ms apart).
 * PASS: the city opens and its centre is within 1° of Rhodes. HUNTS=1 then replays supermarket/pizza in Rhodes,
 * the Gondola sheet, and 'pizza in Athens Greece' (must stay cityOn, centre within 0.2° of Athens).
 * Env: PREVIEW_URL, STAMP, LOCAL_APP (patched app.js), DISPLAY, WIN=1280x800, RESIZE=1, HOLD, GAP, SPIN, DEBUGQ=1 (&debug=wheel), SHOT, SHOT2.
 */
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const fs = require("fs");
const BASE = process.env.PREVIEW_URL || "https://astranov-git-grokbuild-4328-street-level-gps-astranov.vercel.app/";
const URL0 = BASE + (BASE.includes("?") ? "&" : "?") + "v=" + (process.env.STAMP || "4336") + "&t=" + Date.now() + (process.env.DEBUGQ ? "&debug=wheel" : "");
const RHODES = { lat: 36.4349, lng: 28.2176 };
const [WW, WH] = (process.env.WIN || "1280x800").split("x").map(Number);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const xdo = (a) => execSync("xdotool " + a, { env: process.env });
function near(a, b, t) { if (!a || !b) return false; let d = Math.abs(a.lng - b.lng); if (d > 180) d = 360 - d; return Math.abs(a.lat - b.lat) < t && d < t; }

(async () => {
  const browser = await chromium.launch({ headless: false, executablePath: process.env.REAL_CHROME ? "/usr/bin/google-chrome" : undefined, args: ["--window-position=0,0", "--window-size=" + WW + "," + WH, "--no-first-run", "--no-default-browser-check"] });
  const ctx = await browser.newContext({ viewport: null, serviceWorkers: process.env.LOCAL_APP ? "block" : "allow" });
  const page = await ctx.newPage();
  if (process.env.LOCAL_APP) {
    const body = fs.readFileSync(process.env.LOCAL_APP);
    await page.route(/\/js\/spacenet\/app\.js/, (r) => r.fulfill({ status: 200, contentType: "application/javascript", body }));
  }
  const logs = [];
  page.on("console", (m) => { const t = m.text(); if (t.includes("sn:wheel")) logs.push(t); });
  await page.addInitScript(() => {
    window.__ev = [];
    const od = console.debug;
    console.debug = function () { try { if (arguments[0] === "sn:wheel") window.__ev.push(["pick", Math.round(performance.now()), JSON.stringify(arguments[1])]); } catch (e) {} return od.apply(console, arguments); };
    window.addEventListener("wheel", (e) => window.__ev.push(["wheel", Math.round(performance.now()), e.clientX, e.clientY, e.deltaY, e.deltaMode]), true);
    window.addEventListener("mousemove", (e) => { window.__mm = [e.clientX, e.clientY, e.screenX, e.screenY]; }, true);
  });
  await page.goto(URL0, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.bringToFront();
  await sleep(4000);
  // find the content origin on screen: move the OS cursor and read clientX/screenX
  xdo("mousemove 600 500"); await sleep(150); xdo("mousemove 601 501"); await sleep(250);
  const mm = await page.evaluate(() => window.__mm);
  const ox = 601 - mm[0], oy = 501 - mm[1];
  const geo = await page.evaluate(() => ({ iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio, c: (() => { const r = document.getElementById("g").getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; })() }));
  console.log("content origin on screen", ox, oy, "inner", geo.iw + "x" + geo.ih, "dpr", geo.dpr, "canvas", JSON.stringify(geo.c));
  if (process.env.RESIZE) {
    const wid = execSync("xdotool getactivewindow").toString().trim();
    xdo("windowsize " + wid + " " + (WW - 180) + " " + (WH - 90)); await sleep(1500);
    const g2 = await page.evaluate(() => ({ iw: innerWidth, ih: innerHeight }));
    console.log("after resize inner", g2.iw + "x" + g2.ih);
  }
  const S = (x, y) => [Math.round(ox + x), Math.round(oy + y)];
  async function drag(x0, y0, dx, dy) {
    const [a, b] = S(x0, y0);
    xdo(`mousemove ${a} ${b}`); await sleep(60);
    xdo("mousedown 1"); await sleep(40);
    for (let i = 1; i <= 15; i++) { const [c, d] = S(x0 + (dx * i) / 15, y0 + (dy * i) / 15); xdo(`mousemove ${c} ${d}`); await sleep(16); }
    xdo("mouseup 1"); await sleep(50);
  }
  const W2 = geo.iw / 2, H2 = geo.ih / 2;
  await drag(W2, H2, -200, 80); await sleep(400);
  await drag(W2, H2, 300, -50);
  xdo(`mousemove ${S(4, geo.ih - 4).join(" ")}`); // park off-globe
  await sleep(Number(process.env.SPIN || 3000));
  // wait for Rhodes to be on the visible face, then hover its drawn pixel
  let px = null; const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    px = await page.evaluate((p) => { const s = SN.projectFrame(p.lat, p.lng); return s && { x: s.x, y: s.y, z: s.z }; }, RHODES);
    if (px && px.z > 0.4 && px.x > 150 && px.x < geo.iw - 150 && px.y > 150 && px.y < geo.ih - 150) break;
    px = null; await sleep(200);
  }
  if (!px) { console.log("Rhodes never wheelable"); await browser.close(); process.exit(3); }
  const canvasNow = await page.evaluate(() => { const r = document.getElementById("g").getBoundingClientRect(); return { l: r.left, t: r.top }; });
  const cx = canvasNow.l + px.x, cy = canvasNow.t + px.y;
  xdo(`mousemove ${S(cx, cy).join(" ")}`); await sleep(120);
  const mm2 = await page.evaluate(() => window.__mm);
  const pickNow = await page.evaluate(([x, y]) => SN.globeHitTest(x, y), [cx - canvasNow.l, cy - canvasNow.t]);
  console.log("hover Rhodes drawn px", cx.toFixed(1), cy.toFixed(1), "client seen", JSON.stringify(mm2.slice(0, 2)), "pick under cursor", JSON.stringify(pickNow));
  await sleep(Number(process.env.HOLD || 0)); // cursor parked still on the drawn spot (tester takes a screenshot, etc.)
  await page.evaluate(() => { window.__ev = []; });
  const gap = Number(process.env.GAP || 110);
  for (let i = 0; i < 15; i++) { xdo("click 4"); await sleep(gap); }
  await sleep(3000);
  const ev = await page.evaluate(() => window.__ev);
  const wheels = ev.filter((e) => e[0] === "wheel"), picks = ev.filter((e) => e[0] === "pick");
  console.log("wheel events", wheels.length, "deltas", wheels.map((w) => w[4]).join(","), "picks", picks.length);
  picks.forEach((p) => console.log("  pick", p[1], p[2]));
  const st = await page.evaluate(() => { const m = SN.getMap(); const c = document.getElementById("city"); return { cityOn: c.classList.contains("on"), center: m && m.getCenter(), zoom: m && m.getZoom(), cam: SN.getCam(), line: document.getElementById("line").textContent }; });
  const ok = st.cityOn && near(st.center, RHODES, 1);
  console.log("final", JSON.stringify(st));
  console.log("HEADED_WHEEL", ok ? "PASS" : "FAIL", "centre", st.center && st.center.lat.toFixed(3) + "," + st.center.lng.toFixed(3), "vs Rhodes", RHODES.lat + "," + RHODES.lng);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  let huntOk = true;
  if (process.env.HUNTS) {
    const navs = [];
    page.on("framenavigated", (fr) => { if (fr === page.mainFrame()) navs.push(fr.url()); });
    const state = () => page.evaluate(() => { const m = SN.getMap(); const c = document.getElementById("city"); const cc = m && m.getCenter();
      return { cityOn: c.classList.contains("on"), op: c.style.opacity, center: cc && [+cc.lat.toFixed(4), +cc.lng.toFixed(4)], zoom: m && m.getZoom(), cam: SN.getCam(),
        find: ((document.getElementById("sn-sheet-card") || {}).textContent || "").match(/FIND\s*·\s*(\d+|…)/), live: (document.getElementById("sn-pulse") || {}).textContent, line: document.getElementById("line").textContent }; });
    async function say(t) {
      const [a, b] = S(geo.iw / 2, geo.ih - 20); // talk bar
      await page.click("#in"); await page.fill("#in", t); await page.press("#in", "Enter");
    }
    for (const q of ["supermarket in Rhodes", "pizza in Rhodes"]) { await say(q); await sleep(14000); console.log("[" + q + "]", JSON.stringify(await state())); }
    // open Gondola sheet via the FIND row (real click)
    const row = await page.$("#sn-sheet-body .pill:has-text('Gondola')");
    if (row) { await row.click(); await sleep(2500); console.log("[gondola sheet]", (await page.evaluate(() => (document.querySelector("#sn-sheet .sn-prof") || {}).textContent || "")).slice(0, 160)); }
    await say("pizza in Athens Greece");
    for (let i = 0; i < 4; i++) { await sleep(5000); console.log("[athens +" + (5 * (i + 1)) + "s]", JSON.stringify(await state())); }
    const a = await state();
    huntOk = a.cityOn && a.center && Math.abs(a.center[0] - 37.9838) < 0.2 && Math.abs(a.center[1] - 23.7275) < 0.2;
    console.log("navigations during hunts:", JSON.stringify(navs));
    if (process.env.SHOT2) await page.screenshot({ path: process.env.SHOT2 });
    console.log("HEADED_ATHENS", huntOk ? "PASS" : "FAIL");
  }
  await browser.close();
  process.exit(ok && huntOk ? 0 : 2);
})().catch((e) => { console.error("fail", e); process.exit(1); });

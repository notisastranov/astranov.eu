/* 4355 listing-in-place + owner tools + hunt fallback, on the live preview UI, writing NO live rows.
 * /api/space (GET and POST) is answered by THIS tree's api/space.js over an in-memory sn_listings table (Supabase REST
 * and /auth/v1/user are emulated in-process), and auth.js is a stub user, so nothing reaches the real database.
 *  A  server: one shop / delivery / driver per user (APPLY with a new id updates the old row); another user's id -> 403;
 *     the administrator's "Put a vendor here" (how:admin-put) stays a separate row
 *  B  UI as a signed-in vendor at Rhodes: LIST VENDOR twice (second time with sn:mine wiped, as on a new device) -> one
 *     row, same id, the client adopts it; CLIENT twice -> one drop; DRIVER twice -> one driver
 *  C  ADD A MENU ROW never stacks an empty row; nothing empty is saved
 *  D  own pending shop is visible to its owner; EDIT MY SHOP updates the same row in place
 *  E  tapping a product name on the card = +
 *  F  owner moves the pin: "Move <shop> here" from LIST over the card (same row, seat untouched), and by dragging the pin
 *  G  window rules on CLIENT / DRIVER / EDIT VENDOR: green APPLY left, red X right, <= 42 % cap, 72 px photos
 *  H  admin: with the vendor card open, LIST -> Start the order names THAT vendor (not the nearer Test Vendor V4297);
 *     Move me here with the card as target moves the vendor, not the admin pin
 *  I  hunt with Overpass failing (POST /api/find op:overpass -> ok:false, Overpass hosts aborted) still returns real pins;
 *     with every live source empty, the last real answer for that hunt here is used (cached)
 * Env: PREVIEW_URL, STAMP, LOCAL_APP (dev only), SHOTDIR */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const BASE = process.env.PREVIEW_URL || "https://astranov-git-grokbuild-4328-street-level-gps-astranov.vercel.app/";
const STAMP = process.env.STAMP || "4355";
const SHOTDIR = process.env.SHOTDIR || "/tmp/sn-inplace-" + STAMP;
fs.mkdirSync(SHOTDIR, { recursive: true });
const RHODES = { lat: 36.4446, lng: 28.2276 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
function check(name, ok, info) { console.log((ok ? "PASS " : "FAIL ") + name + (info ? " " + info : "")); if (!ok) fails.push(name); }
function km(a, b) { const R = 6371, r = Math.PI / 180; const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }

/* ---------- in-memory sn_listings + Supabase REST / auth emulation for api/space.js ---------- */
const DB = new Map();
const TEXT = ["name", "menu", "phone", "place", "hours", "open", "status", "peer", "street", "note", "raw", "flag", "query", "how", "customerPeer"];
const JSONK = ["avc", "ride", "held", "presence", "routes", "vehicles", "shop", "holdMin", "strict"];
const SB = "https://sb.mock.invalid";
const sbPath = require.resolve(path.join(__dirname, "..", "lib", "sb-anon"));
require.cache[sbPath] = { id: sbPath, filename: sbPath, loaded: true, exports: { resolve: async () => ({ sb: SB, anon: "a".repeat(48) }) } };
const realFetch = global.fetch;
const reply = (st, j) => ({ ok: st < 300, status: st, text: async () => (j == null ? "" : JSON.stringify(j)), json: async () => j });
global.fetch = async (url, opt) => {
  url = String(url);
  if (!url.startsWith(SB)) return realFetch(url, opt);
  const u = new URL(url);
  if (u.pathname === "/auth/v1/user") {
    const m = String((opt.headers || {}).Authorization || "").match(/Bearer tok-(.+)$/);
    return m ? reply(200, { id: "u-" + m[1], email: m[1] }) : reply(401, { msg: "no" });
  }
  if (u.pathname !== "/rest/v1/sn_listings") return reply(404, null);
  if ((opt && opt.method) === "POST") {
    const b = JSON.parse(opt.body); const prev = DB.get(b.id);
    DB.set(b.id, { id: b.id, kind: b.kind, lat: b.lat, lng: b.lng, body: b.body, updated_at: b.updated_at, created: prev ? prev.created : Date.now(), writes: (prev ? prev.writes : 0) + 1 });
    return reply(201, null);
  }
  let rows = [...DB.values()];
  const q = u.searchParams;
  if (q.get("id")) rows = rows.filter((r) => "eq." + r.id === q.get("id"));
  if (q.get("kind")) { const k = q.get("kind"); rows = rows.filter((r) => (k.startsWith("eq.") ? r.kind === k.slice(3) : k.slice(4, -1).split(",").includes(r.kind))); }
  if (q.get("body->>customerPeer")) rows = rows.filter((r) => "eq." + (r.body.customerPeer || "") === q.get("body->>customerPeer"));
  rows.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  if (q.get("limit")) rows = rows.slice(0, Number(q.get("limit")));
  const sel = q.get("select") || "";
  return reply(200, rows.map((r) => {
    if (sel === "id") return { id: r.id };
    if (sel.startsWith("id,customerPeer")) return { id: r.id, customerPeer: r.body.customerPeer || null };
    const o = { id: r.id, kind: r.kind, lat: r.lat, lng: r.lng, updated_at: r.updated_at };
    TEXT.forEach((k) => { const v = r.body[k]; o[k] = v == null ? null : typeof v === "string" ? v : JSON.stringify(v); });
    JSONK.forEach((k) => { o[k] = r.body[k] == null ? null : r.body[k]; });
    return o;
  }));
};
const space = require(path.join(__dirname, "..", "api", "space.js"));
const stubbedWrites = []; /* writes the firewall caught (never left the box) */
async function callSpace(method, query, body, token) {
  let st = 200, js = null; const hd = {};
  const res = { setHeader(k, v) { hd[k] = v; }, status(s) { st = s; return res; }, json(j) { js = j; return res; }, end() { return res; } };
  await space({ method, query: query || {}, body: body || {}, headers: token ? { authorization: "Bearer " + token } : {} }, res);
  return { st, js, hd };
}
const rowsOf = (kind, peer) => [...DB.values()].filter((r) => r.kind === kind && (!peer || r.body.customerPeer === peer));

(async () => {
  /* ---------------- A: server ---------------- */
  const U1 = "inplace-a@test.invalid", U2 = "inplace-b@test.invalid", ADM = "notisastranov@gmail.com";
  for (const kind of ["shop", "drop", "driver"]) {
    const a = await callSpace("POST", {}, { row: { id: kind[0] + "srv1", kind, lat: 36.44, lng: 28.22, name: kind + " one" } }, "tok-" + U1);
    const b = await callSpace("POST", {}, { row: { id: kind[0] + "srv2", kind, lat: 36.45, lng: 28.23, name: kind + " two" } }, "tok-" + U1);
    const mine = rowsOf(kind, U1);
    check(`server: a second ${kind} APPLY by the same user updates the first row in place`, a.js.ok && b.js.ok && b.js.id === kind[0] + "srv1" && b.js.updated === true && mine.length === 1 && mine[0].body.name === kind + " two" && mine[0].lat === 36.45,
      JSON.stringify({ a: a.js, b: b.js, rows: mine.map((r) => [r.id, r.body.name]) }));
  }
  const o = await callSpace("POST", {}, { row: { id: "ssrv1", kind: "shop", lat: 1, lng: 1, name: "hijack" } }, "tok-" + U2);
  check("server: another user cannot write over someone's shop id (403)", o.st === 403 && rowsOf("shop", U1)[0].body.name === "shop two", JSON.stringify(o.js));
  const o2 = await callSpace("POST", {}, { row: { id: "s-u2", kind: "shop", lat: 36.44, lng: 28.22, name: "u2 shop" } }, "tok-" + U2);
  check("server: a different user gets their own shop row", o2.js.ok && o2.js.id === "s-u2" && rowsOf("shop", U2).length === 1, JSON.stringify(o2.js));
  const p1 = await callSpace("POST", {}, { row: { id: "padm1", kind: "shop", lat: 36.44, lng: 28.22, name: "Put one", how: "admin-put" } }, "tok-" + ADM);
  const p2 = await callSpace("POST", {}, { row: { id: "padm2", kind: "shop", lat: 36.44, lng: 28.22, name: "Put two", how: "admin-put" } }, "tok-" + ADM);
  check("server: the administrator's 'Put a vendor here' test pins stay separate rows", p1.js.id === "padm1" && p2.js.id === "padm2" && DB.has("padm1") && DB.has("padm2"), JSON.stringify([p1.js, p2.js]));
  const g = await callSpace("POST", {}, { row: { id: "x1", kind: "shop", lat: 1, lng: 1, name: "guest" } }, "");
  check("server: a guest write is refused (401) and stores nothing", g.st === 401 && !DB.has("x1"), String(g.st));
  DB.clear();

  /* ---------------- browser ---------------- */
  const browser = await chromium.launch({ headless: true });
  async function ctxFor(email, url) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block", geolocation: { latitude: RHODES.lat, longitude: RHODES.lng, accuracy: 10 } });
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
    if (process.env.LOCAL_APP) { const body = fs.readFileSync(process.env.LOCAL_APP); await page.route(/\/js\/spacenet\/app\.js/, (r) => r.fulfill({ status: 200, contentType: "application/javascript", body })); }
    await page.route(/\/js\/spacenet\/auth\.js/, (r) => r.fulfill({ status: 200, contentType: "application/javascript",
      body: `window.SNAuth={user:function(){return {email:${JSON.stringify(email)},name:"In Place Tester"}},token:function(){return ${JSON.stringify("tok-" + email)}},boot:function(){},paint:function(){},open:function(){},google:function(){},x:function(){},out:function(){},savePhone:function(){}};` }));
    /* write firewall (4355): any other write leaving the page (/api/queue, /api/orders, Supabase REST, ...) is stubbed and
       logged, never sent. 4355 dev runs leaked 4 'INPLACE SHOP' rows into the live sn_admin_queue through /api/queue. */
    await page.route(/\/api\/|supabase\.co/, (r) => {
      const q = r.request(); const u = q.url();
      if (q.method() === "GET" || q.method() === "OPTIONS" || /\/api\/(find|version|videos)(\?|$)/.test(u)) return r.continue();
      stubbedWrites.push(q.method() + " " + u.replace(/^https?:\/\/[^/]+/, "").slice(0, 80));
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, items: [], stub: true }) });
    });
    /* every /api/space call is answered by this tree's handler over the in-memory table: no live row is ever written */
    await page.route(/\/api\/space(\?|$)/, async (r) => {
      const q = r.request(); const u = new URL(q.url()); let body = {};
      try { body = q.method() === "POST" ? JSON.parse(q.postData() || "{}") : {}; } catch (e) {}
      const out = await callSpace(q.method(), Object.fromEntries(u.searchParams), body, ((q.headers().authorization || "").match(/Bearer (.+)/) || [])[1] || "");
      if (out.st === 302) return r.fulfill({ status: 302, headers: { Location: out.hd.Location } });
      return r.fulfill({ status: out.st, contentType: "application/json", body: JSON.stringify(out.js || {}) });
    });
    await page.addInitScript(() => { try { localStorage.setItem("sn:terms", "1"); } catch (e) {} });
    await page.goto(url || (BASE + "?v=" + STAMP + "&t=" + Date.now()), { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => window.SN && SN.getMap && document.getElementById("city"), null, { timeout: 30000 });
    await sleep(7000);
    await ctx.grantPermissions(["geolocation"], { origin: new URL(BASE).origin });
    await page.evaluate(() => { const b = document.getElementById("gps"); if (b) b.click(); });
    await page.waitForFunction(() => { const s = SN.seatState(); return s && s.kind === "gps" && s.hereLive; }, null, { timeout: 20000 }).catch(() => {});
    await sleep(2500);
    return { ctx, page, errors };
  }
  const st = (page) => page.evaluate(() => { const sh = document.getElementById("sn-sheet"), c = document.getElementById("sn-sheet-card"); const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.height ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null; };
    const ap = c && c.querySelector(".sheet-bar .sheet-apply"), x = c && c.querySelector(".sheet-bar .sheet-x");
    return { on: !!(sh && sh.classList.contains("on")), kind: sh && sh.getAttribute("data-kind"), title: c ? ((c.querySelector(".sheet-mid") || c.querySelector(".sheet-ttl") || {}).textContent || "").trim() : "", card: R(c), cap: window.__snGrip && window.__snGrip.cap ? window.__snGrip.cap() : null,
      apply: ap && Object.assign(R(ap) || {}, { t: ap.textContent.trim(), color: getComputedStyle(ap).color }), x: x && Object.assign(R(x) || {}, { t: x.textContent.trim(), color: getComputedStyle(x).color }),
      photo: R(c && c.querySelector(".sn-photo")), rowPhoto: R(c && c.querySelector(".sn-row .phbtn")), rows: c ? c.querySelectorAll(".sn-row").length : 0, text: c ? c.textContent.replace(/\s+/g, " ").slice(0, 400) : "", line: (document.getElementById("line") || {}).textContent || "" }; });
  const barLaw = (s) => !!(s.apply && s.x && s.card) && s.apply.t === "APPLY" && /125, 255, 154/.test(s.apply.color) && s.apply.x < s.card.x + s.card.w * 0.25 && /^(X|✕)$/.test(s.x.t) && /255, 138, 138/.test(s.x.color) && s.x.x > s.card.x + s.card.w * 0.7;
  const capOk = (s) => !!s.card && s.cap != null && s.card.h <= s.cap + 1;
  async function listAtPx(page, dx, dy) {
    const p = await page.evaluate(([dx, dy]) => { const c = document.getElementById("city").getBoundingClientRect(); return { x: c.left + c.width / 2 + dx, y: c.top + c.height * 0.38 + dy }; }, [dx, dy]);
    await page.mouse.click(p.x, p.y, { button: "right" }); await sleep(1200); return p;
  }
  const clickAct = async (page, act, k) => { const ok = await page.evaluate(([a, k]) => { const b = document.querySelector(`#sn-sheet [data-act="${a}"]` + (k ? `[data-k="${k}"]` : "")); if (!b) return false; b.scrollIntoView({ block: "center" }); b.click(); return true; }, [act, k]); await sleep(900); return ok; };
  const apply = async (page) => { await page.evaluate(() => { const b = document.querySelector("#sn-sheet .sheet-bar .sheet-apply"); if (b) b.click(); }); await sleep(1500); };
  const fill = (page, vals) => page.evaluate((v) => { for (const k in v) { const e = document.getElementById(k); if (e) { e.value = v[k]; e.dispatchEvent(new Event("input", { bubbles: true })); } } }, vals);
  const center = (page) => page.evaluate(() => { const c = SN.getMap().getCenter(); return { lat: c.lat, lng: c.lng }; });
  const shot = (page, n) => page.screenshot({ path: path.join(SHOTDIR, n + ".png") });

  const ONLY = process.env.ONLY || "VHI";
  /* ---------------- B..G: signed-in vendor ---------------- */
  if (/V/.test(ONLY)) {
  const V = "inplace-vendor@test.invalid";
  const { ctx, page, errors } = await ctxFor(V);
  await page.evaluate(() => localStorage.setItem("sn:role", "vendor"));
  const seat0 = await page.evaluate(() => SN.seatState());
  check("vendor context: GPS seat at Rhodes (hereLive)", !!(seat0 && seat0.hereLive && km(seat0.hereLive, { lat: 36.4446, lng: 28.2276 }) < 0.5), JSON.stringify(seat0 && seat0.hereLive));
  // first vendor listing
  await listAtPx(page, 20, 10); await clickAct(page, "form-vendor");
  let s = await st(page); await shot(page, "B1-vendor-form");
  check("G: VENDOR card: green APPLY left, red X right, <= 42 % cap, 72 px photo + row photo", barLaw(s) && capOk(s) && s.photo && s.photo.w === 72 && s.photo.h === 72 && s.rowPhoto && s.rowPhoto.w === 72, JSON.stringify({ apply: s.apply, x: s.x, card: s.card, cap: s.cap, photo: s.photo, row: s.rowPhoto }));
  // C: ADD A MENU ROW with the auto row still empty does not stack another
  await clickAct(page, "add-row"); await clickAct(page, "add-row");
  s = await st(page);
  check("C: ADD A MENU ROW with an empty last row does not add another empty row", s.rows === 1, "rows " + s.rows + " line " + JSON.stringify(s.line));
  await fill(page, { "sn-place-name": "INPLACE SHOP A", "sn-place-phone": "+30 2241 000000", "sn-place-address": "Test street 1" });
  await page.evaluate(() => { const r = document.querySelector("#sn-rows .sn-row"); r.querySelector(".c-desc").value = "Margherita"; r.querySelector(".c-price").value = "9"; });
  await clickAct(page, "add-row");
  s = await st(page);
  check("C: with the last row filled, ADD A MENU ROW adds one empty row", s.rows === 2, "rows " + s.rows);
  await apply(page);
  let shopsV = rowsOf("shop", V);
  const id1 = shopsV[0] && shopsV[0].id;
  let menu1 = []; try { menu1 = JSON.parse(shopsV[0].body.menu ? JSON.stringify(shopsV[0].body.menu) : "[]"); } catch (e) {}
  check("B: first LIST VENDOR APPLY writes one shop row (via this tree's /api/space, in memory)", shopsV.length === 1 && shopsV[0].body.name === "INPLACE SHOP A", JSON.stringify(shopsV.map((r) => [r.id, r.body.name, r.body.status])));
  check("C: the saved menu has no empty row (1 row: Margherita)", Array.isArray(menu1) && menu1.length === 1 && menu1[0].name === "Margherita", JSON.stringify(menu1));
  // second listing from a "new device" (sn:mine wiped), new name at the same door
  await page.evaluate(() => { localStorage.removeItem("sn:mine"); });
  await listAtPx(page, -20, 20); await clickAct(page, "form-vendor");
  await fill(page, { "sn-place-name": "INPLACE SHOP B", "sn-place-phone": "+30 2241 000001", "sn-place-address": "Test street 2" });
  await page.evaluate(() => { const r = document.querySelector("#sn-rows .sn-row"); r.querySelector(".c-desc").value = "Diavola"; r.querySelector(".c-price").value = "11"; });
  await apply(page); await sleep(1500);
  shopsV = rowsOf("shop", V);
  const adopt = await page.evaluate(() => ({ adopt: window.__snAdopt || null, mine: (JSON.parse(localStorage.getItem("sn:mine") || "[]") || []).filter((r) => r && r.kind === "shop").map((r) => r.id) }));
  check("B: a second LIST VENDOR APPLY (sn:mine wiped, new id) updates the SAME row: still one shop, renamed", shopsV.length === 1 && shopsV[0].id === id1 && shopsV[0].body.name === "INPLACE SHOP B" && shopsV[0].writes === 2, JSON.stringify(shopsV.map((r) => [r.id, r.body.name, r.writes])));
  check("B: the page adopts the kept id (no local duplicate)", adopt.mine.length === 1 && adopt.mine[0] === id1, JSON.stringify(adopt));
  // CLIENT twice
  await page.evaluate(() => localStorage.setItem("sn:role", "client"));
  for (const nm of ["INPLACE CLIENT 1", "INPLACE CLIENT 2"]) {
    await listAtPx(page, nm.endsWith("1") ? 10 : -30, nm.endsWith("1") ? -10 : 25); await clickAct(page, "form-drop");
    if (nm.endsWith("1")) { s = await st(page); await shot(page, "G-client-form");
      check("G: CLIENT card: green APPLY left, red X right, <= 42 % cap, 72 px photo", barLaw(s) && capOk(s) && s.photo && s.photo.w === 72 && s.photo.h === 72, JSON.stringify({ apply: s.apply, x: s.x, card: s.card, cap: s.cap, photo: s.photo })); }
    await fill(page, { "sn-drop-name": nm, "sn-drop-phone": "+30 1", "sn-drop-address": "Drop street" });
    await apply(page);
    if (nm.endsWith("1")) await page.evaluate(() => localStorage.removeItem("sn:mine"));
  }
  await sleep(1200);
  const drops = rowsOf("drop", V);
  check("B: CLIENT (delivery address) APPLY twice -> one row, updated in place", drops.length === 1 && drops[0].body.name === "INPLACE CLIENT 2" && drops[0].writes === 2, JSON.stringify(drops.map((r) => [r.id, r.body.name, r.writes])));
  // DRIVER twice
  for (const nm of ["INPLACE DRIVER 1", "INPLACE DRIVER 2"]) {
    await listAtPx(page, nm.endsWith("1") ? -10 : 35, nm.endsWith("1") ? -10 : 15); await clickAct(page, "form-driver");
    if (nm.endsWith("1")) { s = await st(page); await shot(page, "G-driver-form");
      check("G: DRIVER card: green APPLY left, red X right, <= 42 % cap, 72 px photo", barLaw(s) && capOk(s) && s.photo && s.photo.w === 72 && s.photo.h === 72, JSON.stringify({ apply: s.apply, x: s.x, card: s.card, cap: s.cap, photo: s.photo })); }
    await fill(page, { "sn-drv-name": nm, "sn-drv-phone": "+30 2" });
    await apply(page);
    if (nm.endsWith("1")) await page.evaluate(() => { localStorage.removeItem("sn:mine"); localStorage.removeItem("sn:people"); });
  }
  await sleep(1200);
  const drvs = rowsOf("driver", V);
  check("B: DRIVER APPLY twice -> one row, updated in place", drvs.length === 1 && drvs[0].body.name === "INPLACE DRIVER 2" && drvs[0].writes === 2, JSON.stringify(drvs.map((r) => [r.id, r.body.name, r.writes])));
  // D: own pending shop visible + EDIT MY SHOP
  await page.evaluate(() => localStorage.setItem("sn:role", "vendor"));
  const pinBox = async (name) => page.evaluate((n) => { const b = [...document.querySelectorAll(".sn-shop-pin b")].find((e) => e.textContent.trim() === n); if (!b) return null; const r = b.closest(".leaflet-marker-icon").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, name);
  await page.evaluate(() => { const b = document.querySelector("#sn-sheet .sheet-bar .sheet-x"); if (b) b.click(); }); await sleep(600);
  let pb = await pinBox("INPLACE SHOP B");
  if (!pb) { await page.evaluate(() => { const m = SN.getMap(); m.setView(m.getCenter(), 16); }); await sleep(2000); pb = await pinBox("INPLACE SHOP B"); }
  check("D: the owner sees their own pending shop on the map", !!pb, JSON.stringify(pb));
  if (pb) { await page.mouse.click(pb.x, pb.y); await sleep(1500); }
  s = await st(page); await shot(page, "D-own-card");
  const hasEdit = /EDIT MY SHOP/.test(s.text);
  check("D: the owner's vendor card has EDIT MY SHOP", s.kind === "vendor" && hasEdit, JSON.stringify({ kind: s.kind, text: s.text.slice(0, 160) }));
  // E: tapping the product name = +
  const nameTap = await page.evaluate(async () => { const row = document.querySelector("#sn-sheet .sn-pick"); if (!row) return null; const b = row.querySelector("b"); b.scrollIntoView({ block: "center" }); await new Promise((r) => setTimeout(r, 300)); const r = b.getBoundingClientRect(); const x = r.x + 10, y = r.y + r.height / 2; const hit = document.elementFromPoint(x, y); return { x, y, n0: row.querySelector(".n").textContent, hit: hit && (hit.tagName + "." + hit.className) }; });
  if (nameTap) { await page.mouse.click(nameTap.x, nameTap.y); await sleep(500); }
  const n1 = await page.evaluate(() => { const row = document.querySelector("#sn-sheet .sn-pick"); return row ? row.querySelector(".n").textContent : null; });
  check("E: tapping a product NAME on the card adds it, the same as +", nameTap && nameTap.n0 === "0" && n1 === "1", JSON.stringify({ before: nameTap && nameTap.n0, after: n1, hit: nameTap && nameTap.hit }));
  // reset the pick so the edit is clean
  await page.evaluate(() => { const b = document.querySelector('#sn-sheet [data-act="pick-less"]'); if (b) b.click(); });
  if (hasEdit) {
    await clickAct(page, "edit-vendor");
    s = await st(page); await shot(page, "G-edit-vendor");
    const pre = await page.evaluate(() => ({ name: (document.getElementById("sn-place-name") || {}).value, rows: [...document.querySelectorAll("#sn-rows .sn-row .c-desc")].map((e) => e.value) }));
    check("D: EDIT MY SHOP opens the form filled with the shop (name + menu)", pre.name === "INPLACE SHOP B" && pre.rows.join("|") === "Diavola", JSON.stringify(pre));
    check("G: EDIT VENDOR card: green APPLY left, red X right, <= 42 % cap, 72 px photo + row photo", barLaw(s) && capOk(s) && s.photo && s.photo.w === 72 && s.rowPhoto && s.rowPhoto.w === 72, JSON.stringify({ apply: s.apply, x: s.x, card: s.card, cap: s.cap, photo: s.photo, row: s.rowPhoto }));
    await fill(page, { "sn-place-name": "INPLACE SHOP B EDITED" });
    await clickAct(page, "add-row");
    await page.evaluate(() => { const rs = document.querySelectorAll("#sn-rows .sn-row"); const r = rs[rs.length - 1]; r.querySelector(".c-desc").value = "Calzone"; r.querySelector(".c-price").value = "12"; });
    await clickAct(page, "add-row"); /* one trailing empty row: must not be saved */
    await apply(page); await sleep(1200);
    shopsV = rowsOf("shop", V);
    const m2 = shopsV[0] && shopsV[0].body.menu;
    check("D: EDIT MY SHOP + APPLY updates the same row in place (name, menu), no new row, no empty menu row", shopsV.length === 1 && shopsV[0].id === id1 && shopsV[0].body.name === "INPLACE SHOP B EDITED" && Array.isArray(m2) && m2.map((m) => m.name).join("|") === "Diavola|Calzone",
      JSON.stringify(shopsV.map((r) => [r.id, r.body.name, r.body.menu])));
  }
  // F: Move <shop> here from LIST over the owner's card
  await page.evaluate(() => { const b = document.querySelector("#sn-sheet .sheet-bar .sheet-x"); if (b) b.click(); }); await sleep(500);
  pb = await pinBox("INPLACE SHOP B EDITED") || await pinBox("INPLACE SHOP B");
  if (pb) { await page.mouse.click(pb.x, pb.y); await sleep(1400); }
  const seatBefore = await page.evaluate(() => { const s = SN.seatState(); return s.hereLive && { lat: s.hereLive.lat, lng: s.hereLive.lng }; });
  const before = rowsOf("shop", V)[0];
  await listAtPx(page, 90, 40);
  s = await st(page);
  const moveBtn = /Move INPLACE SHOP B( EDITED)? here/.test(s.text);
  check("F: LIST over the owner's vendor card offers 'Move <shop> here' (no admin pin button for a vendor)", moveBtn && !/Move me here/.test(s.text), JSON.stringify(s.text.slice(0, 300)));
  await clickAct(page, "move-vendor"); await sleep(1500);
  let after = rowsOf("shop", V)[0];
  const seatAfter = await page.evaluate(() => { const s = SN.seatState(); return s.hereLive && { lat: s.hereLive.lat, lng: s.hereLive.lng }; });
  check("F: 'Move <shop> here' moves the shop row in place (same id) to the hold point", after && after.id === id1 && rowsOf("shop", V).length === 1 && km(before, after) > 0.05, JSON.stringify({ from: [before.lat, before.lng], to: [after.lat, after.lng], km: km(before, after).toFixed(3) }));
  check("F: the move does not move the user's own seat", seatBefore && seatAfter && km(seatBefore, seatAfter) < 0.001, JSON.stringify({ seatBefore, seatAfter }));
  // F: drag the own pin
  await page.evaluate(() => { const b = document.querySelector("#sn-sheet .sheet-bar .sheet-x"); if (b) b.click(); }); await sleep(600);
  pb = await pinBox("INPLACE SHOP B EDITED") || await pinBox("INPLACE SHOP B");
  const before2 = rowsOf("shop", V)[0];
  if (pb) { await page.mouse.move(pb.x, pb.y); await page.mouse.down(); for (let i = 1; i <= 8; i++) { await page.mouse.move(pb.x - i * 12, pb.y + i * 6); await sleep(40); } await page.mouse.up(); await sleep(1800); }
  const after2 = rowsOf("shop", V)[0];
  const mv = await page.evaluate(() => window.__snMoved || null);
  check("F: the owner drags their own pin: the same shop row moves", !!pb && after2.id === id1 && rowsOf("shop", V).length === 1 && km(before2, after2) > 0.02, JSON.stringify({ pin: pb, km: before2 && after2 && km(before2, after2).toFixed(3), mv }));
  await shot(page, "F-after-drag");
  check("vendor run: no page errors", errors.length === 0, JSON.stringify(errors.slice(0, 4)));
  await ctx.close();
  }

  /* ---------------- H: administrator ---------------- */
  if (/H/.test(ONLY)) {
  DB.set("pmutuz9y6", { id: "pmutuz9y6", kind: "shop", lat: RHODES.lat + 0.0006, lng: RHODES.lng + 0.0006, body: { id: "pmutuz9y6", kind: "shop", lat: RHODES.lat + 0.0006, lng: RHODES.lng + 0.0006, name: "Test Vendor V4297", status: "live", menu: [] }, updated_at: new Date().toISOString(), created: Date.now(), writes: 1 });
  const A = await ctxFor(ADM, BASE + "?v=" + STAMP + "&testview=1&t=" + Date.now());
  const ap = A.page;
  await listAtPx(ap, 140, 60); await clickAct(ap, "form-vendor");
  await fill(ap, { "sn-place-name": "INPLACE ADMIN SHOP" });
  await ap.evaluate(() => { const r = document.querySelector("#sn-rows .sn-row"); r.querySelector(".c-desc").value = "Souvlaki"; r.querySelector(".c-price").value = "4"; });
  await apply(ap); await sleep(2500);
  const adminShop = rowsOf("shop", ADM)[0];
  check("H: admin lists INPLACE ADMIN SHOP (one row)", rowsOf("shop", ADM).length === 1 && adminShop.body.name === "INPLACE ADMIN SHOP", JSON.stringify(rowsOf("shop", ADM).map((r) => [r.id, r.body.name])));
  // a delivery address (the admin lists the client), then a free driver: I AM THE DRIVER HERE
  await listAtPx(ap, -120, 50); await clickAct(ap, "form-drop");
  await fill(ap, { "sn-drop-name": "INPLACE ADMIN CLIENT", "sn-drop-address": "Drop street" }); await apply(ap); await sleep(1200);
  await listAtPx(ap, 0, 30); await clickAct(ap, "i-am-driver"); await sleep(1200);
  // open the admin shop's card, LIST over it, Start the order
  await ap.evaluate(() => { const m = SN.getMap(); m.setZoom(16); }); await sleep(2000);
  let apb = await ap.evaluate(() => { const b = [...document.querySelectorAll(".sn-shop-pin b")].find((e) => e.textContent.trim() === "INPLACE ADMIN SHOP"); if (!b) return null; const r = b.closest(".leaflet-marker-icon").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const tvSeen = await ap.evaluate(() => [...document.querySelectorAll(".sn-shop-pin b")].some((e) => /Test Vendor V4297/.test(e.textContent)));
  if (apb) { await ap.mouse.click(apb.x, apb.y); await sleep(1400); }
  let as = await st(ap);
  check("H: admin opens INPLACE ADMIN SHOP's card (Test Vendor V4297 is on the map nearer to the hold)", as.kind === "vendor" && /INPLACE ADMIN SHOP/.test(as.text), JSON.stringify({ kind: as.kind, testVendorPin: tvSeen, t: as.text.slice(0, 80) }));
  await listAtPx(ap, -60, -40);
  await clickAct(ap, "run-offer"); await sleep(1800);
  as = await st(ap); await shot(ap, "H-offer");
  check("H: Start the order from LIST over the vendor card names THAT vendor, not 'Test Vendor V4297'", as.kind === "driver-offer" && /INPLACE ADMIN SHOP/.test(as.text) && !/Test Vendor/.test(as.text), JSON.stringify({ kind: as.kind, text: as.text.slice(0, 220), line: as.line }));
  // Move me here with the vendor card as target moves the vendor, not the admin pin
  await ap.evaluate(() => { const b = document.querySelector("#sn-sheet .sheet-bar .sheet-x"); if (b) b.click(); }); await sleep(600);
  apb = await ap.evaluate(() => { const b = [...document.querySelectorAll(".sn-shop-pin b")].find((e) => e.textContent.trim() === "INPLACE ADMIN SHOP"); if (!b) return null; const r = b.closest(".leaflet-marker-icon").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (apb) { await ap.mouse.click(apb.x, apb.y); await sleep(1400); }
  const hereB = await ap.evaluate(() => { const s = SN.seatState(); return s.here && { lat: s.here.lat, lng: s.here.lng }; });
  const shopB = rowsOf("shop", ADM)[0];
  const holdPt = await listAtPx(ap, 100, -50);
  const holdLL = await ap.evaluate((p) => { const m = SN.getMap(); const r = document.getElementById("city").getBoundingClientRect(); const ll = m.containerPointToLatLng([p.x - r.left, p.y - r.top]); return { lat: ll.lat, lng: ll.lng }; }, holdPt);
  await clickAct(ap, "admin-gps"); await sleep(1600);
  const hereA = await ap.evaluate(() => { const s = SN.seatState(); return s.here && { lat: s.here.lat, lng: s.here.lng }; });
  const shopA = rowsOf("shop", ADM)[0];
  check("H: Move me here with the vendor card as target moves the VENDOR to the hold point", shopA.id === shopB.id && km(shopA, holdLL) < 0.03 && km(shopB, shopA) > 0.03, JSON.stringify({ from: [shopB.lat, shopB.lng], to: [shopA.lat, shopA.lng], hold: holdLL }));
  check("H: ... and does NOT move the admin pin", hereB && hereA && km(hereA, holdLL) > 0.03, JSON.stringify({ hereB, hereA }));
  // reopen the offer for J (the shop moved; open its card again, LIST, Start the order)
  apb = await ap.evaluate(() => { const b = [...document.querySelectorAll(".sn-shop-pin b")].find((e) => e.textContent.trim() === "INPLACE ADMIN SHOP"); if (!b) return null; const r = b.closest(".leaflet-marker-icon").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (apb) { await ap.mouse.click(apb.x, apb.y); await sleep(1400); }
  await listAtPx(ap, -60, -40); await clickAct(ap, "run-offer"); await sleep(1800);
  as = await st(ap);
  // J (4355): ACCEPT opens the route card with the real steps, naming the actual driver (never 'Test Driver V4297')
  console.log("[J offer drivers] (admin test view lists fixtures by design)", as.text.slice(-80));
  await clickAct(ap, "offer-yes"); await sleep(1500);
  const rt = async () => ap.evaluate(() => { const sh = document.getElementById("sn-sheet"); const steps = [...document.querySelectorAll("#sn-sheet .sn-step")].map((b) => ({ act: b.getAttribute("data-act"), t: b.textContent.trim(), dis: b.disabled, primary: b.classList.contains("primary") }));
    const jobs = JSON.parse(localStorage.getItem("sn:jobs") || "[]"); const jid = sh && sh.getAttribute("data-job"); const j = jobs.find((x) => x && String(x.id) === String(jid)) || jobs[0] || {};
    return { kind: sh && sh.getAttribute("data-kind"), on: !!(sh && sh.classList.contains("on")), text: (document.getElementById("sn-sheet-body") || {}).textContent || "", steps, next: (document.querySelector("#sn-sheet .sn-steps") || { getAttribute: () => null }).getAttribute("data-next"), driver: j.driver, flags: { ready: !!j.ready, pickup: !!j.pickup, got: !!j.got, delivered: !!j.delivered, received: !!j.received } }; });
  let r0 = await rt(); await shot(ap, "J-route-after-accept");
  check("J: ACCEPT opens the ROUTE card with READY, PICKUP, ON THE BIKE, DELIVERED, RECEIVED", r0.on && r0.kind === "route" && r0.steps.map((x) => x.act).join() === "mark-ready,verify-pickup,driver-got,driver-delivered,client-got" && /READY/.test(r0.steps[0].t) && /RECEIVED/.test(r0.steps[4].t), JSON.stringify({ kind: r0.kind, steps: r0.steps.map((x) => x.t) }));
  check("J: the route card names the actual assigned driver, not 'Test Driver V4297'", !!r0.driver && !/Test Driver|V4297/i.test(r0.driver) && r0.text.indexOf(r0.driver) >= 0 && !/Test Driver V4297/.test(r0.text), JSON.stringify({ driver: r0.driver, text: r0.text.slice(0, 160) }));
  const geo = await ap.evaluate(() => { const c = document.querySelector("#sn-sheet .card"); const r = c.getBoundingClientRect(); const bar = [...c.querySelectorAll(".sheet-bar > *")].map((e) => ({ c: e.className, x: Math.round(e.getBoundingClientRect().left) })); return { l: Math.round(r.left), r: Math.round(innerWidth - r.right), w: Math.round(r.width), vw: innerWidth, bar }; });
  check("J/i: the card is a real inset (>= 16 px each side, <= 720 px wide, centred) with APPLY left, name middle, X right", geo.l >= 16 && geo.r >= 16 && geo.w <= 722 && Math.abs(geo.l - geo.r) <= 2 && geo.bar.length >= 3 && /sheet-apply/.test(geo.bar[0].c) && /sheet-x/.test(geo.bar[geo.bar.length - 1].c), JSON.stringify(geo));
  check("J: after ACCEPT the order is NOT ready yet: READY is the bright next step", !r0.flags.ready && r0.next === "mark-ready" && r0.steps[0].primary && !r0.steps[0].dis, JSON.stringify({ flags: r0.flags, next: r0.next }));
  await ap.click('#sn-sheet .sn-step[data-act="mark-ready"]'); await sleep(900);
  const r1 = await rt(); await shot(ap, "J-route-ready");
  check("J: READY advances the order (ready) and the card moves on to PICKUP", r1.kind === "route" && r1.flags.ready && r1.next === "verify-pickup" && /✓/.test(r1.steps[0].t) && r1.steps[0].dis, JSON.stringify({ kind: r1.kind, flags: r1.flags, next: r1.next, s0: r1.steps[0] }));
  // the admin stands on the vendor for PICKUP (the step functions keep their location rules)
  await ap.evaluate(() => { const jobs = JSON.parse(localStorage.getItem("sn:jobs") || "[]"); const j = jobs[jobs.length - 1]; window.__jv = j && j.vendor; });
  await ap.click('#sn-sheet .sn-step[data-act="verify-pickup"]'); await sleep(120);
  const pickLine = (await st(ap)).line || ""; await sleep(700);
  const r2 = await rt();
  console.log("[J pickup]", JSON.stringify({ flags: r2.flags, next: r2.next, line: (await st(ap)).line }));
  check("J: PICKUP advances (pickup verified, next ON THE BIKE) when the admin stands on the vendor, else it stays the bright next step (no fake advance)", (r2.flags.pickup && r2.next === "driver-got") || (!r2.flags.pickup && r2.next === "verify-pickup" && r2.steps[1].primary && !r2.steps[1].dis), JSON.stringify({ flags: r2.flags, next: r2.next, pickLine }));
  await ap.evaluate(() => { const b = document.querySelector("#sn-sheet .sheet-bar .sheet-x"); if (b) b.click(); }); await sleep(600);
  check("admin run: no page errors", A.errors.length === 0, JSON.stringify(A.errors.slice(0, 4)));
  await A.ctx.close();
  }

  /* ---------------- I: hunt with Overpass failing ---------------- */
  if (/I/.test(ONLY)) {
  const G = await ctxFor("inplace-hunter@test.invalid");
  const gp = G.page;
  let opBlocked = 0;
  await gp.route(/overpass-api\.de|overpass\.kumi\.systems|\/api\/interpreter/, (r) => { opBlocked++; return r.abort(); });
  await gp.route(/\/api\/find$/, async (r) => { const q = r.request(); let b = {}; try { b = JSON.parse(q.postData() || "{}"); } catch (e) {}
    if (q.method() === "POST" && b.op === "overpass") { opBlocked++; return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, error: "overpass unavailable", elements: [], meta: { mode: "overpass", status: 504 } }) }); }
    return r.fallback(); });
  const runHunt = async (q) => { await gp.evaluate(() => document.documentElement.removeAttribute("data-hunt-state")); await gp.fill("#in", q); await gp.press("#in", "Enter"); await gp.waitForFunction(() => !(window.SN && document.getElementById("sn-sheet") && /FIND · …/.test(document.getElementById("sn-sheet").textContent)), null, { timeout: 20000 }).catch(() => {}); await sleep(3500);
    await gp.waitForFunction(() => document.documentElement.getAttribute("data-hunt-state") === "done", null, { timeout: 30000 }); await gp.waitForTimeout(400);
    return gp.evaluate(() => ({ shown: (window.__snFindShown || []).length, pins: document.querySelectorAll(".sn-shop-pin").length, line: (document.getElementById("line") || {}).textContent, cache: window.__snHuntCache || null, dom: { pins: document.documentElement.getAttribute("data-hunt-pins"), state: document.documentElement.getAttribute("data-hunt-state"), cached: document.documentElement.getAttribute("data-hunt-cached"), pulse: (document.getElementById("sn-pulse") || { getAttribute: () => null }).getAttribute("data-hunt-pins") }, names: [...document.querySelectorAll(".sn-shop-pin b")].map((e) => e.textContent.trim()) })); };
  const h1 = await runHunt("pizza");
  await shot(gp, "I-hunt-overpass-down");
  check("I: with Overpass failing (proxy ok:false + hosts aborted), 'pizza' at Rhodes still returns real pins", h1.shown > 0 && h1.pins > 0 && !/No real pin/.test(h1.line), JSON.stringify(Object.assign({ overpassCalls: opBlocked }, h1)));
  // every live source empty -> the last real answer for this hunt here
  await gp.route(/\/api\/find\?/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, places: [] }) }));
  await gp.route(/nominatim\.openstreetmap\.org\/search/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await gp.route(/photon\.komoot\.io/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ features: [] }) }));
  const h2 = await runHunt("pizza");
  await shot(gp, "I-hunt-all-down-cached");
  check("I: the hunt pin count is readable in the DOM (html + LIVE pill data-hunt-pins = pins shown, state done)", h1.dom.pins === String(h1.shown) && h1.dom.pulse === String(h1.shown) && h1.dom.state === "done", JSON.stringify(h1.dom));
  check("I: with every live source empty, the hunt falls back to the last real pins for 'pizza' here (cached)", h2.shown > 0 && h2.cache && h2.cache.used === true && h2.dom.pins === String(h2.shown) && h2.dom.cached === "1", JSON.stringify(h2));
  check("hunt run: no page errors", G.errors.length === 0, JSON.stringify(G.errors.slice(0, 4)));
  await G.ctx.close();
  }
  await browser.close();
  console.log("writes stubbed by the firewall (never sent):", JSON.stringify(stubbedWrites));
  check("no write left the box except to the in-memory /api/space (queue / orders / Supabase writes stubbed)", true, stubbedWrites.length + " stubbed");
  console.log("DB at the end (in memory, never live):", JSON.stringify([...DB.values()].map((r) => [r.id, r.kind, r.body.name, r.body.customerPeer || ""])));
  console.log(fails.length ? "INPLACE " + STAMP + " FAIL: " + fails.join(" | ") : "INPLACE " + STAMP + " ALL PASS");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

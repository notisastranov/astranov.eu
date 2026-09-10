/* SpaceNet 4240 — one OS. Sphere globe. Tree lock. No overlays. */
(function () {
  "use strict";
  if (window.__SN_4240) return;
  window.__SN_4240 = true;
  var VER = "4240";
  var OWNER_MAIL = /notisastranov@gmail\.com$|@astranov\.eu$/i;
  var TREASURY = 3000000;

  var LAND = [
    [[37,-6],[37,11],[32,25],[31,34],[22,37],[12,51],[0,42],[-5,39],[-15,40],[-25,35],[-34,25],[-34,18],[-28,16],[-22,14],[-17,11],[5,9],[4,-8],[12,-16],[16,-16],[21,-17],[28,-13],[36,-6],[37,-6]],
    [[36,-9],[43,-9],[51,-10],[58,-6],[71,25],[70,30],[60,30],[54,20],[45,29],[41,29],[40,19],[38,15],[36,15],[36,-5],[36,-9]],
    [[12,44],[26,56],[36,44],[42,44],[55,60],[70,70],[72,140],[62,160],[50,140],[35,140],[22,120],[8,105],[1,104],[8,77],[25,68],[12,44]],
    [[-11,142],[-12,136],[-16,123],[-22,114],[-35,115],[-35,138],[-38,148],[-28,153],[-11,142]],
    [[72,-95],[70,-168],[60,-165],[48,-125],[32,-117],[23,-110],[15,-95],[25,-80],[45,-65],[60,-65],[72,-85],[72,-95]],
    [[12,-72],[10,-62],[5,-52],[-5,-35],[-23,-42],[-34,-53],[-52,-68],[-18,-70],[-5,-80],[8,-78],[12,-72]],
    [[83,-32],[72,-56],[60,-44],[70,-22],[83,-32]]
  ];
  var LABELS = [
    {name:"AFRICA",lat:7,lng:20},{name:"EUROPE",lat:50,lng:15},{name:"ASIA",lat:45,lng:90},
    {name:"AUSTRALIA",lat:-25,lng:134},{name:"N AMERICA",lat:45,lng:-100},{name:"S AMERICA",lat:-15,lng:-60}
  ];

  var canvas = document.getElementById("g");
  var cityEl = document.getElementById("city");
  var lineEl = document.getElementById("line");
  var form = document.getElementById("f");
  var input = document.getElementById("in");
  var plusBtn = document.getElementById("plus");
  var goBtn = document.getElementById("go");
  var gpsBtn = document.getElementById("gps");
  var jobsBtn = document.getElementById("sn-tasks-btn");
  var findBtn = document.getElementById("sn-find-btn");
  var nodeBtn = document.getElementById("sn-node-btn");
  var jobsPane = document.getElementById("sn-tasks");
  var jobsList = document.getElementById("sn-tasks-list");
  var moneyBtn = document.getElementById("sn-money");
  var powerBtn = document.getElementById("sn-power");
  var sheet = document.getElementById("sn-sheet");
  var sheetCard = document.getElementById("sn-sheet-card");
  var fileInp = document.getElementById("sn-file");

  var cam = { yaw: 0.49, pitch: 0.63, dist: 1.85 };
  var vel = { yaw: 0, pitch: 0 };
  var drag = null;
  var pointers = new Map();
  var pinch = null;
  var holdT = 0;
  var fly = null;
  var here = null;
  var hereName = "";
  var vendor = null;
  var drop = null;
  var awaitingDrop = false;
  var lastTap = 0;
  var sheetH = 0;
  var justLong = false;
  var from = null;
  var to = null;
  var level = "globe";
  var map = null;
  var marks = [];
  var jobs = [];
  var listings = [];
  var huntPins = [];
  var filterPins = [];
  var filterQ = "";
  var history = [];
  var listening = false;
  var rec = null;
  var judgeId = "";
  var liveOpen = false;
  var driverBase = null;
  var weatherRain = false;
  var powerHold = 0;
  var countEl = $("sn-count");
  var RULES = {
    spoilPayer: "driver",
    wrongPayer: "vendor",
    wrongPaysNewFee: true,
    judge: "grok",
    support: false,
    workLegal: true,
    foreignNeedsGap: true
  };
  var opts = { night: isNight(), rain: false, vip: false, floor: false, special: false, kg: 0 };


  var nodeLive = false;
  var nodePeers = [];
  var nodeHelia = "off";
  var nodeRtc = "off";
  var nodeCh = null;
  var nodePc = null;
  var nodeDc = null;
  var nodeId = "";
  var nodePackAt = {};
  var nodeCreditAt = {};
  try { nodeId = localStorage.getItem("sn:peer-id") || ""; } catch (e) {}
  if (!nodeId) {
    nodeId = "n" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
    try { localStorage.setItem("sn:peer-id", nodeId); } catch (e) {}
  }
  try { nodeLive = localStorage.getItem("sn:node") === "1"; } catch (e) {}
  var nodeOwed = 0;
  try { nodeOwed = Number(localStorage.getItem("sn:node-owed") || 0) || 0; } catch (e) {}

  function heliaNote() {
    return typeof nodeHelia === "string" ? nodeHelia : "helia-up";
  }
  function idbOpen() {
    return new Promise(function (ok, err) {
      try {
        var r = indexedDB.open("sn-node-4225", 1);
        r.onupgradeneeded = function () { r.result.createObjectStore("kv"); };
        r.onsuccess = function () { ok(r.result); };
        r.onerror = function () { err(r.error); };
      } catch (e) { err(e); }
    });
  }
  function idbSet(k, v) {
    return idbOpen().then(function (db) {
      return new Promise(function (ok, err) {
        var tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(v, k);
        tx.oncomplete = function () { ok(); };
        tx.onerror = function () { err(tx.error); };
      });
    }).catch(function () {});
  }
  function idbGet(k) {
    return idbOpen().then(function (db) {
      return new Promise(function (ok) {
        var q = db.transaction("kv").objectStore("kv").get(k);
        q.onsuccess = function () { ok(q.result); };
        q.onerror = function () { ok(null); };
      });
    }).catch(function () { return null; });
  }
  function cidOf(obj) {
    var s = JSON.stringify(obj || {});
    if (!crypto || !crypto.subtle) return Promise.resolve("cid-lite-" + s.length);
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(function (buf) {
      var hex = Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ("0" + b.toString(16)).slice(-2);
      }).join("");
      return "cid:" + hex.slice(0, 40);
    }).catch(function () { return "cid-lite-" + s.length; });
  }
  function creditRelay(n) {
    n = Number(n) || 0;
    if (n <= 0 || !signed() || !nodeLive) return;
    nodeOwed = Math.round((nodeOwed + n) * 100) / 100;
    if (nodeOwed > 40) nodeOwed = 40;
    try { localStorage.setItem("sn:node-owed", String(nodeOwed)); } catch (e) {}
    paintNode();
  }
  function settleRelay(jobCut) {
    if (!signed() || !nodeLive) return;
    var pay = Math.min(nodeOwed, Math.max(0.03, Number(jobCut) || 0.03));
    if (pay <= 0) return;
    avcSet(avcGet() + pay);
    nodeOwed = Math.max(0, Math.round((nodeOwed - pay) * 100) / 100);
    try { localStorage.setItem("sn:node-owed", String(nodeOwed)); } catch (e) {}
    say("Node share " + fmtAve(pay) + " · you served the replica.");
  }
  function mergeListings(rows) {
    if (!rows || !rows.length) return 0;
    var seen = {};
    var added = 0;
    listings.forEach(function (r) { seen[r.id || (r.name + r.lat)] = 1; });
    rows.forEach(function (r) {
      if (!r || !isFinite(Number(r.lat))) return;
      var k = r.id || (r.name + r.lat);
      if (seen[k]) return;
      seen[k] = 1;
      listings.push(r);
      added += 1;
    });
    if (added) {
      idbSet("listings", listings.slice(0, 80));
      cidOf(listings.slice(0, 20)).then(function (c) { try { localStorage.setItem("sn:cid", c); } catch (e) {} });
      paintMarks();
    }
    return added;
  }
  function compactPack() {
    return listings.slice(0, 36).map(function (r) {
      if (!r || !isFinite(Number(r.lat))) return null;
      var o = {
        id: r.id || String(r.name || "") + r.lat,
        kind: r.kind || "shop",
        name: String(r.name || "").slice(0, 48),
        lat: Number(r.lat),
        lng: Number(r.lng)
      };
      if (r.phone) o.phone = String(r.phone).slice(0, 24);
      if (r.open != null) o.open = r.open;
      if (r.partner) o.partner = 1;
      return o;
    }).filter(Boolean);
  }
  function paintNode() {
    var el = $("sn-node");
    var n = nodePeers.filter(function (p) { return Date.now() - (p.t || 0) < 90000; }).length;
    if (el) el.textContent = (nodeLive ? "NODE " : "node ") + n;
    if (nodeBtn) {
      nodeBtn.textContent = nodeLive ? ("NODE " + n) : "NODE";
      nodeBtn.style.borderColor = nodeLive ? "#19e68c" : "";
      nodeBtn.style.color = nodeLive ? "#19e68c" : "";
    }
  }
  function postPeer(extra) {
    extra = extra || {};
    var pt = here || drop || { lat: 36.437, lng: 28.227 };
    var cid = "";
    try { cid = localStorage.getItem("sn:cid") || ""; } catch (e) {}
    var row = {
      id: extra.id || ("peer-" + nodeId),
      kind: "peer",
      lat: Number(pt.lat),
      lng: Number(pt.lng),
      name: extra.name || "NODE",
      peer: nodeId,
      presence: nodeLive ? 1 : 0,
      cid: extra.cid || cid,
      fromPeer: extra.fromPeer || nodeId,
      mesh: "4240",
      note: extra.note || ("helia:" + heliaNote())
    };
    if (extra.pack) row.pack = extra.pack;
    if (extra.want) row.want = extra.want;
    if (extra.sdp) row.sdp = extra.sdp;
    if (extra.ice) row.ice = extra.ice;
    if (extra.served) row.served = extra.served;
    fetch("/api/space", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row: row })
    }).catch(function () {});
  }
  function ingestPeerRow(r) {
    if (!r) return;
    var pid = r.peer || r.fromPeer || "";
    if (pid && pid !== nodeId && String(r.id || "").indexOf("peer-") === 0) {
      var hit = nodePeers.filter(function (p) { return p.id === pid; })[0];
      if (hit) {
        hit.t = Date.now();
        if (isFinite(r.lat)) { hit.lat = r.lat; hit.lng = r.lng; }
        hit.via = hit.via || "space";
        if (r.cid) hit.cid = r.cid;
      } else {
        nodePeers.push({ id: pid, lat: r.lat, lng: r.lng, via: "space", t: Date.now(), cid: r.cid || "" });
      }
    }
    if (r.pack && r.fromPeer && r.fromPeer !== nodeId && Array.isArray(r.pack) && r.pack.length) {
      var nAdd = mergeListings(r.pack);
      if (nAdd) postPeer({ id: "served-" + nodeId, served: r.fromPeer, name: "SERVED" });
    }
    if (nodeLive && r.served === nodeId && r.fromPeer && r.fromPeer !== nodeId) {
      var now = Date.now();
      if (!nodeCreditAt[r.fromPeer] || now - nodeCreditAt[r.fromPeer] > 20000) {
        nodeCreditAt[r.fromPeer] = now;
        creditRelay(0.02);
      }
    }
    if (nodeLive && r.want && r.fromPeer && r.fromPeer !== nodeId && (r.want === nodeId || r.want === "any")) {
      var t = Date.now();
      if (!nodePackAt[r.fromPeer] || t - nodePackAt[r.fromPeer] > 15000) {
        nodePackAt[r.fromPeer] = t;
        postPeer({ id: "pack-" + nodeId, pack: compactPack(), name: "PACK" });
        creditRelay(0.01);
      }
    }
    if (r.sdp && r.fromPeer && r.fromPeer !== nodeId) rtcHandle(r);
  }
  function pullPeers(j) {
    ((j && j.peers) || []).forEach(ingestPeerRow);
    paintNode();
  }
  function announceNode() {
    if (!nodeLive) return;
    postPeer({ pack: compactPack(), name: "NODE" });
    if (nodeCh) nodeCh.postMessage({ t: "hello", id: nodeId, live: 1, pack: compactPack() });
  }
  function meshTick() {
    var q = "/api/space";
    if (here && isFinite(here.lat)) q += "?lat=" + here.lat + "&lng=" + here.lng + "&peer=" + encodeURIComponent(nodeId);
    fetch(q).then(function (r) { return r.json(); }).then(function (j) {
      pullPeers(j);
      if (j && j.ok && (!listings.length) && (j.shops || []).length) {
        listings = [].concat(j.shops || [], j.drivers || [], j.posts || []);
        idbSet("listings", listings.slice(0, 80));
        paintMarks();
      }
    }).catch(function () {
      if (nodeCh) nodeCh.postMessage({ t: "want-replica", id: nodeId });
    });
  }
  function pullReplica() {
    if (nodeCh) nodeCh.postMessage({ t: "want-replica", id: nodeId });
    postPeer({ id: "want-" + nodeId, want: "any", name: "WANT" });
    nodePeers.slice(0, 4).forEach(function (p) {
      postPeer({ id: "want-" + nodeId + "-" + String(p.id).slice(0, 10), want: p.id, name: "WANT" });
    });
    meshTick();
    say("Pulling replica from nearby phones. Origin is the front door only.");
  }
  function rtcHandle(r) {
    if (!window.RTCPeerConnection || !r.sdp) return;
    var sdp = r.sdp;
    if (typeof sdp === "string") {
      try { sdp = JSON.parse(sdp); } catch (e) { return; }
    }
    if (!sdp || !sdp.type) return;
    if (sdp.type === "offer" && nodeLive) rtcAnswer(sdp);
    if (sdp.type === "answer" && nodePc) {
      nodePc.setRemoteDescription(new RTCSessionDescription(sdp)).catch(function () { nodeRtc = "stun-fail"; });
    }
  }
  function rtcWire(pc, dc) {
    if (dc) {
      nodeDc = dc;
      dc.onmessage = function (ev) {
        try {
          var m = JSON.parse(ev.data);
          if (m && m.listings) mergeListings(m.listings);
          if (m && m.t === "want" && nodeLive) {
            dc.send(JSON.stringify({ t: "replica", listings: compactPack() }));
            creditRelay(0.03);
          }
        } catch (e) {}
      };
      dc.onopen = function () {
        nodeRtc = "up";
        try {
          if (nodeLive) dc.send(JSON.stringify({ t: "replica", listings: compactPack() }));
          else dc.send(JSON.stringify({ t: "want", id: nodeId }));
        } catch (e) {}
        paintNode();
      };
    }
    pc.ondatachannel = function (ev) { rtcWire(pc, ev.channel); };
    pc.oniceconnectionstatechange = function () {
      var s = pc.iceConnectionState;
      if (s === "failed" || s === "disconnected") nodeRtc = "stun-fail";
      if (s === "connected") nodeRtc = "up";
      paintNode();
    };
  }
  function rtcOffer() {
    if (!window.RTCPeerConnection) { nodeRtc = "no-rtc"; return; }
    if (nodeRtc === "up" || nodeRtc === "wait") return;
    try {
      nodeRtc = "wait";
      nodePc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      rtcWire(nodePc, nodePc.createDataChannel("sn-replica"));
      nodePc.onicegatheringstatechange = function () {
        if (nodePc.iceGatheringState !== "complete" || !nodePc.localDescription) return;
        var d = nodePc.localDescription;
        postPeer({ id: "sdp-" + nodeId, sdp: { type: d.type, sdp: d.sdp }, name: "SDP" });
      };
      nodePc.createOffer().then(function (off) { return nodePc.setLocalDescription(off); }).catch(function () { nodeRtc = "stun-fail"; });
    } catch (e) { nodeRtc = "stun-fail"; }
  }
  function rtcAnswer(sdp) {
    if (!window.RTCPeerConnection) return;
    try {
      if (!nodePc) {
        nodePc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        rtcWire(nodePc, null);
        nodePc.onicegatheringstatechange = function () {
          if (nodePc.iceGatheringState !== "complete" || !nodePc.localDescription) return;
          var d = nodePc.localDescription;
          postPeer({ id: "sdp-ans-" + nodeId, sdp: { type: d.type, sdp: d.sdp }, name: "SDP" });
        };
      }
      nodePc.setRemoteDescription(new RTCSessionDescription(sdp)).then(function () {
        return nodePc.createAnswer();
      }).then(function (ans) { return nodePc.setLocalDescription(ans); }).catch(function () { nodeRtc = "stun-fail"; });
    } catch (e) { nodeRtc = "stun-fail"; }
  }
  function tryHelia() {
    if (nodeHelia !== "off") return;
    nodeHelia = "wait";
    paintNode();
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      nodeHelia = "cid-idb";
      paintNode();
    }, 4500);
    import("https://cdn.jsdelivr.net/npm/helia@4.2.6/+esm").then(function (m) {
      if (done) return;
      if (!m || typeof m.createHelia !== "function") throw new Error("no helia");
      return m.createHelia();
    }).then(function (h) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      nodeHelia = h ? "helia-up" : "cid-idb";
      paintNode();
    }).catch(function () {
      if (done) return;
      done = true;
      clearTimeout(timer);
      nodeHelia = "cid-idb";
      paintNode();
    });
  }
  function bootMesh() {
    try {
      nodeCh = new BroadcastChannel("spacenet-mesh");
      nodeCh.onmessage = function (ev) {
        var m = ev.data || {};
        if (!m || m.id === nodeId) return;
        if (m.t === "hello" || m.t === "ack") {
          var hit = nodePeers.filter(function (p) { return p.id === m.id; })[0];
          if (hit) hit.t = Date.now();
          else nodePeers.push({ id: m.id, via: "tab", t: Date.now() });
          if (m.t === "hello") nodeCh.postMessage({ t: "ack", id: nodeId, pack: nodeLive ? compactPack() : undefined });
          paintNode();
        }
        if (m.t === "want-replica" && nodeLive) {
          nodeCh.postMessage({ t: "replica", id: nodeId, listings: compactPack() });
          creditRelay(0.01);
        }
        if (m.t === "replica" && m.listings) mergeListings(m.listings);
        if (m.pack) mergeListings(m.pack);
      };
      nodeCh.postMessage({ t: "hello", id: nodeId });
    } catch (e) {}
    idbGet("listings").then(function (rows) {
      if (rows && rows.length) mergeListings(rows);
    });
    if (nodeLive) { tryHelia(); announceNode(); }
    paintNode();
  }
  function toggleNode() {
    if (!signed()) { needLogin(); return; }
    nodeLive = !nodeLive;
    try { localStorage.setItem("sn:node", nodeLive ? "1" : "0"); } catch (e) {}
    if (nodeLive) {
      tryHelia();
      announceNode();
      rtcOffer();
      if (nodeCh) nodeCh.postMessage({ t: "hello", id: nodeId, live: 1, pack: compactPack() });
      say("This phone is a SpaceNet node. Nearby devices take replica from you. AV€ for serving, never for burning Vercel.");
    } else {
      say("Node closed. You still hold a local replica.");
    }
    paintNode();
    openNode();
  }
  function openNode() {
    var n = nodePeers.filter(function (p) { return Date.now() - (p.t || 0) < 90000; });
    var cid = "";
    try { cid = localStorage.getItem("sn:cid") || ""; } catch (e) {}
    sheetCard.innerHTML =
      '<div class="bar"><b class="ttl">NODE</b><button type="button" class="x" data-act="close">✕</button></div>' +
      "<p class=\"price\">owed " + fmtAve(nodeOwed) + "</p>" +
      "<p>Your device is the server. Vercel is only the front door. Replica rides on peer rows, then WebRTC if STUN works, then Helia if this phone went live. No mining. AV€ when a nearby phone takes your pack.</p>" +
      "<p>id " + esc(nodeId) + " · " + esc(heliaNote()) + " · rtc " + esc(nodeRtc) + (cid ? (" · " + esc(cid.slice(0, 18))) : "") + "</p>" +
      "<p>" + (n.length ? (n.length + " peer" + (n.length > 1 ? "s" : "") + " in range") : "No peers yet. Open NODE on another phone or tab.") + "</p>" +
      n.slice(0, 6).map(function (p) {
        return "<p>" + esc(p.via || "peer") + " · " + esc(String(p.id).slice(0, 14)) + "</p>";
      }).join("") +
      (signed()
        ? '<button type="button" class="go throw" data-act="node-toggle">' + (nodeLive ? "CLOSE NODE" : "GO LIVE AS NODE") + "</button>"
        : '<button type="button" class="act" data-act="need-login">LOGIN TO RUN A NODE</button>') +
      '<button type="button" class="act" data-act="node-pull">PULL REPLICA</button>';
    showSheet();
  }

  function $(id) { return document.getElementById(id); }
  function say(t) { if (lineEl) lineEl.textContent = String(t || ""); }
  function user() {
    try { return JSON.parse(localStorage.getItem("sn:user") || "null"); } catch (e) { return null; }
  }
  function isOwner() {
    var u = user();
    return !!(u && u.email && OWNER_MAIL.test(u.email));
  }
  function signed() { var u = user(); return !!(u && u.email); }
  function readNum(k, d) { var n = Number(localStorage.getItem(k)); return isFinite(n) ? n : d; }
  function writeNum(k, n) { try { localStorage.setItem(k, String(n)); } catch (e) {} }
  function avcGet() {
    if (isOwner()) return readNum("sn:pool", 0);
    return readNum("sn:avc", 0);
  }
  function avcSet(n) {
    n = Math.round(n * 100) / 100;
    if (isOwner()) writeNum("sn:pool", Math.max(0, n));
    else writeNum("sn:avc", Math.max(0, n));
    paintMoney();
  }
  function fmtAve(n) { return "AV€ " + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function paintMoney() {
    if (!moneyBtn) return;
    if (!signed()) { moneyBtn.classList.remove("on"); moneyBtn.style.display = "none"; return; }
    moneyBtn.classList.add("on");
    moneyBtn.style.display = "flex";
    moneyBtn.textContent = fmtAve(avcGet());
  }
  function haversine(a, b) {
    var R = 6371, p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180;
    var d1 = (b.lat - a.lat) * Math.PI / 180, d2 = (b.lng - a.lng) * Math.PI / 180;
    var x = Math.sin(d1 / 2) * Math.sin(d1 / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(d2 / 2) * Math.sin(d2 / 2);
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function isNight(d) { d = d || new Date(); var h = d.getHours(); return h >= 21 || h < 9; }
  function quoteOf(a, b, o) {
    o = o || opts;
    var d = haversine(a, b);
    var mass = Number(o.kg || 0) || 0;
    var trips = mass > 13.3 ? Math.ceil(mass / 13.3) : 1;
    var road = d * (trips === 1 ? 1 : 2 * trips - 1);
    var fee = 3;
    if (road > 3) fee += Math.ceil(road - 3);
    if (isNight()) fee += 3;
    if (weatherRain || o.rain) fee += 3;
    if (o.vip) fee += 3;
    if (o.floor) fee += 3;
    if (mass > 13) fee += 3;
    var cut = Math.round(fee * 0.03 * 100) / 100;
    return { km: road, rawKm: d, trips: trips, fee: fee, cut: cut, held: Math.round((fee - cut) * 100) / 100 };
  }
  function project(lat, lng, c, w, h) {
    var λ = (lng * Math.PI) / 180 - c.yaw, φ = (lat * Math.PI) / 180;
    var x = Math.cos(φ) * Math.sin(λ), y = Math.sin(φ), z = Math.cos(φ) * Math.cos(λ);
    var cy = y * Math.cos(c.pitch) - z * Math.sin(c.pitch);
    var cz = y * Math.sin(c.pitch) + z * Math.cos(c.pitch);
    if (cz < 0.04) return null;
    var scale = (Math.min(w, h) * 0.46) / c.dist;
    return { x: w / 2 + x * scale, y: h / 2 - cy * scale, z: cz };
  }
  function globeHit(sx, sy, c, w, h) {
    var scale = (Math.min(w, h) * 0.46) / c.dist;
    var nx = (sx - w / 2) / scale, ny = (h / 2 - sy) / scale, r2 = nx * nx + ny * ny;
    if (r2 > 1) return null;
    var nz = Math.sqrt(Math.max(0, 1 - r2));
    var cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    var y = ny * cp + nz * sp, z = -ny * sp + nz * cp, x = nx;
    var lat = (Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI;
    var lng = ((Math.atan2(x, z) + c.yaw) * 180) / Math.PI;
    while (lng > 180) lng -= 360; while (lng < -180) lng += 360;
    return { lat: lat, lng: lng };
  }
  function facing() {
    var lat = (cam.pitch * 180) / Math.PI, lng = (cam.yaw * 180) / Math.PI;
    while (lng > 180) lng -= 360; while (lng < -180) lng += 360;
    return { lat: lat, lng: lng };
  }
  function lookAt(p, dist) {
    cam.yaw = (p.lng * Math.PI) / 180;
    cam.pitch = Math.max(-1.15, Math.min(1.15, (p.lat * Math.PI) / 180));
    cam.dist = dist == null ? 1.16 : dist;
    vel.yaw = 0; vel.pitch = 0;
  }
  function flyTo(p, dist) {
    var start = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist };
    var goal = { yaw: (p.lng * Math.PI) / 180, pitch: Math.max(-1.15, Math.min(1.15, (p.lat * Math.PI) / 180)), dist: dist == null ? 1.12 : dist };
    var dy = goal.yaw - start.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    fly = { t0: performance.now(), ms: 900, start: start, goal: { yaw: start.yaw + dy, pitch: goal.pitch, dist: goal.dist } };
    vel.yaw = 0; vel.pitch = 0;
  }

  function drawGlobe() {
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (fly) {
      var t = Math.min(1, (performance.now() - fly.t0) / fly.ms);
      var e = 1 - Math.pow(1 - t, 3);
      cam.yaw = fly.start.yaw + (fly.goal.yaw - fly.start.yaw) * e;
      cam.pitch = fly.start.pitch + (fly.goal.pitch - fly.start.pitch) * e;
      cam.dist = fly.start.dist + (fly.goal.dist - fly.start.dist) * e;
      if (t >= 1) fly = null;
    } else if (!drag && (Math.abs(vel.yaw) > 0.00012 || Math.abs(vel.pitch) > 0.00012)) {
      cam.yaw += vel.yaw; cam.pitch = Math.max(-1.15, Math.min(1.15, cam.pitch + vel.pitch));
      vel.yaw *= 0.88; vel.pitch *= 0.88;
    } else if (!drag) { vel.yaw = 0; vel.pitch = 0; }
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var scale = (Math.min(w, h) * 0.46) / cam.dist;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, scale, 0, Math.PI * 2);
    ctx.fillStyle = "#041018"; ctx.fill();
    ctx.strokeStyle = "rgba(77,240,255,0.28)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = "rgba(77,240,255,0.12)"; ctx.lineWidth = 0.7;
    var lat, lng, p, first, ring, i, lab;
    for (lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath(); first = true;
      for (lng = -180; lng <= 180; lng += 6) {
        p = project(lat, lng, cam, w, h);
        if (!p) { first = true; continue; }
        if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    for (lng = -180; lng < 180; lng += 30) {
      ctx.beginPath(); first = true;
      for (lat = -80; lat <= 80; lat += 4) {
        p = project(lat, lng, cam, w, h);
        if (!p) { first = true; continue; }
        if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(126,233,255,0.55)"; ctx.lineWidth = 1.1;
    ctx.fillStyle = "rgba(77,240,255,0.10)";
    for (i = 0; i < LAND.length; i++) {
      ring = LAND[i]; ctx.beginPath(); first = true;
      for (var k = 0; k < ring.length; k++) {
        p = project(ring[k][0], ring[k][1], cam, w, h);
        if (!p) { first = true; continue; }
        if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = "rgba(126,233,255,0.72)";
    ctx.font = "600 11px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (i = 0; i < LABELS.length; i++) {
      lab = LABELS[i]; p = project(lab.lat, lab.lng, cam, w, h);
      if (!p || p.z < 0.22) continue;
      ctx.fillText(lab.name, p.x, p.y);
    }
    if (vendor && drop) {
      ctx.beginPath(); ctx.strokeStyle = "rgba(77,240,255,0.7)"; ctx.lineWidth = 1.4; first = true;
      for (i = 0; i <= 24; i++) {
        var tt = i / 24;
        var la = vendor.lat + (drop.lat - vendor.lat) * tt;
        var dl = drop.lng - vendor.lng; if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
        p = project(la, vendor.lng + dl * tt, cam, w, h);
        if (!p) { first = true; continue; }
        if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    function plot(pt, col, r) {
      if (!pt) return;
      p = project(pt.lat, pt.lng, cam, w, h); if (!p) return;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
    }
    plot(here, "#4df0ff", 6);
    plot(vendor, "#ff8ad4", 5);
    plot(drop, "#7ee9ff", 5);
    requestAnimationFrame(drawGlobe);
  }

  function pos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }
  function onDown(e) {
    if (e.button || level !== "globe") return;
    canvas.setPointerCapture(e.pointerId);
    var p = pos(e);
    pointers.set(e.pointerId, { x: p.x, y: p.y });
    vel.yaw = 0; vel.pitch = 0;
    if (pointers.size === 2) {
      var arr = Array.from(pointers.values());
      pinch = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      drag = null; if (holdT) { clearTimeout(holdT); holdT = 0; }
      return;
    }
    drag = { x: p.x, y: p.y, yaw: cam.yaw, pitch: cam.pitch, moved: false, lastX: p.x, lastY: p.y, lastT: Date.now() };
    holdT = setTimeout(function () {
      if (!drag || drag.moved) return;
      var hit = globeHit(p.x, p.y, cam, p.w, p.h);
      if (hit) onLong(hit);
      drag = null;
    }, 1000);
  }
  function onMove(e) {
    if (level !== "globe") return;
    var p = pos(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: p.x, y: p.y });
    if (pointers.size === 2 && pinch) {
      var arr = Array.from(pointers.values());
      var d = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      var ratio = pinch / d; pinch = d;
      cam.dist = Math.max(1.05, Math.min(2.4, cam.dist * ratio));
      if (cam.dist <= 1.08) openCity(facing());
      return;
    }
    if (!drag) return;
    var dx = p.x - drag.x, dy = p.y - drag.y;
    if (Math.hypot(dx, dy) > 8) { drag.moved = true; if (holdT) { clearTimeout(holdT); holdT = 0; } }
    if (!drag.moved) return;
    var now = Date.now(), dt = Math.max(8, now - drag.lastT);
    vel.yaw = (-(p.x - drag.lastX) * 0.005) * (16 / dt);
    vel.pitch = ((p.y - drag.lastY) * 0.004) * (16 / dt);
    drag.lastX = p.x; drag.lastY = p.y; drag.lastT = now;
    cam.yaw = drag.yaw - dx * 0.005;
    cam.pitch = Math.max(-1.15, Math.min(1.15, drag.pitch + dy * 0.004));
  }
  function onUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (holdT) { clearTimeout(holdT); holdT = 0; }
    var d = drag; drag = null;
    if (level !== "globe") return;
    if (!d || d.moved) return;
    vel.yaw = 0; vel.pitch = 0;
    var p = pos(e);
    var hit = globeHit(p.x, p.y, cam, p.w, p.h);
    if (!hit) return;
    var now = Date.now();
    if (now - lastTap < 320) {
      lastTap = 0;
      cam.dist = Math.min(2.4, cam.dist + 0.35);
      return;
    }
    lastTap = now;
    setTimeout(function () {
      if (Date.now() - lastTap < 300) return;
      if (lastTap === 0) return;
      flyTo(hit, 1.12);
      setTimeout(function () { openCity(hit); }, 920);
    }, 300);
  }
  function onWheel(e) {
    e.preventDefault();
    cam.dist = Math.max(1.05, Math.min(2.4, cam.dist + e.deltaY * 0.002));
    if (cam.dist <= 1.08) openCity(facing());
  }

  function openCity(p) {
    if (!window.L || !cityEl) { say("City map not ready."); return; }
    level = "city";
    cityEl.classList.add("on");
    if (!map) {
      map = L.map(cityEl, { zoomControl: false, attributionControl: false, doubleClickZoom: false });
      var tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "OpenStreetMap"
      });
      tiles.on("tileerror", function () {
        if (map.__fb) return;
        map.__fb = true;
        L.tileLayer("https://tile.openstreetmap.de/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      });
      tiles.addTo(map);
      bindCityGestures();
    }
    map.setView([p.lat, p.lng], 16);
    setTimeout(function () { map.invalidateSize(); }, 60);
    paintMarks();
  }
  function closeCity() {
    level = "globe";
    cityEl.classList.remove("on");
    cam.dist = 1.2;
  }
  function bindCityGestures() {
    var hold = 0, start = null;
    var el = map.getContainer();
    el.addEventListener("pointerdown", function (e) {
      if (e.button) return;
      start = { x: e.clientX, y: e.clientY, t: Date.now() };
      var ll = map.mouseEventToLatLng(e);
      hold = setTimeout(function () {
        hold = 0;
        onLong({ lat: ll.lat, lng: ll.lng });
      }, 1000);
    });
    el.addEventListener("pointermove", function (e) {
      if (!start) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) {
        if (hold) { clearTimeout(hold); hold = 0; }
        start = null;
      }
    });
    el.addEventListener("pointerup", function () {
      if (hold) { clearTimeout(hold); hold = 0; }
      start = null;
    });
    map.on("click", function (ev) {
      if (justLong) { justLong = false; return; }
      var now = Date.now();
      if (now - lastTap < 320) {
        lastTap = 0;
        map.setZoom(Math.max(5, map.getZoom() - 2));
        if (map.getZoom() <= 4) closeCity();
        return;
      }
      lastTap = now;
      var latlng = ev.latlng;
      setTimeout(function () {
        if (lastTap === 0) return;
        if (Date.now() - lastTap < 280) return;
        map.setView(latlng, Math.min(19, map.getZoom() + 2));
      }, 300);
    });
    map.on("zoomend", function () {
      if (map.getZoom() <= 4) closeCity();
      else paintMarks();
    });
  }
  function onLong(pt) {
    justLong = true;
    setTimeout(function () { justLong = false; }, 400);
    if (awaitingDrop) {
      if (!signed()) { needLogin(); return; }
      if (!vendor) { say("Pick a vendor first."); return; }
      setDrop(pt);
      return;
    }
    if (!vendor) {
      say("Pick a vendor on the map first.");
      if (level !== "city") { flyTo(pt, 1.12); setTimeout(function () { openCity(pt); }, 920); }
      return;
    }
    if (!signed()) { needLogin(); return; }
    setDrop(pt);
  }
  function pinColor(pt) {
    if (pt === here) return "#4df0ff";
    if (pt && pt.kind === "driver") return "#4df0ff";
    if (vendor && pt && pt.lat === vendor.lat && pt.lng === vendor.lng) return "#ff8ad4";
    if (drop && pt && pt.lat === drop.lat && pt.lng === drop.lng) return "#7ee9ff";
    return "#ffd85a";
  }
  function paintMarks() {
    if (!map) return;
    marks.forEach(function (m) { try { map.removeLayer(m); } catch (e) {} });
    marks = [];
    var z = map.getZoom();
    function addDot(pt, col, label, click) {
      if (!pt || !isFinite(pt.lat)) return;
      var m = L.circleMarker([pt.lat, pt.lng], { radius: 8, color: col, fillColor: col, fillOpacity: 0.92, weight: 2 });
      if (label) m.bindTooltip(String(label), { permanent: false });
      if (click) m.on("click", function (ev) { if (ev && ev.originalEvent) L.DomEvent.stop(ev); lastTap = 0; click(pt); });
      m.addTo(map); marks.push(m);
    }
    function addPill(pt, click) {
      if (!pt || !isFinite(pt.lat)) return;
      var name = String(pt.name || "SHOP");
      var photo = pt.photo || pt.img || "";
      var av = name.replace(/[^A-Za-zΑ-Ωα-ω0-9]/g, "").charAt(0) || "S";
      var html = '<button type="button" class="sn-pill-btn">' +
        (photo ? '<img src="' + String(photo).replace(/"/g, "") + '" alt="">' : '<span class="av">' + av + "</span>") +
        "<b>" + name.slice(0, 16) + "</b></button>";
      var ic = L.divIcon({ className: "sn-pill", html: html, iconSize: [132, 28], iconAnchor: [66, 14] });
      var m = L.marker([pt.lat, pt.lng], { icon: ic, keyboard: false });
      m.on("click", function (ev) { if (ev && ev.originalEvent) L.DomEvent.stop(ev); lastTap = 0; click(pt); });
      m.addTo(map); marks.push(m);
    }
    addDot(here, "#4df0ff", hereName || "YOU", null);
    addDot(drop, "#7ee9ff", (drop && drop.name) || "DROP", null);
    if (driverBase) addDot(driverBase, "#19e68c", "BASE", null);
    if (z >= 13) {
      nodePeers.filter(function (p) { return Date.now() - (p.t || 0) < 90000 && isFinite(p.lat); }).slice(0, 6).forEach(function (p) {
        addDot(p, "#19e68c", "NODE", function () { openNode(); });
      });
    }
    function shopMark(pt) {
      if (z >= 14) addPill(pt, function () { openVendor(pt); });
      else addDot(pt, "#ff8ad4", pt.name || "SHOP", function () { openVendor(pt); });
    }
    if (vendor) shopMark(vendor);
    huntPins.forEach(shopMark);
    if (!huntPins.length) {
      visibleShops().forEach(function (pt) {
        if (pt.kind === "driver") addDot(pt, "#4df0ff", pt.name || "DRIVER", null);
        else shopMark(pt);
      });
    } else {
      liveDrivers().slice(0, 3).forEach(function (pt) {
        if (isFinite(pt.lat)) addDot(pt, "#4df0ff", pt.name || "DRIVER", null);
      });
    }
  }
  var PARTNER_RE = /pizzarium|augoustinos|avgoustinos|tsambikos|calisto/i;
  function mapOrigin() {
    if (here) return here;
    try {
      if (map) { var c = map.getCenter(); return { lat: c.lat, lng: c.lng }; }
    } catch (e) {}
    return { lat: 36.437, lng: 28.227 };
  }
  function isPartner(pt) {
    if (!pt) return false;
    if (pt.partner) return true;
    return PARTNER_RE.test(String(pt.name || "") + " " + String(pt.raw || "") + " " + String(pt.place || ""));
  }
  function isClient(pt) {
    if (!pt || isPartner(pt)) return false;
    if (phoneDigits(pt.phone).length >= 8) return true;
    if (pt.menu) return true;
    if (pt.peer && pt.peer !== "spacenet") return true;
    return false;
  }
  function rankShop(pt, origin) {
    if (!pt || pt.kind === "driver" || pt.kind === "gap" || pt.kind === "job") return -1;
    if (!isFinite(pt.lat)) return -1;
    var d = haversine(origin, pt);
    if (d > 35) return -1;
    var s = 0;
    if (isPartner(pt)) s += 100;
    else if (isClient(pt)) s += 55;
    else s += 8;
    s += Math.max(0, 25 - d);
    return s;
  }
  function visibleShops() {
    if (filterPins.length) return filterPins.slice(0, 8);
    var o = mapOrigin();
    var seen = {};
    var arr = [];
    listings.forEach(function (row) {
      var pt = normListing(row);
      if (pt.kind === "driver") return;
      var key = String(pt.name || "").toLowerCase().slice(0, 18) + "|" + (isFinite(pt.lat) ? pt.lat.toFixed(3) : "") + "|" + (isFinite(pt.lng) ? pt.lng.toFixed(3) : "");
      if (seen[key]) return;
      seen[key] = 1;
      pt._s = rankShop(pt, o);
      if (pt._s < 0) return;
      arr.push(pt);
    });
    arr.sort(function (a, b) { return b._s - a._s; });
    var partners = arr.filter(isPartner).slice(0, 5);
    var clients = arr.filter(function (p) { return !isPartner(p); }).slice(0, 3);
    return partners.concat(clients).slice(0, 8);
  }
  function openFind() {
    var chips = ["PARTNERS", "PIZZA", "FOOD", "COFFEE", "PHARMACY", "ATM", "HOTEL", "MARKET", "NIGHT"];
    var rows = (filterPins.length ? filterPins : visibleShops());
    sheetCard.innerHTML =
      '<div class="bar"><b class="ttl">FIND</b><button type="button" class="x" data-act="close">✕</button></div>' +
      "<p>Talk or voice below. Or tap a filter. Map stays sparse.</p>" +
      chips.map(function (c) {
        return '<button type="button" class="chip" data-act="filter" data-q="' + c + '">' + c + "</button>";
      }).join("") +
      rows.map(function (p) {
        return '<p><button type="button" class="act" data-act="pin" data-id="' + esc(p.id || p.name) + '">' +
          (isPartner(p) ? "★ " : "") + esc(p.name) + (p.raw ? (" · " + esc(String(p.raw).slice(0, 42))) : "") +
          "</button></p>";
      }).join("") +
      (rows.length ? "" : "<p>Nothing nearby yet. Name it in the talk field.</p>");
    showSheet();
  }
  function runFilter(q) {
    filterQ = String(q || "").toLowerCase();
    huntPins = [];
    if (filterQ === "partners") {
      filterPins = visibleShops().filter(isPartner);
      if (!filterPins.length) {
        listings.forEach(function (row) {
          var pt = normListing(row);
          if (isPartner(pt)) filterPins.push(pt);
        });
      }
      paintMarks();
      openFind();
      say("Partners on the map.");
      return;
    }
    var o = mapOrigin();
    var local = [];
    listings.forEach(function (row) {
      var pt = normListing(row);
      var blob = (pt.name + " " + (pt.raw || "") + " " + (pt.menu || "")).toLowerCase();
      if (blob.indexOf(filterQ === "food" ? "pizza" : filterQ) >= 0 || (filterQ === "food" && /grill|cuisine|tavern|mezed|restaurant|food/i.test(blob))) {
        if (rankShop(pt, o) >= 0) local.push(pt);
      }
    });
    filterPins = local.slice(0, 8);
    paintMarks();
    if (filterPins.length) {
      openFind();
      say(filterPins.length + " nearby. Talk if you need more.");
      return;
    }
    talk(q, "Find real places named or typed " + q + " near the user. Return places[]. Do not invent.");
  }
  function pinFromFind(id) {
    var all = (filterPins.length ? filterPins : visibleShops()).concat(huntPins);
    var pt = all.filter(function (p) { return (p.id || p.name) === id; })[0];
    if (!pt) return;
    closeSheet();
    if (map) map.setView([pt.lat, pt.lng], 16);
    openVendor(pt);
  }
  function normListing(row) {
    var p = row.payload || row;
    return {
      id: row.id,
      kind: row.kind || p.kind || "shop",
      name: p.name || row.name || "Place",
      lat: Number(p.lat != null ? p.lat : row.lat),
      lng: Number(p.lng != null ? p.lng : row.lng),
      raw: p.raw || p.addr || p.address || "",
      phone: p.phone || p.tel || "",
      menu: p.menu || row.menu || null,
      photo: p.photo || p.img || p.image || "",
      peer: p.peer || row.peer || "",
      partner: !!(p.partner || row.partner),
      bundlePct: Number(p.bundlePct || p.pct || 0) || 0,
      radiusKm: Number(p.radiusKm || p.radius || 0) || 0,
      email: p.email || row.email || "",
      status: row.status || p.status || ""
    };
  }
  function esc(s) {
    var t = String(s || "");
    t = t.split("&").join("&" + "amp;");
    t = t.split("<").join("&" + "lt;");
    t = t.split(">").join("&" + "gt;");
    t = t.split('"').join("&" + "quot;");
    return t;
  }
  function phoneDigits(p) { return String(p || "").replace(/\D/g, ""); }
  function menuHtml(v) {
    if (!v) return "";
    var m = v.menu;
    if (Array.isArray(m) && m.length) {
      return '<div class="menu">' + m.slice(0, 12).map(function (it) {
        if (typeof it === "string") return "<div>" + esc(it) + "</div>";
        return "<div>" + esc(it.name || it.title || "Item") + (it.price != null ? (" · AV€ " + it.price) : "") + "</div>";
      }).join("") + "</div>";
    }
    if (typeof m === "string" && m.trim()) return '<div class="menu">' + esc(m).slice(0, 600) + "</div>";
    var tel = phoneDigits(v.phone);
    if (tel.length >= 10) return '<p>No menu posted. Call <a class="tel" href="tel:' + tel + '">' + esc(v.phone) + "</a></p>";
    return "<p>No menu or phone posted.</p>";
  }
  function amDriver() {
    try {
      var list = JSON.parse(localStorage.getItem("sn:roles") || "[]") || [];
      return list.some(function (r) { return r.role === "driver"; });
    } catch (e) { return false; }
  }
  function amVendor() {
    try {
      var list = JSON.parse(localStorage.getItem("sn:roles") || "[]") || [];
      return list.some(function (r) { return r.role === "vendor"; });
    } catch (e) { return false; }
  }
  function paintPower() {
    if (!powerBtn) return;
    var show = signed() && (amDriver() || amVendor() || isOwner());
    powerBtn.classList.toggle("show", show);
    powerBtn.hidden = !show;
    powerBtn.classList.toggle("live", !!liveOpen);
    layoutHud();
  }
  var spark = [];
  var wxNow = { emoji: "🌤", night: isNight(), text: "", wind: 0, temp: null, rain: 0 };
  var gpuName = "";
  (function probeGpu() {
    try {
      var c = document.createElement("canvas");
      var gl = c.getContext("webgl") || c.getContext("experimental-webgl");
      if (!gl) return;
      var ext = gl.getExtension("WEBGL_debug_renderer_info");
      gpuName = ext ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "") : (gl.getParameter(gl.RENDERER) || "");
    } catch (e) {}
  })();
  function layoutHud() {
    var isl = $("island");
    if (!isl) return;
    var y = Math.ceil(isl.getBoundingClientRect().bottom + 8);
    document.documentElement.style.setProperty("--hud-side", y + "px");
  }
  function clockLine(d, utc) {
    var opt = { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false };
    if (utc) opt.timeZone = "UTC";
    try { return d.toLocaleString("en-GB", opt) + (utc ? " UTC" : ""); } catch (e) { return d.toISOString(); }
  }
  function paintIsland() {
    var d = new Date();
    var loc = $("sn-local");
    var utc = $("sn-utc");
    if (loc) loc.textContent = clockLine(d, false);
    if (utc) utc.textContent = clockLine(d, true);
    var wxEl = $("sn-wx");
    if (wxEl) wxEl.textContent = wxNow.emoji || (isNight(d) ? "🌙" : "☀️");
    paintNode();
    layoutHud();
    drawSpark();
  }
  function judgeWx(j) {
    var cur = (j && j.current) || {};
    var temp = cur.temperature_2m;
    var wind = cur.wind_speed_10m;
    var rain = cur.precipitation;
    var night = cur.is_day === 0 || (cur.is_day == null && isNight());
    weatherRain = Number(rain) > 0.2;
    var marks = [];
    if (night) marks.push("🌙"); else marks.push("☀️");
    if (Number(wind) >= 40) marks.push("💨");
    else if (Number(wind) >= 25) marks.push("🌬");
    if (Number(temp) >= 35) marks.push("🥵");
    else if (Number(temp) <= 5 && temp != null) marks.push("🥶");
    if (Number(rain) >= 2) marks.push("🌧");
    else if (Number(rain) > 0.2) marks.push("🌦");
    wxNow = {
      emoji: marks.join("") || "🌤",
      night: night,
      temp: temp,
      wind: wind,
      rain: rain,
      text: [temp != null ? (Math.round(temp) + "°") : "", wind ? (Math.round(wind) + "km/h") : ""].filter(Boolean).join(" ")
    };
    paintIsland();
  }
  function pullWx() {
    var pt = here || drop || { lat: 36.437, lng: 28.227 };
    fetch("https://api.open-meteo.com/v1/forecast?latitude=" + pt.lat + "&longitude=" + pt.lng + "&current=temperature_2m,precipitation,wind_speed_10m,is_day")
      .then(function (r) { return r.json(); })
      .then(judgeWx)
      .catch(function () { wxNow.emoji = isNight() ? "🌙" : "☀️"; paintIsland(); });
  }
  function sampleLoad() {
    var t0 = performance.now();
    requestAnimationFrame(function () {
      var dt = performance.now() - t0;
      var load = Math.max(0, Math.min(100, (dt / 16.7) * 50));
      spark.push(load);
      if (spark.length > 32) spark.shift();
    });
  }
  function drawSpark() {
    var c = $("sn-spark");
    if (!c || !c.getContext) return;
    var ctx = c.getContext("2d");
    var w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(77,240,255,.85)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (!spark.length) { ctx.moveTo(0, h - 4); ctx.lineTo(w, h - 4); ctx.stroke(); return; }
    spark.forEach(function (v, i) {
      var x = (i / Math.max(1, spark.length - 1)) * (w - 2) + 1;
      var y = h - 2 - (v / 100) * (h - 4);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  function sysInfo(cb) {
    var info = {
      cores: navigator.hardwareConcurrency || "—",
      ram: navigator.deviceMemory ? navigator.deviceMemory + " GB" : "—",
      heap: "",
      net: "",
      gpu: gpuName || "—",
      store: "",
      batt: ""
    };
    try {
      var m = performance.memory;
      if (m) info.heap = (m.usedJSHeapSize / 1048576).toFixed(0) + " / " + (m.totalJSHeapSize / 1048576).toFixed(0) + " MB";
    } catch (e) {}
    try {
      var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (c) info.net = [c.effectiveType, c.downlink ? c.downlink + "Mb/s" : "", c.rtt != null ? c.rtt + "ms" : ""].filter(Boolean).join(" · ");
    } catch (e) {}
    var pending = 0;
    function done() { pending -= 1; if (pending <= 0 && cb) cb(info); }
    pending += 1;
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(function (s) {
        info.store = s && s.quota ? ((s.usage || 0) / 1048576).toFixed(0) + " / " + (s.quota / 1073741824).toFixed(1) + " GB" : "—";
        done();
      }).catch(function () { info.store = "—"; done(); });
    } else { info.store = "—"; done(); }
    pending += 1;
    if (navigator.getBattery) {
      navigator.getBattery().then(function (b) {
        info.batt = Math.round(b.level * 100) + "%" + (b.charging ? " charging" : "");
        done();
      }).catch(function () { info.batt = "—"; done(); });
    } else { info.batt = "—"; done(); }
  }
  function openSys() {
    sysInfo(function (info) {
      var load = spark.length ? Math.round(spark[spark.length - 1]) : 0;
      sheetCard.innerHTML =
        '<div class="bar"><b class="ttl">SYSTEM</b><button type="button" class="x" data-act="close">✕</button></div>' +
        "<p>" + clockLine(new Date(), false) + "</p>" +
        "<p>" + clockLine(new Date(), true) + "</p>" +
        "<p>" + esc(wxNow.emoji) + " " + esc(wxNow.text || (wxNow.night ? "night" : "day")) + "</p>" +
        "<p>Load " + load + " · CPU " + info.cores + " cores</p>" +
        "<p>RAM " + esc(info.ram) + (info.heap ? (" · heap " + info.heap) : "") + "</p>" +
        "<p>Storage " + esc(info.store) + "</p>" +
        "<p>Battery " + esc(info.batt) + "</p>" +
        "<p>GPU " + esc(info.gpu) + "</p>" +
        "<p>Network " + esc(info.net || "—") + "</p>" +
        '<button type="button" class="act" data-act="reboot">REBOOT SHELL</button>';
      showSheet();
    });
  }
  function toggleLive() {
    if (!signed() || !(amDriver() || amVendor() || isOwner())) return;
    if (amDriver() && !driverBase && !here) {
      say("Set your base first. GPS or a long tap.");
      gps();
      return;
    }
    if (amDriver() && here && !driverBase) driverBase = here;
    liveOpen = !liveOpen;
    try { localStorage.setItem("sn:live", liveOpen ? "1" : "0"); } catch (e) {}
    paintPower();
    if (liveOpen) say(amVendor() && !amDriver() ? "Open to receive orders." : "Open to receive jobs.");
    else say("Closed. Not receiving.");
  }
  function liveDrivers() {
    var d = [];
    listings.forEach(function (row) {
      var p = normListing(row);
      if (p.kind === "driver") d.push(p);
    });
    if (amDriver() && signed()) {
      var mail = user().email;
      if (!d.some(function (x) { return (x.email || "").toLowerCase() === mail.toLowerCase(); })) {
        d.unshift({ name: "YOU", kind: "driver", email: mail, lat: here && here.lat, lng: here && here.lng, you: true });
      }
    }
    return d;
  }
  function bundled(v, dest) {
    if (!v || !dest) return false;
    if (!(Number(v.bundlePct) > 0) || !(Number(v.radiusKm) > 0)) return false;
    return haversine(v, dest) <= Number(v.radiusKm);
  }
  function openVendor(v) {
    vendor = {
      name: v.name || "Vendor",
      lat: v.lat, lng: v.lng,
      raw: v.raw || "",
      phone: v.phone || "",
      menu: v.menu,
      photo: v.photo || "",
      bundlePct: v.bundlePct || 0,
      radiusKm: v.radiusKm || 0,
      email: v.email || "",
      kind: v.kind || "shop"
    };
    from = vendor;
    awaitingDrop = false;
    paintMarks();
    var canSend = signed() && (drop || here);
    var locLine = signed()
      ? ((drop || here) ? "<p>Drop: " + esc((drop && drop.name) || hereName || "GPS") + "</p>" : "<p>Set your drop: GPS or 1s pin.</p>")
      : "<p>Sign in, then set your drop.</p>";
    sheetCard.innerHTML =
      '<div class="bar"><b class="ttl">' + esc(vendor.name) + '</b><button type="button" class="x" data-act="close">✕</button></div>' +
      (vendor.photo ? '<p><img src="' + esc(vendor.photo) + '" alt="" style="width:48px;height:48px;border-radius:12px"></p>' : "") +
      (vendor.raw ? "<p>" + esc(vendor.raw) + "</p>" : "") +
      menuHtml(vendor) +
      (vendor.bundlePct ? ("<p>Prices include delivery +" + vendor.bundlePct + "% inside " + vendor.radiusKm + " km.</p>") : "") +
      locLine +
      (signed()
        ? ('<button type="button" class="act" data-act="drop-gps">TO MY GPS</button>' +
           '<button type="button" class="act" data-act="drop-pin">PIN ON MAP</button>' +
           (canSend ? '<button type="button" class="go throw" data-act="to-offer">CONTINUE</button>' : ""))
        : '<button type="button" class="act" data-act="need-login">LOGIN TO ORDER</button>');
    showSheet();
    say(vendor.name + ". Menu. Login and drop before a job.");
  }
  function dropGps() {
    if (!signed()) { needLogin(); return; }
    function go(pt, name) {
      here = pt; hereName = name || hereName || "YOU";
      setDrop({ lat: pt.lat, lng: pt.lng, name: hereName });
    }
    if (here) { go(here, hereName); return; }
    say("Allow GPS for the drop.");
    if (!navigator.geolocation) { say("No GPS. Long tap the drop on the map."); awaitingDrop = true; closeSheet(); return; }
    navigator.geolocation.getCurrentPosition(
      function (pos) { go({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      function () { say("GPS denied. Long tap the drop on the map."); awaitingDrop = true; closeSheet(); },
      { enableHighAccuracy: true, timeout: 9000 }
    );
  }
  function needLogin() {
    say("Sign in first.");
    closeSheet();
    if (window.SNAuth && SNAuth.open) SNAuth.open();
  }
  function askWeather(pt, cb) {
    if (!pt) { weatherRain = false; if (cb) cb(); return; }
    fetch("https://api.open-meteo.com/v1/forecast?latitude=" + pt.lat + "&longitude=" + pt.lng + "&current=precipitation")
      .then(function (r) { return r.json(); })
      .then(function (j) {
        weatherRain = !!(j && j.current && Number(j.current.precipitation) > 0.2);
        if (cb) cb();
      }).catch(function () { weatherRain = false; if (cb) cb(); });
  }
  function setDrop(pt) {
    if (!signed()) { needLogin(); return; }
    drop = { lat: pt.lat, lng: pt.lng, name: pt.name || "" };
    to = drop;
    awaitingDrop = false;
    paintMarks();
    reverseDrop(drop);
    askWeather(drop, function () { openOffer(); });
  }
  function reverseDrop(pt) {
    fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" + pt.lat + "&lon=" + pt.lng, { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var n = (j && (j.display_name || j.name)) || "";
        if (!n) return;
        drop.name = (j.address && (j.address.road || j.address.suburb || j.address.city)) ? [j.address.road, j.address.suburb, j.address.city].filter(Boolean).join(", ") : n.split(",").slice(0, 3).join(",");
        paintMarks();
        if (sheet.classList.contains("on")) openOffer();
      }).catch(function () {});
  }
  function openOffer() {
    if (!signed()) { needLogin(); return; }
    if (!vendor || !drop) { say("Vendor and drop first."); return; }
    opts.night = isNight();
    opts.rain = weatherRain;
    var q = quoteOf(vendor, drop, opts);
    var inside = bundled(vendor, drop);
    var dest = drop.name || (drop.lat.toFixed(4) + ", " + drop.lng.toFixed(4));
    var judged = [];
    if (opts.night) judged.push("Night +3");
    if (opts.rain) judged.push("Rain +3");
    if (Number(opts.kg || 0) > 13) judged.push("Heavy +3");
    var tip = Number(($("sn-tip") && $("sn-tip").value) || opts.tip || 0) || 0;
    opts.tip = tip;
    var total = (inside ? 0 : q.fee) + (opts.vip ? 0 : 0);
    total = inside ? 0 : q.fee;
    sheetCard.innerHTML =
      '<div class="bar"><b class="ttl">SEND</b><button type="button" class="x" data-act="close">✕</button></div>' +
      '<p class="price">' + (inside ? "In price" : fmtAve(q.fee + tip)) + "</p>" +
      "<p>" + esc(vendor.name) + " → " + esc(dest) + " · " + q.rawKm.toFixed(1) + " km</p>" +
      (judged.length ? ("<p>Applies: " + judged.join(" · ") + "</p>") : "<p>No night / rain / heavy on this drop.</p>") +
      '<label><input type="checkbox" data-opt="vip"' + (opts.vip ? " checked" : "") + "> Fast VIP + AV€ 3.00</label>" +
      '<label><input type="checkbox" data-opt="floor"' + (opts.floor ? " checked" : "") + "> Room / floor + AV€ 3.00</label>" +
      '<label>Tip <input id="sn-tip" type="number" min="0" step="0.5" value="' + tip + '"></label>' +
      "<p>No job until vendor, driver and you confirm.</p>" +
      '<button type="button" class="go throw" data-act="throw">SEND TO THE THREE</button>' +
      '<button type="button" class="go" data-act="clear">CLEAR</button>';
    showSheet();
    showRoute({ vendor: vendor, drop: drop, driverPt: (liveDrivers()[0] && isFinite(liveDrivers()[0].lat)) ? liveDrivers()[0] : driverBase || here });
    say("Price on top. Tip if you want. Three confirms.");
  }
  function showRoute(job) {
    if (!map || !job) return;
    var pts = [];
    if (job.vendor && isFinite(job.vendor.lat)) pts.push([job.vendor.lat, job.vendor.lng]);
    if (job.drop && isFinite(job.drop.lat)) pts.push([job.drop.lat, job.drop.lng]);
    var dr = job.driverPt;
    if (dr && isFinite(dr.lat)) pts.push([dr.lat, dr.lng]);
    if (pts.length < 2) return;
    try { map.fitBounds(pts, { padding: [56, 56], maxZoom: 16 }); } catch (e) {}
  }
  function setCardH(card, h) {
    if (!card) return;
    var vh = window.innerHeight;
    var v = Math.max(vh * 0.16, Math.min(vh * 0.88, h));
    card.style.height = v + "px";
    card.style.maxHeight = v + "px";
  }
  function resetCardH(card) {
    if (!card) return;
    var h = window.innerHeight * 0.33;
    card.style.height = h + "px";
    card.style.maxHeight = h + "px";
    card.scrollTop = 0;
  }
  function attachSheetPhysics(card, closer) {
    if (!card || card.__phys) return;
    card.__phys = true;
    var startY = 0, startH = 0, tracking = false;
    card.addEventListener("pointerdown", function (e) {
      if (e.target.closest && e.target.closest("[data-act]")) return;
      startY = e.clientY;
      startH = card.getBoundingClientRect().height;
      tracking = false;
      var onBar = !!(e.target.closest && e.target.closest(".bar"));
      if (onBar) {
        tracking = true;
        try { card.setPointerCapture(e.pointerId); } catch (err) {}
      }
    });
    card.addEventListener("pointermove", function (e) {
      if (!startY) return;
      var dy = e.clientY - startY;
      var onBar = !!(e.target.closest && e.target.closest(".bar"));
      var atTop = card.scrollTop <= 0;
      var atBot = card.scrollTop + card.clientHeight >= card.scrollHeight - 2;
      var canScroll = card.scrollHeight > card.clientHeight + 8;
      if (!tracking) {
        if (Math.abs(dy) < 10) return;
        if (canScroll) {
          if (dy < 0 && !atBot) { startY = 0; return; }
          if (dy > 0 && !atTop) { startY = 0; return; }
        }
        tracking = true;
        try { card.setPointerCapture(e.pointerId); } catch (err) {}
      }
      if (!tracking) return;
      e.preventDefault();
      setCardH(card, startH - dy);
    }, { passive: false });
    function end() {
      if (!startY && !tracking) return;
      var h = card.getBoundingClientRect().height;
      var vh = window.innerHeight;
      startY = 0;
      if (!tracking) return;
      tracking = false;
      if (h < vh * 0.18) { closer(); return; }
      if (h > vh * 0.55) setCardH(card, vh * 0.88);
      else setCardH(card, vh * 0.33);
    }
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", end);
  }
  function showSheet() {
    sheet.classList.add("on");
    resetCardH(sheetCard);
    attachSheetPhysics(sheetCard, closeSheet);
  }
  function closeSheet() {
    sheet.classList.remove("on");
    if (sheetCard) { sheetCard.style.height = ""; sheetCard.style.maxHeight = ""; }
  }

  function openPower() {
    sheetCard.innerHTML =
      '<div class="bar"><b class="ttl">OFFERINGS</b><button type="button" class="x" data-act="close">✕</button></div>' +
      (signed() ? "<p>" + fmtAve(avcGet()) + "</p>" : "<p>Sign in to hold AV€.</p>") +
      '<button type="button" class="act" data-act="reload">RELOAD EUR → AV€</button>' +
      '<button type="button" class="act" data-act="withdraw">WITHDRAW 3%</button>' +
      '<button type="button" class="act" data-act="hour">OTHER JOB 33 AV€/h</button>' +
      '<button type="button" class="act" data-act="role">APPLY ROLE</button>' +
      '<button type="button" class="act" data-act="terms">TERMS</button>';
    showSheet();
  }
  function openHour() {
    sheetCard.innerHTML =
      '<div class="bar"><b class="ttl">OTHER JOB</b><button type="button" class="x" data-act="close">✕</button></div>' +
      "<p>33 AV€ per hour. Not delivery.</p>" +
      '<label>Hours <input id="sn-hours" type="number" min="1" value="1"></label>' +
      '<label>What <input id="sn-hour-q" type="text" placeholder="Describe the work"></label>' +
      '<button type="button" class="go throw" data-act="throw-hour">POST</button>';
    showSheet();
  }
  function openRole() {
    var gapN = gaps().length;
    sheetCard.innerHTML =
      '<div class="bar"><b class="ttl">ROLES</b><button type="button" class="x" data-act="close">✕</button></div>' +
      "<p>Legal work at this GPS. Notis activates. AI judges jobs. No support desk.</p>" +
      '<label><input id="sn-legal" type="checkbox"> I can legally work here</label>' +
      '<label><input id="sn-foreign" type="checkbox"> I live abroad</label>' +
      "<p>Abroad only if locals posted a labor-gap demand (" + gapN + " open). Not to undercut people already here.</p>" +
      '<button type="button" class="act" data-act="apply" data-role="vendor">VENDOR</button>' +
      '<button type="button" class="act" data-act="apply" data-role="driver">DRIVER</button>' +
      '<button type="button" class="act" data-act="apply" data-role="agent">AGENT</button>' +
      '<button type="button" class="act" data-act="apply" data-role="ambassador">AMBASSADOR</button>' +
      '<button type="button" class="act" data-act="gap">POST LABOR GAP</button>' +
      '<button type="button" class="act" data-act="terms">READ TERMS</button>';
    showSheet();
  }
  function gaps() {
    return listings.filter(function (x) { return x && (x.kind === "gap" || (x.payload && x.payload.kind === "gap")); });
  }
  function openGap() {
    if (!signed()) { say("Sign in first."); if (window.SNAuth && SNAuth.open) SNAuth.open(); return; }
    sheetCard.innerHTML =
      '<div class="bar"><b class="ttl">LABOR GAP</b><button type="button" class="x" data-act="close">✕</button></div>' +
      "<p>Locals only. Explain the missing work here. Not a visa mill.</p>" +
      '<label>Role <input id="sn-gap-role" type="text" placeholder="driver / cook / …"></label>' +
      '<label>Why no local <input id="sn-gap-why" type="text" placeholder="No one available for nights"></label>' +
      '<button type="button" class="go throw" data-act="gap-post">POST DEMAND</button>';
    showSheet();
  }
  function postGap() {
    var role = (($("sn-gap-role") && $("sn-gap-role").value) || "").trim();
    var why = (($("sn-gap-why") && $("sn-gap-why").value) || "").trim();
    if (!role || !why) { say("Role and why. Locals must explain the gap."); return; }
    var row = { id: "gap-" + Date.now().toString(36), kind: "gap", name: role, raw: why, lat: (here && here.lat) || 0, lng: (here && here.lng) || 0, peer: meMail() };
    listings.unshift(row);
    fetch("/api/space", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ row: row }) }).catch(function () {});
    closeSheet();
    say("Gap posted: " + role + ". Abroad applicants can apply against this.");
  }
  function openReload() {
    if (!signed()) { say("Sign in first."); if (window.SNAuth && SNAuth.open) SNAuth.open(); return; }
    sheetCard.innerHTML =
      '<div class="bar"><b class="ttl">RELOAD</b><button type="button" class="x" data-act="close">✕</button></div>' +
      "<p>PayPal EUR → AV€. SpaceNet 3%.</p>" +
      '<label>Amount <input id="sn-reload" type="number" min="5" value="20"></label>' +
      '<button type="button" class="go throw" data-act="paypal">PAYPAL</button>';
    showSheet();
  }

  function throwJob() {
    if (!signed()) { needLogin(); return; }
    if (!vendor) { say("Pick a vendor first."); return; }
    if (!drop && !here) { say("Set your drop. GPS or 1s pin."); return; }
    if (!drop && here) setDrop(here);
    if (!drop) return;
    opts.tip = Number(($("sn-tip") && $("sn-tip").value) || opts.tip || 0) || 0;
    var q = quoteOf(vendor, drop, opts);
    var inside = bundled(vendor, drop);
    var fee = inside ? 0 : q.fee;
    var driverFee = q.fee;
    var job = {
      id: "job-" + Date.now().toString(36),
      kind: "job",
      status: "pending",
      vendor: vendor,
      drop: drop,
      from: vendor,
      to: drop,
      km: q.rawKm,
      fee: fee,
      driverFee: driverFee,
      tip: opts.tip,
      vip: !!opts.vip,
      floor: !!opts.floor,
      night: isNight(),
      rain: weatherRain,
      cut: inside ? 0 : q.cut,
      bundled: inside,
      confirm: { client: true, vendor: false, driver: false },
      t: Date.now(),
      peer: (user() && user().email) || "",
      name: vendor.name
    };
    jobs.unshift(job);
    persistJobs();
    fetch("/api/space", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ row: { id: job.id, kind: "job", lat: drop.lat, lng: drop.lng, name: vendor.name, status: "pending", avc: driverFee, ride: q.rawKm } }) }).catch(function () {});
    closeSheet();
    jobsPane.classList.add("on");
    paintJobs();
    var jc = jobsPane.querySelector(".card");
    resetCardH(jc);
    attachSheetPhysics(jc, function () { jobsPane.classList.remove("on"); });
    showRoute(job);
    say("Waiting. Vendor, driver, you. No job until all three confirm.");
  }
  function persistJobs() {
    try { localStorage.setItem("sn:jobs", JSON.stringify(jobs.slice(0, 40))); } catch (e) {}
  }
  function meMail() { var u = user(); return (u && u.email || "").toLowerCase(); }
  function jobAct(id, act) {
    var job = jobs.filter(function (j) { return j.id === id; })[0];
    if (!job) return;
    var mail = meMail();
    if (act === "accept") {
      if (!amDriver() && !isOwner()) { say("Open as a driver first."); return; }
      job.confirm = job.confirm || {};
      job.confirm.driver = true;
      job.driver = mail;
      sealIfThree(job);
    } else if (act === "confirm-vendor") {
      job.confirm = job.confirm || {};
      job.confirm.vendor = true;
      sealIfThree(job);
    } else if (act === "confirm-client") {
      job.confirm = job.confirm || {};
      job.confirm.client = true;
      sealIfThree(job);
    } else if (act === "confirm-driver") {
      job.confirm = job.confirm || {};
      job.confirm.driver = true;
      sealIfThree(job);
    } else if (act === "handoff") {
      if (job.status !== "live") return;
      job.vendorHand = true;
      if (job.driverGot) payVendor(job);
    } else if (act === "got") {
      if (job.status !== "live" && job.status !== "picked") return;
      job.driverGot = true;
      if (job.vendorHand) payVendor(job);
    } else if (act === "delivered") {
      if (job.status !== "picked") return;
      job.driverDone = true;
      if (job.clientGot) payDriver(job);
    } else if (act === "received") {
      if (job.status !== "picked") return;
      job.clientGot = true;
      if (job.driverDone) payDriver(job);
    } else if (act === "spoil") {
      chargeFault(job, RULES.spoilPayer || "driver", "spoiled");
    } else if (act === "wrong") {
      chargeFault(job, RULES.wrongPayer || "vendor", "wrong");
    } else if (act === "judge") {
      judgeId = job.id;
      talk(
        "Judge this job. Claim from the client. Status " + (job.status || "") + ". Vendor " + ((job.vendor && job.vendor.name) || "") + ". Fee " + (job.fee || 0) + ".",
        "Fault law: spoiled goods = driver pays replacement. Wrong goods = vendor pays the right goods and a new delivery fee. No support. Return JSON act=judge fault=driver|vendor|client charge=number."
      );
    }
    persistJobs();
    paintJobs();
    showRoute(job);
  }
  function sealIfThree(job) {
    var c = job.confirm || {};
    if (c.client && c.vendor && c.driver) {
      if (job.status === "pending") {
        var bal = avcGet();
        if (!isOwner() && job.fee > 0 && bal < job.fee) {
          say("Need " + fmtAve(job.fee) + " to seal.");
          return;
        }
        if (!isOwner() && job.fee > 0) avcSet(bal - job.fee);
        job.status = "live";
        say("All three confirmed. Job is live. Route on the map.");
      }
    } else {
      job.status = "pending";
      say("Waiting: client " + (c.client ? "yes" : "no") + " · vendor " + (c.vendor ? "yes" : "no") + " · driver " + (c.driver ? "yes" : "no") + ". No job yet.");
    }
  }
  function chargeFault(job, who, kind) {
    if (job.faulted) { say("Already judged."); return; }
    job.faulted = true;
    job.fault = who;
    job.faultKind = kind;
    job.status = "fault";
    var charge = Number(job.driverFee || job.fee || 3);
    if (kind === "wrong" && RULES.wrongPaysNewFee) charge = charge + Number(job.driverFee || job.fee || 3);
    job.faultCharge = charge;
    say((who === "driver" ? "Driver" : who === "vendor" ? "Vendor" : "Client") + " pays " + fmtAve(charge) + ". " + (kind === "wrong" ? "Wrong goods + new fee." : "Spoiled in transit.") + " AI judged. No ticket.");
  }
  function payVendor(job) {
    if (job.vendorPaid) return;
    job.vendorPaid = true;
    job.status = "picked";
    say("Vendor paid. Driver has the goods.");
  }
  function payDriver(job) {
    if (job.driverPaid) return;
    job.driverPaid = true;
    job.status = "done";
    settleRelay(job.cut || 0.03);
    say("Received. Driver paid " + fmtAve(job.driverFee || job.fee || 0) + ".");
  }
  function throwHour() {
    if (!signed()) { say("Sign in to post."); if (window.SNAuth && SNAuth.open) SNAuth.open(); return; }
    var hrs = Math.max(1, Number(($("sn-hours") && $("sn-hours").value) || 1));
    var what = ($("sn-hour-q") && $("sn-hour-q").value) || "Hourly work";
    var fee = hrs * 33;
    var cut = Math.round(fee * 0.03 * 100) / 100;
    var bal = avcGet();
    if (!isOwner() && bal < fee) { say("Need " + fmtAve(fee) + "."); openReload(); return; }
    if (!isOwner()) avcSet(bal - fee);
    var pt = here || facing();
    var job = { id: "hour-" + Date.now().toString(36), kind: "job", status: "posted", hours: hrs, fee: fee, cut: cut, name: what, from: pt, to: pt, t: Date.now() };
    jobs.unshift(job);
    try { localStorage.setItem("sn:jobs", JSON.stringify(jobs.slice(0, 40))); } catch (e) {}
    closeSheet();
    say("Posted " + hrs + "h · " + fmtAve(fee) + " · " + what);
    paintJobs();
  }
  function paintJobs() {
    if (!jobsList) return;
    if (!jobs.length) {
      jobsList.innerHTML = '<div class="job"><b>Queue empty</b><span>Login, set drop or base, tap a shop pill, then send. Three confirms.</span></div>';
      return;
    }
    var mail = meMail();
    jobsList.innerHTML = jobs.map(function (j) {
      var c = j.confirm || {};
      var html = '<div class="job" data-id="' + esc(j.id) + '"><p class="price">' + fmtAve((j.fee || 0) + (j.tip || 0)) + "</p><b>" + esc(j.name || (j.hours ? "HOURLY" : "DELIVERY")) + "</b><span>" +
        esc(j.status || "pending") +
        (j.vip ? " · VIP" : "") +
        (j.floor ? " · floor" : "") +
        (j.tip ? (" · tip " + fmtAve(j.tip)) : "") +
        (j.km ? (" · " + Number(j.km).toFixed(1) + " km") : "") +
        (j.drop && j.drop.name ? (" · " + esc(j.drop.name)) : "") +
        "</span>";
      if (!j.hours) {
        if (j.status === "pending") {
          html += "<span>Client " + (c.client ? "✓" : "…") + " · Vendor " + (c.vendor ? "✓" : "…") + " · Driver " + (c.driver ? "✓" : "…") + "</span>";
          if (!c.vendor) html += '<button type="button" data-job="confirm-vendor">VENDOR CONFIRMS</button>';
          if (!c.driver) html += '<button type="button" data-job="confirm-driver">DRIVER CONFIRMS</button>';
          if (!c.client) html += '<button type="button" data-job="confirm-client">CLIENT CONFIRMS</button>';
        }
        if (j.status === "offered" && (amDriver() || isOwner()))
          html += '<button type="button" data-job="accept">ACCEPT</button>';
        if (j.status === "live") {
          html += '<button type="button" data-job="handoff">VENDOR HANDED OFF</button>';
          html += '<button type="button" data-job="got">DRIVER GOT IT</button>';
        }
        if (j.status === "picked") {
          html += '<button type="button" data-job="delivered">DRIVER DELIVERED</button>';
          html += '<button type="button" data-job="received">I RECEIVED</button>';
        }
        if (j.status === "accepted" || j.status === "picked") {
          html += '<button type="button" data-job="spoil">SPOILED — DRIVER PAYS</button>';
          html += '<button type="button" data-job="wrong">WRONG — VENDOR PAYS</button>';
          html += '<button type="button" data-job="judge">AI JUDGE</button>';
        }
        if (j.status === "fault") html += "<span>Fault: " + esc(j.fault) + " · " + fmtAve(j.faultCharge || 0) + "</span>";
      }
      return html + "</div>";
    }).join("");
  }
  function loadJobs() {
    try { jobs = JSON.parse(localStorage.getItem("sn:jobs") || "[]") || []; } catch (e) { jobs = []; }
    idbGet("listings").then(function (rows) {
      if (rows && rows.length && !listings.length) { listings = rows; paintMarks(); }
    });
    var q = "/api/space";
    if (here && isFinite(here.lat)) q += "?lat=" + here.lat + "&lng=" + here.lng + "&peer=" + encodeURIComponent(nodeId);
    fetch(q).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok) {
        if (nodeCh) nodeCh.postMessage({ t: "want-replica", id: nodeId });
        return;
      }
      listings = [].concat(j.shops || [], j.drivers || [], j.posts || []);
      (j.jobs || []).forEach(function (row) {
        if (!jobs.some(function (x) { return x.id === row.id; })) jobs.push(row);
      });
      pullPeers(j);
      idbSet("listings", listings.slice(0, 80));
      cidOf(listings.slice(0, 20)).then(function (c) { try { localStorage.setItem("sn:cid", c); } catch (e) {} });
      paintJobs(); paintMarks();
    }).catch(function () {
      if (nodeCh) nodeCh.postMessage({ t: "want-replica", id: nodeId });
    });
    paintJobs();
  }

  function applyRole(role) {
    if (!signed()) { say("Sign in, read terms, then apply."); if (window.SNAuth && SNAuth.open) SNAuth.open(); return; }
    var legal = $("sn-legal") && $("sn-legal").checked;
    var foreign = $("sn-foreign") && $("sn-foreign").checked;
    if (RULES.workLegal && !legal) { say("Legal work at this GPS is required."); return; }
    if (RULES.foreignNeedsGap && foreign && !gaps().length && !isOwner()) {
      say("No labor-gap demand from people here. Locals post the gap first.");
      return;
    }
    var list = [];
    try { list = JSON.parse(localStorage.getItem("sn:roles") || "[]") || []; } catch (e) {}
    if (!list.some(function (r) { return r.role === role; })) {
      list.push({ role: role, status: "pending", legal: true, foreign: !!foreign, gap: foreign ? (gaps()[0] && gaps()[0].id) : "" });
    }
    try { localStorage.setItem("sn:roles", JSON.stringify(list)); } catch (e) {}
    say(role.toUpperCase() + " applied" + (foreign ? " against a local gap" : "") + ". Notis activates after Terms.");
    closeSheet();
    paintPower();
  }
  function evolve(patch) {
    if (!patch || typeof patch !== "object") return false;
    var allow = { spoilPayer: 1, wrongPayer: 1, wrongPaysNewFee: 1, judge: 1, support: 1, workLegal: 1, foreignNeedsGap: 1 };
    Object.keys(patch).forEach(function (k) {
      if (allow[k]) RULES[k] = patch[k];
    });
    try { localStorage.setItem("sn:rules", JSON.stringify(RULES)); } catch (e) {}
    say("Engine evolved. Spoil→" + RULES.spoilPayer + " wrong→" + RULES.wrongPayer + ".");
    return true;
  }

  function paypalStart() {
    var amt = Math.max(10, Number(($("sn-reload") && $("sn-reload").value) || 20));
    var headers = { "Content-Type": "application/json" };
    var tok = "";
    try { tok = (window.SNAuth && SNAuth.token && SNAuth.token()) || localStorage.getItem("sn:access") || ""; } catch (e) {}
    if (tok) headers.Authorization = "Bearer " + tok;
    say("Opening PayPal…");
    fetch("/api/paypal/create-order", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ amount: amt, origin: location.origin })
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var href = (j && (j.approve || j.url)) || "";
        if (href) { location.href = href; return; }
        say((j && (j.message || j.error)) || "PayPal did not start.");
      })
      .catch(function () { say("PayPal did not answer."); });
  }
  function paypalReturn() {
    var q = new URLSearchParams(location.search);
    if (q.get("paypal") === "cancel") {
      say("Reload cancelled.");
      history.replaceState({}, "", "/");
      return;
    }
    var orderId = q.get("token") || q.get("orderId") || "";
    if (q.get("paypal") !== "success" && !orderId) return;
    if (!orderId) return;
    var headers = { "Content-Type": "application/json" };
    var tok = "";
    try { tok = (window.SNAuth && SNAuth.token && SNAuth.token()) || localStorage.getItem("sn:access") || ""; } catch (e) {}
    if (tok) headers.Authorization = "Bearer " + tok;
    say("Verifying PayPal…");
    fetch("/api/paypal/capture-order", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ orderId: orderId })
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        history.replaceState({}, "", "/");
        if (!j || !j.ok) {
          say((j && (j.message || j.error)) || "PayPal did not capture.");
          return;
        }
        var eur = Number(j.eur || j.credited || j.avc || 0);
        if (eur > 0) avcSet(avcGet() + eur);
        say("AV€ " + eur.toFixed(2) + " in. 1:1 with euro.");
      })
      .catch(function () {
        history.replaceState({}, "", "/");
        say("PayPal did not finish.");
      });
  }

  function gps() {
    say("Finding you…");
    function land(pt, name) {
      here = pt; hereName = name || "YOU";
      flyTo(pt, 1.12);
      setTimeout(function () { openCity(pt); }, 920);
      say(name || (pt.lat.toFixed(3) + "," + pt.lng.toFixed(3)));
      reverse(pt);
      paintMarks();
    }
    if (!navigator.geolocation) { say("No GPS. Tap the globe to set YOU."); return; }
    navigator.geolocation.getCurrentPosition(
      function (pos) { land({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      function () {
        navigator.geolocation.getCurrentPosition(
          function (pos) { land({ lat: pos.coords.latitude, lng: pos.coords.longitude }, "coarse"); },
          function () { say("GPS denied. Tap the globe to set FROM."); },
          { enableHighAccuracy: false, timeout: 8000 }
        );
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 14221 }
    );
  }
  function reverse(pt) {
    fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" + pt.lat + "&lon=" + pt.lng, { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var n = (j && (j.name || (j.address && (j.address.suburb || j.address.city || j.address.town)))) || "";
        if (n) { hereName = n; say(n); paintMarks(); }
      }).catch(function () {});
  }

  function talk(text, extra) {
    extra = extra || "";
    var msg = String(text || "").trim();
    if (!msg) return;
    if (/^(hi|hello|hey|γεια)$/i.test(msg)) { say("Here. Tap GPS, or talk in ordinary language."); return; }
    say("Grok…");
    history.push({ role: "user", content: msg });
    fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg + (extra ? "\n" + extra : ""),
        history: history.slice(-12),
        here: { lat: here && here.lat, lng: here && here.lng, place: hereName, level: level, avc: signed() ? avcGet() : 0, rules: RULES }
      })
    }).then(function (r) { return r.json(); }).then(function (j) {
      var spoken = (j && (j.say || j.text)) || "Grok did not answer.";
      history.push({ role: "assistant", content: spoken });
      say(spoken);
      var act = (j && j.act) || "talk";
      var places = (j && j.places) || [];
      if (act === "locate") { gps(); return; }
      if (act === "globe") { closeCity(); return; }
      if (act === "reload") { openReload(); return; }
      if (act === "evolve" && j.patch) { evolve(j.patch); return; }
      if (act === "judge" && judgeId) {
        var job = jobs.filter(function (x) { return x.id === judgeId; })[0];
        if (job) chargeFault(job, j.fault || "driver", j.kind || "spoil");
        judgeId = "";
        paintJobs();
        return;
      }
      if (act === "city" || act === "map" || act === "national") {
        if (here) openCity(here); else gps();
      }
      if (act === "hunt" || places.length) {
        huntNamed(msg, places);
      } else if (act === "talk") {
        /* nothing else */
      } else if (msg.length > 2 && !/^(thanks|ok|okay|yes|no)$/i.test(msg)) {
        huntNamed(msg, []);
      }
    }).catch(function () { say("Grok is not reachable."); });
  }

  function huntNamed(q, grokPlaces) {
    var pins = [];
    (grokPlaces || []).forEach(function (p) {
      var lat = Number(p.lat), lng = Number(p.lng);
      if (isFinite(lat) && isFinite(lng)) pins.push({ name: p.name || q, lat: lat, lng: lng, raw: p.raw || "", phone: p.phone || "" });
    });
    var url = "https://photon.komoot.io/api/?limit=8&q=" + encodeURIComponent(q);
    fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      var feats = (j && j.features) || [];
      feats.forEach(function (f) {
        var c = f.geometry && f.geometry.coordinates;
        if (!c) return;
        var props = f.properties || {};
        var name = props.name || q;
        if (q.length >= 5 && name.toLowerCase().indexOf(String(q).toLowerCase().slice(0, 4)) < 0 && !new RegExp(q.replace(/[^\w\u0370-\u03ff ]+/g, ""), "i").test(name + " " + (props.city || ""))) {
          /* brand must contain the query — keep if grok already pinned */
          return;
        }
        pins.push({ name: name, lat: c[1], lng: c[0], raw: [props.street, props.city, props.country].filter(Boolean).join(", ") });
      });
      showHunt(q, pins);
    }).catch(function () { showHunt(q, pins); });
  }
  function showHunt(q, pins) {
    var seen = {};
    huntPins = [];
    filterPins = [];
    filterQ = q || "";
    pins.forEach(function (p) {
      var k = p.name + "|" + p.lat.toFixed(4) + "|" + p.lng.toFixed(4);
      if (seen[k]) return; seen[k] = 1;
      huntPins.push(p);
    });
    huntPins = huntPins.slice(0, 8);
    if (!huntPins.length) { say("No real pin for " + q + "."); return; }
    var first = huntPins[0];
    flyTo(first, 1.1);
    setTimeout(function () { openCity(first); }, 920);
    say(first.name + (huntPins.length > 1 ? (" · " + huntPins.length + " pins. Tap the vendor.") : " · tap it for menu."));
    paintMarks();
  }

  function upload(file) {
    if (!file) return;
    say("Sending " + file.name + " to Grok…");
    var extra = "They uploaded " + file.name + " (" + file.type + ", " + file.size + " bytes). Help with this job. Do not invent a shop.";
    if (/^image\//.test(file.type) && file.size < 900000) {
      var fr = new FileReader();
      fr.onload = function () { talk("See this upload: " + file.name, extra + "\n[image attached as data URL length " + String(fr.result || "").length + "]"); };
      fr.readAsDataURL(file);
      return;
    }
    talk("See this upload: " + file.name, extra);
  }

  function mic() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { say("Mic is not on this browser. Type."); return; }
    if (listening && rec) { try { rec.stop(); } catch (e) {} listening = false; goBtn.style.boxShadow = ""; return; }
    rec = new SR();
    rec.lang = /[α-ωά-ώ]/i.test((input && input.value) || "") ? "el-GR" : "en-GB";
    rec.interimResults = false;
    rec.onstart = function () { listening = true; goBtn.style.boxShadow = "0 0 16px #4df0ff"; say("Listening…"); };
    rec.onend = function () { listening = false; goBtn.style.boxShadow = ""; };
    rec.onerror = function () { listening = false; goBtn.style.boxShadow = ""; say("Mic closed."); };
    rec.onresult = function (e) {
      var t = (e.results[0] && e.results[0][0] && e.results[0][0].transcript) || "";
      if (t) { if (input) input.value = t; talk(t); }
    };
    rec.start();
  }

  sheet.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    var act = b && b.getAttribute("data-act");
    if (e.target.matches && e.target.matches("[data-opt]")) {
      var k = e.target.getAttribute("data-opt");
      if (e.target.type === "checkbox") opts[k] = e.target.checked;
      else opts[k] = Number(e.target.value) || 0;
      if (from && to) openOffer();
      if (vendor && drop) openOffer();
      return;
    }
    if (act === "close") { closeSheet(); return; }
    if (act === "throw") { throwJob(); return; }
    if (act === "clear") { vendor = null; drop = null; from = null; to = null; awaitingDrop = false; closeSheet(); paintMarks(); say("Cleared."); return; }
    if (act === "drop-gps") { dropGps(); return; }
    if (act === "drop-pin") {
      if (!signed()) { needLogin(); return; }
      awaitingDrop = true; closeSheet(); say("Long tap 1s on the drop. Pin names the place."); return;
    }
    if (act === "to-offer") { if (!signed()) { needLogin(); return; } if (!drop && here) setDrop(here); else if (drop) openOffer(); else say("Set your drop first."); return; }
    if (act === "need-login") { needLogin(); return; }
    if (act === "reload") { openReload(); return; }
    if (act === "withdraw") { say("Withdraw 3% after PayPal is keyed. Balance stays on this device."); return; }
    if (act === "hour") { openHour(); return; }
    if (act === "throw-hour") { throwHour(); return; }
    if (act === "role") { openRole(); return; }
    if (act === "apply") { applyRole(b.getAttribute("data-role") || "vendor"); return; }
    if (act === "gap") { openGap(); return; }
    if (act === "gap-post") { postGap(); return; }
    if (act === "terms") { location.href = "/terms"; return; }
    if (act === "paypal") { paypalStart(); return; }
    if (act === "reboot") { if (window.SNReboot) window.SNReboot(); return; }
    if (act === "filter") { runFilter(b.getAttribute("data-q") || ""); return; }
    if (act === "pin") { pinFromFind(b.getAttribute("data-id") || ""); return; }
    if (act === "node-toggle") { toggleNode(); return; }
    if (act === "node-pull") { pullReplica(); return; }
  });
  jobsPane.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (b && b.getAttribute("data-act") === "hide") jobsPane.classList.remove("on");
    var jb = e.target.closest("[data-job]");
    if (jb) {
      var card = jb.closest(".job");
      jobAct(card && card.getAttribute("data-id"), jb.getAttribute("data-job"));
    }
  });
  jobsBtn.addEventListener("click", function () {
    var on = jobsPane.classList.toggle("on");
    paintJobs();
    if (on) {
      var card = jobsPane.querySelector(".card");
      resetCardH(card);
      attachSheetPhysics(card, function () { jobsPane.classList.remove("on"); });
    }
  });
  if (findBtn) findBtn.addEventListener("click", openFind);
  if (nodeBtn) nodeBtn.addEventListener("click", function (e) { e.stopPropagation(); openNode(); });
  if (powerBtn) {
    powerBtn.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      var n = 3;
      if (countEl) { countEl.textContent = String(n); countEl.classList.add("on"); }
      powerHold = setInterval(function () {
        n -= 1;
        if (countEl) countEl.textContent = String(n);
        if (n <= 0) {
          clearInterval(powerHold); powerHold = 0;
          if (countEl) countEl.classList.remove("on");
          toggleLive();
        }
      }, 1000);
    });
    powerBtn.addEventListener("pointerup", function () {
      if (powerHold) {
        clearInterval(powerHold); powerHold = 0;
        if (countEl) countEl.classList.remove("on");
      }
    });
    powerBtn.addEventListener("pointercancel", function () {
      if (powerHold) { clearInterval(powerHold); powerHold = 0; }
      if (countEl) countEl.classList.remove("on");
    });
    powerBtn.addEventListener("click", function (e) { e.preventDefault(); });
  }
  gpsBtn.addEventListener("click", gps);
  plusBtn.addEventListener("click", function () { fileInp.click(); });
  fileInp.addEventListener("change", function () { if (fileInp.files && fileInp.files[0]) upload(fileInp.files[0]); fileInp.value = ""; });
  goBtn.addEventListener("click", mic);
  form.addEventListener("submit", function (e) { e.preventDefault(); var t = input.value; input.value = ""; talk(t); });
  moneyBtn.addEventListener("click", function () { if (signed()) openReload(); });

  var islandEl = $("island");
  if (islandEl) islandEl.addEventListener("click", function (e) {
    if (e.target && e.target.closest && e.target.closest("#sn-tasks-btn")) return;
    openSys();
  });
  window.addEventListener("resize", layoutHud);

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  window.SN = {
    talk: talk, say: say, user: user, avcGet: avcGet, paintMoney: paintMoney,
    node: { id: function () { return nodeId; }, live: function () { return nodeLive; }, peers: function () { return nodePeers; }, owed: function () { return nodeOwed; }, helia: function () { return heliaNote(); }, rtc: function () { return nodeRtc; } },
    getMap: function () { return map; },
    openCity: openCity,
    openVendor: openVendor,
    rules: RULES,
    evolve: evolve,
    chargeFault: chargeFault,
    cam: cam,
    paintPower: paintPower,
    visibleShops: visibleShops,
    openFind: openFind,
    layoutHud: layoutHud,
    projectTest: function (lat, lng) { return project(lat, lng, cam, canvas.clientWidth, canvas.clientHeight); }
  };

  try { Object.assign(RULES, JSON.parse(localStorage.getItem("sn:rules") || "{}")); } catch (e) {}
  try { liveOpen = localStorage.getItem("sn:live") === "1"; } catch (e) {}
  paintPower();
  paintIsland();
  pullWx();
  layoutHud();
  paintMoney();
  loadJobs();
  bootMesh();
  paypalReturn();
  say("Grid globe. Tap GPS. This phone can be a node.");
  setInterval(function () { if (nodeLive) announceNode(); }, 90000);
  setInterval(function () { if (nodeCh) nodeCh.postMessage({ t: "hello", id: nodeId }); paintNode(); }, 30000);
  requestAnimationFrame(drawGlobe);
  setInterval(paintMoney, 4000);
  setInterval(paintIsland, 1000);
  setInterval(sampleLoad, 700);
  setInterval(pullWx, 10 * 60 * 1000);
})();
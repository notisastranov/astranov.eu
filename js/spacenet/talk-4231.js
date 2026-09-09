/* SpaceNet 4231 — talk restore: #f → /api/ai before land. Guest OK; no GPS required. */
(function (global) {
  "use strict";
  if (global.__SN_TALK_4231) return;
  global.__SN_TALK_4231 = true;
  var PIZZA = /\b(pizza|pizzeria|\u03c0\u03b9\u03c4\u03c3)\b/i;
  var LAND_ACT = /^(city|map|national|place|land|go|fly|streets)$/;
  var TALK_ACT = /^(talk|research|answer)$/;
  var busy = false;
  var hist = [];
  var SN = (global.SN = global.SN || {});

  function paint(msg) {
    var s = String(msg == null ? "" : msg).trim();
    if (!s) return;
    try {
      var el = document.getElementById("line");
      if (el) el.textContent = s;
    } catch (e) {}
    try {
      if (typeof SN.talk === "function") SN.talk(s);
      else if (typeof SN.say === "function") SN.say(s);
    } catch (e) {}
  }

  function scrubSay(s) {
    s = String(s == null ? "" : s).trim();
    if (!s) return "";
    if (s.charAt(0) === "{" && /"say"\s*:/.test(s)) {
      try {
        var o = JSON.parse(s);
        if (o && o.say != null) return String(o.say).trim();
      } catch (e) {}
      var m = s.match(/"say"\s*:\s*"((?:\\.|[^"\\])*)"/);
      if (m) {
        try {
          return JSON.parse('"' + m[1] + '"');
        } catch (e) {
          return m[1];
        }
      }
    }
    return s;
  }

  function parseMind(j, raw) {
    j = j && typeof j === "object" ? j : {};
    var text = String(j.text || j.response || j.answer || "");
    var say = scrubSay(j.say != null ? j.say : "");
    var act = String(j.act || "").toLowerCase();
    var q = String(j.q || j.query || "").trim();
    var places = Array.isArray(j.places) ? j.places : [];
    var lat = j.lat;
    var lng = j.lng;
    if ((!say || say.charAt(0) === "{") && text) {
      var nested = scrubSay(text);
      if (nested && nested !== text) say = nested;
      var m = text.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          var o = JSON.parse(m[0]);
          if (o) {
            if (o.say != null && !say) say = scrubSay(o.say);
            if (o.act && !act) act = String(o.act).toLowerCase();
            if (o.q && !q) q = String(o.q).trim();
            if (o.places && o.places.length) places = o.places;
            if (o.lat != null) lat = o.lat;
            if (o.lng != null) lng = o.lng;
          }
        } catch (e) {}
      }
    }
    if (!say) say = scrubSay(text.replace(/\{[\s\S]*\}/, "").trim());
    if (!act) act = "talk";
    return {
      say: say,
      act: act,
      q: q || String(raw || "").trim(),
      places: places,
      lat: lat,
      lng: lng,
      phone: j.phone || "",
      name: j.name || ""
    };
  }

  function hereCtx() {
    var place = null;
    try {
      place = JSON.parse(localStorage.getItem("sn:place") || "null");
    } catch (e) {}
    var lat = place && isFinite(+place.lat) ? +place.lat : null;
    var lng = place && isFinite(+place.lng) ? +place.lng : null;
    var name = place && place.name ? String(place.name) : "";
    var avc = 0;
    try {
      var n = Number(localStorage.getItem("sn:avc"));
      if (isFinite(n)) avc = n;
    } catch (e) {}
    return {
      place: name,
      lat: lat,
      lng: lng,
      avc: avc,
      level: name ? "city" : "globe"
    };
  }

  function setPlace(p) {
    if (!p || !isFinite(+p.lat) || !isFinite(+p.lng)) return;
    var name = String(p.name || p.place || "here").split(",")[0].trim() || "here";
    try {
      localStorage.setItem(
        "sn:place",
        JSON.stringify({ lat: +p.lat, lng: +p.lng, name: name })
      );
    } catch (e) {}
    global.__SN_LANDED = { lat: +p.lat, lng: +p.lng, name: name, at: Date.now() };
  }

  function doLand(name, mind) {
    var q = String(name || "").trim();
    if (mind && isFinite(+mind.lat) && isFinite(+mind.lng)) {
      var pin = {
        lat: +mind.lat,
        lng: +mind.lng,
        name: q || mind.name || "place"
      };
      setPlace(pin);
      try {
        if (typeof SN.showCity === "function") SN.showCity(pin, 13);
      } catch (e) {}
      paint(mind.say || "On the ground in " + pin.name + ".");
      return;
    }
    if (!q) {
      if (mind && mind.say) paint(mind.say);
      return;
    }
    try {
      if (typeof SN.goNamed === "function") {
        SN.goNamed(q, true);
        if (mind && mind.say) paint(mind.say);
        return;
      }
    } catch (e) {}
    paint(mind && mind.say ? mind.say : "Landing " + q + "\u2026");
    document.dispatchEvent(
      new CustomEvent("sn:land", { detail: { q: q, mind: mind || null } })
    );
  }

  function applyMind(m, raw) {
    if (!m) return;
    var act = String(m.act || "talk").toLowerCase();
    if (LAND_ACT.test(act)) {
      doLand(m.q || m.name || raw, m);
      return;
    }
    if (act === "hunt" || act === "find" || act === "order") {
      if (m.say) paint(m.say);
      try {
        global.__SN_LAST_HUNT = {
          q: m.q || raw,
          list: (m.places || []).slice(),
          at: Date.now(),
          from: "talk-4231"
        };
        if (SN) SN.lastHunt = global.__SN_LAST_HUNT;
      } catch (e) {}
      return;
    }
    if (TALK_ACT.test(act) || !act || act === "locate") {
      paint(m.say || "\u2026");
      return;
    }
    if (m.say) paint(m.say);
  }

  function ask(q) {
    q = String(q || "").trim();
    if (!q || busy) return;
    busy = true;
    global.__SN_CLI_HANDLED = true;
    paint("\u2026");
    var body = {
      q: q,
      message: q,
      prompt: q,
      allow_paid: true,
      force_paid: true,
      spacenet: true,
      fast: true,
      here: hereCtx(),
      history: hist.slice(-16)
    };
    fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body)
    })
      .then(function (r) {
        return r.json().then(function (j) {
          j = j || {};
          j.http = r.status;
          return j;
        });
      })
      .then(function (j) {
        var m = parseMind(j, q);
        hist.push({ role: "user", content: q });
        hist.push({ role: "assistant", content: m.say || m.act || "" });
        if (hist.length > 16) hist = hist.slice(-16);
        applyMind(m, q);
      })
      .catch(function () {
        paint("Mind offline. Try again.");
      })
      .then(
        function () {
          busy = false;
        },
        function () {
          busy = false;
        }
      );
  }

  SN.talkAsk = ask;
  SN.grok = SN.grok || ask;

  document.addEventListener(
    "submit",
    function (ev) {
      var form = ev.target;
      if (!form || form.id !== "f") return;
      var inp = document.getElementById("in");
      var q = inp ? String(inp.value || "").trim() : "";
      if (!q) return;
      if (PIZZA.test(q)) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      global.__SN_CLI_HANDLED = true;
      if (inp) inp.value = "";
      ask(q);
    },
    true
  );

  try {
    var line = document.getElementById("line");
    if (line && !String(line.textContent || "").trim()) line.textContent = "Earth online \u00b7 4231";
  } catch (e) {}
})(typeof window !== "undefined" ? window : this);

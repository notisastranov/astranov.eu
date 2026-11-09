/* Individual land portions. Official KAEK polygons where the operating cadastre has them.
   Rhodes is not in that layer: the solid rings are the Italian individual portions. */
(function () {
  var VAULT = [
    { name: "Particella 214", kind: "individual", ring: [[36.291326, 27.947511], [36.291362, 27.948358], [36.291847, 27.948403], [36.291811, 27.947556]] },
    { name: "Particella 215", kind: "individual", ring: [[36.29138, 27.94847], [36.291416, 27.949206], [36.291865, 27.94925], [36.291829, 27.948515]] },
    { name: "Particella 088", kind: "individual", ring: [[36.291955, 27.947578], [36.292008, 27.949072], [36.292458, 27.949027], [36.292422, 27.947623]] },
    { name: "Forest strip", kind: "individual", ring: [[36.29252, 27.94762], [36.29256, 27.94822], [36.29222, 27.94828], [36.2919, 27.9477]] },
    { name: "Quadro", kind: "sheet", ring: [[36.2912, 27.9474], [36.291254, 27.949272], [36.292062, 27.949362], [36.292601, 27.949161], [36.29253, 27.947601], [36.291631, 27.947266]] }
  ];
  var PORTION_ZOOM = 15;
  var group = null;
  var token = 0;

  function say(text) {
    if (window.SN && window.SN.say) window.SN.say(text);
  }

  function ringsOf(geom) {
    if (!geom || !geom.coordinates) return [];
    var out = [];
    function push(ring) {
      var ll = [];
      for (var i = 0; i < ring.length; i++) {
        if (ring[i] && ring[i].length >= 2) ll.push([ring[i][1], ring[i][0]]);
      }
      if (ll.length >= 3) out.push(ll);
    }
    if (geom.type === "Polygon") geom.coordinates.forEach(push);
    else if (geom.type === "MultiPolygon") geom.coordinates.forEach(function (poly) { poly.forEach(push); });
    return out;
  }

  function drawVault(map) {
    VAULT.forEach(function (p) {
      L.polygon(p.ring, {
        color: p.kind === "sheet" ? "#6ec8c4" : "#ffe08a",
        weight: p.kind === "sheet" ? 1.5 : 3,
        dashArray: p.kind === "sheet" ? "7 6" : null,
        fillColor: "#c6a15a",
        fillOpacity: p.kind === "sheet" ? 0.02 : 0.12
      }).bindTooltip(p.name, { sticky: true }).addTo(group);
    });
  }

  function load(map) {
    if (!group) return;
    group.clearLayers();
    var z = map.getZoom();
    if (z < PORTION_ZOOM) {
      if (z < 8) say("National view. Zoom in past Greece to open each land portion.");
      return;
    }
    var b = map.getBounds();
    var west = b.getWest(), south = b.getSouth(), east = b.getEast(), north = b.getNorth();
    var inVault = west < 27.951 && east > 27.946 && south < 36.294 && north > 36.290;
    if (inVault) drawVault(map);
    if (east - west > 0.04 || north - south > 0.04) {
      say(inVault ? "Italian individual portions. Zoom closer for official KAEK lines where they exist." : "Zoom closer. Portion lines are drawn at cadastral scale.");
      return;
    }
    var mine = ++token;
    var q = "/api/parcels?west=" + west.toFixed(5) + "&south=" + south.toFixed(5) + "&east=" + east.toFixed(5) + "&north=" + north.toFixed(5);
    fetch(q).then(function (r) { return r.json(); }).then(function (body) {
      if (mine !== token || !group) return;
      var features = (body && body.features) || [];
      features.forEach(function (f) {
        var rings = ringsOf(f.geometry);
        if (!rings.length) return;
        var kaek = (f.properties && f.properties.KAEK) || "";
        L.polygon(rings, { color: "#f4f7f6", weight: 2, fillOpacity: 0.05 })
          .bindTooltip(kaek, { sticky: true })
          .addTo(group);
      });
      if (!features.length && inVault) say("No official portion boundaries on Rhodes yet. Solid rings are the Italian individual portions. The dashed ring is only the cumulative sheet.");
      else if (features.length) say(features.length + " official land portions in this frame, each with a KAEK.");
    }).catch(function () {
      if (inVault) say("Official portion lines did not load. The Italian individual graphs stay on.");
    });
  }

  function attach() {
    var map = window.__SN_MAP;
    if (!map || !window.L) return;
    group = L.layerGroup().addTo(map);
    map.on("moveend", function () { load(map); });
    load(map);
    var btn = document.getElementById("sn-portions");
    if (btn) btn.addEventListener("click", function () {
      map.setView([36.2917, 27.9483], 17);
      say("Italian individual portions. Official KAEK lines appear on the mainland when you zoom past the national view.");
    });
  }

  if (document.readyState === "complete") setTimeout(attach, 0);
  else window.addEventListener("load", function () { setTimeout(attach, 0); });
})();

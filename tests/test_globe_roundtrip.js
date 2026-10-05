var g = require("./globe_math.js");
var places = [
  { name: "E Med", lat: 36.4, lng: 28.2 },
  { name: "Athens", lat: 37.9756, lng: 23.7348 },
  { name: "Chicago", lat: 41.8781, lng: -87.6298 },
  { name: "Rhodes", lat: 36.434, lng: 28.217 }
];
var spins = [0, 0.4, 1.2, Math.PI, 2.7, 4.1, 5.5];
var dists = [5.4, 1.85, 1.2, 0.9, 0.72, 0.55];
var size = { w: 390, h: 844 };
var fail = 0, pass = 0;
places.forEach(function (pl) {
  spins.forEach(function (spin) {
    dists.forEach(function (dist) {
      var r = g.roundTrip(pl.lat, pl.lng, spin, dist, size.w, size.h, { x: 0, y: 0 });
      if (!r.ok) {
        fail++;
        console.log("FAIL", pl.name, "spin", spin, "dist", dist, JSON.stringify(r));
      } else pass++;
      if (pl.name === "E Med" && r.hit) {
        if (r.hit.lng < -100 || r.hit.lat > 55) {
          fail++;
          console.log("FAIL Alaska-bait", r.hit);
        }
      }
    });
  });
});
console.log("globe round-trip: pass=" + pass + " fail=" + fail);
if (fail) process.exit(1);

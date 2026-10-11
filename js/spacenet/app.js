/* SPACENET MASTER — version law
On every start the top states V and the loaded number, then LATEST.
Example: ASTRANOV SPACENET V4292 LATEST 4293 UPDATE NOW.
If the loaded number is older, clear caches and service workers, then hard-reload.
Never clear the wallet, listings, jobs, or queue to do that.
If the reload fails, both numbers stay. UPDATE NOW forces the update again.
*/
(function () {
  "use strict";
  var SPEC = "On every start the top states V and the loaded number, then LATEST. If the loaded number is older, clear caches and service workers and hard-reload. Never clear the wallet, listings, jobs, or queue. If the reload fails, both numbers stay. UPDATE NOW forces the update again.";
  var VER = "4362";
  var latestVer = "";
  var INTRO_MS = 13000;
  var LAND = [];
  var LAND_PACK = "-16.17,180.00 -16.64,179.56 -16.75,179.57 -16.52,179.93 -16.74,179.93 -16.71,179.20 -16.98,178.71 -16.79,178.50 -16.62,178.58 -16.15,180.00;24.65,-81.33 24.64,-81.38 24.75,-81.42 24.67,-81.32;-11.95,143.18 -14.35,143.76 -14.23,144.47 -14.94,145.29 -16.41,145.43 -16.91,145.91 -18.98,146.38 -20.29,148.76 -22.44,149.70 -22.55,149.97 -22.17,150.02 -22.56,150.54 -22.37,150.62 -23.46,150.84 -24.12,151.83 -25.96,153.16 -27.19,153.12 -28.67,153.62 -31.43,152.94 -32.44,152.47 -33.58,151.29 -35.83,150.20 -37.53,149.93 -37.93,147.88 -38.66,146.86 -38.73,146.22 -39.15,146.40 -38.54,145.40 -38.24,145.48 -38.34,144.72 -38.09,145.12 -37.90,144.89 -38.82,143.54 -38.36,141.42 -37.25,139.78 -36.37,139.73 -35.58,138.97 -35.61,139.29 -35.38,139.28 -35.61,138.18 -35.02,138.51 -34.17,138.09 -35.14,137.69 -35.24,136.88 -34.92,137.01 -34.91,137.39 -33.58,137.93 -32.58,137.78 -33.63,137.24 -34.03,136.43 -34.66,135.89 -34.98,135.97 -34.94,135.65 -34.59,135.12 -34.58,135.45 -33.96,135.22 -33.26,134.72 -33.17,134.30 -32.55,134.23 -31.50,131.14 -32.30,125.92 -33.02,124.24 -33.99,123.21 -33.97,119.85 -34.99,118.14 -34.99,116.52 -34.26,115.01 -33.52,114.99 -33.64,115.36 -33.19,115.68 -31.69,115.70 -30.56,
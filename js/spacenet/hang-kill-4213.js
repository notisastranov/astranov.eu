/* SpaceNet 4213 — stop /boot freeze loop. Stay on /?v=4214. */
(function () {
  if (window.__SN_HANG_KILL_4213) return;
  window.__SN_HANG_KILL_4213 = true;
  try {
    var path = location.pathname || "";
    var q = location.search || "";
    if (/^\/boot(\/|$)/.test(path) || /[?&]wipe=1/.test(q)) {
      location.replace("/?v=4214&t=" + Date.now());
      return;
    }
  } catch (e) {}
})();

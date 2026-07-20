/* Astranov OS auto-boot */
(function astranovOsBoot() {
  if (window.__ASTRANOV_OS_BOOT__) return;
  window.__ASTRANOV_OS_BOOT__ = 1;
  var build = (document.querySelector('meta[name="astranov-build"]') || {}).content || Date.now();
  function load(src) {
    return new Promise(function (resolve) {
      if (document.querySelector('script[data-astranov-os="' + src + '"]')) return resolve();
      var s = document.createElement('script');
      s.src = src + '?v=' + encodeURIComponent(build);
      s.async = true;
      s.dataset.astranovOs = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { resolve(); };
      document.head.appendChild(s);
    });
  }
  function init() {
    try { if (window.AstranovOS) AstranovOS.init(); } catch (e) {}
    try { if (window.AstranovBrowser) AstranovBrowser.init(); } catch (e) {}
  }
  function run() {
    Promise.all([load('/js/08-astranov-os.js'), load('/js/08-astranov-browser.js')]).then(function () {
      init(); setTimeout(init, 1200); setTimeout(init, 3500);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  window.addEventListener('load', function () { setTimeout(init, 400); });
})();

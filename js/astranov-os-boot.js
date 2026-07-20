/* Astranov OS boot — tiny pure JS only (must never be HTML) */
(function astranovOsBoot() {
  if (window.__ASTRANOV_OS_BOOT__) return;
  window.__ASTRANOV_OS_BOOT__ = 1;
  var build = (document.querySelector('meta[name="astranov-build"]') || {}).content || String(Date.now());
  function load(src) {
    return new Promise(function (resolve) {
      if (document.querySelector('script[data-astranov-os="' + src + '"]')) return resolve();
      var s = document.createElement('script');
      s.src = src + (src.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(build);
      s.async = true;
      s.dataset.astranovOs = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { resolve(); };
      (document.head || document.documentElement).appendChild(s);
    });
  }
  function init() {
    try { if (window.AstranovOS) AstranovOS.init(); } catch (e) {}
    try { if (window.AstranovBrowser) AstranovBrowser.init(); } catch (e) {}
  }
  function run() {
    Promise.all([
      load('/js/08-astranov-os.js'),
      load('/js/08-astranov-browser.js'),
    ]).then(function () {
      init();
      setTimeout(init, 800);
      setTimeout(init, 2500);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();

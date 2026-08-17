/* Astranov auth — bootstrap from main until full file is on this branch */
(function (global) {
  'use strict';
  if (global.__snAuthBoot) return;
  global.__snAuthBoot = 1;
  var urls = [
    '/js/spacenet/auth.js?from=main-fallback',
    'https://cdn.jsdelivr.net/gh/notisastranov/astranov.eu@main/js/spacenet/auth.js',
    'https://raw.githubusercontent.com/notisastranov/astranov.eu/main/js/spacenet/auth.js'
  ];
  // Avoid infinite loop if this file is the local auth
  function load(i) {
    if (i >= urls.length) {
      console.error('[SNAuth] failed to load auth from main');
      return;
    }
    var u = urls[i];
    // Skip self
    if (u.indexOf('from=main-fallback') >= 0) return load(i + 1);
    fetch(u, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.text();
      })
      .then(function (code) {
        if (!code || code.indexOf('SNAuth') < 0 || code.indexOf('bootstrap from main') >= 0) throw new Error('bad body');
        var s = document.createElement('script');
        s.text = code;
        document.head.appendChild(s);
      })
      .catch(function () {
        load(i + 1);
      });
  }
  load(0);
})(typeof window !== 'undefined' ? window : globalThis);

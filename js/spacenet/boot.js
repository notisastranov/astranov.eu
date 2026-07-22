/* SpaceNet boot — hard budget: shell + three + 3 tiny modules. No phase packs. */
(function () {
  'use strict';
  const BUILD = (document.querySelector('meta[name="astranov-build"]') || {}).content || '1';
  const bootEl = document.getElementById('boot');

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Fetch first so HTML SPA fallbacks never execute as JS
      const url = src + (src.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(BUILD);
      if (/^https?:\/\//i.test(src)) {
        const s = document.createElement('script');
        s.src = url;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(src));
        document.head.appendChild(s);
        return;
      }
      fetch(url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((r) => {
          if (!r.ok) throw new Error(src + ' ' + r.status);
          const ct = (r.headers.get('content-type') || '').toLowerCase();
          return r.text().then((t) => {
            const head = t.trimStart().slice(0, 32);
            if (ct.includes('text/html') || head.startsWith('<!') || t.includes('data-dpl-id')) {
              throw new Error('HTML fallback: ' + src);
            }
            const s = document.createElement('script');
            s.text = t;
            document.head.appendChild(s);
            resolve();
          });
        })
        .catch(reject);
    });
  }

  function done(msg) {
    if (bootEl) {
      bootEl.classList.add('hide');
      setTimeout(() => bootEl.remove(), 400);
    }
    if (msg) console.info('[SpaceNet]', msg);
  }

  function fail(msg) {
    if (bootEl) {
      bootEl.innerHTML = '<div class="boot-card"><b>SPACENET</b><p>' + msg + '</p><p class="dim">Hard refresh · check network</p></div>';
    }
  }

  // Lite flag early
  try {
    if (matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0) {
      window._snLite = true;
    }
  } catch (_) {}

  const t0 = performance.now();

  loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js')
    .catch(() => loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'))
    .then(() => loadScript('/js/spacenet/globe.js'))
    .then(() => loadScript('/js/spacenet/tasks.js'))
    .then(() => loadScript('/js/spacenet/cli.js'))
    .then(() => {
      if (!window.SNGlobe?.init?.()) throw new Error('globe init failed');
      SNTasks?.seedDemo?.();
      SNCli?.init?.();
      const ms = Math.round(performance.now() - t0);
      done('ready ' + ms + 'ms');
      SNCli?.log?.('Ready in ' + ms + 'ms · type help', 'dim');
      // Optional: locate after idle so first paint stays free
      const delay = window._snLite ? 1800 : 900;
      setTimeout(() => {
        if (!window._snUserTyped) {
          /* keep silent — user starts with CLI or locate btn */
        }
      }, delay);
    })
    .catch((e) => {
      console.error(e);
      fail(String(e.message || e));
    });

  document.addEventListener(
    'keydown',
    () => {
      window._snUserTyped = true;
    },
    { once: true, passive: true }
  );
})();

/* Astranov boot — FAST shell first, globe + extras after paint (never hang) */
(function () {
  'use strict';
  var BUILD = (document.querySelector('meta[name="astranov-build"]') || {}).content || '1';
  var bootEl = document.getElementById('boot');
  var t0 = performance.now();
  var finished = false;
  var shellReady = false;

  var CDN_GH = 'https://cdn.jsdelivr.net/gh/notisastranov/astranov.eu@main';
  var loadStats = { ok: 0, fail: 0, cdn: 0 };

  function v(src) {
    if (/^https?:\/\//i.test(src)) return src;
    return src + (src.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(BUILD);
  }

  /** Absolute path without query for CDN mirror */
  function barePath(src) {
    return String(src || '').split('?')[0].replace(/^\//, '');
  }

  /**
   * Game-grade multi-origin load: same-origin first, then jsDelivr (beats GitHub 429 edge).
   * Never leave the player on a dead black screen because one origin rate-limited.
   */
  function originsFor(src) {
    if (/^https?:\/\//i.test(src)) return [src];
    var path = barePath(src);
    var local = v(src);
    var list = [];
    var base = '';
    try {
      base = String(window.SN_ASSET_BASE || '').replace(/\/$/, '');
    } catch (_) {}
    // CDN-first when shell declares asset base (stable edge)
    if (base && (path.indexOf('js/') === 0 || path.indexOf('vendor/') === 0)) {
      list.push(base + '/' + path + '?v=' + encodeURIComponent(BUILD));
    }
    list.push(local);
    if (path.indexOf('js/') === 0 || path.indexOf('vendor/') === 0) {
      list.push(CDN_GH + '/' + path + '?v=' + encodeURIComponent(BUILD));
    }
    // dedupe
    var seen = {};
    return list.filter(function (u) {
      if (seen[u]) return false;
      seen[u] = 1;
      return true;
    });
  }

  function loadUrl(url, timeoutMs, async) {
    timeoutMs = timeoutMs || 10000;
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.async = async !== false;
      s.src = url;
      s.crossOrigin = 'anonymous';
      var done = false;
      var to = setTimeout(function () {
        if (done) return;
        done = true;
        try {
          s.remove();
        } catch (e) {}
        reject(new Error('timeout ' + url));
      }, timeoutMs);
      s.onload = function () {
        if (done) return;
        done = true;
        clearTimeout(to);
        loadStats.ok++;
        if (url.indexOf('jsdelivr') >= 0) loadStats.cdn++;
        resolve(url);
      };
      s.onerror = function () {
        if (done) return;
        done = true;
        clearTimeout(to);
        try {
          s.remove();
        } catch (e2) {}
        loadStats.fail++;
        reject(new Error('load fail ' + url));
      };
      document.head.appendChild(s);
    });
  }

  function load(src, timeoutMs) {
    var urls = originsFor(src);
    var i = 0;
    function next() {
      if (i >= urls.length) return Promise.reject(new Error('all origins fail ' + src));
      var u = urls[i++];
      return loadUrl(u, timeoutMs || 10000, true).catch(function () {
        return next();
      });
    }
    return next();
  }

  function loadSoft(src, timeoutMs) {
    return load(src, timeoutMs).catch(function (e) {
      console.warn('[Astranov] soft skip', src, e && e.message);
    });
  }

  function loadParallel(list, timeoutMs) {
    return Promise.all(
      list.map(function (src) {
        return loadSoft(src, timeoutMs || 10000);
      })
    );
  }

  /** Sequential load — keep async=false order for dependency chain */
  function seq(list, timeoutMs) {
    var i = 0;
    function next() {
      if (i >= list.length) return Promise.resolve();
      var src = list[i++];
      return loadOrdered(src, timeoutMs || 9000).then(next);
    }
    return next();
  }

  function loadOrdered(src, timeoutMs) {
    var urls = originsFor(src);
    var i = 0;
    function next() {
      if (i >= urls.length) return Promise.reject(new Error('all origins fail ' + src));
      var u = urls[i++];
      // ordered: async false for dependency chain
      return loadUrl(u, timeoutMs || 9000, false).catch(function () {
        return next();
      });
    }
    return next();
  }

  function whenIdle(fn, timeout) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(function () {
        try {
          fn();
        } catch (e) {
          console.warn('[Astranov] idle', e);
        }
      }, { timeout: timeout || 2000 });
    } else {
      setTimeout(function () {
        try {
          fn();
        } catch (e) {
          console.warn('[Astranov] idle', e);
        }
      }, 80);
    }
  }

  function hideBoot(msg) {
    if (finished) return;
    finished = true;
    if (bootEl) {
      bootEl.classList.add('hide');
      bootEl.setAttribute('aria-busy', 'false');
      setTimeout(function () {
        try {
          bootEl.remove();
        } catch (e) {}
      }, 220);
    }
    if (msg) console.info('[Astranov]', msg);
  }

  function fail(msg) {
    if (finished) return;
    finished = true;
    if (bootEl) {
      bootEl.innerHTML =
        '<div class="boot-card">' +
        '<span class="boot-title">ASTRANOV</span>' +
        '<div class="boot-loader" aria-hidden="true"><span class="boot-loader-bar"></span></div>' +
        '<button type="button" class="boot-retry" id="sn-boot-retry">Retry</button>' +
        '</div>';
      var b = document.getElementById('sn-boot-retry');
      if (b)
        b.onclick = function () {
          location.reload();
        };
    }
    console.error('[Astranov] boot fail', msg);
  }

  // Hard ceiling — interactive shell must appear
  setTimeout(function () {
    if (!finished) {
      console.error('[Astranov] boot watchdog 8s');
      try {
        if (window.SNCli && SNCli.init) SNCli.init();
      } catch (e) {}
      hideBoot('watchdog · partial');
      try {
        if (window.SNCli && SNCli.log) SNCli.log('Boot slow · shell ready · type help', 'err');
      } catch (e2) {}
    }
  }, 8000);

  var isLite = false;
  try {
    isLite =
      matchMedia('(pointer:coarse)').matches ||
      navigator.maxTouchPoints > 0 ||
      (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
      (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    window._snLite = true; isLite = true;
  } catch (e) {}

  // Global performance governor
  window.SNPerf = {
    lite: true, // street-first: always prefer speed over max fidelity
    dprCap: 1,
    globeSegs: isLite ? 24 : 32,
    starN: isLite ? 160 : 320,
    radarMs: isLite ? 320 : 220,
    idleSkip: isLite ? 5 : 4,
    hudHz: isLite ? 8 : 12,
    helperAuto: false, // HELPER parked on moon; wake on order / helper cmd
    t0: t0,
    get loadStats() { return loadStats; },
    cdn: CDN_GH,
    mark: function (name) {
      try {
        performance.mark('sn:' + name);
      } catch (_) {}
    },
  };

  /**
   * WAVE 1 — critical shell only (feed usable ASAP)
   * Deferred: tile (heavy), market bulk still needed for first order
   */
  var WAVE_SHELL = [
    '/js/spacenet/skin.js',
    '/js/spacenet/game-loop.js',
    '/js/spacenet/config.js',
    '/js/spacenet/currency.js',
    '/js/spacenet/profiles.js',
    '/js/spacenet/tasks.js',
    '/js/spacenet/usage.js',
    '/js/spacenet/routing.js',
    '/js/spacenet/field.js',
    '/js/spacenet/scrolls.js',
    '/js/spacenet/home.js',
    '/js/spacenet/arcangelo-dialect.js',
    '/js/spacenet/search.js',
    '/js/spacenet/vendor-crawl.js',
    '/js/spacenet/greeklish.js',
    '/js/spacenet/order-engine.js',
    '/js/spacenet/market.js',
    '/js/spacenet/task-runner.js',
    '/js/spacenet/spartan.js',
    '/js/spacenet/free-ai.js',
    '/js/spacenet/telemachos.js',
    '/js/spacenet/cli.js',
    '/js/spacenet/ai.js',
    '/js/spacenet/ui.js',
  ];

  var WAVE_GLOBE = [
    '/js/spacenet/spacenet-grid.js',
    '/js/spacenet/globe.js',
    '/js/spacenet/cosmos.js',
  ];

  var WAVE_APP = [
    '/js/spacenet/tile.js',
    '/js/spacenet/brain.js',
    '/js/spacenet/commerce.js',
    '/js/spacenet/spatial.js',
    '/js/spacenet/market-live.js',
    '/js/spacenet/mesh-orders.js',
    '/js/spacenet/channel-manager.js',
    '/js/spacenet/task-board.js',
    '/js/spacenet/offer-stack.js',
    '/js/spacenet/super.js',
    '/js/spacenet/live-bridge.js',
    '/js/spacenet/map.js',
    '/js/spacenet/google-earth.js',
    '/js/spacenet/places-business.js',
    '/js/spacenet/ai-graphics.js',
    '/js/spacenet/helper.js',
    '/js/spacenet/topo.js',
    '/js/spacenet/mesh-peers.js',
  ];

  function initShell() {
    [
      function () {
        SNProfiles && SNProfiles.me && SNProfiles.me();
      },
      function () {
        SNField && SNField.init && SNField.init();
      },
      function () {
        SNScrolls && SNScrolls.init && SNScrolls.init();
      },
      function () {
        SNHome && SNHome.init && SNHome.init();
      },

      function () {
        SNCli && SNCli.init && SNCli.init();
      },
      function () {
        SNUi && SNUi.init && SNUi.init();
      },
    ].forEach(function (fn) {
      try {
        fn();
      } catch (e) {
        console.warn('[Astranov] shell init', e);
      }
    });
    try {
      if (window.speechSynthesis) speechSynthesis.cancel();
    } catch (e0) {}
    // Presence after paint — don't block shell
    whenIdle(function () {
      try {
        if (window.SNAi && SNAi.bootPresence) SNAi.bootPresence();
      } catch (e1) {}
    }, 1500);
  }

  function initGlobe() {
    var globeOk = false;
    try {
      if (window.SNGlobe && typeof THREE !== 'undefined') {
        globeOk = !!SNGlobe.init();
        // Already boots at GLOBAL — skip second goToTier (was double work)
      }
    } catch (e) {
      console.warn('[Astranov] globe', e);
    }
    return globeOk;
  }

  function loadThree() {
    return load(
      'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
      12000
    ).catch(function () {
      return load('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js', 12000);
    });
  }

  // Start THREE download immediately in parallel with shell (biggest win)
  var threePromise = loadThree().catch(function (e) {
    console.warn('[Astranov] THREE early', e);
  });
  window.SNPerf.mark('three_start');

  // —— START: shell first ——
  seq(WAVE_SHELL, 6000)
    .then(function () {
      initShell();
      shellReady = true;
      var ms = Math.round(performance.now() - t0);
      hideBoot('shell ' + ms + 'ms');
      window.SNPerf.mark('shell_ready');
      try {
        if (window.SNCli && SNCli.log) {
          SNCli.log(
            'ASTRANOV · shell ' +
              ms +
              'ms · ' +
              (isLite ? 'lite' : 'full') +
              ' · feed ready · Earth loading…',
            'ok'
          );
          SNCli.preview('Shell ' + ms + 'ms · talk · order · locate');
        }
        if (window.SNField && SNField.setNotice) SNField.setNotice(ms + 'ms');
      } catch (e) {}

      // WAVE 2: wait for THREE (already downloading) + globe modules
      return threePromise
        .then(function () {
          window.SNPerf.mark('three_ready');
          return seq(WAVE_GLOBE, 8000);
        })
        .then(function () {
          var ok = initGlobe();
          window.SNPerf.mark('globe_ready');
          try {
            if (window.SNCli && SNCli.log) {
              SNCli.log(
                ok
                  ? 'GLOBAL Earth · smooth path · ' +
                      Math.round(performance.now() - t0) +
                      'ms'
                  : 'Globe soft-fail · CLI still live',
                ok ? 'ok' : 'dim'
              );
              if (ok) SNCli.preview('GLOBAL Earth');
            }
          } catch (e2) {}
        })
        .catch(function (e) {
          console.warn('[Astranov] globe wave', e);
          try {
            if (window.SNCli && SNCli.log) SNCli.log('Globe delayed · keep using feed', 'dim');
          } catch (e3) {}
        });
    })
    .then(function () {
      // WAVE 3: soft modules — idle so Earth stays buttery
      return new Promise(function (resolve) {
        whenIdle(function () {
          loadParallel(WAVE_APP, 14000).then(resolve);
        }, 1200);
      });
    })
    .then(function () {
      whenIdle(function () {
        [
          function () {
            SNTile && SNTile.init && SNTile.init();
          },
          function () {
            SNOfferStack && SNOfferStack.init && SNOfferStack.init();
          },
          function () {
            SNSpatial && SNSpatial.init && SNSpatial.init();
          },
          function () {
            SNMap && SNMap.init && SNMap.init();
          },
          function () {
            if (window.SNAIGraphics && SNAIGraphics.init) {
              // Prefer balanced/lite on constrained devices
              try {
                if (isLite && SNAIGraphics.setMode) SNAIGraphics.setMode('lite');
                else if (SNAIGraphics.setMode) {
                  // Auto Imagine version (AI sprites / Grok Imagine path)
                  try {
                    var locked = localStorage.getItem('sn:ai-gfx-mode-v1');
                    if (!locked || locked === 'balanced' || locked === 'supreme')
                      SNAIGraphics.setMode('imagine');
                    else SNAIGraphics.setMode(locked);
                  } catch (_im) {
                    SNAIGraphics.setMode('imagine');
                  }
                }
              } catch (_) {}
              SNAIGraphics.init();
            }
          },
          function () {
            // HELPER on demand only — continuous RAF was sticky
            if (window.SNHelper && SNHelper.init) SNHelper.init({ autoWake: false });
          },
          function () {
            SNLiveBridge && SNLiveBridge.start && SNLiveBridge.start();
          },
          function () {
            // Grok Build mesh-ops layer — additive peers/routes (never blocks juice)
            if (window.SNMeshPeers && SNMeshPeers.init) SNMeshPeers.init();
          },
        ].forEach(function (fn) {
          try {
            fn();
          } catch (e) {
            console.warn('[Astranov] app init', e);
          }
        });
        try {
          if (window.SNMap && SNMap.active && SNMap.close) SNMap.close();
        } catch (e3) {}
        var total = Math.round(performance.now() - t0);
        window.SNPerf.bootMs = total;
        try {
          if (window.SNCli && SNCli.log) {
            SNCli.log(
              'Smooth boot · ' +
                total +
                'ms · ' +
                (isLite ? 'lite device' : 'desktop') +
                ' · type: test ready · order pizza',
              'dim'
            );
          }
        } catch (e4) {}

        // Auth soft (not on critical path)
        setTimeout(function () {
          loadSoft(
            'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
            12000
          )
            .then(function () {
              return loadSoft('/js/spacenet/auth.js', 8000);
            })
            .then(function () {
              try {
                if (window.SNAuth && SNAuth.init) SNAuth.init();
              } catch (e) {}
            });
        }, isLite ? 2800 : 1500);

        // Shop warm only when idle + delayed — never freeze Earth
        setTimeout(function () {
          try {
            if (document.hidden) return;
            var p = window._snLastPos || window._snPhysPos;
            if (!p || p.lat == null) return;
            if (window.SNCommerce && SNCommerce.populateMap) {
              SNCommerce.populateMap(p.lat, p.lng, { openMap: false }).catch(function () {});
            }
          } catch (e) {}
        }, isLite ? 8000 : 5000);
      }, 800);
    })
    .catch(function (e) {
      console.error('[Astranov] boot', e);
      if (!shellReady) {
        loadSoft('/js/spacenet/cli.js', 8000).then(function () {
          try {
            if (window.SNCli && SNCli.init) SNCli.init();
          } catch (e2) {}
          hideBoot('degraded');
          try {
            if (window.SNCli && SNCli.log)
              SNCli.log('Degraded · ' + (e && e.message), 'err');
          } catch (e3) {}
        });
      } else {
        hideBoot('partial');
      }
      setTimeout(function () {
        if (!finished) fail(e && e.message ? e.message : e);
      }, 1500);
    });
})();

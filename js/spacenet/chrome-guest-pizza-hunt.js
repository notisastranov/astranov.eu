/**
 * Guest pizza hunt — Build 20260822083000
 * From #126 twin-CLI force-paint branch. Hardened vs Google wall + Rhodes street.
 *
 * Guest `order me a pizza` / pizza:
 *   - hunts public.vendors bbox (delivery_enabled) as pins ON THE LIVE 3D GLOBE
 *   - short CLI list name·km·⭐
 *   - NEVER open #sn-auth-modal / SNAuth.open / openModal for pizza
 *   - no Locate required; hunt from camera / last pin / current focus
 *   - never demo Rhodes look-at / Earth.CITY.Rhodes auto street
 *   - Google GIS only on explicit PAY / HOLD ⭐
 *   - Zero new public.orders until pay
 *   - no Astranov Kitchen · no 85-pt · no Mesh Alpha · no me-av
 *   - twin CLIs stay · camera soft only
 */
(function (G) {
  'use strict';
  if (G.__snGuestPizzaHunt0830) return;
  G.__snGuestPizzaHunt0830 = 1;
  var BUILD = '20260822083000-guest-pizza-globe';
  var hunting = false;
  var lastPins = [];

  var FOOD = /restaurant|fast_food|cafe|bar|pub|food|pizza|pizzeria|bakery|taverna|grill|souvlaki|kebab|burger|sushi|kitchen|deli|ice_cream|dessert|market/i;
  var PIZZA_RE =
    /\b(order\s+(me\s+)?(a\s+)?pizza|pizza\s*(please|order|near|nearby|delivery)?|get\s+(me\s+)?pizza|i\s+want\s+(a\s+)?pizza|find\s+pizza|pizza\s+shops?|hungry\s+for\s+pizza)\b/i;
  var ORDER_FOOD_RE =
    /\b(order\s+(me\s+)?(a\s+)?(food|meal|burger|souvlaki|kebab|sushi)|food\s+delivery|deliver\s+(me\s+)?(food|pizza))\b/i;

  function log(m, c) {
    try {
      if (G.SNCli && SNCli.log) SNCli.log(String(m).slice(0, 420), c || 'ok', true);
    } catch (_) {}
  }
  function preview(m) {
    try {
      if (G.SNCli && SNCli.preview) SNCli.preview(String(m).slice(0, 90));
    } catch (_) {}
  }
  function isGuest() {
    try {
      if (G.SNAuth && typeof SNAuth.isLoggedIn === 'function' && SNAuth.isLoggedIn()) return false;
      if (G.SNAuth && SNAuth.session && SNAuth.session.user) return false;
      if (G.SNAuth && SNAuth.user) return false;
    } catch (_) {}
    return true;
  }
  function snDebug() {
    try {
      return /(?:\?|&)sn-debug=1(?:&|$)/.test(String(location.search || ''));
    } catch (_) {
      return false;
    }
  }
  function posNow() {
    try {
      if (G._snLastPos && G._snLastPos.lat != null) return G._snLastPos;
    } catch (_) {}
    try {
      if (G.SNTasks && SNTasks.pos && SNTasks.pos.lat != null) return SNTasks.pos;
    } catch (_) {}
    try {
      if (G.SNGlobe && typeof SNGlobe.focusPos === 'function') {
        var fp = SNGlobe.focusPos();
        if (fp && fp.lat != null) return fp;
      }
    } catch (_) {}
    return { lat: 36.5, lng: 28.0, soft: true };
  }
  function baseUrl() {
    return String((G.SN_CONFIG && SN_CONFIG.sbUrl) || G.SB_URL || '').replace(/\/$/, '');
  }
  function headers() {
    var cfg = G.SN_CONFIG || {};
    var h = {
      apikey: cfg.sbKey || G.SB_KEY || '',
      Authorization: 'Bearer ' + (cfg.sbKey || G.SB_KEY || ''),
      Accept: 'application/json',
    };
    try {
      if (G.SNAuth && SNAuth.session && SNAuth.session.access_token)
        h.Authorization = 'Bearer ' + SNAuth.session.access_token;
    } catch (_) {}
    return h;
  }
  function haversineKm(a, b) {
    var R = 6371;
    var dLat = ((b.lat - a.lat) * Math.PI) / 180;
    var dLng = ((b.lng - a.lng) * Math.PI) / 180;
    var s =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }
  function isBannedName(name) {
    var n = String(name || '');
    if (/Astranov\s*Kitchen/i.test(n)) return true;
    if (/Mesh\s*Alpha|Mesh\s*Beta|Mesh\s*Gamma/i.test(n)) return true;
    if (/Rai\s*Mesone|Rai\s*drone/i.test(n)) return true;
    if (/85[\s\-]?pt|DRIVER\s+EN\s+ROUTE/i.test(n)) return true;
    if (/me-av|Kitchen\s*85/i.test(n)) return true;
    return false;
  }
  function isFoodOrShop(v) {
    if (!v) return false;
    if (isBannedName(v.name)) return false;
    if (String(v.id || '').indexOf('demo-') === 0 || String(v.id || '').indexOf('kitchen_') === 0)
      return false;
    var blob =
      String(v.category || '') +
      ' ' +
      String(v.shopKind || '') +
      ' ' +
      String(v.kind || '') +
      ' ' +
      String(v.name || '') +
      ' ' +
      (Array.isArray(v.tags) ? v.tags.join(' ') : String(v.tags || ''));
    return FOOD.test(blob) || v.delivery_enabled === true;
  }

  function blockAuthModalOnPizza() {
    try {
      var modal = document.getElementById('sn-auth-modal');
      if (modal) {
        modal.style.setProperty('display', 'none', 'important');
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('open', 'show', 'sn-open');
      }
    } catch (_) {}
    try {
      if (G.SNAuth && typeof SNAuth.openModal === 'function' && !SNAuth.__snPizzaGuard0830) {
        var prev = SNAuth.openModal.bind(SNAuth);
        SNAuth.openModal = function (msg) {
          var m = String(msg || '');
          if (
            isGuest() &&
            !snDebug() &&
            !/pay|HOLD\s*\u2b50|hold\s*star|checkout|wallet|balance|to\s+call/i.test(m)
          ) {
            log('Browse free · Google only at pay / HOLD \u2b50', 'dim');
            return;
          }
          return prev(msg);
        };
        SNAuth.__snPizzaGuard0830 = true;
      }
    } catch (_) {}
  }

  function killStreetAndRhodes() {
    try {
      if (G.SNMap && SNMap.active && typeof SNMap.close === 'function') SNMap.close();
    } catch (_) {}
    try {
      if (G.SNMap && typeof SNMap.hide === 'function') SNMap.hide();
    } catch (_) {}
  }

  function stayPutSoft(nearest) {
    killStreetAndRhodes();
    if (!nearest || nearest.lat == null || nearest.lng == null) return;
    try {
      if (G.SNGlobe && typeof SNGlobe.pulse === 'function') {
        SNGlobe.pulse(nearest.lat, nearest.lng, 0x5ad4ff, nearest.name || 'shop', 7000);
      }
    } catch (_) {}
  }

  function paintPins(rows, origin) {
    lastPins = [];
    if (!rows || !rows.length) return;
    rows.slice(0, 24).forEach(function (v, i) {
      if (!v || v.lat == null || v.lng == null) return;
      var km = origin ? haversineKm(origin, { lat: +v.lat, lng: +v.lng }) : null;
      lastPins.push({
        id: v.id,
        name: v.name,
        lat: +v.lat,
        lng: +v.lng,
        km: km,
        emoji: v.emoji || '\ud83c\udf55',
      });
      try {
        if (G.SNGlobe && typeof SNGlobe.pulse === 'function') {
          SNGlobe.pulse(+v.lat, +v.lng, i === 0 ? 0xff9f43 : 0x5ad4ff, String(v.name || 'shop').slice(0, 28), 9000);
        }
      } catch (_) {}
      try {
        if (G.SNSpaceLinks && typeof SNSpaceLinks.addFieldPin === 'function') {
          SNSpaceLinks.addFieldPin(+v.lat, +v.lng, {
            label: String(v.name || 'shop').slice(0, 24),
            kind: 'vendor',
            color: i === 0 ? 0xff9f43 : 0x5ad4ff,
          });
        }
      } catch (_) {}
    });
  }

  async function queryVendorsBbox(lat, lng, radiusKm) {
    var urlBase = baseUrl();
    if (!urlBase) return [];
    lat = Number(lat);
    lng = Number(lng);
    var rKm = Number(radiusKm) > 0 ? Number(radiusKm) : 16;
    var dLat = rKm / 111;
    var dLng = rKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    var q =
      urlBase +
      '/rest/v1/vendors?select=id,osm_id,name,emoji,lat,lng,category,items,tags,is_active,delivery_enabled' +
      '&is_active=eq.true&delivery_enabled=eq.true' +
      '&lat=gte.' +
      (lat - dLat) +
      '&lat=lte.' +
      (lat + dLat) +
      '&lng=gte.' +
      (lng - dLng) +
      '&lng=lte.' +
      (lng + dLng) +
      '&limit=80';
    var res = await fetch(q, { headers: headers(), cache: 'no-store' });
    if (!res.ok) throw new Error('vendors HTTP ' + res.status);
    var rows = await res.json();
    if (!Array.isArray(rows)) rows = [];
    return rows.filter(isFoodOrShop).map(function (v) {
      return Object.assign({}, v, { real: true, source: 'supabase', delivery_enabled: true });
    });
  }

  function listInCli(rows, origin) {
    if (!rows || !rows.length) {
      log('No delivery shops in bbox yet · move globe or try near a town', 'dim');
      return;
    }
    var scored = rows
      .map(function (v) {
        var km = origin ? haversineKm(origin, { lat: +v.lat, lng: +v.lng }) : 99;
        return { v: v, km: km };
      })
      .sort(function (a, b) {
        return a.km - b.km;
      })
      .slice(0, 10);
    log('Pizza hunt · ' + scored.length + ' shops · public.vendors · browse free', 'ok');
    scored.forEach(function (s, i) {
      var name = String(s.v.name || 'shop').slice(0, 32);
      var kmS = s.km < 99 ? s.km.toFixed(1) + 'km' : '\u2014';
      log((i + 1) + ' \u00b7 ' + name + ' \u00b7 ' + kmS + ' \u00b7 \u2b50', 'ok');
    });
    log('Tap a pin or type shop name · Google only at pay / HOLD \u2b50', 'dim');
    preview(scored[0].v.name + ' \u00b7 ' + scored[0].km.toFixed(1) + 'km \u00b7 \u2b50');
  }

  async function huntPizza(raw) {
    if (hunting) return true;
    hunting = true;
    blockAuthModalOnPizza();
    killStreetAndRhodes();
    try {
      if (G.SNChromeCliAnswer && SNChromeCliAnswer.forcePaint) SNChromeCliAnswer.forcePaint();
    } catch (_) {}
    try {
      var a = document.getElementById('cli-in');
      if (a) a.value = '';
      var b = document.getElementById('stc-cmd-in');
      if (b) b.value = '';
    } catch (_) {}
    try {
      var cta = document.getElementById('sn-guest-cta');
      if (cta) cta.remove();
    } catch (_) {}

    log(String(raw || 'pizza').slice(0, 80), 'cmd');
    var origin = posNow();
    var rows = [];
    try {
      rows = await queryVendorsBbox(origin.lat, origin.lng, 16);
    } catch (e) {
      log('Vendors bbox · ' + (e && e.message ? e.message : e), 'dim');
    }

    var pizzaish = rows.filter(function (v) {
      return /pizza|pizzeria|italiano|makkaroni|margherita/i.test(String(v.name || '') + ' ' + String(v.category || ''));
    });
    var use = pizzaish.length ? pizzaish.concat(rows.filter(function (v) { return pizzaish.indexOf(v) < 0; })) : rows;

    paintPins(use, origin);
    listInCli(use, origin);

    var nearest = use
      .map(function (v) {
        return { lat: +v.lat, lng: +v.lng, name: v.name, km: haversineKm(origin, { lat: +v.lat, lng: +v.lng }) };
      })
      .sort(function (a, b) {
        return a.km - b.km;
      })[0];
    stayPutSoft(nearest);

    if (isGuest()) {
      log('Guest browse · sign in only when you HOLD \u2b50 / pay', 'dim');
    }
    hunting = false;
    try {
      if (G.SNChromeCliAnswer && SNChromeCliAnswer.forcePaint) SNChromeCliAnswer.forcePaint();
    } catch (_) {}
    blockAuthModalOnPizza();
    return true;
  }

  function isPizzaLine(line) {
    var s = String(line || '').trim();
    if (!s) return false;
    if (PIZZA_RE.test(s)) return true;
    if (ORDER_FOOD_RE.test(s) && /pizza|food|meal/i.test(s)) return true;
    if (/^pizza\b/i.test(s)) return true;
    return false;
  }

  function isPayHold(line) {
    var s = String(line || '').trim().toLowerCase();
    return /^(pay|hold\s*\u2b50|hold\s*star|checkout|confirm\s+order|buy\s+now)\b/.test(s);
  }

  function install() {
    blockAuthModalOnPizza();
    if (!G.SNCli || typeof SNCli.run !== 'function') return;
    if (SNCli.__snGuestPizzaHunt0830) return;
    SNCli.__snGuestPizzaHunt0830 = 1;
    var prev = SNCli.run.bind(SNCli);
    SNCli.run = function (raw) {
      try {
        var s = String(raw || '').trim();
        if (isPizzaLine(s)) {
          void huntPizza(s);
          return Promise.resolve(true);
        }
        if (isGuest() && isPayHold(s)) {
          try {
            if (G.SNAuth && typeof SNAuth.openModal === 'function') {
              SNAuth.openModal('Sign in with Google to HOLD \u2b50 / pay');
            }
          } catch (_) {}
          log('HOLD \u2b50 · Sign in with Google to pay', 'ok');
          return Promise.resolve(true);
        }
      } catch (_) {}
      return prev(raw);
    };

    try {
      var form = document.getElementById('cli-form') || document.querySelector('#panel form');
      var input = document.getElementById('cli-in');
      var topIn = document.getElementById('stc-cmd-in');
      function capture(ev, el) {
        var v = String((el && el.value) || '').trim();
        if (!v || !isPizzaLine(v)) return false;
        try {
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        } catch (_) {}
        if (el) el.value = '';
        void huntPizza(v);
        return true;
      }
      if (form && input && !input._snPizzaHunt0830) {
        input._snPizzaHunt0830 = 1;
        form.addEventListener('submit', function (ev) { capture(ev, input); }, true);
        input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') capture(ev, input); }, true);
      }
      if (topIn && !topIn._snPizzaHunt0830) {
        topIn._snPizzaHunt0830 = 1;
        topIn.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') capture(ev, topIn); }, true);
      }
    } catch (_) {}

    try {
      if (G.SNMarket && typeof SNMarket.fulfillFoodIntent === 'function' && !SNMarket._snPizzaHunt0830) {
        var ful = SNMarket.fulfillFoodIntent.bind(SNMarket);
        SNMarket.fulfillFoodIntent = async function (q, opts) {
          var line = String(q || (opts && opts.text) || '');
          if (isGuest() && !snDebug() && (isPizzaLine(line) || /pizza|food|meal/i.test(line))) {
            await huntPizza(line || 'order me a pizza');
            return { ok: true, guest_browse: true, reply: 'Shops on globe · Google only at pay / HOLD \u2b50' };
          }
          return ful(q, opts);
        };
        SNMarket._snPizzaHunt0830 = true;
      }
    } catch (_) {}
  }

  function boot() {
    install();
    blockAuthModalOnPizza();
    killStreetAndRhodes();
  }

  boot();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 0);
  setTimeout(boot, 600);
  setTimeout(boot, 1800);
  setTimeout(boot, 4000);
  setInterval(function () {
    install();
    blockAuthModalOnPizza();
  }, 8000);

  G.SNChromeGuestPizzaHunt = {
    build: BUILD,
    hunt: huntPizza,
    queryVendorsBbox: queryVendorsBbox,
    lastPins: function () {
      return lastPins.slice();
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

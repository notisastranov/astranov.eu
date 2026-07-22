/* SpaceNet city map — Leaflet lazy; profile tiles + tasks + crawl pins */
(function (global) {
  'use strict';

  const M = {
    map: null,
    active: false,
    markers: [],
    profileMarkers: [],
  };

  function loadCss(href) {
    if (document.querySelector('link[data-sn-map]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    l.dataset.snMap = '1';
    document.head.appendChild(l);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (typeof L !== 'undefined') return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('leaflet'));
      document.head.appendChild(s);
    });
  }

  async function ensure() {
    if (M.map) return M.map;
    loadCss('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
    await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
    const el = document.getElementById('city-map');
    if (!el || typeof L === 'undefined') throw new Error('map container');
    const pos = global.SNTasks?.pos || global._snLastPos || { lat: 36.4341, lng: 28.2176 };
    M.map = L.map(el, {
      zoomControl: true,
      attributionControl: false,
    }).setView([pos.lat, pos.lng], 14);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(M.map);
    return M.map;
  }

  function clearGroup(arr) {
    arr.forEach((m) => {
      try {
        M.map.removeLayer(m);
      } catch (_) {}
    });
    arr.length = 0;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function avatarIcon(url, color) {
    const c = color || '#3d9eff';
    const u = url || '';
    return L.divIcon({
      className: 'sn-pin',
      html:
        '<div class="sn-pin-inner" style="border-color:' +
        c +
        ';box-shadow:0 0 12px ' +
        c +
        '66">' +
        (u ? '<img src="' + escapeHtml(u) + '" alt="" />' : '<span>·</span>') +
        '</div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  }

  function showTasks() {
    if (!M.map) return;
    clearGroup(M.markers);
    const tasks = global.SNTasks?.list?.() || [];
    tasks.forEach((t) => {
      if (t.lat == null) return;
      const color = (global.SNTasks?.KINDS?.[t.kind] || {}).color;
      const hex =
        typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : '#6dffb0';
      const m = L.circleMarker([t.lat, t.lng], {
        radius: 7,
        color: hex,
        fillColor: hex,
        fillOpacity: 0.85,
        weight: 1,
      })
        .addTo(M.map)
        .bindPopup(
          '<b>' +
            escapeHtml(t.title) +
            '</b><br/>' +
            t.kind +
            ' · ' +
            t.dur +
            '<br/><button type="button" class="sn-pop-btn" data-task="' +
            escapeHtml(t.id) +
            '">Claim</button>'
        );
      m.on('popupopen', () => {
        document.querySelectorAll('[data-task="' + t.id + '"]').forEach((btn) => {
          btn.onclick = () => {
            const r = global.SNTasks?.claim?.(t.id);
            if (r?.ok) global.SNCli?.log?.('Claimed · ' + r.task.title, 'ok');
          };
        });
      });
      M.markers.push(m);
    });
  }

  function showProfiles() {
    if (!M.map) return;
    clearGroup(M.profileMarkers);
    const Prof = global.SNProfiles;
    if (!Prof) return;
    const list = Prof.list() || [];
    list.forEach((p) => {
      if (p.lat == null || p.lng == null) return;
      const color = Prof.pinColor(p);
      const m = L.marker([p.lat, p.lng], {
        icon: avatarIcon(p.avatar, color),
        title: p.name,
      }).addTo(M.map);
      m.on('click', () => {
        global.SNTile?.open?.(p);
      });
      M.profileMarkers.push(m);
    });
  }

  async function open(lat, lng) {
    const map = await ensure();
    const p = {
      lat: lat != null ? lat : global.SNTasks?.pos?.lat || 36.43,
      lng: lng != null ? lng : global.SNTasks?.pos?.lng || 28.22,
    };
    const wrap = document.getElementById('city-map');
    const globe = document.getElementById('globe');
    if (wrap) {
      wrap.classList.add('active');
      wrap.setAttribute('aria-hidden', 'false');
    }
    if (globe) globe.classList.add('city-hidden');
    document.body.classList.add('city-map-on');
    M.active = true;
    map.setView([p.lat, p.lng], 14);
    setTimeout(() => map.invalidateSize(), 80);

    // Seed city profiles once per area
    try {
      global.SNProfiles?.seedCity?.(p.lat, p.lng);
    } catch (_) {}

    showTasks();
    showProfiles();

    if (!M._me) {
      M._me = L.circleMarker([p.lat, p.lng], {
        radius: 7,
        color: '#ffffff',
        fillColor: '#3d9eff',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map);
      M._me.on('click', () => global.SNTile?.openMe?.());
    } else {
      M._me.setLatLng([p.lat, p.lng]);
    }

    global.SNCli?.log?.('City map · profile tiles · tap pin for menu/date/driver', 'ok');
    global.SNCli?.preview?.('City · tap tiles · + for your profile');
    return true;
  }

  function close() {
    const wrap = document.getElementById('city-map');
    const globe = document.getElementById('globe');
    if (wrap) {
      wrap.classList.remove('active');
      wrap.setAttribute('aria-hidden', 'true');
    }
    if (globe) globe.classList.remove('city-hidden');
    document.body.classList.remove('city-map-on');
    M.active = false;
    global.SNTile?.close?.();
    global.SNCli?.preview?.('Earth · type a command');
  }

  function toggle() {
    if (M.active) close();
    else return open();
  }

  function plotCrawl(places) {
    if (!places?.length) return;
    const Prof = global.SNProfiles;
    const pos = global.SNTasks?.pos || global._snLastPos;
    places.forEach((pl) => {
      if (Prof?.fromCrawlPlace) {
        Prof.fromCrawlPlace(pl, pos);
      }
    });
    if (M.map) {
      showProfiles();
      // also light markers for raw places without profiles
      places.forEach((p) => {
        if (p.lat == null || p.lng == null) return;
        const m = L.circleMarker([p.lat, p.lng], {
          radius: 6,
          color: '#ffcc66',
          fillColor: '#ffaa33',
          fillOpacity: 0.75,
          weight: 1,
        })
          .addTo(M.map)
          .on('click', () => {
            const id =
              'poi_' +
              String(p.name || 'x')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .slice(0, 24);
            const prof = Prof?.get?.(id) || Prof?.fromCrawlPlace?.(p, pos);
            if (prof) global.SNTile?.open?.(prof);
          });
        M.markers.push(m);
      });
    }
  }

  function init() {
    document.getElementById('btn-city')?.addEventListener('click', () => {
      void toggle().catch((e) => global.SNCli?.log?.(String(e.message || e), 'err'));
    });
    document.getElementById('btn-city-close')?.addEventListener('click', () => {
      close();
      try {
        global.SNGlobe?.goToTier?.('global');
      } catch (_) {}
    });
  }

  global.SNMap = {
    init,
    open,
    close,
    toggle,
    showTasks,
    showProfiles,
    plotCrawl,
    ensure,
    get active() {
      return M.active;
    },
  };
})(window);

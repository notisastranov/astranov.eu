/* SpaceNet city map — Leaflet lazy; only when user opens city */
(function (global) {
  'use strict';

  const M = {
    map: null,
    active: false,
    markers: [],
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

  function showTasks() {
    if (!M.map) return;
    M.markers.forEach((m) => {
      try {
        M.map.removeLayer(m);
      } catch (_) {}
    });
    M.markers = [];
    const tasks = global.SNTasks?.list?.() || [];
    tasks.forEach((t) => {
      if (t.lat == null) return;
      const color = (global.SNTasks?.KINDS?.[t.kind] || {}).color;
      const hex =
        typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : '#6dffb0';
      const m = L.circleMarker([t.lat, t.lng], {
        radius: 8,
        color: hex,
        fillColor: hex,
        fillOpacity: 0.85,
        weight: 1,
      })
        .addTo(M.map)
        .bindPopup('<b>' + escapeHtml(t.title) + '</b><br/>' + t.kind + ' · ' + t.dur);
      M.markers.push(m);
    });
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
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
    showTasks();
    // Drop user pin
    if (!M._me) {
      M._me = L.circleMarker([p.lat, p.lng], {
        radius: 7,
        color: '#3d9eff',
        fillColor: '#3d9eff',
        fillOpacity: 1,
      }).addTo(map);
    } else {
      M._me.setLatLng([p.lat, p.lng]);
    }
    global.SNCli?.log?.('City map · street tier · tasks marked', 'ok');
    global.SNCli?.preview?.('City map · tap markers · type task list');
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
    global.SNCli?.preview?.('Earth · type a command');
  }

  function toggle() {
    if (M.active) close();
    else return open();
  }

  function init() {
    document.getElementById('btn-city')?.addEventListener('click', () => {
      void toggle().catch((e) => global.SNCli?.log?.(String(e.message || e), 'err'));
    });
    document.getElementById('btn-city-close')?.addEventListener('click', close);
  }

  global.SNMap = {
    init,
    open,
    close,
    toggle,
    showTasks,
    ensure,
    get active() {
      return M.active;
    },
  };
})(window);

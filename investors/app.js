/* investors.astranov.eu · 20260823211000-raise */
(function () {
  'use strict';
  var OWNER = 'notisastranov@gmail.com';
  var SB_URL = 'https://lkoatrkhuigdolnjsbie.supabase.co';
  var SB_KEY = '';
  fetch('/api/public-config').then(function(r){return r.json();}).then(function(j){ if(j&&j.anon) SB_KEY=j.anon; if(j&&j.sb) SB_URL=j.sb; });
  var deck = { packages: [], model: { ops: 40, owner: 30, village: 30 }, disclaimer: '', gathered_keur: 0 };
  var tab = 'phase1';
  var owner = false;
  var sb = null;
  var session = null;
  var slide = 0;
  var openId = null;
  var liveImgs = {};

  var META = {
    motorhouses: {
      folder: 'kallithea', pin: 'kallithea', lat: 36.387557, lng: 28.222533,
      status: 'Topo study · investor preview · not built',
      state: 'Designed. GPS is the real Kallithea HQ. Houses are not on the ground.',
      blurb: 'Glass motor-houses: low glass pavilions on a motorized chassis, solar roof, stone pads in the olive terraces. Movable — not poured villas.',
      images: ['00-topo.svg','01.jpg','02.jpg','03.jpg','04.jpg','05.jpg','06.jpg','07.jpg','08.jpg','09.jpg','10.jpg','11.jpg','12.jpg','13.jpg']
    },
    'kallithea-commons': {
      folder: 'kallithea', pin: 'kallithea', lat: 36.387557, lng: 28.222533,
      status: 'Phase 1 landscape · not built',
      state: 'Pads, microgrid and a small water garden. The 1.1 km lake is not this package.',
      blurb: 'First works around the Kallithea HQ pin so the motor-houses have power, water and paths.',
      images: ['00-topo.svg','01.jpg','09.jpg','13.jpg']
    },
    lake: {
      folder: 'kallithea', pin: 'kallithea', lat: 36.387557, lng: 28.222533,
      status: 'Optional · EIA required · not in Phase 1',
      state: 'Design study only. Not permitted. Not funded.',
      blurb: 'Designed reservoir from the SNVillage topographic study: ~1.1 × 0.75 km, five islets.',
      images: ['00-topo.svg','01.jpg','09.jpg']
    },
    'koskinou-bar': {
      folder: 'koskinou', pin: 'koskinou', lat: 36.3871, lng: 28.2131,
      status: 'Investor preview · not built',
      state: 'Concept tavern on the real Koskinou junction. Not operating.',
      blurb: 'Open kitchen wood-oven bar on the triangular junction in historic Koskinou.',
      images: ['00.jpg','01.jpg','02.jpg','03.jpg','04.jpg','05.jpg','06.jpg','07.jpg']
    },
    bodega: {
      folder: 'bodega', pin: 'bodega', lat: 36.3513, lng: 28.0328,
      status: 'Investor preview · not built',
      state: 'Concept in Fanes. Not operating.',
      blurb: 'Ground-floor wood-oven kitchen bar and cellar in Fanes, Village of Colors.',
      images: ['00.jpg','01.jpg','02.jpg','03.jpg','04.jpg','05.jpg','06.jpg']
    },
    'house-art': {
      folder: 'house-art', pin: 'house-art', lat: 36.3882, lng: 28.2118,
      status: 'Investor preview · not built',
      state: 'Koskinou house restore. Not built / not operating.',
      blurb: 'Three-storey village house: tavern, wood oven, rooftop pergola.',
      images: ['00.jpg','01.jpg','02.jpg','03.jpg','04.jpg','05.jpg']
    },
    'fanes-restore': {
      folder: 'fanes', pin: 'fanes', lat: 36.3496, lng: 28.0264,
      status: 'Village restoration · not started',
      state: 'Fanes is a living village with empty stock. Restoration not begun.',
      blurb: 'Twelve houses + commons. Owners keep title. 40/30/30 operating split.',
      images: ['00.jpg','00-model.jpg','01.jpg','02.jpg','03.jpg','04.jpg','05.jpg']
    },
    'koskinou-restore': {
      folder: 'koskinou', pin: 'koskinou', lat: 36.3871, lng: 28.2131,
      status: 'Village restoration · not started',
      state: 'Working village. Empty houses not yet restored.',
      blurb: 'Ten houses + painted lanes. Restore, do not replace Koskinou.',
      images: ['00.jpg','01.jpg','02.jpg','03.jpg','04.jpg','05.jpg']
    },
    'kallithea-restore': {
      folder: 'kallithea', pin: 'kallithea', lat: 36.387557, lng: 28.222533,
      status: 'Village restoration · not started',
      state: 'Existing settlement fabric. Separate from the glass motor-houses.',
      blurb: 'Ten houses restored as eco-stays. Owners keep title.',
      images: ['01.jpg','12.jpg','13.jpg','04.jpg']
    },
    lofts: {
      folder: 'lofts', pin: 'lofts', lat: 36.3785, lng: 28.236,
      status: 'Investor preview · not built',
      state: 'Kallithea coast live-work. Not built.',
      blurb: 'Fourteen live-work lofts, commons kitchen and gym. Not a hotel.',
      images: ['00.jpg','01.jpg','02.jpg','03.jpg','04.jpg','05.jpg','06.jpg']
    },
    villa: {
      folder: 'villa', pin: 'villa', lat: 36.3845, lng: 28.2195,
      status: 'Investor preview · plot reserved',
      state: 'Single house concept on a Kallithea plot. Not built.',
      blurb: 'Three-storey rose-stone villa, loop drive, fountain, wood-fired kitchen.',
      images: ['00.jpg','01.jpg','02.jpg','03.jpg','04.jpg','05.jpg']
    },
    yachtclub: {
      folder: 'sitia', pin: 'sitia', lat: 35.202, lng: 26.115,
      status: 'Investor preview · not built',
      state: 'Petras coastal-road concept. Not operating.',
      blurb: 'Taverna and yacht club plus seaview lofts. Yacht guests via Sitia Port.',
      images: ['00.jpg','01.jpg','02.jpg','03.jpg','04.jpg','05.jpg','06.jpg']
    },
    'rousa-restore': {
      folder: 'rousa', pin: 'rousa', lat: 35.17816, lng: 26.14599,
      status: 'Real village · family ground · restore not started',
      state: 'Roussa Ekklisia exists. Mano’s village. We restore empty stock; we do not invent a resort.',
      blurb: 'Twelve houses + square + water. Pin is the real settlement.',
      images: ['00.jpg','01.jpg']
    },
    'lagokefalo-restore': {
      folder: 'lagokefalo', pin: 'lagokefalo', lat: 35.171, lng: 26.138,
      status: 'District siting · not a deed',
      state: 'Kato Lagokefalo next to Rousa. Pin is the district, not a cadastral plot.',
      blurb: 'Six rural houses on olive terraces.',
      images: ['00.jpg','01.jpg']
    },
    'agia-restore': {
      folder: 'agia-fotia', pin: 'agia-fotia', lat: 35.192, lng: 26.161,
      status: 'Plot pin · not on the beach',
      state: 'Inland eco-stays behind the coves. No beach hotel. Not built.',
      blurb: 'Four stays east of Sitia on the Vai road.',
      images: ['00.jpg','01.jpg']
    },
    trypitos: {
      folder: 'trypitos', pin: 'trypitos', lat: 35.1986, lng: 26.1297,
      status: 'Hellenistic site protected · €0 on the ruins',
      state: 'Study only. We do not build on the excavation.',
      blurb: 'Trypitos headland 3 km east of Sitia. Nearby plot only if heritage allows.',
      images: ['00.jpg','01.jpg']
    },
    yacht: {
      folder: 'yacht', pin: 'yacht', lat: 36.4507, lng: 28.2278,
      status: 'Hybrid concept · not built',
      state: 'Mandraki is a real harbour. The yacht is not built. OPEX not in CAPEX.',
      blurb: 'Classic superyacht look. Flexible PV film on hull and decks. Huge forward sundeck.',
      images: ['00.jpg','01.jpg','02.jpg','03.jpg','04.jpg','05.jpg','06.jpg','07.jpg','08.jpg','09.jpg','10.jpg','11.jpg','12.jpg']
    },
    brothers: {
      folder: 'brothers', pin: 'brothers', lat: 36.27433, lng: 27.69921,
      status: 'Concept siting · not built · not permitted',
      state: 'Not in Phase 1. Requires environmental permit.',
      blurb: 'Modest 20-berth pontoon in an undeveloped Dodecanese natural harbour (Alimia candidate).',
      images: ['00.jpg','01.jpg','02.jpg','03.jpg','04.jpg','05.jpg']
    }
  };

  function snTell(msg) {
    try {
      var f = document.getElementById('sn-back');
      if (f && f.contentWindow)
        f.contentWindow.postMessage(Object.assign({ sn: 'presence' }, msg), 'https://astranov.eu');
    } catch (_) {}
  }

  function renderCards() {
    var host = document.getElementById('pcards');
    if (!host) return;
    host.innerHTML = '';
    Object.keys(META).forEach(function (id) {
      var m = META[id];
      var p = byId(id);
      if (!m.lat) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pcard';
      var photo = absMedia((p && p.photo) || '/media/projects/' + m.folder + '/' + (m.images[0] || '00.jpg'));
      b.innerHTML =
        '<img src="' + photo + '" alt="">' +
        '<div class="p"><b>' + ((p && p.name) || id) + '</b><span>' + ((p && p.place) || '') + '</span></div>';
      b.onclick = function () {
        host.querySelectorAll('.pcard').forEach(function (c) { c.classList.remove('on'); });
        b.classList.add('on');
        snTell({ op: 'fly', lat: m.lat, lng: m.lng, label: (p && p.name) || id, tier: 'city' });
        snTell({ op: 'open', id: m.pin || id });
        openSheet(id);
      };
      host.appendChild(b);
    });
  }

  function absMedia(u) {
    if (!u) return 'https://astranov.eu/icon.png';
    if (/^https?:/i.test(u)) return u;
    return 'https://astranov.eu' + (u.charAt(0) === '/' ? u : '/' + u);
  }

  function imgsOf(id) {
    var m = META[id] || {};
    var folder = m.folder || id;
    return (m.images || ['00.jpg']).map(function (f) {
      return 'https://astranov.eu/media/projects/' + folder + '/' + f;
    });
  }

  function eur(k) {
    k = Number(k) || 0;
    if (Math.abs(k) >= 1000) return '€' + (k / 1000).toFixed(2).replace(/\.00$/, '') + 'M';
    return '€' + Math.round(k) + 'k';
  }
  function vat(k) {
    return Math.round((Number(k) || 0) * 0.24);
  }
  function rowsFor() {
    return (deck.packages || []).filter(function (p) {
      if (tab === 'phase1') return p.phase === 1;
      if (tab === 'later') return p.phase === 2;
      if (tab === 'restore') return /restore|eco-stays/.test(p.id + p.name);
      return true;
    });
  }
  function sum(list) {
    return list.reduce(function (a, p) {
      return a + (Number(p.capex) || 0);
    }, 0);
  }

  function sumRaised(list) {
    return list.reduce(function (a, p) {
      return a + (Number(p.raised) || 0);
    }, 0);
  }

  function renderRaise() {
    var el = document.getElementById('raise');
    if (!el) return;
    var all = deck.packages || [];
    var p1 = all.filter(function (p) { return p.phase === 1; });
    var p2 = all.filter(function (p) { return p.phase === 2; });
    var sn = Number((deck.complete && deck.complete.spacenet_keur) || deck.spacenet_keur || 7000);
    var need = sum(p1);
    var got = sumRaised(all) + (Number(deck.gathered_keur) || 0);
    var work = need + sn;
    var left = Math.max(0, work - got);
    var vatOnBuild = vat(Math.max(0, need - got));
    el.innerHTML =
      '<div class="pill"><b>' + eur(sn) + '</b>SpaceNet platform</div>' +
      '<div class="pill"><b>' + eur(need) + '</b>Phase 1 projects · net</div>' +
      '<div class="pill"><b>' + eur(got) + '</b>Already gathered</div>' +
      '<div class="pill need"><b>' + eur(left) + '</b>To complete SpaceNet + Phase 1</div>';
    var box = document.getElementById('complete-box');
    if (box) {
      var note = box.querySelector('p');
      if (note) {
        note.innerHTML =
          '<b>' +
          eur(left) +
          ' net</b> is the working cash to finish <b>SpaceNet</b> (' +
          eur(sn) +
          ') and <b>Phase 1 projects</b> (' +
          eur(need) +
          '). Gathered <b>' +
          eur(got) +
          '</b>. Not a contractor quote. Land extra. Yacht running cost (~€350k/year) extra. VAT on construction would add ' +
          eur(vatOnBuild) +
          ' → <b>' +
          eur(left + vatOnBuild) +
          '</b>.';
      }
    }
  }

  function renderModel() {
    document.getElementById('disclaimer').textContent = deck.disclaimer || '';
    var m = deck.model || {};
    document.getElementById('model').innerHTML =
      '<div class="pill"><b>' + (m.ops || 40) + '%</b>Operations · local wages</div>' +
      '<div class="pill"><b>' + (m.owner || 30) + '%</b>Owner yield · title stays</div>' +
      '<div class="pill"><b>' + (m.village || 30) + '%</b>Village company · next house</div>';
  }

  function renderTabs() {
    var host = document.getElementById('tabs');
    host.innerHTML = '';
    ;[
      ['phase1', 'Phase 1'],
      ['restore', 'Village restore'],
      ['all', 'All lines'],
      ['later', 'Not in Phase 1'],
      ['thesis', 'Oversustain + Coin']
    ].forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = it[1];
      if (tab === it[0]) b.className = 'on';
      b.onclick = function () {
        if (it[0] === 'thesis') {
          tab = 'all';
          render();
          var el = document.getElementById('thesis');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        tab = it[0];
        render();
      };
      host.appendChild(b);
    });
  }

  function td(text, cls) {
    var c = document.createElement('td');
    if (cls) c.className = cls;
    c.textContent = text == null ? '' : String(text);
    return c;
  }

  function byId(id) {
    var list = deck.packages || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function showSlide(urls) {
    if (!urls || !urls.length) return;
    if (slide < 0) slide = urls.length - 1;
    if (slide >= urls.length) slide = 0;
    document.getElementById('sheet-img').src = urls[slide];
    document.getElementById('sheet-count').textContent = slide + 1 + ' / ' + urls.length;
    var thumbs = document.getElementById('sheet-thumbs').querySelectorAll('img');
    for (var i = 0; i < thumbs.length; i++) thumbs[i].classList.toggle('on', i === slide);
  }

  function openSheet(id) {
    var p = byId(id);
    var m = META[id] || {};
    if (!p && !m.folder) return;
    openId = id;
    slide = 0;
    var urls = liveImgs[id] || imgsOf(id);
    liveImgs[id] = urls;
    document.getElementById('sheet-status').textContent = m.status || p.status || 'Investor preview';
    document.getElementById('sheet-title').textContent = (p && p.name) || m.name || id;
    document.getElementById('sheet-meta').textContent =
      ((p && p.place) || '') +
      (m.lat ? ' · ' + m.lat.toFixed(5) + ', ' + m.lng.toFixed(5) : '');
    document.getElementById('sheet-blurb').textContent = m.blurb || (p && p.note) || '';
    document.getElementById('sheet-state').textContent = 'Current state · ' + (m.state || 'Investor preview · not built');
    document.getElementById('sheet-over').textContent =
      'Oversustainable · paid in Astranov Coin (1 = 1 EUR). The Astranov Share is on the SpaceNet Stock Exchange, negotiated on real value created.';
    document.getElementById('sheet-money').textContent = p
      ? 'CAPEX envelope ' + eur(p.capex) + ' net · ' + (p.unit || '') + (p.phase === 2 ? ' · held out of Phase 1' : '')
      : '';
    var thumbs = document.getElementById('sheet-thumbs');
    thumbs.innerHTML = '';
    urls.forEach(function (u, i) {
      var im = document.createElement('img');
      im.src = u;
      im.alt = ((p && p.name) || id) + ' ' + (i + 1);
      im.addEventListener('click', function (ev) {
        ev.stopPropagation();
        slide = i;
        showSlide(urls);
      });
      thumbs.appendChild(im);
    });
    var globe = document.getElementById('sheet-globe');
    var q = m.pin || id;
    globe.href = 'https://astranov.eu/?project=' + encodeURIComponent(q);
    document.getElementById('sheet-globe').onclick = function (e) {
      e.preventDefault();
      snTell({ op: 'fly', lat: m.lat, lng: m.lng, label: (p && p.name) || id, tier: 'city' });
      snTell({ op: 'open', id: m.pin || id });
    };
    document.getElementById('sheet').classList.add('open');
    try {
      history.replaceState(null, '', '#' + id);
    } catch (_) {}
    showSlide(urls);
  }

  function closeSheet() {
    document.getElementById('sheet').classList.remove('open');
    openId = null;
    try {
      if (location.hash) history.replaceState(null, '', location.pathname);
    } catch (_) {}
  }

  function renderTable() {
    var table = document.getElementById('deck');
    table.classList.toggle('edit', owner);
    table.querySelector('thead').innerHTML =
      '<tr><th></th><th>Project</th><th>Place</th><th>What</th><th>CAPEX</th><th>Gathered</th><th>Still to raise</th><th>Note</th>' +
      (owner ? '<th></th>' : '') +
      '</tr>';
    var tb = table.querySelector('tbody');
    tb.innerHTML = '';
    var list = rowsFor();
    list.forEach(function (p) {
      var tr = document.createElement('tr');
      tr.dataset.id = p.id;
      tr.dataset.phase = String(p.phase || 1);
      var imgTd = document.createElement('td');
      var img = document.createElement('img');
      img.className = 'thumb';
      img.src = absMedia(p.photo || '/icon.png');
      img.alt = p.name;
      imgTd.appendChild(img);
      tr.appendChild(imgTd);
      var name = td(p.name);
      var place = td(p.place);
      var unit = td(p.unit);
      var cap = td(eur(p.capex), 'n');
      cap.dataset.raw = String(p.capex);
      var raised = Number(p.raised) || 0;
      var got = td(eur(raised), 'n');
      got.dataset.raw = String(raised);
      var left = td(eur(Math.max(0, (Number(p.capex) || 0) - raised)), 'n');
      var note = td(p.note || '');
      note.className = 'note';
      if (owner) {
        ;[name, place, unit, note].forEach(function (c) {
          c.contentEditable = 'true';
        });
        cap.contentEditable = 'true';
        cap.textContent = String(p.capex);
        got.contentEditable = 'true';
        got.textContent = String(raised);
      }
      tr.appendChild(name);
      tr.appendChild(place);
      tr.appendChild(unit);
      tr.appendChild(cap);
      tr.appendChild(got);
      tr.appendChild(left);
      tr.appendChild(note);
      if (owner) {
        var del = document.createElement('td');
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = '×';
        b.onclick = function (ev) {
          ev.stopPropagation();
          deck.packages = deck.packages.filter(function (x) {
            return x.id !== p.id;
          });
          render();
        };
        del.appendChild(b);
        tr.appendChild(del);
      }
      tr.addEventListener('click', function (e) {
        if (e.target && e.target.isContentEditable) return;
        if (e.target && e.target.closest && e.target.closest('button')) return;
        openSheet(p.id);
      });
      tb.appendChild(tr);
    });
    var net = sum(list);
    var got = sumRaised(list);
    var left = Math.max(0, net - got);
    var ft = table.querySelector('tfoot');
    var span = owner ? 8 : 7;
    ft.innerHTML =
      '<tr><td colspan="' + span + '">CAPEX this tab · net</td><td class="n">' + eur(net) + '</td></tr>' +
      '<tr><td colspan="' + span + '">Already gathered</td><td class="n">' + eur(got) + '</td></tr>' +
      '<tr><td colspan="' + span + '">Remaining to gather · net</td><td class="n">' + eur(left) + '</td></tr>' +
      '<tr><td colspan="' + span + '">VAT 24% on remaining</td><td class="n">' + eur(vat(left)) + '</td></tr>' +
      '<tr><td colspan="' + span + '">Remaining if VAT applies in full</td><td class="n">' + eur(left + vat(left)) + '</td></tr>';
    var p1 = (deck.packages || []).filter(function (p) { return p.phase === 1; });
    var p2 = (deck.packages || []).filter(function (p) { return p.phase === 2; });
    var p1need = sum(p1);
    var p1got = sumRaised(p1);
    var p1left = Math.max(0, p1need - p1got);
    var p2need = sum(p2);
    ft.innerHTML +=
      '<tr><td colspan="' + span + '">Phase 1 remaining · net</td><td class="n">' + eur(p1left) + '</td></tr>' +
      '<tr><td colspan="' + span + '">SpaceNet platform</td><td class="n">' + eur(Number(deck.spacenet_keur || 7000)) + '</td></tr>' +
      '<tr><td colspan="' + span + '">To complete SpaceNet + Phase 1 · remaining</td><td class="n">' + eur(p1left + Number(deck.spacenet_keur || 7000)) + '</td></tr>' +
      '<tr><td colspan="' + span + '">Held out of Phase 1 (lake + pontoon)</td><td class="n">' + eur(p2need) + '</td></tr>' +
      '<tr><td colspan="' + span + '">All designed remaining · net</td><td class="n">' + eur(p1left + Number(deck.spacenet_keur || 7000) + p2need - sumRaised(p2)) + '</td></tr>';
  }

  function harvest() {
    var rows = document.querySelectorAll('#deck tbody tr');
    rows.forEach(function (tr) {
      var id = tr.dataset.id;
      var p = (deck.packages || []).filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      var cells = tr.querySelectorAll('td');
      p.name = cells[1].textContent.trim();
      p.place = cells[2].textContent.trim();
      p.unit = cells[3].textContent.trim();
      var cap = parseFloat(String(cells[4].textContent).replace(/[^\d.]/g, ''));
      if (!isNaN(cap)) p.capex = cap;
      var raised = parseFloat(String(cells[5].textContent).replace(/[^\d.]/g, ''));
      if (!isNaN(raised)) p.raised = raised;
      p.note = cells[7].textContent.trim();
    });
  }

  function render() {
    renderModel();
    renderRaise();
    renderTabs();
    renderTable();
    renderCards();
    document.getElementById('owner-bar').classList.toggle('hidden', !owner);
  }

  function setWho() {
    var el = document.getElementById('who');
    var btn = document.getElementById('auth-btn');
    if (owner) {
      el.textContent = 'Owner · editing on';
      btn.textContent = 'Sign out';
    } else if (session && session.user) {
      el.textContent = session.user.email + ' · view only';
      btn.textContent = 'Sign out';
    } else {
      el.textContent = 'Public view';
      btn.textContent = 'Owner login';
    }
  }

  async function bootAuth() {
    sb = window.supabase.createClient(SB_URL, SB_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'astranov_auth_v2' }
    });
    var got = await sb.auth.getSession();
    session = got.data.session || null;
    owner = !!(session && String(session.user.email || '').toLowerCase() === OWNER);
    sb.auth.onAuthStateChange(function (_e, s) {
      session = s;
      owner = !!(s && String(s.user.email || '').toLowerCase() === OWNER);
      setWho();
      render();
    });
    setWho();
  }

  async function loadDeck() {
    var seed = await fetch(new URL('budget.json', location.href)).then(function (r) { return r.json(); }).catch(function () {
      return fetch('https://astranov.eu/investors/budget.json').then(function (r) { return r.json(); });
    });
    deck = seed;
    try {
      var remote = await fetch(SB_URL + '/functions/v1/investor-budget', {
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
      }).then(function (r) { return r.json(); });
      if (remote && remote.payload && remote.payload.packages) deck = remote.payload;
      else {
        var row = await sb.from('investor_budget').select('payload').eq('id', 'deck-v1').maybeSingle();
        if (row.data && row.data.payload && row.data.payload.packages) deck = row.data.payload;
      }
    } catch (_) {}
    render();
  }

  async function save() {
    if (!owner) return;
    harvest();
    var st = document.getElementById('save-status');
    st.textContent = 'Saving…';
    try {
      var token = session && session.access_token;
      var r = await fetch(SB_URL + '/functions/v1/investor-budget', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SB_KEY,
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ payload: deck })
      });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) {
        var rpc = await sb.rpc('investor_budget_save', { p_payload: deck });
        if (rpc.error) throw new Error(rpc.error.message || j.error || 'save failed');
      }
      st.textContent = 'Saved';
      render();
    } catch (e) {
      st.textContent = 'Save failed · ' + (e.message || 'login as owner');
    }
  }

  async function login() {
    if (session) {
      await sb.auth.signOut();
      return;
    }
    var redirect = 'https://investors.astranov.eu/';
    await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirect }
    });
  }

  document.getElementById('auth-btn').onclick = login;
  document.getElementById('save').onclick = save;
  document.getElementById('add-row').onclick = function () {
    if (!owner) return;
    harvest();
    deck.packages.push({
      id: 'new-' + Date.now(),
      name: 'New line',
      place: '',
      phase: tab === 'later' ? 2 : 1,
      capex: 0,
      raised: 0,
      unit: '',
      photo: '/icon.png',
      note: ''
    });
    render();
  };
  document.getElementById('lightbox').onclick = function () {
    this.classList.remove('open');
  };
  document.getElementById('sheet').addEventListener('click', function (e) {
    if (e.target.id === 'sheet') closeSheet();
  });
  document.getElementById('sheet-x').onclick = closeSheet;
  document.getElementById('sheet-prev').onclick = function () {
    slide--;
    showSlide(liveImgs[openId] || imgsOf(openId));
  };
  document.getElementById('sheet-next').onclick = function () {
    slide++;
    showSlide(liveImgs[openId] || imgsOf(openId));
  };
  window.addEventListener('keydown', function (e) {
    if (!document.getElementById('sheet').classList.contains('open')) return;
    if (e.key === 'Escape') closeSheet();
    if (e.key === 'ArrowLeft') {
      slide--;
      showSlide(liveImgs[openId] || imgsOf(openId));
    }
    if (e.key === 'ArrowRight') {
      slide++;
      showSlide(liveImgs[openId] || imgsOf(openId));
    }
  });

  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://astranov.eu') return;
    var d = e.data || {};
    if (d.sn === 'presence' && d.op === 'ready') {
      snTell({ op: 'planet' });
      var pins = Object.keys(META).map(function (id) {
        var m = META[id];
        return { id: m.pin || id, name: id, lat: m.lat, lng: m.lng, color: '#44ccff' };
      }).filter(function (p) { return p.lat; });
      snTell({ op: 'glow', pins: pins });
    }
  });

  bootAuth().then(function () {
    return loadDeck();
  }).then(function () {
    var h = (location.hash || '').replace(/^#/, '');
    if (h && (byId(h) || META[h])) openSheet(h);
  });
})();

/* Astranov SpaceNet Stock Exchange · 20260823205000-ash50 */
(function () {
  'use strict';
  var OWNER = 'notisastranov@gmail.com';
  var SB_URL = 'https://lkoatrkhuigdolnjsbie.supabase.co';
  var SB_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrb2F0cmtodWlnZG9sbmpzYmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODIwOTIsImV4cCI6MjA5NDQ1ODA5Mn0.qf6Kg93YLJ0coTdVQa4baU0ppOdFY5WkmVzMvEV6ejI';
  var book = { v: 2, bids: [], asks: [], share: { last_eur: 50, nav_eur: 50, authorized: 1000000, designed_keur: 50000 }, layers: [], tape: [] };
  var sb = null;
  var session = null;
  var owner = false;

  function fmt(n) {
    return Number(n).toFixed(2);
  }

  function render() {
    var sh = book.share || {};
    document.getElementById('last').innerHTML = fmt(sh.last_eur || sh.nav_eur) + ' <small>AVC</small>';
    document.getElementById('disclaimer').textContent = book.disclaimer || '';
    document.getElementById('pills').innerHTML =
      '<span class="pill">NAV ' + fmt(sh.nav_eur) + ' AVC</span>' +
      '<span class="pill">' + (sh.authorized || 0).toLocaleString('en-GB') + ' shares</span>' +
      '<span class="pill">Designed value €' + ((sh.designed_keur || 50000) / 1000).toFixed(0) + 'M</span>' +
      '<span class="pill">1 AVC = 1 EUR</span>';
    var layers = book.layers || [];
    var el = document.getElementById('layers');
    if (el) {
      el.innerHTML = layers
        .map(function (L) {
          return (
            '<div class="pill" style="display:block;border-radius:10px;margin:6px 0">' +
            '<b>' + (L.keur / 1000).toFixed(2) + 'M</b> ' + L.name +
            ' <span style="color:#9ec4ee">· ' + (L.note || '') + '</span></div>'
          );
        })
        .join('');
    }
    var bids = (book.bids || []).slice().sort(function (a, b) { return b.px - a.px; });
    var asks = (book.asks || []).slice().sort(function (a, b) { return a.px - b.px; });
    var html = '';
    asks.slice().reverse().forEach(function (o) {
      html += '<tr><td class="ask">ASK</td><td class="ask">' + fmt(o.px) + '</td><td>' + o.qty + '</td></tr>';
    });
    html += '<tr><td colspan="3" style="text-align:center;color:#e8c36a">spread</td></tr>';
    bids.forEach(function (o) {
      html += '<tr><td class="bid">BID</td><td class="bid">' + fmt(o.px) + '</td><td>' + o.qty + '</td></tr>';
    });
    document.getElementById('book').innerHTML = html;
    document.getElementById('tape').innerHTML = (book.tape || [])
      .slice(-12)
      .reverse()
      .map(function (t) {
        return t.side.toUpperCase() + '  ' + t.qty + ' ASH @ ' + fmt(t.px) + ' AVC  · ' + (t.who || 'anon');
      })
      .join('<br>');
    document.getElementById('who').textContent = owner ? 'Owner · book live' : 'Public book';
    document.getElementById('auth-btn').textContent = session ? 'Sign out' : 'Owner login';
    var px = document.getElementById('px');
    if (px && !px.dataset.touched) px.value = fmt(sh.last_eur || 50);
  }

  function match(side, px, qty, who) {
    px = +px;
    qty = Math.max(1, Math.round(+qty || 0));
    if (!isFinite(px) || px <= 0) return;
    var tape = book.tape || (book.tape = []);
    tape.push({ side: side, px: px, qty: qty, who: who || 'anon', t: Date.now() });
    if (side === 'buy') {
      book.bids.push({ px: px, qty: qty });
      book.share.last_eur = px;
    } else {
      book.asks.push({ px: px, qty: qty });
      book.share.last_eur = px;
    }
    try {
      localStorage.setItem('sn_asx_book', JSON.stringify(book));
    } catch (_) {}
    render();
  }

  document.getElementById('ticket').onsubmit = function (e) {
    e.preventDefault();
    match(
      document.getElementById('side').value,
      document.getElementById('px').value,
      document.getElementById('qty').value,
      document.getElementById('who-in').value
    );
  };
  document.getElementById('px').addEventListener('input', function () {
    this.dataset.touched = '1';
  });

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
      render();
    });
  }

  document.getElementById('auth-btn').onclick = async function () {
    if (session) {
      await sb.auth.signOut();
      return;
    }
    await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname.replace(/\/$/, '') + '/' }
    });
  };

  fetch('book.json?v=20260823205000-ash50')
    .then(function (r) { return r.json(); })
    .then(function (j) {
      book = j;
      book.tape = book.tape || [];
      try {
        var loc = JSON.parse(localStorage.getItem('sn_asx_book') || 'null');
        if (loc && loc.v >= 2 && loc.bids) {
          book.bids = loc.bids;
          book.asks = loc.asks;
          book.tape = loc.tape || [];
          if (loc.share && loc.share.last_eur) book.share.last_eur = loc.share.last_eur;
        }
      } catch (_) {}
      render();
    })
    .catch(function () { render(); });

  bootAuth();
})();

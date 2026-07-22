/* SpaceNet unified multi-role tile — cover · avatar · roles · menu · dating · driver
 * One surface for social / dating / vendor order / driver profiles (map + CLI).
 */
(function (global) {
  'use strict';

  const T = {
    open: false,
    profileId: null,
    tab: 'about', // about | menu | dating | drive | social | cart
  };

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ensureDom() {
    if ($('sn-tile')) return;
    const el = document.createElement('div');
    el.id = 'sn-tile';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<div class="sn-tile-card">' +
      '  <div class="sn-tile-cover" id="sn-tile-cover">' +
      '    <button type="button" class="sn-tile-x" id="sn-tile-close" aria-label="Close">×</button>' +
      '    <button type="button" class="sn-tile-edit-cover" id="sn-tile-edit-cover" title="Cover">📷</button>' +
      '    <input type="file" id="sn-tile-cover-file" accept="image/*" hidden />' +
      '  </div>' +
      '  <div class="sn-tile-head">' +
      '    <div class="sn-tile-av-wrap">' +
      '      <img id="sn-tile-av" class="sn-tile-av" alt="" />' +
      '      <button type="button" class="sn-tile-edit-av" id="sn-tile-edit-av" title="Photo">+</button>' +
      '      <input type="file" id="sn-tile-av-file" accept="image/*" hidden />' +
      '    </div>' +
      '    <div class="sn-tile-id">' +
      '      <div id="sn-tile-name" class="sn-tile-name"></div>' +
      '      <div id="sn-tile-handle" class="sn-tile-handle"></div>' +
      '      <div id="sn-tile-bio" class="sn-tile-bio"></div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="sn-tile-roles" id="sn-tile-roles"></div>' +
      '  <div class="sn-tile-tabs" id="sn-tile-tabs"></div>' +
      '  <div class="sn-tile-body" id="sn-tile-body"></div>' +
      '  <div class="sn-tile-foot" id="sn-tile-foot"></div>' +
      '</div>';
    document.body.appendChild(el);
    $('sn-tile-close')?.addEventListener('click', close);
    el.addEventListener('click', (e) => {
      if (e.target === el) close();
    });
    $('sn-tile-edit-cover')?.addEventListener('click', () => $('sn-tile-cover-file')?.click());
    $('sn-tile-edit-av')?.addEventListener('click', () => $('sn-tile-av-file')?.click());
    $('sn-tile-cover-file')?.addEventListener('change', (e) => onFile(e, 'cover'));
    $('sn-tile-av-file')?.addEventListener('change', (e) => onFile(e, 'avatar'));
  }

  function onFile(e, kind) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !T.profileId) return;
    const reader = new FileReader();
    reader.onload = () => {
      let url = String(reader.result || '');
      // Cap huge base64 for localStorage safety
      if (url.length > 400000) {
        global.SNCli?.log?.('Image large · using blob URL (session only)', 'dim');
        url = URL.createObjectURL(f);
      }
      global.SNProfiles?.setMedia?.(T.profileId, kind, url);
      render();
    };
    reader.readAsDataURL(f);
  }

  function isMe(p) {
    const me = global.SNProfiles?.me?.();
    return me && p && me.id === p.id;
  }

  function open(profileOrId, opts) {
    ensureDom();
    const Prof = global.SNProfiles;
    if (!Prof) return;
    let p =
      typeof profileOrId === 'string'
        ? Prof.get(profileOrId)
        : profileOrId && profileOrId.id
          ? profileOrId
          : null;
    if (!p) p = Prof.me();
    T.profileId = p.id;
    T.open = true;
    T.tab = opts?.tab || defaultTab(p);
    const root = $('sn-tile');
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    render();
    global.SNCli?.preview?.(p.name + ' · tile');
    if (p.lat != null && global.SNGlobe?.pulse) {
      SNGlobe.pulse(p.lat, p.lng, parseInt((Prof.pinColor(p) || '#6dffb0').slice(1), 16) || 0x6dffb0, p.name, 9000);
    }
  }

  function defaultTab(p) {
    if (p.roles?.vendor) return 'menu';
    if (p.roles?.dating) return 'dating';
    if (p.roles?.driver) return 'drive';
    if (p.roles?.social) return 'social';
    return 'about';
  }

  function close() {
    T.open = false;
    const root = $('sn-tile');
    if (root) {
      root.classList.remove('open');
      root.setAttribute('aria-hidden', 'true');
    }
  }

  function toggle(profileOrId) {
    if (T.open && (!profileOrId || T.profileId === (profileOrId.id || profileOrId))) close();
    else open(profileOrId);
  }

  function render() {
    const Prof = global.SNProfiles;
    const p = Prof?.get?.(T.profileId) || Prof?.me?.();
    if (!p) return;
    T.profileId = p.id;

    const cover = $('sn-tile-cover');
    if (cover) {
      const u = String(p.cover || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      cover.style.backgroundImage = u ? 'url("' + u + '")' : '';
    }
    const av = $('sn-tile-av');
    if (av) {
      av.src = p.avatar || '';
      av.alt = p.name || '';
    }
    if ($('sn-tile-name')) $('sn-tile-name').textContent = p.name || '';
    if ($('sn-tile-handle')) $('sn-tile-handle').textContent = (p.handle || '') + (isMe(p) ? ' · you' : '');
    if ($('sn-tile-bio')) $('sn-tile-bio').textContent = p.bio || '';

    // Role chips
    const rolesEl = $('sn-tile-roles');
    if (rolesEl) {
      const mine = isMe(p);
      rolesEl.innerHTML = Object.keys(Prof.ROLES)
        .map((key) => {
          const meta = Prof.ROLES[key];
          const on = !!p.roles?.[key];
          return (
            '<button type="button" class="sn-role' +
            (on ? ' on' : '') +
            '" data-role="' +
            key +
            '" style="--rc:' +
            meta.color +
            '"' +
            (mine ? '' : ' disabled') +
            '>' +
            meta.emoji +
            ' ' +
            meta.label +
            '</button>'
          );
        })
        .join('');
      rolesEl.querySelectorAll('[data-role]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (!isMe(p)) return;
          Prof.toggleRole(p.id, btn.dataset.role);
          render();
          global.SNMap?.showProfiles?.();
          global.SNCli?.log?.(
            'Role ' + btn.dataset.role + ' · ' + (Prof.get(p.id).roles[btn.dataset.role] ? 'ON' : 'off'),
            'ok'
          );
        });
      });
    }

    // Tabs
    const tabs = [];
    tabs.push(['about', 'About']);
    if (p.roles?.vendor) tabs.push(['menu', 'Menu']);
    if (p.roles?.dating) tabs.push(['dating', 'Dating']);
    if (p.roles?.driver) tabs.push(['drive', 'Drive']);
    if (p.roles?.social) tabs.push(['social', 'Social']);
    tabs.push(['cart', 'Cart']);
    if (!tabs.find((t) => t[0] === T.tab)) T.tab = tabs[0][0];

    const tabsEl = $('sn-tile-tabs');
    if (tabsEl) {
      tabsEl.innerHTML = tabs
        .map(
          ([id, label]) =>
            '<button type="button" class="sn-tab' +
            (T.tab === id ? ' on' : '') +
            '" data-tab="' +
            id +
            '">' +
            label +
            '</button>'
        )
        .join('');
      tabsEl.querySelectorAll('[data-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          T.tab = btn.dataset.tab;
          render();
        });
      });
    }

    const body = $('sn-tile-body');
    const foot = $('sn-tile-foot');
    if (!body || !foot) return;

    if (T.tab === 'about') {
      body.innerHTML =
        '<div class="sn-about">' +
        '<div>📍 ' +
        (p.lat != null ? p.lat.toFixed(4) + ', ' + p.lng.toFixed(4) : 'no pin yet') +
        '</div>' +
        '<div>Roles: ' +
        Object.keys(p.roles || [])
          .filter((k) => p.roles[k])
          .join(', ') +
        '</div>' +
        (p.shopName ? '<div>🏪 ' + esc(p.shopName) + ' · ' + esc(p.shopKind) + '</div>' : '') +
        (p.vehicle ? '<div>🛵 ' + esc(p.vehicle) + (p.driverOnline ? ' · ONLINE' : '') + '</div>' : '') +
        (p.lookingFor ? '<div>💕 ' + esc(p.lookingFor) + '</div>' : '') +
        '</div>';
      foot.innerHTML =
        '<button type="button" class="sn-btn" data-act="fly">Fly map</button>' +
        (isMe(p)
          ? '<button type="button" class="sn-btn primary" data-act="seed">Seed city tiles</button>'
          : '<button type="button" class="sn-btn primary" data-act="message">Message</button>');
    } else if (T.tab === 'menu') {
      const menu = p.menu || [];
      body.innerHTML =
        '<div class="sn-menu-head">' +
        esc(p.shopName || p.name) +
        ' · menu</div>' +
        (menu.length
          ? menu
              .map(
                (m) =>
                  '<div class="sn-menu-item" data-mid="' +
                  esc(m.id) +
                  '">' +
                  '<img src="' +
                  esc(m.photo) +
                  '" alt="" loading="lazy" />' +
                  '<div class="sn-menu-meta">' +
                  '<b>' +
                  esc(m.name) +
                  '</b>' +
                  '<span>' +
                  esc(m.desc) +
                  '</span>' +
                  '<em>€' +
                  Number(m.price).toFixed(2) +
                  '</em>' +
                  '</div>' +
                  '<button type="button" class="sn-add" data-add="' +
                  esc(m.id) +
                  '">+</button>' +
                  '</div>'
              )
              .join('')
          : '<div class="sn-empty">No menu yet · activate Vendor on your tile</div>');
      foot.innerHTML =
        '<button type="button" class="sn-btn" data-act="cart">Cart €' +
        (Prof.cartTotal?.() || 0).toFixed(2) +
        '</button>' +
        '<button type="button" class="sn-btn primary" data-act="order">Order + deliver</button>';
      body.querySelectorAll('[data-add]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const item = (p.menu || []).find((x) => x.id === btn.dataset.add);
          if (!item) return;
          Prof.cartAdd(p.id, item, 1);
          global.SNCli?.log?.('Cart + ' + item.name + ' €' + item.price, 'ok');
          render();
        });
      });
    } else if (T.tab === 'dating') {
      body.innerHTML =
        '<div class="sn-dating">' +
        '<div class="sn-big">' +
        esc(p.lookingFor || 'Open to meeting') +
        '</div>' +
        '<div class="sn-tags">' +
        (p.interests || [])
          .map((i) => '<span>' + esc(i) + '</span>')
          .join('') +
        '</div>' +
        '<p>Invite via city DNA — same tile, same claim flow.</p>' +
        '</div>';
      foot.innerHTML =
        '<button type="button" class="sn-btn primary" data-act="date">Invite date</button>' +
        '<button type="button" class="sn-btn" data-act="fly">Map</button>';
    } else if (T.tab === 'drive') {
      body.innerHTML =
        '<div class="sn-drive">' +
        '<div class="sn-big">' +
        (p.driverOnline ? '🟢 ONLINE' : '⚫ offline') +
        '</div>' +
        '<div>Vehicle · ' +
        esc(p.vehicle || '—') +
        '</div>' +
        '<div>Rating · ' +
        (p.rating != null ? p.rating : '—') +
        '★</div>' +
        '<p>Open deliveries appear as tasks. Claim from CLI or here.</p>' +
        '</div>';
      foot.innerHTML =
        (isMe(p)
          ? '<button type="button" class="sn-btn primary" data-act="online">' +
            (p.driverOnline ? 'Go offline' : 'Go online') +
            '</button>'
          : '') +
        '<button type="button" class="sn-btn" data-act="claim">Claim delivery</button>';
    } else if (T.tab === 'social') {
      const posts = p.posts || [];
      body.innerHTML =
        (isMe(p)
          ? '<div class="sn-compose"><input id="sn-post-in" placeholder="Post to city…" maxlength="280" /><button type="button" id="sn-post-go">Post</button></div>'
          : '') +
        (posts.length
          ? posts
              .map(
                (x) =>
                  '<div class="sn-post"><div class="sn-post-t">' +
                  esc(x.text) +
                  '</div><div class="sn-post-m">' +
                  new Date(x.t || Date.now()).toLocaleString() +
                  '</div></div>'
              )
              .join('')
          : '<div class="sn-empty">No posts yet</div>');
      foot.innerHTML = '<button type="button" class="sn-btn" data-act="fly">Show on map</button>';
      $('sn-post-go')?.addEventListener('click', () => {
        const v = $('sn-post-in')?.value?.trim();
        if (!v) return;
        Prof.addPost(p.id, v);
        render();
      });
    } else if (T.tab === 'cart') {
      const items = Prof.cart() || [];
      body.innerHTML = items.length
        ? items
            .map(
              (i) =>
                '<div class="sn-menu-item">' +
                '<img src="' +
                esc(i.photo) +
                '" alt="" />' +
                '<div class="sn-menu-meta"><b>' +
                esc(i.name) +
                '</b><span>' +
                esc(i.vendorName) +
                '</span><em>€' +
                Number(i.price).toFixed(2) +
                ' ×' +
                (i.qty || 1) +
                '</em></div></div>'
            )
            .join('') +
          '<div class="sn-total">Total €' +
          Prof.cartTotal().toFixed(2) +
          '</div>'
        : '<div class="sn-empty">Cart empty · open a vendor menu</div>';
      foot.innerHTML =
        '<button type="button" class="sn-btn" data-act="clear">Clear</button>' +
        '<button type="button" class="sn-btn primary" data-act="order">Order + deliver</button>';
    }

    foot.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => void act(btn.dataset.act, p));
    });
  }

  async function act(name, p) {
    const Prof = global.SNProfiles;
    if (name === 'fly') {
      if (p.lat != null) {
        await global.SNMap?.open?.(p.lat, p.lng);
        global.SNMap?.showProfiles?.();
        global.SNGlobe?.flyNear?.(p.lat, p.lng);
      }
      return;
    }
    if (name === 'seed') {
      Prof.seedCity(p.lat, p.lng);
      await global.SNMap?.open?.(p.lat, p.lng);
      global.SNMap?.showProfiles?.();
      global.SNCli?.log?.('City tiles seeded · vendors · dates · drivers', 'ok');
      render();
      return;
    }
    if (name === 'message') {
      global.SNCli?.log?.('Message · ' + p.name + ' · ' + (p.handle || ''), 'ok');
      global.SNCli?.log?.('Tip: date coffee · or order from their menu', 'dim');
      return;
    }
    if (name === 'date') {
      const t = global.SNTasks?.create?.({
        kind: 'dating',
        role: 'coffee',
        title: '💕 Date invite · ' + p.name,
        raw: 'date with ' + p.name,
        lat: p.lat,
        lng: p.lng,
      });
      global.SNCli?.log?.('Date open · ' + t.title, 'ok');
      global.SNMap?.showTasks?.();
      return;
    }
    if (name === 'online') {
      p.driverOnline = !p.driverOnline;
      p.roles.driver = true;
      Prof.upsert(p);
      global.SNCli?.log?.(p.driverOnline ? 'Driver ONLINE on map' : 'Driver offline', 'ok');
      global.SNMap?.showProfiles?.();
      render();
      return;
    }
    if (name === 'claim') {
      const r = global.SNTasks?.claim?.();
      if (r?.ok) global.SNCli?.log?.('Claimed · ' + r.task.title, 'ok');
      else global.SNCli?.log?.(r?.error || 'no deliveries', 'dim');
      return;
    }
    if (name === 'cart') {
      T.tab = 'cart';
      render();
      return;
    }
    if (name === 'clear') {
      Prof.cartClear();
      render();
      return;
    }
    if (name === 'order') {
      const r = Prof.placeOrder();
      if (!r.ok) {
        global.SNCli?.log?.(r.error || 'order failed', 'err');
        return;
      }
      global.SNCli?.log?.('Order €' + r.total.toFixed(2) + ' · delivery task open', 'ok');
      global.SNCli?.log?.('Drivers online can claim · task claim', 'dim');
      if (p.lat != null) await global.SNMap?.open?.(p.lat, p.lng);
      global.SNMap?.showTasks?.();
      global.SNMap?.showProfiles?.();
      T.tab = 'cart';
      render();
      return;
    }
  }

  function openMe(tab) {
    open(global.SNProfiles?.me?.(), { tab: tab || 'about' });
  }

  function init() {
    ensureDom();
    document.getElementById('btn-tile')?.addEventListener('click', () => openMe());
    // Floating + opens own tile (multi-role field)
    const fab = document.getElementById('sn-plus');
    if (fab && !fab._snBound) {
      fab._snBound = true;
      fab.addEventListener('click', (e) => {
        e.preventDefault();
        openMe();
      });
    }
  }

  global.SNTile = {
    init,
    open,
    openMe,
    close,
    toggle,
    render,
    get openId() {
      return T.profileId;
    },
    get isOpen() {
      return T.open;
    },
  };
})(window);

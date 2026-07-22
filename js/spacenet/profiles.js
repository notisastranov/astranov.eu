/* SpaceNet multi-role profiles — same DNA for user/social/dating/vendor/driver
 * Cover + avatar + roles + vendor menus (photo/price) · local-first juice
 */
(function (global) {
  'use strict';

  const KEY = 'sn:profiles-v1';
  const ME_KEY = 'sn:me-profile-id';
  const CART_KEY = 'sn:cart-v1';

  const ROLES = {
    social: { label: 'Social', color: '#6dffb0', emoji: '✨' },
    dating: { label: 'Dating', color: '#ff6699', emoji: '💕' },
    vendor: { label: 'Vendor', color: '#3d9eff', emoji: '🏪' },
    driver: { label: 'Driver', color: '#44ffaa', emoji: '🛵' },
    client: { label: 'Client', color: '#ffcc66', emoji: '🛒' },
    worker: { label: 'Work', color: '#66aaff', emoji: '💼' },
  };

  const P = {
    profiles: new Map(),
    meId: null,
    cart: [],
  };

  function uid(prefix) {
    return (prefix || 'p') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function pic(seed, w, h) {
    return 'https://picsum.photos/seed/' + encodeURIComponent(seed) + '/' + (w || 800) + '/' + (h || 400);
  }

  function avatar(seed) {
    return 'https://i.pravatar.cc/150?u=' + encodeURIComponent(seed);
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        JSON.parse(raw).forEach((p) => {
          if (p?.id) P.profiles.set(p.id, p);
        });
      }
      P.meId = localStorage.getItem(ME_KEY) || null;
      const cart = localStorage.getItem(CART_KEY);
      if (cart) P.cart = JSON.parse(cart) || [];
    } catch (_) {}
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify([...P.profiles.values()].slice(-60)));
      if (P.meId) localStorage.setItem(ME_KEY, P.meId);
      localStorage.setItem(CART_KEY, JSON.stringify(P.cart.slice(-40)));
    } catch (_) {}
  }

  function normalize(input) {
    const p = input || {};
    const roles = p.roles || { social: true };
    return {
      id: p.id || uid('p'),
      name: p.name || 'Astranov User',
      handle: p.handle || '@user',
      bio: p.bio || '',
      cover: p.cover || pic(p.id || p.name || 'cover', 900, 360),
      avatar: p.avatar || avatar(p.id || p.name || 'av'),
      roles: {
        social: !!roles.social,
        dating: !!roles.dating,
        vendor: !!roles.vendor,
        driver: !!roles.driver,
        client: !!roles.client,
        worker: !!roles.worker,
      },
      lat: p.lat != null ? p.lat : null,
      lng: p.lng != null ? p.lng : null,
      // dating
      lookingFor: p.lookingFor || '',
      interests: p.interests || [],
      // vendor
      shopName: p.shopName || '',
      shopKind: p.shopKind || 'shop',
      menu: Array.isArray(p.menu) ? p.menu : [],
      // driver
      driverOnline: !!p.driverOnline,
      vehicle: p.vehicle || '',
      rating: p.rating != null ? p.rating : 4.8,
      // social
      posts: Array.isArray(p.posts) ? p.posts : [],
      // meta
      created: p.created || Date.now(),
      updated: Date.now(),
    };
  }

  function upsert(spec) {
    const next = normalize(spec);
    const prev = P.profiles.get(next.id);
    if (prev) {
      Object.assign(prev, next, { created: prev.created });
      P.profiles.set(prev.id, prev);
      save();
      return prev;
    }
    P.profiles.set(next.id, next);
    save();
    return next;
  }

  function get(id) {
    return P.profiles.get(id) || null;
  }

  function list(filter) {
    let arr = [...P.profiles.values()];
    if (filter?.role) arr = arr.filter((p) => p.roles?.[filter.role]);
    if (filter?.near && filter.lat != null) {
      const R = filter.radius || 0.08;
      arr = arr.filter(
        (p) => p.lat != null && Math.abs(p.lat - filter.lat) < R && Math.abs(p.lng - filter.lng) < R
      );
    }
    return arr.sort((a, b) => (b.updated || 0) - (a.updated || 0));
  }

  function me() {
    if (P.meId && P.profiles.has(P.meId)) return P.profiles.get(P.meId);
    const pos = global.SNTasks?.pos || global._snLastPos || { lat: 36.4341, lng: 28.2176 };
    const self = upsert({
      id: P.meId || uid('me'),
      name: global.SNAuth?.user?.user_metadata?.full_name || global.SNAuth?.user?.email?.split('@')[0] || 'You',
      handle: '@' + (global.SNAuth?.user?.email?.split('@')[0] || 'astranov'),
      bio: 'SpaceNet citizen · activate roles on your tile',
      cover: pic('me-cover', 900, 360),
      avatar: global.SNAuth?.user?.user_metadata?.avatar_url || avatar('me-av'),
      roles: { social: true, client: true, dating: false, vendor: false, driver: false, worker: false },
      lat: pos.lat,
      lng: pos.lng,
      posts: [{ id: uid('post'), text: 'Joined Astranov SpaceNet 🌍', t: Date.now() }],
    });
    P.meId = self.id;
    save();
    return self;
  }

  function setMe(id) {
    if (P.profiles.has(id)) {
      P.meId = id;
      save();
      return get(id);
    }
    return null;
  }

  function toggleRole(profileId, role, on) {
    const p = get(profileId) || me();
    if (!ROLES[role]) return p;
    p.roles[role] = on != null ? !!on : !p.roles[role];
    // sensible defaults when enabling
    if (p.roles.vendor && !p.shopName) {
      p.shopName = p.name + "'s shop";
      if (!p.menu.length) p.menu = defaultMenu(p.shopKind || 'cafe');
    }
    if (p.roles.driver && !p.vehicle) p.vehicle = 'Scooter';
    if (p.roles.dating && !p.lookingFor) p.lookingFor = 'Coffee · walk · real talk';
    p.updated = Date.now();
    P.profiles.set(p.id, p);
    save();
    return p;
  }

  function defaultMenu(kind) {
    const k = String(kind || 'cafe').toLowerCase();
    if (/pizza|food|restaurant/.test(k)) {
      return [
        { id: uid('m'), name: 'Margherita', price: 9.5, photo: pic('pizza1', 200, 200), desc: 'Tomato · mozzarella' },
        { id: uid('m'), name: 'Pepperoni', price: 11, photo: pic('pizza2', 200, 200), desc: 'Spicy' },
        { id: uid('m'), name: 'Greek salad', price: 7.5, photo: pic('salad1', 200, 200), desc: 'Feta · olive' },
      ];
    }
    if (/coffee|cafe|bar/.test(k)) {
      return [
        { id: uid('m'), name: 'Espresso', price: 2.5, photo: pic('cof1', 200, 200), desc: 'Single' },
        { id: uid('m'), name: 'Cappuccino', price: 3.8, photo: pic('cof2', 200, 200), desc: 'Foam' },
        { id: uid('m'), name: 'Croissant', price: 2.9, photo: pic('pastry1', 200, 200), desc: 'Butter' },
      ];
    }
    return [
      { id: uid('m'), name: 'Item A', price: 5, photo: pic('itema', 200, 200), desc: 'Popular' },
      { id: uid('m'), name: 'Item B', price: 8, photo: pic('itemb', 200, 200), desc: 'Chef pick' },
    ];
  }

  function setMenuItem(profileId, item) {
    const p = get(profileId);
    if (!p) return null;
    p.menu = p.menu || [];
    const idx = p.menu.findIndex((m) => m.id === item.id);
    const row = {
      id: item.id || uid('m'),
      name: item.name || 'Item',
      price: Number(item.price) || 0,
      photo: item.photo || pic(item.name || 'm', 200, 200),
      desc: item.desc || '',
    };
    if (idx >= 0) p.menu[idx] = row;
    else p.menu.push(row);
    p.updated = Date.now();
    save();
    return p;
  }

  function setMedia(profileId, kind, dataUrl) {
    const p = get(profileId) || me();
    if (kind === 'cover') p.cover = dataUrl;
    else if (kind === 'avatar') p.avatar = dataUrl;
    p.updated = Date.now();
    P.profiles.set(p.id, p);
    save();
    return p;
  }

  function addPost(profileId, text) {
    const p = get(profileId) || me();
    p.posts = p.posts || [];
    p.posts.unshift({ id: uid('post'), text: String(text || '').slice(0, 280), t: Date.now() });
    p.posts = p.posts.slice(0, 20);
    p.updated = Date.now();
    save();
    return p;
  }

  // Cart
  function cart() {
    return P.cart.slice();
  }

  function cartAdd(vendorId, menuItem, qty) {
    const v = get(vendorId);
    const item = {
      id: uid('c'),
      vendorId,
      vendorName: v?.shopName || v?.name || 'Shop',
      menuId: menuItem.id,
      name: menuItem.name,
      price: Number(menuItem.price) || 0,
      photo: menuItem.photo,
      qty: qty || 1,
    };
    P.cart.push(item);
    save();
    return item;
  }

  function cartClear() {
    P.cart = [];
    save();
  }

  function cartTotal() {
    return P.cart.reduce((s, i) => s + i.price * (i.qty || 1), 0);
  }

  function placeOrder() {
    if (!P.cart.length) return { ok: false, error: 'cart empty' };
    const vendorId = P.cart[0].vendorId;
    const total = cartTotal();
    const items = cart();
    cartClear();
    // Create delivery task DNA
    const t = global.SNTasks?.create?.({
      kind: 'delivery',
      role: 'driver',
      title: '📦 Order · ' + items.map((i) => i.name).slice(0, 2).join(', ') + ' · €' + total.toFixed(2),
      dur: '45m',
      raw: 'delivery order ' + total,
      lat: get(vendorId)?.lat,
      lng: get(vendorId)?.lng,
    });
    // Notify drivers on map
    list({ role: 'driver' }).forEach((d) => {
      if (d.driverOnline && global.SNGlobe?.pulse) {
        SNGlobe.pulse(d.lat, d.lng, 0x44ffaa, 'Order!', 8000);
      }
    });
    return { ok: true, task: t, total, items, vendorId };
  }

  function fromCrawlPlace(place, pos) {
    const base = pos || global.SNTasks?.pos || { lat: 36.43, lng: 28.22 };
    const id = 'poi_' + String(place.name || 'x')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .slice(0, 24);
    if (P.profiles.has(id)) return get(id);
    const kind = String(place.kind || 'shop').toLowerCase();
    const isFood = /restaurant|cafe|fast_food|bar|food|pizza/.test(kind);
    return upsert({
      id,
      name: place.name || 'Place',
      handle: '@' + id.slice(0, 16),
      bio: (place.kind || 'vendor') + ' · live from city crawl',
      cover: pic(id + '-c', 900, 360),
      avatar: pic(id + '-a', 150, 150),
      roles: { social: true, vendor: true, client: false, dating: false, driver: false, worker: false },
      lat: place.lat != null ? place.lat : base.lat + (Math.random() - 0.5) * 0.02,
      lng: place.lng != null ? place.lng : base.lng + (Math.random() - 0.5) * 0.02,
      shopName: place.name || 'Shop',
      shopKind: kind,
      menu: defaultMenu(isFood ? ( /cafe|coffee|bar/.test(kind) ? 'cafe' : 'restaurant') : 'shop'),
      posts: [{ id: uid('post'), text: 'Open on SpaceNet city map', t: Date.now() }],
    });
  }

  function seedCity(lat, lng) {
    const L = lat != null ? lat : 36.4341;
    const G = lng != null ? lng : 28.2176;
    const seeds = [
      {
        id: 'seed_vendor_blue',
        name: 'Aegean Bites',
        handle: '@aegeanbites',
        bio: 'Street food · Rhodes · order on map',
        roles: { vendor: true, social: true, client: false },
        shopName: 'Aegean Bites',
        shopKind: 'restaurant',
        lat: L + 0.008,
        lng: G + 0.006,
        menu: defaultMenu('restaurant'),
      },
      {
        id: 'seed_cafe_orbit',
        name: 'Orbit Café',
        handle: '@orbitcafe',
        bio: 'Coffee + wifi · good for dates',
        roles: { vendor: true, social: true },
        shopName: 'Orbit Café',
        shopKind: 'cafe',
        lat: L - 0.006,
        lng: G + 0.01,
        menu: defaultMenu('cafe'),
      },
      {
        id: 'seed_date_nova',
        name: 'Nova',
        handle: '@nova',
        bio: 'Looking for coffee & orbit walks',
        roles: { dating: true, social: true },
        lookingFor: 'Coffee · walk · sunset',
        interests: ['travel', 'music', 'space'],
        lat: L + 0.004,
        lng: G - 0.007,
      },
      {
        id: 'seed_date_leo',
        name: 'Leo',
        handle: '@leo',
        bio: 'Driver by day · dates by night',
        roles: { dating: true, driver: true, social: true },
        lookingFor: 'Dinner · real talk',
        vehicle: 'E-bike',
        driverOnline: true,
        lat: L - 0.01,
        lng: G - 0.004,
      },
      {
        id: 'seed_driver_iris',
        name: 'Iris',
        handle: '@iris_drive',
        bio: 'Delivery · 4.9★ · online now',
        roles: { driver: true, social: true },
        vehicle: 'Scooter',
        driverOnline: true,
        rating: 4.9,
        lat: L + 0.012,
        lng: G - 0.002,
      },
      {
        id: 'seed_social_aria',
        name: 'Aria',
        handle: '@aria',
        bio: 'Photographer · city stories',
        roles: { social: true, worker: true },
        lat: L - 0.003,
        lng: G + 0.014,
        posts: [
          { id: 'p1', text: 'Golden hour over the marina 📷', t: Date.now() - 3600000 },
          { id: 'p2', text: 'Hiring assistants this week · job nanny? no — photo gigs', t: Date.now() - 7200000 },
        ],
      },
    ];
    seeds.forEach((s) => {
      if (!P.profiles.has(s.id)) {
        upsert({
          ...s,
          cover: pic(s.id + 'c', 900, 360),
          avatar: avatar(s.id),
        });
      }
    });
    me(); // ensure self exists
    return list();
  }

  function primaryRole(p) {
    if (p.roles?.vendor) return 'vendor';
    if (p.roles?.driver && p.driverOnline) return 'driver';
    if (p.roles?.dating) return 'dating';
    if (p.roles?.worker) return 'worker';
    if (p.roles?.social) return 'social';
    return 'client';
  }

  function pinColor(p) {
    const r = primaryRole(p);
    return (ROLES[r] || ROLES.social).color;
  }

  load();

  global.SNProfiles = {
    ROLES,
    load,
    save,
    get,
    list,
    me,
    setMe,
    upsert,
    toggleRole,
    setMenuItem,
    setMedia,
    addPost,
    defaultMenu,
    fromCrawlPlace,
    seedCity,
    primaryRole,
    pinColor,
    cart,
    cartAdd,
    cartClear,
    cartTotal,
    placeOrder,
  };
})(window);

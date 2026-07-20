// === CITY TASKS — same delivery DNA for ALL city work ===
// Pipeline: open → assigned → claimed → en_route/in_progress → delivered/done → cancelled
// Kinds: delivery · job · errand · dating · service
// Durations: 3h barman · 1w housekeeper · 2h date · one-shot errands
const CityTasks = {
  version: '20260717-jobs-dna',
  tasks: new Map(),
  _localKey: 'astranov:city-tasks-v2',

  // Shared status DNA (delivery names kept for OrderTracking mirror)
  STATUSES: ['open', 'assigned', 'claimed', 'picked_up', 'en_route', 'in_progress', 'delivered', 'done', 'cancelled'],

  KINDS: {
    delivery: {
      label: 'Delivery', icon: '📦', role: 'driver',
      actionClaim: 'Claim delivery', actionDone: 'Mark delivered',
      color: 0x44ffaa,
    },
    job: {
      label: 'Job / gig', icon: '💼', role: 'worker',
      actionClaim: 'Take job', actionDone: 'Complete shift',
      color: 0x66aaff,
    },
    errand: {
      label: 'Errand', icon: '🏃', role: 'runner',
      actionClaim: 'Run errand', actionDone: 'Errand done',
      color: 0xffcc44,
    },
    dating: {
      label: 'Dating', icon: '💕', role: 'match',
      actionClaim: 'Accept date', actionDone: 'Date done',
      color: 0xff6699,
    },
    service: {
      label: 'Service', icon: '🛠️', role: 'provider',
      actionClaim: 'Take service', actionDone: 'Service done',
      color: 0xaa88ff,
    },
    help: {
      label: 'Help', icon: '🤝', role: 'helper',
      actionClaim: 'Help now', actionDone: 'Help done',
      color: 0x66ffcc,
    },
    vendor: {
      label: 'Vendor task', icon: '🏬', role: 'worker',
      actionClaim: 'Take vendor task', actionDone: 'Vendor task done',
      color: 0xffaa44,
    },
  },

  /** Multi-party stages — both poster + worker must confirm each step */
  STAGE_TEMPLATES: {
    delivery: ['accepted', 'picked_up', 'arrived', 'delivered'],
    job: ['accepted', 'arrived', 'in_progress', 'done'],
    errand: ['accepted', 'arrived', 'done'],
    dating: ['accepted', 'arrived', 'met', 'done'],
    service: ['accepted', 'arrived', 'done'],
    help: ['accepted', 'arrived', 'done'],
    vendor: ['accepted', 'arrived', 'done'],
  },

  // Catalog of common gigs (extend freely)
  CATALOG: [
    { kind: 'job', role: 'barman', title: 'Barman / bartender', defaultDur: '3h', rateHint: '€/h' },
    { kind: 'job', role: 'barista', title: 'Barista', defaultDur: '4h', rateHint: '€/h' },
    { kind: 'job', role: 'housekeeper', title: 'Housekeeper', defaultDur: '1w', rateHint: '€/week' },
    { kind: 'job', role: 'cleaner', title: 'Cleaner', defaultDur: '3h', rateHint: '€/h' },
    { kind: 'job', role: 'nanny', title: 'Nanny / childcare', defaultDur: '1d', rateHint: '€/d' },
    { kind: 'job', role: 'gardener', title: 'Gardener', defaultDur: '4h', rateHint: '€/h' },
    { kind: 'job', role: 'cook', title: 'Cook / private chef', defaultDur: '3h', rateHint: '€/h' },
    { kind: 'job', role: 'waiter', title: 'Waiter / server', defaultDur: '5h', rateHint: '€/h' },
    { kind: 'job', role: 'security', title: 'Security', defaultDur: '8h', rateHint: '€/h' },
    { kind: 'job', role: 'tutor', title: 'Tutor', defaultDur: '2h', rateHint: '€/h' },
    { kind: 'job', role: 'mover', title: 'Mover / helper', defaultDur: '4h', rateHint: '€/h' },
    { kind: 'job', role: 'petcare', title: 'Pet care / walker', defaultDur: '1h', rateHint: '€/h' },
    { kind: 'errand', role: 'errand', title: 'General errand', defaultDur: '1h', rateHint: 'flat' },
    { kind: 'errand', role: 'pharmacy', title: 'Pharmacy run', defaultDur: '45m', rateHint: 'flat' },
    { kind: 'errand', role: 'grocery', title: 'Grocery run', defaultDur: '1h', rateHint: 'flat' },
    { kind: 'errand', role: 'documents', title: 'Document / office run', defaultDur: '2h', rateHint: 'flat' },
    { kind: 'delivery', role: 'driver', title: 'Package / food delivery', defaultDur: '45m', rateHint: 'route' },
    { kind: 'dating', role: 'date', title: 'Date / meet', defaultDur: '2h', rateHint: 'shared' },
    { kind: 'dating', role: 'coffee', title: 'Coffee date', defaultDur: '1h', rateHint: 'shared' },
    { kind: 'dating', role: 'dinner', title: 'Dinner date', defaultDur: '3h', rateHint: 'shared' },
    { kind: 'dating', role: 'walk', title: 'Walk / activity date', defaultDur: '2h', rateHint: 'shared' },
    { kind: 'service', role: 'handyman', title: 'Handyman', defaultDur: '2h', rateHint: '€/h' },
    { kind: 'service', role: 'beauty', title: 'Beauty / hair at home', defaultDur: '2h', rateHint: '€/h' },
  ],

  init() {
    if (this._inited) return;
    this._inited = true;
    window.CityTasks = this;
    this._loadLocal();
    this._wireFieldBrain();
    console.log('%c[CityTasks] jobs · errands · dating · delivery DNA', 'color:#44ffaa;font-weight:700');
  },

  _loadLocal() {
    try {
      const raw = localStorage.getItem(this._localKey)
        || localStorage.getItem('astranov:city-tasks-v1');
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) arr.forEach(t => { if (t?.id) this.tasks.set(t.id, t); });
    } catch (_) {}
  },

  _saveLocal() {
    try {
      const arr = [...this.tasks.values()].slice(-100);
      localStorage.setItem(this._localKey, JSON.stringify(arr));
    } catch (_) {}
  },

  _id() {
    return 'ct_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  },

  _wireFieldBrain() {
    if (!window.FieldBrain) return;
    const FB = window.FieldBrain;
    FB.claimDelivery = async (orderId) => this.claim(orderId);
    FB.createCityTask = (spec) => this.create(spec);
    FB.listCityTasks = (f) => this.list(f);
    FB.completeDelivery = async (id) => this.complete(id);
    FB.postJob = (spec) => this.postJob(spec);
    FB.postDate = (spec) => this.postDate(spec);
  },

  /** Parse "3h" · "1w" · "2d" · "45m" → ms + label */
  parseDuration(raw) {
    if (raw == null || raw === '') return { ms: 0, label: 'open', unit: null, amount: 0 };
    if (typeof raw === 'number' && raw > 0) {
      return { ms: raw, label: this._fmtDur(raw), unit: 'ms', amount: raw };
    }
    const s = String(raw).trim().toLowerCase().replace(/\s+/g, '');
    const m = s.match(/^(\d+(?:\.\d+)?)(m|min|mins|h|hr|hrs|hour|hours|d|day|days|w|wk|week|weeks)?$/);
    if (!m) return { ms: 0, label: String(raw), unit: null, amount: 0 };
    const n = parseFloat(m[1]);
    const u = m[2] || 'h';
    let ms = 0;
    let label = n + u;
    if (/^m|min/.test(u)) { ms = n * 60 * 1000; label = n + 'm'; }
    else if (/^h|hr|hour/.test(u)) { ms = n * 3600 * 1000; label = n + 'h'; }
    else if (/^d|day/.test(u)) { ms = n * 86400 * 1000; label = n + 'd'; }
    else if (/^w|wk|week/.test(u)) { ms = n * 7 * 86400 * 1000; label = n + 'w'; }
    return { ms, label, unit: u, amount: n };
  },

  _fmtDur(ms) {
    if (!ms || ms < 60000) return 'open';
    if (ms < 3600000) return Math.round(ms / 60000) + 'm';
    if (ms < 86400000) return (Math.round(ms / 3600000 * 10) / 10) + 'h';
    if (ms < 7 * 86400000) return (Math.round(ms / 86400000 * 10) / 10) + 'd';
    return (Math.round(ms / (7 * 86400000) * 10) / 10) + 'w';
  },

  /** Infer kind + role + duration from free text */
  parseSpec(text) {
    const raw = String(text || '').trim();
    const low = raw.toLowerCase();
    let kind = 'job';
    let role = 'worker';
    let duration = null;
    let title = raw;

    // Duration tokens → normalize to 3h / 1w / 45m
    const durM = low.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|days?|d|weeks?|wks?|w|mins?|minutes?|m)\b/i);
    if (durM) {
      const n = durM[1];
      const u = durM[2].toLowerCase();
      if (/^h|hour|hr/.test(u)) duration = n + 'h';
      else if (/^d|day/.test(u)) duration = n + 'd';
      else if (/^w|week|wk/.test(u)) duration = n + 'w';
      else duration = n + 'm';
    }

    // Kind detection
    if (/\b(date|dating|coffee\s*date|dinner\s*date|meet\s*(up)?|romantic|tinder|match)\b/i.test(low)) {
      kind = 'dating';
      role = /dinner/.test(low) ? 'dinner' : /coffee/.test(low) ? 'coffee' : /walk/.test(low) ? 'walk' : 'date';
    } else if (/\b(deliver|delivery|drop.?off|package|food\s*order|courier)\b/i.test(low)) {
      kind = 'delivery';
      role = 'driver';
    } else if (/\b(errand|pharmacy|grocery\s*run|pick\s*up|run\s*to)\b/i.test(low)) {
      kind = 'errand';
      role = /pharmacy/.test(low) ? 'pharmacy' : /grocery/.test(low) ? 'grocery' : 'errand';
    } else if (/\b(handyman|beauty|hair|repair|fix)\b/i.test(low)) {
      kind = 'service';
      role = /beauty|hair/.test(low) ? 'beauty' : 'handyman';
    }

    // Role from catalog keywords
    for (const c of this.CATALOG) {
      if (c.role !== 'driver' && c.role !== 'errand' && c.role !== 'date'
        && new RegExp('\\b' + c.role + '\\b', 'i').test(low)) {
        kind = c.kind;
        role = c.role;
        if (!duration) duration = c.defaultDur;
        title = c.title + (duration ? ' · ' + duration : '');
        break;
      }
    }
    // Explicit barman / housekeeper etc. already matched above; refine title
    if (/barman|bartender|μπάρμαν|μπαρμαν/i.test(low)) {
      kind = 'job'; role = 'barman';
      if (!duration) duration = '3h';
      title = 'Barman · ' + (duration || '3h');
    }
    if (/house\s*keep|οικιακ|καθαρίστ/i.test(low)) {
      kind = 'job'; role = 'housekeeper';
      if (!duration) duration = '1w';
      title = 'Housekeeper · ' + (duration || '1w');
    }

    if (!title || title.length < 2) {
      const k = this.KINDS[kind] || this.KINDS.job;
      title = k.icon + ' ' + k.label + (duration ? ' · ' + duration : '');
    }

    return { kind, role, duration, title: title.slice(0, 80), raw };
  },

  meta(kind) {
    return this.KINDS[kind] || this.KINDS.service;
  },

  create(spec) {
    spec = spec || {};
    const u = window._lastPos || { lat: 36.4341, lng: 28.2176 };
    const parsed = spec.rawText ? this.parseSpec(spec.rawText) : null;
    const kind = spec.kind || parsed?.kind || 'delivery';
    const role = spec.role || parsed?.role || this.meta(kind).role;
    const dur = this.parseDuration(spec.duration || parsed?.duration || spec.duration_label);
    const startAt = spec.start_at || Date.now();
    const endAt = spec.end_at || (dur.ms ? startAt + dur.ms : null);
    const km = this.meta(kind);

    const task = {
      id: spec.id || this._id(),
      kind,
      role,
      title: spec.title || parsed?.title || (km.icon + ' ' + km.label),
      status: 'open',
      lat: spec.lat ?? u.lat,
      lng: spec.lng ?? u.lng,
      // Client who posts
      poster_id: Auth?.user?.id || 'local',
      poster_name: Auth?.user?.user_metadata?.full_name
        || Auth?.user?.email?.split?.('@')?.[0] || 'You',
      // Worker / driver / match who claims
      worker_id: null,
      worker_name: null,
      driver_id: null, // alias for delivery DNA
      driver_name: null,
      // Duration DNA
      duration_ms: dur.ms,
      duration_label: dur.label,
      start_at: startAt,
      end_at: endAt,
      // Pay — Astranov Coins is product currency
      rate: spec.rate ?? null,
      rate_unit: spec.rate_unit || 'flat',
      budget: spec.budget ?? null,
      coins: Math.max(0, Math.round(Number(spec.coins ?? spec.budget ?? 0) || 0)),
      currency: spec.currency || 'COINS',
      // Broadcast radius (km) — who sees the accept offer
      radius_km: Math.max(0.2, Math.min(100, Number(spec.radius_km ?? 3) || 3)),
      // Criteria (dating age/looks, roles required, etc.)
      criteria: spec.criteria && typeof spec.criteria === 'object' ? spec.criteria : {},
      // Multi-party stage verification
      stages: this._buildStages(kind, spec.stages),
      stage_index: 0,
      // Commerce links
      vendor_id: spec.vendor_id || null,
      vendor_name: spec.vendor_name || null,
      order_id: spec.order_id || null,
      short_id: spec.short_id || null,
      items: spec.items || [],
      note: spec.note || '',
      // Dating extras
      dating: kind === 'dating' ? {
        vibe: spec.vibe || 'open',
        place_hint: spec.place_hint || '',
        mutual: false,
        age_min: spec.criteria?.age_min ?? spec.age_min ?? null,
        age_max: spec.criteria?.age_max ?? spec.age_max ?? null,
        looks: spec.criteria?.looks || spec.looks || '',
      } : null,
      launched: false,
      rejected_by: [],
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    this.tasks.set(task.id, task);
    this._saveLocal();
    this._showOnGlobe(task);
    FieldBrain?.pulse?.('commerce', task.kind + ' open · ' + task.title, { task });
    AciCli?.print?.(
      'city-task · ' + task.kind + ' · ' + (task.coins || 0) + '🪙 · ' + task.title.slice(0, 36),
      'ok'
    );
    return task;
  },

  _buildStages(kind, custom) {
    if (Array.isArray(custom) && custom.length) {
      return custom.map((s, i) => ({
        id: s.id || ('s' + i),
        label: s.label || s.id || ('Stage ' + (i + 1)),
        poster_ok: !!s.poster_ok,
        worker_ok: !!s.worker_ok,
        at: s.at || null,
      }));
    }
    const ids = this.STAGE_TEMPLATES[kind] || this.STAGE_TEMPLATES.help;
    return ids.map((id) => ({
      id,
      label: id.replace(/_/g, ' '),
      poster_ok: false,
      worker_ok: false,
      at: null,
    }));
  },

  /**
   * Launch task to users in radius who can serve it.
   * Uses BroadcastChannel + localStorage so other tabs/sessions see Accept/Reject.
   */
  launch(idOrSpec) {
    let task = typeof idOrSpec === 'string' || idOrSpec?.id
      ? this.get(idOrSpec?.id || idOrSpec)
      : null;
    if (!task && idOrSpec && typeof idOrSpec === 'object') {
      task = this.create(idOrSpec);
    }
    if (!task) return { ok: false, error: 'no task' };
    task.launched = true;
    task.status = 'open';
    task.updated_at = Date.now();
    this.tasks.set(task.id, task);
    this._saveLocal();
    this._broadcastOffer(task);
    TaskBoard?.showOutgoing?.(task);
    FieldBrain?.pulse?.('commerce', 'launched · ' + task.coins + '🪙 · r' + task.radius_km + 'km', { task });
    AciCli?.print?.(
      'task launched · ' + task.title.slice(0, 28) + ' · ' + task.coins + '🪙 · ' + task.radius_km + 'km',
      'ok'
    );
    return { ok: true, task };
  },

  _broadcastOffer(task) {
    const payload = {
      type: 'astranov-task-offer',
      task: {
        id: task.id,
        kind: task.kind,
        role: task.role,
        title: task.title,
        note: task.note,
        coins: task.coins,
        currency: task.currency || 'COINS',
        radius_km: task.radius_km,
        lat: task.lat,
        lng: task.lng,
        criteria: task.criteria || {},
        dating: task.dating,
        poster_id: task.poster_id,
        poster_name: task.poster_name,
        duration_label: task.duration_label,
        stages: task.stages,
      },
      t: Date.now(),
    };
    try {
      localStorage.setItem('astranov:task-offer-pulse', JSON.stringify(payload));
      // same-tab + multi-tab
      window.dispatchEvent(new CustomEvent('astranov-task-offer', { detail: payload }));
    } catch (_) {}
    try {
      if (!this._bc) this._bc = new BroadcastChannel('astranov-tasks');
      this._bc.postMessage(payload);
    } catch (_) {}
  },

  /** Haversine km */
  distKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  /** Can this local user serve the task? */
  canServe(task, userPos) {
    if (!task || task.status !== 'open') return false;
    const me = Auth?.user?.id || 'local';
    if (task.poster_id && task.poster_id === me) return false;
    if (task.rejected_by?.includes?.(me)) return false;
    const pos = userPos || window._lastPos;
    if (pos?.lat != null && task.lat != null) {
      const d = this.distKm(pos.lat, pos.lng, task.lat, task.lng);
      if (d > (task.radius_km || 3)) return false;
    }
    // Role fit (soft): driver tasks prefer driver role
    const roles = FieldBrain?.roles || Auth?._profileVisual?.roles || [];
    const arr = Array.isArray(roles) ? roles : [];
    if (task.kind === 'delivery' && arr.length && !arr.includes('driver') && !arr.includes('client')) {
      /* still allow — anyone can help */
    }
    // Dating criteria soft filter if local profile has age
    if (task.kind === 'dating' && task.criteria) {
      const myAge = Number(Auth?.user?.user_metadata?.age || window._profileAge);
      if (myAge && task.criteria.age_min && myAge < task.criteria.age_min) return false;
      if (myAge && task.criteria.age_max && myAge > task.criteria.age_max) return false;
    }
    return true;
  },

  reject(id) {
    const task = this.get(id);
    if (!task) return { ok: false, error: 'not found' };
    const me = Auth?.user?.id || 'local';
    if (!task.rejected_by) task.rejected_by = [];
    if (!task.rejected_by.includes(me)) task.rejected_by.push(me);
    task.updated_at = Date.now();
    this.tasks.set(task.id, task);
    this._saveLocal();
    TaskBoard?.dismiss?.(id);
    return { ok: true, task };
  },

  /**
   * Both parties must verify current stage; then auto-advance.
   * party: 'poster' | 'worker'
   */
  verifyStage(id, party) {
    const task = this.get(id);
    if (!task || !task.stages?.length) return { ok: false, error: 'no stages' };
    const i = Math.min(task.stage_index || 0, task.stages.length - 1);
    const st = task.stages[i];
    if (party === 'poster') st.poster_ok = true;
    else st.worker_ok = true;
    st.at = Date.now();
    task.updated_at = Date.now();

    if (st.poster_ok && st.worker_ok) {
      // Stage complete — advance status DNA
      const nextIdx = i + 1;
      if (nextIdx >= task.stages.length) {
        const term = task.kind === 'delivery' ? 'delivered' : 'done';
        task.stage_index = i;
        this.tasks.set(task.id, task);
        this._saveLocal();
        return this.advance(id, term);
      }
      task.stage_index = nextIdx;
      const sid = task.stages[nextIdx].id;
      const statusMap = {
        accepted: 'claimed',
        picked_up: 'picked_up',
        arrived: 'en_route',
        met: 'in_progress',
        in_progress: 'in_progress',
        delivered: 'delivered',
        done: 'done',
      };
      if (statusMap[sid] && this.STATUSES.includes(statusMap[sid])) {
        task.status = statusMap[sid];
      } else if (sid === 'accepted') {
        task.status = 'claimed';
      }
      // Routing when worker verifies accepted → guide to task pin
      if (st.id === 'accepted' && party === 'worker') {
        this._routeWorkerToTask(task);
      }
    }
    this.tasks.set(task.id, task);
    this._saveLocal();
    TaskBoard?.refreshActive?.(task);
    FieldBrain?.pulse?.('act', 'verify · ' + st.label, { task });
    return { ok: true, task, stage: st, both: !!(st.poster_ok && st.worker_ok) };
  },

  _routeWorkerToTask(task) {
    if (task?.lat == null) return;
    try {
      LazyModules?.ensure?.().then(() => {
        DrivingView?.setDestination?.(task.lat, task.lng);
        DrivingView?.activate?.();
        DrivingView?.fetchRoadRoute?.();
      }).catch(() => {
        DrivingView?.setDestination?.(task.lat, task.lng);
        DrivingView?.activate?.();
      });
    } catch (_) {
      try {
        DrivingView?.setDestination?.(task.lat, task.lng);
        DrivingView?.activate?.();
      } catch (_) {}
    }
    MapDepict?.pulse?.(task.lat, task.lng, 0x44ffaa, 'task', 12000);
  },

  /** Post a timed job (barman 3h, housekeeper 1w, …) */
  postJob(spec) {
    const s = typeof spec === 'string' ? this.parseSpec(spec) : (spec || {});
    if (typeof spec === 'string') {
      return this.create({
        kind: s.kind === 'dating' ? 'job' : (s.kind || 'job'),
        role: s.role,
        title: s.title,
        duration: s.duration,
        rawText: spec,
        note: 'job post',
      });
    }
    return this.create({
      kind: s.kind || 'job',
      role: s.role || 'worker',
      title: s.title,
      duration: s.duration || s.duration_label,
      rate: s.rate,
      rate_unit: s.rate_unit || 'hour',
      note: s.note || 'job post',
      lat: s.lat,
      lng: s.lng,
    });
  },

  /** Dating uses same claim DNA — open invite → accept → in progress → done */
  postDate(spec) {
    const s = typeof spec === 'string' ? this.parseSpec(spec) : (spec || {});
    const text = typeof spec === 'string' ? spec : (s.title || s.rawText || 'date');
    const p = this.parseSpec(text);
    return this.create({
      kind: 'dating',
      role: p.role || s.role || 'date',
      title: s.title || p.title || ('💕 Date · ' + (p.duration || s.duration || '2h')),
      duration: s.duration || p.duration || '2h',
      vibe: s.vibe || 'open',
      place_hint: s.place_hint || '',
      note: s.note || 'dating invite',
      lat: s.lat,
      lng: s.lng,
      rawText: text,
    });
  },

  postErrand(spec) {
    const s = typeof spec === 'string' ? this.parseSpec(spec) : (spec || {});
    const text = typeof spec === 'string' ? spec : (s.title || 'errand');
    const p = this.parseSpec(text);
    return this.create({
      kind: 'errand',
      role: p.role || 'errand',
      title: s.title || p.title,
      duration: s.duration || p.duration || '1h',
      note: s.note || 'errand',
      lat: s.lat,
      lng: s.lng,
      rawText: text,
    });
  },

  fromOrder(order, vendor, driver) {
    if (!order) return null;
    const existing = [...this.tasks.values()].find(t => t.order_id === order.id);
    if (existing) {
      existing.status = this._mapOrderStatus(order.status);
      existing.worker_id = driver?.id || order.driver_id || existing.worker_id;
      existing.worker_name = driver?.display_name || driver?.name || existing.worker_name;
      existing.driver_id = existing.worker_id;
      existing.driver_name = existing.worker_name;
      existing.updated_at = Date.now();
      this._saveLocal();
      this._showOnGlobe(existing);
      return existing;
    }
    return this.create({
      kind: 'delivery',
      role: 'driver',
      title: (vendor?.emoji || '📦') + ' ' + (vendor?.name || 'Order') + ' · ' + (order.short_id || order.id?.slice(0, 8)),
      lat: order.delivery_lat,
      lng: order.delivery_lng,
      vendor_id: vendor?.id || order.vendor_id,
      vendor_name: vendor?.name,
      order_id: order.id,
      short_id: order.short_id,
      items: order.items || [],
      duration: '45m',
      note: order.status || '',
    });
  },

  _mapOrderStatus(st) {
    const m = {
      pending: 'open',
      seeking_driver: 'open',
      assigned: 'assigned',
      picked_up: 'picked_up',
      en_route: 'en_route',
      delivered: 'delivered',
      cancelled: 'cancelled',
    };
    return m[st] || 'open';
  },

  /** Terminal statuses share DNA with delivery "delivered" */
  isOpen(t) {
    return t && !['delivered', 'done', 'cancelled'].includes(t.status);
  },

  list(filter) {
    let arr = [...this.tasks.values()].sort((a, b) => b.updated_at - a.updated_at);
    if (filter?.status) arr = arr.filter(t => t.status === filter.status);
    if (filter?.kind) arr = arr.filter(t => t.kind === filter.kind);
    if (filter?.role) arr = arr.filter(t => t.role === filter.role);
    if (filter?.open) arr = arr.filter(t => this.isOpen(t));
    if (filter?.dating) arr = arr.filter(t => t.kind === 'dating');
    if (filter?.jobs) arr = arr.filter(t => t.kind === 'job' || t.kind === 'service');
    return arr;
  },

  get(id) {
    if (!id) return null;
    const q = String(id);
    if (this.tasks.has(q)) return this.tasks.get(q);
    return [...this.tasks.values()].find(t =>
      t.id === q || t.order_id === q || (t.short_id && t.short_id.toUpperCase() === q.toUpperCase())
    ) || null;
  },

  /** Same claim DNA for driver / barman / housekeeper / date */
  async claim(idOrOrder) {
    let task = this.get(idOrOrder);
    if (!task && idOrOrder) {
      const order = await OrderTracking?.fetchOrder?.(idOrOrder);
      if (order) {
        const vendor = await OrderTracking?.resolveVendor?.(order.vendor_id);
        task = this.fromOrder(order, vendor, null);
      }
    }
    if (!task) {
      const open = this.list({ open: true })[0];
      if (open) task = open;
      else {
        const u = window._lastPos || { lat: 36.4341, lng: 28.2176 };
        task = this.create({
          kind: 'delivery',
          title: 'Demo delivery · claim me',
          lat: u.lat + 0.002,
          lng: u.lng - 0.001,
          duration: '45m',
          note: 'local demo',
        });
      }
    }
    if (!this.isOpen(task) && task.status !== 'open' && task.status !== 'assigned') {
      return { ok: false, error: 'not open', task };
    }
    const me = Auth?.user;
    const name = me?.user_metadata?.full_name || me?.email?.split('@')[0] || 'You';
    const id = me?.id || 'local-worker';
    task.status = 'claimed';
    task.worker_id = id;
    task.worker_name = name;
    // Delivery DNA aliases
    task.driver_id = id;
    task.driver_name = name;
    if (!task.start_at) task.start_at = Date.now();
    if (task.duration_ms && !task.end_at) task.end_at = task.start_at + task.duration_ms;
    if (task.kind === 'dating' && task.dating) task.dating.mutual = true;
    // First stage = accepted — worker already ok; poster still must verify
    if (task.stages?.[0]) {
      task.stages[0].worker_ok = true;
      task.stages[0].at = Date.now();
      task.stage_index = 0;
    }
    task.updated_at = Date.now();
    this.tasks.set(task.id, task);
    this._saveLocal();
    this._showOnGlobe(task);
    this._routeWorkerToTask(task);
    TaskBoard?.showActive?.(task);
    TaskBoard?.dismiss?.(task.id);
    const km = this.meta(task.kind);
    FieldBrain?.pulse?.('act', 'claimed · ' + task.title + ' · ' + (task.coins || 0) + '🪙', { task });
    GlobeDeck?.say?.(km.actionClaim + ': ' + task.title, 'ok');
    AciCli?.print?.(
      'city-task · claimed · ' + (task.coins || 0) + '🪙 · ' + task.title.slice(0, 32),
      'ok'
    );

    if (task.order_id && OrderTracking) {
      try {
        OrderTracking.onOrderPlaced?.({
          id: task.order_id,
          short_id: task.short_id,
          status: 'assigned',
          delivery_lat: task.lat,
          delivery_lng: task.lng,
          vendor_id: task.vendor_id,
        }, { id: task.vendor_id, name: task.vendor_name, lat: task.lat, lng: task.lng }, {
          id: task.worker_id,
          name: task.worker_name,
          field_lat: window._lastPos?.lat,
          field_lng: window._lastPos?.lng,
        });
      } catch (_) {}
    }
    return { ok: true, task };
  },

  /** Start work / go en route (delivery DNA mid-state) */
  startWork(id) {
    const task = this.get(id);
    if (!task) return { ok: false, error: 'not found' };
    const next = task.kind === 'delivery' ? 'en_route' : 'in_progress';
    return this.advance(id, next);
  },

  complete(id) {
    const task = this.get(id);
    if (!task) return { ok: false, error: 'not found' };
    // Delivery uses "delivered"; jobs/dating use "done" (also accepted as terminal)
    const st = task.kind === 'delivery' ? 'delivered' : 'done';
    return this.advance(id, st);
  },

  advance(id, status) {
    const task = this.get(id);
    if (!task) return { ok: false, error: 'not found' };
    // Normalize done ↔ delivered for shared DNA
    if (status === 'complete' || status === 'completed' || status === 'finished') {
      status = task.kind === 'delivery' ? 'delivered' : 'done';
    }
    if (!this.STATUSES.includes(status)) return { ok: false, error: 'bad status' };
    task.status = status;
    if (status === 'in_progress' || status === 'en_route') {
      if (!task.start_at) task.start_at = Date.now();
    }
    if (status === 'delivered' || status === 'done') {
      task.end_at = task.end_at || Date.now();
    }
    task.updated_at = Date.now();
    this.tasks.set(task.id, task);
    this._saveLocal();
    this._showOnGlobe(task);
    FieldBrain?.pulse?.('commerce', status + ' · ' + task.title, { task });
    AciCli?.print?.('city-task · ' + status + ' · ' + task.id.slice(0, 12), 'ok');
    return { ok: true, task };
  },

  cancel(id) {
    return this.advance(id, 'cancelled');
  },

  /** Simple quote using delivery-style distance + duration */
  quote(taskOrSpec) {
    const t = typeof taskOrSpec === 'string'
      ? this.parseSpec(taskOrSpec)
      : (taskOrSpec || {});
    const dur = this.parseDuration(t.duration || t.duration_label || t.duration_ms);
    const kind = t.kind || 'job';
    const hours = Math.max(dur.ms / 3600000, kind === 'delivery' ? 0.5 : 1);
    let rate = t.rate;
    if (rate == null) {
      if (kind === 'dating') rate = 0; // social — optional tip later
      else if (kind === 'delivery') rate = 3.5;
      else if (kind === 'errand') rate = 12;
      else rate = 15; // €/h default gig
    }
    const base = kind === 'dating' ? 0 : (kind === 'delivery' ? rate : rate * hours);
    const platform = Math.round(base * 0.1 * 100) / 100;
    return {
      kind,
      duration_label: dur.label,
      hours: Math.round(hours * 10) / 10,
      rate,
      labour_eur: Math.round(base * 100) / 100,
      platform_eur: platform,
      total_eur: Math.round((base + platform) * 100) / 100,
      currency: 'EUR',
    };
  },

  _showOnGlobe(task) {
    if (!task || task.lat == null || task.lng == null) return;
    const km = this.meta(task.kind);
    const statusIcon = {
      open: '📋', assigned: '🤝', claimed: '✋',
      picked_up: '📦', en_route: '🛵', in_progress: '⏳',
      delivered: '✅', done: '✅', cancelled: '❌',
    };
    const who = task.worker_name || task.driver_name;
    const dur = task.duration_label && task.duration_label !== 'open'
      ? ' · ' + task.duration_label : '';
    GlobeEntity?.register?.({
      id: 'city-task-' + task.id,
      type: (task.status === 'delivered' || task.status === 'done') ? 'order' : 'pilot',
      lat: task.lat,
      lng: task.lng,
      title: (statusIcon[task.status] || km.icon) + ' ' + (task.title || 'Task').slice(0, 40),
      description: task.kind + dur + (who ? ' · ' + who : ''),
      urgency: task.status === 'open' ? 3 : 2,
      color: km.color,
      persist: true,
      data: { task, alwaysShowLabel: task.status === 'open' },
      _actionLabel: task.status === 'open' ? km.actionClaim : 'Track',
      onTap: () => {
        if (task.status === 'open' || task.status === 'assigned') this.claim(task.id);
        else {
          GlobeControl?.flyToLatLng?.(task.lat, task.lng, task.title, GlobeControl?.Z?.city, {});
          AciCli?.print?.(
            task.kind + ' · ' + task.status + ' · ' + task.duration_label + ' · ' + task.title,
            'ok'
          );
        }
      },
    });
    MapDepict?.pulse?.(task.lat, task.lng, km.color, task.title.slice(0, 24), 6000);
  },

  async startDeliveryFlow(query) {
    await LazyModules?.ensure?.().catch(() => {});
    const u = window._lastPos || { lat: 36.4341, lng: 28.2176 };
    SpaceNetBrain?.crawlArea?.(u.lat, u.lng, 3);
    if (window.Commerce?.openOrderFlow) await Commerce.openOrderFlow(query || '');
    else if (Commerce?.smartOrder) await Commerce.smartOrder(query || 'delivery');
    else if (Commerce?.showPicker) await Commerce.showPicker();
    return this.create({
      kind: 'delivery',
      title: 'Delivery · ' + String(query || 'nearby').slice(0, 40),
      lat: u.lat,
      lng: u.lng,
      duration: '45m',
      note: 'pipeline · shops + drivers',
    });
  },

  catalogPrint() {
    this.CATALOG.forEach(c => {
      AciCli?.print?.(
        c.kind + ' · ' + c.role + ' · ' + c.title + ' · default ' + c.defaultDur,
        'dim'
      );
    });
    return this.CATALOG.length + ' roles';
  },

  wants(text) {
    const low = String(text || '').toLowerCase();
    return /\b(city\s*task|task\s*list|claim\s*(delivery|order|task|job|date)|deliver(y)?\s*(here|now)|assign\s*driver)\b/i.test(low)
      || /\b(barman|bartender|housekeeper|nanny|cleaner|errand|gig|hire|job\s+for|need\s+a)\b/i.test(low)
      || /\b(date|dating|coffee\s*date|dinner\s*date)\b/i.test(low)
      || /^task\b/i.test(low);
  },

  async handleCli(line) {
    const raw = String(line || '').trim();
    const low = raw.toLowerCase();
    const parts = raw.split(/\s+/);

    // Catalog
    if (/\bcatalog|roles|kinds\b/.test(low)) {
      return this.catalogPrint();
    }

    // List filters
    if (/\blist\b/.test(low) || /\btasks?\b/.test(low) && !/create|new|post|claim|hire|date|job/.test(low)) {
      let filter = { open: true };
      if (/dating|date/.test(low)) filter = { open: true, dating: true };
      else if (/job|gig|hire/.test(low)) filter = { open: true, jobs: true };
      else if (/errand/.test(low)) filter = { open: true, kind: 'errand' };
      else if (/deliver/.test(low)) filter = { open: true, kind: 'delivery' };
      const open = this.list(filter);
      if (!open.length) {
        return 'No open tasks · try: task job barman 3h · task date coffee 2h · task errand pharmacy';
      }
      open.slice(0, 10).forEach(t => {
        AciCli?.print?.(
          t.status + ' · ' + t.kind + ' · ' + t.duration_label + ' · ' + t.title.slice(0, 42),
          'ok'
        );
      });
      return open.length + ' open';
    }

    // Dating
    if (/\b(date|dating)\b/.test(low) && !/list|claim/.test(low)) {
      const body = raw.replace(/^(task|city)\s*/i, '').replace(/^(date|dating)\s*/i, '').trim();
      const t = this.postDate(body || 'coffee date 2h');
      const q = this.quote(t);
      return 'Date open · ' + t.title + ' · ' + t.duration_label + (q.total_eur ? '' : ' · social');
    }

    // Job / hire
    if (/\b(job|hire|gig|need\s+a|barman|housekeeper|nanny|cleaner|waiter|cook)\b/.test(low)
      && !/list|claim/.test(low)) {
      const body = raw.replace(/^(task|city)\s*/i, '')
        .replace(/^(job|hire|gig)\s*/i, '').trim();
      const t = this.postJob(body || 'barman 3h');
      const q = this.quote(t);
      return 'Job open · ' + t.title + ' · ' + t.duration_label
        + (q.total_eur ? ' · ~€' + q.total_eur : '');
    }

    // Errand
    if (/\berrand\b/.test(low) && !/list|claim/.test(low)) {
      const body = raw.replace(/^(task|city)\s*/i, '').replace(/^errand\s*/i, '').trim();
      const t = this.postErrand(body || 'pharmacy');
      return 'Errand open · ' + t.title + ' · ' + t.duration_label;
    }

    // Quote
    if (/\bquote|price|cost\b/.test(low)) {
      const body = raw.replace(/^.*?(quote|price|cost)\s*/i, '').trim() || 'barman 3h';
      const q = this.quote(body);
      AciCli?.print?.(
        q.kind + ' · ' + q.duration_label + ' · labour €' + q.labour_eur
        + ' + platform €' + q.platform_eur + ' ≈ €' + q.total_eur,
        'ok'
      );
      return 'Quote €' + q.total_eur;
    }

    // Create generic
    if (/\b(create|new|post)\b/.test(low)) {
      const body = raw.replace(/^.*?(create|new|post)\s*/i, '').trim() || 'City task';
      const t = this.create({ rawText: body, title: undefined });
      return 'Created ' + t.kind + ' · ' + t.id.slice(0, 12) + ' · ' + t.title;
    }

    // Claim
    if (/\b(claim|take|accept|assign)\b/.test(low)) {
      const id = parts.find(p => p.startsWith('ct_') || /^[0-9a-f-]{8,}$/i.test(p));
      const r = await this.claim(id || null);
      return r.ok
        ? ('Claimed · ' + r.task.kind + ' · ' + r.task.duration_label + ' · ' + r.task.title)
        : (r.error || 'claim failed');
    }

    // Progress / complete
    if (/\b(start|en.?route|progress|picked)\b/.test(low)) {
      const id = parts.find(p => this.get(p)) || this.list({ open: true }).find(t => t.worker_id)?.id;
      const r = this.startWork(id);
      return r.ok ? r.task.status : (r.error || 'fail');
    }
    if (/\b(done|complete|finish|deliver(ed)?)\b/.test(low)) {
      const id = parts.find(p => this.get(p))
        || this.list({}).find(t => t.worker_id && this.isOpen(t))?.id;
      const r = this.complete(id);
      return r.ok ? r.task.status : (r.error || 'fail');
    }

    // Delivery shop pipeline
    if (/\b(order|shop|delivery)\b/.test(low)) {
      await this.startDeliveryFlow(raw.replace(/^(task|city)\s*/i, ''));
      return 'Delivery pipeline · shops + task card';
    }

    const open = this.list({ open: true });
    return 'City DNA · open ' + open.length
      + ' · task job barman 3h · task date coffee 2h'
      + ' · task launch · task claim · task catalog';
  },
};
window.CityTasks = CityTasks;

// === TASK BOARD — Accept/Reject offers + multi-party stage UI ===
var TaskBoard = {
  _bound: false,
  _offer: null,
  _active: null,
  _seen: new Set(),

  init() {
    if (this._bound) return;
    this._bound = true;
    this._ensureDom();
    window.addEventListener('astranov-task-offer', (e) => this._onOffer(e.detail));
    window.addEventListener('storage', (e) => {
      if (e.key !== 'astranov:task-offer-pulse' || !e.newValue) return;
      try { this._onOffer(JSON.parse(e.newValue)); } catch (_) {}
    });
    try {
      const bc = new BroadcastChannel('astranov-tasks');
      bc.onmessage = (ev) => this._onOffer(ev.data);
      this._bc = bc;
    } catch (_) {}
    setInterval(() => {
      try {
        const raw = localStorage.getItem('astranov:task-offer-pulse');
        if (!raw) return;
        const p = JSON.parse(raw);
        if (p?.t && Date.now() - p.t < 8000) this._onOffer(p);
      } catch (_) {}
    }, 2500);
  },

  _ensureDom() {
    if (document.getElementById('task-offer-banner')) return;
    const root = document.createElement('div');
    root.id = 'task-board-root';
    root.innerHTML = ''
      + '<div id="task-offer-banner" role="alertdialog" aria-label="Task offer">'
      + '  <div id="to-kind"></div>'
      + '  <div id="to-title"></div>'
      + '  <div id="to-meta"></div>'
      + '  <div id="to-criteria"></div>'
      + '  <div id="to-actions">'
      + '    <button type="button" id="to-accept" class="to-accept">ACCEPT</button>'
      + '    <button type="button" id="to-reject" class="to-reject">REJECT</button>'
      + '  </div>'
      + '</div>'
      + '<div id="task-active-panel">'
      + '  <div id="ta-head"><span id="ta-title">Active task</span><button type="button" id="ta-close">✖</button></div>'
      + '  <div id="ta-body"></div>'
      + '  <div id="ta-stages"></div>'
      + '  <div id="ta-foot">'
      + '    <button type="button" id="ta-verify">Verify stage</button>'
      + '    <button type="button" id="ta-route">Route</button>'
      + '  </div>'
      + '</div>';
    document.body.appendChild(root);
    document.getElementById('to-accept')?.addEventListener('click', () => this._accept());
    document.getElementById('to-reject')?.addEventListener('click', () => this._reject());
    document.getElementById('ta-close')?.addEventListener('click', () => this.hideActive());
    document.getElementById('ta-verify')?.addEventListener('click', () => this._verify());
    document.getElementById('ta-route')?.addEventListener('click', () => {
      if (this._active) CityTasks?._routeWorkerToTask?.(this._active);
    });
  },

  _onOffer(payload) {
    if (!payload || payload.type !== 'astranov-task-offer' || !payload.task) return;
    const t = payload.task;
    if (this._seen.has(t.id + ':' + (payload.t || 0))) return;
    this._seen.add(t.id);
    this._seen.add(t.id + ':' + (payload.t || 0));
    if (!CityTasks.get(t.id)) {
      CityTasks.create({ ...t, id: t.id, status: 'open', launched: true });
    }
    const full = CityTasks.get(t.id) || t;
    if (!CityTasks.canServe(full)) return;
    this.showOffer(full);
  },

  showOffer(task) {
    this.init();
    this._offer = task;
    const el = document.getElementById('task-offer-banner');
    if (!el) return;
    const km = CityTasks.meta(task.kind);
    document.getElementById('to-kind').textContent =
      (km.icon || '📋') + ' ' + (km.label || task.kind) + ' · ' + (task.coins || 0) + ' 🪙';
    document.getElementById('to-title').textContent = task.title || 'Task';
    document.getElementById('to-meta').textContent =
      (task.radius_km || 3) + ' km · '
      + (task.duration_label || '') + ' · '
      + (task.poster_name || 'Someone')
      + (task.lat != null ? ' · ' + (+task.lat).toFixed(3) + ',' + (+task.lng).toFixed(3) : '');
    const crit = task.criteria || {};
    const bits = [];
    if (crit.age_min || crit.age_max) bits.push('Age ' + (crit.age_min || '?') + '–' + (crit.age_max || '?'));
    if (crit.looks) bits.push('Looks: ' + crit.looks);
    if (crit.role) bits.push('Need: ' + crit.role);
    if (task.dating?.vibe) bits.push('Vibe: ' + task.dating.vibe);
    if (task.note) bits.push(String(task.note).slice(0, 80));
    document.getElementById('to-criteria').textContent = bits.join(' · ') || 'Open to capable users in radius';
    el.classList.add('open');
    try { MapDepict?.pulse?.(task.lat, task.lng, 0xffcc44, 'task offer', 15000); } catch (_) {}
  },

  showOutgoing(task) {
    const zl = document.getElementById('zoom-label');
    if (zl) zl.textContent = 'Launched · ' + (task.coins || 0) + '🪙 · ' + (task.radius_km || 3) + 'km';
  },

  dismiss(id) {
    if (this._offer?.id === id || !id) {
      document.getElementById('task-offer-banner')?.classList.remove('open');
      this._offer = null;
    }
  },

  async _accept() {
    if (!this._offer) return;
    CityTasks?.init?.();
    const r = await CityTasks.claim(this._offer.id);
    if (r?.ok) {
      this.dismiss(this._offer.id);
      this.showActive(r.task);
    }
  },

  _reject() {
    if (!this._offer) return;
    CityTasks.reject(this._offer.id);
    this.dismiss(this._offer.id);
  },

  showActive(task) {
    this.init();
    this._active = task;
    const el = document.getElementById('task-active-panel');
    if (!el) return;
    document.getElementById('ta-title').textContent =
      (CityTasks.meta(task.kind).icon || '📋') + ' ' + (task.title || 'Task').slice(0, 36);
    const body = document.getElementById('ta-body');
    if (body) {
      body.innerHTML = ''
        + '<div>' + (task.coins || 0) + ' 🪙 · ' + (task.duration_label || '') + '</div>'
        + '<div class="ta-dim">' + (task.worker_name || '…') + ' ↔ ' + (task.poster_name || '') + '</div>'
        + '<div class="ta-dim">Both parties verify each stage</div>';
    }
    this.refreshActive(task);
    el.classList.add('open');
  },

  hideActive() {
    document.getElementById('task-active-panel')?.classList.remove('open');
  },

  refreshActive(task) {
    if (!task) return;
    this._active = task;
    const box = document.getElementById('ta-stages');
    if (!box || !task.stages) return;
    const idx = task.stage_index || 0;
    box.innerHTML = task.stages.map((s, i) => {
      const both = s.poster_ok && s.worker_ok;
      const cur = i === idx;
      const cls = both ? 'done' : (cur ? 'current' : 'pending');
      return '<div class="ta-stage ' + cls + '">'
        + '<b>' + (i + 1) + '. ' + (s.label || s.id) + '</b>'
        + '<span>P:' + (s.poster_ok ? '✓' : '·') + ' W:' + (s.worker_ok ? '✓' : '·') + '</span>'
        + '</div>';
    }).join('');
  },

  _verify() {
    const task = this._active;
    if (!task) return;
    const me = Auth?.user?.id || 'local';
    const party = (task.poster_id === me) ? 'poster' : 'worker';
    const r = CityTasks.verifyStage(task.id, party);
    if (r?.task) {
      this.refreshActive(r.task);
      if (['delivered', 'done'].includes(r.task.status)) {
        const zl = document.getElementById('zoom-label');
        if (zl) zl.textContent = 'Task complete · ' + (r.task.coins || 0) + '🪙';
      }
    }
  },
};
window.TaskBoard = TaskBoard;
try { TaskBoard.init(); } catch (_) {}

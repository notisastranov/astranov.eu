/* SpaceNet City DNA — jobs · dating · delivery · errands · search (local-first) */
(function (global) {
  'use strict';

  const KEY = 'sn:tasks-v1';
  const KINDS = {
    job: { icon: '💼', color: 0x66aaff, label: 'Job' },
    dating: { icon: '💕', color: 0xff6699, label: 'Date' },
    delivery: { icon: '📦', color: 0x44ffaa, label: 'Delivery' },
    errand: { icon: '🏃', color: 0xffcc44, label: 'Errand' },
    help: { icon: '🤝', color: 0x66ffcc, label: 'Help' },
  };

  const CATALOG = [
    { kind: 'job', role: 'barman', title: 'Barman / bartender', dur: '3h' },
    { kind: 'job', role: 'cleaner', title: 'Cleaner', dur: '4h' },
    { kind: 'job', role: 'nanny', title: 'Nanny', dur: '1d' },
    { kind: 'job', role: 'waiter', title: 'Waiter', dur: '5h' },
    { kind: 'job', role: 'tutor', title: 'Tutor', dur: '2h' },
    { kind: 'dating', role: 'coffee', title: 'Coffee date', dur: '1h' },
    { kind: 'dating', role: 'dinner', title: 'Dinner date', dur: '3h' },
    { kind: 'dating', role: 'walk', title: 'Walk date', dur: '2h' },
    { kind: 'delivery', role: 'driver', title: 'Food / package delivery', dur: '45m' },
    { kind: 'errand', role: 'pharmacy', title: 'Pharmacy run', dur: '45m' },
    { kind: 'errand', role: 'grocery', title: 'Grocery run', dur: '1h' },
  ];

  const T = {
    tasks: new Map(),
    pos: { lat: 36.4341, lng: 28.2176 },
  };

  function id() {
    return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      JSON.parse(raw).forEach((t) => {
        if (t?.id) T.tasks.set(t.id, t);
      });
    } catch (_) {}
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify([...T.tasks.values()].slice(-80)));
    } catch (_) {}
  }

  function parse(text) {
    const raw = String(text || '').trim();
    const low = raw.toLowerCase();
    let kind = 'job';
    let role = 'worker';
    let title = raw.slice(0, 60);
    let dur = '2h';

    const dm = low.match(/(\d+(?:\.\d+)?)\s*(h|hr|hours?|d|days?|m|min|w|weeks?)\b/);
    if (dm) {
      const u = dm[2][0];
      dur = dm[1] + (u === 'm' ? 'm' : u === 'd' ? 'd' : u === 'w' ? 'w' : 'h');
    }

    if (/\b(date|dating|coffee|dinner|romantic)\b/.test(low)) {
      kind = 'dating';
      role = /dinner/.test(low) ? 'dinner' : /walk/.test(low) ? 'walk' : 'coffee';
      title = KINDS.dating.icon + ' ' + (role === 'dinner' ? 'Dinner date' : role === 'walk' ? 'Walk date' : 'Coffee date') + ' · ' + dur;
    } else if (/\b(deliver|delivery|courier|package|food\s*order)\b/.test(low)) {
      kind = 'delivery';
      role = 'driver';
      title = KINDS.delivery.icon + ' Delivery · ' + dur;
    } else if (/\b(errand|pharmacy|grocery)\b/.test(low)) {
      kind = 'errand';
      role = /pharmacy/.test(low) ? 'pharmacy' : /grocery/.test(low) ? 'grocery' : 'errand';
      title = KINDS.errand.icon + ' ' + (role === 'pharmacy' ? 'Pharmacy' : role === 'grocery' ? 'Grocery' : 'Errand') + ' · ' + dur;
    } else {
      for (const c of CATALOG) {
        if (c.kind === 'job' && new RegExp('\\b' + c.role + '\\b').test(low)) {
          kind = 'job';
          role = c.role;
          if (!dm) dur = c.dur;
          title = KINDS.job.icon + ' ' + c.title + ' · ' + dur;
          break;
        }
      }
      if (kind === 'job' && title === raw.slice(0, 60)) {
        title = KINDS.job.icon + ' Job · ' + raw.slice(0, 40) + ' · ' + dur;
      }
    }
    return { kind, role, title, dur, raw };
  }

  function create(spec) {
    const p = typeof spec === 'string' ? parse(spec) : { ...parse(spec.raw || ''), ...spec };
    const meta = KINDS[p.kind] || KINDS.job;
    const task = {
      id: id(),
      kind: p.kind || 'job',
      role: p.role || 'worker',
      title: p.title || meta.icon + ' Task',
      status: 'open',
      lat: p.lat != null ? p.lat : T.pos.lat + (Math.random() - 0.5) * 0.03,
      lng: p.lng != null ? p.lng : T.pos.lng + (Math.random() - 0.5) * 0.03,
      dur: p.dur || '2h',
      created: Date.now(),
    };
    T.tasks.set(task.id, task);
    save();
    paint(task);
    return task;
  }

  function paint(task) {
    const meta = KINDS[task.kind] || KINDS.job;
    if (global.SNGlobe?.pulse) {
      SNGlobe.pulse(task.lat, task.lng, meta.color, task.title.slice(0, 22), 16000);
    }
    if (global.SNGlobe?.setHud) SNGlobe.setHud(meta.icon + ' ' + task.title.slice(0, 40));
  }

  function list(filter) {
    let arr = [...T.tasks.values()].filter((t) => t.status === 'open' || filter?.all);
    if (filter?.kind) arr = arr.filter((t) => t.kind === filter.kind);
    if (filter?.dating) arr = arr.filter((t) => t.kind === 'dating');
    if (filter?.jobs) arr = arr.filter((t) => t.kind === 'job');
    return arr.sort((a, b) => b.created - a.created);
  }

  function claim(taskId) {
    let task = taskId ? T.tasks.get(taskId) : null;
    if (!task) task = list()[0];
    if (!task) return { ok: false, error: 'no open tasks' };
    task.status = 'claimed';
    task.claimedAt = Date.now();
    T.tasks.set(task.id, task);
    save();
    paint(task);
    return { ok: true, task };
  }

  function complete(taskId) {
    let task = taskId ? T.tasks.get(taskId) : null;
    if (!task) {
      task = [...T.tasks.values()].find((t) => t.status === 'claimed' || t.status === 'in_progress');
    }
    if (!task) task = list()[0];
    if (!task) return { ok: false, error: 'no task to complete' };
    task.status = 'done';
    task.doneAt = Date.now();
    T.tasks.set(task.id, task);
    save();
    if (global.SNGlobe?.pulse) {
      SNGlobe.pulse(task.lat, task.lng, 0xffffff, 'done', 6000);
    }
    return { ok: true, task };
  }

  function search(q) {
    const low = String(q || '').toLowerCase();
    const words = low.split(/\s+/).filter((w) => w.length > 1);
    const hits = list({ all: true }).filter((t) => {
      const hay = (t.title + ' ' + t.kind + ' ' + t.role).toLowerCase();
      return words.some((w) => hay.includes(w));
    });
    const roles = CATALOG.filter((c) => words.some((w) => (c.title + c.role + c.kind).includes(w)));
    hits.forEach(paint);
    return { tasks: hits, roles };
  }

  function seedDemo() {
    try {
      if (localStorage.getItem('sn:demo-v1')) return;
      if (T.tasks.size) {
        localStorage.setItem('sn:demo-v1', '1');
        return;
      }
    } catch (_) {
      return;
    }
    [
      'barman 3h',
      'coffee date 1h',
      'delivery food 45m',
      'pharmacy errand',
      'cleaner 4h',
    ].forEach((t) => create(t));
    try {
      localStorage.setItem('sn:demo-v1', '1');
    } catch (_) {}
  }

  function setPos(lat, lng) {
    if (lat != null && lng != null) {
      T.pos = { lat, lng };
      global._snLastPos = T.pos;
    }
  }

  load();

  global.SNTasks = {
    create,
    list,
    claim,
    complete,
    search,
    parse,
    seedDemo,
    setPos,
    CATALOG,
    KINDS,
    get pos() {
      return T.pos;
    },
  };
})(window);

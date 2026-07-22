/* SpaceNet CLI — street DNA complete surface */
(function (global) {
  'use strict';

  const hist = [];
  let histIdx = -1;

  function $(id) {
    return document.getElementById(id);
  }

  function log(text, cls) {
    const box = $('cli-log');
    if (!box) return;
    const line = document.createElement('div');
    line.className = 'cli-line' + (cls ? ' ' + cls : '');
    line.textContent = text;
    box.appendChild(line);
    while (box.children.length > 100) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  }

  function preview(text) {
    const el = $('cli-preview');
    if (el) el.textContent = text || '';
    if (global.SNGlobe?.setHud) SNGlobe.setHud(text || '');
  }

  function help() {
    log('── SpaceNet · do anything on Earth ──', 'dim');
    log('WORK  job barman 3h · cleaner 4h · nanny 1d · tutor 2h', 'ok');
    log('DATE  date coffee · date dinner · dating walk', 'ok');
    log('MOVE  deliver food · errand pharmacy · errand grocery', 'ok');
    log('FIELD task list · task claim · task done · search nanny', 'ok');
    log('MAP   locate · city · earth · fly athens', 'ok');
    log('SYS   login · logout · solo · clear · help', 'dim');
    preview('job · date · deliver · search · locate · city');
  }

  const CITIES = {
    athens: [37.9838, 23.7275],
    rhodes: [36.4341, 28.2176],
    london: [51.5074, -0.1278],
    paris: [48.8566, 2.3522],
    berlin: [52.52, 13.405],
    rome: [41.9028, 12.4964],
    newyork: [40.7128, -74.006],
    tokyo: [35.6762, 139.6503],
    dubai: [25.2048, 55.2708],
    starbase: [25.997, -97.156],
  };

  async function run(raw) {
    const line = String(raw || '').trim();
    if (!line) return;
    hist.push(line);
    histIdx = hist.length;
    log('› ' + line, 'cmd');
    global.SNUi?.expandPanel?.(true);

    const low = line.toLowerCase();
    const Tasks = global.SNTasks;
    const Globe = global.SNGlobe;

    try {
      if (low === 'help' || low === '?' || low === 'commands') {
        help();
        return;
      }
      if (low === 'clear') {
        const box = $('cli-log');
        if (box) box.innerHTML = '';
        return;
      }
      if (low === 'solo' || low === 'status') {
        const n = Tasks?.list?.()?.length || 0;
        const build = document.querySelector('meta[name="astranov-build"]')?.content || '?';
        const who = global.SNAuth?.user?.email || 'guest';
        log('SpaceNet lite · build ' + build, 'ok');
        log('user ' + who + ' · open tasks ' + n, 'ok');
        log('We ship alone · https://astranov.eu', 'dim');
        preview('SpaceNet · ' + n + ' open · ' + who);
        return;
      }
      if (low === 'login' || low === 'signin' || low === 'sign in') {
        await global.SNAuth?.toggle?.();
        return;
      }
      if (low === 'logout' || low === 'signout' || low === 'sign out') {
        if (global.SNAuth?.user) await global.SNAuth.signOut();
        log('Signed out', 'dim');
        return;
      }
      if (low === 'locate' || low === 'me' || low === 'gps') {
        preview('Locating…');
        const pos = await Globe?.locate?.();
        if (pos) {
          Tasks?.setPos?.(pos.lat, pos.lng);
          log(
            pos.demo
              ? 'Located demo Rhodes · type city for street map'
              : 'Located ' + pos.lat.toFixed(4) + ', ' + pos.lng.toFixed(4),
            'ok'
          );
          preview(pos.demo ? 'You (demo)' : 'You · located');
        }
        return;
      }
      if (low === 'city' || low === 'map' || low === 'street' || low === 'city map') {
        const p = Tasks?.pos || (await Globe?.locate?.()) || { lat: 36.43, lng: 28.22 };
        if (p.lat) Tasks?.setPos?.(p.lat, p.lng);
        await global.SNMap?.open?.(p.lat, p.lng);
        return;
      }
      if (low === 'earth' || low === 'globe' || low === 'close map' || low === 'global') {
        global.SNMap?.close?.();
        log('Earth desktop', 'ok');
        return;
      }
      // fly city
      for (const [name, ll] of Object.entries(CITIES)) {
        if (new RegExp('^(fly\\s+)?' + name + '$', 'i').test(low) || low === 'fly ' + name) {
          Globe?.flyNear?.(ll[0], ll[1]);
          Globe?.pulse?.(ll[0], ll[1], 0xffffff, name, 12000);
          Tasks?.setPos?.(ll[0], ll[1]);
          log('Fly · ' + name, 'ok');
          preview(name);
          return;
        }
      }
      if (/^fly\s+/.test(low)) {
        const name = low.replace(/^fly\s+/, '').trim();
        const ll = CITIES[name.replace(/\s+/g, '')] || CITIES[name];
        if (ll) {
          Globe?.flyNear?.(ll[0], ll[1]);
          Globe?.pulse?.(ll[0], ll[1], 0xffffff, name, 12000);
          log('Fly · ' + name, 'ok');
        } else log('Unknown place · try: fly athens · fly starbase · fly london', 'dim');
        return;
      }
      if (/^task\s*list$|^list$|^tasks$/.test(low)) {
        const open = Tasks?.list?.() || [];
        if (!open.length) {
          log('No open tasks · job barman 3h · date coffee · deliver food', 'dim');
        } else {
          open.slice(0, 15).forEach((t) => {
            log((t.status || 'open') + ' · ' + t.kind + ' · ' + t.dur + ' · ' + t.title.slice(0, 42), 'ok');
            Globe?.pulse?.(t.lat, t.lng, (Tasks.KINDS[t.kind] || {}).color, t.title.slice(0, 16), 9000);
          });
          if (global.SNMap?.active) global.SNMap.showTasks?.();
          preview(open.length + ' open on globe');
        }
        return;
      }
      if (/^task\s*claim|^claim\b/.test(low)) {
        const tid = line.split(/\s+/).find((p) => p.startsWith('t_'));
        const r = Tasks?.claim?.(tid);
        if (r?.ok) {
          log('Claimed · ' + r.task.title, 'ok');
          preview('Claimed · ' + r.task.kind);
          if (global.SNMap?.active) global.SNMap.showTasks?.();
        } else log(r?.error || 'claim failed', 'err');
        return;
      }
      if (/^task\s*done|^done\b|^complete\b/.test(low)) {
        const tid = line.split(/\s+/).find((p) => p.startsWith('t_'));
        const r = Tasks?.complete?.(tid);
        if (r?.ok) {
          log('Done · ' + r.task.title, 'ok');
          preview('Completed · ' + r.task.kind);
        } else log(r?.error || 'nothing to complete', 'err');
        return;
      }
      if (/^task\s*catalog|^catalog$|^roles$/.test(low)) {
        (Tasks?.CATALOG || []).forEach((c) => log(c.kind + ' · ' + c.title + ' · ' + c.dur, 'ok'));
        return;
      }
      if (/^search\b|^find\b/.test(low)) {
        const q = line.replace(/^(search|find)\s+/i, '').trim() || line;
        const r = Tasks?.search?.(q) || { tasks: [], roles: [] };
        log('search · ' + q, 'cmd');
        r.tasks.slice(0, 8).forEach((t) => log('task · ' + t.title.slice(0, 50), 'ok'));
        r.roles.slice(0, 6).forEach((c) => log('role · ' + c.kind + ' · ' + c.title, 'ok'));
        if (!r.tasks.length && !r.roles.length) log('No hits · post: job ' + q, 'dim');
        preview('Search · ' + q.slice(0, 40));
        return;
      }
      if (/^date\b|^dating\b|coffee\s*date|dinner\s*date/.test(low)) {
        const t = Tasks?.create?.(line);
        log('Date open · ' + t.title, 'ok');
        preview(t.title);
        if (global.SNMap?.active) global.SNMap.showTasks?.();
        return;
      }
      if (/^deliver|^delivery\b|food\s*order|\bpackage\b/.test(low)) {
        const t = Tasks?.create?.(line.includes('deliver') || line.includes('delivery') ? line : 'delivery ' + line);
        log('Delivery open · ' + t.title, 'ok');
        preview(t.title);
        if (global.SNMap?.active) global.SNMap.showTasks?.();
        return;
      }
      if (/^errand\b|pharmacy|grocery\s*run/.test(low)) {
        const t = Tasks?.create?.(line);
        log('Errand open · ' + t.title, 'ok');
        preview(t.title);
        return;
      }
      if (
        /^job\b|^gig\b|^hire\b|barman|bartender|cleaner|nanny|waiter|tutor|need\s+a\b|looking\s+for\s+work/.test(
          low
        )
      ) {
        const t = Tasks?.create?.(line);
        log('Job open · ' + t.title, 'ok');
        preview(t.title);
        if (global.SNMap?.active) global.SNMap.showTasks?.();
        return;
      }
      if (/^order\b|^shops?\b|^market\b/.test(low)) {
        // Lightweight marketplace: open city + seed food delivery task
        const t = Tasks?.create?.('delivery food near me 45m');
        log('Market · opened delivery slot · ' + t.title, 'ok');
        log('Tip: city · then claim · or post job / date', 'dim');
        const p = Tasks?.pos || { lat: 36.43, lng: 28.22 };
        void global.SNMap?.open?.(p.lat, p.lng);
        preview('Market · delivery on field');
        return;
      }
      if ((/^help\b|need\s+help|anyone\s+can|can\s+someone/.test(low) && line.length < 120) || low === 'help me') {
        if (low === 'help' || low === 'help me') {
          /* if exact help already handled */ 
        }
        if (low !== 'help' && low !== '?') {
          const t = Tasks?.create?.({ kind: 'help', title: '🤝 ' + line.slice(0, 50), raw: line });
          log('Help open · ' + t.title, 'ok');
          preview(t.title);
          return;
        }
      }
      if (line.length < 100 && /\b(need|want|looking|work|job|date|deliver)\b/i.test(line)) {
        const t = Tasks?.create?.(line);
        log('Posted · ' + t.title, 'ok');
        preview(t.title);
        return;
      }

      log('Heard. Try: job barman 3h · date coffee · deliver food · city · locate · help', 'dim');
      preview('Type help');
    } catch (e) {
      log('Error: ' + (e.message || e), 'err');
    }
  }

  function init() {
    const form = $('cli-form');
    const input = $('cli-in');
    if (!form || !input || form._snBound) return;
    form._snBound = true;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value;
      input.value = '';
      void run(v);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (histIdx > 0) {
          histIdx--;
          input.value = hist[histIdx] || '';
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (histIdx < hist.length - 1) {
          histIdx++;
          input.value = hist[histIdx] || '';
        } else {
          histIdx = hist.length;
          input.value = '';
        }
      } else if (e.key === 'Escape') {
        global.SNMap?.close?.();
      }
    });
    $('btn-locate')?.addEventListener('click', () => void run('locate'));
    $('btn-help')?.addEventListener('click', () => void run('help'));
    log('SpaceNet online · type help', 'dim');
    preview('SpaceNet · job · date · deliver · city · locate');
  }

  global.SNCli = { init, run, log, help, preview };
})(window);

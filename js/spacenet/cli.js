/* SpaceNet CLI — do anything street DNA · no monolith */
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
    while (box.children.length > 80) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  }

  function preview(text) {
    const el = $('cli-preview');
    if (el) el.textContent = text || '';
    if (global.SNGlobe?.setHud) SNGlobe.setHud(text || '');
  }

  function help() {
    log('── SpaceNet CLI · city DNA on the globe ──', 'dim');
    log('job barman 3h · cleaner 4h · nanny 1d', 'ok');
    log('date coffee · date dinner · dating walk', 'ok');
    log('deliver food · errand pharmacy · help need a hand', 'ok');
    log('task list · task claim · search barman · locate', 'ok');
    log('clear · help · solo', 'dim');
    preview('Type a job, date, delivery, or search');
  }

  async function run(raw) {
    const line = String(raw || '').trim();
    if (!line) return;
    hist.push(line);
    histIdx = hist.length;
    log('› ' + line, 'cmd');

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
        log('SpaceNet lite · build ' + build, 'ok');
        log('open tasks ' + n + ' · we ship alone until partners answer', 'ok');
        log('Live https://astranov.eu', 'dim');
        preview('SpaceNet lite · ' + n + ' open');
        return;
      }
      if (low === 'locate' || low === 'me' || low === 'gps') {
        preview('Locating…');
        const pos = await Globe?.locate?.();
        if (pos) {
          Tasks?.setPos?.(pos.lat, pos.lng);
          log(
            pos.demo
              ? 'Located demo Rhodes · drag globe · type a job'
              : 'Located ' + pos.lat.toFixed(3) + ', ' + pos.lng.toFixed(3),
            'ok'
          );
          preview(pos.demo ? 'You (demo)' : 'You');
        }
        return;
      }
      if (/^task\s*list$|^list$|^tasks$/.test(low) || low === 'task list') {
        const open = Tasks?.list?.() || [];
        if (!open.length) {
          log('No open tasks · try: job barman 3h · date coffee · deliver food', 'dim');
        } else {
          open.slice(0, 12).forEach((t) => {
            log(t.kind + ' · ' + t.dur + ' · ' + t.title.slice(0, 48), 'ok');
            Globe?.pulse?.(t.lat, t.lng, (Tasks.KINDS[t.kind] || {}).color, t.title.slice(0, 18), 10000);
          });
          preview(open.length + ' open on globe');
        }
        return;
      }
      if (/^task\s*claim|^claim\b/.test(low)) {
        const id = line.split(/\s+/).find((p) => p.startsWith('t_'));
        const r = Tasks?.claim?.(id);
        if (r?.ok) {
          log('Claimed · ' + r.task.title, 'ok');
          preview('Claimed · ' + r.task.kind);
        } else log(r?.error || 'claim failed', 'err');
        return;
      }
      if (/^search\b|^find\b/.test(low)) {
        const q = line.replace(/^(search|find)\s+/i, '').trim() || line;
        const r = Tasks?.search?.(q) || { tasks: [], roles: [] };
        log('search · ' + q, 'cmd');
        if (r.tasks.length) {
          r.tasks.slice(0, 8).forEach((t) => log('task · ' + t.title.slice(0, 50), 'ok'));
        }
        if (r.roles.length) {
          r.roles.slice(0, 6).forEach((c) => log('role · ' + c.kind + ' · ' + c.title, 'ok'));
        }
        if (!r.tasks.length && !r.roles.length) {
          log('No hits · post with: job ' + q + ' · date ' + q, 'dim');
        }
        preview('Search · ' + q.slice(0, 40));
        return;
      }
      if (/^date\b|^dating\b|coffee\s*date|dinner\s*date/.test(low)) {
        const t = Tasks?.create?.(line);
        log('Date open · ' + t.title, 'ok');
        preview(t.title);
        return;
      }
      if (/^deliver|^delivery\b|food\s*order|package/.test(low)) {
        const t = Tasks?.create?.(line.includes('deliver') ? line : 'delivery ' + line);
        log('Delivery open · ' + t.title, 'ok');
        preview(t.title);
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
        return;
      }
      if (/^help\b|need\s+help|anyone\s+can|can\s+someone/.test(low) && line.length < 120) {
        const t = Tasks?.create?.({ kind: 'help', title: '🤝 ' + line.slice(0, 50), raw: line });
        log('Help open · ' + t.title, 'ok');
        preview(t.title);
        return;
      }

      // Freeform → treat as job post if short, else echo guide
      if (line.length < 100 && /\b(need|want|looking|work|job|date|deliver)\b/i.test(line)) {
        const t = Tasks?.create?.(line);
        log('Posted · ' + t.title, 'ok');
        preview(t.title);
        return;
      }

      log('SpaceNet heard you. Try: job barman 3h · date coffee · deliver food · search · locate · help', 'dim');
      preview('Type help for commands');
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
      }
    });
    $('btn-locate')?.addEventListener('click', () => void run('locate'));
    $('btn-help')?.addEventListener('click', () => void run('help'));
    log('SpaceNet online · type help', 'dim');
    preview('SpaceNet · job · date · deliver · search · locate');
  }

  global.SNCli = { init, run, log, help, preview };
})(window);

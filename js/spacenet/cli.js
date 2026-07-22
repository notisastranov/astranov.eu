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
    log('── Astranov SpaceNet ──', 'dim');
    log('WORK  job barman 3h · cleaner 4h · nanny 1d', 'ok');
    log('DATE  date coffee · date dinner · dating walk', 'ok');
    log('MOVE  deliver food · errand pharmacy', 'ok');
    log('FIELD task list · task claim · task done', 'ok');
    log('ZOOM  solar · global · national · city · earth', 'ok');
    log('MAP   locate · city · fly athens · crawl restaurants', 'ok');
    log('FIND  crawl|find|search <anything> · research <q>  (almighty multi-source)', 'ok');
    log('CODE  code <ask> · coders <build>  (Astranov = Grok-fork writes modules)', 'ok');
    log('TILE  me · profile · roles · menu · cart · vendors · drivers · dates', 'ok');
    log('BRAIN brain · verify · law  (anti-amnesia memory)', 'ok');
    log('SYS   login · logout · solo · clear · help', 'dim');
    preview('crawl anything · code … · city tiles · job · date');
  }

  function dumpBrain(mode) {
    const B = global.SNBrain;
    if (!B) {
      log('Brain offline — js/spacenet/brain.js missing', 'err');
      return;
    }
    if (mode === 'verify') {
      const v = B.verify();
      log(v.ok ? '── Brain VERIFY OK ──' : '── Brain VERIFY FAIL ──', v.ok ? 'ok' : 'err');
      (v.checks || []).forEach((c) => {
        log((c.pass ? '✓ ' : '✗ ') + c.id + (c.detail ? ' · ' + c.detail : ''), c.pass ? 'ok' : 'err');
      });
      preview(v.ok ? 'Brain OK · ' + v.build : 'Brain FAIL');
      return;
    }
    const lines = mode === 'law' ? B.lawLines() : B.summaryLines();
    lines.forEach((ln) => log(ln, /✗|FAIL|WHY/.test(ln) ? 'dim' : 'ok'));
    preview('Astranov Brain · type verify');
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
      if (low === 'brain' || low === 'memory' || low === 'mind') {
        dumpBrain('summary');
        return;
      }
      if (low === 'law' || low === 'rules' || low === 'invariants') {
        dumpBrain('law');
        return;
      }
      if (low === 'verify' || low === 'check' || low === 'brain verify' || low === 'verify brain') {
        dumpBrain('verify');
        return;
      }
      // Unified multi-role tile juice
      if (low === 'me' || low === 'profile' || low === 'tile' || low === 'plus' || low === 'my tile') {
        global.SNTile?.openMe?.();
        log('Your tile · cover · avatar · tap roles: social dating vendor driver client work', 'ok');
        return;
      }
      if (low === 'roles' || low === 'role') {
        const me = global.SNProfiles?.me?.();
        if (!me) {
          log('Profiles loading…', 'dim');
          return;
        }
        Object.keys(global.SNProfiles.ROLES).forEach((k) => {
          log((me.roles[k] ? '● ' : '○ ') + k + ' · ' + global.SNProfiles.ROLES[k].label, me.roles[k] ? 'ok' : 'dim');
        });
        log('Toggle: role vendor · role dating · role driver', 'dim');
        global.SNTile?.openMe?.('about');
        return;
      }
      if (/^role\s+/.test(low)) {
        const role = low.replace(/^role\s+/, '').trim().split(/\s+/)[0];
        const me = global.SNProfiles?.me?.();
        if (!me || !global.SNProfiles.ROLES[role]) {
          log('Roles: social dating vendor driver client worker', 'dim');
          return;
        }
        const p = global.SNProfiles.toggleRole(me.id, role);
        log('Role ' + role + ' · ' + (p.roles[role] ? 'ON' : 'off'), 'ok');
        global.SNTile?.open?.(p);
        global.SNMap?.showProfiles?.();
        return;
      }
      if (low === 'vendors' || low === 'shops' || low === 'menu') {
        const list = global.SNProfiles?.list?.({ role: 'vendor' }) || [];
        if (!list.length) {
          global.SNProfiles?.seedCity?.();
        }
        const vendors = global.SNProfiles?.list?.({ role: 'vendor' }) || [];
        vendors.slice(0, 12).forEach((v) => {
          log('🏪 ' + (v.shopName || v.name) + ' · ' + (v.menu?.length || 0) + ' items', 'ok');
        });
        const first = vendors[0];
        if (first) {
          if (first.lat != null) await global.SNMap?.open?.(first.lat, first.lng);
          global.SNMap?.showProfiles?.();
          global.SNTile?.open?.(first, { tab: 'menu' });
        }
        preview((vendors.length || 0) + ' vendors on map');
        return;
      }
      if (low === 'drivers' || low === 'driver') {
        const list = global.SNProfiles?.list?.({ role: 'driver' }) || [];
        if (!list.length) global.SNProfiles?.seedCity?.();
        (global.SNProfiles?.list?.({ role: 'driver' }) || []).forEach((d) => {
          log(
            '🛵 ' + d.name + ' · ' + (d.driverOnline ? 'ONLINE' : 'off') + ' · ' + (d.vehicle || ''),
            d.driverOnline ? 'ok' : 'dim'
          );
        });
        const d0 = (global.SNProfiles?.list?.({ role: 'driver' }) || [])[0];
        if (d0?.lat != null) {
          await global.SNMap?.open?.(d0.lat, d0.lng);
          global.SNMap?.showProfiles?.();
          global.SNTile?.open?.(d0, { tab: 'drive' });
        }
        return;
      }
      if (low === 'dates' || low === 'dating people' || low === 'people') {
        if (!(global.SNProfiles?.list?.({ role: 'dating' }) || []).length) global.SNProfiles?.seedCity?.();
        (global.SNProfiles?.list?.({ role: 'dating' }) || []).forEach((d) => {
          log('💕 ' + d.name + ' · ' + (d.lookingFor || 'open'), 'ok');
        });
        const d0 = (global.SNProfiles?.list?.({ role: 'dating' }) || [])[0];
        if (d0) {
          if (d0.lat != null) await global.SNMap?.open?.(d0.lat, d0.lng);
          global.SNMap?.showProfiles?.();
          global.SNTile?.open?.(d0, { tab: 'dating' });
        }
        return;
      }
      if (low === 'cart' || low === 'basket') {
        const items = global.SNProfiles?.cart?.() || [];
        if (!items.length) log('Cart empty · vendors · tap + on menu items', 'dim');
        else {
          items.forEach((i) => log('· ' + i.name + ' €' + i.price + ' · ' + i.vendorName, 'ok'));
          log('Total €' + (global.SNProfiles.cartTotal() || 0).toFixed(2), 'ok');
        }
        global.SNTile?.openMe?.('cart');
        return;
      }
      if (low === 'order' || low === 'checkout' || low === 'pay') {
        const r = global.SNProfiles?.placeOrder?.();
        if (!r?.ok) {
          log(r?.error || 'cart empty · open vendors first', 'err');
          return;
        }
        log('Order €' + r.total.toFixed(2) + ' · delivery opened for drivers', 'ok');
        await global.SNMap?.open?.();
        global.SNMap?.showTasks?.();
        global.SNMap?.showProfiles?.();
        return;
      }
      if (low === 'seed' || low === 'seed city' || low === 'tiles') {
        const pos = Tasks?.pos || global._snLastPos || { lat: 36.43, lng: 28.22 };
        global.SNProfiles?.seedCity?.(pos.lat, pos.lng);
        await global.SNMap?.open?.(pos.lat, pos.lng);
        global.SNMap?.showProfiles?.();
        log('Seeded map tiles · vendors · dating · drivers · social', 'ok');
        return;
      }
      if (low === 'solo' || low === 'status') {
        const n = Tasks?.list?.()?.length || 0;
        const build = document.querySelector('meta[name="astranov-build"]')?.content || '?';
        const who = global.SNAuth?.user?.email || 'guest';
        const tier = Globe?.tier || '?';
        const phys = Globe?.getPhysics?.();
        log('Astranov SpaceNet · build ' + build + ' · zoom ' + tier, 'ok');
        log('user ' + who + ' · open tasks ' + n, 'ok');
        log(
          'AI ' +
            (global.SNAi ? 'ready' : 'loading') +
            ' · brain ' +
            (global.SNBrain?.version || 'off') +
            (phys ? ' · inertia damp ' + phys.damp : ''),
          'dim'
        );
        log('https://astranov.eu · type brain · verify', 'dim');
        preview('Astranov SpaceNet · ' + tier + ' · ' + n + ' tasks');
        return;
      }
      // Zoom tiers
      if (low === 'solar' || low === 'zoom solar' || low === 'galaxy') {
        Globe?.goToTier?.('solar');
        log('Zoom · SOLAR', 'ok');
        return;
      }
      if (low === 'global' || low === 'earth' || low === 'world' || low === 'zoom global' || low === 'zoom earth') {
        global.SNMap?.close?.();
        Globe?.goToTier?.('global');
        log('Zoom · GLOBAL Earth', 'ok');
        return;
      }
      if (low === 'national' || low === 'country' || low === 'zoom national') {
        global.SNMap?.close?.();
        Globe?.goToTier?.('national');
        log('Zoom · NATIONAL', 'ok');
        return;
      }
      if (low === 'zoom city' || low === 'zoom street') {
        const p = Tasks?.pos || global._snLastPos || { lat: 36.43, lng: 28.22 };
        Globe?.goToTier?.('city');
        await global.SNMap?.open?.(p.lat, p.lng);
        log('Zoom · CITY / street map', 'ok');
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
        const p = Tasks?.pos || global._snLastPos || (await Globe?.locate?.()) || { lat: 36.43, lng: 28.22 };
        if (p.lat) Tasks?.setPos?.(p.lat, p.lng);
        Globe?.goToTier?.('city');
        await global.SNMap?.open?.(p.lat, p.lng);
        return;
      }
      if (low === 'globe' || low === 'close map' || low === 'back' || low === 'home') {
        global.SNMap?.close?.();
        Globe?.goToTier?.('global');
        log('Back to Earth · GLOBAL', 'ok');
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
      if (
        /^search\b|^find\b|^google\b|^maps\b|^crawl\b|^where\s+is\b|^look\s+up\b|^what\s+is\b|^who\s+is\b|^almighty\b/.test(
          low
        )
      ) {
        const q =
          line
            .replace(
              /^(search|find|google|maps|crawl|almighty|where\s+is|look\s+up|what\s+is|who\s+is)\s+/i,
              ''
            )
            .trim() || line;
        const local = Tasks?.search?.(q) || { tasks: [], roles: [] };
        local.tasks.slice(0, 4).forEach((t) => log('task · ' + t.title.slice(0, 50), 'ok'));
        if (global.SNSearch?.crawl) {
          const crawled = await SNSearch.crawl(q, {
            pos: Tasks?.pos || global._snLastPos,
            openMap: true,
            all: true,
          });
          SNSearch.report?.(crawled, log);
          if (!crawled.score) log('Empty · try: crawl pizza · find Greece · code three.js', 'dim');
        } else if (!local.tasks.length) {
          log('Search module loading… try again', 'dim');
        }
        preview('Almighty · ' + q.slice(0, 40));
        if (global.SNAi?.ask) {
          void SNAi.ask(
            'User almighty-crawled: ' + q + '. One short SpaceNet tip with a CLI next step.',
            { mode: 'chat' }
          ).then((tip) => {
            if (tip) log(tip, 'dim');
          });
        }
        return;
      }
      if (/^research\b/.test(low)) {
        const q = line.replace(/^research\s+/i, '').trim() || 'Astranov SpaceNet';
        preview('Research · ' + q);
        if (global.SNAi?.research) {
          const r = await SNAi.research(q);
          if (r?.text) log(r.text, 'ok');
        } else {
          await run('crawl ' + q);
        }
        return;
      }
      if (/^code\b|^write\s+code\b|^implement\b|^patch\b/.test(low) || /^coders\b/.test(low)) {
        const ask = line
          .replace(/^(code|write\s+code|implement|patch|coders)\s+/i, '')
          .trim() || line;
        preview('Astranov coding…');
        log('── Astranov (Grok-fork) · code ──', 'dim');
        const reply = global.SNAi?.code
          ? await (low.startsWith('coders') ? SNAi.coders(ask) : SNAi.code(ask))
          : await SNAi?.ask?.(ask, { mode: 'code' });
        if (reply) {
          // Split long code across log lines
          String(reply)
            .split('\n')
            .forEach((ln) => log(ln.slice(0, 200), /```/.test(ln) ? 'dim' : 'ok'));
          preview(reply.slice(0, 80));
        } else log('Code edge offline · try again · brain still holds law', 'err');
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

      // Freeform → Grok edge (optional); never block if offline
      preview('Thinking…');
      if (global.SNAi?.ask) {
        const reply = await SNAi.ask(line);
        if (reply) {
          log(reply, 'ok');
          preview(reply.slice(0, 80));
          return;
        }
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
    $('btn-earth')?.addEventListener('click', () => void run('earth'));
    log('Astranov SpaceNet online · type help', 'dim');
    preview('Astranov SpaceNet · national · city · crawl · job · date');
  }

  global.SNCli = { init, run, log, help, preview };
})(window);

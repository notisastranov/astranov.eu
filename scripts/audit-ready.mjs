#!/usr/bin/env node
/**
 * Self-audit: CityTasks DNA + key source contracts (no browser).
 * Run: node scripts/audit-ready.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
let failed = 0;
const ok = (name, cond, detail = '') => {
  if (cond) console.log('  ✓ ' + name + (detail ? ' — ' + detail : ''));
  else {
    console.error('  ✗ ' + name + (detail ? ' — ' + detail : ''));
    failed++;
  }
};

async function main() {
  console.log('\n=== Astranov ready audit ===\n');

  console.log('Files');
  const need = [
    'src/76-city-tasks.js',
    'src/79-product-surface.js',
    'src/75-starship-flight13.js',
    'src/77-starlink-constellation.js',
    'src/78-globe-info-tiles.js',
    'src/02-lazy-modules.js',
    'astranov-mpp-tile.js',
    'astranov-field-hud.js',
    'astranov-perf-lazy.js',
    'index.html',
    'astranov-deferred.js',
  ];
  for (const f of need) ok(f, fs.existsSync(path.join(ROOT, f)));

  console.log('\nindex.html');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok('build meta', /astranov-build/.test(html));
  ok('perf lite', /_globePerfLite/.test(html));
  ok('CityTasks DNA', /barman|postJob|City DNA|dating|housekeeper/.test(html));
  ok('no static deferred tag', !/src="\/astranov-deferred\.js/.test(html));
  ok('perf-lazy script', /astranov-perf-lazy\.js/.test(html));
  ok('video call id', /aci-video-call/.test(html));
  ok('ProductSurface', /ProductSurface/.test(html));
  ok('StarshipFlight13', /StarshipFlight13/.test(html));
  ok('idle frame skip', /skipN/.test(html));

  console.log('\nCityTasks DNA');
  const ctSrc = fs.readFileSync(path.join(ROOT, 'src/76-city-tasks.js'), 'utf8');
  const sandbox = {
    console,
    window: {},
    Auth: null,
    localStorage: {
      _d: {},
      getItem(k) { return this._d[k] ?? null; },
      setItem(k, v) { this._d[k] = String(v); },
    },
    FieldBrain: null,
    AciCli: { print() {} },
    GlobeDeck: { say() {} },
    GlobeEntity: { register() {} },
    MapDepict: { pulse() {} },
    OrderTracking: null,
    LazyModules: { ensure: async () => {} },
    SpaceNetBrain: null,
    Commerce: null,
    GlobeControl: null,
    Date, Math, Map, String, Array, Object, JSON, parseFloat, isNaN,
    setTimeout, clearTimeout,
  };
  vm.createContext(sandbox);
  vm.runInContext(ctSrc + '\nthis.CityTasks = CityTasks;', sandbox);
  const CT = sandbox.CityTasks || sandbox.window.CityTasks;
  ok('CityTasks global', !!CT);

  if (CT) {
    CT.init();
    const cases = [
      { in: 'barman 3h', kind: 'job', role: 'barman', dur: '3h' },
      { in: 'housekeeper 1w', kind: 'job', role: 'housekeeper', dur: '1w' },
      { in: 'coffee date 2h', kind: 'dating', dur: '2h' },
      { in: 'pharmacy errand', kind: 'errand' },
      { in: 'delivery package', kind: 'delivery' },
    ];
    for (const c of cases) {
      const p = CT.parseSpec(c.in);
      ok(
        'parse ' + c.in,
        p.kind === c.kind && (!c.role || p.role === c.role) && (!c.dur || p.duration === c.dur),
        JSON.stringify(p)
      );
    }
    const job = CT.postJob('barman 3 hours');
    ok('postJob barman', job?.kind === 'job' && job.duration_ms === 3 * 3600 * 1000, job?.duration_label);
    const date = CT.postDate('dinner date 3h');
    ok('postDate dinner', date?.kind === 'dating' && date.duration_label === '3h', date?.title);
    const err = CT.postErrand('pharmacy');
    ok('postErrand', err?.kind === 'errand');
    const q = CT.quote(job);
    ok('quote has total', q.total_eur > 0, '€' + q.total_eur);
    const claim = await CT.claim(job.id);
    ok('claim job', claim.ok && claim.task.status === 'claimed');
    const done = CT.complete(job.id);
    ok('complete job', done.ok && (done.task.status === 'done' || done.task.status === 'delivered'));
    ok('catalog size', CT.CATALOG.length >= 15, String(CT.CATALOG.length));
    ok('wants dating', CT.wants('coffee date 2h'));
    ok('wants barman', CT.wants('need a barman for 3 hours'));
  }

  console.log('\nMPP / surface');
  const mpp = fs.readFileSync(path.join(ROOT, 'astranov-mpp-tile.js'), 'utf8');
  ok('mpp post_job', /post_job/.test(mpp));
  ok('mpp post_date', /post_date/.test(mpp));
  ok('mpp post_errand', /post_errand/.test(mpp));
  const ps = fs.readFileSync(path.join(ROOT, 'src/79-product-surface.js'), 'utf8');
  ok('surface citydna', /mpp-section-citydna|post_job/.test(ps));

  console.log('\nPerf contracts');
  const lazy = fs.readFileSync(path.join(ROOT, 'src/02-lazy-modules.js'), 'utf8');
  const dboot = fs.readFileSync(path.join(ROOT, 'src/97-deferred-boot.js'), 'utf8');
  ok('deferred not auto-run at parse', !/^\s*DeferredBoot\.run\(\)\s*;\s*$/m.test(dboot));
  ok('lazy schedule mobile delay', /6500|first tap|pointerdown/.test(lazy));

  console.log('\n=== ' + (failed ? failed + ' FAILED' : 'ALL PASS') + ' ===\n');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

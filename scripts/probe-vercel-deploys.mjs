const urls = [
  'https://astranov-153aygbct-astranov.vercel.app/',
  'https://astranov-153aygbct-astranov.vercel.app/js/phase-critical.js',
  'https://astranov-153aygbct-astranov.vercel.app/astranov-critical.js',
  'https://astranov-p0vb7ebgn-astranov.vercel.app/',
  'https://astranov-prrzq3pgq-astranov.vercel.app/',
  'https://astranov.eu/',
];
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
    const t = await r.text();
    const build = t.match(/astranov-build" content="([^"]+)/)?.[1];
    const mode = t.match(/"mode":"([^"]+)"/)?.[[0]] && t.match(/"mode":"([^"]+)"/)?.[1];
    const phase = t.includes('/js/phase-critical');
    const boot = t.includes('__astranovBootCritical') || t.includes('WebGLRenderer');
    console.log(
      r.status,
      String(t.length).padStart(8),
      'build=' + (build || '-'),
      'mode=' + (mode || '-'),
      'phasePath=' + phase,
      'bootCode=' + boot,
      u.replace('https://', '').slice(0, 55)
    );
  } catch (e) {
    console.log('ERR', u, e.message);
  }
}

const h = await (await fetch('https://astranov.eu/', { cache: 'no-store' })).text();
const build = h.match(/astranov-build" content="([^"]+)/)?.[1];
const man = h.match(/__ASTRANOV_MANIFEST__=(\{.*?\});/)?.[1];
console.log('bytes', h.length);
console.log('build', build || 'none');
console.log('hasManifest', !!man);
console.log('hasLoader', h.includes('/js/loader.js'));
console.log('hasThree', h.includes('three.min'));
console.log('inlineKB', Math.round(((h.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi) || []).reduce((a, s) => a + s.length, 0)) / 1024));
if (man) {
  try {
    const j = JSON.parse(man);
    console.log('mode', j.mode);
    console.log('critical', j.critical);
  } catch (e) {
    console.log('man parse fail', man.slice(0, 200));
  }
}
// probe critical path if any
const crit = man ? JSON.parse(man).critical?.[0] : null;
if (crit) {
  const u = crit.startsWith('http') ? crit : 'https://astranov.eu' + (crit.startsWith('/') ? crit : '/' + crit);
  const r = await fetch(u, { cache: 'no-store' });
  const t = await r.text();
  console.log('critical asset', r.status, t.length, crit, t.includes('WebGL') || t.includes('Boot') ? 'ok-ish' : 'bad');
}
// if monolith, check for animate/globe
console.log('hasGlobePivot', h.includes('globePivot') || h.includes('WebGLRenderer'));
console.log('hasAnimate', h.includes('function animate') || h.includes('requestAnimationFrame(animate'));

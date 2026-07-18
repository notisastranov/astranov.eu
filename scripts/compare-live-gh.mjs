const live = await (await fetch('https://astranov.eu/', {
  cache: 'no-store',
  headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
})).text();
const gh = await (await fetch('https://raw.githubusercontent.com/notisastranov/astranov.eu/main/index.html', {
  cache: 'no-store',
})).text();

const pick = (html, re) => html.match(re)?.[1];
console.log('live build', pick(live, /astranov-build" content="([^"]+)/));
console.log('gh build  ', pick(gh, /astranov-build" content="([^"]+)/));
console.log('live mode ', pick(live, /"mode":"([^"]+)"/));
console.log('gh mode   ', pick(gh, /"mode":"([^"]+)"/));
console.log('live phase path', live.includes('/js/phase-critical'));
console.log('gh phase path  ', gh.includes('/js/phase-critical'));
console.log('live critical root', live.includes('/astranov-critical.js'));
console.log('gh critical root  ', gh.includes('/astranov-critical.js'));
console.log('lens', live.length, gh.length);

// Try CF cache bypass headers / different URL
const bust = await (await fetch('https://astranov.eu/?nocache=' + Date.now(), {
  cache: 'no-store',
  headers: { 'Cache-Control': 'no-cache' },
})).text();
console.log('bust build', pick(bust, /astranov-build" content="([^"]+)/));
console.log('bust phase', bust.includes('/js/phase-critical'));

#!/usr/bin/env node
/** Live smoke check — continuity build + core modules present */
const html = await fetch('https://astranov.eu/?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.text());
const build = (html.match(/astranov-build[^>]+content="([^"]+)"/) || [])[1];
const continuity = (html.match(/astranov-continuity[^>]+content="([^"]+)"/) || [])[1];
const checks = {
  build,
  continuity,
  hasApp: html.includes('astranov-app.js'),
  hasPerfLazy: html.includes('astranov-perf-lazy.js'),
  hasContinuityScript: html.includes('astranov-continuity.js'),
  hasFieldHud: html.includes('astranov-field-hud.js'),
  hasMppTile: html.includes('astranov-mpp-tile.js'),
  hasMppDom: html.includes('menu-profile-post-tile'),
  hasVideoCall: html.includes('aci-video-call'),
  noCliMiner: !html.includes('miner-cli-strip') && !html.includes('id="aci-miner"'),
  hasGlobeDeck: html.includes('#globe-deck') || html.includes('globe-deck'),
  hasMinerPanel: html.includes('miner-rig-panel'),
};
const ok = checks.hasApp
  && checks.hasPerfLazy
  && checks.hasContinuityScript
  && checks.hasMppDom
  && checks.hasVideoCall
  && checks.noCliMiner
  && checks.hasGlobeDeck
  && build && continuity;
console.log(JSON.stringify({ ok, ...checks }, null, 2));
process.exit(ok ? 0 : 1);
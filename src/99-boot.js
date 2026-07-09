function animate() {
  requestAnimationFrame(animate);
  if (!drag) {
    globePivot.rotation.y += idleRoll + trackVelX;
    globePivot.rotation.x += trackVelY;
    globePivot.rotation.x = Math.max(-1.25, Math.min(1.25, globePivot.rotation.x));
    trackVelX *= 0.94;
    trackVelY *= 0.94;
  }
  // pilot pulse to make it alive
  if (window._pilot) {
    const t = Date.now() / 600;
    const s = 1 + Math.sin(t) * 0.12;
    window._pilot.scale.set(s, s, s);

    // Advanced thruster animation (gaming engine glow)
    if (window._pilot.userData.thrusters) {
      const thrustScale = 0.7 + Math.sin(t * 2) * 0.4;
      window._pilot.userData.thrusters.forEach(t => {
        t.scale.set(1, thrustScale, 1);
        t.material.opacity = 0.5 + Math.sin(t * 3) * 0.3;
      });
    }

    // Occasional thruster particle bursts (when pilot active)
    if (Date.now() % 380 < 30 && window._pilot) {
      AIGraphics.spawnEffect(window._pilot.position, 0xff5500, 5, 18);
    }
  }

  // ASTRANOV AI Graphics Engine tick
  tickGlobeFly?.();
  AIGraphics.update();
  updateOrbital();

  if (window.AstranovCollectiveIntelligence) {
    ACI.tick();
    ACI.neurons.forEach(n => {
      if (!n.userData) return;
      const t = Date.now() / 700;
      const s = 1 + Math.sin(t + (n.userData.id ? n.userData.id.length : 0)) * 0.07 * Math.min(1.8, n.userData.strength || 1);
      n.scale.set(s, s, s);
    });
  }

  if (window.MapDepict) MapDepict.tick();
  GlobeEntity?.tick?.();
  SuperSpace?.tick?.();
  CosmicZoom.update(camera.position.z);
  EarthRealism?.tick?.();
  renderer.render(scene, camera);
}
animate();
ACI.init();
Circles.init();

// Enforce Celestial Circles for main UI (no rectangles) + spawn primordials
setTimeout(() => {
  const deck = document.getElementById('globe-deck');
  if (deck) {
    deck.style.display = 'none';
    deck.style.pointerEvents = 'none';
  }

  // Spawn all 4 primordial circles as per living truth
  Circles.spawn({ id: 'economics', type: 'economics', title: 'ECONOMICS', size: '180px', left: '12px', top: '12px', content: '<b>AVC Balance</b><br>0.00<br><small>Wallet + ledger in circle</small>' });
  Circles.spawn({ id: 'radar', type: 'radar', title: 'RADAR', size: '180px', right: '12px', top: '12px', content: '<b>Active Orders</b><br>Nearby vendors<br>ETAs' });
  const aiCircle = Circles.spawn({ id: 'ai', type: 'ai', title: 'ASTRANOV AI', size: '220px', right: '12px', bottom: '12px', content: '<b>ACI Heartbeat</b><br>Click for chat<br>Providers orbiting' });
  Circles.addComplaintButton(aiCircle && aiCircle.el, 'AI circle / ACI');

  // Main View/CLI circle (replaces old deck)
  const cliCircle = Circles.spawn({
    id: 'main-cli',
    type: 'view',
    title: 'ASTRANOV CLI',
    size: '320px',
    content: '<div id="cli-circle-content" style="font:11px monospace; max-height:240px; overflow:auto;">Astranov Collective ready.<br>Drag rim • Pinch scale.<br>Globe is yours.</div>'
  });

  // Wire interactive ACI chat into AI primordial circle (full circles law)
  setTimeout(() => {
    const aiEl = document.getElementById('circle-ai');
    if (aiEl && !aiEl.querySelector('.aci-chat-input')) {
      const body = aiEl.querySelector('.circle-content') || aiEl.querySelector('.cc-body');
      if (body) {
        const chatWrap = document.createElement('div');
        chatWrap.style.cssText = 'margin:6px 0 0; font-size:10px;';
        chatWrap.innerHTML = `
          <div style="max-height:90px;overflow:auto;font:9px/1.3 monospace;margin-bottom:3px;color:#8ab;" id="aci-circle-log">heartbeat active • tap globe or say "Τι θες Αξάς;"</div>
          <div style="display:flex;gap:3px;">
            <input class="aci-chat-input" placeholder="ask ACI (think ... / evolve / status)" style="flex:1;background:rgba(0,0,0,0.35);border:1px solid rgba(61,158,255,0.3);color:#b8d4f0;font:9px monospace;padding:2px 4px;border-radius:3px;" />
            <button class="aci-chat-send" style="font-size:8px;padding:1px 5px;border:1px solid #3d9eff;background:rgba(61,158,255,0.15);color:#8ab;border-radius:2px;cursor:pointer;">send</button>
          </div>
          <div style="margin-top:2px;display:flex;gap:2px;flex-wrap:wrap;">
            <button data-aci="think status" style="font:8px sans-serif;padding:1px 3px;background:rgba(0,170,85,0.2);border:1px solid #0a5;color:#0d5;">think</button>
            <button data-aci="evolve" style="font:8px sans-serif;padding:1px 3px;background:rgba(120,60,200,0.2);border:1px solid #a6f;color:#a6f;">evolve</button>
            <button data-aci="stats" style="font:8px sans-serif;padding:1px 3px;background:rgba(200,160,0,0.2);border:1px solid #ca0;color:#ca0;">stats</button>
          </div>
        `;
        body.appendChild(chatWrap);
        const log = chatWrap.querySelector('#aci-circle-log');
        const inp = chatWrap.querySelector('.aci-chat-input');
        const sendBtn = chatWrap.querySelector('.aci-chat-send');
        const doAci = async (txt) => {
          if (!txt) return;
          log.textContent = '> ' + txt;
          try {
            if (window.ACIControl && typeof ACIControl.handle === 'function') {
              await ACIControl.handle(txt, {fromVoice:false});
            } else if (window.ACI && typeof ACI.api === 'function') {
              const res = await ACI.api({mode: txt.startsWith('think')?'think':'evolve', prompt: txt});
              log.textContent = (res && res.result ? res.result : JSON.stringify(res)).slice(0,160);
            }
            GlobeDeck?.say?.('ACI: ' + txt.slice(0,30));
          } catch(e){ log.textContent = 'ACI err (see console)'; }
        };
        sendBtn.onclick = () => { const v = inp.value.trim(); doAci(v); inp.value=''; };
        inp.onkeydown = e => { if(e.key==='Enter'){ const v=inp.value.trim(); doAci(v); inp.value=''; } };
        chatWrap.querySelectorAll('button[data-aci]').forEach(b => b.onclick = () => doAci(b.getAttribute('data-aci')));
      }
    }
  }, 900);
}, 600);

GlobeAutonomy.init();
AstranovNode.init();
Auth.init();
FieldBrain.init();
FieldBrain.hookFeed();
GlobeDeck.init();
SuperCli.init();
SessionHold.init();
AciCli.init();
setTimeout(() => Auth.refreshAuthority(), 800);
setTimeout(() => AciCoders?.autoStart?.(), 1200);
ACIControl.init();
PmrRadio.bindUI();
GlobeVideo.init();
DrivingView.init();
CosmicZoom.init();
AstranovTheme.init();
CityMap.init();
EarthRealism.init();
SuperSpace.init();
CityLife.init();
SuperAdd.init();
AstranovSiteShell.init();
GlobeEntity.init();
if (window.others?.length) GlobeEntity.syncFriends(others);
if (window._lastPos) GlobeEntity.syncMe(_lastPos.lat, _lastPos.lng, me?.name || 'You');
if (typeof orbitalSats !== 'undefined') CosmicZoom.registerOrbitalSats(orbitalSats);
Commerce.loadVendors().then(() => Commerce.initUI());
NewsFeed.fetch();
setInterval(() => NewsFeed.tick(), 12000);

// Demo auto show after permissions
setTimeout(() => {
  // auto demo if needed (globe focused)
}, 25000);

// Domain guard
const host = location.hostname || '';
const isOfficial = host === 'astranov.eu' || host.endsWith('.astranov.eu');
const isLocal = host === '' || host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:';
if (host && !isOfficial && !isLocal) {
  document.body.innerHTML = '<div style="color:#444;padding:40px;text-align:center;font-family:sans-serif">Available only on authorized Astranov domains</div>';
}

// No panel restore needed - pure globe mode
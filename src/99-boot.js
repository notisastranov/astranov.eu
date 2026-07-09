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

// === INJECTED CELESTIAL CIRCLES (enforced source of truth) ===
const Circles={_circles:new Map(),_nextId:1,init(){if(document.getElementById('cc-s'))return;const s=document.createElement('style');s.id='cc-s';s.textContent='.celestial-circle{position:fixed;border-radius:50%;background:rgba(0,4,12,.92);border:1px solid #3d9eff;backdrop-filter:blur(26px);z-index:150;overflow:hidden}.celestial-circle .cc-body{padding:8px;font:11px system-ui;color:#b8d4f0}';document.head.appendChild(s)},spawn(o={}){const id=o.id||'cc'+this._nextId++;const c=document.createElement('div');c.className='celestial-circle';c.style.cssText=`width:${o.size||'260px'};height:${o.size||'260px'};left:${o.left||'15%'};top:${o.top||'25%'}`;c.innerHTML=`<div style="padding:3px 8px;background:rgba(0,0,0,.4);font-size:9px">${o.title||'Circle'}<span onclick="this.closest('.celestial-circle').remove()" style="cursor:pointer">×</span></div><div class="cc-body">${o.content||''}</div>`;document.body.appendChild(c);this._circles.set(id,c);let dr=false,ox=0,oy=0;c.onmousedown=e=>{dr=true;ox=e.clientX-c.offsetLeft;oy=e.clientY-c.offsetTop;};window.onmousemove=e=>{if(dr){c.style.left=(e.clientX-ox)+'px';c.style.top=(e.clientY-oy)+'px'}};window.onmouseup=()=>dr=false;return c;}};
window.Circles=Circles;setTimeout(()=>Circles.init(),150);
setTimeout(()=>{Circles.spawn({id:'maincli',title:'ASTRANOV CLI',size:'300px',content:'Globe is the only surface.<br>Drag rim. All UI = circles now.<br>ACI / voice / real tech active.'});},650);

ACI.init();

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
}, 600);

GlobeAutonomy.init();
const container = document.getElementById('globe');

// Robust WebGL + error guard so user never sees silent black
window.addEventListener('error', function(e) {
  try {
    const msg = document.createElement('div');
    msg.style.cssText = 'position:fixed;bottom:8px;left:8px;padding:4px 8px;background:rgba(20,0,0,0.7);color:#f66;font:11px/1.3 monospace;z-index:99999;pointer-events:none;';
    msg.textContent = 'Init/Render error: ' + (e.message || 'unknown') + ' — try Chrome/Firefox, enable HW accel, check console';
    document.body.appendChild(msg);
    // Monitor: send complaint/usage error to debug
    if (window.fetch) {
      fetch('https://lkoatrkhuigdolnjsbie.supabase.co/functions/v1/debug-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrb2F0cmtodWlnZG9sbmpzYmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODIwOTIsImV4cCI6MjA5NDQ1ODA5Mn0.qf6Kg93YLJ0coTdVQa4baU0ppOdFY5WkmVzMvEV6ejI' },
        body: JSON.stringify({ type: 'client_error', message: e.message, stack: e.error?.stack || '', url: location.href, ts: Date.now(), session: window._sessionId || 'unknown' })
      }).catch(() => {});
    }
  } catch(_) {}
});

let renderer;
try {
  renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
  renderer.setClearColor(0x000000, 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
} catch (e) {
  const fb = document.createElement('div');
  fb.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#0af;font:15px system-ui;background:#000;z-index:10;text-align:center;';
  fb.innerHTML = 'WebGL unavailable.<br>Update browser or enable hardware acceleration.<br><small>Astranov globe needs WebGL</small>';
  container.appendChild(fb);
  throw e;
}

// Hoisted top-level mutable state (must be declared BEFORE any top-level calls like initVoice/initUser)
let drag = false, px = 0, py = 0;
let dragging = false;
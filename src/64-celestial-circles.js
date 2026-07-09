// === CELESTIAL CIRCLES UI SYSTEM (Core Law Enforcement) ===
// Globe is ONLY surface. All else = floating draggable pinchable circles.
// Implements exact contract from living truth: frosted, radial mask, rim gestures, primordial + View.

const Circles = {
  _circles: new Map(),
  _nextId: 1,
  _primordials: ['economics', 'radar', 'ai', 'view'],

  init() {
    this._injectStyles();
    this._ensurePrimordials();
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.celestial-circle')) this._collapseAllNonPinned();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._collapseAllNonPinned();
    });
    console.log('%c[Circles] Celestial UI system active - no rectangles allowed', 'color:#0a0');
  },

  _injectStyles() {
    if (document.getElementById('celestial-circles-style')) return;
    const style = document.createElement('style');
    style.id = 'celestial-circles-style';
    style.textContent = `
      .celestial-circle {
        position: fixed;
        border-radius: 50%;
        background: rgba(0,4,12,0.88);
        border: 1px solid rgba(26,111,212,0.42);
        backdrop-filter: blur(28px);
        box-shadow: 0 8px 40px rgba(0,0,0,0.55), 0 0 20px var(--circle-glow, rgba(26,111,212,0.3));
        overflow: hidden;
        z-index: 140;
        pointer-events: auto;
        user-select: none;
        transition: transform 0.15s ease, box-shadow 0.2s;
        display: flex;
        flex-direction: column;
      }
      .celestial-circle.economics { --circle-glow: rgba(0,170,85,0.55); border-color: rgba(0,170,85,0.5); }
      .celestial-circle.radar { --circle-glow: rgba(201,160,0,0.55); border-color: rgba(201,160,0,0.5); }
      .celestial-circle.ai { --circle-glow: rgba(61,158,255,0.55); border-color: rgba(61,158,255,0.45); }
      .celestial-circle.view { --circle-glow: rgba(180,220,255,0.4); border-color: rgba(126,184,255,0.35); }
      .celestial-circle .circle-rim {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        pointer-events: none;
      }
      .celestial-circle .circle-content {
        flex: 1;
        overflow: auto;
        padding: 14px;
        -webkit-mask-image: radial-gradient(circle at 50% 50%, black 70%, transparent 92%);
        mask-image: radial-gradient(circle at 50% 50%, black 70%, transparent 92%);
        font-size: 11px;
        line-height: 1.4;
        color: var(--an-text);
      }
      .celestial-circle .circle-header {
        padding: 6px 12px;
        font-size: 9px;
        color: var(--circle-glow);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
      }
      .celestial-circle.pinned .circle-header::after { content: '📌'; font-size: 8px; }
      .celestial-circle .circle-close {
        width: 16px; height: 16px; border-radius: 50%;
        background: rgba(255,255,255,0.1); color: #fff; font-size: 10px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; pointer-events: auto;
      }
      .celestial-circle .circle-close:hover { background: #c41e2a; }
      .celestial-circle .scroll-arc {
        position: absolute; right: 4px; top: 22px; bottom: 22px; width: 3px;
        background: linear-gradient(transparent, var(--circle-glow), transparent);
        border-radius: 2px; opacity: 0.6; pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  },

  _ensurePrimordials() {
    const positions = {
      economics: { left: '12px', top: '12px', size: '180px' },
      radar: { right: '12px', top: '12px', size: '180px' },
      ai: { right: '12px', bottom: '12px', size: '200px' },
      view: { left: '50%', top: '40%', size: '260px', transform: 'translate(-50%, -50%)' }
    };
    this._primordials.forEach(type => {
      if (!document.getElementById(`circle-${type}`)) {
        this.spawn({ id: type, type, primordial: true, ...positions[type] });
      }
    });
  },

  spawn(opts = {}) {
    const id = opts.id || `circle-${this._nextId++}`;
    if (this._circles.has(id)) return this._circles.get(id);

    const circle = document.createElement('div');
    circle.id = `circle-${id}`;
    circle.className = `celestial-circle ${opts.type || 'view'}`;
    circle.style.width = opts.size || '240px';
    circle.style.height = opts.size || '240px';
    if (opts.left) circle.style.left = opts.left;
    if (opts.right) circle.style.right = opts.right;
    if (opts.top) circle.style.top = opts.top;
    if (opts.bottom) circle.style.bottom = opts.bottom;
    if (opts.transform) circle.style.transform = opts.transform;

    const header = document.createElement('div');
    header.className = 'circle-header';
    header.innerHTML = `<span>${opts.title || id}</span><div class="circle-close">×</div>`;
    header.querySelector('.circle-close').onclick = (e) => { e.stopPropagation(); this.destroy(id); };

    const content = document.createElement('div');
    content.className = 'circle-content';
    if (opts.content) content.innerHTML = opts.content;

    const rim = document.createElement('div');
    rim.className = 'circle-rim';

    circle.appendChild(header);
    circle.appendChild(content);
    circle.appendChild(rim);

    document.body.appendChild(circle);
    this._circles.set(id, { el: circle, content, opts });

    this._makeDraggable(circle, id);
    this._makePinchable(circle, id);
    this._makeScrollable(content);

    if (opts.primordial) circle.classList.add('primordial');

    try {
      const saved = localStorage.getItem(`av_circle_pos_${id}`);
      if (saved) {
        const p = JSON.parse(saved);
        circle.style.left = p.left || '';
        circle.style.top = p.top || '';
        circle.style.right = p.right || '';
        circle.style.bottom = p.bottom || '';
      }
    } catch (_) {}

    return { id, el: circle, content };
  },

  _makeDraggable(circle, id) {
    let dragging = false;
    let sx = 0, sy = 0;

    const onMove = (clientX, clientY) => {
      if (!dragging) return;
      const dx = clientX - sx;
      const dy = clientY - sy;
      circle.style.left = (parseFloat(circle.style.left || 0) + dx) + 'px';
      circle.style.top = (parseFloat(circle.style.top || 0) + dy) + 'px';
      circle.style.right = '';
      circle.style.bottom = '';
      sx = clientX; sy = clientY;
    };

    circle.addEventListener('mousedown', (e) => {
      if (e.target.closest('.circle-content, .circle-close')) return;
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      circle.style.transition = 'none';
    });

    window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        circle.style.transition = '';
        this._savePos(id, circle);
      }
    });

    circle.addEventListener('touchstart', (e) => {
      if (e.target.closest('.circle-content, .circle-close')) return;
      dragging = true;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });

    circle.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      onMove(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault();
    }, { passive: false });

    circle.addEventListener('touchend', () => {
      if (dragging) {
        dragging = false;
        this._savePos(id, circle);
      }
    });
  },

  _makePinchable(circle, id) {
    let startDist = 0;
    let startSize = 0;

    const getDist = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    circle.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        startDist = getDist(e.touches[0], e.touches[1]);
        startSize = parseFloat(circle.style.width) || 240;
      }
    }, { passive: true });

    circle.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 2) return;
      const dist = getDist(e.touches[0], e.touches[1]);
      const scale = dist / startDist;
      let newSize = Math.max(120, Math.min(520, startSize * scale));
      circle.style.width = newSize + 'px';
      circle.style.height = newSize + 'px';
      e.preventDefault();
    }, { passive: false });
  },

  _makeScrollable(content) {
    const updateArc = () => {};
    content.addEventListener('scroll', updateArc);
  },

  _savePos(id, circle) {
    try {
      const pos = {
        left: circle.style.left,
        top: circle.style.top,
        right: circle.style.right,
        bottom: circle.style.bottom
      };
      localStorage.setItem(`av_circle_pos_${id}`, JSON.stringify(pos));
    } catch (_) {}
  },

  destroy(id) {
    const c = this._circles.get(id);
    if (c && c.el && !c.el.classList.contains('primordial')) {
      c.el.remove();
      this._circles.delete(id);
    }
  },

  _collapseAllNonPinned() {
    this._circles.forEach((c, id) => {
      if (!c.el.classList.contains('primordial') && !c.el.classList.contains('pinned')) {
        this.destroy(id);
      }
    });
  },

  get(id) {
    return this._circles.get(id);
  },

  showView(title, html) {
    const view = this.spawn({ id: 'view-' + Date.now(), type: 'view', title, content: html, size: '280px' });
    return view;
  }
};

window.Circles = Circles;

if (typeof window !== 'undefined') {
  setTimeout(() => Circles.init && Circles.init(), 120);
}

/* Astranov SpaceNet UI — coach, expand, ONE-FINGER draggable CLI (remembered) */
(function (global) {
  'use strict';

  const POS_KEY = 'sn:cli-pos-v1';

  function $(id) {
    return document.getElementById(id);
  }

  function showCoach() {
    try {
      if (localStorage.getItem('sn:coach-v1')) return;
    } catch (_) {
      return;
    }
    const el = $('coach');
    if (!el) return;
    el.hidden = false;
    $('coach-ok')?.addEventListener(
      'click',
      () => {
        el.hidden = true;
        try {
          localStorage.setItem('sn:coach-v1', '1');
        } catch (_) {}
        $('cli-in')?.focus();
      },
      { once: true }
    );
  }

  function expandPanel(on) {
    const panel = $('panel');
    if (!panel) return;
    panel.classList.toggle('expanded', !!on);
  }

  /** One-finger / mouse drag for CLI panel — product rule: always draggable */
  function bindCliDrag() {
    const dock = $('dock');
    const panel = $('panel');
    const handle = $('cli-drag') || $('cli-preview');
    if (!dock || !panel || !handle || handle._snDragBound) return;
    handle._snDragBound = true;

    // Dock becomes free-position container when user has dragged
    let startX = 0,
      startY = 0,
      origL = 0,
      origT = 0,
      dragging = false,
      moved = false;

    function applyPos(left, top) {
      const maxL = Math.max(0, window.innerWidth - panel.offsetWidth - 8);
      const maxT = Math.max(0, window.innerHeight - panel.offsetHeight - 8);
      const l = Math.min(maxL, Math.max(8, left));
      const t = Math.min(maxT, Math.max(8, top));
      dock.classList.add('free');
      dock.style.left = l + 'px';
      dock.style.top = t + 'px';
      dock.style.right = 'auto';
      dock.style.bottom = 'auto';
      dock.style.transform = 'none';
      dock.style.width = 'auto';
      dock.style.padding = '0';
      panel.style.margin = '0';
      panel.style.maxWidth = Math.min(540, window.innerWidth - 16) + 'px';
      panel.style.width = Math.min(540, window.innerWidth - 16) + 'px';
      return { left: l, top: t };
    }

    function restore() {
      try {
        const raw = localStorage.getItem(POS_KEY);
        if (!raw) return;
        const p = JSON.parse(raw);
        if (typeof p.left === 'number' && typeof p.top === 'number') {
          applyPos(p.left, p.top);
        }
      } catch (_) {}
    }

    function save(left, top) {
      try {
        localStorage.setItem(POS_KEY, JSON.stringify({ left, top }));
      } catch (_) {}
    }

    function onStart(e) {
      // Only primary finger / button; ignore multi-touch (second finger)
      if (e.pointerType === 'touch' && e.isPrimary === false) return;
      if (e.button != null && e.button !== 0) return;
      // Don't steal if target is interactive control inside handle (none expected)
      const t = e.touches ? e.touches[0] : e;
      if (!t) return;
      const rect = dock.getBoundingClientRect();
      // If dock not free yet, compute current visual origin
      if (!dock.classList.contains('free')) {
        origL = rect.left;
        origT = rect.top;
      } else {
        origL = parseFloat(dock.style.left) || rect.left;
        origT = parseFloat(dock.style.top) || rect.top;
      }
      startX = t.clientX;
      startY = t.clientY;
      dragging = true;
      moved = false;
      handle.setPointerCapture?.(e.pointerId);
      panel.classList.add('dragging');
      if (e.cancelable && e.pointerType === 'touch') {
        /* allow move prevent later */
      }
    }

    function onMove(e) {
      if (!dragging) return;
      const t = e.touches ? e.touches[0] : e;
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      moved = true;
      applyPos(origL + dx, origT + dy);
      if (e.cancelable) e.preventDefault();
    }

    function onEnd(e) {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove('dragging');
      try {
        handle.releasePointerCapture?.(e.pointerId);
      } catch (_) {}
      if (moved) {
        const l = parseFloat(dock.style.left) || 0;
        const t = parseFloat(dock.style.top) || 0;
        save(l, t);
      }
    }

    handle.addEventListener('pointerdown', onStart, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onEnd, { passive: true });
    window.addEventListener('pointercancel', onEnd, { passive: true });
    // Touch fallbacks for older WebViews
    handle.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length !== 1) return;
        onStart({ touches: e.touches, pointerId: 1, pointerType: 'touch', isPrimary: true });
      },
      { passive: true }
    );
    window.addEventListener(
      'touchmove',
      (e) => {
        if (!dragging || e.touches.length !== 1) return;
        onMove({ touches: e.touches, cancelable: true });
      },
      { passive: false }
    );
    window.addEventListener(
      'touchend',
      () => onEnd({ pointerId: 1 }),
      { passive: true }
    );

    restore();
    window.addEventListener(
      'resize',
      () => {
        if (!dock.classList.contains('free')) return;
        const l = parseFloat(dock.style.left) || 8;
        const t = parseFloat(dock.style.top) || 8;
        applyPos(l, t);
      },
      { passive: true }
    );
  }

  function init() {
    if (init._done) return;
    init._done = true;

    $('cli-in')?.addEventListener('focus', () => expandPanel(true));
    $('btn-expand')?.addEventListener('click', () => {
      const p = $('panel');
      expandPanel(!p?.classList.contains('expanded'));
    });

    bindCliDrag();
    setTimeout(showCoach, 700);

    const badge = $('perf-badge');
    if (badge) {
      badge.textContent = 'AS';
      badge.title = 'Astranov SpaceNet';
    }
  }

  global.SNUi = { init, showCoach, expandPanel, bindCliDrag };
})(window);

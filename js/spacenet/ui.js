/* Astranov SpaceNet UI — one-finger drag + expand/retract CLI (PRODUCT RULE) */
(function (global) {
  'use strict';

  const POS_KEY = 'sn:cli-pos-v1';
  const SIZE_KEY = 'sn:cli-size-v1'; // collapsed | mid | expanded

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

  function setSize(mode) {
    const panel = $('panel');
    if (!panel) return;
    panel.classList.remove('expanded', 'collapsed', 'mid');
    if (mode === 'collapsed') panel.classList.add('collapsed');
    else if (mode === 'expanded') panel.classList.add('expanded');
    else panel.classList.add('mid');
    try {
      localStorage.setItem(SIZE_KEY, mode);
    } catch (_) {}
  }

  function expandPanel(on) {
    if (on === true) setSize('expanded');
    else if (on === false) setSize('collapsed');
    else {
      const p = $('panel');
      if (p?.classList.contains('expanded')) setSize('mid');
      else setSize('expanded');
    }
  }

  function applyPos(dock, panel, left, top) {
    const maxL = Math.max(0, window.innerWidth - panel.offsetWidth - 8);
    const maxT = Math.max(0, window.innerHeight - Math.min(panel.offsetHeight, window.innerHeight * 0.85) - 8);
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

  /**
   * One finger on #cli-drag:
   * - horizontal / free drag → move panel (persist)
   * - strong vertical swipe → fully expand or retract
   */
  function bindCliDrag() {
    const dock = $('dock');
    const panel = $('panel');
    const handle = $('cli-drag') || $('cli-preview');
    if (!dock || !panel || !handle || handle._snDragBound) return;
    handle._snDragBound = true;

    let startX = 0,
      startY = 0,
      origL = 0,
      origT = 0,
      dragging = false,
      moved = false,
      mode = 'none'; // move | size

    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.left === 'number' && typeof p.top === 'number') applyPos(dock, panel, p.left, p.top);
      }
      const sz = localStorage.getItem(SIZE_KEY);
      if (sz === 'collapsed' || sz === 'expanded' || sz === 'mid') setSize(sz);
    } catch (_) {}

    function onStart(e) {
      if (e.pointerType === 'touch' && e.isPrimary === false) return;
      if (e.button != null && e.button !== 0) return;
      const t = e.touches ? e.touches[0] : e;
      if (!t) return;
      const rect = dock.getBoundingClientRect();
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
      mode = 'none';
      handle.setPointerCapture?.(e.pointerId);
      panel.classList.add('dragging');
    }

    function onMove(e) {
      if (!dragging) return;
      const t = e.touches ? e.touches[0] : e;
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 6) return;
      moved = true;
      // Decide: vertical swipe on handle = size; else move
      if (mode === 'none') {
        mode = Math.abs(dy) > Math.abs(dx) * 1.25 ? 'size' : 'move';
      }
      if (mode === 'move') {
        applyPos(dock, panel, origL + dx, origT + dy);
      } else {
        // Live height feedback while swiping
        if (dy < -40) panel.classList.add('expanded');
        if (dy > 40) panel.classList.add('collapsed');
      }
      if (e.cancelable) e.preventDefault();
    }

    function onEnd(e) {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove('dragging');
      try {
        handle.releasePointerCapture?.(e.pointerId);
      } catch (_) {}
      if (!moved) return;
      if (mode === 'move') {
        try {
          localStorage.setItem(
            POS_KEY,
            JSON.stringify({
              left: parseFloat(dock.style.left) || 0,
              top: parseFloat(dock.style.top) || 0,
            })
          );
        } catch (_) {}
      } else if (mode === 'size') {
        const dy = (e.changedTouches ? e.changedTouches[0]?.clientY : e.clientY) - startY;
        // Swipe up = expand; swipe down = retract
        if (dy < -36) setSize('expanded');
        else if (dy > 36) setSize('collapsed');
        else setSize('mid');
      }
      mode = 'none';
    }

    handle.addEventListener('pointerdown', onStart, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onEnd, { passive: true });
    window.addEventListener('pointercancel', onEnd, { passive: true });

    window.addEventListener(
      'resize',
      () => {
        if (!dock.classList.contains('free')) return;
        applyPos(dock, panel, parseFloat(dock.style.left) || 8, parseFloat(dock.style.top) || 8);
      },
      { passive: true }
    );
  }

  function init() {
    if (init._done) return;
    init._done = true;
    $('cli-in')?.addEventListener('focus', () => expandPanel(true));
    $('btn-expand')?.addEventListener('click', () => expandPanel());
    bindCliDrag();
    setTimeout(showCoach, 700);
    const badge = $('perf-badge');
    if (badge) {
      badge.textContent = 'AS';
      badge.title = 'Astranov SpaceNet — see ASTRANOV_SPACENET_GUIDE.md';
    }
  }

  global.SNUi = { init, showCoach, expandPanel, bindCliDrag, setSize };
})(window);

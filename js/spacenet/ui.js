/* SpaceNet UI chrome — coach, panel expand, chips */
(function (global) {
  'use strict';

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

  function init() {
    if (init._done) return;
    init._done = true;

    $('cli-in')?.addEventListener('focus', () => expandPanel(true));
    $('btn-expand')?.addEventListener('click', () => {
      const p = $('panel');
      expandPanel(!p?.classList.contains('expanded'));
    });

    // Double-tap logo = hard reset already on index; long-press preview help
    setTimeout(showCoach, 700);

    // Performance badge once
    const ms = Math.round(performance.now());
    const badge = $('perf-badge');
    if (badge) {
      badge.textContent = 'lite';
      badge.title = 'SpaceNet lite shell';
    }
  }

  global.SNUi = { init, showCoach, expandPanel };
})(window);

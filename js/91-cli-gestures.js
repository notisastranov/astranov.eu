/**
 * CLI touch isolation + handle + overscroll-minimize + case compaction
 * SPECS: scroll in CLI never spins Earth; handle works; pull-down/overscroll collapses;
 * past turns compact into foldable cases (Grok-style).
 */
(function CliGestures() {
  'use strict';
  if (window.__CLI_GESTURES__?.version === '20260723300000') return;
  window.__CLI_GESTURES__ = { version: '20260723300000', ready: false };

  const KEEP_OPEN_TURNS = 1; // latest turn stays expanded; older → cases
  let caseSeq = 0;

  function deck() { return document.getElementById('globe-deck'); }
  function logEl() { return document.getElementById('globe-deck-log'); }
  function inCli(t) {
    return !!(t && (t.closest?.('#globe-deck') || t.closest?.('#aci-hud #globe-deck')));
  }
  function isInteractive(t) {
    return !!t?.closest?.('button, input, textarea, select, form, a, [contenteditable], #aci-cli-form, label');
  }
  function isHandle(t) {
    return !!t?.closest?.('#globe-deck-header, #super-cli-bar, #cli-ribbon-status, #globe-deck-title, #globe-deck-preview');
  }
  function isLog(t) {
    return !!t?.closest?.('#globe-deck-log, #globe-deck-stage, #globe-deck-body');
  }

  /* ── Isolate CLI from Earth trackball ─────────────────────────── */
  function isolateEvents() {
    const d = deck();
    if (!d || d._cliIsoBound) return;
    d._cliIsoBound = true;
    d.style.pointerEvents = 'auto';
    d.style.touchAction = 'manipulation';

    const stop = (e) => {
      e.stopPropagation();
      // don't preventDefault here — allow scroll/click inside CLI
    };
    // Capture phase so globe/window never see CLI gestures
    ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'mousemove', 'mouseup', 'wheel', 'click'].forEach((ev) => {
      d.addEventListener(ev, stop, { capture: true, passive: true });
    });
    // Wheel over CLI must never zoom Earth
    d.addEventListener('wheel', (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      // if over log, let native scroll; otherwise prevent page/globe
      if (!isLog(e.target) && !e.target.closest?.('#aci-cli-in')) {
        e.preventDefault();
      }
    }, { capture: true, passive: false });
  }

  /* Guard trackball entry points */
  function guardTrackball() {
    const wrap = (name) => {
      const fn = window[name];
      if (typeof fn !== 'function' || fn.__cliGuarded) return;
      const wrapped = function (x, y) {
        try {
          const el = document.elementFromPoint(
            typeof x === 'number' ? x : (arguments[0]?.clientX ?? 0),
            typeof y === 'number' ? y : (arguments[0]?.clientY ?? 0)
          );
          if (inCli(el)) return;
        } catch (_) {}
        return fn.apply(this, arguments);
      };
      wrapped.__cliGuarded = true;
      window[name] = wrapped;
    };
    wrap('trackballStart');
    wrap('trackballMove');

    // Global wheel: if over CLI, ignore zoom
    if (!window.__cliWheelGuard) {
      window.__cliWheelGuard = true;
      window.addEventListener('wheel', (e) => {
        if (inCli(e.target)) {
          e.stopPropagation();
        }
      }, { capture: true, passive: true });
    }
  }

  /* ── Handle: tap toggle · drag resize ─────────────────────────── */
  function bindHandle() {
    const d = deck();
    if (!d || d._cliHandleBound) return;
    d._cliHandleBound = true;

    let mode = null; // 'resize' | null
    let sy = 0;
    let sh = 0;
    let moved = 0;
    let startTarget = null;

    const collapse = () => {
      try {
        if (window.GlobeDeck) {
          GlobeDeck._size = 'collapsed';
          GlobeDeck.expanded = false;
          GlobeDeck.applySize?.();
        }
        d.classList.add('collapsed');
        d.classList.remove('expanded', 'size-third', 'size-full', 'size-free');
        d.style.maxHeight = '';
        d.style.minHeight = '';
        if (window.AciCli) AciCli.open = false;
      } catch (_) {}
    };

    const expand = () => {
      try {
        if (window.GlobeDeck) {
          GlobeDeck._size = 'third';
          GlobeDeck.expanded = true;
          GlobeDeck.applySize?.();
        }
        d.classList.remove('collapsed');
        d.classList.add('expanded', 'size-third');
        if (window.AciCli) AciCli.open = true;
      } catch (_) {}
    };

    const toggle = () => {
      if (d.classList.contains('collapsed') || !window.GlobeDeck?.expanded) expand();
      else collapse();
    };

    window.__cliCollapse = collapse;
    window.__cliExpand = expand;
    window.__cliToggle = toggle;

    const onDown = (clientY, target, e) => {
      if (isInteractive(target) && !isHandle(target)) return;
      if (!isHandle(target) && !target.closest?.('#globe-deck-header')) {
        // log area handled separately
        return;
      }
      mode = 'resize';
      sy = clientY;
      sh = d.getBoundingClientRect().height;
      moved = 0;
      startTarget = target;
    };

    const onMove = (clientY, e) => {
      if (mode !== 'resize') return;
      const dy = sy - clientY; // finger up = grow
      moved = Math.max(moved, Math.abs(dy));
      if (moved < 8) return;
      if (e?.cancelable) e.preventDefault();
      const minH = 96;
      const maxH = Math.min(window.innerHeight * 0.92, window.innerHeight - 28);
      let nh = Math.min(maxH, Math.max(minH, sh + dy));
      d.classList.remove('collapsed', 'size-third', 'size-full');
      d.classList.add('expanded', 'size-free', 'deck-resizing');
      d.style.maxHeight = nh + 'px';
      d.style.minHeight = nh + 'px';
      if (window.GlobeDeck) {
        GlobeDeck.expanded = nh > 120;
        GlobeDeck._size = nh < 120 ? 'collapsed' : 'free';
        GlobeDeck._freeHeight = nh;
      }
    };

    const onUp = () => {
      if (mode !== 'resize') return;
      d.classList.remove('deck-resizing');
      if (moved < 10) {
        // tap handle → toggle expand/collapse
        toggle();
      } else {
        const h = d.getBoundingClientRect().height;
        if (h < 130) collapse();
        else {
          try {
            localStorage.setItem('astranov-deck-height', String(Math.round(h)));
            if (window.GlobeDeck) {
              GlobeDeck._freeHeight = Math.round(h);
              GlobeDeck._size = 'free';
              GlobeDeck.expanded = true;
              GlobeDeck.applySize?.();
            }
          } catch (_) {}
        }
      }
      mode = null;
      moved = 0;
      startTarget = null;
    };

    d.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      if (isHandle(e.target)) onDown(e.touches[0].clientY, e.target, e);
    }, { passive: true });

    d.addEventListener('touchmove', (e) => {
      if (mode !== 'resize' || e.touches.length !== 1) return;
      onMove(e.touches[0].clientY, e);
    }, { passive: false });

    d.addEventListener('touchend', onUp, { passive: true });
    d.addEventListener('touchcancel', onUp, { passive: true });

    d.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (isHandle(e.target)) onDown(e.clientY, e.target, e);
    });
    window.addEventListener('mousemove', (e) => {
      if (mode === 'resize') onMove(e.clientY, e);
    });
    window.addEventListener('mouseup', onUp);

    // Explicit click on title/header also toggles (desktop)
    ['globe-deck-header', 'globe-deck-title', 'cli-ribbon-status'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el._cliTapBound) return;
      el._cliTapBound = true;
      el.style.cursor = 'grab';
      el.addEventListener('click', (e) => {
        if (isInteractive(e.target) && e.target.tagName === 'BUTTON') return;
        // only if little movement (mouseup path already toggles) — skip double
      });
    });
  }

  /* ── Log: native scroll · overscroll top → minimize ───────────── */
  function bindLogScroll() {
    const log = logEl();
    if (!log || log._cliScrollBound) return;
    log._cliScrollBound = true;
    log.style.touchAction = 'pan-y';
    log.style.overscrollBehavior = 'contain';
    log.style.webkitOverflowScrolling = 'touch';
    log.style.overflowY = 'auto';
    log.style.pointerEvents = 'auto';

    let sy = 0;
    let st0 = 0;
    let pulling = false;
    let dyAcc = 0;

    log.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      sy = e.touches[0].clientY;
      st0 = log.scrollTop;
      pulling = true;
      dyAcc = 0;
    }, { passive: true });

    log.addEventListener('touchmove', (e) => {
      if (!pulling || e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      const dy = y - sy; // finger down = positive
      dyAcc = dy;
      // At top of scroll, pull down past threshold → minimize CLI
      if (st0 <= 1 && log.scrollTop <= 1 && dy > 56) {
        if (e.cancelable) e.preventDefault();
        pulling = false;
        window.__cliCollapse?.();
        return;
      }
      // At bottom, pull up hard while expanded full — optional soft collapse not needed
    }, { passive: false });

    log.addEventListener('touchend', () => {
      if (pulling && st0 <= 1 && dyAcc > 64) window.__cliCollapse?.();
      pulling = false;
      dyAcc = 0;
    }, { passive: true });

    // Wheel overscroll at top: scroll up when already at top → collapse
    let wheelAcc = 0;
    log.addEventListener('wheel', (e) => {
      e.stopPropagation();
      if (log.scrollTop <= 0 && e.deltaY < 0) {
        wheelAcc += -e.deltaY;
        if (wheelAcc > 80) {
          wheelAcc = 0;
          window.__cliCollapse?.();
        }
      } else {
        wheelAcc = 0;
      }
    }, { passive: true });
  }

  /* ── Case compaction: past turns fold into cases ──────────────── */
  function ensureCaseCss() {
    if (document.getElementById('cli-case-css')) return;
    const s = document.createElement('style');
    s.id = 'cli-case-css';
    s.textContent = `
#globe-deck-log .deck-case{
  margin:6px 0;border-left:3px solid rgba(122,162,247,.55);
  border-radius:0 8px 8px 0;background:rgba(12,20,40,.45);
  overflow:hidden;
}
#globe-deck-log .deck-case-head{
  display:flex;align-items:center;gap:8px;width:100%;
  padding:7px 10px;margin:0;border:0;background:transparent;
  color:#a9b1d6;font:600 11.5px/1.3 ui-monospace,monospace;
  text-align:left;cursor:pointer;touch-action:manipulation;
}
#globe-deck-log .deck-case-head:hover{color:#c0caf5;background:rgba(61,158,255,.08)}
#globe-deck-log .deck-case-head .case-mark{color:#7aa2f7;flex-shrink:0}
#globe-deck-log .deck-case-head .case-title{
  flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  color:#c0caf5;
}
#globe-deck-log .deck-case-head .case-meta{color:#565f89;font-size:10px;flex-shrink:0}
#globe-deck-log .deck-case-body{display:none;padding:2px 8px 8px 10px}
#globe-deck-log .deck-case.open .deck-case-body{display:block}
#globe-deck-log .deck-case.open .case-mark::before{content:'▼ '}
#globe-deck-log .deck-case:not(.open) .case-mark::before{content:'▶ '}
#globe-deck-log .deck-turn{margin:0}
#globe-deck, #globe-deck *{pointer-events:auto!important}
#aci-hud{pointer-events:none!important}
#aci-hud #globe-deck{pointer-events:auto!important}
#globe-deck-log,#globe-deck-body,#globe-deck-stage{
  touch-action:pan-y!important;overscroll-behavior:contain!important;
  -webkit-overflow-scrolling:touch;
}
#globe-deck-header,#super-cli-bar,#cli-ribbon-status{
  touch-action:none!important;cursor:grab;user-select:none;
}
#globe-deck.deck-resizing #super-cli-bar,
#globe-deck.deck-resizing #globe-deck-header{cursor:grabbing}
#aci-cli-in,#aci-cli-form{touch-action:manipulation!important}
`;
    document.head.appendChild(s);
  }

  function foldTurnIntoCase(nodes) {
    const log = logEl();
    if (!log || !nodes?.length) return;
    caseSeq += 1;
    const first = nodes[0];
    const titleText = (first.textContent || 'turn').replace(/^›\s*/, '').slice(0, 64);
    const caseEl = document.createElement('div');
    caseEl.className = 'deck-case';
    caseEl.dataset.case = String(caseSeq);
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'deck-case-head';
    head.innerHTML = '<span class="case-mark"></span><span class="case-title"></span><span class="case-meta"></span>';
    head.querySelector('.case-title').textContent = titleText;
    head.querySelector('.case-meta').textContent = nodes.length + ' lines';
    const body = document.createElement('div');
    body.className = 'deck-case-body';
    nodes.forEach((n) => body.appendChild(n));
    head.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      caseEl.classList.toggle('open');
    });
    caseEl.appendChild(head);
    caseEl.appendChild(body);
    // Insert case where first node was
    log.insertBefore(caseEl, body.firstChild ? null : null);
    // nodes already moved into body; place case at end of previous content
    // After moving nodes into body, they're gone from log — append case before live turn
    const live = log.querySelector('.deck-turn-live');
    if (live) log.insertBefore(caseEl, live);
    else log.appendChild(caseEl);
  }

  function compactOlderTurns() {
    const log = logEl();
    if (!log) return;
    // Collect open (non-cased) lines grouped by cmd starts
    const kids = Array.from(log.children).filter((el) =>
      el.classList?.contains('deck-line') || el.classList?.contains('deck-turn-live')
    );
    if (kids.length < 4) return;

    // Group into turns: each deck-cmd starts a turn
    const turns = [];
    let cur = [];
    kids.forEach((el) => {
      if (el.classList.contains('deck-cmd') && cur.length) {
        turns.push(cur);
        cur = [el];
      } else {
        cur.push(el);
      }
    });
    if (cur.length) turns.push(cur);

    // Keep last KEEP_OPEN_TURNS as live; fold the rest
    const toFold = turns.slice(0, Math.max(0, turns.length - KEEP_OPEN_TURNS));
    const keep = turns.slice(Math.max(0, turns.length - KEEP_OPEN_TURNS));

    toFold.forEach((turn) => {
      // Skip if already inside a case
      if (turn[0]?.closest?.('.deck-case')) return;
      if (turn.length < 1) return;
      caseSeq += 1;
      const titleText = (turn[0].textContent || 'case').replace(/^›\s*/, '').slice(0, 72);
      const caseEl = document.createElement('div');
      caseEl.className = 'deck-case';
      caseEl.dataset.case = String(caseSeq);
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'deck-case-head';
      head.innerHTML = '<span class="case-mark"></span><span class="case-title"></span><span class="case-meta"></span>';
      head.querySelector('.case-title').textContent = titleText;
      head.querySelector('.case-meta').textContent = turn.length + (turn.length === 1 ? ' line' : ' lines');
      const body = document.createElement('div');
      body.className = 'deck-case-body';
      const anchor = turn[0];
      log.insertBefore(caseEl, anchor);
      turn.forEach((n) => body.appendChild(n));
      head.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        caseEl.classList.toggle('open');
      });
      caseEl.appendChild(head);
      caseEl.appendChild(body);
    });

    // Mark kept turn
    keep.forEach((turn) => {
      turn.forEach((n) => n.classList.add('deck-turn-live'));
    });

    // Cap total cases
    const cases = log.querySelectorAll('.deck-case');
    while (cases.length > 24) {
      cases[0].remove();
    }
  }

  function patchGlobeDeckLog() {
    const G = window.GlobeDeck;
    if (!G?.log || G.__casePatched) return;
    G.__casePatched = true;
    const _log = G.log.bind(G);
    G.log = function (text, cls) {
      const kind = cls || 'out';
      const r = _log(text, cls);
      try {
        if (kind === 'cmd') {
          // New user turn → compact previous
          requestAnimationFrame(() => {
            try { compactOlderTurns(); } catch (_) {}
          });
        }
        // Trim very long live log (cases hold history)
        const out = this.logEl?.() || logEl();
        if (out && out.querySelectorAll('.deck-line.deck-turn-live, .deck-line:not(.deck-case *)').length > 80) {
          compactOlderTurns();
        }
      } catch (_) {}
      return r;
    };
  }

  /* Disable full-deck resize that fights scroll — 91 owns handle + log */
  function disarmOldResize() {
    try {
      if (window.GlobeDeck && !GlobeDeck.__resizeSoftened) {
        GlobeDeck.__resizeSoftened = true;
        const prev = GlobeDeck._deckInteractive?.bind(GlobeDeck);
        // Any target inside CLI → old bindDeckResize will not start (returns early)
        GlobeDeck._deckInteractive = function (target) {
          if (target?.closest?.('#globe-deck')) return true;
          return prev ? prev(target) : false;
        };
        GlobeDeck._deckCanScroll = function () { return true; };
      }
    } catch (_) {}
  }

  function apply() {
    ensureCaseCss();
    isolateEvents();
    guardTrackball();
    disarmOldResize();
    bindHandle();
    bindLogScroll();
    patchGlobeDeckLog();
    // Ensure deck hit-tests
    const d = deck();
    if (d) {
      d.style.pointerEvents = 'auto';
      d.style.zIndex = '200';
    }
    const log = logEl();
    if (log) {
      log.style.pointerEvents = 'auto';
      log.style.touchAction = 'pan-y';
      log.style.overflowY = 'auto';
    }
    window.__CLI_GESTURES__.ready = true;
  }

  apply();
  setTimeout(apply, 300);
  setTimeout(apply, 1200);
  setTimeout(apply, 3000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTimeout(apply, 150);
  });
})();

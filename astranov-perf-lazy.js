// === PERF LAZY — defer 574KB pack until idle/user · dedupe brain boot ===
// AI HANDOFF: see astranov-continuity.js → features.perfLazyBoot. Patches LazyModules.ensure/
// whenReady; _lazyUserReady on first tap. Never re-add boot setTimeout(ensure, 400).
(function perfLazyBoot() {
  const LM = window.LazyModules;
  if (!LM || LM._perfLazy) return;
  LM._perfLazy = true;

  const delayMs = () => window.SlumberManager?.deferredDelay?.() ?? 1400;
  const bootAt = () => window._bootAt || Date.now();

  if (!window._lazyUserReady) {
    const mark = () => { window._lazyUserReady = true; };
    ['pointerdown', 'keydown', 'touchstart', 'click'].forEach(ev => {
      window.addEventListener(ev, mark, { passive: true });
    });
  }

  function shouldDefer() {
    return !window._deferredBootDone && !window._lazyUserReady;
  }

  function waitMs() {
    return Math.max(0, delayMs() - (Date.now() - bootAt()));
  }

  function deferRun(fn) {
    const w = shouldDefer() ? waitMs() : 0;
    if (w <= 0) return Promise.resolve().then(fn);
    return new Promise(resolve => {
      const go = () => Promise.resolve().then(fn).then(resolve);
      if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: w + 600 });
      else setTimeout(go, w);
    });
  }

  const origLoad = LM.load.bind(LM);
  const origEnsure = LM.ensure.bind(LM);

  LM.ensure = function() {
    if (!shouldDefer()) return origEnsure();
    return deferRun(() => origEnsure());
  };

  LM.whenReady = function(fn) {
    if (window._deferredBootDone) return Promise.resolve().then(() => fn?.());
    return deferRun(() => origLoad().then(() => {
      if (!window._deferredBootDone && window.DeferredBoot?.run) window.DeferredBoot.run();
      return fn?.();
    }).catch(() => {}));
  };

  LM.scheduleBrain = function(fn) {
    if (typeof fn !== 'function') return LM.whenReady(fn);
    return LM.whenReady(() => {
      wrapBrainBoot();
      return fn();
    });
  };

  function wrapBrainBoot() {
    const BN = window.BrainNeurons;
    if (!BN || BN._perfDeduped) return;
    const orig = BN.boot?.bind(BN);
    if (!orig) return;
    BN._perfDeduped = true;
    let inflight = null;
    BN.boot = function() {
      if (BN._booted) return inflight || Promise.resolve();
      if (!inflight) {
        inflight = Promise.resolve(orig()).then(() => { BN._booted = true; }).catch(() => {});
      }
      return inflight;
    };
  }

  let hookN = 0;
  const hookIv = setInterval(() => {
    hookN++;
    wrapBrainBoot();
    if (hookN > 25) clearInterval(hookIv);
  }, 200);
})();
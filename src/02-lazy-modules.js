// === LAZY MODULES — load deferred bundle after core boot ===
const LazyModules = {
  _promise: null,
  _loaded: false,

  schedule() {
    const run = () => this.load().catch(() => {});
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 1800 });
    } else {
      setTimeout(run, 80);
    }
  },

  load() {
    if (window._deferredBootDone) {
      this._loaded = true;
      return Promise.resolve();
    }
    if (this._loaded) return Promise.resolve();
    if (this._promise) return this._promise;

    const build = document.querySelector('meta[name="astranov-build"]')?.content || '';
    const src = '/astranov-deferred.js' + (build ? '?v=' + encodeURIComponent(build) : '');

    this._promise = new Promise((resolve, reject) => {
      const done = () => {
        this._loaded = true;
        resolve();
      };
      const tag = document.querySelector('script[data-astranov-deferred]');
      if (tag) {
        if (window._deferredBootDone) return done();
        tag.addEventListener('load', () => done(), { once: true });
        tag.addEventListener('error', () => reject(new Error('deferred script failed')), { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.defer = true;
      s.dataset.astranovDeferred = '1';
      s.onload = () => done();
      s.onerror = () => reject(new Error('deferred script failed'));
      document.head.appendChild(s);
    });
    return this._promise;
  },

  ensure() {
    return this.load().then(() => {
      if (!window._deferredBootDone && window.DeferredBoot?.run) {
        window.DeferredBoot.run();
      }
    });
  },
};
window.LazyModules = LazyModules;
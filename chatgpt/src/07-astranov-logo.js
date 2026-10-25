// === ASTRANOV LOGO — top-center hard reset to solar view ===
const AstranovLogo = {
  _bound: false,

  init() {
    const el = document.getElementById('astranov-logo');
    if (!el || this._bound) return;
    this._bound = true;
    el.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      this.hardReset();
    });
  },

  resetToGlobalView() {
    userIntervene?.();
    GlobeControl?.userTookGlobe?.('silent');
    DrivingView?.deactivate?.();
    SuperSpace?.stop?.();
    GlobeVideo?.stop?.();
    GlobeVideo?.hide?.();
    SuperAdd?.stop?.();
    GlobeEntity?.clearSelection?.();
    GlobeDeck?.collapse?.();
    GlobeDeck?.hideStage?.();
    GlobeDeck?.setPreview?.('ASTRANOV — solar system');
    window._globeFly = null;
    if (typeof globePivot !== 'undefined' && globePivot) {
      globePivot.rotation.y = 0;
      globePivot.rotation.x = 0.12;
    }
    if (typeof camera !== 'undefined' && camera) {
      camera.position.z = ZoomTiers?.tierZ?.('solar') || 7.2;
      camera.lookAt(0, 0, 0);
    }
    ZoomTiers?.goTo?.('solar', true);
    CityMap?.onCamera?.(7.2, 'system');
    CosmicZoom?.update?.(7.2, { tier: 'solar', label: 'SOLAR SYSTEM', cosmic: 'system' });
    cityLevel = false;
    const zl = document.getElementById('zoom-label');
    if (zl && !DrivingView?.active) zl.textContent = 'SOLAR SYSTEM · planets · ISS';
    const chip = document.getElementById('city-life-chip');
    if (chip) chip.classList.remove('open');
  },

  async hardReset() {
    const el = document.getElementById('astranov-logo');
    if (el?._resetting) return;
    if (el) {
      el._resetting = true;
      el.disabled = true;
      el.textContent = '…';
    }
    this.resetToGlobalView();
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    } catch (_) { /* best-effort */ }
    const url = new URL(location.href);
    url.searchParams.set('v', String(Date.now()));
    url.hash = '';
    location.replace(url.toString());
  },
};
window.AstranovLogo = AstranovLogo;
// === DEFERRED BOOT — init subsystems moved out of 99-boot.js ===
const DeferredBoot = {
  _done: false,

  run() {
    if (this._done) return;
    this._done = true;
    window._deferredBootDone = true;

    window.CelestialNav?.init?.();
    window.Responsive3D?.init?.();
    window.OrderTracking?.init?.();
    window.AstranovSession?.init?.();
    window.AstranovPresence?.init?.();
    window.ProfileSite?.init?.();
    window.CodersHub?.init?.();
    window.LabOrbs?.init?.();
    window.SuperCli?.initBrain?.();

    setTimeout(() => {
      const c = window.Commerce;
      if (c?.loadVendors) {
        c.loadVendors().then(() => c.initUI?.()).catch(() => {});
      }
    }, 400);
  },
};
window.DeferredBoot = DeferredBoot;
DeferredBoot.run();
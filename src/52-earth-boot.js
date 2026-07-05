// === EARTH BOOT — NASA Earth + starfield (matches chatgpt.astranov.eu, fixes lost-in-space)
const EarthBoot = {
  STAR_URL: 'https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_4k_print.jpg',
  EARTH_URL: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_2048.jpg',
  _el: null,
  _visible: false,
  _forceEarth: true,

  init() {
    if (this._el) return;
    let el = document.getElementById('earth-boot');
    if (!el) {
      el = document.createElement('div');
      el.id = 'earth-boot';
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML =
        '<div class="eb-starfield"><img class="eb-star" alt="" decoding="async" fetchpriority="high"></div>'
        + '<div class="eb-earth-wrap"><img class="eb-earth" alt=""><div class="eb-terminator"></div></div>';
      const globe = document.getElementById('globe');
      if (globe?.parentNode) globe.parentNode.insertBefore(el, globe);
      else document.body.prepend(el);
    }
    const star = el.querySelector('.eb-star');
    const earth = el.querySelector('.eb-earth');
    if (star && !star.src) star.src = this.STAR_URL;
    if (earth && !earth.src) earth.src = this.EARTH_URL;
    this._el = el;
    this._forceEarth = true;
    this.show('boot');
    window.setTimeout(() => { this._forceEarth = false; }, 4500);
  },

  isEarthView(camZ, level) {
    const lv = level || CosmicZoom?.level || 'earth';
    const z = camZ ?? camera?.position?.z ?? 2.55;
    if (window._cityDropLock || CityMap?.active) return false;
    if (lv === 'system' || lv === 'galaxy') return false;
    if (z > 5.2) return false;
    return lv === 'earth' || lv === 'orbit' || z < 4.6;
  },

  tick(camZ, level) {
    if (!this._el) this.init();
    const earth = this.isEarthView(camZ, level);
    const show = this._forceEarth || earth || ZoomTiers?.current?.()?.cosmic === 'earth';
    if (show) this.show(level || 'earth');
    else this.hide();
  },

  show(reason) {
    if (!this._el) return;
    if (this._visible && !reason) return;
    this._visible = true;
    this._el.classList.add('active');
    document.body.classList.add('earth-boot-active');
    const label = document.getElementById('zoom-label');
    if (label && (ZoomTiers?.current?.()?.id === 'global' || CosmicZoom?.level === 'earth')) {
      if (/SOLAR|GALAXY/i.test(label.textContent)) label.textContent = 'GLOBAL';
    }
  },

  hide() {
    if (!this._el || !this._visible) return;
    this._visible = false;
    this._el.classList.remove('active');
    document.body.classList.remove('earth-boot-active');
  },

  forceEarth(ms) {
    this._forceEarth = true;
    this.show('force');
    window.setTimeout(() => { this._forceEarth = false; }, ms || 5000);
  },
};

window.EarthBoot = EarthBoot;
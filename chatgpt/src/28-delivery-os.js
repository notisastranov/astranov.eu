// === ASTRANOV DELIVERY OS ===
// Country-scale, honest local-commerce delivery primitives. This layer does not
// replace the existing globe commerce flow; it gives it verified zones,
// partner-safe connector metadata, and deterministic dispatch ranking.
const DeliveryOS = {
  coverage: {
    LIVE: 'ASTRANOV live',
    PARTNER: 'partner served',
    REQUESTED: 'requested',
    NOT_READY: 'not ready yet',
  },
  zoneTypes: ['city', 'island', 'town', 'village', 'remote relay'],
  partnerTypes: ['efood', 'wolt', 'delivery_hero', 'doordash', 'generic_courier', 'generic_pos'],

  normalizeCoverage(status) {
    const s = String(status || '').toLowerCase().replace(/[_-]+/g, ' ');
    if (s.includes('live')) return this.coverage.LIVE;
    if (s.includes('partner')) return this.coverage.PARTNER;
    if (s.includes('request')) return this.coverage.REQUESTED;
    return this.coverage.NOT_READY;
  },

  profileIdentity() {
    const user = Auth?.user || null;
    const profile = Auth?.profile || window.me || null;
    return {
      userId: user?.id || null,
      email: user?.email || profile?.email || null,
      name: profile?.display_name || profile?.name || user?.user_metadata?.full_name || 'Astranov user',
      roles: profile?.roles || ['client'],
    };
  },

  rankDispatch({ order = {}, vendor = {}, drivers = [], readiness = 'ready' } = {}) {
    const oLat = Number(order.delivery_lat ?? order.lat ?? Commerce?.userLatLng?.().lat ?? vendor.lat ?? 0);
    const oLng = Number(order.delivery_lng ?? order.lng ?? Commerce?.userLatLng?.().lng ?? vendor.lng ?? 0);
    const vLat = Number(vendor.lat ?? oLat);
    const vLng = Number(vendor.lng ?? oLng);
    const merchantReady = readiness === 'ready' || vendor.merchant_readiness === 'ready';
    return (drivers || []).map(driver => {
      const dLat = Number(driver.field_lat ?? driver.lat ?? vLat);
      const dLng = Number(driver.field_lng ?? driver.lng ?? vLng);
      const toShopKm = Commerce?.haversineKm ? Commerce.haversineKm(dLat, dLng, vLat, vLng) : 0;
      const toDropKm = Commerce?.haversineKm ? Commerce.haversineKm(vLat, vLng, oLat, oLng) : 0;
      const available = driver.available !== false && driver.status !== 'offline';
      const vehicle = String(driver.vehicle || driver.vehicle_type || 'bike').toLowerCase();
      const vehicleFit = /car|van/.test(vehicle) ? 1.0 : /moto|scooter/.test(vehicle) ? 0.92 : 0.82;
      const orderFit = order.order_type === 'grocery' && /bike/.test(vehicle) ? 0.85 : 1;
      const trust = Number(driver.trust_score ?? driver.trust ?? 0.5);
      const score = (available ? 50 : -100)
        + (merchantReady ? 20 : -15)
        + vehicleFit * 12
        + orderFit * 8
        + Math.max(0, 20 - (toShopKm + toDropKm) * 2.2)
        + trust * 20;
      return { ...driver, dispatch_score: Number(score.toFixed(2)), to_shop_km: Number(toShopKm.toFixed(2)), to_dropoff_km: Number(toDropKm.toFixed(2)) };
    }).sort((a, b) => b.dispatch_score - a.dispatch_score);
  },

  connectorManifest() {
    return this.partnerTypes.map(type => ({
      type,
      mode: type.startsWith('generic') ? 'official import/export or webhook' : 'official API / approved partner export only',
      safeMode: true,
      allowed: ['merchant consent', 'official credentials', 'CSV/menu import', 'order handoff export', 'status webhook'],
      disallowed: ['credential sharing', 'scraping private systems', 'unapproved order injection'],
    }));
  },
};
window.DeliveryOS = DeliveryOS;

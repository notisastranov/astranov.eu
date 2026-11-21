/**
 * Astranov partner + direct-vendor + overflow types (browser/CommonJS-safe).
 * Familiar REST/JSON shapes for DoorDash / Delivery Hero–class engineers.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SNPartnersTypes = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ORDER_STATUSES = [
    "created",
    "accepted",
    "preparing",
    "ready_for_pickup",
    "picked_up",
    "delivered",
    "cancelled"
  ];

  var SOURCES = [
    "partner_marketplace",
    "partner_logistics",
    "direct_vendor",
    "platform_overflow"
  ];

  /** Product vendor vs delivery-capacity vendor (same map UX). */
  var VENDOR_TYPES = ["vendor", "delivery_services"];

  var WEBHOOK_EVENTS = [
    "order.created",
    "order.status_changed",
    "offer.created",
    "offer.accepted",
    "offer.declined",
    "offer.expired",
    "overflow.offer",
    "city_account.updated"
  ];

  function normalizeStatus(s) {
    s = String(s || "").toLowerCase().replace(/\s+/g, "_");
    if (s === "canceled") s = "cancelled";
    if (s === "ready") s = "ready_for_pickup";
    if (s === "pickedup" || s === "dasher_picked_up") s = "picked_up";
    if (s === "dropped_off" || s === "dasher_dropped_off") s = "delivered";
    return ORDER_STATUSES.indexOf(s) >= 0 ? s : null;
  }

  function normalizeVendorType(t) {
    t = String(t || "vendor").toLowerCase().replace(/-/g, "_");
    if (t === "delivery" || t === "delivery_service" || t === "courier_vendor") t = "delivery_services";
    return VENDOR_TYPES.indexOf(t) >= 0 ? t : "vendor";
  }

  /**
   * @returns {object|null} canonical order or null if invalid
   */
  function normalizeOrder(raw) {
    if (!raw || typeof raw !== "object") return null;
    var status = normalizeStatus(raw.status || "created");
    if (!status) return null;
    var external = String(raw.external_id || raw.external_delivery_id || "").slice(0, 120);
    var idem = String(raw.idempotency_key || raw.idempotencyKey || external || "").slice(0, 120);
    if (!idem && !external) return null;
    var vendor = raw.vendor || raw.pickup || {};
    var drop = raw.dropoff || raw.drop || raw.client || {};
    var vtype = normalizeVendorType(raw.vendor_type || vendor.vendor_type || vendor.type);
    var items = Array.isArray(raw.items) ? raw.items : [];
    return {
      id: String(raw.id || "").slice(0, 80) || null,
      external_id: external || idem,
      idempotency_key: idem || external,
      source: SOURCES.indexOf(raw.source) >= 0 ? raw.source : "partner_marketplace",
      vendor_type: vtype,
      status: status,
      vendor: {
        id: String(vendor.id || "").slice(0, 80),
        name: String(vendor.name || vendor.business_name || "").slice(0, 120),
        lat: Number(vendor.lat),
        lng: Number(vendor.lng != null ? vendor.lng : vendor.lon),
        phone: String(vendor.phone || "").slice(0, 40)
      },
      dropoff: {
        name: String(drop.name || "").slice(0, 120),
        lat: Number(drop.lat),
        lng: Number(drop.lng != null ? drop.lng : drop.lon),
        phone: String(drop.phone || "").slice(0, 40),
        instructions: String(drop.instructions || "").slice(0, 240)
      },
      items: items.slice(0, 50).map(function (it) {
        return {
          name: String(it.name || it.title || "item").slice(0, 120),
          qty: Math.max(1, Number(it.qty || it.quantity) || 1),
          price_cents: Math.max(0, Number(it.price_cents != null ? it.price_cents : Math.round((Number(it.price) || 0) * 100)) || 0)
        };
      }),
      currency: String(raw.currency || "AVE").slice(0, 8),
      delivery_fee_cents: Math.max(0, Number(raw.delivery_fee_cents) || 0),
      offer: raw.offer && typeof raw.offer === "object" ? {
        driver_payout_cents: Math.max(0, Number(raw.offer.driver_payout_cents) || 0),
        expires_at: String(raw.offer.expires_at || "").slice(0, 40)
      } : null,
      city_account_id: String(raw.city_account_id || "").slice(0, 80) || null,
      created_at: String(raw.created_at || new Date().toISOString()).slice(0, 40)
    };
  }

  function normalizeCityAccount(raw) {
    if (!raw || typeof raw !== "object") return null;
    var name = String(raw.name || raw.office_name || "").trim().slice(0, 120);
    var lat = Number(raw.lat);
    var lng = Number(raw.lng != null ? raw.lng : raw.lon);
    if (!name || !isFinite(lat) || !isFinite(lng)) return null;
    return {
      id: String(raw.id || "").slice(0, 80) || null,
      partner_id: String(raw.partner_id || raw.platform || "").slice(0, 80),
      name: name,
      city: String(raw.city || "").slice(0, 80),
      lat: lat,
      lng: lng,
      vendor_type: "delivery_services",
      kind: "delivery_services",
      virtual_office: raw.virtual_office !== false,
      overflow_enabled: raw.overflow_enabled !== false
    };
  }

  return {
    ORDER_STATUSES: ORDER_STATUSES,
    SOURCES: SOURCES,
    VENDOR_TYPES: VENDOR_TYPES,
    WEBHOOK_EVENTS: WEBHOOK_EVENTS,
    normalizeStatus: normalizeStatus,
    normalizeVendorType: normalizeVendorType,
    normalizeOrder: normalizeOrder,
    normalizeCityAccount: normalizeCityAccount
  };
});

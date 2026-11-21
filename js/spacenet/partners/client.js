/**
 * Thin browser helper for Astranov partner / direct-vendor / overflow APIs.
 * Does not store secrets — pass API key from partner console / env at call time.
 */
(function (root, factory) {
  var types = typeof require === "function"
    ? require("./types")
    : (root.SNPartnersTypes || {});
  if (typeof module === "object" && module.exports) module.exports = factory(types);
  else root.SNPartners = factory(types);
})(typeof self !== "undefined" ? self : this, function (T) {
  "use strict";

  var BASE = "/api/partners";
  var VBASE = "/api/vendors";

  function headers(apiKey, idem) {
    var h = { "Content-Type": "application/json", Accept: "application/json" };
    if (apiKey) h.Authorization = "Bearer " + apiKey;
    if (idem) h["Idempotency-Key"] = String(idem).slice(0, 120);
    return h;
  }

  function post(path, body, apiKey, idem) {
    return fetch(path, {
      method: "POST",
      headers: headers(apiKey, idem || (body && (body.idempotency_key || body.external_id))),
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().then(function (j) {
        return { ok: r.ok, status: r.status, body: j };
      });
    });
  }

  function put(path, body, apiKey) {
    return fetch(path, {
      method: "PUT",
      headers: headers(apiKey),
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().then(function (j) {
        return { ok: r.ok, status: r.status, body: j };
      });
    });
  }

  return {
    types: T,
    /** Partner pushes order/offer into Astranov (clients / drivers). */
    pushOrder: function (order, apiKey) {
      var n = T.normalizeOrder ? T.normalizeOrder(order) : order;
      return post(BASE + "/orders", n, apiKey, n && n.idempotency_key);
    },
    updateStatus: function (id, status, apiKey, extra) {
      var body = Object.assign({ status: status }, extra || {});
      return post(BASE + "/orders/" + encodeURIComponent(id) + "/status", body, apiKey);
    },
    /** Platform with vendor contracts: city / virtual office pin (delivery_services). */
    createCityAccount: function (account, apiKey) {
      var n = T.normalizeCityAccount ? T.normalizeCityAccount(account) : account;
      return post(BASE + "/city-accounts", n, apiKey, n && (n.id || n.name));
    },
    /** Overflow when platform runs out of drivers → Astranov power-ON drivers. */
    pushOverflowOffer: function (offer, apiKey) {
      var body = offer && typeof offer === "object" ? offer : {};
      if (!body.source) body.source = "platform_overflow";
      if (!body.vendor_type) body.vendor_type = "delivery_services";
      var n = T.normalizeOrder ? T.normalizeOrder(body) : body;
      return post(BASE + "/overflow-offers", n, apiKey, n && n.idempotency_key);
    },
    /** Direct vendor (restaurant or delivery_services) — no DoorDash/DH required. */
    registerDirectVendor: function (vendor, apiKey) {
      return post(VBASE + "/direct", vendor, apiKey, vendor && (vendor.idempotency_key || vendor.id));
    },
    syncMenu: function (vendorId, menu, apiKey) {
      return put(VBASE + "/direct/" + encodeURIComponent(vendorId) + "/menu", { items: menu }, apiKey);
    },
    openapiUrl: BASE + "/openapi.json"
  };
});

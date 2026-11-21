/** GET /api/partners/openapi.json — light OpenAPI 3 stub. */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "method" }));
    return;
  }
  var doc = {
    openapi: "3.0.3",
    info: {
      title: "Astranov SpaceNet Partner API",
      version: "0.1.0",
      description: "Lean stubs: partner orders, direct vendors, city accounts / overflow. Delivery-services vendors use the same map UX as restaurants."
    },
    servers: [{ url: "https://astranov.eu" }],
    paths: {
      "/api/partners/orders": {
        post: {
          summary: "Push order or offer into Astranov",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "Idempotency-Key", in: "header", schema: { type: "string" } }],
          responses: { "201": { description: "Created" } }
        }
      },
      "/api/partners/orders/{id}/status": {
        post: {
          summary: "Update order status",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Updated" } }
        }
      },
      "/api/partners/city-accounts": {
        post: {
          summary: "Register city / virtual office (delivery_services)",
          responses: { "201": { description: "Created" } }
        }
      },
      "/api/partners/overflow-offers": {
        post: {
          summary: "Push overflow driver offer when platform fleet is short",
          responses: { "201": { description: "Created" } }
        }
      },
      "/api/partners/webhooks/test": {
        post: { summary: "Webhook echo / signature check", responses: { "200": { description: "OK" } } }
      },
      "/api/vendors/direct": {
        post: {
          summary: "Direct vendor register (vendor or delivery_services)",
          responses: { "201": { description: "Created" } }
        }
      },
      "/api/vendors/direct/{id}/menu": {
        put: {
          summary: "Sync menu or delivery SKUs",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "OK" } }
        }
      }
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" }
      },
      schemas: {
        OrderStatus: {
          type: "string",
          enum: ["created", "accepted", "preparing", "ready_for_pickup", "picked_up", "delivered", "cancelled"]
        },
        VendorType: {
          type: "string",
          enum: ["vendor", "delivery_services"]
        }
      }
    }
  };
  res.statusCode = 200;
  res.end(JSON.stringify(doc));
};

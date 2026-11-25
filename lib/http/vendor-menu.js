const { resolve } = require("../sb-anon");

function cleanProduct(row) {
  if (!row || typeof row.name !== "string" || !row.name.trim() || row.name.length > 80 ||
      typeof row.note !== "string" || row.note.length > 300 ||
      typeof row.category !== "string" || row.category.length > 60 ||
      typeof row.photo !== "string" || row.photo.length > 2048 || (row.photo && !/^https:\/\/\S+$/i.test(row.photo)) ||
      !Number.isFinite(row.price) || row.price < 0.01 || row.price > 9999.99 ||
      !Number.isInteger(row.quantity) || row.quantity < 0 || row.quantity > 99999 ||
      (row.days != null && (!Array.isArray(row.days) || !row.days.length ||
        row.days.length > 7 || row.days.some(day => !Number.isInteger(day) || day < 0 || day > 6)))) return null;
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!!row.from !== !!row.until || (row.from && (typeof row.from !== "string" || typeof row.until !== "string" ||
      !time.test(row.from) || !time.test(row.until)))) return null;
  return {
    name: row.name.trim(), note: row.note, category: row.category, photo: row.photo,
    price: Math.round(row.price * 100) / 100, quantity: row.quantity, days: row.days || null,
    from: row.from || "", until: row.until || "",
    hours: row.from && row.from !== row.until ? row.from + "–" + row.until : "All day"
  };
}

module.exports = async function vendorMenu(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "method" });
  const vendor = new URL(req.url, "https://spacenet.astranov.eu").searchParams.get("vendor") || "";
  if (!/^[\w:-]{1,128}$/.test(vendor)) return res.status(400).json({ error: "invalid_vendor" });
  const write = req.method === "POST";
  const auth = req.headers.authorization || "";
  if (write && !/^Bearer \S+$/i.test(auth)) return res.status(401).json({ error: "auth_required" });
  try {
    const { anon, sb } = await resolve();
    if (!anon) return res.status(503).json({ error: "menu_unavailable" });
    const headers = { apikey: anon, Authorization: write ? auth : "Bearer " + anon };
    const signal = AbortSignal.timeout(5000);
    if (!write) {
      const filters = new URLSearchParams({ id: "eq." + vendor, select: "items,address", limit: 1 });
      const response = await fetch(sb + "/rest/v1/vendors?" + filters, { headers, signal });
      if (!response.ok) return res.status(503).json({ error: "menu_unavailable" });
      const [row] = await response.json();
      const saved = Array.isArray(row?.items) ? row.items : [];
      const items = saved.length || !row?.address?.website ? saved : await require("../published-menu")(row.address.website);
      return res.status(200).json({ registered: Boolean(row), items });
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!Array.isArray(body?.items) || !body.items.length || body.items.length > 200) {
      return res.status(400).json({ error: "invalid_menu" });
    }
    const products = body.items.map(cleanProduct);
    if (products.some(row => !row)) return res.status(400).json({ error: "invalid_menu" });
    const response = await fetch(sb + "/rest/v1/rpc/sn_append_vendor_menu", {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" }, signal,
      body: JSON.stringify({ vendor_ref: vendor, products })
    });
    if (!response.ok) return res.status(response.status === 403 || response.status === 401 ? 403 : 503).json({ error: "menu_unavailable" });
    return res.status(200).json({ items: await response.json() });
  } catch (error) {
    return res.status(error instanceof SyntaxError ? 400 : 503).json({ error: "menu_unavailable" });
  }
};

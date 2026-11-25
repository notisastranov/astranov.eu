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
  if (row.weight_g != null && (!Number.isFinite(row.weight_g) || row.weight_g<=0) ||
      row.temperature_c != null && !Number.isFinite(row.temperature_c) ||
      !!row.produced_at !== !!row.lifetime_minutes ||
      row.produced_at && (!Number.isFinite(Date.parse(row.produced_at)) || !Number.isInteger(row.lifetime_minutes) || row.lifetime_minutes<1 || row.lifetime_minutes>5256000)) return null;
  return {
    weight_g:row.weight_g ?? null, temperature_c:row.temperature_c ?? null, produced_at:row.produced_at || null, lifetime_minutes:row.lifetime_minutes || null,
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
      const filters = new URLSearchParams({ id: "eq." + vendor, select: "items,address,name,category,tags", limit: 1 });
      const response = await fetch(sb + "/rest/v1/vendors?" + filters, { headers, signal });
      if (!response.ok) return res.status(503).json({ error: "menu_unavailable" });
      const [row] = await response.json();
      const saved = Array.isArray(row?.items) ? row.items : [];
      const site = row?.address?.website || row?.tags?.website;
      const knownPhone = row?.address?.phone || row?.tags?.phone;
      const found = site && (!saved.length || !knownPhone) ? await require("../published-menu")(site) : {};
      let items = saved.length ? saved : found.items || [];
      if (row && !items.length) {
        const type = [row.name,row.category,row.tags?.cuisine].join(" ");
        const examples = [[/pizz|πιτσ/i,"Margherita pizza",10],[/cafe|coffee|καφέ/i,"Espresso",3],[/bakery/i,"Bread loaf",3],[/restaurant|grill|fast_food/i,"House meal",9],[/pub|bar/i,"Soft drink",3]];
        const example = examples.find(entry=>entry[0].test(type));
        items = [{name:example?.[1] || (row.category || "Shop")+" item",price:example?.[2] || 1,sample:true,note:"Sample item · indicative price"}];
      }
      let canEdit = false;
      if (row && /^Bearer \S+$/i.test(auth)) {
        const check = await fetch(sb+"/rest/v1/rpc/sn_can_edit_menu",{method:"POST",headers:{apikey:anon,Authorization:auth,"Content-Type":"application/json"},body:JSON.stringify({vendor_ref:vendor}),signal:AbortSignal.timeout(4000)});
        canEdit = check.ok && await check.json() === true;
      }
      return res.status(200).json({registered:Boolean(row),stored:!!saved.length,items,canEdit,phone:knownPhone || found.phone,website:site,address:row?.address,hours:row?.tags?.opening_hours});
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!Array.isArray(body?.items) || !body.items.length || body.items.length > 200) {
      return res.status(400).json({ error: "invalid_menu" });
    }
    const products = body.items.map(cleanProduct);
    if (products.some(row => !row)) return res.status(400).json({ error: "invalid_menu" });
    const edit = Number.isInteger(body.index) && products.length===1;
    const response = await fetch(sb + "/rest/v1/rpc/" + (edit?"sn_replace_menu_item":"sn_append_vendor_menu"), {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" }, signal,
      body: JSON.stringify(edit?{vendor_ref:vendor,position_idx:body.index,previous:body.previous,product:products[0]}:{ vendor_ref: vendor, products })
    });
    if (!response.ok) return res.status(response.status === 403 || response.status === 401 ? 403 : 503).json({ error: "menu_unavailable" });
    return res.status(200).json({ items: await response.json() });
  } catch (error) {
    return res.status(error instanceof SyntaxError ? 400 : 503).json({ error: "menu_unavailable" });
  }
};

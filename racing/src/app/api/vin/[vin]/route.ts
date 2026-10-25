import { NextRequest } from "next/server";

/**
 * Proxy NHTSA vPIC for VIN decoding. Free, no auth, public dataset.
 * We proxy server-side so the browser doesn't pay the CORS dance and so
 * we can cache responses locally if we want to later.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ vin: string }> }) {
  const { vin } = await ctx.params;
  if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
    return Response.json({ error: "Invalid VIN format" }, { status: 400 });
  }
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`;
  try {
    const r = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 30 } });
    if (!r.ok) {
      return Response.json({ error: `NHTSA ${r.status}` }, { status: 502 });
    }
    const data = await r.json();
    const row = (data?.Results ?? [])[0] ?? {};
    return Response.json({
      vin,
      make: row.Make || null,
      model: row.Model || null,
      year: row.ModelYear ? parseInt(row.ModelYear, 10) : null,
      engine: row.DisplacementL ? `${row.DisplacementL}L ${row.EngineConfiguration || ""}`.trim() : null,
      fuel: row.FuelTypePrimary || null,
      drive: row.DriveType || null,
      transmission: row.TransmissionStyle || null,
      raw: row,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}

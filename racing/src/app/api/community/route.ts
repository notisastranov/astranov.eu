import { NextRequest } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { getDb } from "@/lib/db";

/**
 * Opt-in community knowledge base. Users explicitly choose to share an
 * anonymized diagnosis; we hash the VIN before storage so identity isn't
 * persisted alongside the snapshot.
 */

const ShareSchema = z.object({
  vin: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().optional(),
  engine: z.string().optional(),
  dtcs: z.array(z.string()),
  freezeFrame: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  diagnosis: z.string().min(20),
});

export async function POST(req: NextRequest) {
  let body;
  try {
    body = ShareSchema.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: "Invalid share payload", details: (err as Error).message },
      { status: 400 },
    );
  }

  const vinHash = body.vin
    ? crypto.createHash("sha256").update(body.vin).digest("hex")
    : null;

  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO shared_diagnoses
      (vin_hash, make, model, year, engine, dtcs_json, freeze_frame_json, diagnosis_md, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const info = stmt.run(
    vinHash,
    body.make ?? null,
    body.model ?? null,
    body.year ?? null,
    body.engine ?? null,
    JSON.stringify(body.dtcs),
    body.freezeFrame ? JSON.stringify(body.freezeFrame) : null,
    body.diagnosis,
    Date.now(),
  );
  return Response.json({ ok: true, id: info.lastInsertRowid });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  const dtc = url.searchParams.get("dtc");

  const db = getDb();
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (make) { where.push("make = ?"); args.push(make); }
  if (model) { where.push("model = ?"); args.push(model); }
  if (dtc) { where.push("dtcs_json LIKE ?"); args.push(`%${dtc}%`); }

  const sql = `SELECT id, make, model, year, engine, dtcs_json, diagnosis_md, created_at
               FROM shared_diagnoses
               ${where.length ? "WHERE " + where.join(" AND ") : ""}
               ORDER BY created_at DESC
               LIMIT 50`;
  const rows = db.prepare(sql).all(...args);
  return Response.json({ rows });
}

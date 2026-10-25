"use client";

import { useEffect, useState } from "react";

interface Row {
  id: number;
  make: string | null;
  model: string | null;
  year: number | null;
  engine: string | null;
  dtcs_json: string;
  diagnosis_md: string;
  created_at: number;
}

export default function CommunityPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState({ make: "", model: "", dtc: "" });

  async function load() {
    const params = new URLSearchParams();
    if (filter.make) params.set("make", filter.make);
    if (filter.model) params.set("model", filter.model);
    if (filter.dtc) params.set("dtc", filter.dtc);
    const r = await fetch(`/api/community?${params}`);
    const data = await r.json();
    setRows(data.rows ?? []);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = q
    ? rows.filter((r) => (r.diagnosis_md + " " + (r.make ?? "") + " " + (r.model ?? "")).toLowerCase().includes(q.toLowerCase()))
    : rows;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Community knowledge</h1>
      <p className="text-sm text-muted max-w-2xl">
        Anonymized diagnoses other users opted to share. VINs are hashed
        before storage; only the make/model/year/engine and the AI analysis
        are kept. Useful for "has anyone else seen this on a 2.0T?"
      </p>

      <section className="panel p-4 grid md:grid-cols-4 gap-3 text-sm">
        <input className="bg-panel border border-edge rounded px-2 py-1.5"
               placeholder="Make" value={filter.make}
               onChange={(e) => setFilter({ ...filter, make: e.target.value })} />
        <input className="bg-panel border border-edge rounded px-2 py-1.5"
               placeholder="Model" value={filter.model}
               onChange={(e) => setFilter({ ...filter, model: e.target.value })} />
        <input className="bg-panel border border-edge rounded px-2 py-1.5"
               placeholder="DTC (e.g. P0420)" value={filter.dtc}
               onChange={(e) => setFilter({ ...filter, dtc: e.target.value })} />
        <button className="btn btn-primary" onClick={load}>Search</button>
      </section>

      <input className="w-full bg-panel border border-edge rounded px-3 py-2 text-sm"
             placeholder="Filter results…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-sm text-muted">No shared diagnoses yet.</div>
        )}
        {filtered.map((r) => (
          <article key={r.id} className="panel p-4">
            <header className="flex items-baseline gap-3 mb-2">
              <span className="font-semibold">
                {[r.year, r.make, r.model].filter(Boolean).join(" ") || "Unknown vehicle"}
              </span>
              <span className="text-xs text-muted mono">{JSON.parse(r.dtcs_json).join(" ")}</span>
              <span className="ml-auto text-xs text-muted">{new Date(r.created_at).toLocaleDateString()}</span>
            </header>
            <div className="prose-tight whitespace-pre-wrap text-sm">{r.diagnosis_md}</div>
          </article>
        ))}
      </div>
    </div>
  );
}

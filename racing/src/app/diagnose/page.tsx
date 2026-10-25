"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { parseDtcResponse, lookupDtc } from "@/lib/obd/dtc";
import { parseVin } from "@/lib/obd/vin";

type Dtc = { code: string; description: string | null; pending?: boolean };

export default function DiagnosePage() {
  const { adapter, status, vehicle, setVehicle } = useStore();
  const [dtcs, setDtcs] = useState<Dtc[]>([]);
  const [vin, setVin] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiText, setAiText] = useState<string>("");
  const [aiBusy, setAiBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function readDtcs() {
    if (!adapter || status !== "connected") return;
    setBusy(true); setErr(null);
    try {
      const frames = await adapter.send("03");
      const codes = parseDtcResponse(frames);
      const items: Dtc[] = codes.map((c) => {
        const info = lookupDtc(c);
        return { code: c, description: info?.description ?? null };
      });
      setDtcs(items);

      try {
        const vinFrames = await adapter.send("0902");
        const v = parseVin(vinFrames);
        if (v) {
          setVin(v);
          const r = await fetch(`/api/vin/${v}`);
          if (r.ok) {
            const data = await r.json();
            setVehicle({ vin: v, make: data.make, model: data.model, year: data.year, engine: data.engine });
          } else {
            setVehicle({ vin: v });
          }
        }
      } catch {
        // VIN may be unavailable on older ECUs — not fatal
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runAi() {
    if (dtcs.length === 0) return;
    setAiBusy(true); setAiText(""); setErr(null);
    try {
      const snap = useStore.getState().snapshot;
      const r = await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle: vehicle ?? undefined,
          dtcs: dtcs.map((d) => ({ code: d.code, description: d.description })),
          livePids: snap?.livePids,
          freezeFrame: snap?.freezeFrame,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const reader = r.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const ev = JSON.parse(line.slice(5).trim());
            if (ev.type === "text") setAiText((t) => t + ev.text);
            else if (ev.type === "error") setErr(ev.message);
          } catch {}
        }
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setAiBusy(false);
    }
  }

  async function clearCodes() {
    if (!adapter || status !== "connected") return;
    if (!confirm("Clear all stored DTCs and freeze-frame data? This will reset readiness monitors.")) return;
    setBusy(true);
    try {
      await adapter.send("04");
      setDtcs([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Diagnose</h1>

      <section className="panel p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button className="btn btn-primary" disabled={busy || status !== "connected"} onClick={readDtcs}>
            {busy ? "Reading…" : "Read DTCs"}
          </button>
          <button className="btn" disabled={busy || dtcs.length === 0 || status !== "connected"} onClick={clearCodes}>
            Clear codes
          </button>
          <button className="btn" disabled={aiBusy || dtcs.length === 0} onClick={runAi}>
            {aiBusy ? "Analyzing…" : "AI explain"}
          </button>
          {vin && <span className="ml-auto text-xs text-muted mono">VIN {vin}</span>}
        </div>

        {err && <div className="text-sm text-accent mb-3">{err}</div>}

        {vehicle && (
          <div className="text-sm text-muted mb-4">
            {[vehicle.year, vehicle.make, vehicle.model, vehicle.engine].filter(Boolean).join(" · ")}
          </div>
        )}

        {dtcs.length === 0 ? (
          <p className="text-sm text-muted">No codes read yet.</p>
        ) : (
          <ul className="divide-y divide-edge">
            {dtcs.map((d) => (
              <li key={d.code} className="py-2.5 flex items-baseline gap-4">
                <span className="mono text-accent font-semibold">{d.code}</span>
                <span className="text-sm">{d.description ?? <em className="text-muted">Manufacturer-specific or unknown — AI explain will look it up.</em>}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(aiBusy || aiText) && (
        <section className="panel p-5">
          <h2 className="font-semibold mb-3">AI diagnosis</h2>
          {aiBusy && !aiText && <div className="text-sm text-muted">Thinking…</div>}
          <div className="prose-tight whitespace-pre-wrap text-sm">{aiText}</div>
        </section>
      )}
    </div>
  );
}

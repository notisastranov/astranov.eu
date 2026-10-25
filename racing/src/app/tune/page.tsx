"use client";

import { useState } from "react";

interface Datalog {
  headers: string[];
  rows: number[][];
  sampleHz?: number;
}

export default function TunePage() {
  const [log, setLog] = useState<Datalog | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [platform, setPlatform] = useState("rusEFI");
  const [induction, setInduction] = useState<"NA" | "turbo" | "supercharger">("turbo");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const text = await file.text();
    setLog(parseCsv(text));
  }

  async function analyze() {
    if (!log) return;
    setBusy(true); setResult(""); setErr(null);
    try {
      const r = await fetch("/api/ai/tune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engine: { platform, induction },
          datalog: log,
          question: question || undefined,
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
            if (ev.type === "text") setResult((t) => t + ev.text);
            else if (ev.type === "error") setErr(ev.message);
          } catch {}
        }
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Tune analysis</h1>
      <p className="text-sm text-muted max-w-2xl">
        Upload a CSV datalog from your open ECU (rusEFI, Speeduino, MegaSquirt, TunerStudio
        exports — anything with column headers). The AI summarizes coverage, finds knock/lean/rich
        events, and proposes map changes only for cells the data supports.
      </p>

      <section className="panel p-5">
        <div className="grid md:grid-cols-3 gap-4">
          <label className="text-sm">
            <span className="block text-muted mb-1">Datalog (.csv)</span>
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="w-full text-xs file:btn file:mr-2" />
            {filename && <div className="text-xs text-muted mt-1 mono">{filename} · {log?.rows.length ?? 0} rows</div>}
          </label>
          <label className="text-sm">
            <span className="block text-muted mb-1">Platform</span>
            <select className="w-full bg-panel border border-edge rounded px-2 py-1.5"
                    value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option>rusEFI</option>
              <option>Speeduino</option>
              <option>MegaSquirt</option>
              <option>Haltech</option>
              <option>Link</option>
              <option>MoTeC</option>
              <option>Other</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-muted mb-1">Induction</span>
            <select className="w-full bg-panel border border-edge rounded px-2 py-1.5"
                    value={induction} onChange={(e) => setInduction(e.target.value as typeof induction)}>
              <option value="NA">Naturally aspirated</option>
              <option value="turbo">Turbocharged</option>
              <option value="supercharger">Supercharged</option>
            </select>
          </label>
        </div>
        <label className="block mt-4 text-sm">
          <span className="block text-muted mb-1">Specific question (optional)</span>
          <textarea
            className="w-full bg-panel border border-edge rounded px-3 py-2 text-sm"
            rows={2}
            placeholder="e.g. AFR going lean at 5500 rpm under WOT — what does the log show?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </label>
        <div className="mt-4">
          <button className="btn btn-primary" disabled={!log || busy} onClick={analyze}>
            {busy ? "Analyzing…" : "Analyze datalog"}
          </button>
        </div>
        {err && <div className="text-sm text-accent mt-3">{err}</div>}
      </section>

      {(busy || result) && (
        <section className="panel p-5">
          <h2 className="font-semibold mb-3">Analysis</h2>
          {busy && !result && <div className="text-sm text-muted">Thinking…</div>}
          <div className="prose-tight whitespace-pre-wrap text-sm">{result}</div>
        </section>
      )}
    </div>
  );
}

function parseCsv(text: string): Datalog {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: number[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const tokens = lines[i].split(",").map((t) => t.trim());
    if (tokens.length !== headers.length) continue;
    const row = tokens.map((t) => {
      const n = parseFloat(t);
      return Number.isFinite(n) ? n : NaN;
    });
    if (row.some(Number.isFinite)) rows.push(row);
  }
  return { headers, rows };
}

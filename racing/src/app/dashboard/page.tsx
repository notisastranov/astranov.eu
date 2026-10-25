"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { PIDS, decodePidResponse, type PidDef } from "@/lib/obd/pids";
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip } from "recharts";

const TRACKED: string[] = ["0C", "0D", "05", "0F", "10", "11", "04", "06", "07", "42", "0B", "5E"];

type Series = { ts: number; value: number }[];

export default function DashboardPage() {
  const { adapter, status, updatePid, snapshot } = useStore();
  const [series, setSeries] = useState<Record<string, Series>>({});
  const [polling, setPolling] = useState(false);
  const stopRef = useRef(false);

  useEffect(() => () => { stopRef.current = true; }, []);

  useEffect(() => {
    if (!adapter || status !== "connected" || polling) return;
    setPolling(true);
    stopRef.current = false;
    (async () => {
      while (!stopRef.current && useStore.getState().adapter === adapter) {
        for (const pid of TRACKED) {
          if (stopRef.current) break;
          try {
            const frames = await adapter.send(`01${pid}`);
            const v = decodePidResponse(pid, frames);
            if (v != null) {
              updatePid(pid, v);
              setSeries((s) => {
                const next = (s[pid] ?? []).concat({ ts: Date.now(), value: v });
                return { ...s, [pid]: next.slice(-60) };
              });
            }
          } catch {
            // skip — adapter may be re-syncing
          }
        }
      }
      setPolling(false);
    })();
    return () => { stopRef.current = true; };
  }, [adapter, status, polling, updatePid]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Live dashboard</h1>
        {status !== "connected" && (
          <span className="text-sm text-muted">Connect an adapter to see live data.</span>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {TRACKED.map((pid) => {
          const def = PIDS[pid];
          return (
            <Card
              key={pid}
              def={def}
              value={snapshot?.livePids[pid]}
              series={series[pid] ?? []}
            />
          );
        })}
      </div>
    </div>
  );
}

function Card({ def, value, series }: { def: PidDef; value?: number; series: Series }) {
  const text = value != null ? value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2) : "—";
  return (
    <div className="panel p-4">
      <div className="text-xs text-muted">{def.shortName}</div>
      <div className="text-2xl font-semibold mono tabular-nums">
        {text} <span className="text-xs text-muted font-normal">{def.unit}</span>
      </div>
      <div className="text-[10px] text-muted mt-0.5 truncate">{def.name}</div>
      <div className="h-12 -mx-1 mt-2">
        {series.length > 1 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <XAxis dataKey="ts" hide />
              <YAxis domain={["dataMin", "dataMax"]} hide />
              <Tooltip
                contentStyle={{ background: "#121215", border: "1px solid #1f1f24", fontSize: 11 }}
                labelFormatter={(v) => new Date(v).toLocaleTimeString()}
                formatter={(v: number) => [`${v.toFixed(2)} ${def.unit}`, def.shortName]}
              />
              <Line type="monotone" dataKey="value" stroke="#ff4d4d" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

"use client";

import { useStore } from "@/lib/store";

export default function ConnectionPill() {
  const { status, info } = useStore();
  const cls =
    status === "connected" ? "dot-ok" :
    status === "connecting" ? "dot-warn" :
    status === "error" ? "dot-err" : "dot-off";
  const label =
    status === "connected" ? (info?.name ?? "Connected") :
    status === "connecting" ? "Connecting…" :
    status === "error" ? "Adapter error" : "No adapter";
  return (
    <div className="flex items-center text-sm">
      <span className={`dot ${cls}`} />
      <span className="mono">{label}</span>
    </div>
  );
}

"use client";

import { describeCadastreStub, type CadastreLayerMode } from "@/lib/geo/ktima";
import type { ZoomLevel } from "@/lib/types";

interface NationalLayerProps {
  level: ZoomLevel;
  mode: CadastreLayerMode;
  onModeChange: (mode: CadastreLayerMode) => void;
}

/**
 * National / Hellenic layer switch stub.
 * Live Ktimatologio WMS is out of scope — Greece / Rhodes framing only.
 */
export function NationalLayer({ level, mode, onModeChange }: NationalLayerProps) {
  if (level !== "national" && level !== "city" && level !== "plot") return null;

  return (
    <div className="pointer-events-auto absolute bottom-24 left-3 z-30 flex flex-col gap-1 rounded-xl border border-[color:var(--glow-line)] bg-[color:var(--panel)]/95 p-2 text-[11px] text-[color:var(--muted)] shadow-[0_0_24px_rgba(77,240,255,0.12)] backdrop-blur-md">
      <div className="px-1 font-semibold tracking-[0.18em] text-[color:var(--accent)] uppercase">
        Nations
      </div>
      <p className="max-w-[14rem] px-1 leading-snug">{describeCadastreStub(mode)}</p>
      <div className="mt-1 flex gap-1">
        {(["off", "greece", "rhodes"] as CadastreLayerMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className={`rounded-md px-2 py-1 font-semibold tracking-wide uppercase ${
              mode === m
                ? "bg-[color:var(--accent)] text-[#041018]"
                : "border border-[color:var(--glow-line)] text-[color:var(--fg)]"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

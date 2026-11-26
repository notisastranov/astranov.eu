"use client";

import type { ZoomLevel } from "@/lib/types";

interface CityServicesProps {
  level: ZoomLevel;
  balanceLabel: string;
  onOpenCredits: () => void;
}

/**
 * City streets / POI continuum panel — credits entry at street level.
 * OSM-style dark streets come from Cesium imagery in GlobeView when zoomed in.
 */
export function CityServices({
  level,
  balanceLabel,
  onOpenCredits,
}: CityServicesProps) {
  if (level !== "city" && level !== "plot") return null;

  return (
    <aside className="pointer-events-auto absolute top-24 right-3 z-30 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border border-[color:var(--glow-line)] bg-[color:var(--panel)]/95 p-3 shadow-[0_0_28px_rgba(77,240,255,0.14)] backdrop-blur-md">
      <div className="text-[11px] font-semibold tracking-[0.2em] text-[color:var(--accent)] uppercase">
        City services
      </div>
      <p className="mt-1 text-sm leading-snug text-[color:var(--muted)]">
        Streets + POI stubs. Tap a plot on the globe to open Architect.
      </p>
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[color:var(--glow-line)] bg-black/35 px-3 py-2">
        <div>
          <div className="text-[10px] tracking-[0.16em] text-[color:var(--muted)] uppercase">
            Credits
          </div>
          <div className="font-mono text-lg text-[color:var(--accent)]">
            {balanceLabel}
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenCredits}
          className="rounded-lg bg-[color:var(--accent)] px-3 py-2 text-xs font-bold tracking-wide text-[#041018] uppercase"
        >
          Wallet
        </button>
      </div>
      <ul className="mt-3 space-y-1 text-xs text-[color:var(--fg)]">
        <li className="flex justify-between border-b border-white/5 py-1">
          <span>Delivery mesh</span>
          <span className="text-[color:var(--muted)]">stub</span>
        </li>
        <li className="flex justify-between border-b border-white/5 py-1">
          <span>Vendor pins</span>
          <span className="text-[color:var(--muted)]">OSM later</span>
        </li>
        <li className="flex justify-between py-1">
          <span>Site film</span>
          <span className="text-[color:var(--muted)]">Architect</span>
        </li>
      </ul>
    </aside>
  );
}

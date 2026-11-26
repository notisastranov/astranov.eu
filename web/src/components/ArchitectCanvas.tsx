"use client";

import { useCallback, useMemo, useState } from "react";
import { AICommandBar } from "@/components/AICommandBar";
import type { CanvasOp } from "@/lib/ai/canvas-mapping";
import type { Plot } from "@/lib/types";
import { estimatePlotArea } from "@/lib/survey/vincenty-shoelace";

interface ArchitectCanvasProps {
  plot: Plot;
  onClose: () => void;
  onFlyTo?: (lat: number, lon: number) => void;
  onLayer?: (layer: "osm" | "ktima" | "greece" | "rhodes") => void;
}

type CadTool = "select" | "line" | "wall" | "rect" | "polyline" | "dim";

/**
 * Basic Architect surface opened from a plot click.
 * Topo stub + CAD tools + AICommandBar. Full CAD polish / IGM collage TODO.
 */
export function ArchitectCanvas({
  plot,
  onClose,
  onFlyTo,
  onLayer,
}: ArchitectCanvasProps) {
  const [tool, setTool] = useState<CadTool>("polyline");
  const [status, setStatus] = useState(
    "Topo stub · vault audit rings · site film stubs ready",
  );
  const [segments, setSegments] = useState<
    { x1: number; y1: number; x2: number; y2: number }[]
  >([]);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const [vaultOpen, setVaultOpen] = useState(false);

  const areaHint = useMemo(() => {
    const a = estimatePlotArea(plot.ring);
    return a == null
      ? "area: Vincenty/shoelace stub (null)"
      : `area: ${a.toFixed(1)} m²`;
  }, [plot.ring]);

  const applyOps = useCallback(
    (ops: CanvasOp[]) => {
      for (const op of ops) {
        switch (op.op) {
          case "setTool":
            setTool(op.tool);
            setStatus(`Tool: ${op.tool}`);
            break;
          case "flyTo":
            onFlyTo?.(op.lat, op.lon);
            setStatus(op.label ? `Fly ${op.label}` : `Fly ${op.lat}, ${op.lon}`);
            break;
          case "layer":
            onLayer?.(op.layer);
            setStatus(`Layer stub: ${op.layer}`);
            break;
          case "vaultAudit":
            setVaultOpen(true);
            setStatus("Vault audit rings (forensic topo hook)");
            break;
          case "siteFilm":
            setStatus("Site film stub — encoder out of scope");
            break;
          case "status":
            setStatus(op.message);
            break;
          case "noop":
            setStatus(op.reason);
            break;
        }
      }
    },
    [onFlyTo, onLayer],
  );

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (tool === "select" || tool === "dim") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (!draft) {
      setDraft({ x, y });
      return;
    }
    setSegments((s) => [...s, { x1: draft.x, y1: draft.y, x2: x, y2: y }]);
    setDraft(null);
    setStatus(`Drew ${tool} segment · ${segments.length + 1} edges`);
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex flex-col bg-[radial-gradient(ellipse_at_center,#0a1a2c_0%,#02040a_70%)]">
      <header className="flex items-center justify-between gap-3 border-b border-[color:var(--glow-line)] px-4 py-3">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.22em] text-[color:var(--accent)] uppercase">
            Architect
          </div>
          <h2 className="text-lg font-semibold text-[color:var(--fg)]">
            {plot.name}
          </h2>
          <p className="text-xs text-[color:var(--muted)]">
            {plot.citySlug ?? "city stub"} · {plot.nationCode} · {areaHint}
            {plot.ktimaRef ? ` · ktima ${plot.ktimaRef}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-[color:var(--glow-line)] px-3 py-2 text-sm text-[color:var(--fg)]"
        >
          Back to globe
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-40 flex-col gap-1 border-r border-[color:var(--glow-line)] p-2">
          {(
            [
              "select",
              "line",
              "wall",
              "rect",
              "polyline",
              "dim",
            ] as CadTool[]
          ).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTool(t);
                setStatus(`Tool: ${t}`);
              }}
              className={`rounded-lg px-2 py-2 text-left text-xs font-semibold tracking-wide uppercase ${
                tool === t
                  ? "bg-[color:var(--accent)] text-[#041018]"
                  : "text-[color:var(--fg)] hover:bg-white/5"
              }`}
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            onClick={() => applyOps([{ op: "vaultAudit" }])}
            className="mt-2 rounded-lg border border-[color:var(--glow-line)] px-2 py-2 text-left text-xs text-[color:var(--accent)]"
          >
            Vault audit
          </button>
          <button
            type="button"
            onClick={() => applyOps([{ op: "siteFilm" }])}
            className="rounded-lg border border-[color:var(--glow-line)] px-2 py-2 text-left text-xs text-[color:var(--fg)]"
          >
            Site film
          </button>
        </aside>

        <div className="relative flex-1">
          <svg
            className="h-full w-full touch-none"
            onPointerDown={onPointer}
            role="img"
            aria-label="Architect topo stub canvas"
          >
            <defs>
              <pattern
                id="topo-grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="rgba(77,240,255,0.08)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#topo-grid)" />
            {/* Contour stub */}
            <path
              d="M 40 280 C 120 220, 200 320, 300 240 S 480 180, 560 260"
              fill="none"
              stroke="rgba(77,240,255,0.35)"
              strokeWidth="1.5"
            />
            <path
              d="M 60 320 C 160 280, 220 360, 340 300 S 520 240, 620 310"
              fill="none"
              stroke="rgba(77,240,255,0.22)"
              strokeWidth="1"
            />
            {segments.map((s, i) => (
              <line
                key={i}
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke="#4df0ff"
                strokeWidth={tool === "wall" ? 4 : 2}
                strokeLinecap="round"
              />
            ))}
            {draft && (
              <circle cx={draft.x} cy={draft.y} r={4} fill="#4df0ff" />
            )}
            {vaultOpen && (
              <g>
                <polygon
                  points="180,140 320,120 360,220 240,260 160,210"
                  fill="rgba(77,240,255,0.06)"
                  stroke="#4df0ff"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
                <text
                  x="210"
                  y="190"
                  fill="#4df0ff"
                  fontSize="12"
                  fontFamily="ui-monospace, monospace"
                >
                  vault ring stub
                </text>
              </g>
            )}
          </svg>
          <AICommandBar onOps={applyOps} status={status} />
        </div>
      </div>
    </div>
  );
}

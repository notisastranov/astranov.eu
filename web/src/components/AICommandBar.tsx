"use client";

import { useState } from "react";
import { mapAiToCanvas, type CanvasOp } from "@/lib/ai/canvas-mapping";

interface AICommandBarProps {
  onOps: (ops: CanvasOp[], raw: string) => void;
  status: string;
}

export function AICommandBar({ onOps, status }: AICommandBarProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    const mapped = mapAiToCanvas(value);
    onOps(mapped.ops, mapped.raw);
    setValue("");
  };

  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-40 flex flex-col gap-2">
      <div className="truncate px-1 text-xs text-[color:var(--muted)]">{status}</div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="AI / CAD — try rhodes, ktima, vault, wall, film…"
          className="min-w-0 flex-1 rounded-xl border border-[color:var(--glow-line)] bg-black/55 px-3 py-3 text-sm text-[color:var(--fg)] outline-none placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)]"
        />
        <button
          type="submit"
          className="rounded-xl bg-[color:var(--accent)] px-4 py-3 text-sm font-bold tracking-wide text-[#041018] uppercase shadow-[0_0_18px_rgba(77,240,255,0.35)]"
        >
          Go
        </button>
      </form>
    </div>
  );
}

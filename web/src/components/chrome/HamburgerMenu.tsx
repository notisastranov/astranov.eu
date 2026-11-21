"use client";

import type { MenuPanel } from "@/lib/types";

const ITEMS: { id: Exclude<MenuPanel, null>; label: string }[] = [
  { id: "news", label: "News" },
  { id: "profile", label: "Profile" },
  { id: "plots", label: "My Plots" },
  { id: "credits", label: "Credits Wallet" },
  { id: "settings", label: "Settings" },
  { id: "help", label: "Help" },
];

interface HamburgerMenuProps {
  open: boolean;
  onToggle: () => void;
  active: MenuPanel;
  onSelect: (panel: Exclude<MenuPanel, null>) => void;
}

export function HamburgerMenu({
  open,
  onToggle,
  active,
  onSelect,
}: HamburgerMenuProps) {
  return (
    <div className="pointer-events-auto absolute top-3 left-3 z-40">
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={onToggle}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-[color:var(--glow-line)] bg-[color:var(--panel)]/95 text-[color:var(--accent)] shadow-[0_0_18px_rgba(77,240,255,0.25)]"
      >
        <span className="flex flex-col gap-1.5">
          <span className="block h-0.5 w-5 bg-current" />
          <span className="block h-0.5 w-5 bg-current" />
          <span className="block h-0.5 w-5 bg-current" />
        </span>
      </button>
      {open && (
        <nav className="mt-2 w-52 rounded-2xl border border-[color:var(--glow-line)] bg-[color:var(--panel)]/97 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
          {ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`mb-1 flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold tracking-wide ${
                active === item.id
                  ? "bg-[color:var(--accent)] text-[#041018]"
                  : "text-[color:var(--fg)] hover:bg-white/5"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

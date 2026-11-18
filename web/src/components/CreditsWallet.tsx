"use client";

import type { CreditTransaction } from "@/lib/types";

interface CreditsWalletProps {
  open: boolean;
  onClose: () => void;
  signedIn: boolean;
  balanceAve: number | null;
  transactions: CreditTransaction[];
}

/**
 * AV€ wallet panel. Guest: label only (no invented figure).
 * Production ledger / PayPal capture remain out of scope TODOs.
 */
export function CreditsWallet({
  open,
  onClose,
  signedIn,
  balanceAve,
  transactions,
}: CreditsWalletProps) {
  if (!open) return null;

  const balanceLabel = !signedIn
    ? "AV€"
    : balanceAve == null
      ? "AV€ unavailable"
      : `AV€ ${balanceAve.toFixed(2)}`;

  return (
    <div className="pointer-events-auto absolute top-20 left-1/2 z-40 w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl border border-[color:var(--glow-line)] bg-[color:var(--panel)]/97 p-4 shadow-[0_0_40px_rgba(77,240,255,0.18)] backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.22em] text-[color:var(--accent)] uppercase">
            Credits wallet
          </div>
          <div className="mt-2 font-mono text-3xl text-[color:var(--accent)]">
            {balanceLabel}
          </div>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            AV€ = EUR 1:1. Production ledger TODO — no fake top-ups here.
          </p>
        </div>
        <button
          type="button"
          aria-label="Close wallet"
          onClick={onClose}
          className="rounded-lg border border-[color:var(--glow-line)] px-2 py-1 text-sm text-[color:var(--fg)]"
        >
          ✕
        </button>
      </div>
      <div className="mt-4 max-h-48 overflow-auto">
        {transactions.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">
            No credit events yet. Realtime stub listens when Supabase env is set.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-2 border-b border-white/5 pb-2"
              >
                <span className="text-[color:var(--fg)]">{tx.memo || tx.kind}</span>
                <span
                  className={`font-mono ${
                    tx.amountAve >= 0
                      ? "text-[color:var(--accent)]"
                      : "text-rose-300"
                  }`}
                >
                  {tx.amountAve >= 0 ? "+" : ""}
                  {tx.amountAve.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

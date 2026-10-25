import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import ConnectionPill from "@/components/ConnectionPill";

export const metadata: Metadata = {
  title: "Racing — AI ECU Diagnostic & Tune",
  description: "Connect, diagnose, and tune your vehicle with an AI co-pilot.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-edge bg-panel/60 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight">
              <span className="text-accent">⏵</span> racing
            </Link>
            <nav className="flex gap-4 text-sm text-muted">
              <Link href="/connect" className="hover:text-ink">Connect</Link>
              <Link href="/dashboard" className="hover:text-ink">Dashboard</Link>
              <Link href="/diagnose" className="hover:text-ink">Diagnose</Link>
              <Link href="/tune" className="hover:text-ink">Tune</Link>
              <Link href="/community" className="hover:text-ink">Community</Link>
            </nav>
            <div className="ml-auto"><ConnectionPill /></div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-muted">
          Off-road / track use only. Do not use to defeat emissions controls. Diagnostic
          AI suggestions are not a substitute for a qualified technician.
        </footer>
      </body>
    </html>
  );
}

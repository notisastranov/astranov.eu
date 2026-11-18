"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArchitectCanvas } from "@/components/ArchitectCanvas";
import { AuthButton } from "@/components/chrome/AuthButton";
import { HamburgerMenu } from "@/components/chrome/HamburgerMenu";
import { CityServices } from "@/components/CityServices";
import { CreditsWallet } from "@/components/CreditsWallet";
import { NationalLayer } from "@/components/NationalLayer";
import { DEMO_PLOTS } from "@/lib/demo-plots";
import { LEVEL_LABEL } from "@/lib/geo/continuum";
import type { CadastreLayerMode } from "@/lib/geo/ktima";
import {
  getSupabase,
  hasSupabaseEnv,
  supabaseProjectHint,
} from "@/lib/supabase/client";
import {
  subscribeCredits,
  subscribePresence,
  subscribePosts,
} from "@/lib/supabase/realtime";
import type {
  CreditTransaction,
  MenuPanel,
  Plot,
  UserPost,
  ZoomLevel,
} from "@/lib/types";

const GlobeView = dynamic(
  () => import("@/components/GlobeView").then((m) => m.GlobeView),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 grid place-items-center bg-[#02040a] text-[color:var(--accent)]">
        Loading globe…
      </div>
    ),
  },
);

export function SpaceNetApp() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<MenuPanel>(null);
  const [level, setLevel] = useState<ZoomLevel>("global");
  const [cadastreMode, setCadastreMode] = useState<CadastreLayerMode>("off");
  const [activePlot, setActivePlot] = useState<Plot | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [balanceAve, setBalanceAve] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [flyTarget, setFlyTarget] = useState<{
    lat: number;
    lon: number;
    height?: number;
    nonce: number;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const plots = useMemo(() => DEMO_PLOTS, []);
  const sbHint = supabaseProjectHint();

  useEffect(() => {
    if (!hasSupabaseEnv()) return;
    const sb = getSupabase();
    if (!sb) return;
    void sb.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      setSignedIn(true);
      setDisplayName(
        (user.user_metadata?.full_name as string | undefined) ??
          user.email ??
          "You",
      );
      setAvatarUrl(
        (user.user_metadata?.avatar_url as string | undefined) ?? null,
      );
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      const user = session?.user;
      setSignedIn(Boolean(user));
      setDisplayName(
        user
          ? ((user.user_metadata?.full_name as string | undefined) ??
              user.email ??
              "You")
          : null,
      );
      setAvatarUrl(
        user
          ? ((user.user_metadata?.avatar_url as string | undefined) ?? null)
          : null,
      );
      if (!user) setBalanceAve(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const presence = subscribePresence(() => {});
    const postsSub = subscribePosts((post) => {
      setPosts((p) => [post, ...p].slice(0, 40));
    });
    const credits = subscribeCredits((tx) => {
      setTransactions((t) => [tx, ...t].slice(0, 40));
      if (tx.balanceAfter != null) setBalanceAve(tx.balanceAfter);
    });
    return () => {
      presence.unsubscribe();
      postsSub.unsubscribe();
      credits.unsubscribe();
    };
  }, []);

  const balanceLabel = !signedIn
    ? "AV€"
    : balanceAve == null
      ? "AV€"
      : `AV€ ${balanceAve.toFixed(2)}`;

  const onSelectMenu = (id: Exclude<MenuPanel, null>) => {
    setPanel(id);
    setMenuOpen(false);
    if (id === "credits") setWalletOpen(true);
  };

  const signIn = async () => {
    if (!hasSupabaseEnv()) {
      setToast(
        "Supabase env not set — login stub only. Set NEXT_PUBLIC_SUPABASE_URL + anon key.",
      );
      setSignedIn(true);
      setDisplayName("Local stub");
      return;
    }
    const sb = getSupabase();
    if (!sb) return;
    const redirectTo = `${window.location.origin}/`;
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) setToast(error.message);
  };

  const signOut = async () => {
    if (hasSupabaseEnv()) {
      await getSupabase()?.auth.signOut();
    }
    setSignedIn(false);
    setDisplayName(null);
    setAvatarUrl(null);
    setBalanceAve(null);
  };

  const onLayer = useCallback((layer: "osm" | "ktima" | "greece" | "rhodes") => {
    if (layer === "greece" || layer === "rhodes") setCadastreMode(layer);
    else if (layer === "ktima") setCadastreMode("rhodes");
    else setCadastreMode("off");
  }, []);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-[#02040a] text-[color:var(--fg)]">
      <GlobeView
        plots={plots}
        cadastreMode={cadastreMode}
        flyTarget={flyTarget}
        onLevelChange={setLevel}
        onPlotClick={(plot) => {
          setActivePlot(plot);
          setFlyTarget({
            lat: plot.centroid.lat,
            lon: plot.centroid.lon,
            height: 650,
            nonce: Date.now(),
          });
        }}
      />

      {/* Brand chrome */}
      <div className="pointer-events-none absolute top-3 left-1/2 z-40 -translate-x-1/2 text-center">
        <div className="astr-brand text-2xl tracking-[0.35em] sm:text-3xl md:text-4xl">
          ASTRANOV
        </div>
        <div className="mt-1 text-[10px] tracking-[0.28em] text-[color:var(--muted)] uppercase">
          SpaceNet · {LEVEL_LABEL[level]}
        </div>
      </div>

      <HamburgerMenu
        open={menuOpen}
        onToggle={() => setMenuOpen((o) => !o)}
        active={panel}
        onSelect={onSelectMenu}
      />
      <AuthButton
        signedIn={signedIn}
        displayName={displayName}
        avatarUrl={avatarUrl}
        onSignIn={() => void signIn()}
        onSignOut={() => void signOut()}
      />

      <NationalLayer
        level={level}
        mode={cadastreMode}
        onModeChange={setCadastreMode}
      />
      <CityServices
        level={level}
        balanceLabel={balanceLabel}
        onOpenCredits={() => {
          setWalletOpen(true);
          setPanel("credits");
        }}
      />
      <CreditsWallet
        open={walletOpen || panel === "credits"}
        onClose={() => {
          setWalletOpen(false);
          if (panel === "credits") setPanel(null);
        }}
        signedIn={signedIn}
        balanceAve={balanceAve}
        transactions={transactions}
      />

      {panel && panel !== "credits" && (
        <section className="pointer-events-auto absolute top-20 left-3 z-40 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-[color:var(--glow-line)] bg-[color:var(--panel)]/97 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-[11px] font-semibold tracking-[0.22em] text-[color:var(--accent)] uppercase">
              {panel}
            </h2>
            <button
              type="button"
              onClick={() => setPanel(null)}
              className="text-sm text-[color:var(--muted)]"
            >
              ✕
            </button>
          </div>
          {panel === "news" && (
            <div className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
              <p>Hub MVP news feed (Realtime posts when env is live).</p>
              {posts.length === 0 ? (
                <p>No posts yet.</p>
              ) : (
                posts.map((p) => (
                  <article
                    key={p.id}
                    className="rounded-lg border border-white/5 p-2 text-[color:var(--fg)]"
                  >
                    {p.body}
                  </article>
                ))
              )}
            </div>
          )}
          {panel === "profile" && (
            <p className="mt-3 text-sm text-[color:var(--muted)]">
              {signedIn
                ? `Signed in as ${displayName}. Roles / YOU sheet port later.`
                : "Guest profile. Login top-right."}
            </p>
          )}
          {panel === "plots" && (
            <ul className="mt-3 space-y-2 text-sm">
              {plots.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-[color:var(--glow-line)] px-3 py-2 text-left text-[color:var(--fg)] hover:bg-white/5"
                    onClick={() => {
                      setActivePlot(p);
                      setPanel(null);
                    }}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {panel === "settings" && (
            <div className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
              <p>
                Supabase project {sbHint.name} · ref {sbHint.ref} ·{" "}
                {sbHint.region}
              </p>
              <p>
                URL {sbHint.urlConfigured ? "set" : "missing"} · anon{" "}
                {sbHint.anonConfigured ? "set" : "missing"}
              </p>
              <p>
                Production shell at `/` remains the live stamp until cutover.
                This MVP lives under `web/`.
              </p>
            </div>
          )}
          {panel === "help" && (
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-[color:var(--muted)]">
              <p>Scroll / pinch the globe: galaxy → national → city → plot.</p>
              <p>Click a cyan plot polygon to open ArchitectCanvas.</p>
              <p>
                Out of scope: full CAD polish, IGM collage, production ledger,
                live Hellenic Cadastre WMS.
              </p>
            </div>
          )}
        </section>
      )}

      {toast && (
        <div className="pointer-events-auto absolute top-24 right-3 left-3 z-50 mx-auto max-w-md rounded-xl border border-[color:var(--glow-line)] bg-[color:var(--panel)]/95 px-3 py-2 text-sm text-[color:var(--fg)] sm:left-auto">
          <button type="button" className="w-full text-left" onClick={() => setToast(null)}>
            {toast}
          </button>
        </div>
      )}

      {activePlot && (
        <ArchitectCanvas
          plot={activePlot}
          onClose={() => setActivePlot(null)}
          onFlyTo={(lat, lon) =>
            setFlyTarget({ lat, lon, height: 1200, nonce: Date.now() })
          }
          onLayer={onLayer}
        />
      )}
    </main>
  );
}

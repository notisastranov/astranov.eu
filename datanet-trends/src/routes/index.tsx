import { useEffect } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { DataNetApp } from "@/components/datanet-app";
import { GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getBoard } from "@/lib/datanet/fns";
import type { Board } from "@/lib/datanet/types";

const guestBoard: Board = {
  shop: null,
  rows: [],
  shops: [],
  signedIn: false,
  role: "guest",
  canEdit: false,
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    shop: typeof search.shop === "string" && search.shop ? search.shop : "eirini",
  }),
  loaderDeps: ({ search }) => ({ shop: search.shop }),
  loader: async ({ deps }) => {
    try {
      return await getBoard({ data: { slug: deps.shop } });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") return guestBoard;
      throw error;
    }
  },
  component: Home,
});

function Home() {
  const board = Route.useLoaderData();
  const router = useRouter();
  const { user, isPending } = useCurrentUserState();

  useEffect(() => {
    if (user && !board.signedIn) void router.invalidate();
  }, [user, board.signedIn, router]);

  if (board.signedIn) return <DataNetApp board={board} />;

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-6 text-ink">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="font-display text-3xl">DataNet</h1>
        <p className="text-sm leading-relaxed text-muted">
          Sign in to open a menu. Eirini stays on the owner's Google account. Rodos Island Trends is the shared sheet any member can copy.
        </p>
        <div suppressHydrationWarning>
          {isPending ? (
            <div className="h-11 animate-pulse rounded-lg bg-brass-soft" />
          ) : user ? (
            <p className="text-sm">Opening your menus…</p>
          ) : (
            GROK_PROVIDERS.map((provider) => (
              <button
                key={provider.providerId}
                type="button"
                onClick={() => signIn(provider.providerId, { callbackURL: "/" })}
                className="mb-2 h-11 w-full cursor-pointer rounded-lg bg-brass text-sm text-sheet"
              >
                Continue with {provider.label}
              </button>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

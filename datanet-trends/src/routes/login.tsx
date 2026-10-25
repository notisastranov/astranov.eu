import { createFileRoute } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-6 text-ink">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="font-display text-3xl">DataNet</h1>
        <p className="text-sm text-muted">Sign in to open a menu. Eirini stays on the owner's account. Rodos Island Trends is the shared starting point.</p>
        {authEnabled ? (
          GROK_PROVIDERS.map((provider) => (
            <button
              key={provider.providerId}
              type="button"
              onClick={() => signIn(provider.providerId, { callbackURL: "/" })}
              className="h-11 w-full cursor-pointer rounded-lg bg-brass text-sm text-sheet"
            >
              Continue with {provider.label}
            </button>
          ))
        ) : (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        )}
      </div>
    </main>
  );
}

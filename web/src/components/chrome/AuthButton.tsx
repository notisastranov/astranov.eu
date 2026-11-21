"use client";

interface AuthButtonProps {
  signedIn: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function AuthButton({
  signedIn,
  displayName,
  avatarUrl,
  onSignIn,
  onSignOut,
}: AuthButtonProps) {
  if (!signedIn) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="pointer-events-auto absolute top-3 right-3 z-40 h-11 rounded-xl border border-[color:var(--glow-line)] bg-[color:var(--panel)]/95 px-4 text-sm font-bold tracking-[0.14em] text-[color:var(--accent)] uppercase shadow-[0_0_18px_rgba(77,240,255,0.2)]"
      >
        Login
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSignOut}
      title={displayName ? `Sign out ${displayName}` : "Sign out"}
      className="pointer-events-auto absolute top-3 right-3 z-40 flex h-11 items-center gap-2 rounded-xl border border-[color:var(--glow-line)] bg-[color:var(--panel)]/95 pr-3 pl-1.5 text-sm text-[color:var(--fg)] shadow-[0_0_18px_rgba(77,240,255,0.2)]"
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="h-8 w-8 rounded-lg object-cover"
        />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--accent)]/20 font-bold text-[color:var(--accent)]">
          {(displayName ?? "Y").slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="max-w-[7rem] truncate font-semibold">
        {displayName ?? "You"}
      </span>
    </button>
  );
}

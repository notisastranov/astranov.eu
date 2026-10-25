export function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

/**
 * Workspace preview vs deployed app. The deployer writes GROK_PROJECT_ID on
 * every publish; the sandbox preview never has it. Single source of truth for
 * the split — gate audience, gate endpoints and connector-token semantics all
 * key off this predicate.
 */
export function isWorkspacePreview(): boolean {
  // A public Vercel production deploy has no sandbox gate. Never treat it as
  // the owner preview, even before GROK_PROJECT_ID is injected.
  if (env("VERCEL_ENV") === "production") return false;
  return !env("GROK_PROJECT_ID");
}

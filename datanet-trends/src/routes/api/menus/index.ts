import { createFileRoute } from "@tanstack/react-router";
import { accessFor } from "@/lib/datanet/access.server";
import { listMenuIndex } from "@/lib/datanet/store.server";
import { getSessionUser } from "@/lib/auth/verify.server";

export const Route = createFileRoute("/api/menus/")({
  server: {
    handlers: {
      GET: async () => {
        const user = await getSessionUser();
        if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
        const access = await accessFor(user.id);
        return Response.json(await listMenuIndex(access), { headers: { "cache-control": "private, no-store" } });
      },
    },
  },
});

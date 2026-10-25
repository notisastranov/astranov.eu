import { createFileRoute } from "@tanstack/react-router";
import { accessFor } from "@/lib/datanet/access.server";
import { readMenuPayload } from "@/lib/datanet/store.server";
import { getSessionUser } from "@/lib/auth/verify.server";

export const Route = createFileRoute("/api/menus/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const user = await getSessionUser();
        if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
        const access = await accessFor(user.id);
        const payload = await readMenuPayload(params.slug, access);
        if (!payload) return Response.json({ error: "Menu not found" }, { status: 404 });
        return Response.json(payload, { headers: { "cache-control": "private, no-store" } });
      },
    },
  },
});

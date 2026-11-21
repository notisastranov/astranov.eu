/**
 * Supabase Realtime / WS stubs for presence, posts, and credits.
 * When env is missing, returns local stub channels that no-op.
 */

import type { CreditTransaction, PresencePeer, UserPost } from "@/lib/types";
import { getSupabase, hasSupabaseEnv } from "./client";

export type RealtimeTopic = "presence" | "posts" | "credits";

export interface RealtimeHandle {
  topic: RealtimeTopic;
  mode: "supabase" | "stub";
  unsubscribe: () => void;
}

export function subscribePresence(
  onPeer: (peer: PresencePeer) => void,
): RealtimeHandle {
  if (!hasSupabaseEnv()) {
    // Stub: emit a single ghost peer so UI can render presence chrome.
    const t = window.setTimeout(() => {
      onPeer({
        userId: "stub-guest",
        displayName: "Guest stub",
        lat: 36.434,
        lon: 28.217,
        level: "global",
        updatedAt: new Date().toISOString(),
      });
    }, 400);
    return {
      topic: "presence",
      mode: "stub",
      unsubscribe: () => window.clearTimeout(t),
    };
  }

  const sb = getSupabase()!;
  const channel = sb
    .channel("hub-presence")
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      for (const key of Object.keys(state)) {
        const rows = (state[key] ?? []) as unknown[];
        for (const row of rows) {
          const peer = row as Partial<PresencePeer> & { presence_ref?: string };
          if (
            peer.userId &&
            peer.displayName &&
            typeof peer.lat === "number" &&
            typeof peer.lon === "number"
          ) {
            onPeer({
              userId: peer.userId,
              displayName: peer.displayName,
              lat: peer.lat,
              lon: peer.lon,
              level: peer.level ?? "global",
              updatedAt: peer.updatedAt ?? new Date().toISOString(),
            });
          }
        }
      }
    })
    .subscribe();

  return {
    topic: "presence",
    mode: "supabase",
    unsubscribe: () => {
      void sb.removeChannel(channel);
    },
  };
}

export function subscribePosts(onPost: (post: UserPost) => void): RealtimeHandle {
  if (!hasSupabaseEnv()) {
    return {
      topic: "posts",
      mode: "stub",
      unsubscribe: () => {},
    };
  }
  const sb = getSupabase()!;
  const channel = sb
    .channel("hub-posts")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "posts" },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        onPost({
          id: String(row.id ?? ""),
          authorId: String(row.author_id ?? row.user_id ?? ""),
          body: String(row.body ?? ""),
          plotId: row.plot_id ? String(row.plot_id) : null,
          lat: typeof row.lat === "number" ? row.lat : null,
          lon: typeof row.lon === "number" ? row.lon : null,
          createdAt: String(row.created_at ?? new Date().toISOString()),
        });
      },
    )
    .subscribe();

  return {
    topic: "posts",
    mode: "supabase",
    unsubscribe: () => {
      void sb.removeChannel(channel);
    },
  };
}

export function subscribeCredits(
  onTx: (tx: CreditTransaction) => void,
): RealtimeHandle {
  if (!hasSupabaseEnv()) {
    return {
      topic: "credits",
      mode: "stub",
      unsubscribe: () => {},
    };
  }
  const sb = getSupabase()!;
  const channel = sb
    .channel("hub-credits")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "credit_transactions" },
      (payload) => {
        const row = (payload.new ?? {}) as Record<string, unknown>;
        if (!row.id) return;
        onTx({
          id: String(row.id),
          userId: String(row.user_id ?? ""),
          amountAve: Number(row.amount_ave ?? row.amount ?? 0),
          kind: (row.kind as CreditTransaction["kind"]) ?? "adjust",
          memo: String(row.memo ?? ""),
          balanceAfter:
            row.balance_after == null ? null : Number(row.balance_after),
          createdAt: String(row.created_at ?? new Date().toISOString()),
        });
      },
    )
    .subscribe();

  return {
    topic: "credits",
    mode: "supabase",
    unsubscribe: () => {
      void sb.removeChannel(channel);
    },
  };
}

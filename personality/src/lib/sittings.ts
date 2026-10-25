import { createServerFn } from "@tanstack/react-start";
import { editionOf, score, type EditionId, type Mark } from "@/lib/inventory";

export type SittingPhase = "cover" | "book" | "profile" | "crib";

export type Sitting = {
  id: string;
  edition: EditionId;
  phase: SittingPhase;
  item_index: number;
  answers: Record<string, Mark>;
  profile: { clash: number; blank: number; answered: number } | null;
  created_at: string;
  updated_at: string;
};

const PHASES = new Set<SittingPhase>(["cover", "book", "profile", "crib"]);

function envPair(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function cleanAnswers(raw: unknown): Record<string, Mark> {
  if (!raw || typeof raw !== "object") return {};
  const answers: Record<string, Mark> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(key);
    if (!Number.isInteger(id) || id < 1 || id > 567) continue;
    if (value === "T" || value === "F" || value === "?") answers[String(id)] = value;
  }
  return answers;
}

export const listSittings = createServerFn({ method: "GET" }).handler(
  async (): Promise<Sitting[]> => {
    const env = envPair();
    if (!env) return [];
    const response = await fetch(
      `${env.url}/rest/v1/personality_sittings?select=id,edition,phase,item_index,answers,profile,created_at,updated_at&order=updated_at.desc&limit=24`,
      {
        headers: {
          apikey: env.key,
          Authorization: `Bearer ${env.key}`,
        },
      },
    );
    if (!response.ok) return [];
    const rows = (await response.json()) as Sitting[];
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => ({ ...row, edition: editionOf(row.edition) }));
  },
);

export const saveSitting = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Missing sitting");
    const raw = input as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error("Bad sitting id");
    }
    const phase = raw.phase;
    if (typeof phase !== "string" || !PHASES.has(phase as SittingPhase)) {
      throw new Error("Bad phase");
    }
    const edition = editionOf(raw.edition);
    const index = typeof raw.index === "number" ? Math.floor(raw.index) : 0;
    if (index < 0 || index > 566) throw new Error("Bad index");
    return {
      id,
      edition,
      phase: phase as SittingPhase,
      index,
      answers: cleanAnswers(raw.answers),
    };
  })
  .handler(async ({ data }) => {
    const env = envPair();
    if (!env) return { kept: false as const };
    const profile = score(
      Object.fromEntries(
        Object.entries(data.answers).map(([key, mark]) => [Number(key), mark]),
      ),
      data.edition,
    );
    const response = await fetch(
      `${env.url}/rest/v1/personality_sittings?on_conflict=id`,
      {
        method: "POST",
        headers: {
          apikey: env.key,
          Authorization: `Bearer ${env.key}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          id: data.id,
          edition: data.edition,
          phase: data.phase,
          item_index: data.index,
          answers: data.answers,
          profile: {
            clash: profile.clash,
            blank: profile.blank,
            answered: profile.trueCount + profile.falseCount,
          },
          updated_at: new Date().toISOString(),
        }),
      },
    );
    if (!response.ok) return { kept: false as const };
    return { kept: true as const };
  });

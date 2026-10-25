import { NextRequest } from "next/server";
import { z } from "zod";
import { getAnthropic, MODEL } from "@/lib/ai/client";
import { TUNE_SYSTEM } from "@/lib/ai/prompts";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const TuneRequestSchema = z.object({
  engine: z.object({
    platform: z.string().optional(),
    displacement: z.string().optional(),
    induction: z.enum(["NA", "turbo", "supercharger"]).optional(),
    fuel: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
  currentMap: z.object({
    kind: z.enum(["VE", "AFR_target", "ignition_advance"]),
    rpmAxis: z.array(z.number()),
    loadAxis: z.array(z.number()),
    cells: z.array(z.array(z.number())),
  }).optional(),
  datalog: z.object({
    headers: z.array(z.string()),
    rows: z.array(z.array(z.number())).max(20000),
    sampleHz: z.number().optional(),
  }),
  question: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body;
  try {
    body = TuneRequestSchema.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: "Invalid tune request", details: (err as Error).message },
      { status: 400 },
    );
  }

  const summary = summarizeDatalog(body.datalog);
  const userPayload = {
    engine: body.engine,
    currentMap: body.currentMap,
    datalogSummary: summary,
    question: body.question ?? "Analyze and propose changes.",
  };

  const client = getAnthropic();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: TUNE_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Datalog summary plus current map. Apply your tune analysis.\n\n```json\n" +
              JSON.stringify(userPayload, null, 2) +
              "\n```",
          },
        ],
      },
    ],
  });

  const encoder = new TextEncoder();
  const sse = new ReadableStream({
    async start(controller) {
      try {
        stream.on("text", (delta) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "text", text: delta })}\n\n`),
          );
        });
        const final = await stream.finalMessage();
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done", usage: final.usage })}\n\n`),
        );
        controller.close();
      } catch (err) {
        const message =
          err instanceof Anthropic.APIError
            ? `API ${err.status}: ${err.message}`
            : String(err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`),
        );
        controller.close();
      }
    },
  });

  return new Response(sse, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/**
 * Reduce a long datalog to bucketed summary stats so we don't push 100K+
 * tokens at the model. We bucket by RPM × load and emit per-bucket counts +
 * min/mean/max for every numeric column.
 */
function summarizeDatalog(log: { headers: string[]; rows: number[][]; sampleHz?: number }) {
  const rpmIdx = log.headers.findIndex((h) => /^rpm$/i.test(h));
  const loadIdx = log.headers.findIndex((h) => /^(map|load|tps)$/i.test(h));
  const rpmBuckets = [0, 1500, 2500, 3500, 4500, 5500, 6500, 7500, 9000];
  const loadBuckets = [0, 25, 50, 75, 100, 125, 150, 200];
  const stats: Record<string, {
    count: number;
    perCol: Record<string, { min: number; mean: number; max: number }>;
  }> = {};

  function bucket(value: number, edges: number[]) {
    for (let i = 0; i < edges.length - 1; i++) {
      if (value >= edges[i] && value < edges[i + 1]) return `${edges[i]}-${edges[i + 1]}`;
    }
    return `>=${edges[edges.length - 1]}`;
  }

  for (const row of log.rows) {
    const rpm = rpmIdx >= 0 ? row[rpmIdx] : 0;
    const load = loadIdx >= 0 ? row[loadIdx] : 0;
    const key = `${bucket(rpm, rpmBuckets)} rpm × ${bucket(load, loadBuckets)} load`;
    const cell = stats[key] ??= { count: 0, perCol: {} };
    cell.count++;
    for (let c = 0; c < log.headers.length; c++) {
      const name = log.headers[c];
      const v = row[c];
      if (typeof v !== "number" || Number.isNaN(v)) continue;
      const s = cell.perCol[name] ??= { min: v, mean: 0, max: v };
      s.min = Math.min(s.min, v);
      s.max = Math.max(s.max, v);
      s.mean = s.mean + (v - s.mean) / cell.count;
    }
  }

  return {
    durationSec: log.sampleHz ? log.rows.length / log.sampleHz : undefined,
    rowCount: log.rows.length,
    headers: log.headers,
    buckets: stats,
  };
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAnthropic, MODEL } from "@/lib/ai/client";
import { DIAGNOSE_SYSTEM } from "@/lib/ai/prompts";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const SnapshotSchema = z.object({
  vehicle: z.object({
    vin: z.string().optional(),
    make: z.string().optional(),
    model: z.string().optional(),
    year: z.number().int().optional(),
    engine: z.string().optional(),
  }).optional(),
  dtcs: z.array(z.object({
    code: z.string(),
    description: z.string().nullable().optional(),
    pending: z.boolean().optional(),
  })),
  livePids: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  freezeFrame: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let payload;
  try {
    payload = SnapshotSchema.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: "Invalid snapshot", details: (err as Error).message },
      { status: 400 },
    );
  }

  const client = getAnthropic();

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: DIAGNOSE_SYSTEM,
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
              "Here is the diagnostic snapshot. Produce the triage, " +
              "explanations, plan, and any safety flags.\n\n```json\n" +
              JSON.stringify(payload, null, 2) +
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
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text: delta })}\n\n`));
        });
        const final = await stream.finalMessage();
        const usage = final.usage;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done", usage })}\n\n`),
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

/**
 * Anthropic client singleton. All AI calls flow through this so we can swap
 * the model or auth source in one place. Server-side only — the API key must
 * never reach the browser.
 */

import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set — see .env.example");
  }
  cached = new Anthropic({ apiKey });
  return cached;
}

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";

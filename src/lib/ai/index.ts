import type { AIProvider } from "./provider";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";

const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-5-mini",
  anthropic: "claude-opus-4-8",
};

export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

export function currentAiModelName(): string {
  const providerName = (process.env.AI_PROVIDER || "openai").toLowerCase();
  return process.env.AI_MODEL || DEFAULT_MODELS[providerName] || DEFAULT_MODELS.openai;
}

/**
 * Selects the provider from AI_PROVIDER/AI_API_KEY/AI_MODEL. AI_MODEL must
 * match whichever provider is selected (e.g. "gpt-5-mini" for openai,
 * "claude-opus-4-8" for anthropic) — see .env.example.
 */
export function getAiProvider(): AIProvider {
  const providerName = (process.env.AI_PROVIDER || "openai").toLowerCase();
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error("AI_API_KEY is not set.");
  const model = currentAiModelName();

  switch (providerName) {
    case "anthropic":
      return new AnthropicProvider(apiKey, model);
    case "openai":
    default:
      return new OpenAIProvider(apiKey, model);
  }
}

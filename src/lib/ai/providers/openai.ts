import OpenAI from "openai";
import {
  aiAnalysisResultSchema,
  buildPrompt,
  buildMarketingPrompt,
  buildInsightPrompt,
  buildSearchPrompt,
  ANALYSIS_JSON_SCHEMA,
  SEARCH_JSON_SCHEMA,
  type AIProvider,
  type AnalyseInput,
  type AIAnalysisResult,
  type MarketingCopyInput,
  type BusinessInsightInput,
  type SearchParseInput,
} from "../provider";

// GPT-5 (and other reasoning-tuned OpenAI models, e.g. the o-series) only
// accept the default temperature (1) via the Chat Completions API and
// error on any other value — omit it there, same reasoning as the
// Anthropic provider's Opus note. Older models like gpt-4o keep the
// explicit temperature per call below.
const REASONING_MODEL_PREFIX = /^(gpt-5|o1|o3|o4)/i;

function temperatureFor(model: string, value: number): { temperature?: number } {
  return REASONING_MODEL_PREFIX.test(model) ? {} : { temperature: value };
}

export class OpenAIProvider implements AIProvider {
  constructor(private apiKey: string, private model: string) {}

  async analyseEnquiryImages(input: AnalyseInput): Promise<AIAnalysisResult> {
    const client = new OpenAI({ apiKey: this.apiKey });
    const { system, user } = buildPrompt(input);

    // detail: "low" caps each image at a small, fixed token cost instead of
    // OpenAI's resolution-based tiling — the enquiry-photo analysis below is
    // always a draft a staff member reviews (never a binding quote), so the
    // cost saving is worth the lower resolution.
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: "text", text: user },
      ...input.images.map((img) => ({ type: "image_url" as const, image_url: { url: img.url, detail: "low" as const } })),
    ];

    const response = await client.chat.completions.create({
      model: this.model,
      ...temperatureFor(this.model, 0.2),
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "record_analysis",
            description: "Record the structured silicone-job analysis.",
            parameters: ANALYSIS_JSON_SCHEMA,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "record_analysis" } },
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") {
      throw new Error("OpenAI did not return the expected tool call.");
    }

    const raw = JSON.parse(toolCall.function.arguments);
    return aiAnalysisResultSchema.parse(raw);
  }

  async generateMarketingCopy(input: MarketingCopyInput): Promise<string> {
    const client = new OpenAI({ apiKey: this.apiKey });
    const { system, user } = buildMarketingPrompt(input);

    const response = await client.chat.completions.create({
      model: this.model,
      ...temperatureFor(this.model, 0.7),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) throw new Error("OpenAI did not return any copy.");
    return text;
  }

  async generateBusinessInsight(input: BusinessInsightInput): Promise<string> {
    const client = new OpenAI({ apiKey: this.apiKey });
    const { system, user } = buildInsightPrompt(input);

    const response = await client.chat.completions.create({
      model: this.model,
      ...temperatureFor(this.model, 0.4),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) throw new Error("OpenAI did not return a report.");
    return text;
  }

  async parseSearchQuery(input: SearchParseInput): Promise<Record<string, unknown>> {
    const client = new OpenAI({ apiKey: this.apiKey });
    const { system, user } = buildSearchPrompt(input);

    const response = await client.chat.completions.create({
      model: this.model,
      ...temperatureFor(this.model, 0.1),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "record_search",
            description: "Record the structured search filter.",
            parameters: SEARCH_JSON_SCHEMA,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "record_search" } },
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") {
      throw new Error("OpenAI did not return the expected tool call.");
    }
    return JSON.parse(toolCall.function.arguments);
  }
}

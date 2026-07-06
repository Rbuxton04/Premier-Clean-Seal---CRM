import Anthropic from "@anthropic-ai/sdk";
import {
  aiAnalysisResultSchema,
  buildPrompt,
  buildMarketingPrompt,
  buildInsightPrompt,
  ANALYSIS_JSON_SCHEMA,
  type AIProvider,
  type AnalyseInput,
  type AIAnalysisResult,
  type MarketingCopyInput,
  type BusinessInsightInput,
} from "../provider";

export class AnthropicProvider implements AIProvider {
  constructor(private apiKey: string, private model: string) {}

  async analyseEnquiryImages(input: AnalyseInput): Promise<AIAnalysisResult> {
    const client = new Anthropic({ apiKey: this.apiKey });
    const { system, user } = buildPrompt(input);

    // No `temperature` — current Opus models (the default here) reject
    // non-default sampling params outright; the forced tool_choice plus the
    // downstream zod parse is what keeps output disciplined instead.
    const response = await client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system,
      messages: [
        {
          role: "user",
          content: [
            ...input.images.map((img) => ({ type: "image" as const, source: { type: "url" as const, url: img.url } })),
            { type: "text" as const, text: user },
          ],
        },
      ],
      tools: [
        {
          name: "record_analysis",
          description: "Record the structured silicone-job analysis.",
          input_schema: ANALYSIS_JSON_SCHEMA as unknown as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "record_analysis" },
    });

    const toolUse = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
    if (!toolUse) {
      throw new Error("Claude did not return the expected tool call.");
    }

    return aiAnalysisResultSchema.parse(toolUse.input);
  }

  async generateMarketingCopy(input: MarketingCopyInput): Promise<string> {
    const client = new Anthropic({ apiKey: this.apiKey });
    const { system, user } = buildMarketingPrompt(input);

    // No `temperature` — current Opus models reject non-default sampling params.
    const response = await client.messages.create({
      model: this.model,
      max_tokens: 600,
      system,
      messages: [{ role: "user", content: user }],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) throw new Error("Claude did not return any copy.");
    return textBlock.text.trim();
  }

  async generateBusinessInsight(input: BusinessInsightInput): Promise<string> {
    const client = new Anthropic({ apiKey: this.apiKey });
    const { system, user } = buildInsightPrompt(input);

    // No `temperature` — current Opus models reject non-default sampling params.
    const response = await client.messages.create({
      model: this.model,
      max_tokens: 700,
      system,
      messages: [{ role: "user", content: user }],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) throw new Error("Claude did not return a report.");
    return textBlock.text.trim();
  }
}

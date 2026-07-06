import OpenAI from "openai";
import {
  aiAnalysisResultSchema,
  buildPrompt,
  buildMarketingPrompt,
  ANALYSIS_JSON_SCHEMA,
  type AIProvider,
  type AnalyseInput,
  type AIAnalysisResult,
  type MarketingCopyInput,
} from "../provider";

export class OpenAIProvider implements AIProvider {
  constructor(private apiKey: string, private model: string) {}

  async analyseEnquiryImages(input: AnalyseInput): Promise<AIAnalysisResult> {
    const client = new OpenAI({ apiKey: this.apiKey });
    const { system, user } = buildPrompt(input);

    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: "text", text: user },
      ...input.images.map((img) => ({ type: "image_url" as const, image_url: { url: img.url } })),
    ];

    const response = await client.chat.completions.create({
      model: this.model,
      temperature: 0.2,
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
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) throw new Error("OpenAI did not return any copy.");
    return text;
  }
}

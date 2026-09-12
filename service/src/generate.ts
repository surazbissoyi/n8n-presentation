import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GenerateRequest, PresentationOutline } from "./types";

// ponytail: lazy clients — only created when first called, avoids module-load crash.
let anthropicClient: Anthropic | null = null;
let openrouterClient: OpenAI | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
    anthropicClient = new Anthropic({ apiKey: key });
  }
  return anthropicClient;
}

function getOpenRouter(): OpenAI {
  if (!openrouterClient) {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY is not set");
    openrouterClient = new OpenAI({
      apiKey: key,
      baseURL: "https://openrouter.ai/api/v1",
    });
  }
  return openrouterClient;
}

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "google/gemini-3.7-flash";

const OUTLINE_TOOL = {
  name: "build_outline",
  description: "Return a structured slide-by-slide outline for a presentation.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string", description: "Overall presentation title" },
      slides: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            bullets: {
              type: "array",
              items: { type: "string" },
              description: "3-5 short bullet points, no sub-bullets",
            },
            speakerNotes: { type: "string" },
          },
          required: ["title", "bullets"],
        },
      },
    },
    required: ["title", "slides"],
  },
};

const OUTLINE_JSON_SCHEMA = {
  name: "outline",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Overall presentation title" },
      slides: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            bullets: {
              type: "array",
              items: { type: "string" },
              description: "3-5 short bullet points, no sub-bullets",
            },
            speakerNotes: { type: "string" },
          },
          required: ["title", "bullets"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "slides"],
    additionalProperties: false,
  },
} as const;

function buildPrompt(req: GenerateRequest): string {
  const nSlides = req.n_slides ?? 8;
  const tone = req.tone ?? "default";
  const language = req.language ?? "English";

  return [
    `Create a presentation outline in ${language} with exactly ${nSlides} slides.`,
    `Tone: ${tone}.`,
    req.instructions ? `Additional instructions: ${req.instructions}` : "",
    `Source content / topic:\n${req.content}`,
    `Each slide needs a concise title and 3-5 short bullet points. Bullets must be 1-2 short phrases max, like real slide content — not sentences or paragraphs. Think visually: each bullet should fit on one line.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function generateWithAnthropic(prompt: string): Promise<PresentationOutline> {
  const client = getAnthropic();
  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    tools: [OUTLINE_TOOL],
    tool_choice: { type: "tool", name: "build_outline" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return a structured outline");
  }

  return toolUse.input as PresentationOutline;
}

const OUTLINE_FN = {
  name: "build_outline",
  description: "Return a structured slide-by-slide outline for a presentation.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Overall presentation title" },
      slides: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            bullets: {
              type: "array",
              items: { type: "string" },
              description: "3-5 short bullet points, no sub-bullets",
            },
            speakerNotes: { type: "string" },
          },
          required: ["title", "bullets"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "slides"],
    additionalProperties: false,
  },
};

function extractOutline(data: string): PresentationOutline {
  // Try parsing raw JSON (some models just return the JSON directly).
  const parsed = JSON.parse(data);
  if (parsed.title && Array.isArray(parsed.slides)) {
    return parsed as PresentationOutline;
  }
  throw new Error("Parsed JSON does not match outline schema");
}

async function generateWithOpenRouter(prompt: string): Promise<PresentationOutline> {
  const client = getOpenRouter();
  console.log(`[openrouter] model=${OPENROUTER_MODEL}`);

  const jsonPrompt = `${prompt}\n\nReturn ONLY a JSON object with this exact structure, no markdown, no explanation:\n{"title":"...","slides":[{"title":"...","bullets":["...","...","..."],"speakerNotes":"..."}]}`;

  const completion = await client.chat.completions.create({
    model: OPENROUTER_MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: jsonPrompt }],
  });

  const msg = completion.choices?.[0]?.message;
  console.log("[openrouter] finish_reason:", completion.choices?.[0]?.finish_reason);
  console.log("[openrouter] full message:", JSON.stringify(msg).slice(0, 500));

  const content = msg?.content;
  if (content) {
    console.log("[openrouter] content:", content.slice(0, 300));
    try {
      return extractOutline(content);
    } catch {
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        return extractOutline(match[1]);
      }
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return extractOutline(jsonMatch[0]);
      }
    }
  }

  throw new Error("Model did not return a structured outline");
}

export async function generateOutline(req: GenerateRequest): Promise<PresentationOutline> {
  const provider = process.env.LLM_PROVIDER ?? "anthropic";
  console.log(`[generate] provider=${provider}`);
  const prompt = buildPrompt(req);
  return provider === "anthropic" ? generateWithAnthropic(prompt) : generateWithOpenRouter(prompt);
}

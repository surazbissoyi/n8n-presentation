import Anthropic from "@anthropic-ai/sdk";
import { GenerateRequest, PresentationOutline } from "./types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// We force the model to call a single tool so the response is guaranteed
// to be well-formed JSON matching PresentationOutline, rather than parsing
// free text (which is what breaks most "LLM -> slides" pipelines in practice).
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

export async function generateOutline(req: GenerateRequest): Promise<PresentationOutline> {
  const nSlides = req.n_slides ?? 8;
  const tone = req.tone ?? "default";
  const language = req.language ?? "English";

  const prompt = [
    `Create a presentation outline in ${language} with exactly ${nSlides} slides.`,
    `Tone: ${tone}.`,
    req.instructions ? `Additional instructions: ${req.instructions}` : "",
    `Source content / topic:\n${req.content}`,
    `Each slide needs a concise title and 3-5 short bullet points suitable for a slide (not paragraphs).`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const message = await anthropic.messages.create({
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

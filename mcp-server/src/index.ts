import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Same core service used by the n8n workflow and the frontend.
// This is the whole point of the shared-core design: the MCP server
// doesn't reimplement LLM-calling or PPTX rendering, it just calls out.
const SERVICE_URL = process.env.SERVICE_URL ?? "http://localhost:4000";

const server = new McpServer({
  name: "presenton-clone",
  version: "1.0.0",
});

server.registerTool(
  "generate_presentation",
  {
    title: "Generate presentation",
    description:
      "Generate a downloadable PPTX presentation from content or a topic. " +
      "Provide the source content/topic, optional style instructions, desired slide count, and tone.",
    inputSchema: {
      content: z.string().describe("The main content or topic to build the presentation from"),
      instructions: z.string().optional().describe("Extra guidance, e.g. audience, focus areas"),
      n_slides: z.number().int().min(3).max(20).optional().describe("Number of slides (default 8)"),
      tone: z
        .enum(["default", "casual", "professional", "funny", "educational", "sales_pitch"])
        .optional(),
    },
  },
  async ({ content, instructions, n_slides, tone }) => {
    const res = await fetch(`${SERVICE_URL}/api/presentations/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, instructions, n_slides, tone }),
    });

    if (!res.ok) {
      const body = await res.text();
      return {
        content: [{ type: "text", text: `Generation failed (${res.status}): ${body}` }],
        isError: true,
      };
    }

    const data = (await res.json()) as {
      presentation_id: string;
      title: string;
      slide_count: number;
      download_url: string;
    };
    const fullUrl = `${SERVICE_URL}${data.download_url}`;

    return {
      content: [
        {
          type: "text",
          text: `Generated "${data.title}" (${data.slide_count} slides). Download: ${fullUrl}`,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("presenton-clone MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error in MCP server:", err);
  process.exit(1);
});

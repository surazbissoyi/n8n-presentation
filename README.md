# Presentation Generator (Presenton, rebuilt)

Reference project: [presenton/presenton](https://github.com/presenton/presenton) — an
open-source AI presentation generator (prompt → LLM outline → PPTX/PDF, with a
built-in MCP server).

## What this is

The core loop in Presenton is: **content → structured slide outline (LLM) → rendered
PPTX**. Everything else in the original repo (multi-provider LLM switching, Mem0
memory, auth, Electron packaging, template system) is product polish on top of that
loop, not the loop itself.

Rather than clone Presenton's FastAPI + Next.js stack line-by-line, this rebuilds the
loop as one small **core service**, and puts two "front doors" on it:

```
                        ┌────────────────────┐
  Frontend  ───POST────▶│                     │
  (Next.js)              │   Core Service      │───▶ Claude API (outline)
                        │   (Express + TS)    │
  n8n workflow ───POST──▶│   /api/presentations │───▶ pptxgenjs (render .pptx)
  (webhook)              │                     │
                        └────────────────────┘
                                  ▲
  MCP server  ─────HTTP──────────┘
  (stdio, for Claude/ChatGPT)
```

- **`service/`** — the actual engine. `POST /api/presentations/generate` calls Claude
  with a forced tool-use call (`build_outline`) so the response is guaranteed
  structured JSON (title + slides + bullets), not free text you have to regex out of a
  markdown blob. That outline is handed to `pptxgenjs`, which renders a real `.pptx`
  file, stored in memory and served from `GET /api/presentations/:id/download`.
- **`frontend/`** — a single-page Next.js app: textarea for content, a few generation
  options, a Generate button, a download link once the service responds.
- **`n8n/presentation-workflow.json`** — importable n8n workflow: Webhook → HTTP
  Request to the core service → format response → Respond to Webhook. This is the
  "recreate the core workflow in n8n" piece — n8n orchestrates the same API the
  frontend calls, it doesn't reimplement outline generation or PPTX rendering itself
  (n8n has no native pptx node, and duplicating the LLM prompt + rendering logic in
  n8n's Code node would mean two places to keep in sync).
- **`mcp-server/`** — an MCP server (stdio transport, so it works with Claude
  Desktop) exposing one tool, `generate_presentation`, which calls the same core
  service and returns a download link.

## Trade-offs / why it's structured this way

- **Shared core instead of three separate implementations.** The alternative — n8n
  doing the LLM call and file assembly itself, and the MCP server doing it again — 
  means the outline schema and rendering logic live in three places. Centralizing
  means one bug fix, one prompt change, applies everywhere.
- **Forced tool-use for the outline** instead of asking the model for markdown and
  parsing it. More reliable, no regex-based slide splitting.
- **In-memory file store.** Fine for a demo/assessment; a real deployment would push
  the rendered file to S3/GCS and store `{id, url, title}` in Postgres instead of a
  `Map` that resets on restart.
- **PPTX only, not PDF.** Presenton supports both; pptxgenjs's PPTX output is more
  reliable to get right quickly than round-tripping through a PDF renderer, and PPTX
  is the more useful "editable" output for this task's scope.
- **MCP server calls the core over HTTP rather than embedding the generation logic.**
  Keeps the MCP server thin and guarantees it never drifts from what the frontend and
  n8n produce.

## Setup

Requires Node.js 20+, an Anthropic API key, and (for the n8n piece) a local or cloud
n8n instance.

### 1. Core service

```bash
cd service
cp .env.example .env   # add your ANTHROPIC_API_KEY
npm install
npm run dev             # http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env    # NEXT_PUBLIC_SERVICE_URL, defaults to localhost:4000
npm install
npm run dev              # http://localhost:3000
```

### 3. n8n workflow

1. Run n8n (`npx n8n` or your existing instance) with an environment variable
   `SERVICE_URL=http://localhost:4000` available to it.
2. In n8n: **Workflows → Import from File** → select `n8n/presentation-workflow.json`.
3. Activate the workflow. It listens on `POST /webhook/generate-presentation` with the
   same body shape as the frontend: `{ content, instructions?, n_slides?, tone? }`.

### 4. MCP server

```bash
cd mcp-server
cp .env.example .env    # SERVICE_URL
npm install
npm run build
```

Point Claude Desktop's MCP config at the built server, e.g.:

```json
{
  "mcpServers": {
    "presenton-clone": {
      "command": "node",
      "args": ["/absolute/path/to/presenton-clone/mcp-server/dist/index.js"],
      "env": { "SERVICE_URL": "http://localhost:4000" }
    }
  }
}
```

Then in Claude Desktop: "Generate a presentation about X" will call the
`generate_presentation` tool and return a download link.

## Demo script (for the Loom)

1. Start `service` and `frontend`.
2. Generate one deck from the frontend end-to-end, show the downloaded `.pptx` opening
   in PowerPoint/Keynote.
3. Trigger the same generation via the n8n webhook (curl or Postman) to show the
   workflow producing an identical result through a different front door.
4. Open Claude Desktop with the MCP server configured, ask it to generate a deck, show
   the tool call and resulting download link.

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
  (Next.js)              │   Core Service      │───▶ Anthropic / OpenRouter (outline)
                         │   (Express + TS)    │
  n8n workflow ───POST──▶│   /api/presentations │───▶ pptxgenjs (render .pptx)
  (webhook)              │                     │
                         └────────────────────┘
                                   ▲
  MCP server  ─────HTTP──────────┘
  (stdio, for Claude/ChatGPT/opencode)
```

- **`service/`** — the actual engine. Supports **Anthropic (Claude)** and
  **OpenRouter** (400+ models including free ones) via `LLM_PROVIDER` env var.
  Uses forced tool-use / function calling so the response is guaranteed structured
  JSON (title + slides + bullets). Renders a modern dark-themed `.pptx` with
  `pptxgenjs`.
- **`frontend/`** — a single-page Next.js app: textarea for content, a few generation
  options, a Generate button, a download link once the service responds.
- **`n8n/presentation-workflow.json`** — importable n8n workflow: Webhook → HTTP
  Request to the core service → Respond to Webhook.
- **`mcp-server/`** — an MCP server (stdio transport) exposing one tool,
  `generate_presentation`, which calls the same core service and returns a download
  link. Works with Claude Desktop, opencode, or any MCP client.

## Setup

Requires Node.js 20+ and an API key for either Anthropic or OpenRouter.

### 1. Core service

```bash
cd service
cp .env.example .env
npm install
npm run dev             # http://localhost:4000
```

Configure `.env` for your provider:

**Anthropic (default):**
```
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

**OpenRouter (free models available):**
```
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env    # NEXT_PUBLIC_SERVICE_URL, defaults to localhost:4000
npm install
npm run dev              # http://localhost:3000
```

### 3. n8n workflow

1. Run n8n (`npx n8n` or your existing instance).
2. In n8n: **Workflows → Import from File** → select `n8n/presentation-workflow.json`.
3. Click **Execute Workflow**, then test with:

```powershell
Invoke-RestMethod -Uri "http://localhost:5678/webhook-test/generate-presentation" -Method POST -ContentType "application/json" -Body '{"content":"Your topic here","n_slides":5,"tone":"professional"}'
```

### 4. MCP server

```bash
cd mcp-server
npm install
npm run build
```

**Claude Desktop** — add to your MCP config:
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

**opencode** — add to `~/.config/opencode/opencode.jsonc`:
```json
{
  "mcp": {
    "presenton": {
      "type": "local",
      "command": ["node", "/absolute/path/to/presenton-clone/mcp-server/dist/index.js"],
      "environment": { "SERVICE_URL": "http://localhost:4000" },
      "enabled": true
    }
  }
}
```

Then ask: *"Generate a presentation about X using presenton"*

## Demo script

1. Start `service` and `frontend`.
2. Generate one deck from the frontend end-to-end, show the downloaded `.pptx` opening
   in PowerPoint/Keynote.
3. Trigger the same generation via the n8n webhook.
4. Use the MCP server from opencode or Claude Desktop to generate a deck.

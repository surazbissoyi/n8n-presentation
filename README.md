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
                        ┌──────────────────────┐
  Frontend  ───POST────▶│                       │
  (Next.js)             │    Core Service       │───▶ Gemini / Anthropic / OpenRouter (outline)
                        │    (Express + TS)     │
  n8n workflow ───POST──▶│    /api/presentations │───▶ pptxgenjs (render .pptx)
  (webhook)              │                       │
                        └──────────────────────┘
                                   ▲
  MCP server  ─────HTTP───────────┘
  (stdio, for Claude Desktop / opencode / any MCP client)
```

- **`service/`** — the actual engine. Supports **Gemini**, **Anthropic (Claude)**, and
  **OpenRouter** via a `LLM_PROVIDER` env var. Uses forced tool-use / function calling
  so the response is guaranteed structured JSON (title + slides + bullets), never
  free-text markdown that has to be parsed. Renders a `.pptx` with `pptxgenjs`.
- **`frontend/`** — a single-page Next.js app: textarea for content, a few generation
  options, a Generate button, a download link once the service responds.
- **`n8n/presentation-workflow.json`** — importable n8n workflow: Webhook → HTTP
  Request to the core service → Respond to Webhook.
- **`mcp-server/`** — an MCP server (stdio transport) exposing one tool,
  `generate_presentation`, which calls the same core service and returns a download
  link. Works with Claude Desktop, opencode, or any MCP client.

None of these three front doors call each other — they're independent entry points
onto the same service, not a pipeline.

## Trade-offs

These are the deliberate calls made to keep the rebuild scoped to what the assessment
actually asks for, rather than matching Presenton's full feature surface:

1. **One shared core service instead of duplicating logic in n8n and the MCP server.**
   The alternative was having n8n call the LLM and assemble the file itself (via Code
   nodes), and the MCP server doing the same independently. Centralizing means one
   place to fix bugs or change the prompt, and all three front doors stay in sync
   automatically — at the cost of less logic actually living "inside" n8n, if that's
   something a reviewer is specifically looking for.

2. **Forced tool-use / function calling for the outline, instead of parsing free-text
   markdown.** This makes generation far more reliable — no regex-splitting slides out
   of a markdown blob, which breaks constantly in practice. The trade-off is that it
   ties the service to providers/models with solid function-calling support, which is
   also why swapping LLM providers isn't a one-line config change — the tool-call
   schema differs across Gemini, Anthropic, and OpenAI-compatible APIs.

3. **In-memory file storage instead of persistent storage (S3/Postgres).** Fast to
   build, zero infra to stand up — but every generated file disappears on server
   restart, and there's no way to look up a past presentation. Fine for a demo/
   assessment; the first thing to change for a real deployment.

4. **PPTX export only, not PPTX + PDF.** Presenton supports both. PPTX alone was
   faster to get reliably working, and it's the more useful "editable" output for this
   task's scope — so this intentionally doesn't match that one piece of the original
   feature set.

## Setup

Requires Node.js 20+ and an API key for at least one provider (Gemini, Anthropic, or
OpenRouter).

### 1. Core service

```bash
cd service
cp .env.example .env
npm install
npm run dev             # http://localhost:4000
```

Configure `.env` for whichever provider you're using:

**Gemini (default):**
```
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-3.7-flash
```

**Anthropic:**
```
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

**OpenRouter (400+ models, including free ones):**
```
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=<a current free-tier model slug from openrouter.ai/models>
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
3. **Activate the workflow** (toggle in the top right) — this is required for the live
   `/webhook/...` path to respond; without activating, only the `/webhook-test/...`
   path works, and only while the editor is open with "Execute Workflow" armed.
4. Test it:

   **curl / macOS / Linux:**
   ```bash
   curl -X POST http://localhost:5678/webhook/generate-presentation \
     -H "Content-Type: application/json" \
     -d '{"content":"Your topic here","n_slides":5,"tone":"professional"}'
   ```

   **PowerShell / Windows:**
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:5678/webhook/generate-presentation" -Method POST -ContentType "application/json" -Body '{"content":"Your topic here","n_slides":5,"tone":"professional"}'
   ```

   (Use the `webhook-test` path instead of `webhook` if you're testing from the n8n
   editor with "Execute Workflow" rather than the activated workflow.)

### 4. MCP server

```bash
cd mcp-server
cp .env.example .env    # SERVICE_URL, defaults to localhost:4000
npm install
npm run build
```

**Claude Desktop** — add to your MCP config:
```json
{
  "mcpServers": {
    "presenton-clone": {
      "command": "node",
      "args": ["/absolute/path/to/n8n-presentation/mcp-server/dist/index.js"],
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
      "command": ["node", "/absolute/path/to/n8n-presentation/mcp-server/dist/index.js"],
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
3. Trigger the same generation via the n8n webhook, show the response and the
   resulting file.
4. Use the MCP server from Claude Desktop or opencode to generate a deck, show the
   tool call and resulting download link.

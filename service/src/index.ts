import express from "express";
import cors from "cors";
import { v4 as uuid } from "uuid";
import { generateOutline } from "./generate";
import { renderPptx } from "./pptx";
import { GenerateRequest, GenerateResponse } from "./types";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

// In-memory store for generated files (id -> {buffer, filename}).
// Fine for an assessment/demo; swap for S3/disk + a DB row for production.
const store = new Map<string, { buffer: Buffer; filename: string; title: string; slideCount: number }>();

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/api/presentations/generate", async (req, res) => {
  try {
    const body = req.body as GenerateRequest;
    if (!body.content || typeof body.content !== "string") {
      return res.status(400).json({ error: "content is required" });
    }

    const outline = await generateOutline(body);
    const buffer = await renderPptx(outline);
    const id = uuid();
    const filename = `${outline.title.replace(/[^a-z0-9]+/gi, "_").slice(0, 60) || "presentation"}.pptx`;

    store.set(id, { buffer, filename, title: outline.title, slideCount: outline.slides.length });

    const response: GenerateResponse = {
      presentation_id: id,
      title: outline.title,
      slide_count: outline.slides.length,
      download_url: `/api/presentations/${id}/download`,
    };
    res.json(response);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message ?? "generation failed" });
  }
});

app.get("/api/presentations/:id/download", (req, res) => {
  const item = store.get(req.params.id);
  if (!item) return res.status(404).json({ error: "not found (or server restarted)" });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${item.filename}"`);
  res.send(item.buffer);
});

app.listen(PORT, () => {
  console.log(`presenton-clone core service listening on :${PORT}`);
});

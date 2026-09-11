"use client";

import { useState } from "react";

const SERVICE_URL = process.env.NEXT_PUBLIC_SERVICE_URL ?? "http://localhost:4000";

export default function Home() {
  const [content, setContent] = useState("");
  const [instructions, setInstructions] = useState("");
  const [nSlides, setNSlides] = useState(8);
  const [tone, setTone] = useState("default");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setStatus("loading");
    setError(null);
    setDownloadUrl(null);
    try {
      const res = await fetch(`${SERVICE_URL}/api/presentations/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, instructions, n_slides: nSlides, tone }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed: ${res.status}`);
      }
      const data = await res.json();
      setDownloadUrl(`${SERVICE_URL}${data.download_url}`);
      setStatus("done");
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Presentation Generator</h1>
      <p style={{ color: "#999", marginBottom: 32 }}>
        Enter content or a topic, get back a downloadable .pptx.
      </p>

      <label style={{ display: "block", marginBottom: 6 }}>Content / topic</label>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={6}
        placeholder="e.g. Paste notes, or describe the topic you want slides on..."
        style={{ width: "100%", padding: 12, marginBottom: 16, background: "#1b1e24", color: "#fff", border: "1px solid #333", borderRadius: 8 }}
      />

      <label style={{ display: "block", marginBottom: 6 }}>Instructions (optional)</label>
      <input
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder="e.g. keep it beginner-friendly, focus on trade-offs"
        style={{ width: "100%", padding: 10, marginBottom: 16, background: "#1b1e24", color: "#fff", border: "1px solid #333", borderRadius: 8 }}
      />

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div>
          <label style={{ display: "block", marginBottom: 6 }}>Slides</label>
          <input
            type="number"
            min={3}
            max={20}
            value={nSlides}
            onChange={(e) => setNSlides(Number(e.target.value))}
            style={{ width: 80, padding: 10, background: "#1b1e24", color: "#fff", border: "1px solid #333", borderRadius: 8 }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: 6 }}>Tone</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            style={{ padding: 10, background: "#1b1e24", color: "#fff", border: "1px solid #333", borderRadius: 8 }}
          >
            {["default", "casual", "professional", "funny", "educational", "sales_pitch"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={!content || status === "loading"}
        style={{
          padding: "12px 20px",
          background: status === "loading" ? "#555" : "#5865f2",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: content ? "pointer" : "not-allowed",
        }}
      >
        {status === "loading" ? "Generating..." : "Generate presentation"}
      </button>

      {status === "error" && <p style={{ color: "#ff6b6b", marginTop: 16 }}>{error}</p>}

      {status === "done" && downloadUrl && (
        <p style={{ marginTop: 16 }}>
          Done —{" "}
          <a href={downloadUrl} style={{ color: "#5865f2" }}>
            download your .pptx
          </a>
        </p>
      )}
    </main>
  );
}

import PptxGenJS from "pptxgenjs";
import { PresentationOutline } from "./types";

// Modern minimal palette — swap these to re-theme.
const THEME = {
  bg: "0F0F0F",
  surface: "1A1A2E",
  accent: "4F46E5",
  accentAlt: "7C3AED",
  text: "FFFFFF",
  textMuted: "94A3B8",
  card: "1E293B",
  gradient: { from: "0F0F0F", to: "1E1B4B" },
};

function addAccentBar(slide: PptxGenJS.Slide) {
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: 0.08,
    h: "100%",
    fill: { type: "solid", color: THEME.accent },
  });
}

function addSlideNumber(slide: PptxGenJS.Slide, num: number, total: number) {
  slide.addText(`${num} / ${total}`, {
    x: 8.5,
    y: 5.05,
    w: 1.2,
    h: 0.3,
    fontSize: 9,
    color: THEME.textMuted,
    align: "right",
  });
}

function addBottomLine(slide: PptxGenJS.Slide) {
  slide.addShape("rect", {
    x: 0.5,
    y: 4.9,
    w: 9,
    h: 0.01,
    fill: { type: "solid", color: THEME.card },
  });
}

export async function renderPptx(outline: PresentationOutline): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.author = "Presenton";
  pres.subject = outline.title;

  // ── Title slide ──────────────────────────────────────────
  const title = pres.addSlide();
  title.background = { fill: THEME.bg };

  // Large accent circle (decorative)
  title.addShape("ellipse", {
    x: 6.5,
    y: -1.5,
    w: 5,
    h: 5,
    fill: { type: "solid", color: THEME.accent, transparency: 85 },
  });
  title.addShape("ellipse", {
    x: 7.5,
    y: 2.5,
    w: 4,
    h: 4,
    fill: { type: "solid", color: THEME.accentAlt, transparency: 90 },
  });

  // Left accent bar
  title.addShape("rect", {
    x: 0.8,
    y: 1.8,
    w: 0.06,
    h: 1.8,
    fill: { type: "solid", color: THEME.accent },
  });

  title.addText(outline.title, {
    x: 1.1,
    y: 1.8,
    w: 7,
    h: 1.8,
    fontSize: 40,
    bold: true,
    color: THEME.text,
    fontFace: "Arial",
    valign: "middle",
    wrap: true,
  });

  title.addText(`${outline.slides.length} slides`, {
    x: 1.1,
    y: 3.8,
    w: 3,
    h: 0.4,
    fontSize: 12,
    color: THEME.textMuted,
    fontFace: "Arial",
  });

  // ── Content slides ───────────────────────────────────────
  const total = outline.slides.length;
  outline.slides.forEach((slide, i) => {
    const s = pres.addSlide();
    s.background = { fill: THEME.bg };

    addAccentBar(s);
    addBottomLine(s);
    addSlideNumber(s, i + 1, total);

    // Title
    s.addText(slide.title, {
      x: 0.7,
      y: 0.4,
      w: 8.5,
      h: 0.7,
      fontSize: 24,
      bold: true,
      color: THEME.text,
      fontFace: "Arial",
    });

    // Accent dot before title
    s.addShape("ellipse", {
      x: 0.45,
      y: 0.6,
      w: 0.12,
      h: 0.12,
      fill: { type: "solid", color: THEME.accent },
    });

    // Bullets — card style with dark background
    if (slide.bullets.length > 0) {
      s.addShape("roundRect", {
        x: 0.5,
        y: 1.4,
        w: 9,
        h: 3.3,
        rectRadius: 0.1,
        fill: { type: "solid", color: THEME.card },
      });

      const bullets = slide.bullets.map((b, idx) => {
        const parts: PptxGenJS.TextProps[] = [];

        // Accent bullet marker
        parts.push({
          text: "  ",
          options: {
            fontSize: 18,
            color: THEME.accent,
            fontFace: "Arial",
            bold: true,
          },
        });

        // Bullet text
        parts.push({
          text: b,
          options: {
            fontSize: 16,
            color: THEME.text,
            fontFace: "Arial",
            breakLine: true,
          },
        });

        return parts;
      });

      s.addText(bullets.flat(), {
        x: 0.8,
        y: 1.6,
        w: 8.4,
        h: 3.0,
        valign: "top",
        lineSpacingMultiple: 1.5,
        paraSpaceAfter: 8,
      });
    }

    // Speaker notes
    if (slide.speakerNotes) {
      s.addNotes(slide.speakerNotes);
    }
  });

  const data = await pres.write({ outputType: "nodebuffer" });
  return data as Buffer;
}

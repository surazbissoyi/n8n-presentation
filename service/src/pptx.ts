import PptxGenJS from "pptxgenjs";
import { PresentationOutline } from "./types";

export async function renderPptx(outline: PresentationOutline): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";

  // Title slide
  const titleSlide = pres.addSlide();
  titleSlide.addText(outline.title, {
    x: 0.5,
    y: 2.2,
    w: 9,
    h: 1.5,
    fontSize: 36,
    bold: true,
    align: "center",
  });

  for (const slide of outline.slides) {
    const s = pres.addSlide();
    s.addText(slide.title, {
      x: 0.5,
      y: 0.4,
      w: 9,
      h: 0.9,
      fontSize: 26,
      bold: true,
    });
    s.addText(
      slide.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
      { x: 0.6, y: 1.5, w: 8.8, h: 4.5, fontSize: 18, valign: "top" }
    );
    if (slide.speakerNotes) {
      s.addNotes(slide.speakerNotes);
    }
  }

  const data = await pres.write({ outputType: "nodebuffer" });
  return data as Buffer;
}

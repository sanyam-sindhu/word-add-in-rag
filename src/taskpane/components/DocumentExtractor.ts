/* global Word, Office */

export type Scope = "selection" | "selection-image" | "page" | "full-document";

export interface ExtractedImage {
  base64: string;
  format: string;
  altText: string;
}

export interface DocumentSection {
  heading: string;
  headingLevel: number;
  body: string;
  type: "text" | "table";
}

export interface ExtractedContent {
  text: string;
  sections: DocumentSection[];
  images: ExtractedImage[];
  warnings: string[];
}

const SUPPORTED_IMAGE_FORMATS = ["jpeg", "jpg", "png", "gif", "webp"];
const WORDS_PER_PAGE = 500;

const HEADING_STYLE_MAP: Record<string, number> = {
  "Heading 1": 1, "heading 1": 1,
  "Heading 2": 2, "heading 2": 2,
  "Heading 3": 3, "heading 3": 3,
  "Heading 4": 4, "heading 4": 4,
  "Heading 5": 5, "heading 5": 5,
  "Heading 6": 6, "heading 6": 6,
  "Title": 1,    "title": 1,
  "Subtitle": 2, "subtitle": 2,
};

export async function extractContent(scope: Scope, pageNumber?: number): Promise<ExtractedContent> {
  const warnings: string[] = [];

  return Word.run(async (context) => {
    const images: ExtractedImage[] = [];
    let text = "";
    let sections: DocumentSection[] = [];

    if (scope === "selection") {
      const selection = context.document.getSelection();
      selection.load("text");
      await context.sync();
      text = selection.text.trim();
      if (!text) warnings.push("No text selected. Select text in the document first.");
      sections = text ? [{ heading: "", headingLevel: 0, body: text, type: "text" }] : [];

    } else if (scope === "selection-image") {
      const selection = context.document.getSelection();
      const selectionPics = selection.inlinePictures;
      selectionPics.load("items");
      await context.sync();

      if (selectionPics.items.length === 0) {
        try {
          // @ts-ignore
          const shapes = context.document.body.shapes;
          shapes.load("items");
          await context.sync();
          warnings.push(`No inline images in selection. Found ${shapes.items.length} floating shape(s) — convert to inline for extraction.`);
        } catch {
          warnings.push("No images found in selection. Select an inline image first.");
        }
      } else {
        for (const pic of selectionPics.items) {
          const img = await extractSingleImage(pic, context, warnings);
          if (img) images.push(img);
        }
      }
      selection.load("text");
      await context.sync();
      text = selection.text.trim();
      sections = text ? [{ heading: "", headingLevel: 0, body: text, type: "text" }] : [];

    } else if (scope === "page") {
      const body = context.document.body;
      body.load("text");
      body.inlinePictures.load("items");
      await context.sync();

      const page = pageNumber ?? 1;
      const allWords = body.text.split(/\s+/);
      text = allWords.slice((page - 1) * WORDS_PER_PAGE, page * WORDS_PER_PAGE).join(" ");

      if (!text.trim()) {
        warnings.push(`Page ${page} out of range — using full document text.`);
        text = body.text;
      }

      sections = [{ heading: `Page ${page}`, headingLevel: 0, body: text, type: "text" }];

      for (const pic of body.inlinePictures.items) {
        const img = await extractSingleImage(pic, context, warnings);
        if (img) images.push(img);
      }
      if (body.inlinePictures.items.length > 0 && pageNumber) {
        warnings.push("Image-to-page mapping unavailable — all document images included.");
      }

    } else {
      const body = context.document.body;
      body.load("text");
      const paragraphs = body.paragraphs;
      paragraphs.load("items");
      const tables = body.tables;
      tables.load("items");
      body.inlinePictures.load("items");
      await context.sync();

      text = body.text;

      for (const para of paragraphs.items) para.load("text,style");
      for (const table of tables.items) table.rows.load("items");
      await context.sync();

      for (const table of tables.items) {
        for (const row of table.rows.items) row.cells.load("items");
      }
      await context.sync();

      for (const table of tables.items) {
        for (const row of table.rows.items) {
          for (const cell of row.cells.items) cell.load("value");
        }
      }
      await context.sync();

      const paraSections = buildParagraphSections(paragraphs.items, warnings);
      const tableSections = buildTableSections(tables.items);
      sections = [...paraSections, ...tableSections];

      for (const pic of body.inlinePictures.items) {
        const img = await extractSingleImage(pic, context, warnings);
        if (img) images.push(img);
      }

      // Handle floating shapes — convert picture shapes to inline, extract others as metadata
      try {
        // @ts-ignore
        const shapes = body.shapes;
        shapes.load("items");
        await context.sync();

        if (shapes.items.length > 0) {
          const pictureShapes: any[] = [];
          const otherShapes: any[] = [];

          for (const shape of shapes.items) {
            shape.load("type,altTextDescription,altTextTitle,name");
          }
          await context.sync();

          for (const shape of shapes.items) {
            const type = (shape.type ?? "").toLowerCase();
            if (type === "picture" || type === "image") {
              pictureShapes.push(shape);
            } else {
              otherShapes.push(shape);
            }
          }

          // For picture shapes: select + convert to inline to enable base64 extraction
          for (const shape of pictureShapes) {
            try {
              shape.select();
              await context.sync();

              // Get selected range inline pictures after selection
              const sel = context.document.getSelection();
              sel.inlinePictures.load("items");
              await context.sync();

              if (sel.inlinePictures.items.length > 0) {
                const img = await extractSingleImage(sel.inlinePictures.items[0], context, warnings);
                if (img) images.push(img);
              } else {
                // Could not extract — store alt text as metadata chunk
                const altText = shape.altTextDescription || shape.altTextTitle || shape.name || "floating image";
                warnings.push(`Floating image "${altText}" could not be extracted — no base64 available via Office.js.`);
              }
            } catch {
              warnings.push(`Could not process a floating picture shape.`);
            }
          }

          // For non-picture shapes (text boxes etc.) — extract their text content
          for (const shape of otherShapes) {
            try {
              // @ts-ignore
              const shapeBody = shape.body;
              if (shapeBody) {
                shapeBody.load("text");
                await context.sync();
                const shapeText = shapeBody.text?.trim();
                if (shapeText) {
                  sections.push({ heading: shape.name || "Text Box", headingLevel: 0, body: shapeText, type: "text" });
                }
              }
            } catch { }
          }
        }
      } catch { }
    }

    return { text, sections, images, warnings };
  });
}

function buildParagraphSections(paragraphs: Word.Paragraph[], warnings: string[]): DocumentSection[] {
  const sections: DocumentSection[] = [];
  let currentHeading = "";
  let currentLevel = 0;
  let bodyLines: string[] = [];

  const flush = () => {
    const body = bodyLines.join("\n").trim();
    if (body || currentHeading) {
      sections.push({ heading: currentHeading, headingLevel: currentLevel, body, type: "text" });
    }
    bodyLines = [];
  };

  for (const para of paragraphs) {
    const text = para.text?.trim() ?? "";
    if (!text) continue;
    const level = HEADING_STYLE_MAP[para.style ?? ""] ?? 0;
    if (level > 0) {
      flush();
      currentHeading = text;
      currentLevel = level;
    } else {
      bodyLines.push(text);
    }
  }
  flush();

  if (!sections.some(s => s.headingLevel > 0)) {
    warnings.push("No Word heading styles detected — overlap chunking will be used. Apply Heading styles for better retrieval.");
  }

  return sections;
}

function buildTableSections(tables: Word.Table[]): DocumentSection[] {
  return tables.map((table, t) => {
    const rows = table.rows.items;
    const mdRows: string[] = [];
    rows.forEach((row, r) => {
      const cells = row.cells.items.map(c => (c.value ?? "").trim().replace(/\n/g, " "));
      mdRows.push("| " + cells.join(" | ") + " |");
      if (r === 0) mdRows.push("| " + cells.map(() => "---").join(" | ") + " |");
    });
    return { heading: `Table ${t + 1}`, headingLevel: 0, body: mdRows.join("\n"), type: "table" as const };
  });
}

async function extractSingleImage(
  pic: Word.InlinePicture,
  context: Word.RequestContext,
  warnings: string[]
): Promise<ExtractedImage | null> {
  pic.load("altTextTitle,altTextDescription,imageFormat");
  await context.sync();

  const fmt = (pic.imageFormat ?? "unknown").toLowerCase();
  const altText = [pic.altTextTitle, pic.altTextDescription].filter(Boolean).join(" — ") || "";

  if (!SUPPORTED_IMAGE_FORMATS.includes(fmt)) {
    warnings.push(`Skipped image format "${fmt}" — GPT-4o supports JPEG, PNG, GIF, WEBP only.`);
    return null;
  }

  const base64Result = pic.getBase64ImageSrc();
  await context.sync();
  return { base64: base64Result.value, format: fmt === "jpg" ? "jpeg" : fmt, altText };
}

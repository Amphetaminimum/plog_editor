const SUPPORTED_BLOCK_TYPES = new Set(["header", "text", "image", "divider", "quote", "card"]);

export class DocumentImportError extends Error {
  constructor(message) {
    super(message);
    this.name = "DocumentImportError";
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");
}

function plainInline(value) {
  return String(value || "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1");
}

export function parseMarkdownDocument(source) {
  const lines = String(source || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    if (text) blocks.push({ type: "text", content: plainInline(text), html: inlineMarkdown(text) });
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const tag = list.ordered ? "ol" : "ul";
    const html = `<${tag}>${list.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</${tag}>`;
    const content = list.items.map((item, index) => `${list.ordered ? `${index + 1}.` : "•"} ${plainInline(item)}`).join("\n");
    blocks.push({ type: "text", content, html });
    list = null;
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) throw new DocumentImportError("Fenced code blocks are not supported in this importer.");
    const image = line.match(/^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*$/);
    const quote = line.match(/^\s*>\s?(.*)$/);
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);

    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (image) {
      flushParagraph();
      flushList();
      blocks.push({ type: "image", src: image[2].trim(), alt: image[1].trim(), aspectRatio: 16 / 9 });
    } else if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push({ type: "divider" });
    } else if (heading) {
      flushParagraph();
      flushList();
      const text = plainInline(heading[2]);
      if (heading[1].length === 1 && !blocks.some((block) => block.type === "header")) {
        blocks.push({ type: "header", content: { title: text, titleHtml: inlineMarkdown(heading[2]), meta: "", metaHtml: "" } });
      } else {
        const size = Math.max(38, 62 - heading[1].length * 5);
        blocks.push({ type: "text", content: text, html: `<strong>${inlineMarkdown(heading[2])}</strong>`, style: { fontSize: size, fontWeight: 600 } });
      }
    } else if (quote) {
      flushParagraph();
      flushList();
      blocks.push({ type: "quote", content: plainInline(quote[1]), html: inlineMarkdown(quote[1]) });
    } else if (unordered || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (list && list.ordered !== isOrdered) flushList();
      if (!list) list = { ordered: isOrdered, items: [] };
      list.items.push((ordered || unordered)[1]);
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }

  flushParagraph();
  flushList();
  if (!blocks.length) throw new DocumentImportError("The Markdown file did not contain any supported content.");
  return { version: 1, title: blocks.find((block) => block.type === "header")?.content?.title || "Imported Markdown", blocks };
}

export function parseJsonDocument(source) {
  let document;
  try {
    document = typeof source === "string" ? JSON.parse(source) : structuredClone(source);
  } catch {
    throw new DocumentImportError("The JSON file is not valid JSON.");
  }
  if (document?.version !== 1) throw new DocumentImportError("Only Plog document schema version 1 is supported.");
  if (!Array.isArray(document.blocks)) throw new DocumentImportError("A version 1 document must contain a blocks array.");
  const blocks = document.blocks.map((block, index) => {
    if (!SUPPORTED_BLOCK_TYPES.has(block?.type)) {
      throw new DocumentImportError(`Unsupported block type at index ${index}: ${block?.type || "missing"}`);
    }
    return structuredClone(block);
  });
  return { version: 1, title: String(document.title || "Imported JSON"), canvas: structuredClone(document.canvas || {}), blocks };
}

export function parseDocumentImport(source, filename = "") {
  const normalized = filename.toLowerCase();
  if (normalized.endsWith(".json")) return parseJsonDocument(source);
  if (normalized.endsWith(".md") || normalized.endsWith(".markdown") || !normalized) return parseMarkdownDocument(source);
  throw new DocumentImportError("Choose a .md, .markdown, or Plog schema .json file.");
}

export function createStateRenderer({
  getCanvasMetrics,
  getElements,
  getPalette,
  resolveFontFamily,
  resolveTextColor,
}) {
  function plainTextFromHtml(html) {
    const doc = new DOMParser().parseFromString(html || "", "text/html");
    return extractTextWithBreaks(doc.body);
  }

  function extractTextWithBreaks(root) {
    const BLOCK = new Set(["div", "p", "br", "li", "tr", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6"]);
    const parts = [];
    let lastWasBlock = false;

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        if (text) {
          parts.push(text);
          lastWasBlock = false;
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toLowerCase();
      if (tag === "br") {
        parts.push("\n");
        lastWasBlock = true;
        return;
      }
      const isBlock = BLOCK.has(tag);
      if (isBlock && parts.length && !lastWasBlock) {
        parts.push("\n");
      }
      for (const child of node.childNodes) walk(child);
      if (isBlock && parts.length && !lastWasBlock) {
        parts.push("\n");
        lastWasBlock = true;
      }
    }

    walk(root);
    return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
  }

  function drawRoundedImage(ctx, img, x, y, w, h, r) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  }

  async function renderCanvasFromState(scale, format) {
    const { width, height } = getCanvasMetrics();
    const palette = getPalette();
    const out = document.createElement("canvas");
    out.width = width * scale;
    out.height = height * scale;
    const ctx = out.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = palette.background;
    if (format === "jpg" && palette.appearance === "light") ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    for (const item of getElements()) {
      if (item.type === "image" && item.src) {
        const img = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = item.src;
        });
        ctx.save();
        const centerX = item.x + item.width / 2;
        const centerY = item.y + item.height / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate(((item.style.rotation ?? 0) * Math.PI) / 180);
        ctx.filter = `brightness(${item.style.brightness ?? 100}%) contrast(${item.style.contrast ?? 100}%) grayscale(${item.style.grayscale ?? 0}%)`;
        drawRoundedImage(ctx, img, -item.width / 2, -item.height / 2, item.width, item.height, item.style.radius ?? 0);
        ctx.restore();
        ctx.filter = "none";
        continue;
      }

      if (item.type === "divider") {
        ctx.fillStyle = "#8d684e";
        roundRect(ctx, item.x, item.y + 8, item.width, 3, 999);
        ctx.fill();
        continue;
      }

      if (item.type === "header") {
        drawRichTextBox(ctx, {
          ...item,
          width: Math.max(180, item.width - 300),
          html: item.content?.titleHtml || item.content?.title || "",
          style: { ...item.style, color: resolveTextColor(item.style.color ?? "#1f1f22"), fontWeight: item.style.fontWeight ?? 500 },
        });
        const metaHtml = item.content?.metaHtml || item.content?.meta || "";
        const metaText = plainTextFromHtml(metaHtml);
        ctx.textAlign = "right";
        drawText(ctx, metaText, item.x + item.width, item.y + 62, 60, resolveTextColor(item.style.color ?? "#1f1f22"), "500", resolveFontFamily(item));
        ctx.textAlign = "left";
        continue;
      }

      if (item.type === "quote") {
        ctx.fillStyle = palette.appearance === "dark" ? "rgba(255,248,239,0.08)" : "rgba(201,178,148,0.18)";
        ctx.fillRect(item.x, item.y, item.width, item.height);
        ctx.fillStyle = "#8d7354";
        ctx.fillRect(item.x, item.y, 6, item.height);
        drawRichTextBox(ctx, { ...item, html: item.html || item.content || "", style: { ...item.style, color: resolveTextColor(item.style.color) } });
        continue;
      }

      if (item.type === "card") {
        ctx.fillStyle = palette.panel;
        roundRect(ctx, item.x, item.y, item.width, item.height, 14);
        ctx.fill();
        drawText(
          ctx,
          plainTextFromHtml(item.content?.titleHtml || item.content?.title || ""),
          item.x + 18,
          item.y + 52,
          52,
          resolveTextColor(item.style.color ?? "#1f1f22"),
          "500",
          resolveFontFamily(item),
        );
        drawRichTextBox(ctx, {
          ...item,
          x: item.x + 18,
          y: item.y + 60,
          width: item.width - 36,
          html: item.content?.bodyHtml || item.content?.body || "",
          style: { ...item.style, color: resolveTextColor(item.style.color) },
        });
        continue;
      }

      if (item.type === "markdown") {
        ctx.fillStyle = "#fffdfa";
        roundRect(ctx, item.x, item.y, item.width, item.height, 12);
        ctx.fill();
        drawTextBox(ctx, {
          ...item,
          x: item.x + 12,
          y: item.y + 12,
          width: item.width - 24,
          content: stripMarkdown(item.content || ""),
        });
        continue;
      }

      if (item.type === "text") {
        drawRichTextBox(ctx, { ...item, html: item.html || item.content || "", style: { ...item.style, color: resolveTextColor(item.style.color) } });
      }
    }

    return out;
  }

  function drawTextBox(ctx, item) {
    const content = item.content || "";
    if (!content.trim()) return;
    const fontSize = item.style.fontSize ?? 60;
    const color = item.style.color ?? "#1f1f22";
    const family = resolveFontFamily(item);
    const weight = item.style.fontWeight ?? 300;
    const lines = wrapText(ctx, content, item.width, `${weight} ${fontSize}px ${family}`);
    ctx.fillStyle = color;
    ctx.font = `${weight} ${fontSize}px ${family}`;
    const lineHeight = fontSize * 1.5;
    lines.forEach((line, idx) => {
      const y = item.y + lineHeight * (idx + 0.8);
      const isLast = idx === lines.length - 1;
      drawJustifiedLine(ctx, line, item.x, y, item.width, isLast);
    });
  }

  function drawText(ctx, text, x, y, size, color, weight = "400", family) {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillText(text, x, y);
  }

  function htmlToRichTokens(html, style) {
    const doc = new DOMParser().parseFromString(html || "", "text/html");
    const root = doc.body;
    const tokens = [];
    const base = {
      weight: Number(style.fontWeight ?? 300),
      italic: false,
    };

    function pushText(text, current) {
      if (!text) return;
      for (const ch of text.replace(/\r/g, "")) {
        tokens.push({
          text: ch,
          weight: current.weight,
          italic: current.italic,
        });
      }
    }

    function walk(node, current) {
      if (node.nodeType === Node.TEXT_NODE) {
        pushText(node.textContent || "", current);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName.toLowerCase();
      const next = {
        weight: current.weight,
        italic: current.italic,
      };

      if (tag === "strong" || tag === "b") next.weight = Math.max(current.weight, 700);
      if (tag === "em" || tag === "i") next.italic = true;
      if (tag === "br") {
        tokens.push({ text: "\n", weight: current.weight, italic: current.italic });
        return;
      }

      const blockLike = tag === "div" || tag === "p";
      if (blockLike && tokens.length) {
        const last = tokens[tokens.length - 1];
        if (last.text !== "\n") tokens.push({ text: "\n", weight: current.weight, italic: current.italic });
      }

      Array.from(node.childNodes).forEach((child) => walk(child, next));

      if (blockLike && tokens.length) {
        const last = tokens[tokens.length - 1];
        if (last.text !== "\n") tokens.push({ text: "\n", weight: current.weight, italic: current.italic });
      }
    }

    Array.from(root.childNodes).forEach((child) => walk(child, base));
    while (tokens.length && tokens[tokens.length - 1].text === "\n") tokens.pop();
    return tokens;
  }

  function measureRichToken(ctx, token, fontSize, family) {
    const fontStyle = token.italic ? "italic " : "";
    ctx.font = `${fontStyle}${token.weight} ${fontSize}px ${family}`;
    return ctx.measureText(token.text).width;
  }

  function drawRichTextBox(ctx, item) {
    const html = item.html || "";
    if (!html.trim()) return false;
    const fontSize = item.style.fontSize ?? 60;
    const color = item.style.color ?? "#1f1f22";
    const family = resolveFontFamily(item);
    const lineHeight = fontSize * 1.5;
    const tokens = htmlToRichTokens(html, item.style);
    if (!tokens.length) return false;

    const lines = [];
    let currentLine = [];
    let currentWidth = 0;

    for (const token of tokens) {
      if (token.text === "\n") {
        lines.push(currentLine);
        currentLine = [];
        currentWidth = 0;
        continue;
      }
      const tokenWidth = measureRichToken(ctx, token, fontSize, family);
      if (currentWidth + tokenWidth > item.width && currentLine.length) {
        lines.push(currentLine);
        currentLine = [token];
        currentWidth = tokenWidth;
      } else {
        currentLine.push(token);
        currentWidth += tokenWidth;
      }
    }
    if (currentLine.length) lines.push(currentLine);

    lines.forEach((line, index) => {
      let cursorX = item.x;
      const y = item.y + lineHeight * (index + 0.8);
      line.forEach((token) => {
        const fontStyle = token.italic ? "italic " : "";
        ctx.fillStyle = color;
        ctx.font = `${fontStyle}${token.weight} ${fontSize}px ${family}`;
        ctx.fillText(token.text, cursorX, y);
        cursorX += ctx.measureText(token.text).width;
      });
    });

    return true;
  }

  function wrapText(ctx, text, maxWidth, font) {
    ctx.font = font;
    const words = tokenizeForWrap(text || "");
    const lines = [];
    let line = "";

    for (const word of words) {
      if (word === "\n") {
        lines.push(line);
        line = "";
        continue;
      }
      const needSpace = line && !isCjkChar(word) && !isCjkChar(line[line.length - 1]);
      const test = line ? `${line}${needSpace ? " " : ""}${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }

    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  function tokenizeForWrap(text) {
    const hasCjk = /[\u3400-\u9FFF]/.test(text);
    if (hasCjk) return [...text.replace(/\r/g, "")];
    return text.replace(/\r/g, "").split(/\s+/);
  }

  function isCjkChar(ch) {
    if (!ch) return false;
    return /[\u3400-\u9FFF]/.test(ch);
  }

  function drawJustifiedLine(ctx, line, x, y, width, isLastLine) {
    const trimmed = line.trimEnd();
    if (isLastLine || trimmed.length <= 1) {
      ctx.fillText(trimmed, x, y);
      return;
    }
    const chars = [...trimmed];
    const textWidth = ctx.measureText(trimmed).width;
    const gapCount = chars.length - 1;
    const extra = Math.max(0, width - textWidth);
    const gap = gapCount > 0 ? extra / gapCount : 0;
    let cursorX = x;
    for (let i = 0; i < chars.length; i += 1) {
      const ch = chars[i];
      ctx.fillText(ch, cursorX, y);
      cursorX += ctx.measureText(ch).width + (i < chars.length - 1 ? gap : 0);
    }
  }

  function stripMarkdown(md) {
    return (md || "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^>\s+/gm, "")
      .replace(/^-\s+/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`(.*?)`/g, "$1");
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  return {
    renderCanvasFromState,
  };
}

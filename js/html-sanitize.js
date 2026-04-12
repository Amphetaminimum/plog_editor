const BOLD_TAGS = new Set(["b", "strong"]);
const ITALIC_TAGS = new Set(["em", "i"]);
const BLOCK_TAGS = new Set(["div", "p", "section", "article", "header", "footer", "blockquote", "ul", "ol", "li"]);

function appendBreak(target) {
  const last = target.lastChild;
  if (!last || last.nodeName !== "BR") {
    target.appendChild(document.createElement("br"));
  }
}

function sanitizeNodeInto(target, node) {
  if (node.nodeType === Node.TEXT_NODE) {
    target.appendChild(document.createTextNode(node.textContent || ""));
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const tag = node.tagName.toLowerCase();

  if (tag === "br") {
    appendBreak(target);
    return;
  }

  if (BOLD_TAGS.has(tag) || ITALIC_TAGS.has(tag)) {
    const wrapper = document.createElement(BOLD_TAGS.has(tag) ? "strong" : "em");
    Array.from(node.childNodes).forEach((child) => sanitizeNodeInto(wrapper, child));
    if (wrapper.childNodes.length > 0) {
      target.appendChild(wrapper);
    }
    return;
  }

  if (BLOCK_TAGS.has(tag)) {
    if (target.childNodes.length > 0) appendBreak(target);
    Array.from(node.childNodes).forEach((child) => sanitizeNodeInto(target, child));
    if (target.childNodes.length > 0) appendBreak(target);
    return;
  }

  Array.from(node.childNodes).forEach((child) => sanitizeNodeInto(target, child));
}

function normalizeBreaks(container) {
  const nodes = Array.from(container.childNodes);
  let previousWasBreak = false;
  nodes.forEach((node) => {
    const isBreak = node.nodeName === "BR";
    if (isBreak && previousWasBreak) {
      node.remove();
      return;
    }
    previousWasBreak = isBreak;
  });

  while (container.firstChild?.nodeName === "BR") {
    container.firstChild.remove();
  }
  while (container.lastChild?.nodeName === "BR") {
    container.lastChild.remove();
  }
}

export function sanitizeEditableHtml(html) {
  const source = document.createElement("div");
  source.innerHTML = html || "";
  const clean = document.createElement("div");
  Array.from(source.childNodes).forEach((node) => sanitizeNodeInto(clean, node));
  normalizeBreaks(clean);
  return clean.innerHTML;
}

export function plainTextFromEditableHtml(html) {
  const clean = document.createElement("div");
  clean.innerHTML = sanitizeEditableHtml(html);
  return clean.innerText || "";
}

export function sanitizePastedHtml(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const clean = document.createElement("div");
  Array.from(doc.body.childNodes).forEach((node) => sanitizeNodeInto(clean, node));
  normalizeBreaks(clean);
  return clean.innerHTML;
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

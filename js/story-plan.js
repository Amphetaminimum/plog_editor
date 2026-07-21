import { DOCUMENT_COMMANDS } from "./document-commands.js";

export const STORY_PLAN_PHOTO_COUNT = 6;

function cleanText(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function normalizeStoryPlan(plan, photoIds) {
  const allowed = [...new Set((photoIds || []).map(String))];
  if (allowed.length !== STORY_PLAN_PHOTO_COUNT) {
    throw new Error(`AI drafting needs exactly ${STORY_PLAN_PHOTO_COUNT} photos.`);
  }

  const claimed = new Set();
  const rawSections = Array.isArray(plan?.sections) ? plan.sections.slice(0, 4) : [];
  const sections = rawSections.map((section, index) => {
    const ids = [];
    for (const id of Array.isArray(section?.photoIds) ? section.photoIds : []) {
      const normalized = String(id);
      if (allowed.includes(normalized) && !claimed.has(normalized)) {
        claimed.add(normalized);
        ids.push(normalized);
      }
    }
    return {
      heading: cleanText(section?.heading, 80) || `Chapter ${index + 1}`,
      body: cleanText(section?.body, 700),
      photoIds: ids,
    };
  }).filter((section) => section.body || section.photoIds.length);

  if (sections.length < 2) throw new Error("The AI draft needs at least two usable chapters.");
  const unclaimed = allowed.filter((id) => !claimed.has(id));
  unclaimed.forEach((id, index) => sections[index % sections.length].photoIds.push(id));

  return {
    title: cleanText(plan?.title, 100) || "A Journey in Six Frames",
    dek: cleanText(plan?.dek, 320),
    sections,
  };
}

export function compileStoryPlanBatch({ existingBlocks, imageBlocks, plan, createBlock, meta }) {
  if (typeof createBlock !== "function") throw new Error("createBlock is required");
  const photos = (imageBlocks || []).slice(0, STORY_PLAN_PHOTO_COUNT);
  const normalized = normalizeStoryPlan(plan, photos.map((item) => item.id));
  const photoById = new Map(photos.map((item) => [item.id, structuredClone(item)]));
  const nextBlocks = [];

  nextBlocks.push(createBlock("header", {
    content: {
      title: normalized.title,
      titleHtml: escapeHtml(normalized.title),
      meta: cleanText(meta, 40),
      metaHtml: escapeHtml(cleanText(meta, 40)),
    },
    spacingBefore: "normal",
  }));

  if (normalized.dek) {
    nextBlocks.push(createBlock("text", {
      content: normalized.dek,
      html: escapeHtml(normalized.dek),
      spacingBefore: "section",
    }));
  }

  normalized.sections.forEach((section) => {
    const copy = `${section.heading}\n${section.body}`.trim();
    nextBlocks.push(createBlock("text", {
      content: copy,
      html: `<strong>${escapeHtml(section.heading)}</strong>${section.body ? `<br>${escapeHtml(section.body)}` : ""}`,
      spacingBefore: "section",
    }));
    section.photoIds.forEach((id, index) => {
      const image = photoById.get(id);
      if (!image) return;
      image.spacingBefore = index === 0 ? "normal" : "tight";
      nextBlocks.push(image);
    });
  });

  const commands = (existingBlocks || []).map((block) => ({ type: DOCUMENT_COMMANDS.DELETE, id: block.id }));
  nextBlocks.forEach((block, index) => commands.push({ type: DOCUMENT_COMMANDS.INSERT, index, block }));
  return {
    command: { type: DOCUMENT_COMMANDS.BATCH, commands },
    plan: normalized,
    blocks: nextBlocks,
  };
}

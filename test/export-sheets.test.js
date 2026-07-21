import test from "node:test";
import assert from "node:assert/strict";

import { createTwoStorySheets } from "../js/export-sheets.js";

const header = {
  id: "header",
  type: "header",
  y: 36,
  height: 120,
  width: 1008,
  spacingBefore: "normal",
  content: { title: "Kyoto", meta: "November" },
};

test("story-sheet export repeats the header and keeps chapters intact", () => {
  const blocks = [
    header,
    { id: "dek", type: "text", y: 208, height: 80, width: 1008, spacingBefore: "section", html: "A quiet walk." },
    { id: "chapter-1", type: "text", y: 340, height: 100, width: 1008, spacingBefore: "section", html: "<strong>Morning</strong><br>Rain." },
    { id: "photo-1", type: "image", y: 466, height: 600, width: 1008, aspectRatio: 1.68, spacingBefore: "normal" },
    { id: "chapter-2", type: "text", y: 1118, height: 100, width: 1008, spacingBefore: "section", html: "<strong>Evening</strong><br>Lanterns." },
    { id: "photo-2", type: "image", y: 1244, height: 600, width: 1008, aspectRatio: 1.68, spacingBefore: "normal" },
  ];

  const sheets = createTwoStorySheets(blocks, 1200);
  assert.equal(sheets.length, 2);
  assert.equal(sheets[0].elements[0].type, "header");
  assert.equal(sheets[1].elements[0].type, "header");
  assert.deepEqual(sheets[0].elements.filter((block) => block.type === "image").map((block) => block.id.split("-sheet-")[0]), ["photo-1"]);
  assert.deepEqual(sheets[1].elements.filter((block) => block.type === "image").map((block) => block.id.split("-sheet-")[0]), ["photo-2"]);
  assert.match(sheets[0].elements.find((block) => block.id.startsWith("chapter-1"))?.html, /Morning/);
  assert.match(sheets[1].elements.find((block) => block.id.startsWith("chapter-2"))?.html, /Evening/);
});

test("story-sheet export reflows each sheet from the top without overlap", () => {
  const blocks = [
    header,
    { id: "chapter-1", type: "text", y: 220, height: 100, width: 1008, spacingBefore: "section", html: "<strong>One</strong>" },
    { id: "photo-1", type: "image", y: 346, height: 600, width: 1008, aspectRatio: 1.68, spacingBefore: "normal" },
    { id: "chapter-2", type: "text", y: 998, height: 100, width: 1008, spacingBefore: "section", html: "<strong>Two</strong>" },
    { id: "photo-2", type: "image", y: 1124, height: 600, width: 1008, aspectRatio: 1.68, spacingBefore: "normal" },
  ];

  const sheets = createTwoStorySheets(blocks, 1200);
  for (const sheet of sheets) {
    assert.equal(sheet.elements[0].y, 36);
    for (let index = 1; index < sheet.elements.length; index += 1) {
      const previous = sheet.elements[index - 1];
      const current = sheet.elements[index];
      assert.ok(current.y >= previous.y + previous.height);
    }
    const last = sheet.elements.at(-1);
    assert.ok(sheet.height >= last.y + last.height + 96);
  }
});

test("story-sheet export falls back to a balanced block split with repeated header", () => {
  const blocks = [
    header,
    { id: "a", type: "image", y: 182, height: 600, width: 1008, aspectRatio: 1.68 },
    { id: "b", type: "image", y: 808, height: 600, width: 1008, aspectRatio: 1.68 },
    { id: "c", type: "image", y: 1434, height: 600, width: 1008, aspectRatio: 1.68 },
    { id: "d", type: "image", y: 2060, height: 600, width: 1008, aspectRatio: 1.68 },
  ];

  const sheets = createTwoStorySheets(blocks, 1200);
  assert.equal(sheets.length, 2);
  assert.equal(sheets[0].elements[0].type, "header");
  assert.equal(sheets[1].elements[0].type, "header");
  assert.equal(sheets[0].elements.filter((block) => block.type === "image").length, 2);
  assert.equal(sheets[1].elements.filter((block) => block.type === "image").length, 2);
});

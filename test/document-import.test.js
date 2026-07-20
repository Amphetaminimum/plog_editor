import test from "node:test";
import assert from "node:assert/strict";

import { DocumentImportError, parseDocumentImport, parseJsonDocument, parseMarkdownDocument } from "../js/document-import.js";

test("restricted Markdown maps headings, paragraphs, lists, quotes, images, and dividers", () => {
  const document = parseMarkdownDocument(`# Kyoto\n\nA **quiet** morning.\n\n- Train\n- Temple\n\n> Look up.\n\n![Gate](gate.jpg)\n\n---`);
  assert.deepEqual(document.blocks.map((block) => block.type), ["header", "text", "text", "quote", "image", "divider"]);
  assert.match(document.blocks[1].html, /<strong>quiet<\/strong>/);
  assert.match(document.blocks[2].html, /<ul>/);
});

test("Markdown escapes raw HTML instead of importing executable markup", () => {
  const document = parseMarkdownDocument("Hello <script>alert(1)</script>");
  assert.doesNotMatch(document.blocks[0].html, /<script>/);
  assert.match(document.blocks[0].html, /&lt;script&gt;/);
});

test("JSON import accepts only schema version 1 and known block types", () => {
  const document = parseJsonDocument(JSON.stringify({ version: 1, title: "Trip", blocks: [{ id: "x", type: "text", content: "Hi", style: {} }] }));
  assert.equal(document.title, "Trip");
  assert.throws(() => parseJsonDocument({ version: 2, blocks: [] }), DocumentImportError);
  assert.throws(() => parseJsonDocument({ version: 1, blocks: [{ type: "video" }] }), /Unsupported block type/);
});

test("file extension selects the importer", () => {
  assert.equal(parseDocumentImport("# One", "trip.md").blocks[0].type, "header");
  assert.equal(parseDocumentImport('{"version":1,"blocks":[]}', "trip.json").version, 1);
});

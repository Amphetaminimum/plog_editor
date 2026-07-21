import test from "node:test";
import assert from "node:assert/strict";

import {
  DOCUMENT_COMMANDS,
  createDocumentSnapshot,
  executeDocumentCommand,
  reduceDocumentBlocks,
} from "../js/document-commands.js";

const blocks = () => [
  { id: "a", type: "text", content: "A", html: "A", style: { color: "#111111" } },
  { id: "b", type: "image", assetId: "asset-b", style: { radius: 0 } },
];

test("insert and delete commands are immutable and invertible", () => {
  const original = blocks();
  const command = { type: DOCUMENT_COMMANDS.INSERT, index: 1, block: { id: "c", type: "quote", content: "C", style: {} } };
  const result = executeDocumentCommand(original, command);

  assert.deepEqual(original.map((item) => item.id), ["a", "b"]);
  assert.deepEqual(result.blocks.map((item) => item.id), ["a", "c", "b"]);
  assert.deepEqual(reduceDocumentBlocks(result.blocks, result.inverse), original);
});

test("move command preserves the block and restores its original index", () => {
  const original = [...blocks(), { id: "c", type: "divider", style: {} }];
  const result = executeDocumentCommand(original, { type: DOCUMENT_COMMANDS.MOVE, id: "c", toIndex: 0 });

  assert.deepEqual(result.blocks.map((item) => item.id), ["c", "a", "b"]);
  assert.deepEqual(reduceDocumentBlocks(result.blocks, result.inverse).map((item) => item.id), ["a", "b", "c"]);
});

test("content and style commands update only their owned fields", () => {
  const content = executeDocumentCommand(blocks(), {
    type: DOCUMENT_COMMANDS.UPDATE_CONTENT,
    id: "a",
    patch: { content: "After", html: "<strong>After</strong>" },
  });
  const styled = executeDocumentCommand(content.blocks, {
    type: DOCUMENT_COMMANDS.UPDATE_STYLE,
    id: "a",
    patch: { color: "#ffffff", fontSize: 48 },
  });

  assert.equal(styled.blocks[0].content, "After");
  assert.equal(styled.blocks[0].style.color, "#ffffff");
  assert.equal(styled.blocks[1].assetId, "asset-b");
  assert.deepEqual(reduceDocumentBlocks(styled.blocks, styled.inverse), content.blocks);
  assert.deepEqual(reduceDocumentBlocks(content.blocks, content.inverse), blocks());
});

test("document snapshots expose a versioned external schema", () => {
  const snapshot = createDocumentSnapshot({ id: "doc-1", title: "Trip", canvas: { width: 1200 }, blocks: blocks() });
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.title, "Trip");
  assert.notEqual(snapshot.blocks, blocks());
});

test("batch commands apply atomically and expose one inverse batch", () => {
  const original = blocks();
  const command = {
    type: DOCUMENT_COMMANDS.BATCH,
    commands: [
      { type: DOCUMENT_COMMANDS.DELETE, id: "a" },
      { type: DOCUMENT_COMMANDS.MOVE, id: "b", toIndex: 0 },
      { type: DOCUMENT_COMMANDS.INSERT, index: 1, block: { id: "c", type: "text", content: "C", style: {} } },
    ],
  };

  const result = executeDocumentCommand(original, command);
  assert.deepEqual(result.blocks.map((item) => item.id), ["b", "c"]);
  assert.equal(result.inverse.type, DOCUMENT_COMMANDS.BATCH);
  assert.deepEqual(reduceDocumentBlocks(result.blocks, result.inverse), original);
});

import test from "node:test";
import assert from "node:assert/strict";

import { createHistoryManager } from "../js/history-manager.js";

function createHarness() {
  const state = {
    elements: [
      { id: "a", x: 48, y: 36, width: 1104, height: 120, spacingBefore: "normal", style: {} },
    ],
    selectedId: "a",
    seq: 2,
    layoutLocked: true,
    zoom: 1,
    zoomMode: "fit",
    themeMode: "night",
    history: [],
    historyIndex: -1,
    suppressHistory: false,
    savedSelection: null,
    savedSelectionElementId: null,
    savedSelectionTarget: null,
    editSession: null,
    lastCanvasWidthUi: {
      widthSelect: "1200",
      customWidth: "1200",
    },
  };

  const controls = {
    widthSelect: { value: "1200" },
    customWidth: { value: "1200" },
    canvasBg: { value: "#ffffff" },
    exportScale: { value: "2" },
    exportFormat: { value: "png" },
    exportQuality: { value: "0.9" },
    exportAppearance: { value: "match" },
    exportButton: { textContent: "Export PNG" },
  };

  const manager = createHistoryManager({
    state,
    controls,
    setCanvasBackground: (value) => {
      controls.canvasBg.value = value;
    },
    setLayoutLocked: (next) => {
      state.layoutLocked = next;
    },
  });

  return { state, controls, manager };
}

test("layout.canvasWidth undo and redo restore control values and tracked UI state", () => {
  const { state, controls, manager } = createHarness();

  manager.pushHistory("initial");

  controls.widthSelect.value = "1080";
  controls.customWidth.value = "1200";
  state.lastCanvasWidthUi = {
    widthSelect: "1080",
    customWidth: "1200",
  };
  state.elements[0].x = 43;
  state.elements[0].width = 994;

  manager.commitMutation("layout.canvasWidth", {
    beforeUi: { widthSelect: "1200", customWidth: "1200" },
    afterUi: { widthSelect: "1080", customWidth: "1200" },
    beforeLayout: [
      { id: "a", x: 48, y: 36, width: 1104, height: 120, spacingBefore: "normal" },
    ],
    afterLayout: [
      { id: "a", x: 43, y: 36, width: 994, height: 120, spacingBefore: "normal" },
    ],
  });

  assert.equal(manager.undoHistory(), true);
  assert.equal(controls.widthSelect.value, "1200");
  assert.equal(state.lastCanvasWidthUi.widthSelect, "1200");
  assert.equal(state.elements[0].width, 1104);

  assert.equal(manager.redoHistory(), true);
  assert.equal(controls.widthSelect.value, "1080");
  assert.equal(state.lastCanvasWidthUi.widthSelect, "1080");
  assert.equal(state.elements[0].width, 994);
});

test("content.edit undo and redo restore block content and height", () => {
  const { state, manager } = createHarness();
  state.elements[0].type = "text";
  state.elements[0].html = "Before";
  state.elements[0].content = "Before";
  state.elements[0].height = 52;

  manager.pushHistory("initial");
  state.elements[0].html = "<strong>After</strong>";
  state.elements[0].content = "After";
  state.elements[0].height = 88;

  manager.commitMutation("content.edit", {
    id: "a",
    beforeContentState: { html: "Before", content: "Before", height: 52 },
    afterContentState: { html: "<strong>After</strong>", content: "After", height: 88 },
    beforeLayout: [
      { id: "a", x: 48, y: 36, width: 1104, height: 52, spacingBefore: "normal" },
    ],
    afterLayout: [
      { id: "a", x: 48, y: 36, width: 1104, height: 88, spacingBefore: "normal" },
    ],
  });

  assert.equal(manager.undoHistory(), true);
  assert.equal(state.elements[0].html, "Before");
  assert.equal(state.elements[0].content, "Before");
  assert.equal(state.elements[0].height, 52);

  assert.equal(manager.redoHistory(), true);
  assert.equal(state.elements[0].html, "<strong>After</strong>");
  assert.equal(state.elements[0].content, "After");
  assert.equal(state.elements[0].height, 88);
});

test("structure.insert undo and redo remove and restore the inserted element", () => {
  const { state, manager } = createHarness();
  const inserted = {
    id: "b",
    type: "text",
    x: 48,
    y: 182,
    width: 1104,
    height: 52,
    spacingBefore: "section",
    style: {},
    html: "Inserted",
    content: "Inserted",
  };

  manager.pushHistory("initial");
  state.elements.splice(1, 0, inserted);
  manager.commitMutation("structure.insert", {
    index: 1,
    item: inserted,
  });

  assert.equal(state.elements.length, 2);
  assert.equal(manager.undoHistory(), true);
  assert.equal(state.elements.length, 1);
  assert.equal(state.elements.find((item) => item.id === "b"), undefined);

  assert.equal(manager.redoHistory(), true);
  assert.equal(state.elements.length, 2);
  assert.equal(state.elements[1].id, "b");
  assert.equal(state.selectedId, "b");
});

test("structure.delete undo and redo restore and remove the deleted element", () => {
  const { state, manager } = createHarness();
  const deleted = {
    id: "b",
    type: "quote",
    x: 48,
    y: 182,
    width: 1104,
    height: 120,
    spacingBefore: "section",
    style: {},
    html: "Deleted",
    content: "Deleted",
  };

  state.elements.push(deleted);
  state.selectedId = "b";
  manager.pushHistory("initial");
  state.elements = state.elements.filter((item) => item.id !== "b");
  state.selectedId = null;

  manager.commitMutation("structure.delete", {
    index: 1,
    item: deleted,
  });

  assert.equal(state.elements.length, 1);
  assert.equal(manager.undoHistory(), true);
  assert.equal(state.elements.length, 2);
  assert.equal(state.elements[1].id, "b");
  assert.equal(state.selectedId, "b");

  assert.equal(manager.redoHistory(), true);
  assert.equal(state.elements.length, 1);
  assert.equal(state.elements.find((item) => item.id === "b"), undefined);
});

test("content.richTextFormat undo and redo restore formatted block state", () => {
  const { state, manager } = createHarness();
  state.elements[0].type = "text";
  state.elements[0].html = "plain text";
  state.elements[0].content = "plain text";
  state.elements[0].height = 52;

  manager.pushHistory("initial");
  state.elements[0].html = "plain <strong>text</strong>";
  state.elements[0].content = "plain text";
  state.elements[0].height = 64;

  manager.commitMutation("content.richTextFormat", {
    id: "a",
    beforeContentState: { html: "plain text", content: "plain text", height: 52 },
    afterContentState: { html: "plain <strong>text</strong>", content: "plain text", height: 64 },
    beforeLayout: [
      { id: "a", x: 48, y: 36, width: 1104, height: 52, spacingBefore: "normal" },
    ],
    afterLayout: [
      { id: "a", x: 48, y: 36, width: 1104, height: 64, spacingBefore: "normal" },
    ],
  });

  assert.equal(manager.undoHistory(), true);
  assert.equal(state.elements[0].html, "plain text");
  assert.equal(state.elements[0].height, 52);

  assert.equal(manager.redoHistory(), true);
  assert.equal(state.elements[0].html, "plain <strong>text</strong>");
  assert.equal(state.elements[0].height, 64);
});

test("layout.lockToggle undo and redo restore lock state and layout geometry", () => {
  const { state, manager } = createHarness();
  state.elements.push({
    id: "b",
    x: 48,
    y: 220,
    width: 1104,
    height: 100,
    spacingBefore: "section",
    style: {},
  });

  manager.pushHistory("initial");
  state.layoutLocked = false;
  state.elements[0].y = 140;
  state.elements[1].y = 36;

  manager.commitMutation("layout.lockToggle", {
    beforeLocked: true,
    afterLocked: false,
    beforeLayout: [
      { id: "a", x: 48, y: 36, width: 1104, height: 120, spacingBefore: "normal" },
      { id: "b", x: 48, y: 220, width: 1104, height: 100, spacingBefore: "section" },
    ],
    afterLayout: [
      { id: "b", x: 48, y: 36, width: 1104, height: 100, spacingBefore: "section" },
      { id: "a", x: 48, y: 140, width: 1104, height: 120, spacingBefore: "normal" },
    ],
  });

  assert.equal(manager.undoHistory(), true);
  assert.equal(state.layoutLocked, true);
  assert.deepEqual(state.elements.map((item) => item.id), ["a", "b"]);
  assert.equal(state.elements[0].y, 36);

  assert.equal(manager.redoHistory(), true);
  assert.equal(state.layoutLocked, false);
  assert.deepEqual(state.elements.map((item) => item.id), ["b", "a"]);
  assert.equal(state.elements[0].y, 36);
});

import test from "node:test";
import assert from "node:assert/strict";

import { contactSheetGrid } from "../js/contact-sheet.js";

test("contact sheet grid adapts from two to twelve photos", () => {
  assert.deepEqual(contactSheetGrid(2), { columns: 2, rows: 1 });
  assert.deepEqual(contactSheetGrid(4), { columns: 2, rows: 2 });
  assert.deepEqual(contactSheetGrid(6), { columns: 3, rows: 2 });
  assert.deepEqual(contactSheetGrid(9), { columns: 3, rows: 3 });
  assert.deepEqual(contactSheetGrid(12), { columns: 4, rows: 3 });
  assert.throws(() => contactSheetGrid(1), /2–12/);
  assert.throws(() => contactSheetGrid(13), /2–12/);
});

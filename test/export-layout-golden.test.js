import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { imageExportLayout } from "../js/export-layout.js";

test("image export geometry matches the reviewed frame golden", async () => {
  const expected = JSON.parse(await readFile(new URL("./fixtures/export-image-layout.golden.json", import.meta.url), "utf8"));
  const actual = ["none", "polaroid", "card"].map((frame, index) => ({
    name: index === 0 ? "plain" : frame,
    layout: imageExportLayout({
      x: 48,
      y: 100,
      width: 1104,
      height: 736,
      style: { frame },
    }),
  }));
  assert.deepEqual(actual, expected);
});

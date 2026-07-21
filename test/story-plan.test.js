import test from "node:test";
import assert from "node:assert/strict";

import { executeDocumentCommand } from "../js/document-commands.js";
import { compileStoryPlanBatch, normalizeStoryPlan } from "../js/story-plan.js";

const photoIds = ["p1", "p2", "p3", "p4", "p5", "p6"];

test("story plans deduplicate photo ids and assign every photo once", () => {
  const plan = normalizeStoryPlan({
    title: "Kyoto",
    dek: "Six quiet moments.",
    sections: [
      { heading: "Morning", body: "Temple paths.", photoIds: ["p1", "p1", "bad"] },
      { heading: "Evening", body: "Lantern light.", photoIds: ["p2"] },
    ],
  }, photoIds);

  assert.deepEqual(plan.sections.flatMap((section) => section.photoIds).sort(), photoIds);
});

test("compiled AI story is one invertible document batch", () => {
  let seq = 0;
  const existing = [{ id: "old", type: "text", content: "Old", style: {} }];
  const images = photoIds.map((id) => ({ id, type: "image", src: `/${id}.jpg`, style: {} }));
  const result = compileStoryPlanBatch({
    existingBlocks: existing,
    imageBlocks: images,
    meta: "[July 26]",
    createBlock: (type, patch) => ({ id: `new-${++seq}`, type, style: {}, ...patch }),
    plan: {
      title: "Kyoto in Six Frames",
      dek: "A quiet walk.",
      sections: [
        { heading: "First light", body: "The city wakes slowly.", photoIds: ["p1", "p2", "p3"] },
        { heading: "After rain", body: "Stone and leaves hold the weather.", photoIds: ["p4", "p5", "p6"] },
      ],
    },
  });

  const applied = executeDocumentCommand(existing, result.command);
  assert.equal(applied.blocks.filter((block) => block.type === "image").length, 6);
  assert.equal(applied.inverse.type, "document.batch");
  assert.deepEqual(executeDocumentCommand(applied.blocks, applied.inverse).blocks, existing);
});

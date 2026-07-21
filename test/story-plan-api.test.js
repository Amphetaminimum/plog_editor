import test from "node:test";
import assert from "node:assert/strict";

import { handleStoryPlanRequest } from "../worker/story-plan.js";

const validRequest = (photoCount = 6) => new Request("https://plog.test/api/story-plan", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    contactSheet: `data:image/jpeg;base64,${Buffer.from("demo").toString("base64")}`,
    photoIds: Array.from({ length: photoCount }, (_, index) => `p${index + 1}`),
    tripNotes: "Kyoto after rain",
    voiceSample: "Quiet and observant",
  }),
});

test("story plan API accepts up to twelve photos and rejects larger batches", async () => {
  let upstreamBody;
  const accepted = await handleStoryPlanRequest(validRequest(12), { OPENAI_API_KEY: "test-key" }, async (_url, options) => {
    upstreamBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      model: "gpt-5.6-terra",
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({
        title: "Twelve frames",
        dek: "A longer walk.",
        sections: [
          { heading: "Start", body: "First.", photoIds: ["p1", "p2", "p3", "p4", "p5", "p6"] },
          { heading: "End", body: "Second.", photoIds: ["p7", "p8", "p9", "p10", "p11", "p12"] },
        ],
      }) }] }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  });
  assert.equal(accepted.status, 200);
  assert.match(upstreamBody.input[0].content[0].text, /exactly 3 coherent chapters/);

  const rejected = await handleStoryPlanRequest(validRequest(13), { OPENAI_API_KEY: "test-key" }, async () => {
    throw new Error("invalid requests must not reach OpenAI");
  });
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).error, /2–12/);
});

test("story plan API keeps missing server credentials explicit", async () => {
  const response = await handleStoryPlanRequest(validRequest(), {});
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not configured/i);
});

test("story plan API sends one low-detail contact sheet and returns structured output", async () => {
  let upstreamBody;
  const fakeFetch = async (_url, options) => {
    upstreamBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      model: "gpt-5.6-terra",
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({
        title: "Kyoto after rain",
        dek: "Six frames from a slow afternoon.",
        sections: [
          { heading: "Stone", body: "The paths held the rain.", photoIds: ["p1", "p2", "p3"] },
          { heading: "Light", body: "Evening arrived softly.", photoIds: ["p4", "p5", "p6"] },
        ],
      }) }] }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const response = await handleStoryPlanRequest(validRequest(), { OPENAI_API_KEY: "test-key" }, fakeFetch);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).plan.sections.length, 2);
  assert.equal(upstreamBody.model, "gpt-5.6-terra");
  assert.equal(upstreamBody.input[0].content[1].detail, "low");
  assert.equal(upstreamBody.text.format.type, "json_schema");
});

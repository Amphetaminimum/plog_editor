import test from "node:test";
import assert from "node:assert/strict";

import { handleStoryPlanRequest } from "../worker/story-plan.js";

const validRequest = () => new Request("https://plog.test/api/story-plan", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    contactSheet: `data:image/jpeg;base64,${Buffer.from("demo").toString("base64")}`,
    photoIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
    tripNotes: "Kyoto after rain",
    voiceSample: "Quiet and observant",
  }),
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

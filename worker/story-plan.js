const MAX_REQUEST_BYTES = 1_900_000;
const MAX_REQUESTS_PER_HOUR = 8;
const requestsByClient = new Map();

export const STORY_PLAN_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "dek", "sections"],
  properties: {
    title: { type: "string", maxLength: 100 },
    dek: { type: "string", maxLength: 320 },
    sections: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "body", "photoIds"],
        properties: {
          heading: { type: "string", maxLength: 80 },
          body: { type: "string", maxLength: 700 },
          photoIds: { type: "array", items: { type: "string" }, maxItems: 6 },
        },
      },
    },
  },
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function requestClientId(request) {
  return request.headers.get("cf-connecting-ip") || "local";
}

async function safetyIdentifier(request) {
  const bytes = new TextEncoder().encode(`plog:${requestClientId(request)}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const shortHash = [...new Uint8Array(digest)].slice(0, 12).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `plog_${shortHash}`;
}

function withinRateLimit(request, now = Date.now()) {
  const client = requestClientId(request);
  const active = (requestsByClient.get(client) || []).filter((time) => now - time < 3_600_000);
  if (active.length >= MAX_REQUESTS_PER_HOUR) return false;
  active.push(now);
  requestsByClient.set(client, active);
  return true;
}

function outputText(response) {
  for (const item of response?.output || []) {
    if (item?.type !== "message") continue;
    for (const content of item.content || []) {
      if (content?.type === "refusal") throw new Error(content.refusal || "The model refused this draft.");
      if (content?.type === "output_text" && content.text) return content.text;
    }
  }
  throw new Error("The model returned no story plan.");
}

function validBody(body) {
  return body
    && Array.isArray(body.photoIds)
    && body.photoIds.length === 6
    && new Set(body.photoIds.map(String)).size === 6
    && /^data:image\/jpeg;base64,/i.test(String(body.contactSheet || ""))
    && String(body.tripNotes || "").length <= 2_000
    && String(body.voiceSample || "").length <= 2_000;
}

export async function handleStoryPlanRequest(request, env, fetchImpl = fetch) {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) return jsonResponse({ error: "Contact sheet is too large." }, 413);
  if (request.headers.get("sec-fetch-site") === "cross-site") return jsonResponse({ error: "Cross-site requests are not allowed." }, 403);
  if (!env.OPENAI_API_KEY) return jsonResponse({ error: "AI drafting is not configured on this deployment." }, 503);
  if (!withinRateLimit(request)) return jsonResponse({ error: "Demo limit reached. Try again later." }, 429);

  let body;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return jsonResponse({ error: "Contact sheet is too large." }, 413);
    }
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid JSON request." }, 400);
  }
  if (!validBody(body)) return jsonResponse({ error: "Provide one JPEG contact sheet for exactly six unique photos." }, 400);

  const photoIds = body.photoIds.map(String);
  const notes = String(body.tripNotes || "").trim() || "No trip notes were provided. Infer only visible atmosphere; do not invent factual events.";
  const voice = String(body.voiceSample || "").trim() || "Use concise first-person travel-journal prose. Avoid clichés and unsupported facts.";
  const prompt = [
    "Create an editable travel-story plan from this labeled six-photo contact sheet.",
    `Allowed photo IDs: ${photoIds.join(", ")}. Use each ID exactly once and no other IDs.`,
    "Group the photos into 2-4 coherent chapters. Keep claims grounded in the notes or visible evidence.",
    "Write a specific, restrained first-person draft; avoid generic travel-blog filler.",
    `Trip notes: ${notes}`,
    `Voice sample or direction: ${voice}`,
  ].join("\n\n");

  try {
    const upstream = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6-terra",
        store: false,
        max_output_tokens: 1_600,
        reasoning: { effort: "low" },
        safety_identifier: await safetyIdentifier(request),
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: body.contactSheet, detail: "low" },
          ],
        }],
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "plog_story_plan",
            strict: true,
            schema: STORY_PLAN_RESPONSE_SCHEMA,
          },
        },
      }),
    });
    const response = await upstream.json();
    if (!upstream.ok) {
      console.error("OpenAI story plan request failed", upstream.status, response?.error?.code || "unknown");
      return jsonResponse({ error: "The AI draft could not be generated. Try again." }, upstream.status === 429 ? 429 : 502);
    }
    return jsonResponse({ plan: JSON.parse(outputText(response)), model: response.model || "gpt-5.6-terra" });
  } catch (error) {
    console.error("AI story plan error", error instanceof Error ? error.message : "unknown");
    return jsonResponse({ error: "The AI draft could not be generated. Try again." }, 502);
  }
}

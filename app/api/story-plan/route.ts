import { handleStoryPlanRequest } from "../../../worker/story-plan.js";

export const runtime = "edge";

export async function POST(request: Request): Promise<Response> {
  return handleStoryPlanRequest(request, {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  });
}

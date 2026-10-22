import { z } from "zod";
import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { errorResponse, parseBody } from "@/lib/http";
import { addRule } from "@/lib/pipeline";

const bodySchema = z.object({ text: z.string().trim().min(1).max(400) });

export async function GET() {
  try {
    return Response.json({ rules: getRepo().listRules(DEFAULT_PROJECT_ID) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, bodySchema);
    const result = addRule(DEFAULT_PROJECT_ID, body.text);
    return Response.json({
      ...result,
      data: getRepo().getProjectData(DEFAULT_PROJECT_ID),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

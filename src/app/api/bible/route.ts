import { buildBible } from "@/lib/pipeline";
import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { errorResponse } from "@/lib/http";

export async function POST() {
  try {
    const bible = await buildBible(DEFAULT_PROJECT_ID);
    return Response.json({ bible, ...getRepo().getProjectData(DEFAULT_PROJECT_ID) });
  } catch (error) {
    return errorResponse(error);
  }
}

import { buildBible, startBibleJob } from "@/lib/pipeline";
import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { errorResponse } from "@/lib/http";

export async function POST(request: Request) {
  try {
    let preserveScenes = true;
    let isAsync = true;
    try {
      const body = (await request.json()) as { preserveScenes?: boolean; async?: boolean } | null;
      if (typeof body?.preserveScenes === "boolean") {
        preserveScenes = body.preserveScenes;
      }
      if (typeof body?.async === "boolean") {
        isAsync = body.async;
      }
    } catch {
      // Body is optional
    }

    if (isAsync) {
      const job = startBibleJob(DEFAULT_PROJECT_ID, { preserveScenes });
      return Response.json({ job }, { status: 202 });
    }

    const bible = await buildBible(DEFAULT_PROJECT_ID, { preserveScenes });
    return Response.json({ bible, ...getRepo().getProjectData(DEFAULT_PROJECT_ID) });
  } catch (error) {
    return errorResponse(error);
  }
}

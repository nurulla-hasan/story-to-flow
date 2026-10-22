import { z } from "zod";
import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { errorResponse, parseBody } from "@/lib/http";
import { reassembleAll } from "@/lib/pipeline";
import { settingsPatchSchema } from "@/lib/types";

const projectPatchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  story: z.string().max(200_000).optional(),
  settings: settingsPatchSchema.optional(),
});

export async function GET() {
  try {
    return Response.json(getRepo().getProjectData(DEFAULT_PROJECT_ID));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await parseBody(request, projectPatchSchema);
    const repo = getRepo();
    repo.updateProject(DEFAULT_PROJECT_ID, body);
    let changedPrompts = 0;
    if (body.settings) changedPrompts = reassembleAll(DEFAULT_PROJECT_ID);
    return Response.json({
      ...repo.getProjectData(DEFAULT_PROJECT_ID),
      changedPrompts,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

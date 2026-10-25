import { z } from "zod";
import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { errorResponse, parseBody } from "@/lib/http";
import { reassembleAll } from "@/lib/pipeline";
import { syncStudioProjectPrompts } from "@/lib/studio-sync";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  visual_lock: z.string().trim().min(20).max(1200).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await parseBody(request, patchSchema);
    const repo = getRepo();
    if (!repo.getProjectData(DEFAULT_PROJECT_ID).locations.some((item) => item.id === id)) {
      return Response.json({ error: "Location not found" }, { status: 404 });
    }
    repo.updateLocation(DEFAULT_PROJECT_ID, id, body);
    const changedPrompts = reassembleAll(DEFAULT_PROJECT_ID);
    const studioPrompts = syncStudioProjectPrompts();
    return Response.json({
      changedPrompts,
      studioPrompts,
      data: repo.getProjectData(DEFAULT_PROJECT_ID),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

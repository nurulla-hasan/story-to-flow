import { z } from "zod";
import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { errorResponse, parseBody } from "@/lib/http";
import { reassembleAll } from "@/lib/pipeline";
import { syncStudioProjectPrompts } from "@/lib/studio-sync";
import { languageSchema } from "@/lib/types";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  visual_lock: z.string().trim().min(20).max(1200).optional(),
  voice_lock: z.string().trim().min(10).max(600).optional(),
  language: languageSchema.optional(),
  outfit_changes: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await parseBody(request, patchSchema);
    const repo = getRepo();
    if (!repo.getCharacters(DEFAULT_PROJECT_ID).some((item) => item.id === id)) {
      return Response.json({ error: "Character not found" }, { status: 404 });
    }
    repo.updateCharacter(DEFAULT_PROJECT_ID, id, body);
    const changedPrompts = reassembleAll(DEFAULT_PROJECT_ID);
    const studioPrompts = syncStudioProjectPrompts();
    return Response.json({
      character: repo.getCharacters(DEFAULT_PROJECT_ID).find((item) => item.id === id),
      changedPrompts,
      studioPrompts,
      data: repo.getProjectData(DEFAULT_PROJECT_ID),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const repo = getRepo();
    repo.deleteCharacter(DEFAULT_PROJECT_ID, id);
    const changedPrompts = reassembleAll(DEFAULT_PROJECT_ID);
    const studioPrompts = syncStudioProjectPrompts();
    return Response.json({ ok: true, changedPrompts, studioPrompts });
  } catch (error) {
    return errorResponse(error);
  }
}

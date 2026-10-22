import { z } from "zod";
import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { errorResponse, parseBody } from "@/lib/http";
import { sceneStatusSchema } from "@/lib/types";

const patchSchema = z.object({ status: sceneStatusSchema });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ n: string }> },
) {
  try {
    const { n } = await params;
    const sceneN = Number(n);
    if (!Number.isInteger(sceneN) || sceneN < 1) {
      return Response.json({ error: "Invalid scene number" }, { status: 400 });
    }
    const body = await parseBody(request, patchSchema);
    const repo = getRepo();
    const scene = repo.getScene(DEFAULT_PROJECT_ID, sceneN);
    if (!scene) return Response.json({ error: "Scene not found" }, { status: 404 });
    repo.updateScene(DEFAULT_PROJECT_ID, sceneN, { status: body.status });
    return Response.json({ scene: repo.getScene(DEFAULT_PROJECT_ID, sceneN) });
  } catch (error) {
    return errorResponse(error);
  }
}

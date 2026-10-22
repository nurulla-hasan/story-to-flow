import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { startFlowVideoGeneration } from "@/lib/flow";
import { errorResponse } from "@/lib/http";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ n: string }> },
) {
  try {
    const { n } = await params;
    const sceneN = Number(n);
    if (!Number.isInteger(sceneN) || sceneN < 1) {
      return Response.json({ error: "Invalid scene number" }, { status: 400 });
    }
    const repo = getRepo();
    const scene = repo.getScene(DEFAULT_PROJECT_ID, sceneN);
    if (!scene) {
      return Response.json({ error: "Scene not found" }, { status: 404 });
    }

    const job = await startFlowVideoGeneration(DEFAULT_PROJECT_ID, sceneN);
    return Response.json({ job }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}

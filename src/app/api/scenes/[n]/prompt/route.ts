import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { versionSceneNow } from "@/lib/pipeline";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ n: string }> },
) {
  try {
    const n = Number((await params).n);
    const repo = getRepo();
    const scene = repo.getScene(DEFAULT_PROJECT_ID, n);
    if (!scene) return Response.json({ error: "Scene not found" }, { status: 404 });
    return Response.json({
      prompt: scene.prompt,
      versions: repo.getPromptVersions(DEFAULT_PROJECT_ID, n),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ n: string }> },
) {
  try {
    const n = Number((await params).n);
    const result = await versionSceneNow(DEFAULT_PROJECT_ID, n);
    return Response.json({
      ...result,
      scene: getRepo().getScene(DEFAULT_PROJECT_ID, n),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

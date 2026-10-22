import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { validateAndVersionScene } from "@/lib/pipeline";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ n: string }> },
) {
  try {
    const n = Number((await params).n);
    const repo = getRepo();
    const settings = repo.getProject(DEFAULT_PROJECT_ID).settings;
    const rounds =
      settings.validatorStrictness === "off"
        ? 0
        : settings.validatorStrictness === "strict"
          ? 2
          : 1;
    const result = await validateAndVersionScene(DEFAULT_PROJECT_ID, n, rounds);
    return Response.json({
      ...result,
      scene: repo.getScene(DEFAULT_PROJECT_ID, n),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

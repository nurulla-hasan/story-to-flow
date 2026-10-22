import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { extForMime, fileToBuffer, saveAsset, stamp } from "@/lib/files";
import { AppError, errorResponse, readFileField } from "@/lib/http";

const MAX_BYTES = 30 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ n: string }> },
) {
  try {
    const n = Number((await params).n);
    const repo = getRepo();
    if (!repo.getScene(DEFAULT_PROJECT_ID, n)) {
      return Response.json({ error: "Scene not found" }, { status: 404 });
    }
    const file = await readFileField(request);
    if (file.size > MAX_BYTES) throw new AppError("Frame is larger than 30 MB.", 413);
    if (file.type && !file.type.startsWith("image/")) {
      throw new AppError(`Expected an image, got "${file.type}".`, 415);
    }
    const buffer = await fileToBuffer(file);
    const ext = file.type ? extForMime(file.type) : "png";
    const rel = saveAsset(
      DEFAULT_PROJECT_ID,
      "last-frames",
      `scene-${n}-${stamp()}.${ext}`,
      buffer,
    );
    repo.updateScene(DEFAULT_PROJECT_ID, n, { lastFramePath: rel });
    return Response.json({ scene: repo.getScene(DEFAULT_PROJECT_ID, n) });
  } catch (error) {
    return errorResponse(error);
  }
}

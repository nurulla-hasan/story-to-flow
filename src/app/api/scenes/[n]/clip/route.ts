import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { extForMime, fileToBuffer, saveAsset, stamp } from "@/lib/files";
import { AppError, errorResponse, readFileField } from "@/lib/http";

const MAX_BYTES = 300 * 1024 * 1024;

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
    if (file.size > MAX_BYTES) throw new AppError("Clip is larger than 300 MB.", 413);
    if (file.type && !file.type.startsWith("video/")) {
      throw new AppError(`Expected a video file, got "${file.type}".`, 415);
    }
    const buffer = await fileToBuffer(file);
    const ext = file.type ? extForMime(file.type) : "mp4";
    const rel = saveAsset(
      DEFAULT_PROJECT_ID,
      "clips",
      `scene-${n}-${stamp()}.${ext}`,
      buffer,
    );
    repo.updateScene(DEFAULT_PROJECT_ID, n, { clipPath: rel });
    return Response.json({ scene: repo.getScene(DEFAULT_PROJECT_ID, n) });
  } catch (error) {
    return errorResponse(error);
  }
}

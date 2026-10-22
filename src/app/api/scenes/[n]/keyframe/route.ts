import { assembleImagePrompt } from "@/lib/assemble";
import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { extForMime, fileToBuffer, saveAsset, stamp } from "@/lib/files";
import { AppError, errorResponse, readFileField } from "@/lib/http";
import { generateKeyframe } from "@/lib/pipeline";

const MAX_BYTES = 30 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ n: string }> },
) {
  try {
    const n = Number((await params).n);
    const repo = getRepo();
    const data = repo.getProjectData(DEFAULT_PROJECT_ID);
    const scene = data.scenes.find((item) => item.n === n);
    if (!scene) return Response.json({ error: "Scene not found" }, { status: 404 });

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const file = await readFileField(request);
      if (file.size > MAX_BYTES) throw new AppError("Image is larger than 30 MB.", 413);
      if (file.type && !file.type.startsWith("image/")) {
        throw new AppError(`Expected an image, got "${file.type}".`, 415);
      }
      const buffer = await fileToBuffer(file);
      const ext = file.type ? extForMime(file.type) : "png";
      const rel = saveAsset(
        DEFAULT_PROJECT_ID,
        "keyframes",
        `scene-${n}-${stamp()}.${ext}`,
        buffer,
      );
      repo.updateScene(DEFAULT_PROJECT_ID, n, { keyframePath: rel });
      return Response.json({ scene: repo.getScene(DEFAULT_PROJECT_ID, n) });
    }

    const result = await generateKeyframe(DEFAULT_PROJECT_ID, n);
    return Response.json({
      ...result,
      scene: repo.getScene(DEFAULT_PROJECT_ID, n),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ n: string }> },
) {
  try {
    const n = Number((await params).n);
    const data = getRepo().getProjectData(DEFAULT_PROJECT_ID);
    const scene = data.scenes.find((item) => item.n === n);
    if (!scene) return Response.json({ error: "Scene not found" }, { status: 404 });
    return Response.json({ imagePrompt: assembleImagePrompt(data, scene) });
  } catch (error) {
    return errorResponse(error);
  }
}

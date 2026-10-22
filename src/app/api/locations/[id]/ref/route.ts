import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { extForMime, fileToBuffer, saveAsset, stamp } from "@/lib/files";
import { AppError, errorResponse, readFileField } from "@/lib/http";

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const repo = getRepo();
    const data = repo.getProjectData(DEFAULT_PROJECT_ID);
    if (!data.locations.some((item) => item.id === id)) {
      return Response.json({ error: "Location not found" }, { status: 404 });
    }
    const file = await readFileField(request);
    if (file.size > MAX_BYTES) throw new AppError("Reference is larger than 20 MB.", 413);
    if (file.type && !file.type.startsWith("image/")) {
      throw new AppError(`Expected an image, got "${file.type}".`, 415);
    }
    const buffer = await fileToBuffer(file);
    const ext = file.type ? extForMime(file.type) : "png";
    const rel = saveAsset(
      DEFAULT_PROJECT_ID,
      "locations",
      `${id}-ref-${stamp()}.${ext}`,
      buffer,
    );
    repo.updateLocation(DEFAULT_PROJECT_ID, id, { refImage: rel });
    return Response.json({
      data: repo.getProjectData(DEFAULT_PROJECT_ID),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

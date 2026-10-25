import { errorResponse } from "@/lib/http";
import { extForMime, fileToBuffer, saveAsset, stamp } from "@/lib/files";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB per file

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files: File[] = [];

    // Collect all files from 'file', 'files', or any field that contains a File
    for (const [, value] of formData.entries()) {
      if (value instanceof File && value.size > 0) {
        files.push(value);
      }
    }

    if (!files.length) {
      return Response.json({ error: "No files provided in upload." }, { status: 400 });
    }

    const uploaded: {
      name: string;
      url: string;
      kind: "image" | "audio" | "video";
      index?: number;
    }[] = [];

    for (const file of files) {
      if (file.size > MAX_BYTES) continue;
      const isVideo =
        file.type?.startsWith("video/") ||
        /\.(mp4|webm|mov|m4v|ogg)$/i.test(file.name);
      const isAudio =
        file.type?.startsWith("audio/") ||
        /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name);
      const isImage =
        file.type?.startsWith("image/") ||
        /\.(png|jpe?g|webp|gif|avif)$/i.test(file.name);

      if (!isAudio && !isImage && !isVideo) continue;

      const kind = isVideo ? "video" : isAudio ? "audio" : "images";
      const buffer = await fileToBuffer(file);
      const ext = file.type
        ? extForMime(file.type)
        : isVideo
          ? "mp4"
          : isAudio
            ? "mp3"
            : "png";
      const baseName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .slice(0, 40);
      const filename = `${baseName}-${stamp()}.${ext}`;

      const rel = saveAsset("studio", kind, filename, buffer);
      const url = `/api/files/${rel}`;

      const numMatch = file.name
        .replace(/\.[^/.]+$/, "")
        .match(/(?:image|clip|scene|img|video|#)?[-_\s]*0*(\d+)/i);
      const index = numMatch ? parseInt(numMatch[1], 10) : undefined;

      uploaded.push({
        name: file.name,
        url,
        kind: isVideo ? "video" : isAudio ? "audio" : "image",
        index,
      });
    }

    return Response.json({ success: true, files: uploaded });
  } catch (error) {
    return errorResponse(error);
  }
}

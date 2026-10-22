import fs from "node:fs";
import { errorResponse } from "@/lib/http";
import { mimeForPath, resolveAsset } from "@/lib/files";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return serve(request, (await params).path, false);
}

export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return serve(request, (await params).path, true);
}

function serve(request: Request, parts: string[], headOnly: boolean): Response {
  try {
    const rel = parts.join("/");
    const full = resolveAsset(rel);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      return Response.json({ error: "File not found" }, { status: 404 });
    }
    const size = fs.statSync(full).size;
    const mime = mimeForPath(full);
    const headers = new Headers({
      "Content-Type": mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
      "Content-Disposition": `inline; filename="${rel.split("/").pop()}"`,
    });

    const range = request.headers.get("range");
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      if (match) {
        const start = match[1] ? Number(match[1]) : 0;
        let end = match[2] ? Number(match[2]) : size - 1;
        if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${size}` },
          });
        }
        end = Math.min(end, size - 1);
        const length = end - start + 1;
        headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
        headers.set("Content-Length", String(length));
        if (headOnly) return new Response(null, { status: 206, headers });
        const buffer = fs.readFileSync(full);
        return new Response(new Uint8Array(buffer.subarray(start, end + 1)), {
          status: 206,
          headers,
        });
      }
    }

    headers.set("Content-Length", String(size));
    if (headOnly) return new Response(null, { status: 200, headers });
    const buffer = fs.readFileSync(full);
    return new Response(new Uint8Array(buffer), { status: 200, headers });
  } catch (error) {
    return errorResponse(error);
  }
}

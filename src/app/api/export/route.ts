import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { buildPlanJson, buildPromptsTxt, buildZip } from "@/lib/export";
import { slugify } from "@/lib/types";

function makeContentDisposition(rawTitle: string, suffix: string, ext: string): string {
  const cleanTitle = rawTitle.trim() || "story-to-flow";
  const slug = slugify(cleanTitle).slice(0, 50);
  const asciiBase = slug.startsWith("id-") ? "story-to-flow" : slug || "story-to-flow";
  const asciiFilename = `${asciiBase}${suffix}.${ext}`;
  const utf8Filename = encodeURIComponent(`${cleanTitle}${suffix}.${ext}`);

  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const format = (url.searchParams.get("format") || "txt").toLowerCase();
    const data = getRepo().getProjectData(DEFAULT_PROJECT_ID);
    const title = data.project.name || "story-to-flow";

    if (format === "json") {
      return new Response(JSON.stringify(buildPlanJson(data), null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": makeContentDisposition(title, "-plan", "json"),
        },
      });
    }
    if (format === "zip") {
      const buffer = await buildZip(data);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": makeContentDisposition(title, "-production", "zip"),
          "Content-Length": String(buffer.length),
        },
      });
    }
    return new Response(buildPromptsTxt(data), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": makeContentDisposition(title, "-prompts", "txt"),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

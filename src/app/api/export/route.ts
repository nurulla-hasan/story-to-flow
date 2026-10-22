import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { buildPlanJson, buildPromptsTxt, buildZip } from "@/lib/export";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const format = (url.searchParams.get("format") || "txt").toLowerCase();
    const data = getRepo().getProjectData(DEFAULT_PROJECT_ID);
    const safeName =
      data.project.name.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 60) ||
      "story-to-flow";

    if (format === "json") {
      return new Response(JSON.stringify(buildPlanJson(data), null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeName}.json"`,
        },
      });
    }
    if (format === "zip") {
      const buffer = await buildZip(data);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${safeName}.zip"`,
          "Content-Length": String(buffer.length),
        },
      });
    }
    return new Response(buildPromptsTxt(data), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}-prompts.txt"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

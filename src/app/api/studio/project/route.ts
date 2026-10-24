import { errorResponse } from "@/lib/http";
import { loadStudioProject, saveStudioProject, clearStudioProject } from "@/lib/studio";

export async function GET() {
  try {
    const project = loadStudioProject();
    return Response.json({ success: true, project });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    if (!json || typeof json !== "object") {
      return Response.json({ error: "Invalid project payload" }, { status: 400 });
    }
    saveStudioProject(json);
    return Response.json({ success: true, project: json });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    clearStudioProject();
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

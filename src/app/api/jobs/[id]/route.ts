import { getRepo } from "@/lib/db";
import { cancelJob } from "@/lib/pipeline";
import { errorResponse } from "@/lib/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const job = getRepo().getJob(id);
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
    return Response.json({ job });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const job = cancelJob(id);
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
    return Response.json({ job });
  } catch (error) {
    return errorResponse(error);
  }
}

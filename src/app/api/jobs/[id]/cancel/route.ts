import { cancelJob } from "@/lib/pipeline";
import { errorResponse } from "@/lib/http";

export async function POST(
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

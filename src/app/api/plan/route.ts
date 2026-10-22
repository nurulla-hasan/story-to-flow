import { startPlanJob, startFullPlanJob } from "@/lib/pipeline";
import { errorResponse } from "@/lib/http";

export async function POST(request: Request) {
  try {
    let full = false;
    try {
      const body = (await request.json()) as { full?: boolean } | null;
      if (body?.full) full = true;
    } catch {
      // Body is optional
    }

    const job = full ? startFullPlanJob() : startPlanJob();
    return Response.json({ job }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}

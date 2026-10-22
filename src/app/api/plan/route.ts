import { startPlanJob } from "@/lib/pipeline";
import { errorResponse } from "@/lib/http";

export async function POST() {
  try {
    const job = startPlanJob();
    return Response.json({ job }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}

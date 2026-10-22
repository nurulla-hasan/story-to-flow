import { getFlowStatus } from "@/lib/flow";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    const status = await getFlowStatus();
    return Response.json({ status });
  } catch (error) {
    return errorResponse(error);
  }
}

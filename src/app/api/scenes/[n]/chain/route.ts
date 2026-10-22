import { DEFAULT_PROJECT_ID } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { chainToNext } from "@/lib/pipeline";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ n: string }> },
) {
  try {
    const n = Number((await params).n);
    const next = chainToNext(DEFAULT_PROJECT_ID, n);
    return Response.json({ scene: next });
  } catch (error) {
    return errorResponse(error);
  }
}

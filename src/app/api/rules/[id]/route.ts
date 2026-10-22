import { DEFAULT_PROJECT_ID } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { removeRule } from "@/lib/pipeline";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = Number((await params).id);
    if (!Number.isInteger(id)) {
      return Response.json({ error: "Invalid rule id" }, { status: 400 });
    }
    const result = removeRule(DEFAULT_PROJECT_ID, id);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}

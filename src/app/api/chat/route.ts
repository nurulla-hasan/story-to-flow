import { z } from "zod";
import { chatOpsSchema } from "@/lib/types";
import { applyChatOps, planChat } from "@/lib/chat";
import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { errorResponse, parseBody } from "@/lib/http";

const planSchema = z.object({ message: z.string().trim().min(1).max(4000) });
const applySchema = z.object({ ops: chatOpsSchema.shape.ops });

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, planSchema);
    const result = await planChat(DEFAULT_PROJECT_ID, body.message);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await parseBody(request, applySchema);
    const parsedOps = chatOpsSchema.shape.ops.parse(body.ops);
    const result = applyChatOps(DEFAULT_PROJECT_ID, parsedOps);
    return Response.json({
      ...result,
      data: getRepo().getProjectData(DEFAULT_PROJECT_ID),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

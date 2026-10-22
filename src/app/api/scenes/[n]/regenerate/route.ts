import { z } from "zod";
import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { errorResponse, parseBody } from "@/lib/http";
import { reviewScene } from "@/lib/review";

const bodySchema = z.object({
  problems: z
    .array(
      z.enum([
        "face_changed",
        "dress_changed",
        "location_changed",
        "voice_changed",
        "continuity_broken",
      ]),
    )
    .default([]),
  note: z.string().max(1000).default(""),
  apply: z.boolean().default(false),
  reinforcements: z.array(z.string().min(1).max(400)).max(8).optional(),
  customRule: z.string().max(400).nullable().optional(),
  saveRule: z.boolean().default(false),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ n: string }> },
) {
  try {
    const n = Number((await params).n);
    const body = await parseBody(request, bodySchema);
    const result = await reviewScene(DEFAULT_PROJECT_ID, n, body);
    return Response.json({
      ...result,
      scene: getRepo().getScene(DEFAULT_PROJECT_ID, n),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

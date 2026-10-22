import { getRepo } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    const env = getEnv();
    return Response.json({
      ok: true,
      storage: getRepo().kind,
      baseUrl: env.baseUrl,
      hasApiKey: Boolean(env.apiKey),
      models: env.models,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

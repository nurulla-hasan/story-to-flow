import { getEnv } from "@/lib/env";
import { errorResponse } from "@/lib/http";

export interface GatewayModel {
  id: string;
  owned_by?: string;
  context_length?: number;
  capabilities?: Record<string, boolean>;
}

export async function GET() {
  try {
    const env = getEnv();
    const candidateUrls = [
      `${env.baseUrl}/models`,
      `${env.baseUrl.replace(/\/v1$/, "")}/api/v1/models`,
      `${env.baseUrl.replace(/\/v1$/, "")}/api/v1`,
    ];

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (env.apiKey) {
      headers.Authorization = `Bearer ${env.apiKey}`;
    }

    let rawData: unknown = null;
    let fetchedFrom = "";

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
          const json = await res.json();
          if (json && (Array.isArray(json.data) || Array.isArray(json))) {
            rawData = json;
            fetchedFrom = url;
            break;
          }
        }
      } catch {
        // try next candidate url
      }
    }

    let models: GatewayModel[] = [];
    if (rawData && typeof rawData === "object") {
      const list = Array.isArray((rawData as { data?: unknown[] }).data)
        ? (rawData as { data: GatewayModel[] }).data
        : Array.isArray(rawData)
          ? (rawData as GatewayModel[])
          : [];

      models = list
        .filter((item) => Boolean(item && item.id))
        .map((item) => ({
          id: item.id,
          owned_by: item.owned_by,
          context_length: item.context_length,
          capabilities: item.capabilities,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
    }

    return Response.json({
      models,
      defaults: env.models,
      baseUrl: env.baseUrl,
      sourceUrl: fetchedFrom,
      count: models.length,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

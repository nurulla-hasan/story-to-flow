import { NextResponse } from "next/server";
import { getEnv, DEFAULT_MODEL } from "@/lib/env";

export interface ModelOption {
  id: string;
  name: string;
  ownedBy?: string;
  contextLength?: number;
  description?: string;
}

export interface ModelsApiResponse {
  models: ModelOption[];
  defaultModel: string;
  count: number;
  source: "gateway" | "fallback";
  warning?: string;
}

/**
 * GET /api/models
 * Securely retrieves available models from the configured OpenAI-compatible gateway.
 * Never exposes AI_API_KEY or raw secrets to the browser.
 */
export async function GET() {
  try {
    const env = getEnv();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (env.apiKey) {
      headers.Authorization = `Bearer ${env.apiKey}`;
    }

    // Try standard OpenAI /models endpoint on baseUrl (e.g., http://.../v1/models)
    let modelsRes: Response | null = null;
    let primaryError: string | null = null;

    const candidateUrls = [
      `${env.baseUrl}/models`,
      `${env.baseUrl.replace(/\/v1$/, "")}/models`,
    ];

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(10_000),
          cache: "no-store",
        });

        if (res.ok) {
          modelsRes = res;
          break;
        } else if (!primaryError) {
          primaryError = `Gateway returned HTTP ${res.status} for ${url}`;
        }
      } catch (fetchErr) {
        if (!primaryError) {
          primaryError =
            fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        }
      }
    }

    if (!modelsRes || !modelsRes.ok) {
      // Gateway model listing failed, return default model fallback with warning
      return NextResponse.json<ModelsApiResponse>(
        {
          models: [
            {
              id: DEFAULT_MODEL,
              name: "Gemini 3.8 Flash (High)",
              ownedBy: "antigravity",
              description: "Configured Default Model",
            },
          ],
          defaultModel: DEFAULT_MODEL,
          count: 1,
          source: "fallback",
          warning:
            primaryError ||
            "Could not fetch models from AI gateway. Using configured default.",
        },
        { status: 200 }
      );
    }

    const data = await modelsRes.json();
    const rawList = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.models)
        ? data.models
        : [];

    const modelsMap = new Map<string, ModelOption>();

    // Always include DEFAULT_MODEL as guaranteed option
    modelsMap.set(DEFAULT_MODEL, {
      id: DEFAULT_MODEL,
      name: "Gemini 3.8 Flash (High)",
      ownedBy: "antigravity",
      description: "Default Model",
    });

    for (const item of rawList) {
      const id = typeof item === "string" ? item : item?.id;
      if (!id || typeof id !== "string") continue;

      const rawName = item?.name || id;
      const ownedBy = item?.owned_by || (id.includes("/") ? id.split("/")[0] : undefined);
      const contextLength = item?.context_length;

      modelsMap.set(id, {
        id,
        name: rawName,
        ownedBy,
        contextLength,
      });
    }

    const models = Array.from(modelsMap.values()).sort((a, b) => {
      // Keep DEFAULT_MODEL at the top
      if (a.id === DEFAULT_MODEL) return -1;
      if (b.id === DEFAULT_MODEL) return 1;
      return a.id.localeCompare(b.id);
    });

    return NextResponse.json<ModelsApiResponse>(
      {
        models,
        defaultModel: DEFAULT_MODEL,
        count: models.length,
        source: "gateway",
      },
      { status: 200 }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Even if an unexpected error occurs, preserve the configured default model as fallback
    return NextResponse.json<ModelsApiResponse>(
      {
        models: [
          {
            id: DEFAULT_MODEL,
            name: "Gemini 3.8 Flash (High)",
            ownedBy: "antigravity",
            description: "Configured Default Model",
          },
        ],
        defaultModel: DEFAULT_MODEL,
        count: 1,
        source: "fallback",
        warning: `Error loading models: ${errorMsg}. Preserving configured default.`,
      },
      { status: 200 }
    );
  }
}

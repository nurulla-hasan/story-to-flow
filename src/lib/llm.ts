
import { getEnv } from "./env";

export type LlmRole = "planner" | "validator" | "image"; // Kept for compatibility, but models will be selected explicitly

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  content: string;
  model: string;
}

export class LlmError extends Error {
  code:
    | "unauthorized"
    | "not_found"
    | "network"
    | "rate_limit"
    | "server"
    | "invalid_json"
    | "bad_request"
    | "unknown";
  status?: number;
  model?: string;
  detail?: string;

  constructor(
    message: string,
    code: LlmError["code"],
    opts: { status?: number; model?: string; detail?: string } = {},
  ) {
    super(message);
    this.name = "LlmError";
    this.code = code;
    this.status = opts.status;
    this.model = opts.model;
    this.detail = opts.detail;
  }
}

export function friendlyLlmError(error: unknown): {
  message: string;
  code: string;
} {
  if (error instanceof LlmError) {
    return { message: error.message, code: error.code };
  }
  if (error instanceof Error) {
    return { message: error.message, code: "unknown" };
  }
  return { message: String(error), code: "unknown" };
}



function friendlyFetchFailure(baseUrl: string, error: unknown): LlmError {
  const msg = error instanceof Error ? error.message : String(error);
  return new LlmError(
    `Could not reach AI provider at ${baseUrl}. Is it running or reachable? (${msg})`,
    "network",
    { detail: msg },
  );
}

async function requestOnce(
  model: string,
  messages: ChatMessage[],
  options: {
    json: boolean;
    temperature: number;
    responseFormat: boolean;
    timeoutMs: number;
    signal?: AbortSignal;
  },
): Promise<{ raw: string; model: string }> {
  if (options.signal?.aborted) {
    throw new LlmError("Request was cancelled", "unknown");
  }

  const env = getEnv();
  const url = `${env.baseUrl}/chat/completions`;
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature,
    stream: false,
  };
  if (options.json && options.responseFormat) {
    body.response_format = { type: "json_object" };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (env.apiKey) headers.Authorization = `Bearer ${env.apiKey}`;

  const timeoutSignal = AbortSignal.timeout(options.timeoutMs);
  const effectiveSignal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: effectiveSignal,
    });
  } catch (error) {
    if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new LlmError("Request was cancelled", "unknown");
    }
    throw friendlyFetchFailure(env.baseUrl, error);
  }

  const text = await res.text();

  // Some gateways reject response_format even though they accept chat
  // completions. Drop it and try once more before treating this as fatal.
  if (
    options.json &&
    options.responseFormat &&
    (res.status === 400 || res.status === 422) &&
    /response_format/i.test(text)
  ) {
    return requestOnce(model, messages, {
      ...options,
      responseFormat: false,
    });
  }

  if (!res.ok) {
    const detail = text.slice(0, 1200);
    if (res.status === 401 || res.status === 403) {
      throw new LlmError(
        "AI provider rejected the API key (401/403). Check your API key in .env.local.",
        "unauthorized",
        { status: res.status, model, detail },
      );
    }
    if (res.status === 404) {
      throw new LlmError(
        `AI provider returned 404 for model "${model}". Check the model name and BASE_URL in .env.local.`,
        "not_found",
        { status: res.status, model, detail },
      );
    }
    if (res.status === 429) {
      throw new LlmError(
        `AI provider rate-limited model "${model}" (429).`,
        "rate_limit",
        { status: res.status, model, detail },
      );
    }
    if (res.status === 400) {
      throw new LlmError(
        `AI provider rejected the request for model "${model}" (400): ${detail.slice(0, 300)}`,
        "bad_request",
        { status: res.status, model, detail },
      );
    }
    if (res.status >= 500) {
      throw new LlmError(
        `AI provider failed for model "${model}" (${res.status}).`,
        "server",
        { status: res.status, model, detail },
      );
    }
    throw new LlmError(
      `AI provider error ${res.status} for model "${model}": ${detail.slice(0, 300)}`,
      "unknown",
      { status: res.status, model, detail },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new LlmError(
      `AI provider returned non-JSON for model "${model}".`,
      "invalid_json",
      { model, detail: text.slice(0, 500) },
    );
  }

  const content = extractContent(payload);
  if (content === null) {
    throw new LlmError(
      `AI provider response for model "${model}" had no message content. Raw shape: ${text.slice(0, 400)}`,
      "invalid_json",
      { model, detail: text.slice(0, 1000) },
    );
  }
  return { raw: content, model };
}

function extractContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: unknown[] }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0] as {
    message?: { content?: unknown; reasoning_content?: unknown };
    text?: unknown;
  };
  const content = first?.message?.content ?? first?.text;
  if (typeof content === "string") return content;
  // Some gateways return content as parts; join text parts.
  if (Array.isArray(content)) {
    const parts = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const p = part as { text?: unknown; type?: unknown };
          if (typeof p.text === "string") return p.text;
        }
        return "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join("\n");
  }
  return null;
}

import { DEFAULT_MODEL } from "./env";

/**
 * Legacy chat function for backward compatibility.
 * Uses role-based model selection (planner role uses DEFAULT_MODEL).
 */
export async function chat(opts: {
  role: LlmRole;
  messages: ChatMessage[];
  temperature?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<ChatResult> {
  if (opts.signal?.aborted) {
    throw new LlmError("Request was cancelled", "unknown");
  }
  
  // For now, use DEFAULT_MODEL for all roles
  // Future: implement role-based defaults if needed
  const model = DEFAULT_MODEL;
  
  try {
    const result = await requestOnce(model, opts.messages, {
      json: false,
      temperature: opts.temperature ?? 0.2,
      responseFormat: false,
      timeoutMs: opts.timeoutMs ?? 180_000,
      signal: opts.signal,
    });
    return { content: result.raw, model: result.model };
  } catch (error) {
    if (opts.signal?.aborted) throw error;
    throw error instanceof Error
      ? error
      : new LlmError("LLM request failed", "unknown");
  }
}

/**
 * New chat function with explicit model selection.
 * Model ID should be validated against available models before calling.
 */
export async function chatWithModel(opts: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<ChatResult> {
  if (opts.signal?.aborted) {
    throw new LlmError("Request was cancelled", "unknown");
  }
  
  try {
    const result = await requestOnce(opts.model, opts.messages, {
      json: false,
      temperature: opts.temperature ?? 0.2,
      responseFormat: false,
      timeoutMs: opts.timeoutMs ?? 180_000,
      signal: opts.signal,
    });
    return { content: result.raw, model: result.model };
  } catch (error) {
    if (opts.signal?.aborted) throw error;
    throw error instanceof Error
      ? error
      : new LlmError("LLM request failed", "unknown");
  }
}

// Export a simple test function for connectivity testing
export async function testLlmConnectivity(): Promise<{
  modelsAvailable: boolean;
  chatWorks: boolean;
  modelList?: string[];
  testResponse?: string;
  error?: string;
}> {
  try {
    const env = getEnv();
    
    // 1. Test model listing endpoint
    // Remove /v1 suffix for models endpoint
    const modelsUrl = env.baseUrl.replace(/\/v1$/, "") + "/models";
    let modelList: string[] = [];
    let modelsAvailable = false;
    
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (env.apiKey) headers.Authorization = `Bearer ${env.apiKey}`;
      
      const modelsRes = await fetch(modelsUrl, {
        headers,
        signal: AbortSignal.timeout(10000),
      });
      
      if (modelsRes.ok) {
        const data = await modelsRes.json();
        // Extract model IDs from OpenAI-compatible response
        if (data && Array.isArray(data.data)) {
          modelList = data.data.map((m: { id?: string }) => m.id).filter(Boolean) as string[];
          modelsAvailable = modelList.length > 0;
        }
      }
    } catch (err) {
      // Model listing may fail on some gateways, that's OK
      console.warn("Model listing endpoint not available or failed:", err instanceof Error ? err.message : String(err));
    }
    
    // 2. Test chat completion with the default model
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: "You are a helpful assistant. Respond briefly and concisely.",
      },
      {
        role: "user", 
        content: "Say 'Hello from Story to Flow LLM test' and nothing else.",
      },
    ];
    
    const result = await chatWithModel({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.1,
      timeoutMs: 30000,
    });
    
    return {
      modelsAvailable,
      chatWorks: true,
      modelList,
      testResponse: result.content,
    };
    
  } catch (error) {
    return {
      modelsAvailable: false,
      chatWorks: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
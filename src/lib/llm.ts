import type { z } from "zod";
import { getEnv } from "./env";

export type LlmRole = "planner" | "validator" | "image";
export type LlmModels = { planner?: string; validator?: string; image?: string };

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

function resolveModel(role: LlmRole, models?: LlmModels): string {
  const env = getEnv();
  const override =
    role === "planner"
      ? models?.planner
      : role === "validator"
        ? models?.validator
        : models?.image;
  return (override && override.trim()) || env.models[role];
}

function fallbackModel(): string {
  return getEnv().models.fallback;
}

function friendlyFetchFailure(baseUrl: string, error: unknown): LlmError {
  const msg = error instanceof Error ? error.message : String(error);
  return new LlmError(
    `Could not reach OmniRoute at ${baseUrl}. Is it running? (${msg})`,
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
  },
): Promise<{ raw: string; model: string }> {
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

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
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
        "OmniRoute rejected the API key. Check OMNIROUTE_API_KEY in .env.local.",
        "unauthorized",
        { status: res.status, model, detail },
      );
    }
    if (res.status === 404) {
      throw new LlmError(
        `OmniRoute returned 404 for model "${model}". Check the model id and that OMNIROUTE_BASE_URL ends in /v1 exactly once.`,
        "not_found",
        { status: res.status, model, detail },
      );
    }
    if (res.status === 429) {
      throw new LlmError(
        `OmniRoute rate-limited model "${model}" (429).`,
        "rate_limit",
        { status: res.status, model, detail },
      );
    }
    if (res.status === 400) {
      throw new LlmError(
        `OmniRoute rejected the request for model "${model}" (400): ${detail.slice(0, 300)}`,
        "bad_request",
        { status: res.status, model, detail },
      );
    }
    if (res.status >= 500) {
      throw new LlmError(
        `OmniRoute failed for model "${model}" (${res.status}).`,
        "server",
        { status: res.status, model, detail },
      );
    }
    throw new LlmError(
      `OmniRoute error ${res.status} for model "${model}": ${detail.slice(0, 300)}`,
      "unknown",
      { status: res.status, model, detail },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new LlmError(
      `OmniRoute returned non-JSON for model "${model}".`,
      "invalid_json",
      { model, detail: text.slice(0, 500) },
    );
  }

  const content = extractContent(payload);
  if (content === null) {
    throw new LlmError(
      `OmniRoute response for model "${model}" had no message content. Raw shape: ${text.slice(0, 400)}`,
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

function isRetryable(error: LlmError): boolean {
  return (
    error.code === "network" ||
    error.code === "server" ||
    error.code === "rate_limit"
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function stripJsonFences(text: string): string {
  let out = text.trim();
  const fence = out.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence) out = fence[1].trim();
  return out;
}

export function tryParseJson(text: string): unknown | undefined {
  const cleaned = stripJsonFences(text);
  const candidates = [cleaned];
  const firstBrace = cleaned.search(/[{[]/);
  const lastBrace = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next candidate
    }
  }
  return undefined;
}

function zodErrors(schema: z.ZodType, value: unknown): string {
  const result = schema.safeParse(value);
  if (result.success) return "";
  return result.error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

async function requestWithRetries(
  model: string,
  messages: ChatMessage[],
  options: { json: boolean; temperature: number; timeoutMs: number },
): Promise<{ raw: string; model: string }> {
  const settings = { ...options, responseFormat: true };
  try {
    return await requestOnce(model, messages, settings);
  } catch (error) {
    if (error instanceof LlmError && isRetryable(error)) {
      await sleep(500);
      return requestOnce(model, messages, settings);
    }
    throw error;
  }
}

export async function chat(opts: {
  role: LlmRole;
  messages: ChatMessage[];
  temperature?: number;
  models?: LlmModels;
  timeoutMs?: number;
}): Promise<ChatResult> {
  const primary = resolveModel(opts.role, opts.models);
  const fallback = fallbackModel();
  const models = [primary, ...(fallback && fallback !== primary ? [fallback] : [])];
  let last: unknown;
  for (const model of models) {
    try {
      const result = await requestWithRetries(model, opts.messages, {
        json: false,
        temperature: opts.temperature ?? 0.2,
        timeoutMs: opts.timeoutMs ?? 180_000,
      });
      return { content: result.raw, model: result.model };
    } catch (error) {
      last = error;
    }
  }
  throw last instanceof Error
    ? last
    : new LlmError("All OmniRoute models failed.", "unknown");
}

/**
 * Chat + JSON parse + zod validation. One repair call per model, then the
 * configured fallback model. Never returns unvalidated data.
 */
export async function chatJSON<T>(
  opts: {
    role: LlmRole;
    messages: ChatMessage[];
    schema: z.ZodType<T>;
    temperature?: number;
    models?: LlmModels;
    timeoutMs?: number;
  },
): Promise<T> {
  const primary = resolveModel(opts.role, opts.models);
  const fallback = fallbackModel();
  const models = [primary, ...(fallback && fallback !== primary ? [fallback] : [])];
  let last: unknown;

  for (const model of models) {
    try {
      const first = await requestWithRetries(model, opts.messages, {
        json: true,
        temperature: opts.temperature ?? 0.1,
        timeoutMs: opts.timeoutMs ?? 180_000,
      });
      const parsed = tryParseJson(first.raw);
      const firstErrors = parsed === undefined ? "response was not JSON" : zodErrors(opts.schema, parsed);
      if (!firstErrors) return opts.schema.parse(parsed);

      const repairMessages: ChatMessage[] = [
        ...opts.messages,
        { role: "assistant", content: first.raw.slice(0, 6000) },
        {
          role: "user",
          content: `Your JSON failed validation: ${firstErrors}. Return corrected JSON only. No markdown, no explanation.`,
        },
      ];
      const repaired = await requestWithRetries(model, repairMessages, {
        json: true,
        temperature: 0.1,
        timeoutMs: opts.timeoutMs ?? 180_000,
      });
      const repairedParsed = tryParseJson(repaired.raw);
      const repairedErrors =
        repairedParsed === undefined ? "response was not JSON" : zodErrors(opts.schema, repairedParsed);
      if (!repairedErrors) return opts.schema.parse(repairedParsed);
      last = new LlmError(
        `Model "${model}" returned invalid JSON after one repair: ${repairedErrors}`,
        "invalid_json",
        { model, detail: repaired.raw.slice(0, 800) },
      );
    } catch (error) {
      if (error instanceof LlmError && error.code === "invalid_json") {
        last = error;
        continue;
      }
      last = error;
      if (
        error instanceof LlmError &&
        (error.code === "unauthorized" || error.code === "bad_request")
      ) {
        throw error;
      }
    }
  }

  throw last instanceof Error
    ? last
    : new LlmError("All OmniRoute models failed.", "unknown");
}

export async function imageChatAttempt(
  prompt: string,
  modelOverride?: string,
  timeoutMs = 120_000,
): Promise<{ base64?: string; url?: string; note: string }> {
  const env = getEnv();
  const model = (modelOverride && modelOverride.trim()) || env.models.image;
  const url = `${env.baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (env.apiKey) headers.Authorization = `Bearer ${env.apiKey}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: `${prompt}\n\nReturn the image itself. Do not describe it.`,
          },
        ],
        modalities: ["image", "text"],
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw friendlyFetchFailure(env.baseUrl, error);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new LlmError(
      `Image chat attempt failed (${res.status}) for "${model}": ${text.slice(0, 400)}`,
      res.status === 401 ? "unauthorized" : res.status >= 500 ? "server" : "bad_request",
      { status: res.status, model, detail: text.slice(0, 1000) },
    );
  }
  const parsed = tryParseJson(text);
  const found = findImageInPayload(parsed ?? text);
  return {
    base64: found.base64,
    url: found.url,
    note: found.found
      ? `image returned via chat`
      : `chat responded but contained no image (${text.slice(0, 120)})`,
  };
}

export function findImageInPayload(payload: unknown): {
  found: boolean;
  base64?: string;
  url?: string;
} {
  const seen = new Set<unknown>();
  let base64: string | undefined;
  let url: string | undefined;

  const walk = (value: unknown, depth: number): void => {
    if (depth > 8 || value === null || value === undefined) return;
    if (typeof value === "string") {
      if (/^data:image\/[a-z+]+;base64,/.test(value)) {
        base64 = value.split(",", 2)[1];
        return;
      }
      if (/^https?:\/\/\S+\.(png|jpe?g|webp)(\?\S*)?$/i.test(value)) {
        url = value;
        return;
      }
      const md = value.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
      if (md) url = md[1];
      return;
    }
    if (typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);
    const obj = value as Record<string, unknown>;
    for (const key of ["b64_json", "base64", "image_base64", "data"]) {
      const candidate = obj[key];
      if (typeof candidate === "string" && candidate.length > 100) {
        base64 = candidate;
        return;
      }
    }
    for (const key of ["url", "image_url", "imageUrl"]) {
      const candidate = obj[key];
      if (typeof candidate === "string" && /^https?:\/\//.test(candidate)) {
        url = candidate;
        return;
      }
      if (candidate && typeof candidate === "object") walk(candidate, depth + 1);
    }
    for (const nested of Object.values(obj)) walk(nested, depth + 1);
  };

  walk(payload, 0);
  return { found: Boolean(base64 || url), base64, url };
}

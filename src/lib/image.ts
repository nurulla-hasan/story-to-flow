import { findImageInPayload, imageChatAttempt, LlmError } from "./llm";
import { getEnv } from "./env";
import { extForMime } from "./files";
import type { Settings } from "./types";

export interface GeneratedImage {
  buffer: Buffer;
  mime: string;
  ext: string;
  note: string;
}

export interface ImageProvider {
  readonly name: "omniroute" | "manual";
  generate(prompt: string, aspect: "16:9" | "9:16"): Promise<GeneratedImage>;
}

function sniffMime(buffer: Buffer): string {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF") return "image/webp";
  return "image/png";
}

async function downloadImage(url: string): Promise<GeneratedImage> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  } catch (error) {
    throw new LlmError(
      `Image URL was returned but could not be downloaded: ${error instanceof Error ? error.message : String(error)}`,
      "network",
    );
  }
  if (!res.ok) {
    throw new LlmError(
      `Image URL was returned but download failed (${res.status}).`,
      "server",
    );
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type")?.split(";")[0] || sniffMime(buffer);
  return { buffer, mime, ext: extForMime(mime), note: "downloaded image URL" };
}

export class OmnirouteImageProvider implements ImageProvider {
  readonly name = "omniroute" as const;
  private model: string;

  constructor(model?: string) {
    this.model = (model && model.trim()) || getEnv().models.image;
  }

  async generate(prompt: string, aspect: "16:9" | "9:16"): Promise<GeneratedImage> {
    const env = getEnv();
    const url = `${env.baseUrl}/images/generations`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (env.apiKey) headers.Authorization = `Bearer ${env.apiKey}`;
    const size = aspect === "16:9" ? "1536x864" : "864x1536";

    let imageError: string;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.model,
          prompt,
          n: 1,
          size,
          response_format: "b64_json",
        }),
        signal: AbortSignal.timeout(180_000),
      });
      const text = await res.text();
      if (res.ok) {
        const parsed = safeJson(text);
        const found = findImageInPayload(parsed ?? text);
        if (found.base64) {
          const buffer = Buffer.from(found.base64, "base64");
          const mime = sniffMime(buffer);
          return { buffer, mime, ext: extForMime(mime), note: "images/generations b64" };
        }
        if (found.url) return downloadImage(found.url);
        imageError = "Server responded without image data";
      } else {
        const parsedErr = safeJson(text) as { error?: { message?: string } } | null;
        imageError = parsedErr?.error?.message ?? `Status ${res.status}`;
      }
    } catch (error) {
      imageError = error instanceof Error ? error.message : String(error);
    }

    // Fallback: some gateways route image-capable chat models through chat.
    try {
      const chat = await imageChatAttempt(prompt, this.model);
      if (chat.base64) {
        const buffer = Buffer.from(chat.base64, "base64");
        const mime = sniffMime(buffer);
        return { buffer, mime, ext: extForMime(mime), note: chat.note };
      }
      if (chat.url) return downloadImage(chat.url);
    } catch {
      // ignore chat fallback error
    }

    throw new LlmError(
      `Image model "${this.model}" does not support image generation (${imageError}). Use "Copy image prompt" to generate in Flow / Midjourney, then click "Keyframe" to upload.`,
      "bad_request",
      { model: this.model },
    );
  }
}

export class ManualImageProvider implements ImageProvider {
  readonly name = "manual" as const;

  async generate(): Promise<GeneratedImage> {
    throw new LlmError(
      "Image provider is set to manual. Copy the keyframe prompt, generate the image in Flow, then upload it.",
      "bad_request",
    );
  }
}

export function getImageProvider(settings: Settings): ImageProvider {
  const imageModel = (settings.models.image && settings.models.image.trim()) || getEnv().models.image;
  if (settings.imageProvider === "omniroute" || imageModel) {
    return new OmnirouteImageProvider(imageModel);
  }
  return new ManualImageProvider();
}

function safeJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

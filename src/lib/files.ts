import fs from "node:fs";
import path from "node:path";
import { nowIso } from "./types";

// In serverless / Vercel, read-only root requires storing writable files in /tmp/data
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

export const DATA_DIR = isServerless
  ? path.join("/tmp", "story-to-flow-data")
  : path.join(process.cwd(), "data");

export const FILES_DIR = path.join(DATA_DIR, "files");

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  txt: "text/plain; charset=utf-8",
  json: "application/json; charset=utf-8",
};

export function ensureDirs(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

export function extForMime(mime: string): string {
  const clean = (mime || "").split(";")[0].trim().toLowerCase();
  if (clean === "image/png") return "png";
  if (clean === "image/jpeg") return "jpg";
  if (clean === "image/webp") return "webp";
  if (clean === "video/webm") return "webm";
  if (clean === "video/quicktime") return "mov";
  if (clean === "video/mp4") return "mp4";
  if (clean === "audio/mpeg" || clean === "audio/mp3") return "mp3";
  if (clean === "audio/wav") return "wav";
  if (clean === "audio/ogg") return "ogg";
  if (clean === "audio/mp4" || clean === "audio/x-m4a" || clean === "audio/m4a") return "m4a";
  if (clean === "audio/aac") return "aac";
  return "bin";
}

export function mimeForPath(relPath: string): string {
  const ext = path.extname(relPath).slice(1).toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

/** Safe join: rejects absolute paths and traversal outside FILES_DIR. */
export function resolveAsset(relPath: string): string {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || path.isAbsolute(normalized)) {
    throw new Error("Invalid file path");
  }
  const full = path.resolve(FILES_DIR, normalized);
  const root = path.resolve(FILES_DIR);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid file path");
  return full;
}

export function saveAsset(
  projectId: string,
  kind: string,
  filename: string,
  buffer: Buffer,
): string {
  ensureDirs();
  const dir = path.join(FILES_DIR, projectId, kind);
  fs.mkdirSync(dir, { recursive: true });
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  const rel = [projectId, kind, safeName].join("/");
  fs.writeFileSync(path.join(dir, safeName), buffer);
  return rel;
}

export function readAsset(relPath: string): Buffer {
  return fs.readFileSync(resolveAsset(relPath));
}

export function assetExists(relPath: string | null): boolean {
  if (!relPath) return false;
  try {
    return fs.existsSync(resolveAsset(relPath));
  } catch {
    return false;
  }
}

export function deleteAsset(relPath: string | null): void {
  if (!relPath) return;
  try {
    const full = resolveAsset(relPath);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch {
    // ignore
  }
}

export function publicFileUrl(relPath: string | null): string | null {
  if (!relPath) return null;
  return `/api/files/${relPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

export function stamp(): string {
  return nowIso().replace(/[:.]/g, "-");
}

export async function fileToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

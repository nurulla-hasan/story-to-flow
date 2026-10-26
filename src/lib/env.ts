import * as fs from "node:fs";
import * as path from "node:path";

export interface EnvConfig {
  baseUrl: string;
  apiKey: string;
}

// Application-level default model (re-exported from client-safe constants)
export { DEFAULT_MODEL } from "./constants";

let fileEnvLoaded = false;

/**
 * Next.js loads .env.local itself. Scripts (vitest, scripts/*.ts) do not, so
 * parse it here without overriding real process env values.
 */
function loadFileEnv(): void {
  if (fileEnvLoaded || process.env.NEXT_RUNTIME) return;
  fileEnvLoaded = true;
  for (const file of [".env.local", ".env"]) {
    try {
      const full = path.join(/*turbopackIgnore: true*/ process.cwd(), file);
      if (!fs.existsSync(full)) continue;
      const text = fs.readFileSync(full, "utf8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = value;
      }
    } catch {
      // ignore unreadable env files
    }
  }
}

function normalizeBaseUrl(rawUrl: string): string {
  let cleaned = rawUrl.trim().replace(/\/+$/, "");
  // Localhost gateways run on unencrypted HTTP, not HTTPS
  if (
    cleaned.startsWith("https://localhost") ||
    cleaned.startsWith("https://127.0.0.1")
  ) {
    cleaned = cleaned.replace(/^https:/, "http:");
  }
  
  // Handle both /v1 and /api/v1 formats
  // If URL doesn't end with /v1 or /api/v1, add /v1
  if (!cleaned.endsWith("/v1") && !cleaned.endsWith("/api/v1")) {
    cleaned = `${cleaned}/v1`;
  }
  
  return cleaned;
}

export function getEnv(): EnvConfig {
  loadFileEnv();
  
  // Use environment variable or empty string (no hardcoded default)
  const rawUrl = process.env.AI_BASE_URL || "";
  if (!rawUrl) {
    throw new Error(
      "AI_BASE_URL environment variable is required. Set it in .env.local " +
      "to your OmniRoute gateway (e.g., http://localhost:20128/v1)"
    );
  }

  const apiKey = process.env.AI_API_KEY || "";

  return {
    baseUrl: normalizeBaseUrl(rawUrl),
    apiKey,
  };
}
import fs from "node:fs";
import path from "node:path";

export interface EnvConfig {
  baseUrl: string;
  apiKey: string;
  models: {
    planner: string;
    validator: string;
    image: string;
    fallback: string;
  };
}

const DEFAULTS = {
  planner: "agy/gemini-3.8-flash-high",
  validator: "agy/gemini-3.8-flash-low",
  image: "agy/gemini-3.8-flash-high",
  fallback: "ollamacloud/gemma4:31b",
};

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

export function getEnv(): EnvConfig {
  loadFileEnv();
  return {
    baseUrl: (process.env.OMNIROUTE_BASE_URL || "http://localhost:20128/v1").replace(
      /\/+$/,
      "",
    ),
    apiKey: process.env.OMNIROUTE_API_KEY || "",
    models: {
      planner: process.env.MODEL_PLANNER || DEFAULTS.planner,
      validator: process.env.MODEL_VALIDATOR || DEFAULTS.validator,
      image: process.env.MODEL_IMAGE || DEFAULTS.image,
      fallback: process.env.MODEL_FALLBACK || DEFAULTS.fallback,
    },
  };
}

export function envDefaults() {
  return { ...DEFAULTS };
}

/**
 * Client-safe application constants.
 * This file has NO Node.js built-ins and can be safely imported anywhere.
 */

export const DEFAULT_MODEL = "antigravity/gemini-3.8-flash-high";

/**
 * Long-generation request timeout for Story Studio processing (5 minutes / 300 seconds).
 * Configurable via AI_GENERATION_TIMEOUT_MS in .env.local if provided.
 */
export const DEFAULT_GENERATION_TIMEOUT_MS = 300_000;

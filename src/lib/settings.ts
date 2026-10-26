/**
 * Settings resolution and defaults for Story-to-Production API
 */

import { DEFAULT_MODEL } from "./env";
import type {
  ProductionSettings,
  AspectRatio,
  Duration,
  StaticFramePacing,
} from "./validation";

/**
 * Resolved production settings with all defaults applied
 */
export interface ResolvedSettings {
  model: string;
  visualStyle: string;
  aspectRatio: AspectRatio;
  duration: Duration;
  staticFramePacing: StaticFramePacing;
}

/**
 * Application defaults matching Master Prompt v1.4.2 and task requirements
 */
export const DEFAULT_SETTINGS: ResolvedSettings = {
  model: DEFAULT_MODEL,
  visualStyle: "Auto",
  aspectRatio: "9:16",
  duration: "Auto",
  staticFramePacing: "Auto",
};

/**
 * Resolve production settings with proper precedence:
 * 1. Request-level overrides (from API body)
 * 2. Application defaults
 * 
 * @param requestSettings - Optional settings from API request
 * @returns Fully resolved settings with all values defined
 */
export function resolveSettings(
  requestSettings?: ProductionSettings
): ResolvedSettings {
  return {
    model: requestSettings?.model || DEFAULT_SETTINGS.model,
    visualStyle: requestSettings?.visualStyle || DEFAULT_SETTINGS.visualStyle,
    aspectRatio: requestSettings?.aspectRatio || DEFAULT_SETTINGS.aspectRatio,
    duration: requestSettings?.duration || DEFAULT_SETTINGS.duration,
    staticFramePacing:
      requestSettings?.staticFramePacing || DEFAULT_SETTINGS.staticFramePacing,
  };
}

/**
 * Basic model ID validation.
 * Ensures the model ID follows expected format.
 * 
 * In future: validate against model catalog from /models endpoint.
 * For now: basic format check to prevent arbitrary injection.
 */
export function isValidModelId(modelId: string): boolean {
  if (!modelId || typeof modelId !== "string" || modelId.length > 128) {
    return false;
  }
  // Model IDs should follow format: provider/model-name or multi-segment like no-think/kr/claude-sonnet-4.5
  const modelIdPattern = /^[a-zA-Z0-9_.-]+(\/[a-zA-Z0-9_.-]+)*$/;
  return modelIdPattern.test(modelId);
}

/**
 * Settings resolution and defaults for Story-to-Production API
 */

import { DEFAULT_MODEL } from "./env";
import type {
  ProductionSettings,
  AspectRatio,
  StaticFramePacing,
  VisualAssetMode,
  VideoSoundMode,
  VideoAssetDuration,
} from "./validation";

/**
 * Resolved production settings with all defaults applied
 */
export interface ResolvedSettings {
  model: string;
  visualStyle: string;
  aspectRatio: AspectRatio;
  staticFramePacing: StaticFramePacing;
  videoAssetDuration: VideoAssetDuration;
  visualAssetMode: VisualAssetMode;
  videoSoundMode: VideoSoundMode;
  actualVoiceoverDuration?: number;
  voiceoverScript?: string;
}

/**
 * Application defaults matching Master Prompt requirements
 */
export const DEFAULT_SETTINGS: ResolvedSettings = {
  model: DEFAULT_MODEL,
  visualStyle: "Auto",
  aspectRatio: "9:16",
  staticFramePacing: 4, // Default to 4 seconds for static image shots
  videoAssetDuration: 4, // Default to 4 seconds for video source assets (4s, 6s, 8s)
  visualAssetMode: "Hybrid", // Default to Hybrid (AI mixes static images & video)
  videoSoundMode: "Silent Video", // Default to Silent Video
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
  const reqVideoDur = requestSettings?.videoAssetDuration;
  const resolvedVideoDur: VideoAssetDuration =
    reqVideoDur === 4 || reqVideoDur === 6 || reqVideoDur === 8
      ? reqVideoDur
      : DEFAULT_SETTINGS.videoAssetDuration;

  return {
    model: requestSettings?.model || DEFAULT_SETTINGS.model,
    visualStyle: requestSettings?.visualStyle || DEFAULT_SETTINGS.visualStyle,
    aspectRatio: requestSettings?.aspectRatio || DEFAULT_SETTINGS.aspectRatio,
    staticFramePacing:
      requestSettings?.staticFramePacing ?? DEFAULT_SETTINGS.staticFramePacing,
    videoAssetDuration: resolvedVideoDur,
    visualAssetMode:
      requestSettings?.visualAssetMode || DEFAULT_SETTINGS.visualAssetMode,
    videoSoundMode:
      requestSettings?.videoSoundMode || DEFAULT_SETTINGS.videoSoundMode,
    actualVoiceoverDuration: requestSettings?.actualVoiceoverDuration,
    voiceoverScript: requestSettings?.voiceoverScript,
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

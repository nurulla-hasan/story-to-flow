/**
 * Validation schemas for Story-to-Production API
 * Using Zod for runtime type safety and validation
 */

import { z } from "zod";

/**
 * Supported aspect ratios from Master Prompt
 */
export const AspectRatioSchema = z.enum(["9:16", "16:9"]);

/**
 * Supported static frame pacing from Master Prompt
 */
export const StaticFramePacingSchema = z.union([
  z.literal("Auto"),
  z.literal(2.5),
  z.literal(3.0),
  z.literal(4.0),
  z.literal(5.0),
  z.number().positive(),
]);

/**
 * Supported Visual Asset Modes
 */
export const VisualAssetModeSchema = z.enum(["Hybrid", "All Images", "All Videos"]);

/**
 * Supported Video Sound Modes
 */
export const VideoSoundModeSchema = z.enum([
  "Silent Video",
  "Ambient Sound & SFX",
  "Full Generated Audio",
]);

/**
 * Supported Video Source Asset Durations (4s, 6s, 8s)
 */
export const VideoAssetDurationSchema = z.union([
  z.literal(4),
  z.literal(6),
  z.literal(8),
]);

/**
 * Supported Studio workflow stages
 */
export const StudioStageSchema = z.enum(["voiceover", "scenes", "complete"]);

/**
 * Production settings for story processing
 */
export const ProductionSettingsSchema = z.object({
  model: z.string().optional(),
  visualStyle: z.string().optional(),
  aspectRatio: AspectRatioSchema.optional(),
  staticFramePacing: StaticFramePacingSchema.optional(),
  videoAssetDuration: VideoAssetDurationSchema.optional(),
  visualAssetMode: VisualAssetModeSchema.optional(),
  videoSoundMode: VideoSoundModeSchema.optional(),
  voiceoverScript: z.string().optional(),
  actualVoiceoverDuration: z.number().positive().optional(),
});

/**
 * Request body for POST /api/story/process
 */
export const StoryProcessRequestSchema = z.object({
  story: z
    .string()
    .min(1, "Story text is required")
    .max(50000, "Story text is too long (max 50,000 characters)"),
  settings: ProductionSettingsSchema.optional(),
  stage: StudioStageSchema.optional(),
  voiceoverScript: z.string().optional(),
  actualVoiceoverDuration: z.number().positive().optional(),
  videoAssetDuration: VideoAssetDurationSchema.optional(),
});

/**
 * Response metadata
 */
export const ProcessingMetadataSchema = z.object({
  modelUsed: z.string(),
  promptVersion: z.string(),
  processingTimeMs: z.number(),
});

/**
 * Response body for POST /api/story/process
 */
export const StoryProcessResponseSchema = z.object({
  response: z.string(),
  metadata: ProcessingMetadataSchema,
});

// Export TypeScript types
export type AspectRatio = z.infer<typeof AspectRatioSchema>;
export type StaticFramePacing = z.infer<typeof StaticFramePacingSchema>;
export type VisualAssetMode = z.infer<typeof VisualAssetModeSchema>;
export type VideoSoundMode = z.infer<typeof VideoSoundModeSchema>;
export type VideoAssetDuration = z.infer<typeof VideoAssetDurationSchema>;
export type StudioStage = z.infer<typeof StudioStageSchema>;
export type ProductionSettings = z.infer<typeof ProductionSettingsSchema>;
export type StoryProcessRequest = z.infer<typeof StoryProcessRequestSchema>;
export type ProcessingMetadata = z.infer<typeof ProcessingMetadataSchema>;
export type StoryProcessResponse = z.infer<typeof StoryProcessResponseSchema>;

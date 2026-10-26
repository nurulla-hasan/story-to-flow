/**
 * Validation schemas for Story-to-Production API
 * Using Zod for runtime type safety and validation
 */

import { z } from "zod";

/**
 * Supported aspect ratios from Master Prompt v1.4.2
 */
export const AspectRatioSchema = z.enum(["9:16", "16:9"]);

/**
 * Supported duration values from Master Prompt v1.4.2
 */
export const DurationSchema = z.union([
  z.literal("Auto"),
  z.literal(20),
  z.literal(30),
  z.literal(45),
  z.literal(60),
  z.literal(90),
  z.literal(120),
  z.number().int().positive(), // Custom duration in seconds
]);

/**
 * Supported static frame pacing from Master Prompt v1.4.2
 */
export const StaticFramePacingSchema = z.union([
  z.literal("Auto"),
  z.literal(2.5),
  z.literal(3.0),
  z.literal(4.0),
  z.literal(5.0),
]);

/**
 * Production settings for story processing
 */
export const ProductionSettingsSchema = z.object({
  model: z.string().optional(),
  visualStyle: z.string().optional(),
  aspectRatio: AspectRatioSchema.optional(),
  duration: DurationSchema.optional(),
  staticFramePacing: StaticFramePacingSchema.optional(),
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
export type Duration = z.infer<typeof DurationSchema>;
export type StaticFramePacing = z.infer<typeof StaticFramePacingSchema>;
export type ProductionSettings = z.infer<typeof ProductionSettingsSchema>;
export type StoryProcessRequest = z.infer<typeof StoryProcessRequestSchema>;
export type ProcessingMetadata = z.infer<typeof ProcessingMetadataSchema>;
export type StoryProcessResponse = z.infer<typeof StoryProcessResponseSchema>;

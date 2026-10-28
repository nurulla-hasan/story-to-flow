/**
 * Story-to-Production API Route
 * POST /api/story/process
 * 
 * Processes a user story using the active Master Prompt and returns
 * a complete production package with voiceover and scene prompts.
 */

import { NextRequest, NextResponse } from "next/server";
import { chatWithModel, LlmError, friendlyLlmError } from "@/lib/llm";
import { StoryProcessRequestSchema } from "@/lib/validation";
import { resolveSettings, isValidModelId } from "@/lib/settings";
import {
  assembleSystemMessage,
  assembleVoiceoverSystemMessage,
  assembleSceneSystemMessage,
} from "@/lib/prompt-assembly";
import { MASTER_PROMPT_VERSION } from "@/prompts/loader";
import type { StoryProcessResponse } from "@/lib/validation";

// Set maximum execution duration for long story production on supported Node/Vercel runtimes (300 seconds)
export const maxDuration = 300;

/**
 * POST /api/story/process
 * 
 * Accepts a story, optional production settings, and optional stage parameter:
 * - stage: "voiceover" -> Generates master voiceover script only
 * - stage: "scenes" -> Generates scene & shot prompts matching confirmed voiceover & actual duration
 * - stage: "complete" (default) -> Generates complete package
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const parseResult = StoryProcessRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const {
      story,
      settings: requestSettings,
      stage = "complete",
      voiceoverScript: bodyVoiceoverScript,
      actualVoiceoverDuration: bodyActualDuration,
      videoAssetDuration: bodyVideoAssetDuration,
    } = parseResult.data;

    // Documented Precedence Rule for videoAssetDuration:
    // 1. Explicit nested requestSettings.videoAssetDuration takes precedence
    // 2. Top-level bodyVideoAssetDuration is used if nested setting is not specified
    // 3. Defaults to 4s if neither is specified
    const effectiveVideoAssetDuration =
      requestSettings?.videoAssetDuration ?? bodyVideoAssetDuration;

    // Resolve settings with defaults
    const resolvedSettings = resolveSettings({
      ...requestSettings,
      videoAssetDuration: effectiveVideoAssetDuration,
    });

    const voiceoverScript = bodyVoiceoverScript || requestSettings?.voiceoverScript;
    const actualVoiceoverDuration = bodyActualDuration ?? requestSettings?.actualVoiceoverDuration;

    // Validate requirements for Stage 4: Scene & Shot generation
    if (stage === "scenes") {
      if (
        typeof actualVoiceoverDuration !== "number" ||
        actualVoiceoverDuration <= 0 ||
        isNaN(actualVoiceoverDuration)
      ) {
        return NextResponse.json(
          {
            error:
              "A valid, positive actual voiceover duration (in seconds) is required before generating scenes and shot prompts.",
          },
          { status: 400 }
        );
      }
      if (!voiceoverScript || !voiceoverScript.trim()) {
        return NextResponse.json(
          {
            error:
              "A finalized voiceover script is required before generating scenes and shot prompts.",
          },
          { status: 400 }
        );
      }
    }

    // Validate model ID if provided
    if (requestSettings?.model && !isValidModelId(requestSettings.model)) {
      return NextResponse.json(
        {
          error: "Invalid model ID format",
          details: "Model ID must follow format: provider/model-name",
        },
        { status: 400 }
      );
    }

    const pacingDisplay =
      resolvedSettings.staticFramePacing === "Auto"
        ? "Auto (AI chooses appropriate natural pacing, default ~4.0s)"
        : `${resolvedSettings.staticFramePacing} seconds per static image`;

    let systemMessage: string;
    let userMessageContent: string;

    if (stage === "voiceover") {
      systemMessage = assembleVoiceoverSystemMessage(resolvedSettings);
      userMessageContent = `Story to convert into master voiceover:
${story}

Configured Production Settings:
- Visual Style: ${resolvedSettings.visualStyle}
- Aspect Ratio: ${resolvedSettings.aspectRatio}

Write the complete, continuous Bangladeshi Bengali master voiceover script based strictly on the story. Output ONLY the voiceover script.`;
    } else if (stage === "scenes") {
      systemMessage = assembleSceneSystemMessage(resolvedSettings, actualVoiceoverDuration!);
      userMessageContent = `Original Story:
${story}

Final Confirmed Master Voiceover Script (from Cartesia synthesis):
${voiceoverScript}

Measured Actual Voiceover Duration: ${actualVoiceoverDuration!.toFixed(2)} seconds
Visual Asset Mode: ${resolvedSettings.visualAssetMode}
Video Sound Mode: ${resolvedSettings.videoSoundMode}
Visual Style: ${resolvedSettings.visualStyle}
Aspect Ratio: ${resolvedSettings.aspectRatio}
Static Frame Pacing: ${pacingDisplay}
Video Source Asset Duration: ${resolvedSettings.videoAssetDuration} seconds per video source asset

Generate the complete Story Scene and Shot prompt plan covering the full ${actualVoiceoverDuration!.toFixed(2)}s duration. Output each complete Story Scene in ONE code block containing all its sequential shots.`;
    } else {
      // Legacy / Complete package mode
      systemMessage = assembleSystemMessage(resolvedSettings);
      userMessageContent = `Story to produce:
${story}

Configured Production Settings (Selected and Confirmed):
- Visual Style: ${resolvedSettings.visualStyle}
- Aspect Ratio: ${resolvedSettings.aspectRatio}
- Static Frame Pacing: ${pacingDisplay}
- Video Source Asset Duration: ${resolvedSettings.videoAssetDuration} seconds per video source asset
- Visual Asset Mode: ${resolvedSettings.visualAssetMode}
- Video Sound Mode: ${resolvedSettings.videoSoundMode}

The user has submitted this story using the configured settings above. Phase 1 is complete. Proceed directly to Phase 2 (Master Voiceover) and generate the complete production package immediately.`;
    }

    // Call LLM with story and assembled prompt (using unified configurable long-generation timeout)
    const result = await chatWithModel({
      model: resolvedSettings.model,
      messages: [
        {
          role: "system",
          content: systemMessage,
        },
        {
          role: "user",
          content: userMessageContent,
        },
      ],
      temperature: 0.7,
      signal: request.signal,
    });

    const processingTimeMs = Date.now() - startTime;

    // Return raw production package
    const response: StoryProcessResponse = {
      response: result.content,
      metadata: {
        modelUsed: result.model,
        promptVersion: MASTER_PROMPT_VERSION,
        processingTimeMs,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;

    // Handle request cancellation first (normal user-initiated cancellation)
    if (
      request.signal?.aborted ||
      (error instanceof LlmError && error.message === "Request was cancelled") ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      return NextResponse.json(
        {
          cancelled: true,
          error: "Generation was cancelled by the user",
          metadata: {
            processingTimeMs,
          },
        },
        { status: 499 } // Client closed request
      );
    }

    // Handle LLM-specific errors
    if (error instanceof LlmError) {
      const friendlyError = friendlyLlmError(error);

      // Map LLM error codes to appropriate HTTP status codes
      const statusCode =
        error.code === "unauthorized"
          ? 401
          : error.code === "rate_limit"
            ? 429
            : error.code === "not_found"
              ? 404
              : error.code === "timeout"
                ? 504
                : error.code === "network" || error.code === "server"
                  ? 502
                  : 500;

      return NextResponse.json(
        {
          error: friendlyError.message,
          code: friendlyError.code,
          metadata: {
            processingTimeMs,
          },
        },
        { status: statusCode }
      );
    }

    // Handle unexpected errors
    console.error("Unexpected error in story processing:", error);

    return NextResponse.json(
      {
        error: "An unexpected error occurred while processing your story",
        metadata: {
          processingTimeMs,
        },
      },
      { status: 500 }
    );
  }
}

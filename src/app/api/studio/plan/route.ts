import { z } from "zod";
import { chatJSON } from "@/lib/llm";
import { errorResponse } from "@/lib/http";
import { newId } from "@/lib/types";

const studioPlanRequestSchema = z.object({
  story: z.string().min(10).max(10000),
  clipDuration: z.coerce.number().min(2).max(10).default(3),
  targetDuration: z.coerce.number().min(10).max(600).optional(),
  stylePreset: z.string().default("3D Pixar Animation"),
  aspectRatio: z.enum(["9:16", "16:9"]).default("9:16"),
});

const studioClipResponseSchema = z.object({
  index: z.coerce.number().int().min(1),
  duration: z.coerce.number().default(3),
  narration: z.string().min(1),
  image_prompt: z.string().min(10),
  motion: z
    .enum(["zoom-in", "zoom-out", "pan-left", "pan-right", "static"])
    .default("zoom-in"),
});

const studioPlanResponseSchema = z.object({
  title: z.string().default("Story Video"),
  continuous_voiceover: z.string().min(10),
  clips: z.array(studioClipResponseSchema).min(1).max(100),
});

const STUDIO_PLANNER_SYSTEM = `You are a world-class AI video director and storyboard editor for viral short-form and long-form video content (CapCut / YouTube Shorts / TikTok style).

You turn stories into a complete, synchronized video composition consisting of:
1. "continuous_voiceover": A single, uninterrupted, fluent Bengali narration paragraph covering the entire story from beginning to end. It must flow naturally when read aloud or synthesized via TTS, without any scene labels, speaker names, or brackets.
2. "clips": An exact sequence of visual image moments paced at approximately the requested clip duration (e.g. 3s each).
Each clip has:
- "index": sequential number (1, 2, 3...)
- "duration": clip duration in seconds (default requested duration)
- "narration": the 1-2 sentence Bengali voiceover that plays during this specific clip
- "image_prompt": a detailed, vivid image generation prompt written in English, maintaining strict character appearance, clothing, and environmental consistency across all clips in the requested visual style
- "motion": dynamic camera movement preset ('zoom-in', 'zoom-out', 'pan-left', 'pan-right')

Return JSON only conforming to the schema. No markdown, no conversation.`;

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = studioPlanRequestSchema.parse(json);

    const clipDur = parsed.clipDuration || 3;
    const targetDur = parsed.targetDuration || 45;
    const estimatedClips = Math.max(3, Math.round(targetDur / clipDur));

    const userPrompt = `STORY TEXT:
${parsed.story}

SETTINGS:
- Default Clip Duration: ${clipDur} seconds per image
- Target Video Duration: ~${targetDur} seconds (aim for ~${estimatedClips} sequential image clips)
- Visual Art Style: ${parsed.stylePreset}
- Aspect Ratio: ${parsed.aspectRatio}

TASK:
1. Write the full "continuous_voiceover" in engaging Bengali, covering the complete narrative arc without dropping the climax or punchline.
2. Divide the story into sequential clips of ~${clipDur}s each. For each clip, write the exact Bengali voiceover segment ("narration") and a high-detail English "image_prompt" in ${parsed.stylePreset} style and ${parsed.aspectRatio} aspect ratio, with identical character faces, hair, and clothing across all prompts. Alternate "motion" presets.

Return the JSON result now.`;

    const raw = await chatJSON({
      role: "planner",
      schema: studioPlanResponseSchema,
      temperature: 0.3,
      messages: [
        { role: "system", content: STUDIO_PLANNER_SYSTEM },
        { role: "user", content: userPrompt },
      ],
    });

    // Format clips with unique IDs and enforce explicit aspect ratio
    const clips = raw.clips.map((clip, idx) => {
      const promptText = clip.image_prompt.trim();
      const hasAspect = /aspect\s*ratio|9:16|16:9/i.test(promptText);
      const aspectSuffix =
        parsed.aspectRatio === "9:16"
          ? ", vertical 9:16 aspect ratio"
          : ", widescreen 16:9 aspect ratio";

      return {
        id: newId(),
        index: clip.index || idx + 1,
        duration: clip.duration || clipDur,
        narration: clip.narration,
        imagePrompt: hasAspect ? promptText : `${promptText}${aspectSuffix}`,
        imageUrl: null,
        motion: clip.motion || (idx % 2 === 0 ? "zoom-in" : "pan-left"),
      };
    });

    return Response.json({
      success: true,
      title: raw.title || "Story Video",
      continuousVoiceover: raw.continuous_voiceover,
      clips,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

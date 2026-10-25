import { z } from "zod";
import { chatJSON } from "@/lib/llm";
import { errorResponse } from "@/lib/http";
import { newId } from "@/lib/types";
import { detectSfxFromAction, sanitizeDetachedProps } from "@/lib/studio";

const moreScenesRequestSchema = z.object({
  story: z.string().optional(),
  characterVisualLock: z.string().min(10),
  environmentVisualLock: z.string().optional(),
  stylePreset: z.string().default("3D Pixar Animation"),
  aspectRatio: z.enum(["9:16", "16:9"]).default("9:16"),
  clipDuration: z.coerce.number().default(3),
  countNeeded: z.coerce.number().min(1).max(50),
  existingCount: z.coerce.number().default(0),
  voiceoverContext: z.string().optional(),
});

const moreClipsResponseSchema = z.object({
  clips: z
    .array(
      z.object({
        narration: z.string().min(1),
        image_prompt: z.string().min(10),
        motion: z
          .enum(["zoom-in", "zoom-out", "pan-left", "pan-right", "static"])
          .default("zoom-in"),
        sfx: z
          .enum([
            "none",
            "cartoon-pop",
            "heavy-thud",
            "whoosh",
            "magic-chime",
            "glass-shatter",
            "boing",
            "crow-caw",
            "clock-tick",
          ])
          .default("none"),
      }),
    )
    .min(1)
    .max(50),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = moreScenesRequestSchema.parse(json);

    const userPrompt = `TASK: Generate exactly ${parsed.countNeeded} additional sequential image clips to extend the story video.

LOCKED CHARACTER APPEARANCE (MUST BE 100% IDENTICAL):
${parsed.characterVisualLock}

${parsed.environmentVisualLock ? `LOCKED ENVIRONMENT:\n${parsed.environmentVisualLock}\n` : ""}
${parsed.voiceoverContext ? `STORY VOICEOVER CONTEXT:\n${parsed.voiceoverContext}\n` : ""}

SETTINGS:
- Art Style: ${parsed.stylePreset}
- Aspect Ratio: ${parsed.aspectRatio}
- Duration per clip: ${parsed.clipDuration}s
- Starting index: ${parsed.existingCount + 1}
- Number of additional clips required: ${parsed.countNeeded}

RULES:
1. Each clip's "image_prompt" MUST strictly keep the exact same character (face, hair, age, clothes) and art style without variation.
2. If a locked accessory or prop is removed, damaged, or transferred in the scene action (e.g. spectacles snatched by a bird), do NOT describe the character wearing it in the character lock block for that specific frame! Temporarily override it (e.g. with spectacles missing / bare eyes) and describe the detached prop only in the action.
3. Provide complementary narrative camera angles (close-ups, reaction shots, wide angles) and alternate motion presets.
4. Provide a brief 1-sentence Bengali narration segment ("narration") for each clip.

Return JSON conforming to schema now.`;

    const raw = await chatJSON({
      role: "planner",
      schema: moreClipsResponseSchema,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are an expert storyboard artist generating additional matching sequential video clips with strict character consistency.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    const aspectSuffix =
      parsed.aspectRatio === "9:16"
        ? ", vertical 9:16 aspect ratio"
        : ", widescreen 16:9 aspect ratio";

    const MOTION_CYCLE: ("zoom-in" | "pan-left" | "zoom-out" | "pan-right" | "static")[] = [
      "pan-left",
      "zoom-out",
      "pan-right",
      "zoom-in",
      "static",
    ];

    const clips = raw.clips.slice(0, parsed.countNeeded).map((clip, idx) => {
      const motion =
        clip.motion && clip.motion !== "zoom-in"
          ? clip.motion
          : MOTION_CYCLE[idx % MOTION_CYCLE.length];

      let promptText = sanitizeDetachedProps(clip.image_prompt.trim(), clip.narration);

      promptText = promptText
        .replace(
          /\b(camera slowly zooming in[^\n,]*|camera slowly zooming out[^\n,]*|smooth cinematic camera sliding left[^\n,]*|smooth cinematic camera sliding right[^\n,]*|steady static camera framing[^\n,]*|(dramatic\s+)?push-in[^\n,]*|(dramatic\s+)?pull-back[^\n,]*)\b,?\s*/gi,
          "",
        )
        .replace(/,\s*,/g, ",")
        .replace(/,\s*$/g, "")
        .trim();

      const hasAspect = /aspect\s*ratio|9:16|16:9/i.test(promptText);

      if (!hasAspect) {
        promptText = `${promptText}${aspectSuffix}`;
      }

      const sfx =
        clip.sfx && clip.sfx !== "none"
          ? clip.sfx
          : detectSfxFromAction(clip.narration, promptText);

      return {
        id: newId(),
        index: parsed.existingCount + idx + 1,
        duration: parsed.clipDuration,
        narration: clip.narration,
        imagePrompt: promptText,
        imageUrl: null,
        motion,
        sfx,
      };
    });

    return Response.json({ success: true, clips });
  } catch (error) {
    return errorResponse(error);
  }
}

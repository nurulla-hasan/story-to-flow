import { z } from "zod";
import { chatJSON } from "@/lib/llm";
import { errorResponse } from "@/lib/http";
import { newId } from "@/lib/types";
import { saveStudioProject, sanitizeDetachedProps } from "@/lib/studio";

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
  character_visual_lock: z.string().min(10).describe(
    "A 30-50 word concrete physical appearance lock for the main character: exact age, ethnicity, face shape, distinctive facial wrinkles/features, eye shape/glasses, hairstyle and color, exact clothing (shirt, vest, trousers, apron, colors, fabrics). Visual facts only.",
  ),
  environment_visual_lock: z.string().min(10).describe(
    "A 20-40 word physical appearance lock for the main environment: architecture, materials, key props, lighting color, time of day.",
  ),
  recommended_bgm_mood: z
    .enum([
      "suspense-mystery",
      "emotional-piano",
      "lofi-chill",
      "dark-thriller",
      "inspirational-epic",
    ])
    .default("suspense-mystery")
    .describe(
      "The best matching cinematic background music mood for this story: 'suspense-mystery' for mystery/clocks/magic, 'emotional-piano' for drama/nostalgia/love, 'lofi-chill' for calm/cozy, 'dark-thriller' for horror/tension, 'inspirational-epic' for heroic/adventure.",
    ),
  continuous_voiceover: z.string().min(10),
  clips: z.array(studioClipResponseSchema).min(1).max(100),
});

const STUDIO_PLANNER_SYSTEM = `You are a world-class AI video director and storyboard editor for viral short-form and long-form video content (CapCut / YouTube Shorts / TikTok style).

CRITICAL CHARACTER CONSISTENCY & DYNAMIC PROPS DIRECTIVE:
Image diffusion models (Google Flow, Midjourney, Flux) drift and change character faces and clothing if descriptions vary across prompts, but will also hallucinate duplicate items if detached props are described both on the character and in the scene action.
1. Define a strict "character_visual_lock" specifying exact age, ethnicity, face, wrinkles, hairstyle, spectacles/beard, and exact clothing (layering, colors, materials).
2. Define an "environment_visual_lock" specifying the room/setting, materials, and lighting.
3. IN EVERY SINGLE CLIP'S "image_prompt": You MUST explicitly feature the exact same character with their identical facial features, same hair, and same clothing from the character visual lock! Never change their shirt color, hair, or facial features between clips.
4. DYNAMIC PROPS & DETACHED ITEMS OVERRIDE (MANDATORY):
   If a locked accessory or prop is removed, damaged, dropped, fallen, stolen, snatched, or transferred in the scene action:
   - Do NOT describe the character wearing it in the character lock block for that specific frame!
   - Temporarily strip or override that specific item from the character description for that shot (e.g., 'Habul with his spectacles missing / bare squinting eyes', 'bareheaded with hat gone', 'without his coat').
   - Explicitly note the detached prop's location and state in the shot action only (e.g., 'the thick black round spectacles are held in the crow's beak flying upward' or 'the shattered teacup and steaming tea splash on the floor').
   - NEVER allow an item to be simultaneously worn on the character and detached in the environment/animal's possession!
5. CAMERA MOVEMENT METADATA VARIETY:
   - For the clip 'motion' field, you MUST alternate camera movements across consecutive clips ('zoom-in', 'pan-left', 'zoom-out', 'pan-right', 'static'). NEVER assign 'zoom-in' to all clips!
   - Keep the 'image_prompt' field focused purely on static visual details (composition, characters, environment, action, lighting) without video camera motion words, since prompts are used for static image generation.
6. STORY BGM MOOD DETECTION:
   - Identify the primary emotional mood of the story and output "recommended_bgm_mood" ('suspense-mystery', 'emotional-piano', 'lofi-chill', 'dark-thriller', 'inspirational-epic').
7. Each prompt must follow this structure: "[Visual style]. [Character visual lock with any detached item cleanly overridden], [Environment lock]. In this shot: [specific framing, action, detached prop location, emotion]. [Aspect ratio directive]."

Return JSON only conforming to the schema. No markdown, no conversation.`;

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = studioPlanRequestSchema.parse(json);

    const clipDur = parsed.clipDuration || 3;
    const wordCount = parsed.story.trim().split(/\s+/).length;
    // Spoken Bengali speech rate is ~2.2 words per second (~130 words per minute)
    const naturalVoiceoverSeconds = Math.max(15, Math.round(wordCount / 2.2));
    const targetDur = parsed.targetDuration || naturalVoiceoverSeconds;
    const estimatedClips = Math.max(3, Math.ceil(targetDur / clipDur));
    const wordsPerClip = Math.max(4, Math.round(clipDur * 2.2));

    const userPrompt = `STORY TEXT:
${parsed.story}

PACING & TIMING CALCULATION:
- Story Word Count: ~${wordCount} words
- Natural Spoken Voiceover Duration: ~${targetDur} seconds (at 2.2 words per second speaking rate)
- Selected Pacing: ${clipDur} seconds per image
- REQUIRED IMAGE CLIPS COUNT: Generate EXACTLY ~${estimatedClips} sequential image clips!
- Visual Art Style: ${parsed.stylePreset}
- Aspect Ratio: ${parsed.aspectRatio}

CRITICAL RULES:
1. Write the full "continuous_voiceover" covering the complete story in natural Bengali.
2. Distribute the voiceover across ~${estimatedClips} sequential image clips (each clip pacing at exactly ${clipDur}s with ~${wordsPerClip} words of narration) so images never run out while audio is playing.
3. Establish a strict "character_visual_lock" and "environment_visual_lock" to ensure 100% visual consistency.
4. If a locked accessory or prop is removed, damaged, or transferred in the scene action (e.g. spectacles snatched by a bird, hat flying, cup dropped), do NOT describe the character wearing it in the character lock block for that specific frame! Temporarily override it (e.g. with spectacles missing / bare eyes) and describe the detached prop only in the action.
5. CAMERA MOVEMENT METADATA: Alternate camera motions ('zoom-in', 'pan-left', 'zoom-out', 'pan-right', 'static') across clips in the 'motion' field. NEVER use 'zoom-in' for all clips! Keep the 'image_prompt' focused purely on visual image content without video camera movement phrases.
6. In every clip's "image_prompt", anchor the locked character appearance and clothing without variation.

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

    const charLock = raw.character_visual_lock?.trim() || "";
    const envLock = raw.environment_visual_lock?.trim() || "";

    const MOTION_CYCLE: ("zoom-in" | "pan-left" | "zoom-out" | "pan-right" | "static")[] = [
      "zoom-in",
      "pan-left",
      "zoom-out",
      "pan-right",
      "static",
    ];

    // Format clips with unique IDs and diverse camera movements for the video editor
    const clips = raw.clips.map((clip, idx) => {
      // Ensure scene-based variety if LLM repeated zoom-in across clips
      const motion =
        clip.motion && (clip.motion !== "zoom-in" || idx === 0)
          ? clip.motion
          : MOTION_CYCLE[idx % MOTION_CYCLE.length];

      let promptText = sanitizeDetachedProps(clip.image_prompt.trim(), clip.narration);

      // Clean out any accidental video camera motion words so image diffusion models generate pure static images
      promptText = promptText
        .replace(
          /\b(camera slowly zooming in[^\n,]*|camera slowly zooming out[^\n,]*|smooth cinematic camera sliding left[^\n,]*|smooth cinematic camera sliding right[^\n,]*|steady static camera framing[^\n,]*|(dramatic\s+)?push-in[^\n,]*|(dramatic\s+)?pull-back[^\n,]*)\b,?\s*/gi,
          "",
        )
        .replace(/,\s*,/g, ",")
        .replace(/,\s*$/g, "")
        .trim();

      const hasAspect = /aspect\s*ratio|9:16|16:9/i.test(promptText);
      const aspectSuffix =
        parsed.aspectRatio === "9:16"
          ? ", vertical 9:16 aspect ratio"
          : ", widescreen 16:9 aspect ratio";

      if (!hasAspect) {
        promptText = `${promptText}${aspectSuffix}`;
      }

      return {
        id: newId(),
        index: clip.index || idx + 1,
        duration: clipDur,
        narration: clip.narration,
        imagePrompt: promptText,
        imageUrl: null,
        motion,
      };
    });

    const recommendedBgmMood = raw.recommended_bgm_mood || "suspense-mystery";

    const projectResult = {
      id: "studio-default",
      title: raw.title || "Story Video",
      story: parsed.story,
      characterVisualLock: charLock,
      environmentVisualLock: envLock,
      stylePreset: parsed.stylePreset,
      aspectRatio: parsed.aspectRatio,
      defaultClipDuration: clipDur,
      continuousVoiceover: raw.continuous_voiceover,
      audioUrl: null,
      audioDuration: 0,
      recommendedBgmMood,
      bgmMood: recommendedBgmMood,
      bgmVolume: 0.2,
      clips,
    };
    saveStudioProject(projectResult);

    return Response.json({
      success: true,
      title: projectResult.title,
      characterVisualLock: projectResult.characterVisualLock,
      environmentVisualLock: projectResult.environmentVisualLock,
      recommendedBgmMood: projectResult.recommendedBgmMood,
      continuousVoiceover: projectResult.continuousVoiceover,
      clips: projectResult.clips,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

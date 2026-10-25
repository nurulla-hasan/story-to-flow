import { z } from "zod";
import { SFX_TYPES } from "@/components/studio/types";
import { chatJSON } from "@/lib/llm";
import { errorResponse } from "@/lib/http";
import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { buildBible } from "@/lib/pipeline";
import { newId, styleLockForPreset } from "@/lib/types";
import {
  detectSfxFromAction,
  sanitizeDetachedProps,
  saveStudioProject,
} from "@/lib/studio";
import {
  SHORTS_MOTION_CYCLE,
  cleanNarration,
  composeShortsShot,
  estimateNarrationDuration,
  estimateShortsClipCount,
} from "@/lib/studio-plan";

const castMemberSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  visualLock: z.string().min(10).max(2400),
  voiceLock: z.string().max(1200).optional(),
  refImageUrl: z.string().nullable().optional(),
});

const locationLockSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().max(200).optional(),
  visualLock: z.string().min(10).max(2400),
});

const studioPlanRequestSchema = z.object({
  story: z.string().min(10).max(10000),
  clipDuration: z.coerce.number().min(2).max(10).default(3),
  targetDuration: z.coerce.number().min(10).max(600).optional(),
  stylePreset: z.string().default("3D Pixar Animation"),
  aspectRatio: z.enum(["9:16", "16:9"]).default("9:16"),
  workflowMode: z.enum(["video-clips", "shorts-animatic"]).default("video-clips"),
  pacing: z.enum(["auto", "2.5", "3", "4", "5"]).default("auto"),
  styleLock: z.string().max(2400).optional(),
  cast: z.array(castMemberSchema).max(24).default([]),
  locations: z.array(locationLockSchema).max(24).default([]),
  rules: z.array(z.string().max(2000)).max(50).default([]),
  /**
   * One-click pipeline: rebuild the Story Bible from the submitted story, then
   * plan with the freshly extracted characters, locations and style lock.
   */
  refreshBible: z.boolean().default(false),
});

const studioClipResponseSchema = z.object({
  index: z.coerce.number().int().min(1),
  duration: z.coerce.number().default(3),
  narration: z.string().min(1),
  image_prompt: z.string().min(10),
  motion: z
    .enum(["zoom-in", "zoom-out", "pan-left", "pan-right", "static"])
    .default("zoom-in"),
  sfx: z.enum(SFX_TYPES).default("none"),
  recommended_media_type: z.enum(["video", "image"]).default("image"),
  hero_reason: z.string().max(200).optional(),
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
7. CARTESIA AI SONIC MODEL PROSODIC & DEEP HUMAN EMOTIONAL ACTING RULES (MANDATORY):
   The voiceover will be synthesized with Cartesia AI (Sonic Model). The narrator must NOT sound like a flat, robotic reader, but like a passionate human actor, emotional storyteller, or animated grandfather performing an oral tale with visceral vocal acting!
   - Mandatory Emotional Vocalizations: Weave in authentic Bengali vocal sounds and character exclamations to match the scene emotions:
     * ভয় ও চিৎকার (Panic/Fear/Escape): Weave in "আআআ!", "ওরে বাবারে বাবা!!", "হায় হায় রে!"
     * ব্যথা ও চমক (Pain/Shock/Astonishment): Weave in "উফ্‌ফ্‌!", "আউচ!", "অ্যাঁ?! একী কাণ্ড!"
     * লোভ ও হাসি (Laughter/Greed/Amusement): Weave in "হি হি হি!", "হাহাহা!", "আহা কী আনন্দ!"
     * কষ্ট ও অনুশোচনা (Sadness/Regret/Despair): Weave in "ইশ্‌শ্‌ রে...", "আহারে পোড়া কপাল!"
     * বিস্ময় ও কৌতূহল (Wonder/Suspense/Realization): Weave in "ওমা!", "হুঁউউ..."
   - Prosodic Formatting for Sonic TTS:
     * Use double exclamation marks "!!" on screams, shouts, laughter bursts, and climactic reactions to trigger Cartesia's volume bursts and emotional pitch peaks (e.g., "ওরে বাবারে বাবা!! সে কী ভীষণ কাণ্ড!").
     * Use ellipsis "..." for suspenseful pauses, hushed breath holds, and anticipation before sudden revelations (e.g., "ধীরে ধীরে দরজাটা খুলল... আর ওমা! ভেতরে...").
     * Use an em-dash ("—") immediately before sudden exclamations to trigger Cartesia's natural breath-gasp.
     * Ensure the voiceover flows like an expressive, captivating oral story with vivid emotional contrast between fear, laughter, and wonder.
   - Action Beats & Impact Stretching:
     * Burst / Pop: Write "— ফটা-আ-স্!!" (never plain "ফটাস")
     * Impact / Crash / Fall: Write "— ধপা-আ-স্!!" (never plain "ধপাস")
     * Speed / Flight: Write "— হু-উ-শ!!" (never plain "হুশ")
8. AUTOMATIC SFX (FOLEY) TAGGING: For each clip, tag "sfx" based on the acoustic event:
   - Flying / swooping / speed -> 'whoosh'
   - Body falling / crash landing / heavy impact -> 'heavy-thud'
   - Head hit / coconut bonk / wooden knock -> 'bonk'
   - Slipping on mud / banana peel / comic tumble -> 'cartoon-slip'
   - Spring jump / bounce / recoil -> 'boing'
   - Bubble burst / pop / snap -> 'cartoon-pop'
   - Cup, bottle or window breaking -> 'glass-shatter'
   - Water, pond, curd or mud splash -> 'water-splash'
   - Magical sparkle / transformation / time freeze -> 'magic-chime'
   - Dramatic shock / twist reveal / meme boom -> 'vine-boom'
   - Lightning / storm / thunder clap -> 'thunder'
   - Spooky door hinge / slow clock opening -> 'door-creak'
   - Heavy door shutting -> 'door-slam'
   - Coins / gold treasure jingle -> 'coin-clink'
   - Clock ticking -> 'clock-tick'
   - Crow / raven cawing -> 'crow-caw'
   - Ghost laugh / villain chuckle -> 'evil-laugh'
   - Comedy fail / defeat / wah-wah -> 'sad-trombone'
   - If none -> 'none'.
9. SMART "HERO SHOT" VIDEO PROMPT GENERATION (Video vs Static Image):
   Evaluate the kinetic energy and narrative weight of each shot:
   - Tag "recommended_media_type": "video" ONLY for the top 20–25% "Hero Action Moments" (strictly maximum 4 to 6 shots per story):
     * High-velocity movement (explosions, bursts, flight, falls, crashes, chases).
     * Magical transformations & particle eruptions (smoke pouring from bottle, genie appearing, chicks hatching, portal opening).
     * Critical character interactions (snatching items, jumping, biting, collisions).
     * Provide a brief "hero_reason" (e.g. "Magic transformation", "Impact landing", "High physical action", "Sudden escape").
     * MANDATORY VIDEO ACTION PROMPT: For every "video" shot, write "action" with active continuous physical motion and explicit camera tracking physics (e.g. "Fast-paced camera tracking a massive brown mudslide rushing down...", "High-friction sliding wheels showering bright orange sparks for exactly 4 seconds..."). NEVER describe a static or passive pose for a video shot!
   - Tag "recommended_media_type": "image" for all other shots (75–80% of shots):
     * Establishing environments, stationary dialog, looking/holding items, facial reaction close-ups.
10. Each prompt must follow this structure: "[Visual style]. [Character visual lock with any detached item cleanly overridden], [Environment lock]. In this shot: [specific framing, action, detached prop location, emotion]. [Aspect ratio directive]."

Return JSON only conforming to the schema. No markdown, no conversation.`;

const shortsClipResponseSchema = z.object({
  index: z.coerce.number().int().min(1).optional(),
  duration: z.coerce.number().default(3.5),
  narration: z.string().min(1).max(1200),
  action: z.string().min(10).max(1600),
  motion: z.string().default("zoom-in"),
  character_ids: z.array(z.string()).max(8).default([]),
  location_id: z.string().optional(),
  recommended_media_type: z.enum(["video", "image"]).default("image"),
  hero_reason: z.string().max(200).optional(),
});

const shortsPlanResponseBaseSchema = z.object({
  title: z.string().default("Shorts Voiceover"),
  recommended_bgm_mood: z
    .enum([
      "suspense-mystery",
      "emotional-piano",
      "lofi-chill",
      "dark-thriller",
      "inspirational-epic",
    ])
    .default("emotional-piano"),
  clips: z.array(shortsClipResponseSchema).min(1).max(120),
});

// Some models return "shots" / "shot_number" / camera-style motion labels.
// Normalize those aliases before validation so a good plan is not rejected.
const shortsPlanResponseSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  const rawShots = record.clips ?? record.shots;
  if (!Array.isArray(rawShots)) return value;

  return {
    ...record,
    clips: rawShots.map((shot) => {
      if (!shot || typeof shot !== "object") return shot;
      const item = shot as Record<string, unknown>;
      const characterIds = item.character_ids ?? item.characterIds;
      const locationId = item.location_id ?? item.locationId;
      return {
        ...item,
        index: item.index ?? item.shot_number ?? item.shotNumber,
        narration: item.narration ?? item.voiceover ?? item.voice_over,
        action:
          item.action ??
          item.image_action ??
          item.imageAction ??
          item.description,
        character_ids: Array.isArray(characterIds) ? characterIds : [],
        location_id:
          typeof locationId === "string" ? locationId : undefined,
        recommended_media_type:
          item.recommended_media_type ??
          item.recommendedMediaType ??
          item.media_type ??
          item.mediaType ??
          "image",
        hero_reason: item.hero_reason ?? item.heroReason ?? item.reason,
      };
    }),
  };
}, shortsPlanResponseBaseSchema);

const SHORTS_PLANNER_SYSTEM = `You are a world-class short-form animatic director and storyboard editor (YouTube Shorts / TikTok / Reels).

You are planning a SEQUENTIAL IMAGE ANIMATIC with ONE continuous Bangla voiceover paragraph.

ABSOLUTE NARRATION RULES (clean TTS):
1. Write natural, expressive storytelling-grade Bangla that sounds like an engaging oral narrator.
2. Weave in authentic emotional vocalizations where fitting (e.g., 'ওরে বাবারে বাবা!', 'হায় হায় রে!', 'উফ্‌ফ্‌!', 'অ্যাঁ?! একী কাণ্ড!', 'হি হি হি!', 'ইশ্‌শ্‌ রে...', 'ওমা!', 'হুঁউউ...'). Never use bracketed sound tags like [whoosh] or onomatopoeic SFX words in narration.
3. Each clip's "narration" is the next consecutive slice of the same narrator script. When joined in order, the slices MUST read as one smooth story with no repeated sentences and no gaps.
4. Do not put camera directions or visual descriptions inside the narration.
5. Keep each narration slice short enough to speak inside that clip's duration (about 2.2 Bangla words per second).

SHOT RULES:
1. Return a top-level JSON object with a "clips" array (not "shots"). Each clip must contain "narration", "action", "duration", "character_ids" and "location_id".
2. Write "title" and every "action" in English, even when the story is Bangla. Only the "narration" field is Bangla.
3. Split the complete story into sequential static image shots. Each shot must advance the story.
4. "action" describes ONE static frame: framing, who is visible, pose, expression, prop state, lighting. Do NOT include camera movement words (zoom, pan, push-in, dolly).
5. "character_ids" must contain ONLY exact ids from the supplied CAST list, and only characters actually visible in that shot. Use [] for an environment-only shot.
6. "location_id" must be one exact id from the supplied LOCATIONS list.
7. Character appearance, clothing, age and location details are locked elsewhere. Never invent changes to them. If a prop is detached/dropped/stolen, describe its new position and state in the action only.
8. "motion" is metadata for the editor; choose variety across consecutive shots.
9. SMART "HERO SHOT" VIDEO PROMPT GENERATION (Video vs Static Image):
   Evaluate the kinetic energy and narrative weight of each shot:
   - Tag "recommended_media_type": "video" ONLY for the top 20–25% "Hero Action Moments" (strictly maximum 4 to 6 shots per story):
     * High-velocity movement (explosions, bursts, flight, falls, crashes, chases).
     * Magical transformations & particle eruptions (smoke pouring from bottle, genie appearing, chicks hatching, portal opening).
     * Critical character interactions (snatching items, jumping, biting, collisions).
     * Provide a brief "hero_reason" (e.g. "Magic transformation", "Impact landing", "High physical action", "Sudden escape").
     * MANDATORY VIDEO ACTION PROMPT: For every "video" shot, write "action" with active continuous physical motion and explicit camera tracking physics (e.g. "Fast-paced camera tracking a massive brown mudslide rushing down...", "High-friction sliding wheels showering bright orange sparks for exactly 4 seconds..."). NEVER describe a static or passive pose for a video shot!
   - Tag "recommended_media_type": "image" for all other shots (75–80% of shots):
     * Establishing environments, stationary dialog, looking/holding items, facial reaction close-ups.

Do not invent recurring characters or locations that are not in the supplied lists.
Return JSON only, conforming to the schema. No markdown, no conversation.`;

async function planShortsAnimatic(
  parsed: z.infer<typeof studioPlanRequestSchema>,
): Promise<Response> {
  if (parsed.cast.length === 0 || parsed.locations.length === 0) {
    return Response.json(
      {
        error:
          "The Story Bible did not return any characters or locations. Try again so every prompt can include the locked cast and setting.",
      },
      { status: 400 },
    );
  }

  const fixedDuration =
    parsed.pacing === "auto" ? null : Number(parsed.pacing);
  const estimatedClips = estimateShortsClipCount(
    parsed.story,
    parsed.pacing,
    parsed.targetDuration,
  );

  const castBlock =
    parsed.cast.length > 0
      ? parsed.cast
          .map(
            (member, idx) =>
              `${idx + 1}. id="${member.id}" | name="${member.name}"\n   visual_lock: ${member.visualLock}`,
          )
          .join("\n")
      : "No cast supplied. Use environment-only shots and character_ids: [].";

  const locationBlock =
    parsed.locations.length > 0
      ? parsed.locations
          .map(
            (location, idx) =>
              `${idx + 1}. id="${location.id}" | name="${location.name ?? "Location"}\n   visual_lock: ${location.visualLock}`,
          )
          .join("\n")
      : "No locked locations supplied.";

  const rulesBlock =
    parsed.rules.length > 0
      ? parsed.rules.map((rule, idx) => `${idx + 1}. ${rule}`).join("\n")
      : "None.";

  const pacingBlock = fixedDuration
    ? `Selected pacing: every clip must be exactly ${fixedDuration} seconds long.\n- Aim for ~${Math.round(fixedDuration * 2.2)} Bangla words of narration per clip.`
    : `Pacing: AUTO. Vary clip durations between 2.5 and 5.0 seconds to match the story beats.\n- Aim for ~${Math.round(3.5 * 2.2)} Bangla words per clip on average.`;

  const userPrompt = `STORY TEXT:
${parsed.story}

TIMING:
- Target runtime: ~${parsed.targetDuration ?? "natural spoken length"} seconds
- REQUESTED SHOT COUNT: ${estimatedClips} sequential images (you may vary by ±1 to keep sentence boundaries natural)
${pacingBlock}
- Visual art style: ${parsed.stylePreset}
- Aspect ratio: ${parsed.aspectRatio}

CAST (use exact ids in character_ids):
${castBlock}

LOCATIONS (use exact ids in location_id):
${locationBlock}

CUSTOM RULES (must follow):
${rulesBlock}

Write the complete clean Bangla narration as consecutive slices, one per shot. Use natural punctuation. No SFX words, no phonetic stretching, no gasps. Return the JSON result now.`;

  const raw = await chatJSON({
    role: "planner",
    schema: shortsPlanResponseSchema,
    temperature: 0.4,
    messages: [
      { role: "system", content: SHORTS_PLANNER_SYSTEM },
      { role: "user", content: userPrompt },
    ],
  });

  const styleLock =
    parsed.styleLock?.trim() || styleLockForPreset(parsed.stylePreset);

  const clips = raw.clips.map((clip, idx) => {
    const narration = cleanNarration(clip.narration) || clip.narration.trim();
    const action = clip.action.trim();
    const isVideo = (clip.recommended_media_type ?? "image") === "video";

    const duration = isVideo
      ? 4.0
      : fixedDuration ?? estimateNarrationDuration(narration);
    const resolved = composeShortsShot({
      styleLock,
      stylePreset: parsed.stylePreset,
      cast: parsed.cast,
      locations: parsed.locations,
      action,
      characterIds: clip.character_ids,
      locationId: clip.location_id,
      narration,
      aspectRatio: parsed.aspectRatio,
      recommendedMediaType: clip.recommended_media_type ?? "image",
      heroReason: clip.hero_reason || undefined,
    });

    return {
      id: newId(),
      index: idx + 1,
      duration,
      narration,
      action,
      imagePrompt: resolved.imagePrompt,
      imageUrl: null,
      motion: SHORTS_MOTION_CYCLE[idx % SHORTS_MOTION_CYCLE.length],
      sfx: "none" as const,
      characterIds: resolved.characterIds,
      locationId: resolved.locationId,
      recommendedMediaType: clip.recommended_media_type ?? "image",
      heroReason: clip.hero_reason || undefined,
    };
  });

  const continuousVoiceover = clips
    .map((clip) => clip.narration)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const recommendedBgmMood = raw.recommended_bgm_mood || "emotional-piano";
  const averageDuration =
    clips.reduce((total, clip) => total + clip.duration, 0) /
    Math.max(1, clips.length);

  const projectResult = {
    id: "studio-default",
    title: raw.title || "Shorts Voiceover",
    story: parsed.story,
    workflowMode: "shorts-animatic" as const,
    cast: parsed.cast,
    locations: parsed.locations,
    styleLock,
    characterVisualLock: parsed.cast[0]?.visualLock ?? "",
    environmentVisualLock: parsed.locations[0]?.visualLock ?? "",
    stylePreset: parsed.stylePreset,
    aspectRatio: parsed.aspectRatio,
    defaultClipDuration: fixedDuration ?? averageDuration,
    continuousVoiceover,
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
    workflowMode: "shorts-animatic",
    title: projectResult.title,
    recommendedBgmMood,
    continuousVoiceover,
    clips,
    project: projectResult,
  });
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = studioPlanRequestSchema.parse(json);

    if (parsed.workflowMode === "shorts-animatic") {
      let effective = parsed;

      if (parsed.refreshBible) {
        const repo = getRepo();
        const current = repo.getProjectData(DEFAULT_PROJECT_ID);

        // buildBible reads the saved story, so persist the submitted text first.
        if (current.project.story !== parsed.story) {
          repo.updateProject(DEFAULT_PROJECT_ID, { story: parsed.story });
        }

        await buildBible(DEFAULT_PROJECT_ID, { preserveScenes: true });

        const fresh = repo.getProjectData(DEFAULT_PROJECT_ID);
        effective = {
          ...parsed,
          story: fresh.project.story,
          pacing: fresh.project.settings.shortsPacing,
          stylePreset: fresh.project.settings.stylePreset,
          aspectRatio: fresh.project.settings.aspectRatio,
          styleLock: fresh.project.styleLock || parsed.styleLock,
          cast: fresh.characters
            .filter((character) => character.visual_lock.trim().length >= 10)
            .map((character) => ({
              id: character.id,
              name: character.name,
              visualLock: character.visual_lock,
              voiceLock: character.voice_lock,
              refImageUrl: character.refImage,
            })),
          locations: fresh.locations
            .filter((location) => location.visual_lock.trim().length >= 10)
            .map((location) => ({
              id: location.id,
              name: location.name,
              visualLock: location.visual_lock,
            })),
          rules: fresh.rules.map((rule) => rule.text),
        };
      }

      return await planShortsAnimatic(effective);
    }

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
1. Write the full "continuous_voiceover" covering the complete story in deeply expressive, passionate oral storytelling Bengali with rich human emotional acting vocalizations (আআআ!, ওরে বাবারে বাবা!!, উফ্‌ফ্‌!, অ্যাঁ?!, হি হি হি!, ইশ্‌শ্‌ রে..., ওমা!, হুঁউউ...) and prosodic pacing ("!!", "...", "—").
2. Distribute the voiceover across ~${estimatedClips} sequential image clips (each clip pacing at exactly ${clipDur}s with ~${wordsPerClip} words of narration) so images never run out while audio is playing.
3. Establish a strict "character_visual_lock" and "environment_visual_lock" to ensure 100% visual consistency.
4. If a locked accessory or prop is removed, damaged, or transferred in the scene action (e.g. spectacles snatched by a bird, hat flying, cup dropped), do NOT describe the character wearing it in the character lock block for that specific frame! Temporarily override it (e.g. with spectacles missing / bare eyes) and describe the detached prop only in the action.
5. CAMERA MOVEMENT METADATA: Alternate camera motions ('zoom-in', 'pan-left', 'zoom-out', 'pan-right', 'static') across clips in the 'motion' field. NEVER use 'zoom-in' for all clips! Keep the 'image_prompt' focused purely on visual image content without video camera movement phrases.
6. Describe clear acoustic cues in the action (pop, thud, splash, thunder, creak, coins, chime, laugh, whoosh). The server automatically tags SFX from the narration and action; never put SFX words in the spoken narration.
7. In every clip's "image_prompt", anchor the locked character appearance and clothing without variation.

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

      const isVideo = (clip.recommended_media_type ?? "image") === "video";
      if (isVideo && !promptText.startsWith("Dynamic 4-second")) {
        promptText = `Dynamic 4-second animated video clip. ${promptText.replace(/\.\s*$/, "")}. Strictly 4.0 seconds duration. Continuous high-velocity motion.`;
      }

      const sfx =
        clip.sfx && clip.sfx !== "none"
          ? clip.sfx
          : detectSfxFromAction(clip.narration, promptText);

      return {
        id: newId(),
        index: clip.index || idx + 1,
        duration: isVideo ? 4.0 : clipDur,
        narration: clip.narration,
        imagePrompt: promptText,
        imageUrl: null,
        motion,
        sfx,
        recommendedMediaType: clip.recommended_media_type ?? "image",
        heroReason: clip.hero_reason || undefined,
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

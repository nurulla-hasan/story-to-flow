/**
 * Master Prompt Assembly with Production Context
 * 
 * Prepares system messages for the LLM across Story Studio workflow stages:
 * 1. Complete Package Generation (Legacy / All-in-one mode)
 * 2. Voiceover-First Script Generation (Stage 1)
 * 3. Scene & Shot Prompt Generation with Known Cartesia Duration (Stage 4)
 */

import { loadMasterPrompt } from "@/prompts/loader";
import type { ResolvedSettings } from "./settings";
import type { VisualAssetMode, VideoSoundMode } from "./validation";

function getAssetModeDirective(mode: VisualAssetMode, videoDurationSec: number = 4): string {
  switch (mode) {
    case "All Images":
      return `VISUAL ASSET MODE DIRECTIVE:
All Images Mode selected. Generate static-image prompts [🖼️ STATIC IMAGE] for every shot. Do not generate video-shot prompts. Every shot must be a static image.`;
    case "All Videos":
      return `VISUAL ASSET MODE DIRECTIVE:
All Videos Mode selected. Generate video-shot prompts [🎥 HERO VIDEO — ${videoDurationSec}.0s] for every shot. Do not generate static-image prompts. Every shot must be an animated video shot of strictly ${videoDurationSec}.0 seconds.`;
    case "Hybrid":
    default:
      return `VISUAL ASSET MODE DIRECTIVE:
Hybrid Mode selected (Default). Choose a sensible mix of static-image shots [🖼️ STATIC IMAGE] and video shots [🎥 HERO VIDEO — ${videoDurationSec}.0s] based on narrative importance, action, emotional beats, and continuity. High-impact moments, climaxes, and key action beats should be video shots (strictly ${videoDurationSec}.0 seconds); atmospheric, reflective, or dialogue scenes can be static images. Do not require every shot to be video, and avoid arbitrary alternating patterns.`;
  }
}

function getVideoSoundDirective(mode: VideoSoundMode): string {
  switch (mode) {
    case "Ambient Sound & SFX":
      return `VIDEO SOUND DIRECTIVE:
Ambient Sound & SFX selected. Video-shot prompts should specify relevant environmental sounds and sound effects (such as rain, wind, rustling trees, footsteps, river water, doors, room ambience) appropriate to the action. Do not generate dialogue or narration in video sound; the Cartesia voiceover remains the dedicated narration track.`;
    case "Full Generated Audio":
      return `VIDEO SOUND DIRECTIVE:
Full Generated Audio selected. Where appropriate to the shot and supported by video generation models, video prompts may specify environmental ambience, sound effects, and synchronous character reactions. Note: The Cartesia voiceover remains the authoritative narration track.`;
    case "Silent Video":
    default:
      return `VIDEO SOUND DIRECTIVE:
Silent Video selected (Default). Video-shot prompts must explicitly request silent visual output with no generated dialogue, narration, music, or audible sound effects. The Cartesia voiceover and background music tracks remain independent.`;
  }
}

export function getMachineReadablePlanDirective(videoDurationSec: number = 4): string {
  return `
MACHINE-READABLE SCENE & SHOT PLAN CONTRACT:
At the very end of your response, after all individual Story Scene code blocks, you MUST output a single machine-readable JSON code block containing the full structured timeline plan:
\`\`\`json
{
  "schemaVersion": 1,
  "scenes": [
    {
      "sceneId": "scene-01",
      "sceneNumber": 1,
      "title": "Scene title",
      "shots": [
        {
          "shotId": "scene-01-shot-01",
          "shotNumber": 1,
          "startTime": 0.0,
          "duration": 4.0,
          "mediaKind": "image",
          "voiceover": "Consecutive Bengali voiceover segment",
          "prompt": "Full English image prompt",
          "motion": {
            "type": "zoom-in",
            "amount": 0.15
          },
          "transitionToNext": {
            "type": "cross-dissolve",
            "duration": 0.5
          }
        }
      ]
    }
  ]
}
\`\`\`

SCHEMA & VALIDATION RULES:
1. schemaVersion MUST be 1.
2. sceneId and shotId must be stable, unique strings without duplicates (e.g. "scene-01", "scene-01-shot-01").
3. sceneNumber and shotNumber must be sequential positive integers.
4. startTime (seconds from timeline 0.0) and duration (seconds) must be finite positive numbers.
5. mediaKind MUST be strictly "image" or "video".
6. For video shots: set "mediaKind": "video", "sourceDuration": ${videoDurationSec}.0, and "duration" to the timeline coverage seconds.
7. Allowed motion.type values: "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "pan-up" | "pan-down". If motion is static/off, set "motion": null or omit it. Unsupported motion names are strictly rejected.
8. motion.amount: number between 0.05 and 0.5 (default 0.15).
9. transitionToNext: boundary transition suggestion between this shot and the next sequential shot. The last shot of the final scene MUST NOT have transitionToNext.
10. Allowed transitionToNext.type values: "cross-dissolve" | "fade-black" | "slide-left" | "slide-right". Unsupported transition types are strictly rejected.
11. transitionToNext.duration: number between 0.2 and 1.5 seconds (default 0.5).
`.trim();
}

/**
 * Assemble system message for Stage 1: Master Voiceover Script Generation Only.
 */
export function assembleVoiceoverSystemMessage(settings: ResolvedSettings): string {
  void settings;

  const voiceoverContext = `
==================================================
PRODUCTION CONTEXT — STAGE 1: MASTER VOICEOVER SCRIPT
==================================================

This stage only needs the original story; do NOT display or repeat production settings.
There is NO Target Video Duration setting. Determine the story and narration length naturally.
Your task in this stage is EXCLUSIVELY to write the complete, continuous Bangladeshi Bengali master voiceover script based on the original story.
Do NOT generate any scene blocks, shots, or image/video prompts in this stage.
The voiceover generated here will be reviewed and exported by the user to Cartesia for audio synthesis before visuals are planned.

VOICEOVER SPECIFICATIONS:
NARRATOR PERSONA — AN EXPRESSIVE BENGALI STORYTELLER
Speak naturally in Bangladeshi Bengali as a warm, intimate, emotionally attuned human storyteller—not as a plot summary, news bulletin, or robotic script.
- Open within the first five seconds with a concise, story-specific hook grounded in the source. Create curiosity without revealing a later answer, twist, climax, or ending early. Do not invent stakes or force a greeting.
- Preserve the source chronology and reveal order. Keep every material event, character motivation, cause-and-effect relationship, and ending; add no unsupported facts, backstory, accidents, or melodrama.
- Follow the story's emotional arc and use spoken-friendly rhythm: short sentences for urgency and more flowing lines for reflection. Use concrete actions and sensory detail only when supported by the story. Keep dialogue faithful to each character's intent.
- Write a complete continuous narration. Do not omit or rush story material to meet a runtime. There is no target-duration setting; approximately 2.4 Bengali words per second is only a rough planning estimate.
- Use natural paragraphs of roughly 2–4 sentences, with breaks at narrative beats for comfortable Cartesia pauses.
- The narration is the single source of truth for later scene prompts and captions.

OUTPUT FORMAT:
Output ONLY the final spoken Bengali narration in one clean copyable code block. Include no title, headings, scene or shot blocks, image/video prompts, acting notes, English text, music cues, or explanation.
==================================================
`.trim();

  return voiceoverContext;
}

/**
 * Assemble system message for Stage 4: Scene & Shot Prompt Generation with Known Voiceover & Measured Duration.
 */
export function assembleSceneSystemMessage(
  settings: ResolvedSettings,
  actualDuration: number
): string {
  const masterPrompt = loadMasterPrompt();

  const isAutoStyle = settings.visualStyle === "Auto";
  const visualStyleHeader = isAutoStyle
    ? "Auto (AI recommends and selects the most fitting visual style based on the story's genre, characters, environment, and emotional tone)"
    : settings.visualStyle;

  const videoDurationSec = settings.videoAssetDuration || 4;

  const pacingText =
    settings.staticFramePacing === "Auto"
      ? "Auto (AI recommends appropriate natural storytelling pacing, defaulting to approximately 4.0 seconds per static shot)"
      : `${settings.staticFramePacing} seconds per static image`;

  const staticShotPacingDirective =
    settings.staticFramePacing === "Auto"
      ? "Static-image shots should use natural storytelling pacing, defaulting to approximately 4.0 seconds per shot and adjusting to fit each narration beat."
      : "Static-image shots should default to approximately " + settings.staticFramePacing + " seconds per shot, adjusted when needed to fit the narration beat naturally.";
  const assetModeDirective = getAssetModeDirective(settings.visualAssetMode, videoDurationSec);
  const soundModeDirective = getVideoSoundDirective(settings.videoSoundMode);

  const sceneContext = `
==================================================
PRODUCTION CONTEXT — STAGE 4: SCENE & SHOT PROMPT GENERATION
==================================================

The user has reviewed and finalized the master voiceover script and measured its ACTUAL AUDIO DURATION in Cartesia.
The actual measured voiceover duration is: ${actualDuration.toFixed(2)} SECONDS (${Math.floor(actualDuration / 60)}m ${(actualDuration % 60).toFixed(1)}s).
Do NOT display or repeat the Phase 1 settings menu.
Generate the complete scene and shot prompt package covering the full ${actualDuration.toFixed(2)}s duration immediately.

CONFIRMED VISUAL SETTINGS:
- VISUAL STYLE: ${visualStyleHeader}
- ASPECT RATIO: ${settings.aspectRatio}
- MEASURED VOICEOVER DURATION: ${actualDuration.toFixed(2)} seconds
- STATIC SHOT PACING: ${pacingText}
- VIDEO SOURCE ASSET DURATION: ${videoDurationSec}.0 seconds
- VISUAL ASSET MODE: ${settings.visualAssetMode}
- VIDEO SOUND MODE: ${settings.videoSoundMode}

INFORMATIONAL NOTE ON VIDEO DURATION:
Use the same duration in your external video generator. If your chosen generator does not offer this duration, select a supported duration there and update this Studio setting to match.

CRITICAL SCENE VS. SHOT ARCHITECTURE:
- A Story Scene represents a coherent story event or narrative beat.
- A Shot is one visual composition used to depict part of that scene.
- One scene can contain multiple shots! Do not force every story scene to last exactly as long as one image.
- Do not treat the duration of a whole story scene as the duration of a single static image.
- ${staticShotPacingDirective}
- Hero-video source assets must strictly match the selected duration (${videoDurationSec}.0 SECONDS).
- The overall visual plan must provide complete, continuous coverage matching the actual voiceover duration (${actualDuration.toFixed(2)}s).

DYNAMIC HERO-VIDEO DURATION LOCK DIRECTIVE:
For every hero-video shot:
- The header MUST say: [🎥 HERO VIDEO — ${videoDurationSec}.0s].
- The prompt MUST begin: "VIDEO GENERATION — NOT A STATIC IMAGE. Create one continuous ${videoDurationSec}.0-second animated video shot..."
- The prompt MUST end: "This must remain a moving video for the full ${videoDurationSec}.0 seconds, ending with [specific visible final state]. Strictly ${videoDurationSec}.0 seconds duration."
- Distinguish generated source asset duration (${videoDurationSec}.0s) from timeline-use duration. If timeline coverage is shorter than ${videoDurationSec}.0s, include an EDIT NOTE specifying the shorter timeline trim. If narration exceeds ${videoDurationSec}.0s, specify a final-frame hold or extension in EDIT NOTE.

${assetModeDirective}

${soundModeDirective}

SCENE & SHOT OUTPUT FORMAT (ONE CODE BLOCK PER STORY SCENE):
Each Story Scene represents a coherent narrative beat and MUST be contained within ONE fenced code block including all SHOT entries inside that scene.
Do not label every individual shot as a separate Story Scene.

Template:
SCENE #01 (0:00 - 0:10 • 10.0s coverage)

SHOT #01 (0:00 - 0:04 • 4.0s • zoom-in) [🖼️ STATIC IMAGE]
VOICEOVER: [exact consecutive Bengali segment from master voiceover]
EDITOR TEXT OVERLAY: "[Exact Bengali wording]" • Placement: [Center] • Style: [White Bengali Subtitle] (OPTIONAL)
PROMPT: [continuous English prose paragraph]

SHOT #02 (0:04 - 0:10 • 6.0s coverage [${videoDurationSec}.0s source] • pan-right) [🎥 HERO VIDEO — ${videoDurationSec}.0s]
VOICEOVER: [exact consecutive Bengali segment from master voiceover]
EDIT NOTE: [Hold final frame or trim note if timeline coverage differs from asset duration]
PROMPT: VIDEO GENERATION — NOT A STATIC IMAGE. Create one continuous ${videoDurationSec}.0-second animated video shot [Action feasible in ${videoDurationSec}.0s]. This must remain a moving video for the full ${videoDurationSec}.0 seconds, ending with [specific visible final state]. Strictly ${videoDurationSec}.0 seconds duration.

Do not invent new story events. When an original story outline is provided, it is authoritative for facts; the voiceover controls narration pacing. When direct voiceover is provided without a separate story outline, the voiceover script itself is the sole authoritative narrative source for all characters, scenes, emotions, and visual events.

${getMachineReadablePlanDirective(videoDurationSec)}
==================================================
`.trim();

  return `${sceneContext}\n\n${masterPrompt.content}`;
}

/**
 * Assemble the complete system message for the LLM (legacy / all-in-one mode).
 * 
 * The Master Prompt remains unchanged. Production context is added
 * as a clearly separated instruction that communicates the resolved settings
 * and tells the model to skip the interactive Phase 1 settings menu.
 * 
 * @param settings - Fully resolved production settings
 * @returns Complete system message string
 */
export function assembleSystemMessage(settings: ResolvedSettings): string {
  const masterPrompt = loadMasterPrompt();

  const isAutoStyle = settings.visualStyle === "Auto";

  // Format visual style for display
  const visualStyleHeader = isAutoStyle
    ? "Auto (AI recommends and selects the most fitting visual style based on the story's genre, characters, environment, and emotional tone)"
    : settings.visualStyle;

  const videoDurationSec = settings.videoAssetDuration || 4;

  // Format static frame pacing for display
  const pacingText =
    settings.staticFramePacing === "Auto"
      ? "Auto (AI recommends appropriate natural storytelling pacing, defaulting to approximately 4.0 seconds per static shot)"
      : `${settings.staticFramePacing} seconds per static image`;

  const visualStyleDirective = isAutoStyle
    ? `VISUAL STYLE DIRECTIVE:
Visual Style is set to Auto. Analyze the story's genre, characters, environment, and emotional tone
to select the most fitting visual style (such as 3D Animated Cartoon, Cinematic Realism, Painterly
Storybook, Anime & Manga Style, Warm Rural Drama, etc.). Briefly state your chosen visual style
in the production package, and apply it with expressive characters, consistent character designs,
cohesive environments, attractive colors, and cinematic lighting appropriate to the story.
Maintain this chosen visual style consistently across all scenes.`
    : `The visual style "${settings.visualStyle}" should use polished animation or illustration,
expressive characters, consistent character designs, cohesive environments, attractive colors,
and cinematic lighting appropriate to the story. Maintain consistent style across all scenes.`;

  const assetModeDirective = getAssetModeDirective(settings.visualAssetMode, videoDurationSec);
  const soundModeDirective = getVideoSoundDirective(settings.videoSoundMode);

  // Production context instruction
  const productionContext = `
==================================================
PRODUCTION CONTEXT — SETTINGS ALREADY CONFIRMED
==================================================

The website has already collected and confirmed all production settings.
Do NOT display or repeat the Phase 1 settings menu.
There is NO Target Video Duration setting. Determine the story and narration length naturally.
Unless the Clarification Exception below applies, generate the complete
production package immediately using these confirmed settings:

VISUAL STYLE: ${visualStyleHeader}
ASPECT RATIO: ${settings.aspectRatio}
STATIC FRAME PACING: ${pacingText}
VIDEO SOURCE ASSET DURATION: ${videoDurationSec}.0 seconds
VISUAL ASSET MODE: ${settings.visualAssetMode}
VIDEO SOUND MODE: ${settings.videoSoundMode}

Apply these settings while preserving all Master Prompt requirements:
- Source-fidelity and chronology rules (PHASE 0)
- Natural Bangladeshi Bengali narrator voiceover (PHASE 2)
- Exact narration alignment (PHASE 4)
- Scene selection and timing rules (PHASE 5)
- Output format with full voiceover and scene blocks (PHASE 9)
- Quality checks (PHASE 10)

${visualStyleDirective}

${assetModeDirective}

${soundModeDirective}

Do not invent story facts when processing a complete source story.
Follow all retention hook, narration, and output format rules exactly.

CLARIFICATION EXCEPTION (STRICT PRECEDENCE OVER IMMEDIATE GENERATION):
If processing a complete source story reveals a material contradiction or essential ambiguity
that cannot be resolved without inventing story facts, this requirement takes absolute precedence
over immediate generation: ask exactly ONE concise standalone clarification question instead of
generating the production package, and wait for the user's answer.
Do NOT display or repeat the full Phase 1 settings menu when asking for clarification.
If the story has no material contradiction or essential ambiguity, proceed directly using the
confirmed settings without an extra confirmation round.

${getMachineReadablePlanDirective(videoDurationSec)}

==================================================
`.trim();

  // Combine production context with master prompt
  return `${productionContext}\n\n${masterPrompt.content}`;
}

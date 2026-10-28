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
import type { VisualAssetMode, VideoSoundMode, VideoAssetDuration } from "./validation";

function getAssetModeDirective(mode: VisualAssetMode, videoDurationSec: VideoAssetDuration): string {
  const videoDurationLabel = `${videoDurationSec}.0s`;
  switch (mode) {
    case "All Images":
      return `VISUAL ASSET MODE DIRECTIVE:
All Images Mode selected. Generate static-image prompts [🖼️ STATIC IMAGE] for every shot. Do not generate video-shot prompts. Every shot must be a static image.`;
    case "All Videos":
      return `VISUAL ASSET MODE DIRECTIVE:
All Videos Mode selected. Generate video-shot prompts [🎥 HERO VIDEO — ${videoDurationLabel}] for every shot. Do not generate static-image prompts. Every shot must be an animated video shot of strictly ${videoDurationSec}.0 seconds.`;
    case "Hybrid":
    default:
      return `VISUAL ASSET MODE DIRECTIVE:
Hybrid Mode selected (Default). Choose a sensible mix of static-image shots [🖼️ STATIC IMAGE] and video shots [🎥 HERO VIDEO — ${videoDurationLabel}] based on narrative importance, action, emotional beats, and continuity. High-impact moments, climaxes, and key action beats should be video shots (strictly ${videoDurationSec}.0 seconds); atmospheric, reflective, or dialogue scenes can be static images. Do not require every shot to be video, and avoid arbitrary alternating patterns.`;
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

/**
 * Assemble system message for Stage 1: Master Voiceover Script Generation Only.
 */
export function assembleVoiceoverSystemMessage(settings: ResolvedSettings): string {
  void settings;
  const masterPrompt = loadMasterPrompt();

  const voiceoverContext = `
==================================================
PRODUCTION CONTEXT — STAGE 1: MASTER VOICEOVER SCRIPT
==================================================

The website has already collected all production settings.
Do NOT display or repeat the Phase 1 settings menu.
There is NO Target Video Duration setting. Determine the story and narration length naturally.
Your task in this stage is EXCLUSIVELY to write the complete, continuous Bangladeshi Bengali master voiceover script based on the original story.
Do NOT generate any scene blocks, shots, or image/video prompts in this stage.
The voiceover generated here will be reviewed and exported by the user to Cartesia for audio synthesis before visuals are planned.

VOICEOVER SPECIFICATIONS:
- Natural Bangladeshi Bengali narrator persona: warm, intimate, conversational, emotionally attuned human storyteller (PHASE 2).
- Audience-retention hook within the first 5 seconds.
- Dynamic rhythm and sentence length mirroring the emotional progression.
- Strict source-fidelity: preserve all characters, motives, causality, and ending. No invented facts.
- Word count calibration: approximately 2.4 spoken words per second.

OUTPUT FORMAT:
Output the master voiceover script cleanly in a single code block or text section. Do not output any scene blocks.
==================================================
`.trim();

  return `${voiceoverContext}\n\n${masterPrompt.content}`;
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

  const pacingText =
    settings.staticFramePacing === "Auto"
      ? "Auto (Default 4.0s per static image)"
      : `${settings.staticFramePacing} seconds per static image`;

  const videoDurationSec = settings.videoAssetDuration || 4;

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
- Static-image shots should default to approximately ${pacingText} per shot (or adjusted to fit the narration beat naturally).
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

Do not invent new story events. The original story is authoritative for facts; the voiceover controls narration pacing.
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

  // Format static frame pacing for display
  const pacingText =
    settings.staticFramePacing === "Auto"
      ? "Auto (AI will choose appropriate pacing)"
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

  const videoDurationSec = settings.videoAssetDuration || 4;

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

==================================================
`.trim();

  // Combine production context with master prompt
  return `${productionContext}\n\n${masterPrompt.content}`;
}

/**
 * Master Prompt Assembly with Production Context
 * 
 * Prepares the complete system message for the LLM by combining:
 * 1. The authoritative Master Prompt text (current version loaded dynamically)
 * 2. Production context instructions based on resolved settings
 */

import { loadMasterPrompt } from "@/prompts/loader";
import type { ResolvedSettings } from "./settings";

/**
 * Assemble the complete system message for the LLM.
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

  // Format duration for display
  const durationText =
    settings.duration === "Auto"
      ? "Auto (AI will recommend appropriate duration)"
    : `${settings.duration} seconds`;

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

  // Production context instruction
  const productionContext = `
==================================================
PRODUCTION CONTEXT — SETTINGS ALREADY CONFIRMED
==================================================

The website has already collected and confirmed all production settings.
Do NOT display or repeat the Phase 1 settings menu.
Generate the complete production package immediately using these settings:

VISUAL STYLE: ${visualStyleHeader}
ASPECT RATIO: ${settings.aspectRatio}
TARGET DURATION: ${durationText}
STATIC FRAME PACING: ${pacingText}

Apply these settings while preserving all Master Prompt requirements:
- Source-fidelity and chronology rules (PHASE 0)
- Natural Bangladeshi Bengali narrator voiceover (PHASE 2)
- Exact narration alignment (PHASE 4)
- Scene selection and timing rules (PHASE 5)
- Output format with full voiceover and scene blocks (PHASE 9)
- Quality checks (PHASE 10)

${visualStyleDirective}

Do not invent story facts when processing a complete source story.
Follow all retention hook, narration, and output format rules exactly.

Proceed directly to generating the production package.

==================================================
`.trim();

  // Combine production context with master prompt
  return `${productionContext}\n\n${masterPrompt.content}`;
}

/**
 * Production Package Output Parser
 * 
 * Robust extractor for Master Prompt v1.5.5 Markdown output.
 * Separates the raw AI response into:
 * 1. Full Voiceover (continuous Bengali narration)
 * 2. Scene & Image Prompts (prompts, timecodes, camera directions, with VOICEOVER lines omitted)
 * 
 * Never discards raw data. Provides graceful fallback when output format deviates.
 */

export interface ParsedScene {
  sceneNumber: string;
  header: string;
  prompt: string;
  fullBlock: string;
}

export interface ParsedOutput {
  success: boolean;
  voiceover: string | null;
  scenesText: string | null;
  scenes: ParsedScene[];
  visualStyle?: string;
  timingNote?: string;
  rawText: string;
  fallbackMessage?: string;
}

/**
 * Remove markdown code fence wrappers from a text block
 */
function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  // Remove starting ```text, ```markdown, or ```
  cleaned = cleaned.replace(/^```[a-zA-Z0-9_-]*\s*\n?/i, "");
  // Remove ending ```
  cleaned = cleaned.replace(/\n?```\s*$/i, "");
  return cleaned.trim();
}

/**
 * Omit VOICEOVER lines from scene text while keeping scene headers,
 * PROMPT lines, timecodes, and camera directives intact.
 */
function removeVoiceoverLines(sceneBlock: string): string {
  const lines = sceneBlock.split("\n");
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    return !trimmed.startsWith("VOICEOVER:") && !trimmed.startsWith("VOICEOVER :");
  });
  return filtered.join("\n").trim();
}

/**
 * Parse the raw AI response into structured voiceover and scenes
 */
export function parseProductionPackage(raw: string | null | undefined): ParsedOutput {
  const fallbackResult: ParsedOutput = {
    success: false,
    voiceover: null,
    scenesText: null,
    scenes: [],
    rawText: raw || "",
  };

  if (!raw || typeof raw !== "string" || !raw.trim()) {
    return fallbackResult;
  }

  const rawText = raw.trim();

  try {
    // 1. Extract Visual Style if stated in header
    let visualStyle: string | undefined;
    const styleMatch = rawText.match(/\*\*Chosen Visual Style:\*\*\s*\*\*?([^*\n]+)\*\*?/i) ||
      rawText.match(/Visual Style:\s*([^\n]+)/i);
    if (styleMatch?.[1]) {
      visualStyle = styleMatch[1].trim();
    }

    // 2. Identify Part 1 (Voiceover) and Part 2 (Scenes) sections
    // Match flexible part markers like "PART 1", "PART 1 — FULL VOICEOVER", "### PART 1"
    const part1Regex = /(?:#+\s*)?PART\s*1\s*[-—:]*\s*(?:FULL\s*VOICEOVER)?/i;
    const part2Regex = /(?:#+\s*)?PART\s*2\s*[-—:]*\s*(?:SCENE-BY-SCENE\s*PROMPTS|SCENE\s*PROMPTS)?/i;
    const timingRegex = /(?:#+\s*)?(?:PART\s*3|TIMING\s*(?:&|AND)?\s*HERO\s*VIDEO)/i;

    const part1Index = rawText.search(part1Regex);
    const part2Index = rawText.search(part2Regex);

    if (part1Index === -1 && part2Index === -1) {
      // Missing standard PART headers - check if we can at least find code blocks or scenes
      if (rawText.includes("SCENE #") || rawText.includes("SCENE 0") || rawText.includes("SCENE 1")) {
        // Attempt relaxed extraction
        return extractRelaxedFormat(rawText, visualStyle);
      }
      return {
        ...fallbackResult,
        rawText,
        fallbackMessage: "Could not find standard PART 1 and PART 2 section headers.",
      };
    }

    let voiceoverText: string | null = null;
    let scenesRawSection = "";
    let timingNote: string | undefined;

    // Extract Part 1 (between Part 1 and Part 2)
    if (part1Index !== -1 && part2Index !== -1 && part2Index > part1Index) {
      const part1Section = rawText.slice(part1Index, part2Index);
      // Look for code block inside Part 1
      const codeBlockMatch = part1Section.match(/```(?:text|markdown)?\s*\n([\s\S]*?)\n```/i);
      if (codeBlockMatch?.[1]) {
        voiceoverText = codeBlockMatch[1].trim();
      } else {
        // Fallback: strip header line and any dividers
        const lines = part1Section.split("\n");
        const bodyLines = lines.slice(1).filter((l) => !l.trim().startsWith("---"));
        voiceoverText = stripCodeFences(bodyLines.join("\n"));
      }

      // Extract Part 2 (from Part 2 onwards)
      const afterPart2 = rawText.slice(part2Index);
      const timingIndex = afterPart2.search(timingRegex);
      if (timingIndex !== -1) {
        scenesRawSection = afterPart2.slice(0, timingIndex);
        timingNote = stripCodeFences(afterPart2.slice(timingIndex));
      } else {
        scenesRawSection = afterPart2;
      }
    } else if (part2Index !== -1) {
      // Only Part 2 found
      scenesRawSection = rawText.slice(part2Index);
    }

    // Process Scene Blocks from scenesRawSection
    const scenes: ParsedScene[] = [];
    const sceneRegex = /```(?:text|markdown)?\s*\n(SCENE\s*#?\d+[\s\S]*?)\n```/gi;
    let match: RegExpExecArray | null;

    while ((match = sceneRegex.exec(scenesRawSection)) !== null) {
      const fullBlock = match[1].trim();
      const firstLine = fullBlock.split("\n")[0] || "";
      const sceneNumMatch = firstLine.match(/SCENE\s*#?\d+/i);
      const sceneNumber = sceneNumMatch ? sceneNumMatch[0].toUpperCase() : `SCENE #${scenes.length + 1}`;

      const promptMatch = fullBlock.match(/PROMPT:\s*([\s\S]*)$/i);
      const prompt = promptMatch ? promptMatch[1].trim() : "";

      const cleanBlock = removeVoiceoverLines(fullBlock);

      scenes.push({
        sceneNumber,
        header: firstLine,
        prompt,
        fullBlock: cleanBlock,
      });
    }

    // If separate code blocks weren't used, look for continuous SCENE # markers
    if (scenes.length === 0) {
      const rawScenesText = stripCodeFences(
        scenesRawSection.replace(part2Regex, "").replace(/^[\s\S]*?(?=SCENE)/i, "")
      );

      const splitByScene = rawScenesText.split(/(?=SCENE\s*#?\d+)/i);
      for (const block of splitByScene) {
        const trimmed = block.trim();
        if (!trimmed) continue;
        const firstLine = trimmed.split("\n")[0] || "";
        const sceneNumMatch = firstLine.match(/SCENE\s*#?\d+/i);
        if (!sceneNumMatch) continue;

        const sceneNumber = sceneNumMatch[0].toUpperCase();
        const promptMatch = trimmed.match(/PROMPT:\s*([\s\S]*)$/i);
        const prompt = promptMatch ? promptMatch[1].trim() : "";
        const cleanBlock = removeVoiceoverLines(trimmed);

        scenes.push({
          sceneNumber,
          header: firstLine,
          prompt,
          fullBlock: cleanBlock,
        });
      }
    }

    // Assemble the complete scene prompts text (for Copy All Scene Prompts)
    const scenesText = scenes.length > 0
      ? scenes.map((s) => s.fullBlock).join("\n\n")
      : null;

    const success = Boolean(voiceoverText || (scenes.length > 0));

    return {
      success,
      voiceover: voiceoverText,
      scenesText,
      scenes,
      visualStyle,
      timingNote,
      rawText,
      fallbackMessage: success ? undefined : "Output structure deviated from expected template.",
    };
  } catch (err) {
    return {
      ...fallbackResult,
      rawText,
      fallbackMessage: `Parsing error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Fallback parser for outputs that have scene markers but non-standard headers
 */
function extractRelaxedFormat(rawText: string, visualStyle?: string): ParsedOutput {
  const scenes: ParsedScene[] = [];
  const sceneRegex = /(SCENE\s*#?\d+[\s\S]*?)(?=(?:SCENE\s*#?\d+|$))/gi;
  let match: RegExpExecArray | null;

  while ((match = sceneRegex.exec(rawText)) !== null) {
    const block = match[1].trim();
    if (!block) continue;
    const firstLine = block.split("\n")[0] || "";
    const sceneNumMatch = firstLine.match(/SCENE\s*#?\d+/i);
    const sceneNumber = sceneNumMatch ? sceneNumMatch[0].toUpperCase() : `SCENE #${scenes.length + 1}`;
    const promptMatch = block.match(/PROMPT:\s*([\s\S]*)$/i);
    const prompt = promptMatch ? promptMatch[1].trim() : "";
    const cleanBlock = removeVoiceoverLines(stripCodeFences(block));

    scenes.push({
      sceneNumber,
      header: firstLine,
      prompt,
      fullBlock: cleanBlock,
    });
  }

  // Look for any Bengali block for voiceover
  const bengaliBlockMatch = rawText.match(/```(?:text)?\s*\n([\u0980-\u09FF\s\S]*?)\n```/);
  const voiceover = bengaliBlockMatch ? bengaliBlockMatch[1].trim() : null;

  return {
    success: scenes.length > 0,
    voiceover,
    scenesText: scenes.map((s) => s.fullBlock).join("\n\n"),
    scenes,
    visualStyle,
    rawText,
  };
}

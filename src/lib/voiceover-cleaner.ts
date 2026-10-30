/**
 * Voiceover Script Sanitization and Normalization
 *
 * Removes Markdown code fences (e.g. ```text, ```markdown, ```) while
 * preserving 100% of internal Bengali narration prose, punctuation,
 * and paragraph breaks for Cartesia TTS and UI display.
 */

/**
 * Defensively strips outer Markdown code fences from voiceover scripts.
 * Leaves internal Bengali text, punctuation, and paragraph breaks intact.
 */
export function stripMarkdownCodeFence(text: string | null | undefined): string {
  if (!text) return "";

  const cleaned = text.trim();

  // 1. Check if the entire string (or trimmed string) is enclosed in an outer code fence
  // e.g. ```text\n...\n``` or ```markdown\n...\n``` or ```\n...\n```
  const fullFenceMatch = cleaned.match(/^```[a-zA-Z0-9_-]*[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```$/);
  if (fullFenceMatch) {
    return fullFenceMatch[1].trim();
  }

  // 2. Handle fence without trailing newline before closing: ```text\n...```
  const tightFenceMatch = cleaned.match(/^```[a-zA-Z0-9_-]*[ \t]*\r?\n([\s\S]*?)[ \t]*```$/);
  if (tightFenceMatch) {
    return tightFenceMatch[1].trim();
  }

  // 3. If there is an introductory label or heading before the fence, extract the fenced block content
  // e.g. "Master Voiceover Script:\n```text\n...\n```"
  const embeddedFenceMatch = cleaned.match(/```(?:text|markdown)?\s*\r?\n([\s\S]*?)\r?\n\s*```/);
  if (embeddedFenceMatch) {
    const inside = embeddedFenceMatch[1].trim();
    if (inside.length > 0) {
      return inside;
    }
  }

  // 4. Return as clean plain text
  return cleaned;
}

/**
 * Accurately counts words in a voiceover script after stripping any outer code fences.
 */
export function countVoiceoverWords(text: string | null | undefined): number {
  const clean = stripMarkdownCodeFence(text);
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

/**
 * Estimates speaking duration in seconds at approximately 2.4 Bengali words per second.
 */
export function estimateVoiceoverDurationSeconds(text: string | null | undefined): number {
  const words = countVoiceoverWords(text);
  return Math.round(words / 2.4);
}

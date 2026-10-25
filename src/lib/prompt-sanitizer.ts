/**
 * Shared prompt cleanup helpers.
 *
 * Kept free of Node-only imports so the same logic can run on the server and
 * in the client-side prompt re-sync path.
 */

/**
 * Overrides / strips locked props from a character description when the prop is
 * detached in the action. Prevents image models from hallucinating duplicate
 * items (e.g. glasses on the face and in a crow's beak).
 */
export function sanitizeDetachedProps(prompt: string, narration = ""): string {
  let cleaned = prompt;
  const context = (narration + " " + prompt).toLowerCase();

  // Spectacles / Glasses snatched, fallen, in beak, or missing
  const hasDetachedSpectacles =
    /\b(crow|bird|thief|monkey|beak)\b[^.]*\b(spectacles|glasses)\b/i.test(context) ||
    /\b(spectacles|glasses)\b[^.]*\b(snatched|stolen|falls?|fell|flying away|flew away|held in|in the beak|dropped|missing|dislodged|knocked off|on the (?:floor|ground))\b/i.test(context);

  if (hasDetachedSpectacles) {
    cleaned = cleaned
      .replace(/\b(wearing|with)\s+[^,.]*?(round\s+)?(black\s+|brass\s+|wire\s+)?(thick\s+)?(spectacles|glasses)[^,.]*?,?/gi, "with spectacles missing and bare squinting eyes,")
      .replace(/\bperched on (?:his|the) nose,?/gi, "")
      .replace(/\bthick black round spectacles\b/gi, "bare squinting eyes (spectacles missing)")
      .replace(/\bround wire spectacles\b/gi, "bare squinting eyes (spectacles missing)");
  }

  // Hat / Cap removed, blown away, or knocked off
  const hasDetachedHat =
    /\b(hat|cap)\b.*\b(blows? away|blown away|flies away|flying away|falls?|fell|knocked off|snatched|dropped|stolen|missing)\b/i.test(context);

  if (hasDetachedHat) {
    cleaned = cleaned
      .replace(/\b(wearing\s+(?:a\s+)?)?[^,.]*?\b(hat|cap)\b[^,.]*?,?/gi, "bareheaded (hat missing),");
  }

  // Teacup / Cup dropped, spilled, or shattering
  const hasDetachedCup =
    /\b(cup|teacup|mug)\b.*\b(slips?|falls?|fell|dropped|shatters?|shattered|spill|spilt|flying|in the air)\b/i.test(context);

  if (hasDetachedCup) {
    cleaned = cleaned
      .replace(/\b(holding|sipping from)\s+(?:a\s+)?(steaming\s+)?(hot\s+)?(tea\s*)?(cup|teacup|mug)[^,.]*?,?/gi, "empty startled hands with cup falling,");
  }

  return cleaned;
}

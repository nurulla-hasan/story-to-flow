import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, ensureDirs } from "./files";
import type { StudioProject } from "@/components/studio/types";

const STUDIO_PROJECT_FILE = path.join(DATA_DIR, "studio-project.json");

export function loadStudioProject(): StudioProject | null {
  try {
    ensureDirs();
    if (!fs.existsSync(STUDIO_PROJECT_FILE)) {
      return null;
    }
    const raw = fs.readFileSync(STUDIO_PROJECT_FILE, "utf-8");
    return JSON.parse(raw) as StudioProject;
  } catch (err) {
    console.warn("[studio] Failed to load studio project:", err);
    return null;
  }
}

export function saveStudioProject(project: StudioProject): void {
  try {
    ensureDirs();
    fs.writeFileSync(STUDIO_PROJECT_FILE, JSON.stringify(project, null, 2), "utf-8");
  } catch (err) {
    console.error("[studio] Failed to save studio project:", err);
  }
}

export function clearStudioProject(): void {
  try {
    ensureDirs();
    if (fs.existsSync(STUDIO_PROJECT_FILE)) {
      fs.unlinkSync(STUDIO_PROJECT_FILE);
    }
  } catch (err) {
    console.warn("[studio] Failed to clear studio project:", err);
  }
}

/**
 * Overrides / strips locked props from character description when the prop is detached in action.
 * Prevents image models from hallucinating duplicate items (e.g. glasses on face and in crow's beak).
 */
export function sanitizeDetachedProps(prompt: string, narration = ""): string {
  let cleaned = prompt;
  const context = (narration + " " + prompt).toLowerCase();

  // Spectacles / Glasses snatched, fallen, in beak, or missing
  const hasDetachedSpectacles =
    /\b(crow|bird|thief|monkey|wind|hand|beak|ground|floor|air)\b.*\b(spectacles|glasses)\b/i.test(context) ||
    /\b(spectacles|glasses)\b.*\b(snatched|stolen|falls?|fell|flying away|flew away|held in|in the beak|dropped|missing|dislodged|knocked off)\b/i.test(context);

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

export function formatTimeRange(startSec: number, endSec: number): string {
  const sm = Math.floor(startSec / 60);
  const ss = Math.floor(startSec % 60);
  const em = Math.floor(endSec / 60);
  const es = Math.floor(endSec % 60);
  return `${sm}:${ss.toString().padStart(2, "0")} - ${em}:${es.toString().padStart(2, "0")}`;
}

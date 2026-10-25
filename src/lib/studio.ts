import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, ensureDirs } from "./files";
import type { SfxType, StudioProject } from "@/components/studio/types";

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

// Re-exported for existing server-side imports. The implementation lives in a
// client-safe module so prompt re-assembly can also run in the browser.
export { sanitizeDetachedProps } from "./prompt-sanitizer";

export function formatTimeRange(startSec: number, endSec: number): string {
  const sm = Math.floor(startSec / 60);
  const ss = Math.floor(startSec % 60);
  const em = Math.floor(endSec / 60);
  const es = Math.floor(endSec % 60);
  return `${sm}:${ss.toString().padStart(2, "0")} - ${em}:${es.toString().padStart(2, "0")}`;
}

export function detectSfxFromAction(narration: string, actionOrPrompt = ""): SfxType {
  const text = (narration + " " + actionOrPrompt).toLowerCase();

  // 1. Pop / bubble burst
  if (/(ফটাস|ফটা-আ-স্|বুদবুদ|বাবল|ফেটে|\b(pop|bubble|burst|snap)\b)/i.test(text)) {
    return "cartoon-pop";
  }

  // 2. Heavy thud / crash / fall
  if (
    /(ধপাস|ধপা-আ-স্|আছড়ে|পড়ল|তোশক|তোশকে|বিছানায়|\b(thud|crash|slam|mattress|lands hard|falls onto)\b)/i.test(
      text,
    )
  ) {
    return "heavy-thud";
  }

  // 3. Crow / Bird
  if (/(কাক|দাঁড়কাক|কা-কা|পাখি|ঠোঁটে|\b(crow|bird|caw|beak|screech)\b)/i.test(text)) {
    return "crow-caw";
  }

  // 4. Cup / Glass shatter
  if (/(কাপ|গ্লাস|ভেঙে|ছিটকে|পড়ে গেল|\b(shatter|cup|glass|mug|clink|spill)\b)/i.test(text)) {
    return "glass-shatter";
  }

  // 5. Magic / time freeze / lever
  if (
    /(লিভার|থমকে গেল|জাদু|জাদুকরী|আলো|ম্যাজিক|\b(magic|lever|time freeze|sparkle|glow|freeze time)\b)/i.test(
      text,
    )
  ) {
    return "magic-chime";
  }

  // 6. Whoosh / Speed / Flight
  if (/(হুশ|হু-উ-শ|উড়ে|উড়াল|ঝাঁপ|ছুটে|\b(whoosh|swoop|flies|soar|swift|darts)\b)/i.test(text)) {
    return "whoosh";
  }

  // 7. Boing / Spring
  if (/(লাফ|লাফিয়ে|বাউন্স|\b(boing|spring|bounce|recoil)\b)/i.test(text)) {
    return "boing";
  }

  // 8. Clock tick
  if (/(টিকটিক|ঘড়ি|ঘড়ির দোকান|কাঁটা|\b(clock|tick|ticking|watchmaker)\b)/i.test(text)) {
    return "clock-tick";
  }

  return "none";
}

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
  ensureDirs();
  fs.writeFileSync(STUDIO_PROJECT_FILE, JSON.stringify(project, null, 2), "utf-8");
}

export function clearStudioProject(): void {
  ensureDirs();
  if (fs.existsSync(STUDIO_PROJECT_FILE)) {
    fs.unlinkSync(STUDIO_PROJECT_FILE);
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

  // 1. Storm / lightning
  if (
    /(\b(thunder|thunderclap|lightning|storm)\b|বজ্র|বিদ্যুৎ|মেঘের গর্জন)/i.test(
      text,
    )
  ) {
    return "thunder";
  }

  // 2. Spooky door / hinge
  if (
    /(\b(creak|creaks|creaked|creaking|hinge)\b|দরজা.*(ক্যাঁচ|কিচমিচ)|কিচমিচ|ক্যাঁচ)/i.test(
      text,
    )
  ) {
    return "door-creak";
  }

  // 3. Door slam / bang shut
  if (
    /(\b(door|gate)\b[^.]*\b(slam|slams|slammed|bang|bangs|shut)\b|\b(slam|bang)\b[^.]*\b(door|gate)\b|দরজা.*(ধপ|স্ল্যাম|বন্ধ))/i.test(
      text,
    )
  ) {
    return "door-slam";
  }

  // 4. Ghost / villain laugh
  if (
    /(\b(evil|ghost|villain|wicked|mischievous)\b[^.]*\b(laugh|laughs|laughing|chuckle|chuckles|cackle)\b|অট্টহাসি|হো-হো|হা-হা|দুষ্ট.*হাসি|ভূত.*হাসি)/i.test(
      text,
    )
  ) {
    return "evil-laugh";
  }

  // 5. Dramatic twist / meme boom
  if (
    /(\b(vine boom|dramatic boom|shock|twist|dramatic reveal|plot twist)\b|চমকে|টুইস্ট|বিস্ময়)/i.test(
      text,
    )
  ) {
    return "vine-boom";
  }

  // 6. Pop / bubble burst
  if (/(ফটাস|ফটা-আ-স্|বুদবুদ|বাবল|ফেটে|\b(pop|bubble|burst|snap)\b)/i.test(text)) {
    return "cartoon-pop";
  }

  // 7. Head hit / coconut bonk
  if (
    /(\b(bonk|bonks|bonked|bonking|head hit|head hits|coconut|knock on the head)\b|মাথায়.*(আঘাত|ঠোকা|ঠোকর)|ঠোকর|নারকেল)/i.test(
      text,
    )
  ) {
    return "bonk";
  }

  // 8. Slip / banana peel / comic tumble
  if (
    /(\b(slip|slips|slipped|slipping|banana peel|pratfall)\b|পিছলে|কলার খোসা|পা পিছলে)/i.test(
      text,
    )
  ) {
    return "cartoon-slip";
  }

  // 9. Heavy thud / crash / fall
  if (
    /(ধপাস|ধপা-আ-স্|আছড়ে|পড়ল|তোশক|তোশকে|বিছানায়|\b(thud|crash|slam|mattress|lands hard|falls onto)\b)/i.test(
      text,
    )
  ) {
    return "heavy-thud";
  }

  // 10. Water / pond / mud splash
  if (
    /(\b(splash|splashes|splashed|splashing)\b|পানিতে|জলে|কাদায়|দইয়ে|পুকুরে|নদীতে)/i.test(
      text,
    )
  ) {
    return "water-splash";
  }

  // 11. Crow / Bird
  if (/(কাক|দাঁড়কাক|কা-কা|পাখি|ঠোঁটে|\b(crow|bird|caw|beak|screech)\b)/i.test(text)) {
    return "crow-caw";
  }

  // 12. Coins / gold treasure
  if (
    /(\b(coins?|gold|treasure|jingle)\b|মুদ্রা|স্বর্ণ|গুপ্তধন|টাকা)/i.test(
      text,
    )
  ) {
    return "coin-clink";
  }

  // 13. Cup / Glass shatter
  if (/(কাপ|গ্লাস|ভেঙে|ছিটকে|পড়ে গেল|\b(shatter|cup|glass|mug|clink|spill)\b)/i.test(text)) {
    return "glass-shatter";
  }

  // 14. Magic / time freeze / lever
  if (
    /(লিভার|থমকে গেল|জাদু|জাদুকরী|আলো|ম্যাজিক|\b(magic|lever|time freeze|sparkle|glow|freeze time)\b)/i.test(
      text,
    )
  ) {
    return "magic-chime";
  }

  // 15. Whoosh / Speed / Flight
  if (/(হুশ|হু-উ-শ|উড়ে|উড়াল|ঝাঁপ|ছুটে|\b(whoosh|swoop|flies|soar|swift|darts)\b)/i.test(text)) {
    return "whoosh";
  }

  // 16. Boing / Spring
  if (/(লাফ|লাফিয়ে|বাউন্স|\b(boing|spring|bounce|recoil)\b)/i.test(text)) {
    return "boing";
  }

  // 17. Comedy fail / sad trombone
  if (
    /(\b(sad trombone|wah wah|wah-wah|fail|fails|failed|defeat|embarrassing)\b|ব্যর্থ|হতাশ|লজ্জা)/i.test(
      text,
    )
  ) {
    return "sad-trombone";
  }

  // 18. Clock tick
  if (/(টিকটিক|ঘড়ি|ঘড়ির দোকান|কাঁটা|\b(clock|tick|ticking|watchmaker)\b)/i.test(text)) {
    return "clock-tick";
  }

  return "none";
}

export { evaluateHeroShot } from "./hero-shot";

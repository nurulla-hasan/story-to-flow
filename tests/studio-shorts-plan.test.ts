import { describe, expect, it } from "vitest";
import {
  clampShortsDuration,
  cleanNarration,
  composeShortsImagePrompt,
  estimateNarrationDuration,
  estimateShortsClipCount,
  stripCameraMotion,
} from "../src/lib/studio-plan";
import type {
  StudioCastMember,
  StudioLocationLock,
} from "../src/components/studio/types";

const cast: StudioCastMember[] = [
  {
    id: "habul",
    name: "Habul",
    visualLock:
      "Habul, a 62-year-old Bengali watchmaker with deep laugh lines, thick black round spectacles and a faded mustard kurta.",
  },
  {
    id: "crow",
    name: "Crow",
    visualLock:
      "A glossy black crow with a sharp grey beak and bright amber eyes.",
  },
];

const locations: StudioLocationLock[] = [
  {
    id: "shop",
    name: "Watch shop",
    visualLock:
      "A cramped antique watch shop with dark teak shelves, brass clock parts and warm amber lamplight.",
  },
];

describe("Shorts / animatic planning helpers", () => {
  it("clamps shot durations into the 2.5–5.0 second range", () => {
    expect(clampShortsDuration(1.2)).toBe(2.5);
    expect(clampShortsDuration(2.74)).toBe(2.5);
    expect(clampShortsDuration(3.26)).toBe(3.5);
    expect(clampShortsDuration(4.9)).toBe(5);
    expect(clampShortsDuration(Number.NaN)).toBe(3);
  });

  it("cleans narration for natural TTS without gasps or SFX tags", () => {
    const cleaned = cleanNarration(
      "হঠাৎ — বেলুনটা ফেটে গেল!!  [whoosh]  সে দ্রুত উড়ে গেল ।",
    );

    expect(cleaned).toBe("হঠাৎ বেলুনটা ফেটে গেল! সে দ্রুত উড়ে গেল।");
    expect(cleaned).not.toContain("—");
    expect(cleaned).not.toContain("!!");
    expect(cleaned).not.toContain("[whoosh]");
  });

  it("estimates clip count from pacing and target runtime", () => {
    const story = "একটি ছোট গল্প। ".repeat(20);

    expect(estimateShortsClipCount(story, "4", 60)).toBe(15);
    expect(estimateShortsClipCount(story, "2.5", 60)).toBe(24);
    expect(estimateShortsClipCount(story, "5", 60)).toBe(12);
  });

  it("derives auto-pacing durations from the narration slice", () => {
    expect(estimateNarrationDuration("একটি খুব ছোট বাক্য।")).toBe(2.5);
    expect(
      estimateNarrationDuration(
        "পুরোনো ঘড়ির দোকানে বৃদ্ধ কারিগর শামসু প্রতিদিন সন্ধ্যায় ঘড়ি মেরামত করতেন।",
      ),
    ).toBe(5);
  });

  it("composes a deterministic prompt with cast, location, style and aspect locks", () => {
    const prompt = composeShortsImagePrompt({
      styleLock: "Warm 3D Pixar animation with soft cinematic lighting.",
      stylePreset: "3D Pixar Animation",
      cast,
      locations,
      characterIds: ["habul", "crow"],
      locationId: "shop",
      action:
        "Habul reaches for a brass watch while the crow watches from the shelf.",
      narration: "শামসু টেবিলের দিকে হাত বাড়াল।",
      aspectRatio: "9:16",
    });

    expect(prompt).toContain("Warm 3D Pixar animation");
    expect(prompt).toContain("Habul, a 62-year-old Bengali watchmaker");
    expect(prompt).toContain("glossy black crow");
    expect(prompt).toContain("cramped antique watch shop");
    expect(prompt).toContain("In this shot:");
    expect(prompt).toContain("Vertical 9:16 aspect ratio.");
    expect(prompt.match(/Vertical 9:16 aspect ratio\./g)).toHaveLength(1);
  });

  it("strips camera movement from static image prompts", () => {
    const action =
      "Camera slowly zooming in on Habul as he opens the brass drawer. Soft lamp light.";
    const stripped = stripCameraMotion(action);

    expect(stripped.toLowerCase()).not.toContain("zooming");
    expect(stripped).toContain("Habul");
    expect(stripped).toContain("Soft lamp light");
  });
});

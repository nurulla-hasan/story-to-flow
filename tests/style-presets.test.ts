import { describe, expect, it } from "vitest";
import {
  STYLE_PRESETS,
  STYLE_LOCK_BY_PRESET,
  styleLockForPreset,
} from "../src/lib/types";
import type { StudioClip } from "../src/components/studio/types";
import {
  formatAllPrompts,
  formatPromptsExport,
} from "../src/components/studio/prompt-utils";

const clips: StudioClip[] = [
  {
    id: "clip-1",
    index: 1,
    duration: 2.5,
    imageUrl: null,
    imagePrompt: "A warm village courtyard at golden hour.",
    narration: "সূর্য ডোবার আগে উঠানে আলো পড়ল।",
    motion: "zoom-in",
  },
  {
    id: "clip-2",
    index: 2,
    duration: 3,
    imageUrl: null,
    imagePrompt: "The old watchmaker opens the brass drawer.",
    narration: "বৃদ্ধ কারিগর পিতলের ড্রয়ার খুললেন।",
    motion: "pan-left",
  },
];

describe("Visual style presets", () => {
  it("maps every main preset to a deterministic style lock", () => {
    for (const preset of STYLE_PRESETS) {
      const lock = styleLockForPreset(preset);
      expect(lock.length).toBeGreaterThan(40);
      expect(STYLE_LOCK_BY_PRESET[preset.toLowerCase()]).toBe(lock);
    }
  });

  it("accepts the studio spelling and appends custom style notes", () => {
    const lock = styleLockForPreset("Cinematic Realistic", "Neon night market");

    expect(lock).toContain("Photorealistic cinematic realism");
    expect(lock.endsWith("Neon night market")).toBe(true);
  });
});

describe("Bulk prompt formatting", () => {
  it("formats every prompt in sequential order", () => {
    const formatted = formatAllPrompts(clips, 3);

    expect(formatted).toContain("IMAGE #01");
    expect(formatted).toContain("IMAGE #02");
    expect(formatted).toContain("VOICEOVER: সূর্য ডোবার আগে উঠানে আলো পড়ল।");
    expect(formatted).toContain("PROMPT: A warm village courtyard at golden hour.");
    expect(formatted).toContain("—".repeat(44));
  });

  it("exports a header plus every prompt for .txt download", () => {
    const exported = formatPromptsExport(
      {
        title: "Watchmaker Story",
        clips,
        aspectRatio: "9:16",
        defaultClipDuration: 3,
        stylePreset: "3D Pixar Animation",
      },
      5.5,
    );

    expect(exported).toContain("STORY TO FLOW — PROMPT LIST");
    expect(exported).toContain("Total Images: 2 (~6s)");
    expect(exported).toContain("Art Style: 3D Pixar Animation");
    expect(exported).toContain("Flow Prompt: The old watchmaker opens the brass drawer.");
  });
});

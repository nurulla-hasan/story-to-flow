import { describe, expect, it } from "vitest";
import { formatTimeRange, sanitizeDetachedProps } from "../src/lib/studio";

describe("Studio Pacing Synchronization and Math", () => {
  it("calculates exact 96s runtime and 4.0s intervals for 24 images at 4s pacing", () => {
    const pacing = 4.0;
    const clipCount = 24;
    const totalRuntime = clipCount * pacing;
    expect(totalRuntime).toBe(96);

    let elapsed = 0;
    const timestamps: string[] = [];

    for (let i = 0; i < clipCount; i++) {
      const start = elapsed;
      const end = elapsed + pacing;
      elapsed = end;
      timestamps.push(formatTimeRange(start, end));
    }

    expect(timestamps[0]).toBe("0:00 - 0:04");
    expect(timestamps[1]).toBe("0:04 - 0:08");
    expect(timestamps[2]).toBe("0:08 - 0:12");
    expect(timestamps[23]).toBe("1:32 - 1:36");
  });

  it("calculates exact 72s runtime and 3.0s intervals for 24 images at 3s pacing", () => {
    const pacing = 3.0;
    const clipCount = 24;
    const totalRuntime = clipCount * pacing;
    expect(totalRuntime).toBe(72);

    let elapsed = 0;
    const timestamps: string[] = [];

    for (let i = 0; i < clipCount; i++) {
      const start = elapsed;
      const end = elapsed + pacing;
      elapsed = end;
      timestamps.push(formatTimeRange(start, end));
    }

    expect(timestamps[0]).toBe("0:00 - 0:03");
    expect(timestamps[1]).toBe("0:03 - 0:06");
    expect(timestamps[2]).toBe("0:06 - 0:09");
    expect(timestamps[23]).toBe("1:09 - 1:12");
  });
});

describe("Dynamic Prop / Detached Accessory Sanitization", () => {
  it("removes spectacles from character face when a crow snatches them", () => {
    const prompt =
      "3D Pixar Animation. Habul, 60-year-old Bengali man with thick black round spectacles, wearing navy vest. In this shot: a black crow swoops down and snatches the spectacles from his face and flies upward clutching them in its beak.";
    const narration = "হঠাৎ একটি দাঁড়কাক উড়ে এসে হাবুলের চশমাটি ছোঁ মেরে নিয়ে গেল!";

    const sanitized = sanitizeDetachedProps(prompt, narration);

    // Spectacles must NOT be described as worn on the face
    expect(sanitized).not.toContain("thick black round spectacles");
    expect(sanitized).toContain("spectacles missing");
    // Action prop with crow must remain intact
    expect(sanitized).toContain("black crow swoops down and snatches the spectacles");
  });

  it("removes hat from character when blown away by wind", () => {
    const prompt =
      "Cinematic realism. Old sailor wearing a felt hat, brown wool coat. In this shot: a sudden gust of wind blows away the hat across the deck.";
    const narration = "ঝোড়ো বাতাসে টুপিটি উড়ে গেল!";

    const sanitized = sanitizeDetachedProps(prompt, narration);

    expect(sanitized).not.toContain("wearing a felt hat");
    expect(sanitized).toContain("bareheaded (hat missing)");
  });

  it("does not modify prompt when no accessory is detached", () => {
    const prompt =
      "3D Pixar Animation. Shamsur, 65-year-old watchmaker wearing round brass spectacles, sitting at mahogany table inspecting a gear.";
    const narration = "শামসু গভীর মনোযোগে ঘড়ির কলকব্জা পরীক্ষা করছিল।";

    const sanitized = sanitizeDetachedProps(prompt, narration);
    expect(sanitized).toBe(prompt);
  });
});

describe("Camera Motion Variety for Video Editor", () => {
  it("cycles diverse camera movements across clips instead of repeating zoom-in", () => {
    const MOTION_CYCLE = ["zoom-in", "pan-left", "zoom-out", "pan-right", "static"];
    const generatedClips = Array.from({ length: 10 }, (_, idx) => ({
      motion: MOTION_CYCLE[idx % MOTION_CYCLE.length],
    }));

    const distinctMotions = new Set(generatedClips.map((c) => c.motion));
    expect(distinctMotions.size).toBe(5);
    expect(generatedClips[0].motion).toBe("zoom-in");
    expect(generatedClips[1].motion).toBe("pan-left");
    expect(generatedClips[2].motion).toBe("zoom-out");
    expect(generatedClips[3].motion).toBe("pan-right");
    expect(generatedClips[4].motion).toBe("static");
  });

  it("keeps image generation prompt clean from video camera motion phrases", () => {
    const rawPromptWithMotion =
      "3D Pixar Animation. Shamsur inspecting gears, camera slowly zooming in, dramatic push-in shot, vertical 9:16 aspect ratio";
    const cleanedPrompt = rawPromptWithMotion
      .replace(
        /\b(camera slowly zooming in[^\n,]*|camera slowly zooming out[^\n,]*|smooth cinematic camera sliding left[^\n,]*|smooth cinematic camera sliding right[^\n,]*|steady static camera framing[^\n,]*|(dramatic\s+)?push-in[^\n,]*|(dramatic\s+)?pull-back[^\n,]*)\b,?\s*/gi,
        "",
      )
      .replace(/,\s*,/g, ",")
      .replace(/,\s*$/g, "")
      .trim();

    expect(cleanedPrompt).not.toContain("zooming in");
    expect(cleanedPrompt).not.toContain("push-in");
    expect(cleanedPrompt).toBe(
      "3D Pixar Animation. Shamsur inspecting gears, vertical 9:16 aspect ratio",
    );
  });
});

import { describe, it, expect } from "vitest";
import { StoryProcessRequestSchema } from "./validation";
import { resolveSettings, DEFAULT_SETTINGS } from "./settings";

describe("P2 — API Request Validation & Precedence Consistency", () => {
  it("accepts top-level-only videoAssetDuration", () => {
    const rawBody = {
      story: "A magical bird in Sundarbans",
      videoAssetDuration: 6,
    };

    const parsed = StoryProcessRequestSchema.safeParse(rawBody);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    // Apply precedence: nested ?? top-level
    const effective = parsed.data.settings?.videoAssetDuration ?? parsed.data.videoAssetDuration;
    expect(effective).toBe(6);

    const resolved = resolveSettings({
      ...parsed.data.settings,
      videoAssetDuration: effective,
    });
    expect(resolved.videoAssetDuration).toBe(6);
  });

  it("accepts nested-only videoAssetDuration inside settings", () => {
    const rawBody = {
      story: "A magical bird in Sundarbans",
      settings: {
        videoAssetDuration: 8,
      },
    };

    const parsed = StoryProcessRequestSchema.safeParse(rawBody);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const effective = parsed.data.settings?.videoAssetDuration ?? parsed.data.videoAssetDuration;
    expect(effective).toBe(8);

    const resolved = resolveSettings({
      ...parsed.data.settings,
      videoAssetDuration: effective,
    });
    expect(resolved.videoAssetDuration).toBe(8);
  });

  it("applies documented precedence when both top-level and nested settings are specified", () => {
    // Nested settings take precedence over top-level
    const rawBody = {
      story: "A magical bird in Sundarbans",
      videoAssetDuration: 6,
      settings: {
        videoAssetDuration: 8,
      },
    };

    const parsed = StoryProcessRequestSchema.safeParse(rawBody);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const effective = parsed.data.settings?.videoAssetDuration ?? parsed.data.videoAssetDuration;
    expect(effective).toBe(8); // Nested wins

    const resolved = resolveSettings({
      ...parsed.data.settings,
      videoAssetDuration: effective,
    });
    expect(resolved.videoAssetDuration).toBe(8);
  });

  it("falls back to default 4s when neither top-level nor nested videoAssetDuration is specified", () => {
    const rawBody = {
      story: "A magical bird in Sundarbans",
    };

    const parsed = StoryProcessRequestSchema.safeParse(rawBody);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const effective = parsed.data.settings?.videoAssetDuration ?? parsed.data.videoAssetDuration;
    expect(effective).toBeUndefined();

    const resolved = resolveSettings({
      ...parsed.data.settings,
      videoAssetDuration: effective,
    });
    expect(resolved.videoAssetDuration).toBe(4);
    expect(resolved.videoAssetDuration).toBe(DEFAULT_SETTINGS.videoAssetDuration);
  });

  it("rejects invalid videoAssetDuration values (e.g. 10, Auto, negative, string)", () => {
    // 10s is no longer supported
    expect(StoryProcessRequestSchema.safeParse({
      story: "Test",
      videoAssetDuration: 10,
    }).success).toBe(false);

    // Auto is no longer a valid choice for videoAssetDuration (only 4, 6, 8)
    expect(StoryProcessRequestSchema.safeParse({
      story: "Test",
      videoAssetDuration: "Auto",
    }).success).toBe(false);

    // Negative or arbitrary numbers
    expect(StoryProcessRequestSchema.safeParse({
      story: "Test",
      videoAssetDuration: -4,
    }).success).toBe(false);
    expect(StoryProcessRequestSchema.safeParse({
      story: "Test",
      videoAssetDuration: 5,
    }).success).toBe(false);

    // Nested invalid
    expect(StoryProcessRequestSchema.safeParse({
      story: "Test",
      settings: {
        videoAssetDuration: 10,
      },
    }).success).toBe(false);
  });

  it("rejects non-positive actualVoiceoverDuration", () => {
    expect(StoryProcessRequestSchema.safeParse({
      story: "Test",
      actualVoiceoverDuration: 0,
    }).success).toBe(false);

    expect(StoryProcessRequestSchema.safeParse({
      story: "Test",
      actualVoiceoverDuration: -15.5,
    }).success).toBe(false);

    expect(StoryProcessRequestSchema.safeParse({
      story: "Test",
      actualVoiceoverDuration: 120.5,
    }).success).toBe(true);
  });

  it("supports direct voiceover mode without requiring a story", () => {
    // Stage: scenes with voiceoverScript and valid duration, but no story
    const directVoiceoverBody = {
      stage: "scenes",
      voiceoverScript: "একটি শান্ত নদীর তীরে ছোট্ট কুটিরে এক জেলে বাস করত...",
      actualVoiceoverDuration: 45.5,
    };

    const parsed = StoryProcessRequestSchema.safeParse(directVoiceoverBody);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.story).toBe("");
    expect(parsed.data.voiceoverScript).toContain("একটি শান্ত নদীর তীরে");
    expect(parsed.data.actualVoiceoverDuration).toBe(45.5);
  });

  it("rejects direct voiceover scene generation when voiceoverScript is missing or empty", () => {
    expect(
      StoryProcessRequestSchema.safeParse({
        stage: "scenes",
        voiceoverScript: "",
        actualVoiceoverDuration: 45.5,
      }).success
    ).toBe(false);

    expect(
      StoryProcessRequestSchema.safeParse({
        stage: "scenes",
        actualVoiceoverDuration: 45.5,
      }).success
    ).toBe(false);
  });

  it("rejects voiceover generation when story is missing", () => {
    expect(
      StoryProcessRequestSchema.safeParse({
        stage: "voiceover",
        story: "",
      }).success
    ).toBe(false);

    expect(
      StoryProcessRequestSchema.safeParse({
        stage: "complete",
        story: "",
      }).success
    ).toBe(false);
  });
});

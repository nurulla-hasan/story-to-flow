/**
 * Automatically evaluates whether a shot is a "Hero Action Shot" (video) or a "Static Image" (image).
 * Used when a shot does not have an explicit recommendation from the AI planner.
 */
export function evaluateHeroShot(clip: {
  action?: string;
  imagePrompt?: string;
  narration?: string;
  sfx?: string;
  recommendedMediaType?: "video" | "image";
  heroReason?: string;
}): { recommendedMediaType: "video" | "image"; heroReason?: string } {
  if (clip.recommendedMediaType) {
    return {
      recommendedMediaType: clip.recommendedMediaType,
      heroReason: clip.heroReason,
    };
  }

  const text = `${clip.action || ""} ${clip.imagePrompt || ""} ${clip.narration || ""} ${clip.sfx || ""}`.toLowerCase();

  // 1. Magical transformation & particle eruptions
  if (
    /(transform|erupt|emerge|hatch|portal|genie appears|magic sparkle|magic-chime|freeze time|ধোঁয়া|জাদু|বেরিয়ে এলো)/i.test(
      text,
    )
  ) {
    return {
      recommendedMediaType: "video",
      heroReason: "Magic transformation",
    };
  }

  // 2. High-velocity impact / crash / explosions
  if (
    /(crash|fall|falls onto|thud|slam|explosion|explode|blast|thunder|ধপাস|আছড়ে|পড়ে গেল|বজ্র)/i.test(
      text,
    )
  ) {
    return {
      recommendedMediaType: "video",
      heroReason: "Impact landing",
    };
  }

  // 3. High physical action & velocity (flying, jumping, chasing, bonking)
  if (
    /(flies|flying|swoop|whoosh|chase|chasing|run|running|jump|leaps|snatch|bonk|ঝাঁপ|উড়ে|হুশ|ছুটে)/i.test(
      text,
    )
  ) {
    return {
      recommendedMediaType: "video",
      heroReason: "High physical action",
    };
  }

  return {
    recommendedMediaType: "image",
  };
}

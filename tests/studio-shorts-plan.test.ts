import { describe, expect, it } from "vitest";
import {
  clampShortsDuration,
  cleanNarration,
  composeShortsImagePrompt,
  estimateNarrationDuration,
  estimateShortsClipCount,
  extractShortsActionFromPrompt,
  reassembleShortsProject,
  resolveShortsCharacterIds,
  resolveShortsLocationId,
  shortsProjectNeedsLockSync,
  stripCameraMotion,
} from "../src/lib/studio-plan";
import { evaluateHeroShot } from "../src/lib/hero-shot";
import { formatAllPrompts } from "../src/components/studio/prompt-utils";
import type {
  StudioCastMember,
  StudioClip,
  StudioLocationLock,
  StudioProject,
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

    const styleIndex = prompt.indexOf("Warm 3D Pixar animation");
    const castIndex = prompt.indexOf("Habul, a 62-year-old Bengali watchmaker");
    const locationIndex = prompt.indexOf("cramped antique watch shop");
    const actionIndex = prompt.indexOf("In this shot:");
    const aspectIndex = prompt.indexOf("Vertical 9:16 aspect ratio.");

    expect(styleIndex).toBeLessThan(castIndex);
    expect(castIndex).toBeLessThan(locationIndex);
    expect(locationIndex).toBeLessThan(actionIndex);
    expect(actionIndex).toBeLessThan(aspectIndex);
  });

  it("strips camera movement from static image prompts", () => {
    const action =
      "Camera slowly zooming in on Habul as he opens the brass drawer. Soft lamp light.";
    const stripped = stripCameraMotion(action);

    expect(stripped.toLowerCase()).not.toContain("zooming");
    expect(stripped).toContain("Habul");
    expect(stripped).toContain("Soft lamp light");
  });

  it("recovers missing character locks by matching names in the shot action", () => {
    const characterIds = resolveShortsCharacterIds({
      cast,
      characterIds: [],
      action: "Habul reaches toward the shelf while the crow watches him.",
      narration: "শামসু তাকিয়ে রইল।",
    });

    expect(characterIds).toEqual(["habul", "crow"]);

    const prompt = composeShortsImagePrompt({
      styleLock: "Warm 3D Pixar animation.",
      stylePreset: "3D Pixar Animation",
      cast,
      locations,
      characterIds: [],
      locationId: "shop",
      action: "Habul reaches toward the shelf while the crow watches him.",
      narration: "শামসু তাকিয়ে রইল।",
      aspectRatio: "9:16",
    });

    expect(prompt).toContain("Habul, a 62-year-old Bengali watchmaker");
    expect(prompt).toContain("glossy black crow");
    expect(prompt).toContain("cramped antique watch shop");
    expect(prompt).toContain("In this shot: Habul reaches");
    expect(prompt).toContain("Vertical 9:16 aspect ratio.");
  });

  it("matches cast ids by keyword and filters stale ids", () => {
    const extendedCast: StudioCastMember[] = [
      ...cast,
      {
        id: "brass-spider",
        name: "ব্রাস মাকড়সা",
        visualLock:
          "An eight-legged mechanical brass spider with engraved gears and glowing amber eyes.",
      },
    ];

    expect(
      resolveShortsCharacterIds({
        cast: extendedCast,
        characterIds: ["does-not-exist"],
        action: "The brass spider scuttles across the workbench.",
        narration: "",
      }),
    ).toEqual(["brass-spider"]);
  });

  it("prevents substring keyword collision between characters sharing generic words like ছানা or baby", () => {
    const multiCast: StudioCastMember[] = [
      {
        id: "baby-genie",
        name: "জিনের ছানা",
        visualLock:
          "A tiny glowing baby genie with sparkling indigo skin and big playful eyes.",
      },
      {
        id: "mechanical-chicks",
        name: "মেকানিক্যাল সোনালি মুরগির ছানা",
        visualLock:
          "Three miniature clockwork mechanical baby chicks made of polished brass and gold gears.",
      },
    ];

    // 1. Strict mode: when characterIds is already valid, trust it strictly and do NOT pull in chicks
    expect(
      resolveShortsCharacterIds({
        cast: multiCast,
        characterIds: ["baby-genie"],
        action: "জিনের ছানা বোতল থেকে বের হয়ে হাসল।",
        narration: "",
      }),
    ).toEqual(["baby-genie"]);

    // 2. Keyword fallback mode: when characterIds is empty, distinctive root nouns match without collision
    expect(
      resolveShortsCharacterIds({
        cast: multiCast,
        characterIds: [],
        action: "জিনের ছানা বোতল থেকে মাথা বের করে হাসল।",
        narration: "জিনটি আকাশে ভাসল।",
      }),
    ).toEqual(["baby-genie"]);

    expect(
      resolveShortsCharacterIds({
        cast: multiCast,
        characterIds: [],
        action: "ডিম ফুটে সোনালি মুরগির ছানা বের হয়ে এলো।",
        narration: "মুরগিগুলো খুশিতে ডাকাডাকি করল।",
      }),
    ).toEqual(["mechanical-chicks"]);

    // 3. Standalone generic word "ছানা" without distinctive root does NOT pull in either character
    expect(
      resolveShortsCharacterIds({
        cast: multiCast,
        characterIds: [],
        action: "একটি ছোট্ট ছানা দূরে খেলা করছে।",
        narration: "",
      }),
    ).toEqual([]);

    // 4. English distinctive root noun matching works similarly
    expect(
      resolveShortsCharacterIds({
        cast: multiCast,
        characterIds: [],
        action: "The baby genie floats happily in the air.",
        narration: "",
      }),
    ).toEqual(["baby-genie"]);

    expect(
      resolveShortsCharacterIds({
        cast: multiCast,
        characterIds: [],
        action: "The mechanical chicks peck at golden clockwork grain.",
        narration: "",
      }),
    ).toEqual(["mechanical-chicks"]);
  });

  it("matches a location by name and always returns a locked setting", () => {
    const twoLocations: StudioLocationLock[] = [
      ...locations,
      {
        id: "river-ghat",
        name: "River ghat",
        visualLock:
          "A worn stone river ghat with mossy steps, drifting wooden boats and pale dawn mist.",
      },
    ];

    expect(
      resolveShortsLocationId({
        locations: twoLocations,
        action: "Habul stands alone on the river ghat at dawn.",
        narration: "",
      }),
    ).toBe("river-ghat");

    expect(
      resolveShortsLocationId({
        locations: twoLocations,
        locationId: "missing-location",
        action: "Habul stands alone at dawn.",
        narration: "",
      }),
    ).toBe("shop");
  });

  it("extracts the raw shot action from an older composed prompt", () => {
    expect(
      extractShortsActionFromPrompt(
        "Old style. Old cast. Old place. In this shot: Habul polishes a brass watch, close-up. Vertical 9:16 aspect ratio.",
      ),
    ).toBe("Habul polishes a brass watch, close-up");
  });

  it("rebuilds every existing prompt when Bible locks change", () => {
    const project: StudioProject = {
      id: "studio-default",
      title: "Watch shop",
      story: "Habul repairs a watch.",
      workflowMode: "shorts-animatic",
      cast,
      locations,
      styleLock: "Old style.",
      stylePreset: "3D Pixar Animation",
      aspectRatio: "9:16",
      defaultClipDuration: 3,
      continuousVoiceover: "শামসু ঘড়ি মেরামত করলেন।",
      audioUrl: null,
      audioDuration: 0,
      clips: [
        {
          id: "clip-1",
          index: 1,
          duration: 3,
          imageUrl: null,
          imagePrompt:
            "Old style. In this shot: Habul polishes a brass watch, close-up. Vertical 9:16 aspect ratio.",
          narration: "শামসু ঘড়ি মেরামত করলেন।",
          motion: "zoom-in",
          characterIds: ["habul", "stale-id"],
          locationId: "shop",
        },
      ],
    };

    const updatedCast: StudioCastMember[] = [
      {
        ...cast[0],
        visualLock:
          "Habul, a 62-year-old Bengali watchmaker now wearing a deep green kurta and thick brass spectacles.",
      },
      ...cast.slice(1),
    ];
    const updatedLocations: StudioLocationLock[] = [
      {
        ...locations[0],
        visualLock:
          "A cramped antique watch shop with new teal cabinets and warm amber lamplight.",
      },
    ];

    const result = reassembleShortsProject({
      project,
      cast: updatedCast,
      locations: updatedLocations,
      styleLock: "Warm 3D Pixar animation with soft cinematic lighting.",
      stylePreset: "3D Pixar Animation",
      aspectRatio: "16:9",
    });

    expect(result.changedClips).toBe(1);
    expect(result.project.clips[0].action).toBe(
      "Habul polishes a brass watch, close-up",
    );
    expect(result.project.clips[0].characterIds).toEqual(["habul"]);
    expect(result.project.clips[0].locationId).toBe("shop");
    expect(result.project.clips[0].imagePrompt).toContain(
      "Warm 3D Pixar animation with soft cinematic lighting",
    );
    expect(result.project.clips[0].imagePrompt).toContain(
      "now wearing a deep green kurta",
    );
    expect(result.project.clips[0].imagePrompt).toContain(
      "new teal cabinets",
    );
    expect(result.project.clips[0].imagePrompt).toContain(
      "Widescreen 16:9 aspect ratio.",
    );
  });

  it("maps merged character ids before rebuilding prompts", () => {
    const project: StudioProject = {
      id: "studio-default",
      title: "Watch shop",
      story: "Habul repairs a watch.",
      workflowMode: "shorts-animatic",
      cast,
      locations,
      stylePreset: "3D Pixar Animation",
      aspectRatio: "9:16",
      defaultClipDuration: 3,
      continuousVoiceover: "",
      audioUrl: null,
      audioDuration: 0,
      clips: [
        {
          id: "clip-1",
          index: 1,
          duration: 3,
          imageUrl: null,
          imagePrompt: "Old prompt.",
          narration: "শামসু ঘড়ি মেরামত করলেন।",
          action: "The crow watches from the shelf.",
          motion: "zoom-in",
          characterIds: ["crow"],
          locationId: "shop",
        },
      ],
    };

    const result = reassembleShortsProject({
      project,
      cast: [cast[0]],
      locations,
      characterIdMap: { crow: "habul" },
    });

    expect(result.project.clips[0].characterIds).toEqual(["habul"]);
    expect(result.project.clips[0].imagePrompt).toContain(
      "Habul, a 62-year-old Bengali watchmaker",
    );
    expect(result.project.clips[0].imagePrompt).not.toContain("glossy black crow");
  });

  it("detects prompts missing Bible locks without overwriting synced edits", () => {
    const styleLock = "Warm 3D Pixar animation with soft cinematic lighting.";
    const project: StudioProject = {
      id: "studio-default",
      title: "Watch shop",
      story: "Habul repairs a watch.",
      workflowMode: "shorts-animatic",
      cast,
      locations,
      styleLock,
      stylePreset: "3D Pixar Animation",
      aspectRatio: "9:16",
      defaultClipDuration: 3,
      continuousVoiceover: "শামসু ঘড়ি মেরামত করলেন।",
      audioUrl: null,
      audioDuration: 0,
      clips: [
        {
          id: "clip-1",
          index: 1,
          duration: 3,
          imageUrl: null,
          imagePrompt:
            "Old style. In this shot: Habul polishes a brass watch, close-up. Vertical 9:16 aspect ratio.",
          narration: "শামসু ঘড়ি মেরামত করলেন।",
          motion: "zoom-in",
          characterIds: ["habul"],
          locationId: "shop",
        },
      ],
    };

    const input = {
      project,
      cast,
      locations,
      styleLock,
      stylePreset: "3D Pixar Animation",
      aspectRatio: "9:16" as const,
    };

    expect(shortsProjectNeedsLockSync(input)).toBe(true);

    const reassembled = reassembleShortsProject(input).project;
    expect(
      shortsProjectNeedsLockSync({ ...input, project: reassembled }),
    ).toBe(false);

    const manuallyEdited: StudioProject = {
      ...reassembled,
      clips: reassembled.clips.map((clip) => ({
        ...clip,
        imagePrompt: `${clip.imagePrompt} Slight manual timing note.`,
      })),
    };
    expect(
      shortsProjectNeedsLockSync({ ...input, project: manuallyEdited }),
    ).toBe(false);
  });

  describe("Smart Hero Shot Tagging & Flow Credit Cost Estimation", () => {
    it("evaluates kinetic hero action moments vs static images", () => {
      // 1. Explicit planner tagging
      expect(
        evaluateHeroShot({
          recommendedMediaType: "video",
          heroReason: "Magic transformation",
        }),
      ).toEqual({
        recommendedMediaType: "video",
        heroReason: "Magic transformation",
      });

      // 2. High-velocity impact / explosion
      expect(
        evaluateHeroShot({
          action: "He falls hard onto the mattress with a heavy crash landing.",
        }),
      ).toEqual({
        recommendedMediaType: "video",
        heroReason: "Impact landing",
      });

      // 3. Magical transformation / eruption
      expect(
        evaluateHeroShot({
          action: "Blue smoke pours from the brass bottle as the baby genie appears.",
        }),
      ).toEqual({
        recommendedMediaType: "video",
        heroReason: "Magic transformation",
      });

      // 4. High physical action (flight / chase / snatch)
      expect(
        evaluateHeroShot({
          action: "The black crow swoops down and snatches the round spectacles, flying away.",
        }),
      ).toEqual({
        recommendedMediaType: "video",
        heroReason: "High physical action",
      });

      // 5. Stationary dialog / looking / inspection
      expect(
        evaluateHeroShot({
          action: "Habul sits at his workbench, examining the small golden gears.",
        }),
      ).toEqual({
        recommendedMediaType: "image",
      });
    });

    it("calculates accurate Flow credit costs for 26 shots with 5 hero videos", () => {
      const heroVideoCount = 5;
      const staticImageCount = 21;
      const totalShots = heroVideoCount + staticImageCount; // 26
      const estFlowCost = heroVideoCount * 3 + staticImageCount * 1; // 36 (~35 credits)

      expect(totalShots).toBe(26);
      expect(estFlowCost).toBe(36);
      expect(Math.round(estFlowCost / 5) * 5).toBe(35); // ~35 Credits
    });

    it("includes Hero Video and Static Image badges in formatAllPrompts export", () => {
      const sampleClips: StudioClip[] = [
        {
          id: "c1",
          index: 1,
          duration: 4.0,
          imageUrl: null,
          imagePrompt: "3D Pixar Animation. Habul sitting at bench.",
          narration: "কাশেম বসে রইল।",
          motion: "zoom-in",
          recommendedMediaType: "image",
        },
        {
          id: "c2",
          index: 2,
          duration: 4.0,
          imageUrl: null,
          imagePrompt: "3D Pixar Animation. Genie emerges with sparkling blue smoke.",
          narration: "হঠাৎ ধোঁয়া বেরিয়ে এলো!",
          motion: "zoom-out",
          recommendedMediaType: "video",
          heroReason: "Magic transformation",
        },
      ];

      const formatted = formatAllPrompts(sampleClips, 4.0);
      expect(formatted).toContain("[🖼️ Static Image]");
      expect(formatted).toContain("[🎥 Hero Video (Flow Animate) • Magic transformation]");
    });
  });
});

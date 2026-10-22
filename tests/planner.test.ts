import { describe, expect, it } from "vitest";
import { sceneCount, DEFAULT_SETTINGS, type Scene } from "../src/lib/types";
import { sanitizeScenePlan } from "../src/lib/pipeline";

describe("sceneCount", () => {
  it("computes ceil(total seconds / clip seconds)", () => {
    expect(sceneCount({ ...DEFAULT_SETTINGS, totalMinutes: 1, clipSeconds: 10 })).toBe(6);
    expect(sceneCount({ ...DEFAULT_SETTINGS, totalMinutes: 1, clipSeconds: 8 })).toBe(8);
    expect(sceneCount({ ...DEFAULT_SETTINGS, totalMinutes: 1.5, clipSeconds: 10 })).toBe(9);
    expect(sceneCount({ ...DEFAULT_SETTINGS, totalMinutes: 0.5, clipSeconds: 8 })).toBe(4);
  });
});

describe("sanitizeScenePlan", () => {
  const mockData = {
    project: {
      id: "default",
      name: "Test",
      story: "Test",
      styleLock: "Lock",
      settings: {
        ...DEFAULT_SETTINGS,
        maxPeople: 2,
        frameChaining: true,
      },
      createdAt: "",
      updatedAt: "",
    },
    characters: [
      { id: "rina", name: "Rina", visual_lock: "v", voice_lock: "vo", language: "bn" as const, outfit_changes: false, refImage: null },
      { id: "karim", name: "Karim", visual_lock: "v", voice_lock: "vo", language: "bn" as const, outfit_changes: false, refImage: null },
    ],
    locations: [
      { id: "ghat", name: "Ghat", visual_lock: "g", refImage: null },
      { id: "courtyard", name: "Courtyard", visual_lock: "c", refImage: null },
    ],
    rules: [],
    scenes: [],
  };

  it("inserts establishing shot when location changes", () => {
    const rawScenes: Scene[] = [
      {
        n: 1,
        location_id: "ghat",
        characters: ["rina"],
        is_establishing: false,
        chain_from_previous: false,
        action: "Rina walks down steps.",
        camera: { shot: "wide", angle: "eye", movement: "static" },
        start_state: "Top step.",
        end_state: "Bottom step.",
        dialogue: null,
        sound: "Water",
      },
      {
        n: 2,
        location_id: "courtyard", // Changed location
        characters: ["rina"],
        is_establishing: false, // Omitted establishing shot
        chain_from_previous: true,
        action: "Rina enters the gate.",
        camera: { shot: "wide", angle: "eye", movement: "static" },
        start_state: "Gate.",
        end_state: "Courtyard center.",
        dialogue: null,
        sound: "Wind",
      },
    ];

    const sanitized = sanitizeScenePlan(mockData, rawScenes);
    expect(sanitized.scenes[1].is_establishing).toBe(true);
    expect(sanitized.scenes[1].chain_from_previous).toBe(false);
  });

  it("chains start_state from previous end_state when chained", () => {
    const rawScenes: Scene[] = [
      {
        n: 1,
        location_id: "ghat",
        characters: ["rina"],
        is_establishing: false,
        chain_from_previous: false,
        action: "Rina arrives.",
        camera: { shot: "wide", angle: "eye", movement: "static" },
        start_state: "Top step.",
        end_state: "Standing still at bottom step holding pitcher.",
        dialogue: null,
        sound: "Water",
      },
      {
        n: 2,
        location_id: "ghat",
        characters: ["rina"],
        is_establishing: false,
        chain_from_previous: true,
        action: "Rina dips pitcher.",
        camera: { shot: "close-up", angle: "low", movement: "static" },
        start_state: "Different state", // should be synchronized to scene 1 end_state
        end_state: "Water filled.",
        dialogue: null,
        sound: "Water",
      },
    ];

    const sanitized = sanitizeScenePlan(mockData, rawScenes);
    expect(sanitized.scenes[1].start_state).toBe(sanitized.scenes[0].end_state);
  });
});

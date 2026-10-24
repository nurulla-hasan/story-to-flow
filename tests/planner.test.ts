import { describe, expect, it } from "vitest";
import { sceneCount, DEFAULT_SETTINGS, type ProjectData, type Scene } from "../src/lib/types";
import { sanitizeScenePlan } from "../src/lib/pipeline";
import { checkStoryCompletion, storyCompletionSchema } from "../src/lib/planner";

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

  it("does not truncate valid story characters even if maxPeople was set low", () => {
    const dataWithMoreCharacters = {
      ...mockData,
      characters: [
        { id: "c1", name: "C1", visual_lock: "v", voice_lock: "vo", language: "bn" as const, outfit_changes: false, refImage: null },
        { id: "c2", name: "C2", visual_lock: "v", voice_lock: "vo", language: "bn" as const, outfit_changes: false, refImage: null },
        { id: "c3", name: "C3", visual_lock: "v", voice_lock: "vo", language: "bn" as const, outfit_changes: false, refImage: null },
        { id: "c4", name: "C4", visual_lock: "v", voice_lock: "vo", language: "bn" as const, outfit_changes: false, refImage: null },
      ],
      project: {
        ...mockData.project,
        settings: {
          ...mockData.project.settings,
          maxPeople: 2, // low setting should not cut off story characters
        },
      },
    };

    const rawScenes: Scene[] = [
      {
        n: 1,
        location_id: "ghat",
        characters: ["c1", "c2", "c3", "c4"],
        is_establishing: false,
        chain_from_previous: false,
        action: "Group talking.",
        camera: { shot: "wide", angle: "eye", movement: "static" },
        start_state: "State",
        end_state: "State",
        dialogue: { speaker: "c4", line: "Hello" },
        sound: "Audio",
      },
    ];

    const sanitized = sanitizeScenePlan(dataWithMoreCharacters, rawScenes);
    // All 4 story characters are preserved
    expect(sanitized.scenes[0].characters).toHaveLength(4);
    expect(sanitized.scenes[0].characters).toContain("c4");
    expect(sanitized.scenes[0].dialogue?.speaker).toBe("c4");
  });

  it("ensures character enters the frame when chaining from an empty establishing shot", () => {
    const rawScenes: Scene[] = [
      {
        n: 1,
        location_id: "ghat",
        characters: [],
        is_establishing: true,
        chain_from_previous: false,
        action: "Establishing shot of quiet mossy bridge.",
        camera: { shot: "wide", angle: "eye", movement: "slow push" },
        start_state: "Empty bridge, quiet river.",
        end_state: "Empty bridge, twilight.",
        dialogue: null,
        sound: "River flow",
      },
      {
        n: 2,
        location_id: "ghat",
        characters: ["rina"],
        is_establishing: false,
        chain_from_previous: true,
        action: "rina sits on the bridge looking at the water.",
        camera: { shot: "medium", angle: "eye", movement: "static" },
        start_state: "Empty bridge, twilight.",
        end_state: "Rina sitting on bridge.",
        dialogue: null,
        sound: "River flow",
      },
    ];

    const sanitized = sanitizeScenePlan(mockData, rawScenes);
    expect(sanitized.scenes[1].action).toMatch(/enters the frame/i);
    expect(sanitized.scenes[1].action).toBe("rina enters the frame and sits on the bridge looking at the water.");
  });

  it("adjusts camera movement to push in when camera jumps between wide and close-up while chained", () => {
    const rawScenes: Scene[] = [
      {
        n: 1,
        location_id: "ghat",
        characters: ["rina"],
        is_establishing: false,
        chain_from_previous: false,
        action: "Rina stands by the water.",
        camera: { shot: "wide", angle: "eye", movement: "static" },
        start_state: "Rina standing.",
        end_state: "Rina standing.",
        dialogue: null,
        sound: "Water",
      },
      {
        n: 2,
        location_id: "ghat",
        characters: ["rina"],
        is_establishing: false,
        chain_from_previous: true,
        action: "Rina closes her eyes.",
        camera: { shot: "close-up", angle: "eye", movement: "static" },
        start_state: "Rina standing.",
        end_state: "Rina smiling.",
        dialogue: null,
        sound: "Water",
      },
    ];

    const sanitized = sanitizeScenePlan(mockData, rawScenes);
    expect(sanitized.scenes[1].camera.movement).toBe("slow push in");
    expect(sanitized.scenes[1].chain_from_previous).toBe(true);
  });

  it("unchains when lighting or time of day shifts between chained scenes", () => {
    const rawScenes: Scene[] = [
      {
        n: 1,
        location_id: "ghat",
        characters: ["rina"],
        is_establishing: false,
        chain_from_previous: false,
        action: "Rina waits under twilight.",
        camera: { shot: "medium", angle: "eye", movement: "static" },
        start_state: "Twilight dusk light.",
        end_state: "Dark night falls.",
        dialogue: null,
        sound: "Wind",
      },
      {
        n: 2,
        location_id: "ghat",
        characters: ["rina"],
        is_establishing: false,
        chain_from_previous: true,
        action: "Bright morning sunlight shines as Rina smiles.",
        camera: { shot: "medium", angle: "eye", movement: "static" },
        start_state: "Bright morning daylight.",
        end_state: "Morning sunlight.",
        dialogue: null,
        sound: "Birds",
      },
    ];

    const sanitized = sanitizeScenePlan(mockData, rawScenes);
    expect(sanitized.scenes[1].chain_from_previous).toBe(false);
  });

  it("ensures re-entrance if character exited in the previous scene", () => {
    const rawScenes: Scene[] = [
      {
        n: 1,
        location_id: "ghat",
        characters: ["rina"],
        is_establishing: false,
        chain_from_previous: false,
        action: "Rina turns and walks off the bridge.",
        camera: { shot: "wide", angle: "eye", movement: "static" },
        start_state: "Rina on bridge.",
        end_state: "Bridge empty, Rina out of frame.",
        dialogue: null,
        sound: "Wind",
      },
      {
        n: 2,
        location_id: "ghat",
        characters: ["rina"],
        is_establishing: false,
        chain_from_previous: true,
        action: "rina sits on the bridge.",
        camera: { shot: "medium", angle: "eye", movement: "slow push" },
        start_state: "Bridge empty.",
        end_state: "Rina sitting on bridge.",
        dialogue: null,
        sound: "Wind",
      },
    ];

    const sanitized = sanitizeScenePlan(mockData, rawScenes);
    expect(sanitized.scenes[1].action).toBe("rina enters the frame and sits on the bridge.");
  });

  it("adjusts camera angle to eye level if dialogue speaker was facing away from camera", () => {
    const rawScenes: Scene[] = [
      {
        n: 1,
        location_id: "ghat",
        characters: ["rina"],
        is_establishing: false,
        chain_from_previous: false,
        action: "Rina speaks.",
        camera: { shot: "medium", angle: "from behind", movement: "static" },
        start_state: "Rina standing.",
        end_state: "Rina standing.",
        dialogue: { speaker: "rina", line: "Hello" },
        sound: "Wind",
      },
    ];

    const sanitized = sanitizeScenePlan(mockData, rawScenes);
    expect(sanitized.scenes[0].camera.angle).toBe("eye level");
  });

  it("automatically detects and injects characters mentioned in action or dialogue", () => {
    const rawScenes: Scene[] = [
      {
        n: 1,
        location_id: "ghat",
        characters: ["rina"], // karim omitted by mistake
        is_establishing: false,
        chain_from_previous: false,
        action: "Rina turns and talks to karim.",
        camera: { shot: "medium", angle: "eye", movement: "static" },
        start_state: "Rina facing water.",
        end_state: "Rina and Karim talking.",
        dialogue: null,
        sound: "Wind",
      },
    ];

    const sanitized = sanitizeScenePlan(mockData, rawScenes);
    expect(sanitized.scenes[0].characters).toContain("rina");
    expect(sanitized.scenes[0].characters).toContain("karim");
  });

  it("unchains when characters from previous scene are dropped without exiting (subset paradox)", () => {
    const rawScenes: Scene[] = [
      {
        n: 1,
        location_id: "ghat",
        characters: ["rina", "karim"],
        is_establishing: false,
        chain_from_previous: false,
        action: "Rina and Karim standing together laughing.",
        camera: { shot: "wide", angle: "eye", movement: "static" },
        start_state: "Both standing.",
        end_state: "Both laughing.",
        dialogue: null,
        sound: "Wind",
      },
      {
        n: 2,
        location_id: "ghat",
        characters: ["rina"], // karim dropped without exiting!
        is_establishing: false,
        chain_from_previous: true,
        action: "Rina smiles.",
        camera: { shot: "close-up", angle: "eye", movement: "static" },
        start_state: "Both laughing.",
        end_state: "Rina smiling.",
        dialogue: null,
        sound: "Wind",
      },
    ];

    const sanitized = sanitizeScenePlan(mockData, rawScenes);
    expect(sanitized.scenes[1].chain_from_previous).toBe(false);
  });

  it("prunes origin character when transformed form is revealed/active (no clone paradox)", () => {
    const dataWithMorph: ProjectData = {
      ...mockData,
      characters: [
        {
          id: "nilu",
          name: "নিলু",
          visual_lock: "Young magician in robe.",
          voice_lock: "Voice",
          language: "bn",
          outfit_changes: true,
          refImage: null,
        },
        {
          id: "frog-nilu",
          name: "সবুজ ব্যাঙ",
          visual_lock: "Tiny green frog.",
          voice_lock: "Frog Voice",
          language: "bn",
          outfit_changes: false,
          refImage: null,
        },
      ],
    };

    const rawScenes: Scene[] = [
      {
        n: 1,
        location_id: "ghat",
        characters: ["frog-nilu", "nilu"],
        is_establishing: false,
        chain_from_previous: false,
        action: "Light fades revealing frog-nilu on floor; frog-nilu croaks pleadingly.",
        camera: { shot: "medium", angle: "eye", movement: "static" },
        start_state: "Flash of light.",
        end_state: "frog-nilu on floor looking up.",
        dialogue: { speaker: "nilu", line: "ঘ্যাঙর ঘ্যাঙ!" },
        sound: "Croak",
      },
    ];

    const sanitized = sanitizeScenePlan(dataWithMorph, rawScenes);
    // nilu should be pruned because frog-nilu is active and nilu is not in end_state
    expect(sanitized.scenes[0].characters).toContain("frog-nilu");
    expect(sanitized.scenes[0].characters).not.toContain("nilu");
    expect(sanitized.scenes[0].dialogue?.speaker).toBe("frog-nilu");
  });
});

describe("checkStoryCompletion", () => {
  it("validates storyCompletionSchema parsing", () => {
    const valid = storyCompletionSchema.parse({
      is_complete: false,
      missing_events: "Hero returns home and celebrates",
      remaining_scenes_needed: 3,
    });
    expect(valid.is_complete).toBe(false);
    expect(valid.remaining_scenes_needed).toBe(3);
  });

  it("returns incomplete when no scenes exist", async () => {
    const result = await checkStoryCompletion({
      story: "Test story",
      scenes: [],
    });
    expect(result.is_complete).toBe(false);
    expect(result.remaining_scenes_needed).toBeGreaterThan(0);
  });
});

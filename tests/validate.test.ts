import { describe, expect, it } from "vitest";
import { deterministicChecksForScene } from "../src/lib/validate";
import { assemblePrompt, assembleImagePrompt } from "../src/lib/assemble";
import { DEFAULT_SETTINGS, type ProjectData, type SceneRecord } from "../src/lib/types";

const mockProjectData: ProjectData = {
  project: {
    id: "default",
    name: "River Encounter",
    story: "...",
    styleLock: "Cinematic realism, anamorphic 35mm, golden dawn light",
    settings: {
      ...DEFAULT_SETTINGS,
      maxPeople: 2,
      maxDialogueWords: 5,
      dialogueEnabled: true,
      frameChaining: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  characters: [
    {
      id: "rina",
      name: "Rina",
      visual_lock: "Young woman in blue saree, silver nose pin, hair in neat braid.",
      voice_lock: "Gentle rural accent, soft tone.",
      language: "bn",
      outfit_changes: false,
      refImage: null,
    },
    {
      id: "karim",
      name: "Karim",
      visual_lock: "Young man in beige kurta, short dark hair.",
      voice_lock: "Deep, calm voice.",
      language: "bn",
      outfit_changes: false,
      refImage: null,
    },
    {
      id: "ma",
      name: "Ma",
      visual_lock: "Elderly woman in white cotton saree with grey hair in a bun.",
      voice_lock: "Warm, mature maternal tone.",
      language: "bn",
      outfit_changes: false,
      refImage: null,
    },
  ],
  locations: [
    {
      id: "ghat",
      name: "Ghat",
      visual_lock: "River stone ghat with calm water, sunrise fog.",
      refImage: null,
    },
    {
      id: "courtyard",
      name: "Courtyard",
      visual_lock: "Clay courtyard with mud house and basil plant.",
      refImage: null,
    },
  ],
  rules: [],
  scenes: [
    {
      n: 1,
      location_id: "ghat",
      characters: ["rina"],
      is_establishing: false,
      chain_from_previous: false,
      action: "Rina walks down to the water.",
      camera: { shot: "wide", angle: "eye level", movement: "static" },
      start_state: "Rina enters the frame at the top step.",
      end_state: "Rina reaches the water line and pauses.",
      dialogue: null,
      sound: "Birds chirping",
      status: "ready",
      reasons: [],
      keyframePath: null,
      clipPath: null,
      lastFramePath: null,
      startFramePath: null,
      chainedFrom: null,
      prompt: null,
      updatedAt: new Date().toISOString(),
    },
  ],
};

describe("deterministicChecksForScene", () => {
  it("flags too many people when characters exceed maxPeople", () => {
    const scene: SceneRecord = {
      ...mockProjectData.scenes[0],
      characters: ["rina", "karim", "ma"],
    };
    const issues = deterministicChecksForScene(
      mockProjectData,
      scene,
      "Cinematic realism, anamorphic 35mm, golden dawn light LOCATION: River stone ghat with calm water, sunrise fog. Young woman in blue saree, silver nose pin, hair in neat braid. Gentle rural accent, soft tone.",
      "River stone ghat with calm water, sunrise fog.",
    );
    expect(issues.some((i) => i.code === "too_many_people")).toBe(true);
  });

  it("flags dialogue word count exceeding limit", () => {
    const scene: SceneRecord = {
      ...mockProjectData.scenes[0],
      dialogue: {
        speaker: "rina",
        line: "এই এক দুই তিন চার পাঁচ ছয় সাত অনেক শব্দ হয়ে গেল", // > 5 words
      },
    };
    const issues = deterministicChecksForScene(
      mockProjectData,
      scene,
      "Cinematic realism, anamorphic 35mm, golden dawn light LOCATION: River stone ghat with calm water, sunrise fog. Young woman in blue saree, silver nose pin, hair in neat braid. Gentle rural accent, soft tone.",
      "River stone ghat with calm water, sunrise fog.",
    );
    expect(issues.some((i) => i.code === "dialogue_too_long")).toBe(true);
  });

  it("flags chained scene when start_state does not match previous end_state", () => {
    const scene2: SceneRecord = {
      n: 2,
      location_id: "ghat",
      characters: ["rina"],
      is_establishing: false,
      chain_from_previous: true,
      action: "Rina looks around.",
      camera: { shot: "close-up", angle: "eye level", movement: "static" },
      start_state: "Rina sitting on a wooden bench.", // DOES NOT MATCH scene 1 end_state
      end_state: "Rina stands up.",
      dialogue: null,
      sound: "Water",
      status: "draft",
      reasons: [],
      keyframePath: null,
      clipPath: null,
      lastFramePath: null,
      startFramePath: null,
      chainedFrom: 1,
      prompt: null,
      updatedAt: new Date().toISOString(),
    };
    const prompt = assemblePrompt(mockProjectData, scene2);
    const imgPrompt = assembleImagePrompt(mockProjectData, scene2);
    const issues = deterministicChecksForScene(
      mockProjectData,
      scene2,
      prompt,
      imgPrompt,
    );
    expect(issues.some((i) => i.code === "chain_mismatch")).toBe(true);
  });

  it("flags missing establishing shot on location change", () => {
    const scene2: SceneRecord = {
      n: 2,
      location_id: "courtyard", // CHANGED FROM ghat
      characters: ["rina"],
      is_establishing: false, // Must be true!
      chain_from_previous: false,
      action: "Rina speaks to her mother.",
      camera: { shot: "medium", angle: "eye level", movement: "static" },
      start_state: "Rina standing in courtyard.",
      end_state: "Rina stops.",
      dialogue: null,
      sound: "Wind",
      status: "draft",
      reasons: [],
      keyframePath: null,
      clipPath: null,
      lastFramePath: null,
      startFramePath: null,
      chainedFrom: null,
      prompt: null,
      updatedAt: new Date().toISOString(),
    };
    const prompt = assemblePrompt(mockProjectData, scene2);
    const imgPrompt = assembleImagePrompt(mockProjectData, scene2);
    const issues = deterministicChecksForScene(
      mockProjectData,
      scene2,
      prompt,
      imgPrompt,
    );
    expect(issues.some((i) => i.code === "missing_establishing")).toBe(true);
  });
});

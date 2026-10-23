import { describe, expect, it } from "vitest";
import { assemblePrompt, assembleImagePrompt } from "../src/lib/assemble";
import { DEFAULT_SETTINGS, type ProjectData, type SceneRecord } from "../src/lib/types";

const mockProjectData: ProjectData = {
  project: {
    id: "default",
    name: "River Encounter",
    story: "...",
    styleLock: "35mm film, anamorphic lens, warm golden hour sun, cinematic realism",
    settings: {
      ...DEFAULT_SETTINGS,
      dialogueLanguage: "bn",
      maxDialogueWords: 15,
      maxPeople: 2,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  characters: [
    {
      id: "rina",
      name: "Rina",
      visual_lock: "24-year-old South Asian woman, dark braided hair, light hazel eyes, wearing a simple blue cotton saree with thin white border, silver nose ring.",
      voice_lock: "Mid-pitch, gentle, soft rural Bengali accent, melancholic tone.",
      language: "bn",
      outfit_changes: false,
      refImage: null,
    },
    {
      id: "karim",
      name: "Karim",
      visual_lock: "27-year-old South Asian man, short wavy black hair, stubble, wearing a worn beige kurta and dark trousers, leather wristband.",
      voice_lock: "Deep, slightly raspy, slow pace, thoughtful cadence.",
      language: "bn",
      outfit_changes: false,
      refImage: null,
    },
  ],
  locations: [
    {
      id: "ghat",
      name: "Ghat",
      visual_lock: "Ancient stone river ghat with mossy steps leading into calm misty water, wooden boat moored nearby, sunrise glow.",
      refImage: null,
    },
  ],
  rules: [{ id: 1, text: "Never let the saree color shift.", createdAt: "" }],
  scenes: [],
};

const mockScene: SceneRecord = {
  n: 3,
  location_id: "ghat",
  characters: ["rina", "karim"],
  is_establishing: false,
  chain_from_previous: true,
  action: "Rina turns around and recognizes Karim standing on the top step.",
  camera: { shot: "medium shot", angle: "eye level", movement: "slow push in" },
  start_state: "Rina facing the water, holding a brass pitcher; Karim stands at the top step looking down.",
  end_state: "Rina fully turned facing Karim with surprise on her face; Karim raises his hand slightly.",
  dialogue: {
    speaker: "rina",
    line: "করিম? তুমি কবে ফিরলে?",
  },
  sound: "Gentle river ripples, morning birds, faint distant temple bell.",
  status: "draft",
  reasons: [],
  keyframePath: null,
  clipPath: null,
  lastFramePath: null,
  startFramePath: null,
  chainedFrom: 2,
  prompt: null,
  updatedAt: new Date().toISOString(),
};

describe("assemblePrompt", () => {
  it("inserts visual_lock and voice_lock VERBATIM for all visible characters", () => {
    const prompt = assemblePrompt(mockProjectData, mockScene);
    const rina = mockProjectData.characters.find((c) => c.id === "rina")!;
    const karim = mockProjectData.characters.find((c) => c.id === "karim")!;

    // Verbatim visual lock check
    expect(prompt).toContain(rina.visual_lock);
    expect(prompt).toContain(karim.visual_lock);

    // Verbatim voice lock check
    expect(prompt).toContain(rina.voice_lock);
    expect(prompt).toContain(karim.voice_lock);
  });

  it("inserts style_lock and location visual_lock verbatim", () => {
    const prompt = assemblePrompt(mockProjectData, mockScene);
    expect(prompt).toContain(mockProjectData.project.styleLock);
    expect(prompt).toContain(mockProjectData.locations[0].visual_lock);
  });

  it("formats dialogue in native script with language specification", () => {
    const prompt = assemblePrompt(mockProjectData, mockScene);
    expect(prompt).toContain('Rina says in Bangla, "করিম? তুমি কবে ফিরলে?"');
  });

  it("includes global custom rules in the MUST section", () => {
    const prompt = assemblePrompt(mockProjectData, mockScene);
    expect(prompt).toContain("- Never let the saree color shift.");
  });

  it("produces plain text without any markdown code blocks or header hashes", () => {
    const prompt = assemblePrompt(mockProjectData, mockScene);
    expect(prompt).not.toMatch(/```/);
    expect(prompt).not.toMatch(/^#{1,6}\s/m);
  });

  it("includes ascii id alongside native script name when they differ", () => {
    const dataWithNativeName: ProjectData = {
      ...mockProjectData,
      characters: [
        {
          id: "nilu",
          name: "নীলু",
          visual_lock: "Red fox cub in blue shirt.",
          voice_lock: "Child voice.",
          language: "bn",
          outfit_changes: false,
          refImage: null,
        },
      ],
    };
    const sceneWithNativeChar: SceneRecord = {
      ...mockScene,
      characters: ["nilu"],
    };
    const prompt = assemblePrompt(dataWithNativeName, sceneWithNativeChar);
    expect(prompt).toContain("- নীলু (nilu): Red fox cub in blue shirt.");
  });

  it("handles chaining from an establishing shot by stating location starts empty and characters enter", () => {
    const dataWithScenes: ProjectData = {
      ...mockProjectData,
      scenes: [
        {
          ...mockScene,
          n: 1,
          characters: [],
          is_establishing: true,
          chain_from_previous: false,
          startFramePath: null,
        },
        {
          ...mockScene,
          n: 2,
          characters: ["rina"],
          is_establishing: false,
          chain_from_previous: true,
          startFramePath: "keyframes/scene-1.png",
        },
      ],
    };
    const prompt = assemblePrompt(dataWithScenes, dataWithScenes.scenes[1]);
    expect(prompt).toContain(
      "Start with the location empty matching the last frame of Scene 1. Characters enter the frame during the take.",
    );
    expect(prompt).toContain(
      "The supplied start frame (last frame of Scene 1, showing the empty location) is the literal first frame of this clip.",
    );
  });

  it("adds anti-clothing-bleed rule when two or more characters are visible", () => {
    const prompt = assemblePrompt(mockProjectData, mockScene);
    // mockScene has 2 characters (rina and karim)
    expect(prompt).toContain(
      "- Do not swap or blend clothing, colors, faces, or accessories between different characters in the scene.",
    );
  });
});

describe("assembleImagePrompt", () => {
  it("builds clean keyframe image prompt with character visual locks and aspect ratio", () => {
    const imgPrompt = assembleImagePrompt(mockProjectData, mockScene);
    expect(imgPrompt).toContain(mockProjectData.locations[0].visual_lock);
    expect(imgPrompt).toContain(mockProjectData.characters[0].visual_lock);
    expect(imgPrompt).toContain("ASPECT RATIO: 16:9");
    expect(imgPrompt).not.toMatch(/```/);
  });
});

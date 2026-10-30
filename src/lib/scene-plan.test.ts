import { describe, it, expect } from "vitest";
import {
  parseScenePlanJson,
  validateScenePlan,
  extractScenePlanFromText,
  getAllShotsFromPlan,
  getShotFromPlan,
} from "./scene-plan";

describe("Scene Plan Parser & Validator (Phase B)", () => {
  const validJson = JSON.stringify({
    schemaVersion: 1,
    scenes: [
      {
        sceneId: "scene-01",
        sceneNumber: 1,
        title: "গ্রামের রাত",
        shots: [
          {
            shotId: "scene-01-shot-01",
            shotNumber: 1,
            startTime: 0,
            duration: 4.0,
            mediaKind: "image",
            voiceover: "রাত নেমেছে গ্রামে...",
            prompt: "A quiet village night with stars",
            motion: {
              type: "zoom-in",
              amount: 0.15,
            },
            transitionToNext: {
              type: "cross-dissolve",
              duration: 0.5,
            },
          },
          {
            shotId: "scene-01-shot-02",
            shotNumber: 2,
            startTime: 4.0,
            duration: 6.0,
            mediaKind: "video",
            sourceDuration: 6.0,
            voiceover: "বাতাসে পাতার মৃদু শব্দ...",
            prompt: "Leaves gently rustling in the breeze",
            motion: null,
            transitionToNext: null,
          },
        ],
      },
    ],
  });

  it("successfully parses and validates valid version 1 JSON plan", () => {
    const res = parseScenePlanJson(validJson);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.plan.schemaVersion).toBe(1);
      expect(res.plan.scenes.length).toBe(1);
      expect(res.plan.scenes[0].shots.length).toBe(2);
      expect(res.plan.totalDuration).toBe(10.0);
    }
  });

  it("rejects unsupported schemaVersion", () => {
    const invalidVersion = JSON.stringify({
      schemaVersion: 2,
      scenes: [],
    });
    const res = parseScenePlanJson(invalidVersion);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("schemaVersion");
    }
  });

  it("rejects duplicate sceneId", () => {
    const duplicateScene = {
      schemaVersion: 1,
      scenes: [
        {
          sceneId: "scene-01",
          sceneNumber: 1,
          title: "S1",
          shots: [
            {
              shotId: "sh-1",
              shotNumber: 1,
              startTime: 0,
              duration: 4,
              mediaKind: "image",
              prompt: "prompt",
            },
          ],
        },
        {
          sceneId: "scene-01", // duplicate!
          sceneNumber: 2,
          title: "S2",
          shots: [
            {
              shotId: "sh-2",
              shotNumber: 1,
              startTime: 4,
              duration: 4,
              mediaKind: "image",
              prompt: "prompt",
            },
          ],
        },
      ],
    };
    const res = validateScenePlan(duplicateScene);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("Duplicate sceneId");
    }
  });

  it("rejects duplicate shotId across scenes", () => {
    const duplicateShot = {
      schemaVersion: 1,
      scenes: [
        {
          sceneId: "scene-01",
          sceneNumber: 1,
          title: "S1",
          shots: [
            {
              shotId: "shared-shot-id",
              shotNumber: 1,
              startTime: 0,
              duration: 4,
              mediaKind: "image",
              prompt: "prompt 1",
            },
          ],
        },
        {
          sceneId: "scene-02",
          sceneNumber: 2,
          title: "S2",
          shots: [
            {
              shotId: "shared-shot-id", // duplicate!
              shotNumber: 1,
              startTime: 4,
              duration: 4,
              mediaKind: "image",
              prompt: "prompt 2",
            },
          ],
        },
      ],
    };
    const res = validateScenePlan(duplicateShot);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("Duplicate shotId");
    }
  });

  it("rejects non-sequential shot numbers within a scene", () => {
    const nonSequential = {
      schemaVersion: 1,
      scenes: [
        {
          sceneId: "scene-01",
          sceneNumber: 1,
          title: "S1",
          shots: [
            {
              shotId: "sh-1",
              shotNumber: 1,
              startTime: 0,
              duration: 4,
              mediaKind: "image",
              prompt: "p1",
            },
            {
              shotId: "sh-2",
              shotNumber: 3, // gap! should be 2
              startTime: 4,
              duration: 4,
              mediaKind: "image",
              prompt: "p2",
            },
          ],
        },
      ],
    };
    const res = validateScenePlan(nonSequential);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("Non-sequential shotNumber");
    }
  });

  it("rejects unsupported motion and transition types", () => {
    const badMotion = {
      schemaVersion: 1,
      scenes: [
        {
          sceneId: "scene-01",
          sceneNumber: 1,
          title: "S1",
          shots: [
            {
              shotId: "sh-1",
              shotNumber: 1,
              startTime: 0,
              duration: 4,
              mediaKind: "image",
              prompt: "p1",
              motion: { type: "3d-spin", amount: 0.2 }, // unsupported!
            },
          ],
        },
      ],
    };
    const res = validateScenePlan(badMotion);
    expect(res.success).toBe(false);

    const badTrans = {
      schemaVersion: 1,
      scenes: [
        {
          sceneId: "scene-01",
          sceneNumber: 1,
          title: "S1",
          shots: [
            {
              shotId: "sh-1",
              shotNumber: 1,
              startTime: 0,
              duration: 4,
              mediaKind: "image",
              prompt: "p1",
              transitionToNext: { type: "wipe-circle", duration: 0.5 }, // unsupported!
            },
          ],
        },
      ],
    };
    const res2 = validateScenePlan(badTrans);
    expect(res2.success).toBe(false);
  });

  it("rejects negative startTime or zero/negative duration", () => {
    const badTiming = {
      schemaVersion: 1,
      scenes: [
        {
          sceneId: "scene-01",
          sceneNumber: 1,
          title: "S1",
          shots: [
            {
              shotId: "sh-1",
              shotNumber: 1,
              startTime: -2, // negative!
              duration: 0, // non-positive!
              mediaKind: "image",
              prompt: "p1",
            },
          ],
        },
      ],
    };
    const res = validateScenePlan(badTiming);
    expect(res.success).toBe(false);
  });

  it("extracts plan from fenced JSON block within full LLM response", () => {
    const fullLlmOutput = `
Here is your Bengali story and scenes:

PART 1 — FULL VOICEOVER
রাত নেমেছে শান্ত নিবিড় এক মায়াবী গ্রামে।

PART 2 — STORY SCENES
SCENE #01 (0:00 - 0:04 • 4.0s coverage)
SHOT #01 (0:00 - 0:04 • 4.0s • zoom-in) [🖼️ STATIC IMAGE]
VOICEOVER: রাত নেমেছে শান্ত নিবিড় এক মায়াবী গ্রামে।
PROMPT: A peaceful village night under a starlit sky.

\`\`\`json
${validJson}
\`\`\`

Hope you liked the scenes!
    `;

    const res = extractScenePlanFromText(fullLlmOutput);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.plan.scenes[0].sceneId).toBe("scene-01");
    }
  });

  it("deterministic fallback parser extracts shots when no JSON code block exists", () => {
    const legacyTextOutput = `
SCENE #01 (0:00 - 0:10 • 10.0s coverage)

SHOT #01 (0:00 - 0:04 • 4.0s • zoom-in) [🖼️ STATIC IMAGE]
VOICEOVER: গ্রামের পথ বেয়ে আলো ফুটে উঠছে।
PROMPT: Morning golden sunrise over rural village path.

SHOT #02 (0:04 - 0:10 • 6.0s • pan-left) [🎥 HERO VIDEO — 4.0s]
VOICEOVER: বাতাসে দোলে সবুজ ধানের শিষ।
PROMPT: VIDEO GENERATION — NOT A STATIC IMAGE. Create one continuous 4.0-second animated video shot of green paddy fields waving in the breeze.
    `;

    const res = extractScenePlanFromText(legacyTextOutput);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.plan.scenes.length).toBe(1);
      expect(res.plan.scenes[0].shots.length).toBe(2);
      expect(res.plan.scenes[0].shots[0].mediaKind).toBe("image");
      expect(res.plan.scenes[0].shots[0].motion?.type).toBe("zoom-in");
      expect(res.plan.scenes[0].shots[1].mediaKind).toBe("video");
      expect(res.plan.scenes[0].shots[1].motion?.type).toBe("pan-left");
    }
  });

  it("extracts pure nested JSON block with no legacy SCENE/SHOT text", () => {
    const pureJsonOnly = `
\`\`\`json
{
  "schemaVersion": 1,
  "scenes": [
    {
      "sceneId": "scene-01",
      "sceneNumber": 1,
      "title": "নিস্তব্ধ বনানী",
      "shots": [
        {
          "shotId": "scene-01-shot-01",
          "shotNumber": 1,
          "startTime": 0.0,
          "duration": 4.5,
          "mediaKind": "image",
          "voiceover": "গভীর অরণ্যের মাঝে ছায়া ঘনিয়ে এলো।",
          "prompt": "Deep misty forest with towering ancient trees and soft ambient twilight",
          "motion": {
            "type": "zoom-out",
            "amount": 0.2
          },
          "transitionToNext": {
            "type": "fade-black",
            "duration": 0.75
          }
        },
        {
          "shotId": "scene-01-shot-02",
          "shotNumber": 2,
          "startTime": 4.5,
          "duration": 5.0,
          "mediaKind": "video",
          "sourceDuration": 6.0,
          "voiceover": "একটি হরিণ চকিতে তাকিয়ে বনের গভীরে ছুটে গেল।",
          "prompt": "VIDEO GENERATION — A deer bounds through the foliage and disappears into the mist.",
          "motion": null,
          "transitionToNext": null
        }
      ]
    }
  ]
}
\`\`\`
    `.trim();

    const res = extractScenePlanFromText(pureJsonOnly);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.plan.schemaVersion).toBe(1);
      expect(res.plan.scenes).toHaveLength(1);
      const scene = res.plan.scenes[0];
      expect(scene.sceneId).toBe("scene-01");
      expect(scene.title).toBe("নিস্তব্ধ বনানী");
      expect(scene.shots).toHaveLength(2);

      const shot1 = scene.shots[0];
      expect(shot1.shotId).toBe("scene-01-shot-01");
      expect(shot1.mediaKind).toBe("image");
      expect(shot1.motion).toEqual({ type: "zoom-out", amount: 0.2 });
      expect(shot1.transitionToNext).toEqual({ type: "fade-black", duration: 0.75 });

      const shot2 = scene.shots[1];
      expect(shot2.shotId).toBe("scene-01-shot-02");
      expect(shot2.mediaKind).toBe("video");
      expect(shot2.sourceDuration).toBe(6.0);
    }
  });

  it("returns clear actionable error when JSON block is malformed and does not falsely pass via fallback", () => {
    const malformedJsonInput = `
Here is the plan:
\`\`\`json
{
  "schemaVersion": 1,
  "scenes": [
    {
      "sceneId": "scene-01",
      "sceneNumber": 1,
      "title": "Broken JSON",
      "shots": [
        {
          "shotId": "s1",
          "shotNumber": 1,
          "startTime": 0,
          "duration": 4, // missing closing brackets
    }
\`\`\`
    `;

    const res = extractScenePlanFromText(malformedJsonInput);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/Malformed JSON|Validation error/i);
    }
  });

  it("returns clear validation error when JSON block has schema errors and does not falsely pass", () => {
    const invalidSchemaJson = `
\`\`\`json
{
  "schemaVersion": 1,
  "scenes": [
    {
      "sceneId": "scene-01",
      "sceneNumber": 1,
      "title": "Invalid Motion Scene",
      "shots": [
        {
          "shotId": "s1",
          "shotNumber": 1,
          "startTime": 0,
          "duration": 4,
          "mediaKind": "image",
          "prompt": "Test prompt",
          "motion": {
            "type": "unsupported-gyro-twist",
            "amount": 0.2
          }
        }
      ]
    }
  ]
}
\`\`\`
    `;

    const res = extractScenePlanFromText(invalidSchemaJson);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("Validation error");
    }
  });

  it("helpers getAllShotsFromPlan and getShotFromPlan work accurately", () => {
    const parsed = parseScenePlanJson(validJson);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const allShots = getAllShotsFromPlan(parsed.plan);
      expect(allShots.length).toBe(2);
      expect(allShots[0].shotId).toBe("scene-01-shot-01");
      expect(allShots[1].shotId).toBe("scene-01-shot-02");

      const shot1 = getShotFromPlan(parsed.plan, "scene-01-shot-01");
      expect(shot1).toBeDefined();
      expect(shot1?.mediaKind).toBe("image");

      const nonExistent = getShotFromPlan(parsed.plan, "invalid-id");
      expect(nonExistent).toBeUndefined();
    }
  });
});

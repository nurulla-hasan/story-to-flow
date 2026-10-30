import { describe, expect, it } from "vitest";
import { parseProductionPackage } from "./output-parser";

const fence = "\u0060".repeat(3);

describe("parseProductionPackage timeline JSON output", () => {
  it("extracts valid plan JSON separately and omits scene voiceover lines", () => {
    const plan = {
      schemaVersion: 1,
      scenes: [
        {
          sceneId: "scene-01",
          sceneNumber: 1,
          title: "A village evening",
          shots: [
            {
              shotId: "scene-01-shot-01",
              shotNumber: 1,
              startTime: 0,
              duration: 4,
              mediaKind: "image",
              prompt: "A quiet village at sunset",
            },
          ],
        },
      ],
    };
    const response = [
      "PART 1 — FULL VOICEOVER",
      fence + "text",
      "Narration that should not appear in the prompt handoff.",
      fence,
      "",
      "PART 2 — SCENE PROMPTS",
      fence + "text",
      "SCENE #01 (0:00 - 0:04 • 4.0s coverage)",
      "VOICEOVER: Narration that should be omitted.",
      "PROMPT: A quiet village at sunset.",
      fence,
      "",
      fence + "json",
      JSON.stringify(plan, null, 2),
      fence,
    ].join("\n");

    const parsed = parseProductionPackage(response);

    expect(parsed.planJson).toBe(JSON.stringify(plan, null, 2));
    expect(JSON.parse(parsed.planJson || "null")).toEqual(plan);
    expect(parsed.scenesText).not.toContain("VOICEOVER:");
    expect(parsed.scenesText).toContain("PROMPT: A quiet village at sunset.");
  });

  it("does not expose malformed JSON as a copyable plan", () => {
    const response = [
      "PART 2 — SCENE PROMPTS",
      fence + "text",
      "SCENE #01",
      "PROMPT: A village.",
      fence,
      "",
      fence + "json",
      "{ invalid json }",
      fence,
    ].join("\n");

    expect(parseProductionPackage(response).planJson).toBeNull();
  });
});

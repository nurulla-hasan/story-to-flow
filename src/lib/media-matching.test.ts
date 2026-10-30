import { describe, it, expect } from "vitest";
import { matchAssetsToPlan, extractSceneAndShotNumber } from "./media-matching";
import type { ScenePlan } from "./scene-plan";
import type { MediaAssetItem } from "./media-storage";
import type { TimelineTrack } from "@/types/timeline";

describe("Media Matching & Bulk Assignment Engine (Phase C)", () => {
  const mockPlan: ScenePlan = {
    schemaVersion: 1,
    scenes: [
      {
        sceneId: "scene-01",
        sceneNumber: 1,
        title: "Morning Scene",
        shots: [
          {
            shotId: "scene-01-shot-01",
            shotNumber: 1,
            startTime: 0,
            duration: 4.0,
            mediaKind: "image",
            prompt: "Village sunrise with golden mist",
          },
          {
            shotId: "scene-01-shot-02",
            shotNumber: 2,
            startTime: 4.0,
            duration: 4.0,
            mediaKind: "video",
            prompt: "Farmer walking through green rice field",
          },
        ],
      },
      {
        sceneId: "scene-02",
        sceneNumber: 2,
        title: "Afternoon Scene",
        shots: [
          {
            shotId: "scene-02-shot-01",
            shotNumber: 1,
            startTime: 8.0,
            duration: 5.0,
            mediaKind: "image",
            prompt: "Riverbank with small boats and fishermen",
          },
        ],
      },
    ],
  };

  const mockAssets: MediaAssetItem[] = [
    {
      id: "a_s1_sh1",
      name: "scene_01_shot_01.png",
      category: "image",
      mimeType: "image/png",
      size: 1024,
      blob: new Blob([]),
      url: "blob:http://localhost:3000/mock-1",
      importedAt: Date.now(),
      lastModified: Date.now(),
    },
    {
      id: "a_s1_sh2",
      name: "scene-01-shot-02.mp4",
      category: "video",
      mimeType: "video/mp4",
      size: 5000,
      blob: new Blob([]),
      url: "blob:http://localhost:3000/mock-2",
      importedAt: Date.now(),
      lastModified: Date.now(),
    },
    {
      id: "a_s2",
      name: "Scene_02.png",
      category: "image",
      mimeType: "image/png",
      size: 2048,
      blob: new Blob([]),
      url: "blob:http://localhost:3000/mock-3",
      importedAt: Date.now(),
      lastModified: Date.now(),
    },
  ];

  it("extracts scene and shot numbers accurately across varied naming styles", () => {
    expect(extractSceneAndShotNumber("scene_01_shot_02.png")).toEqual({ scene: 1, shot: 2 });
    expect(extractSceneAndShotNumber("scene-02-shot-01.mp4")).toEqual({ scene: 2, shot: 1 });
    expect(extractSceneAndShotNumber("s03_sh04.jpg")).toEqual({ scene: 3, shot: 4 });
    expect(extractSceneAndShotNumber("scene_05.png")).toEqual({ scene: 5, shot: undefined });
  });

  it("matches exact scene and shot numbers with 1.0 confidence", () => {
    const matches = matchAssetsToPlan(mockPlan, mockAssets);
    expect(matches).toHaveLength(3);

    expect(matches[0].shotId).toBe("scene-01-shot-01");
    expect(matches[0].matchedAsset?.id).toBe("a_s1_sh1");
    expect(matches[0].matchQuality).toBe("exact");
    expect(matches[0].confidence).toBe(1.0);

    expect(matches[1].shotId).toBe("scene-01-shot-02");
    expect(matches[1].matchedAsset?.id).toBe("a_s1_sh2");
    expect(matches[1].matchQuality).toBe("exact");

    expect(matches[2].shotId).toBe("scene-02-shot-01");
    expect(matches[2].matchedAsset?.id).toBe("a_s2");
    expect(matches[2].matchQuality).toBe("exact");
  });

  it("never assigns video to image slot or image to video slot", () => {
    const videoOnlyAssets: MediaAssetItem[] = [
      {
        id: "v1",
        name: "scene_01_shot_01.mp4", // named for shot 1 (image), but is a video!
        category: "video",
        mimeType: "video/mp4",
        size: 5000,
        blob: new Blob([]),
        url: "blob:http://localhost:3000/mock-v1",
        importedAt: Date.now(),
        lastModified: Date.now(),
      },
    ];

    const matches = matchAssetsToPlan(mockPlan, videoOnlyAssets);
    // Shot 1 is image kind -> must NOT match video asset
    expect(matches[0].matchedAsset).toBeNull();
    expect(matches[0].matchQuality).toBe("none");
  });

  it("does not duplicate assign same asset to multiple shots by default", () => {
    const singleAsset: MediaAssetItem[] = [
      {
        id: "shared_img",
        name: "village_river.png",
        category: "image",
        mimeType: "image/png",
        size: 1000,
        blob: new Blob([]),
        url: "blob:http://localhost:3000/mock-single",
        importedAt: Date.now(),
        lastModified: Date.now(),
      },
    ];

    const matches = matchAssetsToPlan(mockPlan, singleAsset, [], { allowDuplicates: false });
    const assignedIds = matches.map((m) => m.matchedAsset?.id).filter(Boolean);
    const uniqueIds = new Set(assignedIds);
    expect(assignedIds.length).toBe(uniqueIds.size);
  });

  it("preserves manual assignments unless replaceExisting is set", () => {
    const planWithManual: ScenePlan = {
      ...mockPlan,
      scenes: [
        {
          ...mockPlan.scenes[0],
          shots: [
            {
              ...mockPlan.scenes[0].shots[0],
              assignedAssetId: "manual_asset_id",
            },
            mockPlan.scenes[0].shots[1],
          ],
        },
        mockPlan.scenes[1],
      ],
    };

    const assetsWithManual: MediaAssetItem[] = [
      ...mockAssets,
      {
        id: "manual_asset_id",
        name: "custom_manual.png",
        category: "image",
        mimeType: "image/png",
        size: 1000,
        blob: new Blob([]),
        url: "blob:http://localhost:3000/mock-manual",
        importedAt: Date.now(),
        lastModified: Date.now(),
      },
    ];

    const matches = matchAssetsToPlan(planWithManual, assetsWithManual, [], { replaceExisting: false });
    expect(matches[0].matchedAsset?.id).toBe("manual_asset_id");
    expect(matches[0].isExistingAssignment).toBe(true);

    const matchesReplaced = matchAssetsToPlan(planWithManual, assetsWithManual, [], { replaceExisting: true });
    expect(matchesReplaced[0].matchedAsset?.id).toBe("a_s1_sh1");
  });

  it("skips assignments and reports reason when destination track is locked", () => {
    const lockedTracks: TimelineTrack[] = [
      {
        id: "visual-1",
        name: "Main Visual",
        type: "visual",
        order: 0,
        visible: true,
        locked: true, // LOCKED!
        muted: false,
        volume: 1,
      },
    ];

    const matches = matchAssetsToPlan(mockPlan, mockAssets, lockedTracks);
    expect(matches[0].matchQuality).toBe("locked-track");
    expect(matches[0].matchedAsset).toBeNull();
    expect(matches[0].reason).toContain("locked");
  });
});

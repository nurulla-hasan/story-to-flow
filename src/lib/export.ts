import JSZip from "jszip";
import { readAsset } from "./files";
import type { ProjectData, SceneRecord } from "./types";

export function buildPromptsTxt(data: ProjectData): string {
  const lines: string[] = [];
  lines.push(`STORY TO FLOW — ${data.project.name}`);
  lines.push(`Scenes: ${data.scenes.length}`);
  lines.push(`Aspect ratio: ${data.project.settings.aspectRatio}`);
  lines.push("");
  for (const scene of data.scenes) {
    lines.push("=".repeat(72));
    lines.push(
      `SCENE ${scene.n} — ${locationName(data, scene)} — ${scene.status.toUpperCase()}`,
    );
    lines.push("=".repeat(72));
    lines.push(scene.prompt?.text ?? "(prompt not generated yet)");
    if (scene.reasons.length) {
      lines.push("");
      lines.push(`NEEDS ATTENTION: ${scene.reasons.join(" | ")}`);
    }
    lines.push("");
  }
  return lines.join("\r\n");
}

export function buildPlanJson(data: ProjectData) {
  return {
    app: "story-to-flow",
    exportedAt: new Date().toISOString(),
    project: {
      id: data.project.id,
      name: data.project.name,
      story: data.project.story,
      styleLock: data.project.styleLock,
      settings: data.project.settings,
    },
    characters: data.characters.map((character) => ({
      id: character.id,
      name: character.name,
      visual_lock: character.visual_lock,
      voice_lock: character.voice_lock,
      language: character.language,
      outfit_changes: character.outfit_changes,
      refImage: character.refImage,
    })),
    locations: data.locations,
    rules: data.rules.map((rule) => rule.text),
    scenes: data.scenes.map((scene) => ({
      n: scene.n,
      status: scene.status,
      location_id: scene.location_id,
      characters: scene.characters,
      is_establishing: scene.is_establishing,
      chain_from_previous: scene.chain_from_previous,
      chainedFrom: scene.chainedFrom,
      action: scene.action,
      camera: scene.camera,
      start_state: scene.start_state,
      end_state: scene.end_state,
      dialogue: scene.dialogue,
      sound: scene.sound,
      reasons: scene.reasons,
      prompt: scene.prompt,
      files: {
        keyframe: scene.keyframePath,
        clip: scene.clipPath,
        lastFrame: scene.lastFramePath,
        startFrame: scene.startFramePath,
      },
    })),
  };
}

export async function buildZip(data: ProjectData): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("prompts.txt", buildPromptsTxt(data));
  zip.file("plan.json", JSON.stringify(buildPlanJson(data), null, 2));

  for (const scene of data.scenes) {
    const prefix = `scene-${String(scene.n).padStart(2, "0")}`;
    await addSceneFile(zip, `keyframes/${prefix}`, scene.keyframePath);
    await addSceneFile(zip, `last-frames/${prefix}`, scene.lastFramePath);
    await addSceneFile(zip, `start-frames/${prefix}`, scene.startFramePath);
    await addSceneFile(zip, `clips/${prefix}`, scene.clipPath);
  }
  for (const character of data.characters) {
    if (character.refImage) {
      await addSceneFile(zip, `characters/${character.id}-ref`, character.refImage);
    }
  }
  for (const location of data.locations) {
    if (location.refImage) {
      await addSceneFile(zip, `locations/${location.id}-ref`, location.refImage);
    }
  }
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return buffer;
}

async function addSceneFile(
  zip: JSZip,
  base: string,
  relPath: string | null,
): Promise<void> {
  if (!relPath) return;
  try {
    const buffer = readAsset(relPath);
    const ext = relPath.split(".").pop() || "bin";
    zip.file(`${base}.${ext}`, buffer);
  } catch {
    // missing file: skip
  }
}

function locationName(data: ProjectData, scene: SceneRecord): string {
  return (
    data.locations.find((location) => location.id === scene.location_id)?.name ??
    scene.location_id
  );
}

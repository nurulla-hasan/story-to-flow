import { getRepo, DEFAULT_PROJECT_ID } from "./db";
import { loadStudioProject, saveStudioProject } from "./studio";
import {
  reassembleShortsProject,
  type ReassembleShortsProjectResult,
} from "./studio-plan";
import type { ProjectData } from "./types";

export interface SyncStudioPromptsOptions {
  /** Map a deleted/merged character id to its replacement id. */
  characterIdMap?: Record<string, string>;
}

function castFrom(data: ProjectData) {
  return data.characters
    .filter((character) => character.visual_lock.trim().length >= 10)
    .map((character) => ({
      id: character.id,
      name: character.name,
      visualLock: character.visual_lock,
      voiceLock: character.voice_lock,
      refImageUrl: character.refImage,
    }));
}

function locationsFrom(data: ProjectData) {
  return data.locations
    .filter((location) => location.visual_lock.trim().length >= 10)
    .map((location) => ({
      id: location.id,
      name: location.name,
      visualLock: location.visual_lock,
    }));
}

/**
 * Rebuild the saved Shorts project after a Bible lock changes. This keeps the
 * server copy (used by the editor and other tabs) aligned with the workspace
 * before the client's own re-sync saves the latest local project.
 */
export function syncStudioProjectPrompts(
  options: SyncStudioPromptsOptions = {},
): ReassembleShortsProjectResult["changedClips"] {
  const project = loadStudioProject();
  if (!project) return 0;

  const isShortsProject =
    project.workflowMode === "shorts-animatic" ||
    (!project.workflowMode && (project.cast?.length ?? 0) > 0);
  if (!isShortsProject) return 0;

  const data = getRepo().getProjectData(DEFAULT_PROJECT_ID);
  const { project: nextProject, changedClips } = reassembleShortsProject({
    project,
    cast: castFrom(data),
    locations: locationsFrom(data),
    styleLock: data.project.styleLock,
    stylePreset: data.project.settings.stylePreset,
    aspectRatio: data.project.settings.aspectRatio,
    characterIdMap: options.characterIdMap,
  });

  saveStudioProject(nextProject);
  return changedClips;
}

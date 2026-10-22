import type {
  Bible,
  CharacterRecord,
  JobRecord,
  ProjectData,
  ProjectRecord,
  PromptVersion,
  RuleRecord,
  Scene,
  SceneRecord,
  Settings,
  SettingsPatch,
} from "../types";

export const DEFAULT_PROJECT_ID = "default";

export type ScenePatch = Partial<Omit<Scene, "n">> & {
  status?: SceneRecord["status"];
  reasons?: string[];
  keyframePath?: string | null;
  clipPath?: string | null;
  lastFramePath?: string | null;
  startFramePath?: string | null;
  chainedFrom?: number | null;
};

export interface Repo {
  readonly kind: "sqlite" | "json";

  getProjectData(projectId: string): ProjectData;
  getProject(projectId: string): ProjectRecord;
  updateProject(
    projectId: string,
    patch: {
      name?: string;
      story?: string;
      styleLock?: string;
      settings?: SettingsPatch;
    },
  ): ProjectRecord;

  replaceBible(projectId: string, bible: Bible): void;
  getCharacters(projectId: string): CharacterRecord[];
  addCharacter(projectId: string, character: CharacterRecord): void;
  updateCharacter(
    projectId: string,
    id: string,
    patch: Partial<CharacterRecord>,
  ): void;
  deleteCharacter(projectId: string, id: string): void;
  updateLocation(
    projectId: string,
    id: string,
    patch: { visual_lock?: string; refImage?: string | null; name?: string },
  ): void;

  getScenes(projectId: string): SceneRecord[];
  getScene(projectId: string, n: number): SceneRecord | null;
  replaceScenes(projectId: string, scenes: Scene[]): void;
  updateScene(projectId: string, n: number, patch: ScenePatch): void;
  splitScene(
    projectId: string,
    n: number,
    first?: Partial<Scene>,
    second?: Partial<Scene>,
  ): void;
  mergeScenes(projectId: string, n: number, merged?: Partial<Scene>): void;
  deleteScene(projectId: string, n: number): void;

  getPromptVersions(projectId: string, n: number): PromptVersion[];
  getLatestPrompt(projectId: string, n: number): PromptVersion | null;
  addPromptVersion(
    projectId: string,
    n: number,
    data: { text: string; imagePrompt: string; reinforcements: string[] },
  ): PromptVersion;

  listRules(projectId: string): RuleRecord[];
  addRule(projectId: string, text: string): RuleRecord;
  deleteRule(projectId: string, id: number): void;

  createJob(projectId: string, type: string): JobRecord;
  updateJob(
    id: string,
    patch: Partial<Pick<JobRecord, "status" | "progress" | "message" | "error" | "result">>,
  ): JobRecord | null;
  getJob(id: string): JobRecord | null;
  getLastJob(projectId: string, type?: string): JobRecord | null;
}

export function mergeSettings(
  current: Settings,
  patch: SettingsPatch | undefined,
): Settings {
  if (!patch) return current;
  return {
    ...current,
    ...patch,
    models: {
      ...current.models,
      ...(patch.models ?? {}),
    },
  };
}

export function sortCharacters(list: CharacterRecord[]): CharacterRecord[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

export function locationDisplayName(id: string): string {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function sceneToRecord(
  projectData: ProjectData,
  scene: Scene,
): SceneRecord {
  return {
    ...scene,
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
}

export function findLocation(projectData: ProjectData, id: string) {
  return (
    projectData.locations.find((location) => location.id === id) ?? {
      id,
      name: locationDisplayName(id),
      visual_lock: `Location "${id}" as established earlier in the story.`,
      refImage: null,
    }
  );
}

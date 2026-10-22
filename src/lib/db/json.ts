import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_SETTINGS,
  newId,
  nowIso,
  settingsSchema,
  type Bible,
  type CharacterRecord,
  type JobRecord,
  type ProjectData,
  type ProjectRecord,
  type PromptVersion,
  type RuleRecord,
  type Scene,
  type SceneRecord,
  type SettingsPatch,
} from "../types";
import { DATA_DIR, ensureDirs } from "../files";
import {
  locationDisplayName,
  mergeSettings,
  type Repo,
  type ScenePatch,
} from "./repo";

interface StoredCharacter extends CharacterRecord {
  projectId: string;
}

interface StoredLocation {
  projectId: string;
  id: string;
  name: string;
  visual_lock: string;
  refImage: string | null;
}

interface StoredPrompt extends PromptVersion {
  projectId: string;
  sceneN: number;
}

interface StoredScene extends Omit<SceneRecord, "prompt"> {
  projectId: string;
}

interface StoredRule extends RuleRecord {
  projectId: string;
}

interface JsonDoc {
  projects: ProjectRecord[];
  characters: StoredCharacter[];
  locations: StoredLocation[];
  scenes: StoredScene[];
  prompts: StoredPrompt[];
  rules: StoredRule[];
  jobs: JobRecord[];
}

const EMPTY_DOC: JsonDoc = {
  projects: [],
  characters: [],
  locations: [],
  scenes: [],
  prompts: [],
  rules: [],
  jobs: [],
};

function dbPath(): string {
  return path.join(DATA_DIR, "db.json");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class JsonRepo implements Repo {
  readonly kind = "json" as const;

  private load(): JsonDoc {
    ensureDirs();
    const file = dbPath();
    if (!fs.existsSync(file)) return clone(EMPTY_DOC);
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<JsonDoc>;
      return {
        projects: parsed.projects ?? [],
        characters: parsed.characters ?? [],
        locations: parsed.locations ?? [],
        scenes: parsed.scenes ?? [],
        prompts: parsed.prompts ?? [],
        rules: parsed.rules ?? [],
        jobs: parsed.jobs ?? [],
      };
    } catch {
      return clone(EMPTY_DOC);
    }
  }

  private save(doc: JsonDoc): void {
    ensureDirs();
    const file = dbPath();
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(doc, null, 2), "utf8");
    fs.renameSync(tmp, file);
  }

  private ensureProject(doc: JsonDoc, projectId: string): ProjectRecord {
    let project = doc.projects.find((p) => p.id === projectId);
    if (!project) {
      const now = nowIso();
      project = {
        id: projectId,
        name: "Untitled story",
        story: "",
        styleLock: "",
        settings: DEFAULT_SETTINGS,
        createdAt: now,
        updatedAt: now,
      };
      doc.projects.push(project);
    }
    project.settings = settingsSchema.parse(project.settings);
    if (typeof project.styleLock !== "string") project.styleLock = "";
    return project;
  }

  private latestPrompt(doc: JsonDoc, projectId: string, n: number): PromptVersion | null {
    const versions = doc.prompts
      .filter((p) => p.projectId === projectId && p.sceneN === n)
      .sort((a, b) => b.version - a.version);
    const first = versions[0];
    if (!first) return null;
    return {
      version: first.version,
      text: first.text,
      imagePrompt: first.imagePrompt,
      reinforcements: first.reinforcements ?? [],
      createdAt: first.createdAt,
    };
  }

  private sceneRecord(doc: JsonDoc, scene: StoredScene): SceneRecord {
    const { projectId, ...rest } = scene;
    return {
      ...clone(rest),
      prompt: this.latestPrompt(doc, projectId, scene.n),
    };
  }

  getProject(projectId: string): ProjectRecord {
    const doc = this.load();
    const project = this.ensureProject(doc, projectId);
    this.save(doc);
    return clone(project);
  }

  getProjectData(projectId: string): ProjectData {
    const doc = this.load();
    const project = clone(this.ensureProject(doc, projectId));
    this.save(doc);
    return {
      project,
      characters: doc.characters
        .filter((c) => c.projectId === projectId)
        .map((c) => {
          const item = clone(c);
          delete (item as { projectId?: string }).projectId;
          return item;
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
      locations: doc.locations
        .filter((l) => l.projectId === projectId)
        .map((l) => {
          const item = clone(l);
          delete (item as { projectId?: string }).projectId;
          return item;
        }),
      scenes: doc.scenes
        .filter((s) => s.projectId === projectId)
        .sort((a, b) => a.n - b.n)
        .map((s) => this.sceneRecord(doc, s)),
      rules: doc.rules
        .filter((r) => r.projectId === projectId)
        .map((r) => {
          const item = clone(r);
          delete (item as { projectId?: string }).projectId;
          return item;
        }),
    };
  }

  updateProject(
    projectId: string,
    patch: {
      name?: string;
      story?: string;
      styleLock?: string;
      settings?: SettingsPatch;
    },
  ): ProjectRecord {
    const doc = this.load();
    const project = this.ensureProject(doc, projectId);
    if (patch.name !== undefined) project.name = patch.name;
    if (patch.story !== undefined) project.story = patch.story;
    if (patch.styleLock !== undefined) project.styleLock = patch.styleLock;
    if (patch.settings) project.settings = mergeSettings(project.settings, patch.settings);
    project.updatedAt = nowIso();
    this.save(doc);
    return clone(project);
  }

  replaceBible(projectId: string, bible: Bible): void {
    const doc = this.load();
    this.ensureProject(doc, projectId);
    doc.characters = doc.characters.filter((c) => c.projectId !== projectId);
    doc.locations = doc.locations.filter((l) => l.projectId !== projectId);
    for (const character of bible.characters) {
      doc.characters.push({ projectId, ...character, refImage: null });
    }
    for (const location of bible.locations) {
      doc.locations.push({
        projectId,
        id: location.id,
        name: locationDisplayName(location.id),
        visual_lock: location.visual_lock,
        refImage: null,
      });
    }
    this.save(doc);
  }

  getCharacters(projectId: string): CharacterRecord[] {
    return this.getProjectData(projectId).characters;
  }

  addCharacter(projectId: string, character: CharacterRecord): void {
    const doc = this.load();
    this.ensureProject(doc, projectId);
    doc.characters.push({ projectId, ...character });
    this.save(doc);
  }

  updateCharacter(projectId: string, id: string, patch: Partial<CharacterRecord>): void {
    const doc = this.load();
    const character = doc.characters.find(
      (c) => c.projectId === projectId && c.id === id,
    );
    if (!character) throw new Error(`Character "${id}" not found`);
    Object.assign(character, patch);
    this.save(doc);
  }

  deleteCharacter(projectId: string, id: string): void {
    const doc = this.load();
    doc.characters = doc.characters.filter(
      (c) => !(c.projectId === projectId && c.id === id),
    );
    doc.scenes = doc.scenes.map((scene) =>
      scene.projectId === projectId
        ? { ...scene, characters: scene.characters.filter((cid) => cid !== id) }
        : scene,
    );
    this.save(doc);
  }

  updateLocation(
    projectId: string,
    id: string,
    patch: { visual_lock?: string; refImage?: string | null; name?: string },
  ): void {
    const doc = this.load();
    const location = doc.locations.find(
      (l) => l.projectId === projectId && l.id === id,
    );
    if (!location) throw new Error(`Location "${id}" not found`);
    Object.assign(location, patch);
    this.save(doc);
  }

  getScenes(projectId: string): SceneRecord[] {
    return this.getProjectData(projectId).scenes;
  }

  getScene(projectId: string, n: number): SceneRecord | null {
    return this.getScenes(projectId).find((scene) => scene.n === n) ?? null;
  }

  replaceScenes(projectId: string, scenes: Scene[]): void {
    const doc = this.load();
    this.ensureProject(doc, projectId);
    doc.scenes = doc.scenes.filter((s) => s.projectId !== projectId);
    doc.prompts = doc.prompts.filter((p) => p.projectId !== projectId);
    const now = nowIso();
    for (const scene of scenes) {
      doc.scenes.push({
        projectId,
        ...scene,
        status: "draft",
        reasons: [],
        keyframePath: null,
        clipPath: null,
        lastFramePath: null,
        startFramePath: null,
        chainedFrom: null,
        updatedAt: now,
      });
    }
    this.save(doc);
  }

  updateScene(projectId: string, n: number, patch: ScenePatch): void {
    const doc = this.load();
    const scene = doc.scenes.find((s) => s.projectId === projectId && s.n === n);
    if (!scene) throw new Error(`Scene ${n} not found`);
    Object.assign(scene, patch, { updatedAt: nowIso() });
    this.save(doc);
  }

  splitScene(
    projectId: string,
    n: number,
    first?: Partial<Scene>,
    second?: Partial<Scene>,
  ): void {
    const doc = this.load();
    const scene = doc.scenes.find((s) => s.projectId === projectId && s.n === n);
    if (!scene) throw new Error(`Scene ${n} not found`);
    for (const other of doc.scenes) {
      if (other.projectId === projectId && other.n > n) other.n += 1;
    }
    for (const prompt of doc.prompts) {
      if (prompt.projectId === projectId && prompt.sceneN > n) prompt.sceneN += 1;
    }
    const firstEnd = (first?.end_state as string | undefined) ?? scene.end_state;
    const next: StoredScene = {
      ...clone(scene),
      ...(second ?? {}),
      n: n + 1,
      projectId,
      status: "draft",
      reasons: [],
      keyframePath: null,
      clipPath: null,
      lastFramePath: null,
      startFramePath: null,
      chainedFrom: null,
      updatedAt: nowIso(),
    };
    if (!second?.start_state) next.start_state = firstEnd;
    Object.assign(scene, first ?? {}, {
      end_state: firstEnd,
      updatedAt: nowIso(),
    });
    doc.scenes.push(next);
    this.save(doc);
  }

  mergeScenes(projectId: string, n: number, merged?: Partial<Scene>): void {
    const doc = this.load();
    const first = doc.scenes.find((s) => s.projectId === projectId && s.n === n);
    const second = doc.scenes.find((s) => s.projectId === projectId && s.n === n + 1);
    if (!first || !second) throw new Error(`Scenes ${n} and ${n + 1} are required`);
    for (const other of doc.scenes) {
      if (other.projectId === projectId && other.n > n + 1) other.n -= 1;
    }
    doc.scenes = doc.scenes.filter(
      (s) => !(s.projectId === projectId && s.n === n + 1),
    );
    doc.prompts = doc.prompts.filter(
      (p) => !(p.projectId === projectId && p.sceneN === n + 1),
    );
    for (const prompt of doc.prompts) {
      if (prompt.projectId === projectId && prompt.sceneN > n + 1) prompt.sceneN -= 1;
    }
    Object.assign(first, merged ?? {}, {
      action: merged?.action ?? `${first.action} ${second.action}`,
      start_state: merged?.start_state ?? first.start_state,
      end_state: merged?.end_state ?? second.end_state,
      characters: merged?.characters ?? [
        ...new Set([...first.characters, ...second.characters]),
      ],
      dialogue: merged?.dialogue ?? first.dialogue ?? second.dialogue,
      status: "draft",
      updatedAt: nowIso(),
    });
    this.save(doc);
  }

  deleteScene(projectId: string, n: number): void {
    const doc = this.load();
    doc.scenes = doc.scenes.filter(
      (s) => !(s.projectId === projectId && s.n === n),
    );
    doc.prompts = doc.prompts.filter(
      (p) => !(p.projectId === projectId && p.sceneN === n),
    );
    for (const scene of doc.scenes) {
      if (scene.projectId === projectId && scene.n > n) scene.n -= 1;
    }
    for (const prompt of doc.prompts) {
      if (prompt.projectId === projectId && prompt.sceneN > n) prompt.sceneN -= 1;
    }
    this.save(doc);
  }

  getPromptVersions(projectId: string, n: number): PromptVersion[] {
    const doc = this.load();
    return doc.prompts
      .filter((p) => p.projectId === projectId && p.sceneN === n)
      .sort((a, b) => b.version - a.version)
      .map((p) => ({
        version: p.version,
        text: p.text,
        imagePrompt: p.imagePrompt,
        reinforcements: p.reinforcements ?? [],
        createdAt: p.createdAt,
      }));
  }

  getLatestPrompt(projectId: string, n: number): PromptVersion | null {
    return this.latestPrompt(this.load(), projectId, n);
  }

  addPromptVersion(
    projectId: string,
    n: number,
    data: { text: string; imagePrompt: string; reinforcements: string[] },
  ): PromptVersion {
    const doc = this.load();
    const version =
      Math.max(
        0,
        ...doc.prompts
          .filter((p) => p.projectId === projectId && p.sceneN === n)
          .map((p) => p.version),
      ) + 1;
    const record: StoredPrompt = {
      projectId,
      sceneN: n,
      version,
      text: data.text,
      imagePrompt: data.imagePrompt,
      reinforcements: data.reinforcements,
      createdAt: nowIso(),
    };
    doc.prompts.push(record);
    this.save(doc);
    return {
      version,
      text: record.text,
      imagePrompt: record.imagePrompt,
      reinforcements: record.reinforcements,
      createdAt: record.createdAt,
    };
  }

  listRules(projectId: string): RuleRecord[] {
    const doc = this.load();
    return doc.rules
      .filter((r) => r.projectId === projectId)
      .map((r) => ({ id: r.id, text: r.text, createdAt: r.createdAt }));
  }

  addRule(projectId: string, text: string): RuleRecord {
    const doc = this.load();
    const id = Math.max(0, ...doc.rules.map((r) => r.id)) + 1;
    const rule: StoredRule = { projectId, id, text, createdAt: nowIso() };
    doc.rules.push(rule);
    this.save(doc);
    return { id, text, createdAt: rule.createdAt };
  }

  deleteRule(projectId: string, id: number): void {
    const doc = this.load();
    doc.rules = doc.rules.filter(
      (r) => !(r.projectId === projectId && r.id === id),
    );
    this.save(doc);
  }

  createJob(projectId: string, type: string): JobRecord {
    const doc = this.load();
    const now = nowIso();
    const job: JobRecord = {
      id: newId(),
      projectId,
      type,
      status: "running",
      progress: 0,
      message: "Starting…",
      error: null,
      result: null,
      createdAt: now,
      updatedAt: now,
    };
    doc.jobs.push(job);
    this.save(doc);
    return clone(job);
  }

  updateJob(
    id: string,
    patch: Partial<Pick<JobRecord, "status" | "progress" | "message" | "error" | "result">>,
  ): JobRecord | null {
    const doc = this.load();
    const job = doc.jobs.find((j) => j.id === id);
    if (!job) return null;
    Object.assign(job, patch, { updatedAt: nowIso() });
    this.save(doc);
    return clone(job);
  }

  getJob(id: string): JobRecord | null {
    const job = this.load().jobs.find((j) => j.id === id);
    return job ? clone(job) : null;
  }

  getLastJob(projectId: string, type?: string): JobRecord | null {
    const jobs = this.load().jobs.filter(
      (j) => j.projectId === projectId && (!type || j.type === type),
    );
    const last = jobs[jobs.length - 1];
    return last ? clone(last) : null;
  }
}
